//! Key (musical tonality) detection: classical name + Camelot code.
//!
//! This is the deterministic inference path for T1.1.4 ("Key detection: Camelot +
//! classical notation"). It turns a [`DecodedAudio`] signal into a key estimate using
//! a chroma-based key-finding algorithm:
//!
//! 1. Decode -> mono -> resample to the analysis rate (via [`prepare_for_model`]).
//! 2. Short-time Fourier transform (Hann window) to get a magnitude spectrogram.
//! 3. Fold the spectrogram into a 12-bin pitch-class (chroma) profile per frame,
//!    then time-aggregate. (Hann windowing suppresses leakage between adjacent
//!    pitch classes, which matters for chroma more than for onset detection.)
//! 4. Score every one of the 24 keys (12 major + 12 minor) by correlating the
//!    chroma profile against the Krumhansl-Kessler key-finding profiles, rotated
//!    to each candidate root. The best correlation wins.
//! 5. Map the winning root/mode to a classical key name (e.g. `A minor`) and to the
//!    Camelot harmonic-mixing code (e.g. `8A`).
//! 6. Emit a [`KeyEstimate`] (`key_classical`, `key_camelot`, `confidence`, method).
//!
//! ## ONNX seam
//! When a key-detection model (Essentia-style or CNN, per `docs/architecture/MODELS.md`)
//! is wired in, callers can supply a 12-bin chroma activation curve and reuse the
//! same key-finding post-processor (profile correlation + Camelot mapping) unchanged.
//! The deterministic chroma profile is the default activation.
//!
//! ## Reliability
//! Key detection is "reasonably reliable" (see `CANONICAL_DOCUMENTATION.md` §4): a
//! strong tony centre yields a confident estimate, but ambiguous harmonic progressions
//! or atonal material degrade to a low-confidence result that the caller may flag
//! for review / user override. Only an empty audio buffer is an [`AnalysisError`].

use num_complex::Complex;
use rustfft::{Fft, FftPlanner};

use crate::decoder::DecodedAudio;
use crate::error::AnalysisError;
use crate::normalizer::prepare_for_model;

/// Pipeline version stamp for key analysis results. Bump when the fingerprinting or
/// key-finding logic changes in a way that affects outputs.
pub const KEY_PIPELINE_VERSION: &str = "key.1.0.0";

/// Default analysis sample rate (Hz). Matches the BPM path and existing fixtures.
pub const DEFAULT_SAMPLE_RATE: u32 = 44100;
/// Default STFT frame size (power of two for radix-2 FFT).
pub const DEFAULT_FRAME_SIZE: usize = 1024;
/// Default hop size (samples).
pub const DEFAULT_HOP_SIZE: usize = 512;

/// Which engine produced the key estimate.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyMethod {
    /// Deterministic chroma + Krumhansl-Kessler key finding (no external model).
    ChromaKeyfinding,
    /// ONNX key-detection model (future hook; reuses this post-processor).
    Onnx,
}

/// A key estimate. `key_classical` and `key_camelot` are `None` when no confident
/// tonal centre could be established (short / silent input), rather than erroring.
#[derive(Debug, Clone)]
pub struct KeyEstimate {
    /// Classical key name, e.g. `"A minor"`, `"C major"`, `"F# minor"`.
    pub key_classical: Option<String>,
    /// Camelot harmonic-mixing code, e.g. `"8A"`, `"8B"`.
    pub key_camelot: Option<String>,
    /// Reliability of the estimate, `0.0..=1.0`.
    pub confidence: f32,
    /// Which engine produced this result.
    pub method: KeyMethod,
    /// Pipeline version that produced this estimate.
    pub pipeline_version: &'static str,
}

/// Options controlling the key-detection pipeline. All fields have sensible defaults.
#[derive(Debug, Clone)]
pub struct KeyOptions {
    /// Resample mono audio to this rate before STFT.
    pub sample_rate: u32,
    /// STFT frame size (power of two recommended).
    pub frame_size: usize,
    /// STFT hop size (samples).
    pub hop_size: usize,
    /// Peak-normalize the mono audio to this level before analysis (`None` to skip).
    pub target_peak: Option<f32>,
}

impl Default for KeyOptions {
    fn default() -> Self {
        Self {
            sample_rate: DEFAULT_SAMPLE_RATE,
            frame_size: DEFAULT_FRAME_SIZE,
            hop_size: DEFAULT_HOP_SIZE,
            target_peak: Some(0.9),
        }
    }
}

/// Detects the musical key of decoded audio.
///
/// Returns a [`KeyEstimate`] with the classical name, Camelot code, and confidence.
/// A track that is too short or silent to establish a key degrades gracefully: the
/// returned estimate has `confidence = 0.0` and `None` key fields (rather than
/// erroring), so the caller can flag the track for review. Only an empty audio
/// buffer is an [`AnalysisError`].
pub fn detect_key(
    audio: &DecodedAudio,
    opts: Option<&KeyOptions>,
) -> Result<KeyEstimate, AnalysisError> {
    if audio.samples.is_empty() {
        return Err(AnalysisError::EmptyAudio);
    }

    let opts = opts.cloned().unwrap_or_default();
    let mono = prepare_for_model(audio, opts.sample_rate, opts.target_peak)
        .map_err(AnalysisError::Normalization)?;

    let estimate = estimate_key(&mono, opts.sample_rate);
    Ok(estimate)
}

/// Chroma STFT parameters. Key detection needs finer frequency resolution than the
/// BPM onset path, so it uses a longer analysis window (bin width ~5 Hz at 44.1 kHz,
/// i.e. well under a semitone at concert pitch) so a sustained pitch stays inside its
/// own pitch class instead of bleeding across the 12-bin chroma profile.
const KEY_FRAME_SIZE: usize = 8192;
const KEY_HOP_SIZE: usize = 1024;

/// Internal key estimate via chroma + Krumhansl-Kessler.
fn estimate_key(mono: &[f32], sample_rate: u32) -> KeyEstimate {
    let failed = || KeyEstimate {
        key_classical: None,
        key_camelot: None,
        confidence: 0.0,
        method: KeyMethod::ChromaKeyfinding,
        pipeline_version: KEY_PIPELINE_VERSION,
    };

    let chromagram = chroma_profile(mono, KEY_FRAME_SIZE, KEY_HOP_SIZE, sample_rate);
    if chromagram.iter().all(|&c| c <= 1e-9) {
        return failed();
    }

    let (root, is_minor, confidence) = find_best_key(&chromagram);
    if confidence <= 0.0 {
        return failed();
    }

    let key_classical = Some(format_key_name(root, is_minor));
    let key_camelot = camelot_code(root, is_minor);
    KeyEstimate {
        key_classical,
        key_camelot,
        confidence,
        method: KeyMethod::ChromaKeyfinding,
        pipeline_version: KEY_PIPELINE_VERSION,
    }
}

/// Time-aggregated 12-bin chroma profile (one value per pitch class, 0 = C).
/// `frame_size` is both the Hann-window length and the FFT length (no zero-padding),
/// giving a bin width of `sample_rate / frame_size`.
fn chroma_profile(mono: &[f32], frame_size: usize, hop_size: usize, sample_rate: u32) -> [f32; 12] {
    let mut profile = [0.0f32; 12];
    if mono.is_empty() || frame_size < 2 || hop_size == 0 || mono.len() < frame_size {
        return profile;
    }

    let bin_hz = sample_rate as f32 / frame_size as f32;
    let nbins = frame_size / 2 + 1;
    let mut planner = FftPlanner::<f32>::new();
    let fft: std::sync::Arc<dyn Fft<f32>> = planner.plan_fft_forward(frame_size);
    let window = hann_window(frame_size);

    let mut windowed = vec![0.0f32; frame_size];
    for frame_start in (0..=mono.len().saturating_sub(frame_size)).step_by(hop_size) {
        for i in 0..frame_size {
            windowed[i] = mono[frame_start + i] * window[i];
        }
        let spec = magnitude_spectrum(&windowed, &fft, nbins);
        // Skip the DC bin (no pitch); fold the rest into pitch classes.
        for (k, &mag) in spec.iter().enumerate().skip(1) {
            let f = k as f32 * bin_hz;
            if let Some(pc) = pitch_class(f) {
                profile[pc] += mag;
            }
        }
    }
    profile
}

/// Pitch class (0 = C ... 11 = B) for a frequency, or `None` below ~28 Hz.
fn pitch_class(freq: f32) -> Option<usize> {
    if freq <= 27.5 {
        return None;
    }
    // MIDI note number where 69 = A4 (440 Hz); pc = note mod 12 with 0 = C.
    let midi = 12.0 * ((freq / 440.0).ln() / (2.0_f32).ln()) + 69.0;
    let pc = (midi.round() as i64).rem_euclid(12);
    Some(pc as usize)
}

/// Periodic Hann window: `0.5 * (1 - cos(2*pi*i/N))`.
fn hann_window(n: usize) -> Vec<f32> {
    (0..n)
        .map(|i| {
            let x = 2.0 * std::f32::consts::PI * i as f32 / n as f32;
            0.5 * (1.0 - x.cos())
        })
        .collect()
}

/// Real-input magnitude spectrum (first `n/2+1` bins).
fn magnitude_spectrum(frame: &[f32], fft: &std::sync::Arc<dyn Fft<f32>>, nbins: usize) -> Vec<f32> {
    let mut buf: Vec<Complex<f32>> = frame.iter().map(|&s| Complex::new(s, 0.0)).collect();
    fft.process(&mut buf);
    buf[..nbins].iter().map(|c| c.norm()).collect()
}

// Krumhansl-Kessler (1980) key-finding profiles, indexed by pitch class with
// 0 = C. The major profile is the "tonic" reference; the minor profile is the
// A-based minor reference used by the standard key-finding algorithm.
const KK_MAJOR: [f32; 12] = [
    6.35, 2.23, 3.48, 2.33, 4.09, 2.50, 1.51, 5.19, 2.39, 3.66, 2.75, 3.58,
];
const KK_MINOR: [f32; 12] = [
    6.33, 1.90, 3.16, 2.81, 3.80, 2.08, 1.87, 5.06, 2.35, 3.13, 2.06, 3.19,
];

/// Scores every candidate key against the chroma profile and returns
/// `(root, is_minor, confidence)` for the best match. Returns confidence `0.0`
/// (with `false`) when no key is clearly established.
fn find_best_key(profile: &[f32; 12]) -> (usize, bool, f32) {
    let norm_sq: f32 = profile.iter().map(|&c| c * c).sum();
    if norm_sq <= 1e-12 {
        return (0, false, 0.0);
    }
    let inv = norm_sq.sqrt().recip();
    let p_norm: [f32; 12] = profile.map(|c| c * inv);

    let mut best_score = f32::NEG_INFINITY;
    let mut best_root = 0usize;
    let mut best_minor = false;
    let mut sum_score = 0.0f32;
    let mut count = 0u32;

    for root in 0..12 {
        for (is_minor, table) in [(false, &KK_MAJOR), (true, &KK_MINOR)] {
            // Rotate the profile so the tonic (table[0]) aligns with `root`,
            // i.e. pc `root` carries the tonic weight. correlate = <p_norm, rotated>.
            let mut rotated = [0.0f32; 12];
            for i in 0..12 {
                rotated[i] = table[(i + 12 - root) % 12];
            }
            let score = correlate(&p_norm, &rotated);
            sum_score += score;
            count += 1;
            if score > best_score {
                best_score = score;
                best_root = root;
                best_minor = is_minor;
            }
        }
    }

    let mean = sum_score / count as f32;
    // Confidence: how much the winner beats the field. Centered around the mean.
    let confidence = ((best_score - mean) / (1.0 - mean).max(1e-6)).clamp(0.0, 1.0);
    if confidence < 0.05 {
        return (best_root, best_minor, 0.0);
    }
    (best_root, best_minor, confidence)
}

/// Cosine similarity between two length-12 profiles.
fn correlate(a: &[f32; 12], b: &[f32; 12]) -> f32 {
    let mut s = 0.0f32;
    for i in 0..12 {
        s += a[i] * b[i];
    }
    s
}

const KEY_NAMES: [&str; 12] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

fn format_key_name(root: usize, is_minor: bool) -> String {
    let name = KEY_NAMES[root % 12];
    if is_minor {
        format!("{} minor", name)
    } else {
        format!("{} major", name)
    }
}

/// Camelot wheel code for a root (pc, 0 = C) and mode.
/// Major: 8B = C, 9B = G, 10B = D, 11B = A, 12B = E, 1B = B, 2B = F#, 3B = C#,
/// 4B = G#, 5B = D#, 6B = A#, 7B = F.
/// Minor: 8A = A, 9A = E, 10A = B, 11A = F#, 12A = C#, 1A = G#, 2A = D#,
/// 3A = A#, 4A = F, 5A = C, 6A = G, 7A = D.
fn camelot_code(root: usize, is_minor: bool) -> Option<String> {
    // (number, letter) per pitch class, 0 = C. Major first, minor second.
    // numbers ascend by fifths from C = 8.
    const MAJOR: [&str; 12] = [
        "8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B",
    ];
    const MINOR: [&str; 12] = [
        "5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A",
    ];
    let table = if is_minor { &MINOR } else { &MAJOR };
    // table is indexed by pc with 0=C. Verify ordering:
    // MAJOR[0]=C=8B, MAJOR[7]=G=9B, MAJOR[2]=D=10B, MAJOR[9]=A=11B, MAJOR[4]=E=12B,
    // MAJOR[11]=B=1B, MAJOR[6]=F#=2B, MAJOR[1]=C#=3B, MAJOR[8]=G#=4B,
    // MAJOR[3]=D#=5B, MAJOR[10]=A#=6B, MAJOR[5]=F=7B.
    let code = table[root % 12];
    if code.is_empty() {
        None
    } else {
        Some(code.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    use crate::decoder::{decode_audio_file, DecodedAudio};

    /// Builds a mono `DecodedAudio` from raw samples at `sample_rate`.
    fn mono_audio(samples: Vec<f32>, sample_rate: u32) -> DecodedAudio {
        DecodedAudio {
            sample_rate,
            channels: 1,
            duration_seconds: samples.len() as f64 / sample_rate as f64,
            samples,
        }
    }

    /// Synthesises a pure-tone drone at the given frequencies (equal-amplitude sine),
    /// simulating a sustained chord's tonal centre.
    fn tonality_drone(freqs: &[f32], seconds: f32, sample_rate: u32) -> Vec<f32> {
        let n = (seconds * sample_rate as f32).ceil() as usize;
        let mut out = vec![0.0f32; n];
        let amp = 1.0f32 / freqs.len() as f32;
        for (i, s) in out.iter_mut().enumerate() {
            let t = i as f32 / sample_rate as f32;
            let mut v = 0.0f32;
            for &f in freqs {
                v += (2.0 * std::f32::consts::PI * f * t).sin();
            }
            *s = amp * v;
        }
        out
    }

    fn fixture_audio(rel: &str) -> DecodedAudio {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("fixtures")
            .join("audio")
            .join(rel);
        decode_audio_file(&path).expect("fixture should decode")
    }

    #[test]
    fn empty_audio_returns_error() {
        let audio = mono_audio(Vec::new(), DEFAULT_SAMPLE_RATE);
        let res = detect_key(&audio, None);
        assert!(matches!(res, Err(AnalysisError::EmptyAudio)));
    }

    #[test]
    fn too_short_audio_degrades_gracefully() {
        let samples = vec![0.1f32; 50];
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let est = detect_key(&audio, None).expect("should not error on short audio");
        assert_eq!(est.confidence, 0.0);
        assert!(est.key_classical.is_none());
        assert!(est.key_camelot.is_none());
    }

    #[test]
    fn silent_audio_degrades_gracefully() {
        let samples = vec![0.0f32; 44100];
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let est = detect_key(&audio, None).expect("should not error on silence");
        assert_eq!(est.confidence, 0.0);
        assert!(est.key_classical.is_none());
    }

    #[test]
    fn detects_c_major_from_c_major_triad() {
        // C4=261.63, E4=329.63, G4=391.99
        let samples = tonality_drone(&[261.63, 329.63, 391.99], 8.0, DEFAULT_SAMPLE_RATE);
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let est = detect_key(&audio, None).expect("should analyze");
        assert_eq!(est.key_classical.as_deref(), Some("C major"));
        assert_eq!(est.key_camelot.as_deref(), Some("8B"));
        assert!(est.confidence > 0.5, "low confidence: {}", est.confidence);
    }

    #[test]
    fn detects_a_minor_from_a_minor_triad() {
        // A4=440.00, C5=523.25, E5=659.25
        let samples = tonality_drone(&[440.00, 523.25, 659.25], 8.0, DEFAULT_SAMPLE_RATE);
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let est = detect_key(&audio, None).expect("should analyze");
        assert_eq!(est.key_classical.as_deref(), Some("A minor"));
        assert_eq!(est.key_camelot.as_deref(), Some("8A"));
        assert!(est.confidence > 0.5, "low confidence: {}", est.confidence);
    }

    #[test]
    fn detects_g_major_from_g_major_triad() {
        // G4=392.00, B4=493.88, D5=587.33
        let samples = tonality_drone(&[392.00, 493.88, 587.33], 8.0, DEFAULT_SAMPLE_RATE);
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let est = detect_key(&audio, None).expect("should analyze");
        assert_eq!(est.key_classical.as_deref(), Some("G major"));
        assert_eq!(est.key_camelot.as_deref(), Some("9B"));
        assert!(est.confidence > 0.5, "low confidence: {}", est.confidence);
    }

    #[test]
    fn pipeline_version_is_semverish() {
        assert!(!KEY_PIPELINE_VERSION.is_empty());
        assert!(KEY_PIPELINE_VERSION.contains('.'));
    }

    #[test]
    fn camelot_wheel_covers_all_24_keys() {
        // Every root + mode maps to a valid Camelot code.
        for root in 0..12 {
            for is_minor in [false, true] {
                let code = camelot_code(root, is_minor);
                assert!(
                    code.is_some(),
                    "missing camelot for root {} minor={}",
                    root,
                    is_minor
                );
                let c = code.as_deref().unwrap();
                assert!(
                    c.len() >= 2 && c.ends_with('A')
                        || c.ends_with('B') && c[..c.len() - 1].bytes().all(|b| b.is_ascii_digit()),
                    "bad camelot code {c}"
                );
            }
        }
        // Spot-check the canonical mappings from the glossary / metadata.
        assert_eq!(camelot_code(0, false).as_deref(), Some("8B")); // C major
        assert_eq!(camelot_code(9, true).as_deref(), Some("8A")); // A minor (relative)
    }

    #[test]
    fn real_flac_fixture_analyzes_without_panic() {
        let audio = fixture_audio("flac/tagged-techno-140.flac");
        let est = detect_key(&audio, None).expect("should analyze fixture");
        assert!(est.confidence >= 0.0 && est.confidence <= 1.0);
        assert_eq!(est.method, KeyMethod::ChromaKeyfinding);
        assert_eq!(est.pipeline_version, KEY_PIPELINE_VERSION);
    }
}
