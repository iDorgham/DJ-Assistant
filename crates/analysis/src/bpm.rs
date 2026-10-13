//! BPM and beat-grid estimation from decoded audio.
//!
//! This is the deterministic inference path for T1.1.3 ("BPM + beat grid inference
//! path"). It turns a [`DecodedAudio`] signal into a tempo estimate and an induced
//! beat grid using onset-based tempo induction:
//!
//! 1. Decode -> mono -> resample to the analysis rate (via [`prepare_for_model`]).
//! 2. Spectral-flux onset envelope (STFT with a Hann window + real FFT).
//! 3. Autocorrelation of the onset envelope to find the dominant periodicity
//!    (the beat period or an integer multiple).
//! 4. Metrical-level resolution: pick between the period, its double, and its
//!    half by scoring onset alignment of each candidate grid (sum of onset
//!    strength sitting on grid ticks).
//! 5. Phase search: slide the grid up to one beat-period to maximise onset
//!    alignment, which reconstructs the initial downbeat (`t_0`) even when the
//!    first onset is not self-evident.
//! 6. Emit [`BeatGrid`] (bpm, beat timestamps, confidence, bar duration, method).
//!
//! The spec describes the downbeat as established via spectral flux
//! (`docs/product/CANONICAL_DOCUMENTATION.md` §4.3) and bar duration as
//! `t_bar = 240 / BPM` (4/4). Both are produced here.
//!
//! ## ONNX seam
//! When an ONNX beat-activation model is wired in (Phase 1), callers can supply
//! a model-derived activation curve (a `Vec<f32>` onset envelope) and reuse the
//! same post-processor (`estimate_tempo_grid` / `locate_beat_frames`) unchanged.
//! The deterministic envelope is simply the default activation.
//!
//! ## Performance
//! Spectral flux streams one frame at a time (constant memory); autocorrelation
//! is `O(n * tempo_range)` which is trivial. Profiling is tracked via the Phase 1
//! performance target (p50 < 3 s/track) and the criterion benchmark (TX.6).

use num_complex::Complex;
use rustfft::{Fft, FftPlanner};

use crate::decoder::DecodedAudio;
use crate::error::AnalysisError;
use crate::normalizer::prepare_for_model;

/// Pipeline version stamp for analysis results. Bump when preprocessing or the
/// algorithm changes in a way that affects outputs (see DATA_MODEL.md §5).
pub const PIPELINE_VERSION: &str = "bpm.1.0.0";

/// Default analysis sample rate (Hz). Matches existing fixtures and model input.
pub const DEFAULT_SAMPLE_RATE: u32 = 44100;
/// Default STFT frame size (must be a power of two for efficient radix-2 FFT).
pub const DEFAULT_FRAME_SIZE: usize = 1024;
/// Default hop size (samples) -> ~23 ms frames at 44.1 kHz (~86 Hz frame rate).
pub const DEFAULT_HOP_SIZE: usize = 512;
/// Default tempo search range (BPM), suitable for electronic / DJ music.
pub const DEFAULT_MIN_BPM: f32 = 60.0;
pub const DEFAULT_MAX_BPM: f32 = 200.0;

/// Which engine produced the beat grid.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BpmMethod {
    /// Deterministic onset-detection + autocorrelation (no external model).
    OnsetAutocorr,
    /// ONNX beat-activation model (future hook; reuses this post-processor).
    Onnx,
}

/// A tempo estimate together with the induced beat grid.
#[derive(Debug, Clone)]
pub struct BeatGrid {
    /// Detected tempo in beats per minute (`0.0` when no tempo found).
    pub bpm: f32,
    /// Timestamps (seconds from track start) of each beat, ascending.
    pub beats: Vec<f64>,
    /// Downbeat `t_0` in seconds (time of the first beat).
    pub first_beat_time: f64,
    /// Bar duration in seconds: `240 / BPM` (4/4). `0.0` when `bpm == 0`.
    pub bar_duration: f64,
    /// Reliability of the estimate, `0.0..=1.0`.
    pub confidence: f32,
    /// Which engine produced this result.
    pub method: BpmMethod,
    /// Pipeline version that produced this grid (see [`PIPELINE_VERSION`]).
    pub pipeline_version: &'static str,
}

/// Options controlling the analysis pipeline. All fields have sensible defaults.
#[derive(Debug, Clone)]
pub struct BpmOptions {
    /// Resample mono audio to this rate before STFT.
    pub sample_rate: u32,
    /// STFT frame size (power of two recommended).
    pub frame_size: usize,
    /// STFT hop size (samples).
    pub hop_size: usize,
    /// Inclusive tempo search range (BPM).
    pub min_bpm: f32,
    pub max_bpm: f32,
    /// Peak-normalize the mono audio to this level before analysis (`None` to skip).
    pub target_peak: Option<f32>,
}

impl Default for BpmOptions {
    fn default() -> Self {
        Self {
            sample_rate: DEFAULT_SAMPLE_RATE,
            frame_size: DEFAULT_FRAME_SIZE,
            hop_size: DEFAULT_HOP_SIZE,
            min_bpm: DEFAULT_MIN_BPM,
            max_bpm: DEFAULT_MAX_BPM,
            target_peak: Some(0.9),
        }
    }
}

/// Estimates the BPM and beat grid of decoded audio.
///
/// Returns [`BeatGrid::method`] = [`BpmMethod::OnsetAutocorr`]. A track that is
/// too short or silent to estimate a tempo degrades gracefully: the returned grid
/// has `bpm = 0.0` and `confidence = 0.0` (rather than erroring), so the caller
/// can flag the track for review. Only an empty audio buffer is an [`AnalysisError`].
pub fn detect_beat_grid(
    audio: &DecodedAudio,
    opts: Option<&BpmOptions>,
) -> Result<BeatGrid, AnalysisError> {
    if audio.samples.is_empty() {
        return Err(AnalysisError::EmptyAudio);
    }

    let opts = opts.cloned().unwrap_or_default();

    // 1. Prepare mono audio at the analysis sample rate.
    let mono = prepare_for_model(audio, opts.sample_rate, opts.target_peak)
        .map_err(AnalysisError::Normalization)?;

    let frame_rate = opts.sample_rate as f32 / opts.hop_size as f32;

    // 2. Onset strength envelope (spectral flux).
    let env = onset_envelope(&mono, opts.frame_size, opts.hop_size);
    if env.len() < 4 {
        return Ok(empty_grid());
    }

    // 3 + 4 + 5. Tempo, metrical level, and phase via grid alignment. Each grid
    // tick is snapped to the nearest onset peak so period quantisation does not
    // scatter beats off the transients that establish them.
    let grid = match estimate_tempo_grid(&env, frame_rate, opts.min_bpm, opts.max_bpm) {
        Some(g) => g,
        None => return Ok(empty_grid()),
    };

    // 6. Materialize beat timestamps (already snapped to onset peaks).
    let beats: Vec<f64> = grid
        .beats
        .iter()
        .map(|&f| f as f64 / frame_rate as f64)
        .collect();

    let first_beat_time = beats.first().copied().unwrap_or(0.0);
    let bar_duration = if grid.bpm > 0.0 {
        240.0 / grid.bpm as f64
    } else {
        0.0
    };

    Ok(BeatGrid {
        bpm: round_to_2dp(grid.bpm),
        beats,
        first_beat_time,
        bar_duration,
        confidence: grid.confidence,
        method: BpmMethod::OnsetAutocorr,
        pipeline_version: PIPELINE_VERSION,
    })
}

/// Internal result of the tempo / phase search.
struct BeatGridEstimate {
    bpm: f32,
    #[allow(dead_code)]
    period: f32,
    /// Beat frame indices snapped to the nearest onset peak.
    beats: Vec<usize>,
    confidence: f32,
}

/// Empty/low-confidence grid used when no tempo can be established.
fn empty_grid() -> BeatGrid {
    BeatGrid {
        bpm: 0.0,
        beats: Vec::new(),
        first_beat_time: 0.0,
        bar_duration: 0.0,
        confidence: 0.0,
        method: BpmMethod::OnsetAutocorr,
        pipeline_version: PIPELINE_VERSION,
    }
}

/// Searches candidate tempos and phases for the grid that best aligns to onsets.
///
/// Candidates are the autocorrelation period and its half/double (metrical levels).
/// For each, the grid is generated at every integer-frame phase; each tick is
/// snapped to the nearest onset peak within ±25 % of the period. The candidate
/// with the most aligned beats wins (tie-broken by summed onset strength), which
/// resolves the correct metrical level and downbeat phase in one pass.
fn estimate_tempo_grid(
    env: &[f32],
    frame_rate: f32,
    min_bpm: f32,
    max_bpm: f32,
) -> Option<BeatGridEstimate> {
    let period0 = estimate_period(env, frame_rate, min_bpm, max_bpm)?;
    let bpm0 = (60.0 * frame_rate / period0 as f32).clamp(min_bpm, max_bpm);

    // Metrical candidates: the period, its double (half-tempo), and its half
    // (double-tempo). Filtered to the search range.
    let mut candidates: Vec<f32> = [0.5f32, 1.0, 2.0]
        .into_iter()
        .map(|m| bpm0 * m)
        .filter(|&b| b >= min_bpm && b <= max_bpm + 1e-3)
        .collect();
    if candidates.is_empty() {
        candidates.push(bpm0);
    }

    let env_max = env.iter().copied().fold(0.0f32, |a, v| a.max(v.max(0.0)));
    if env_max <= 1e-6 {
        return None;
    }

    let peaks = detect_onset_peaks(env, env_max);
    if peaks.is_empty() {
        return None;
    }

    // Best = (aligned count, summed strength, beat frames, bpm, period).
    let mut best_aligned: usize = 0;
    let mut best_sum: f32 = f32::NEG_INFINITY;
    let mut best_beats: Vec<usize> = Vec::new();
    let mut best_bpm = 0.0f32;
    let mut best_period = 0.0f32;

    for &bpm in &candidates {
        let period = 60.0 * frame_rate / bpm;
        let p_int = period.round().max(1.0) as usize;
        let tol = (period * 0.25).max(2.0);
        for off in 0..p_int {
            let anchor = off as f32;
            let raw = locate_beat_frames(env.len(), period, anchor);
            let mut beats = Vec::with_capacity(raw.len());
            let mut aligned = 0usize;
            let mut sum = 0.0f32;
            for &tick in &raw {
                match nearest_peak_within(&peaks, tick, tol) {
                    Some(p) => {
                        aligned += 1;
                        sum += env[p];
                        beats.push(p);
                    }
                    None => beats.push(tick),
                }
            }
            if aligned == 0 || beats.is_empty() {
                continue;
            }
            // Maximise aligned count first. On ties, prefer the grid whose first beat
            // lands earliest — this reconstructs the downbeat (`t_0`) when several
            // phases align equally well (e.g. split onset peaks), instead of drifting
            // to a phase offset that merely piles onto a higher-energy sub-peak.
            // Summed strength is a final deterministic tie-breaker for the same phase.
            let beats_first = beats[0];
            let best_first = best_beats.first().copied().unwrap_or(usize::MAX);
            if aligned > best_aligned
                || (aligned == best_aligned
                    && (beats_first < best_first || (beats_first == best_first && sum > best_sum)))
            {
                best_aligned = aligned;
                best_sum = sum;
                best_beats = beats;
                best_bpm = bpm;
                best_period = period;
            }
        }
    }

    if best_beats.is_empty() {
        return None;
    }

    let confidence = (best_aligned as f32 / best_beats.len() as f32).clamp(0.0, 1.0);

    Some(BeatGridEstimate {
        bpm: best_bpm,
        period: best_period,
        beats: best_beats,
        confidence,
    })
}

/// Builds the frame indices of beats placed at `anchor + k * period`, within `env_len`.
fn locate_beat_frames(env_len: usize, period: f32, anchor: f32) -> Vec<usize> {
    if env_len == 0 || period <= 0.0 {
        return Vec::new();
    }
    let mut out = Vec::new();
    let n = env_len as f32;
    let mut beat = anchor;
    while beat < n {
        let idx = beat.round() as usize;
        if idx < env_len {
            out.push(idx);
        }
        beat += period;
    }
    out
}

/// Indices of local maxima in the onset envelope above a fraction of the peak.
///
/// `env[0]` is treated as a candidate (its only neighbour is to the right), so a
/// strong onset at the very start of the track — e.g. an opening downbeat — is
/// registered and can anchor the grid to `t_0`.
fn detect_onset_peaks(env: &[f32], env_max: f32) -> Vec<usize> {
    if env.is_empty() {
        return Vec::new();
    }
    let threshold = env_max * 0.2;
    let len = env.len();
    env.iter()
        .enumerate()
        .filter(|&(i, v)| {
            let left = if i > 0 { env[i - 1] } else { f32::NEG_INFINITY };
            let right = if i + 1 < len {
                env[i + 1]
            } else {
                f32::NEG_INFINITY
            };
            *v > threshold && *v >= left && *v > right
        })
        .map(|(i, _)| i)
        .collect()
}

/// Finds the onset peak nearest to `idx` within `±tol` frames, if any.
fn nearest_peak_within(peaks: &[usize], idx: usize, tol: f32) -> Option<usize> {
    let tol_i = tol.round() as usize;
    let mut best: Option<usize> = None;
    let mut best_dist = usize::MAX;
    for &p in peaks {
        let d = p.abs_diff(idx);
        if d <= tol_i && d < best_dist {
            best_dist = d;
            best = Some(p);
        }
        if p > idx.saturating_add(tol_i) {
            break;
        }
    }
    best
}

/// Finds the dominant periodicity of the onset envelope via autocorrelation,
/// restricted to lags that map into the requested BPM range.
fn estimate_period(env: &[f32], frame_rate: f32, min_bpm: f32, max_bpm: f32) -> Option<usize> {
    let n = env.len();
    // Fastest BPM -> shortest period (fewest frames); slowest BPM -> longest period.
    let min_period = ((60.0 / max_bpm * frame_rate).floor() as usize).max(1);
    let max_period = (60.0 / min_bpm * frame_rate).ceil() as usize;
    let max_period = max_period.min(n.saturating_sub(1)).max(min_period + 1);

    let mut best_lag = min_period;
    let mut best_val = f32::NEG_INFINITY;
    for lag in min_period..=max_period {
        let m = n - lag;
        let mut s = 0.0f32;
        for i in 0..m {
            s += env[i] * env[i + lag];
        }
        if s > best_val {
            best_val = s;
            best_lag = lag;
        }
    }

    if best_val <= 0.0 {
        None
    } else {
        Some(best_lag)
    }
}

/// Half-wave-rectified spectral-flux onset strength envelope.
fn onset_envelope(mono: &[f32], frame_size: usize, hop_size: usize) -> Vec<f32> {
    let n = mono.len();
    if n < frame_size || frame_size < 2 || hop_size == 0 {
        return Vec::new();
    }

    let num_frames = (n - frame_size) / hop_size + 1;
    // A rectangular (boxcar) window keeps transient onset energy position-robust
    // across the frame, which matters for tempo induction where beats must align
    // to the transients that establish them. (Hann-tapered onsets are attenuated
    // when a transient lands near a frame edge.)
    let window = vec![1.0f32; frame_size];
    let mut planner = FftPlanner::<f32>::new();
    let fft: std::sync::Arc<dyn Fft<f32>> = planner.plan_fft_forward(frame_size);

    let nbins = frame_size / 2 + 1;
    let mut env = Vec::with_capacity(num_frames);
    let mut prev = spectrum(&windowed_frame(mono, 0, frame_size, &window), &fft, nbins);
    // Frame 0 has no predecessor, so its spectral flux is undefined. Treat its
    // own spectral energy as the onset value so a strong opening transient (e.g.
    // a downbeat at t = 0) is registered as a candidate peak.
    env.push(prev.iter().copied().sum::<f32>());

    for i in 1..num_frames {
        let curr = spectrum(
            &windowed_frame(mono, i * hop_size, frame_size, &window),
            &fft,
            nbins,
        );
        let mut flux = 0.0f32;
        for k in 0..nbins {
            let diff = curr[k] - prev[k];
            if diff > 0.0 {
                flux += diff;
            }
        }
        env.push(flux);
        prev = curr;
    }

    normalize_envelope(&mut env);
    env
}

/// Applies a Hann window to one `frame_size`-sample frame starting at `start`,
/// zero-padding past the end of `mono` so every frame is exactly `frame_size`
/// samples (required by the fixed-size FFT plan).
fn windowed_frame(mono: &[f32], start: usize, frame_size: usize, window: &[f32]) -> Vec<f32> {
    let mut frame = Vec::with_capacity(frame_size);
    for j in 0..frame_size {
        let sample = if start + j < mono.len() {
            mono[start + j] * window[j]
        } else {
            0.0
        };
        frame.push(sample);
    }
    frame
}

/// Real-input magnitude spectrum (first `n/2+1` bins).
fn spectrum(frame: &[f32], fft: &std::sync::Arc<dyn Fft<f32>>, nbins: usize) -> Vec<f32> {
    let mut buf: Vec<Complex<f32>> = frame.iter().map(|&s| Complex::new(s, 0.0)).collect();
    fft.process(&mut buf);
    buf[..nbins].iter().map(|c| c.norm()).collect()
}

/// Mean-subtracts and unit-variance normalizes the envelope in place.
fn normalize_envelope(env: &mut [f32]) {
    if env.is_empty() {
        return;
    }
    let n = env.len() as f32;
    let mean: f32 = env.iter().sum::<f32>() / n;
    for v in env.iter_mut() {
        *v -= mean;
    }
    let var: f32 = env.iter().map(|v| v * v).sum::<f32>() / n;
    let std = var.sqrt();
    if std > 1e-6 {
        for v in env.iter_mut() {
            *v /= std;
        }
    }
}

/// Rounds to two decimal places (matches the `BPM NUMERIC(5, 2)` schema).
fn round_to_2dp(x: f32) -> f32 {
    (x * 100.0).round() / 100.0
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

    /// Synthesises a click track: a short damped sine burst every `60/bpm` seconds,
    /// simulating a drum hit / transient onset.
    fn click_track(bpm: f32, seconds: f32, sample_rate: u32) -> Vec<f32> {
        let n = (seconds * sample_rate as f32).ceil() as usize;
        let mut out = vec![0.0f32; n];
        if bpm <= 0.0 {
            return out;
        }
        let period = (60.0 / bpm * sample_rate as f32).round() as usize;
        let period = period.max(1);
        let burst_samples = (0.02 * sample_rate as f32).ceil() as usize; // 20 ms decay
        let tau = 0.005; // 5 ms decay time
        let mut pos = 0usize;
        while pos + burst_samples <= n {
            for i in 0..burst_samples {
                let t = i as f32 / sample_rate as f32;
                let env = (-t / tau).exp();
                out[pos + i] += 0.8 * (2.0 * std::f32::consts::PI * 800.0 * t).sin() * env;
            }
            // Normalise so overlapping bursts don't accumulate artefacts.
            let frame = &mut out[pos..pos + burst_samples];
            let peak = frame
                .iter()
                .copied()
                .fold(0.0f32, |a, x| a.max(x.abs()))
                .max(1e-6);
            for s in frame.iter_mut() {
                *s /= peak;
            }
            pos += period;
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
    fn detects_120_bpm_click_track() {
        let samples = click_track(120.0, 8.0, DEFAULT_SAMPLE_RATE);
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);

        let grid = detect_beat_grid(&audio, None).expect("should analyze");
        assert!(
            (grid.bpm - 120.0).abs() < 5.0,
            "expected ~120 BPM, got {}",
            grid.bpm
        );
        assert!(grid.confidence > 0.5, "low confidence: {}", grid.confidence);
        assert!(!grid.beats.is_empty());
        // Downbeat reconstructed near t0.
        assert!(
            grid.first_beat_time < 0.25,
            "first beat should be near 0, got {}",
            grid.first_beat_time
        );
        // Bar duration for 4/4: 240/BPM.
        let expected_bar = 240.0 / grid.bpm as f64;
        assert!(
            (grid.bar_duration - expected_bar).abs() < 1e-3,
            "bar duration mismatch"
        );
    }

    #[test]
    fn detects_90_and_140_bpm() {
        for &bpm in &[90.0f32, 140.0] {
            let samples = click_track(bpm, 10.0, DEFAULT_SAMPLE_RATE);
            let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
            let grid = detect_beat_grid(&audio, None).expect("should analyze");
            assert!(
                (grid.bpm - bpm).abs() < 5.0,
                "expected ~{} BPM, got {}",
                bpm,
                grid.bpm
            );
            assert!(grid.confidence > 0.5, "low confidence for {} BPM", bpm);
        }
    }

    #[test]
    fn beats_are_evenly_spaced_and_align_to_clicks() {
        let bpm = 128.0f32;
        let seconds = 8.0;
        let samples = click_track(bpm, seconds, DEFAULT_SAMPLE_RATE);
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let grid = detect_beat_grid(&audio, None).expect("should analyze");

        let period = 60.0 / bpm as f64;
        let mut aligned = 0;
        let mut prev = grid.beats[0];
        // The first beat sets the phase; check spacing from the second beat onward.
        for &t in &grid.beats[1..] {
            assert!(
                (t - prev - period).abs() < 0.15,
                "uneven spacing at {} (prev {})",
                t,
                prev
            );
            prev = t;
        }
        assert!(
            grid.first_beat_time < 0.25,
            "first beat should be near 0, got {}",
            grid.first_beat_time
        );
        // Each detected beat sits near a true click time.
        for &t in &grid.beats {
            let nearest_click = ((t / period).round() * period).max(0.0);
            if (t - nearest_click).abs() < 0.05 {
                aligned += 1;
            }
        }
        assert!(
            aligned as f32 / grid.beats.len() as f32 > 0.8,
            "only {}/{} beats aligned",
            aligned,
            grid.beats.len()
        );
    }

    #[test]
    fn empty_audio_returns_error() {
        let audio = mono_audio(Vec::new(), DEFAULT_SAMPLE_RATE);
        let res = detect_beat_grid(&audio, None);
        assert!(matches!(res, Err(AnalysisError::EmptyAudio)));
    }

    #[test]
    fn too_short_audio_degrades_gracefully() {
        let samples = vec![0.1f32; 50]; // well under one frame
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let grid = detect_beat_grid(&audio, None).expect("should not error on short audio");
        assert_eq!(grid.bpm, 0.0);
        assert_eq!(grid.confidence, 0.0);
        assert!(grid.beats.is_empty());
    }

    #[test]
    fn pipeline_version_is_semverish() {
        assert!(!PIPELINE_VERSION.is_empty());
        assert!(PIPELINE_VERSION.contains('.'));
    }

    #[test]
    fn silent_audio_degrades_gracefully() {
        // A track of silence has no onsets -> no tempo, but must not error.
        let samples = click_track(0.0, 3.0, DEFAULT_SAMPLE_RATE);
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let grid = detect_beat_grid(&audio, None).expect("should not error on silence");
        assert_eq!(grid.bpm, 0.0);
        assert!(grid.beats.is_empty());
    }

    #[test]
    fn real_flac_fixture_analyzes_without_panic() {
        // The synthetic fixture is sub-second and may lack rhythmic onsets, but
        // the path must still run end-to-end and produce a valid grid.
        let audio = fixture_audio("flac/tagged-techno-140.flac");
        let grid = detect_beat_grid(&audio, None).expect("should analyze fixture");
        assert!(grid.bpm >= 0.0 && grid.bpm <= 300.0);
        assert!(grid.confidence >= 0.0 && grid.confidence <= 1.0);
        assert_eq!(grid.method, BpmMethod::OnsetAutocorr);
        assert_eq!(grid.pipeline_version, PIPELINE_VERSION);
    }
}
