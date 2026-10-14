//! Phrase / structure segmentation from decoded audio.
//!
//! Deterministic inference path for T1.1.5 ("Phrase / structure segmentation").
//! Turns a [`DecodedAudio`] signal plus a [`BeatGrid`] (T1.1.3) into a list of
//! metrical phrases with heuristic section labels:
//!
//! 1. Decode -> mono -> resample to the analysis rate (via [`prepare_for_model`]).
//! 2. Aggregate per-bar features: RMS energy, mean spectral flux, 12-bin chroma.
//! 3. Boundary novelty = weighted sum of per-bar deltas (energy step, chroma
//!    cosine distance, flux step), peak-picked with a track-relative threshold.
//! 4. Snap boundaries so segment lengths land on {4, 8, 16, 32} bars (the
//!    glossary's phrase units), dropping unsnappable candidates.
//! 5. Label segments from track-relative energy profile: quiet first/last ->
//!    intro/outro, near-peak -> drop, rising -> build, mid-track dip -> breakdown.
//!
//! ## Beat-grid coupling and degradation
//! The beat grid is the metrical backbone; without one there is no bar grid to
//! snap to, so `None`, `bpm == 0.0`, or fewer than two bars degrades to an empty
//! [`PhraseMap`] with zero confidence (never an error), matching the BPM/key
//! degradation pattern.
//!
//! ## ONNX seam
//! When an ONNX segmentation model is wired in (Phase 1 per MODELS.md), a
//! model-derived boundary activation curve can replace step 3 while steps 4-5
//! (snapping + labeling) are reused unchanged — the same post-processor seam as
//! `bpm.rs`/`key.rs`.

use num_complex::Complex;
use rustfft::{Fft, FftPlanner};

use crate::bpm::BeatGrid;
use crate::decoder::DecodedAudio;
use crate::error::AnalysisError;
use crate::normalizer::prepare_for_model;

/// Pipeline version stamp for phrase results. Bump when the algorithm changes
/// in a way that affects outputs (see DATA_MODEL.md §5).
pub const PHRASE_PIPELINE_VERSION: &str = "phrase.1.0.0";

/// Default analysis sample rate (Hz).
pub const DEFAULT_SAMPLE_RATE: u32 = 44100;
/// Default STFT frame size (~93 ms at 44.1 kHz).
pub const DEFAULT_FRAME_SIZE: usize = 4096;
/// Default STFT hop size (~46 ms at 44.1 kHz).
pub const DEFAULT_HOP_SIZE: usize = 2048;

/// Heuristic section label for a phrase.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SectionKind {
    /// Quiet opening segment.
    Intro,
    /// Energy rising into the next segment.
    Build,
    /// Near-peak energy segment.
    Drop,
    /// Quiet mid-track dip between louder segments.
    Breakdown,
    /// Quiet closing segment.
    Outro,
    /// Generic phrase that fits no section profile.
    Phrase,
}

/// One segmented phrase, snapped to the bar grid.
#[derive(Debug, Clone, PartialEq)]
pub struct Phrase {
    /// Segment start in seconds from track start.
    pub start_seconds: f64,
    /// Segment end in seconds from track start.
    pub end_seconds: f64,
    /// Zero-based index of the bar the phrase starts on (bar 0 begins at the
    /// grid's first beat / downbeat).
    pub start_bar: usize,
    /// Phrase length in bars (normally a member of `PhraseOptions::allowed_lengths_bars`).
    pub length_bars: usize,
    /// Heuristic section label.
    pub kind: SectionKind,
    /// Reliability of this phrase's boundary + label, `0.0..=1.0`.
    pub confidence: f32,
}

/// Which engine produced the phrase map.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PhraseMethod {
    /// Beat-grid-snapped novelty segmentation (no external model).
    BeatGridNovelty,
    /// ONNX segmentation model (future hook; reuses this post-processor).
    Onnx,
}

/// Segmented phrases for a track.
#[derive(Debug, Clone)]
pub struct PhraseMap {
    /// Segments in track order, snapped to the bar grid.
    pub phrases: Vec<Phrase>,
    /// Overall phrase confidence (mean of segment confidences), `0.0..=1.0`.
    pub confidence: f32,
    /// Which engine produced this result.
    pub method: PhraseMethod,
    /// Pipeline version that produced this map (see [`PHRASE_PIPELINE_VERSION`]).
    pub pipeline_version: &'static str,
}

/// Options controlling phrase segmentation. All fields have sensible defaults.
#[derive(Debug, Clone)]
pub struct PhraseOptions {
    /// Resample mono audio to this rate before analysis.
    pub sample_rate: u32,
    /// STFT frame size (power of two recommended).
    pub frame_size: usize,
    /// STFT hop size (samples).
    pub hop_size: usize,
    /// Peak-normalize the mono audio to this level before analysis (`None` to skip).
    pub target_peak: Option<f32>,
    /// Allowed phrase lengths in bars; boundaries snap to the nearest of these.
    pub allowed_lengths_bars: Vec<usize>,
    /// How far a boundary may move (in bars) to reach an allowed length.
    pub snap_tolerance_bars: usize,
}

impl Default for PhraseOptions {
    fn default() -> Self {
        Self {
            sample_rate: DEFAULT_SAMPLE_RATE,
            frame_size: DEFAULT_FRAME_SIZE,
            hop_size: DEFAULT_HOP_SIZE,
            target_peak: Some(0.9),
            allowed_lengths_bars: vec![4, 8, 16, 32],
            snap_tolerance_bars: 2,
        }
    }
}

/// Segments decoded audio into phrases on top of a [`BeatGrid`].
///
/// Degrades gracefully: missing/empty grid or fewer than two bars yields an
/// empty map with zero confidence; only empty audio is an [`AnalysisError`].
pub fn detect_phrases(
    audio: &DecodedAudio,
    grid: Option<&BeatGrid>,
    opts: Option<&PhraseOptions>,
) -> Result<PhraseMap, AnalysisError> {
    if audio.samples.is_empty() {
        return Err(AnalysisError::EmptyAudio);
    }

    let opts = opts.cloned().unwrap_or_default();
    let grid = match grid {
        Some(g) if g.bpm > 0.0 && g.beats.len() >= 8 => g,
        _ => return Ok(empty_map()),
    };

    let mono = prepare_for_model(audio, opts.sample_rate, opts.target_peak)
        .map_err(AnalysisError::Normalization)?;
    let sr = opts.sample_rate as f64;
    let duration = mono.len() as f64 / sr;

    // Bar start times from the grid (every 4th beat = one 4/4 bar).
    let all_bar_times: Vec<f64> = grid.beats.iter().step_by(4).copied().collect();
    // Ignore bars that start at/past the end of the audio (trailing partial bar).
    let n_bars = all_bar_times.iter().take_while(|&&t| t < duration).count();
    if n_bars < 2 {
        return Ok(empty_map());
    }
    let bar_times = &all_bar_times[..n_bars];

    let rms = bar_rms(&mono, sr, bar_times, duration);
    let (flux, chroma) = bar_spectral(
        &mono,
        opts.sample_rate,
        opts.frame_size,
        opts.hop_size,
        bar_times,
        duration,
    );

    // Boundary novelty (index i = boundary starting bar i, i in 1..n_bars).
    let novelty = boundary_novelty(&rms, &flux, &chroma);
    let raw = pick_boundaries(&novelty);
    let boundaries = snap_boundaries(
        &raw,
        n_bars,
        &opts.allowed_lengths_bars,
        opts.snap_tolerance_bars,
    );

    // Segments: [0] + boundaries; each ends at the next boundary or the final bar.
    let starts: Vec<usize> = std::iter::once(0usize)
        .chain(boundaries.iter().copied())
        .collect();
    let energies: Vec<f32> = starts
        .iter()
        .enumerate()
        .map(|(i, &s)| {
            let e = boundaries.get(i).copied().unwrap_or(n_bars);
            rms[s..e].iter().sum::<f32>() / (e - s) as f32
        })
        .collect();
    let kinds = label_segments(&energies);

    let max_nov = novelty.iter().copied().fold(0.0f32, f32::max);
    let boundary_conf = |bar: usize| {
        if max_nov > 1e-9 {
            (novelty[bar] / max_nov).clamp(0.0, 1.0)
        } else {
            0.0
        }
    };

    let mut phrases = Vec::with_capacity(starts.len());
    for (i, &start) in starts.iter().enumerate() {
        let end = boundaries.get(i).copied().unwrap_or(n_bars);
        // A phrase's confidence comes from the boundary that terminates it; the
        // first phrase has no start boundary, so use its end (or a low prior when
        // the track is one unsegmented phrase).
        let confidence = if i == 0 {
            boundaries.first().map(|&b| boundary_conf(b)).unwrap_or(0.2)
        } else {
            boundary_conf(start)
        };
        phrases.push(Phrase {
            start_seconds: bar_times[start],
            end_seconds: bar_times.get(end).copied().unwrap_or(duration),
            start_bar: start,
            length_bars: end - start,
            kind: kinds[i],
            confidence,
        });
    }

    let confidence = if phrases.is_empty() {
        0.0
    } else {
        phrases.iter().map(|p| p.confidence).sum::<f32>() / phrases.len() as f32
    };

    Ok(PhraseMap {
        phrases,
        confidence,
        method: PhraseMethod::BeatGridNovelty,
        pipeline_version: PHRASE_PIPELINE_VERSION,
    })
}

/// Empty map used when no metrical structure can be established.
fn empty_map() -> PhraseMap {
    PhraseMap {
        phrases: Vec::new(),
        confidence: 0.0,
        method: PhraseMethod::BeatGridNovelty,
        pipeline_version: PHRASE_PIPELINE_VERSION,
    }
}

/// RMS energy per bar, computed in the time domain over each bar's sample range.
fn bar_rms(mono: &[f32], sr: f64, bar_times: &[f64], duration: f64) -> Vec<f32> {
    (0..bar_times.len())
        .map(|i| {
            let start = ((bar_times[i] * sr).round() as usize).min(mono.len());
            let end = bar_times.get(i + 1).copied().unwrap_or(duration);
            let end = ((end * sr).round() as usize).min(mono.len());
            let slice = if start < end { &mono[start..end] } else { &[] };
            if slice.is_empty() {
                0.0
            } else {
                (slice.iter().map(|&x| x * x).sum::<f32>() / slice.len() as f32).sqrt()
            }
        })
        .collect()
}

/// Per-bar mean spectral flux and L2-normalized 12-bin chroma from one STFT pass.
fn bar_spectral(
    mono: &[f32],
    sample_rate: u32,
    frame_size: usize,
    hop_size: usize,
    bar_times: &[f64],
    duration: f64,
) -> (Vec<f32>, Vec<Vec<f32>>) {
    let n_bars = bar_times.len();
    let mut flux = vec![0.0f32; n_bars];
    let mut chroma = vec![vec![0.0f32; 12]; n_bars];
    let mut counts = vec![0usize; n_bars];

    if mono.len() < frame_size || frame_size < 2 || hop_size == 0 {
        return (flux, chroma);
    }

    let sr = sample_rate as f32;
    let num_frames = (mono.len() - frame_size) / hop_size + 1;
    // Hann tapering (unlike bpm.rs's position-robust boxcar) trades transient
    // sharpness for a cleaner magnitude spectrum, which the chroma mapping needs.
    let window: Vec<f32> = (0..frame_size)
        .map(|i| {
            0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (frame_size - 1) as f32).cos()
        })
        .collect();
    let mut planner = FftPlanner::<f32>::new();
    let fft: std::sync::Arc<dyn Fft<f32>> = planner.plan_fft_forward(frame_size);
    let nbins = frame_size / 2 + 1;

    let mut bar_idx = 0usize;
    let mut prev_mag: Option<Vec<f32>> = None;
    for i in 0..num_frames {
        let t = (i * hop_size + frame_size / 2) as f32 / sr;
        if t as f64 >= duration {
            break;
        }
        while bar_idx + 1 < n_bars && bar_times[bar_idx + 1] <= t as f64 {
            bar_idx += 1;
        }

        let mut buf: Vec<Complex<f32>> = (0..frame_size)
            .map(|j| {
                let idx = i * hop_size + j;
                let s = if idx < mono.len() {
                    mono[idx] * window[j]
                } else {
                    0.0
                };
                Complex::new(s, 0.0)
            })
            .collect();
        fft.process(&mut buf);
        let mag: Vec<f32> = buf[..nbins].iter().map(|c| c.norm()).collect();

        if let Some(prev) = &prev_mag {
            let mut f = 0.0f32;
            for k in 0..nbins {
                let d = mag[k] - prev[k];
                if d > 0.0 {
                    f += d;
                }
            }
            flux[bar_idx] += f;
        }
        for (k, &m) in mag.iter().enumerate().take(nbins).skip(1) {
            let f_hz = k as f32 * sr / frame_size as f32;
            if !(30.0..=5000.0).contains(&f_hz) {
                continue;
            }
            let midi = 69.0 + 12.0 * (f_hz / 440.0).log2();
            let pc = midi.round().rem_euclid(12.0) as usize;
            chroma[bar_idx][pc] += m;
        }
        counts[bar_idx] += 1;
        prev_mag = Some(mag);
    }

    for b in 0..n_bars {
        if counts[b] > 0 {
            flux[b] /= counts[b] as f32;
        }
        let norm = chroma[b].iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 1e-9 {
            for x in chroma[b].iter_mut() {
                *x /= norm;
            }
        }
    }
    (flux, chroma)
}

/// Weighted boundary novelty from per-bar deltas. The energy delta is computed
/// in dB (loudness is logarithmic, mirroring the EBU R128 work in T1.1.7), so a
/// quiet intro->build step competes fairly with loud drop transitions; flux
/// deltas are linear, normalized by their track max; chroma distance is
/// already 0..=1.
fn boundary_novelty(rms: &[f32], flux: &[f32], chroma: &[Vec<f32>]) -> Vec<f32> {
    let n = rms.len();
    let db = |x: f32| 20.0 * x.max(1e-6).log10();
    let mut de = vec![0.0f32; n];
    let mut df = vec![0.0f32; n];
    let mut dc = vec![0.0f32; n];
    for i in 1..n {
        de[i] = (db(rms[i]) - db(rms[i - 1])).abs();
        df[i] = (flux[i] - flux[i - 1]).abs();
        dc[i] = cosine_dist(&chroma[i], &chroma[i - 1]);
    }
    normalize_max(&mut de);
    normalize_max(&mut df);
    (0..n)
        .map(|i| 0.5 * de[i] + 0.3 * dc[i] + 0.2 * df[i])
        .collect()
}

/// Heuristic section labels from track-relative segment energies.
///
/// A lone segment has no structural context and is always [`SectionKind::Phrase`].
fn label_segments(energies: &[f32]) -> Vec<SectionKind> {
    let n = energies.len();
    if n == 1 {
        return vec![SectionKind::Phrase];
    }
    let max_e = energies.iter().copied().fold(0.0f32, f32::max).max(1e-9);
    let e: Vec<f32> = energies.iter().map(|&x| x / max_e).collect();
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let cur = e[i];
        // A breakdown also "rises into the next segment", so the low-segment
        // test must run before the build test.
        let kind = if i == 0 && cur < 0.35 {
            SectionKind::Intro
        } else if i == n - 1 && cur < 0.35 {
            SectionKind::Outro
        } else if cur >= 0.8 {
            SectionKind::Drop
        } else if i > 0 && i + 1 < n && cur < 0.45 && e[i - 1] > cur * 1.5 && e[i + 1] > cur * 1.5 {
            SectionKind::Breakdown
        } else if i + 1 < n && e[i + 1] > cur * 1.25 {
            SectionKind::Build
        } else {
            SectionKind::Phrase
        };
        out.push(kind);
    }
    out
}

/// Cosine distance between two non-negative vectors (0 = identical, 1 = orthogonal).
fn cosine_dist(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b.iter()).map(|(&x, &y)| x * y).sum();
    let na: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let nb: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if na <= 1e-9 || nb <= 1e-9 {
        0.0
    } else {
        1.0 - dot / (na * nb)
    }
}

/// Peak-picks boundary bars from the novelty curve with a track-relative
/// threshold (mean + 0.5 std) and a 2-bar minimum spacing (strongest wins).
fn pick_boundaries(novelty: &[f32]) -> Vec<usize> {
    let n = novelty.len();
    if n < 3 {
        return Vec::new();
    }
    let vals = &novelty[1..];
    let max = vals.iter().copied().fold(0.0f32, f32::max);
    if max < 0.1 {
        return Vec::new();
    }
    let mean = vals.iter().sum::<f32>() / vals.len() as f32;
    let var = vals.iter().map(|v| (v - mean) * (v - mean)).sum::<f32>() / vals.len() as f32;
    let thr = mean + 0.5 * var.sqrt();

    let mut local: Vec<usize> = Vec::new();
    for i in 1..n {
        let v = novelty[i];
        if v > thr && v >= novelty[i - 1] && (i + 1 == n || v > novelty[i + 1]) {
            local.push(i);
        }
    }
    // Keep the strongest of any cluster closer than 2 bars.
    let mut by_strength = local.clone();
    by_strength.sort_by(|&a, &b| {
        novelty[b]
            .partial_cmp(&novelty[a])
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut accepted: Vec<usize> = Vec::new();
    for i in by_strength {
        if accepted.iter().all(|&a| a.abs_diff(i) >= 2) {
            accepted.push(i);
        }
    }
    accepted.sort_unstable();
    accepted
}

/// Moves each candidate boundary so the preceding segment length lands on an
/// allowed phrase length, dropping unsnappable candidates. The tail segment is
/// re-snapped via the last boundary when it misses the allowed set.
fn snap_boundaries(raw: &[usize], total_bars: usize, allowed: &[usize], tol: usize) -> Vec<usize> {
    let mut out: Vec<usize> = Vec::new();
    let mut cursor = 0usize;
    for &b in raw {
        if b <= cursor {
            continue;
        }
        let len = b - cursor;
        let snap = allowed
            .iter()
            .copied()
            .filter(|&l| l.abs_diff(len) <= tol)
            .min_by_key(|&l| l.abs_diff(len));
        match snap {
            Some(l) => {
                let next = cursor + l;
                if next >= total_bars {
                    // A boundary on or past the final bar would leave a zero-length
                    // trailing segment (and index `bar_times[n_bars]` out of bounds
                    // downstream); the final phrase ends at the last bar by
                    // construction, so stop snapping here.
                    break;
                }
                cursor = next;
                out.push(cursor);
            }
            None => continue,
        }
    }

    // Tail: try moving the last boundary so the final phrase also lands on an
    // allowed length (both the previous and the tail segment must stay allowed).
    let tail = total_bars - cursor;
    if !allowed.contains(&tail) && !out.is_empty() {
        let mut candidates: Vec<usize> = allowed.to_vec();
        candidates.sort_by_key(|&l| l.abs_diff(tail));
        let last_idx = out.len() - 1;
        let prev_start = if last_idx >= 1 { out[last_idx - 1] } else { 0 };
        for &l in &candidates {
            let new_last = total_bars.saturating_sub(l);
            if new_last > prev_start
                && allowed.contains(&(new_last - prev_start))
                && new_last.abs_diff(out[last_idx]) <= tol
            {
                out[last_idx] = new_last;
                break;
            }
        }
    }
    out
}

/// Scales a slice by its maximum value in place (no-op when all zeros).
fn normalize_max(v: &mut [f32]) {
    let max = v.iter().copied().fold(0.0f32, f32::max);
    if max > 1e-9 {
        for x in v.iter_mut() {
            *x /= max;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    use crate::bpm::{detect_beat_grid, BeatGrid, BpmMethod};
    use crate::decoder::{decode_audio_file, DecodedAudio};

    /// Builds a perfect beat grid for `bpm` over `seconds` (beat every 60/bpm).
    /// Phrase tests take the grid as given so they exercise phrase segmentation
    /// hermetically; beat-grid quality itself is covered by the bpm suite.
    fn perfect_grid(bpm: f32, seconds: f64) -> BeatGrid {
        let period = 60.0 / bpm as f64;
        let beats: Vec<f64> = (0..)
            .map(|i| i as f64 * period)
            .take_while(|&t| t < seconds)
            .collect();
        BeatGrid {
            bpm,
            first_beat_time: beats[0],
            bar_duration: period * 4.0,
            beats,
            confidence: 1.0,
            method: BpmMethod::OnsetAutocorr,
            pipeline_version: "bpm.1.0.0",
        }
    }

    /// Builds a mono `DecodedAudio` from raw samples at `sample_rate`.
    fn mono_audio(samples: Vec<f32>, sample_rate: u32) -> DecodedAudio {
        DecodedAudio {
            sample_rate,
            channels: 1,
            duration_seconds: samples.len() as f64 / sample_rate as f64,
            samples,
        }
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

    fn zero_bpm_grid() -> BeatGrid {
        BeatGrid {
            bpm: 0.0,
            beats: Vec::new(),
            first_beat_time: 0.0,
            bar_duration: 0.0,
            confidence: 0.0,
            method: BpmMethod::OnsetAutocorr,
            pipeline_version: "bpm.1.0.0",
        }
    }

    #[test]
    fn empty_audio_returns_error() {
        let audio = mono_audio(Vec::new(), DEFAULT_SAMPLE_RATE);
        let res = detect_phrases(&audio, None, None);
        assert!(matches!(res, Err(AnalysisError::EmptyAudio)));
    }

    #[test]
    fn no_grid_returns_empty_map() {
        let audio = mono_audio(vec![0.1f32; 44100], DEFAULT_SAMPLE_RATE);
        let map = detect_phrases(&audio, None, None).expect("should not error without a grid");
        assert!(map.phrases.is_empty());
        assert_eq!(map.confidence, 0.0);
        assert_eq!(map.method, PhraseMethod::BeatGridNovelty);
        assert_eq!(map.pipeline_version, PHRASE_PIPELINE_VERSION);
    }

    #[test]
    fn zero_bpm_grid_returns_empty_map() {
        let audio = mono_audio(vec![0.1f32; 44100], DEFAULT_SAMPLE_RATE);
        let map = detect_phrases(&audio, Some(&zero_bpm_grid()), None)
            .expect("should not error on a zero-BPM grid");
        assert!(map.phrases.is_empty());
        assert_eq!(map.confidence, 0.0);
    }

    #[test]
    fn pipeline_version_is_semverish() {
        assert!(!PHRASE_PIPELINE_VERSION.is_empty());
        assert!(PHRASE_PIPELINE_VERSION.contains('.'));
    }

    /// One section of the synthesized structure track: `bars` bars at `amp`
    /// amplitude (optionally ramping linearly to `ramp_to`), playing `chord`.
    struct SectionSpec {
        bars: usize,
        amp: f64,
        chord: [f64; 3],
        ramp_to: Option<f64>,
    }

    /// Synthesizes a multi-section electronic track: chord + white-noise bed per
    /// section, a click on every beat (so the beat grid locks), and a decaying
    /// noise crash at each section start (a realistic flux boundary marker).
    /// Noise is a deterministic LCG so tests are reproducible.
    fn structure_track(bpm: f32, sections: &[SectionSpec], sample_rate: u32) -> Vec<f32> {
        use std::f64::consts::PI;

        let beat_period = 60.0 / bpm as f64;
        let bar_len = beat_period * 4.0;
        let total_secs: f64 = sections.iter().map(|s| s.bars as f64 * bar_len).sum();
        let n = (total_secs * sample_rate as f64).round() as usize;
        let mut out = vec![0.0f32; n];

        let mut rng: u32 = 0x1234_5678;
        let mut noise = move || {
            rng = rng.wrapping_mul(1664525).wrapping_add(1013904223);
            (rng >> 8) as f64 / 16_777_216.0 - 0.5
        };

        let mut t = 0.0f64;
        for sec in sections {
            let sec_len = sec.bars as f64 * bar_len;
            let start_idx = (t * sample_rate as f64).round() as usize;
            let end_idx = (((t + sec_len) * sample_rate as f64).round() as usize).min(n);

            for (i, slot) in out.iter_mut().enumerate().take(end_idx).skip(start_idx) {
                let local = (i - start_idx) as f64 / sample_rate as f64;
                let frac = local / sec_len;
                let amp = match sec.ramp_to {
                    Some(to) => sec.amp + (to - sec.amp) * frac,
                    None => sec.amp,
                };
                let s = i as f64 / sample_rate as f64;
                let mut v = 0.0;
                for &f in &sec.chord {
                    v += (2.0 * PI * f * s).sin();
                }
                *slot = (v * amp * 0.5 / 3.0 + noise() * amp) as f32;
            }

            // Crash on the section's first beat — constant intensity, as a real
            // drummer plays a fill at full strength regardless of section level.
            let crash_len = (0.4 * sample_rate as f64).round() as usize;
            for j in 0..crash_len.min(n.saturating_sub(start_idx)) {
                let tau = j as f64 / sample_rate as f64;
                let env = (-tau / 0.08).exp();
                out[start_idx + j] += (noise() * 2.0 * env * 0.5) as f32;
            }

            t += sec_len;
        }

        // Beat clicks across the whole track (0.8 amplitude matches the proven
        // bpm.rs click track so the grid locks at the true tempo).
        let beat_samples = (beat_period * sample_rate as f64).round() as usize;
        let burst = (0.02 * sample_rate as f64).round() as usize;
        let mut pos = 0usize;
        while pos + burst <= n {
            for i in 0..burst {
                let tau = i as f64 / sample_rate as f64;
                out[pos + i] +=
                    (0.8 * (2.0 * PI * 800.0 * tau).sin() * (-tau / 0.005).exp()) as f32;
            }
            pos += beat_samples;
        }

        out
    }

    /// intro 8 / build 8 (ramp) / drop 8 / breakdown 4 / drop 8 / outro 8 = 44 bars.
    fn six_section_track() -> (Vec<f32>, [usize; 6], [SectionKind; 6]) {
        let am = [220.0, 261.63, 329.63];
        let c = [130.81, 164.81, 196.0];
        let sections = [
            SectionSpec {
                bars: 8,
                amp: 0.03,
                chord: am,
                ramp_to: None,
            },
            SectionSpec {
                bars: 8,
                amp: 0.15,
                chord: am,
                ramp_to: Some(0.45),
            },
            SectionSpec {
                bars: 8,
                amp: 0.75,
                chord: c,
                ramp_to: None,
            },
            SectionSpec {
                bars: 4,
                amp: 0.10,
                chord: am,
                ramp_to: None,
            },
            SectionSpec {
                bars: 8,
                amp: 0.75,
                chord: c,
                ramp_to: None,
            },
            SectionSpec {
                bars: 8,
                amp: 0.03,
                chord: am,
                ramp_to: None,
            },
        ];
        let expected_starts = [0usize, 8, 16, 24, 28, 36];
        let expected_kinds = [
            SectionKind::Intro,
            SectionKind::Build,
            SectionKind::Drop,
            SectionKind::Breakdown,
            SectionKind::Drop,
            SectionKind::Outro,
        ];
        (
            structure_track(120.0, &sections, DEFAULT_SAMPLE_RATE),
            expected_starts,
            expected_kinds,
        )
    }

    #[test]
    fn segments_synthesized_structure_track() {
        let (samples, expected_starts, expected_kinds) = six_section_track();
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let grid = perfect_grid(120.0, audio.duration_seconds);

        let map = detect_phrases(&audio, Some(&grid), None).expect("phrases");
        assert_eq!(map.method, PhraseMethod::BeatGridNovelty);
        assert_eq!(map.pipeline_version, PHRASE_PIPELINE_VERSION);
        assert!(
            map.confidence > 0.0 && map.confidence <= 1.0,
            "overall confidence {}",
            map.confidence
        );

        assert_eq!(map.phrases.len(), 6, "got {:?}", map.phrases);
        let allowed = &PhraseOptions::default().allowed_lengths_bars;
        for (i, phrase) in map.phrases.iter().enumerate() {
            assert!(
                phrase.start_bar.abs_diff(expected_starts[i]) <= 1,
                "phrase {i} start_bar {} (expected ~{})",
                phrase.start_bar,
                expected_starts[i]
            );
            assert_eq!(phrase.kind, expected_kinds[i], "phrase {i}");
            assert!(
                allowed.contains(&phrase.length_bars),
                "phrase {i} length {} not metrical",
                phrase.length_bars
            );
            assert!(
                (0.0..=1.0).contains(&phrase.confidence),
                "phrase {i} confidence {}",
                phrase.confidence
            );
        }
    }

    #[test]
    fn phrase_times_align_to_grid_bars() {
        let (samples, expected_starts, _) = six_section_track();
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let grid = perfect_grid(120.0, audio.duration_seconds);
        let map = detect_phrases(&audio, Some(&grid), None).expect("phrases");

        for (i, phrase) in map.phrases.iter().enumerate() {
            let bar_beat = expected_starts[i] * 4;
            let bar_time = grid.beats[bar_beat];
            assert!(
                (phrase.start_seconds - bar_time).abs() < 0.1,
                "phrase {i} start_seconds {} vs grid bar time {}",
                phrase.start_seconds,
                bar_time
            );
        }
        let last = map.phrases.last().expect("at least one phrase");
        assert!(
            (audio.duration_seconds - last.end_seconds).abs() < grid.bar_duration,
            "last phrase should end near the track end"
        );
    }

    #[test]
    fn real_flac_fixture_runs_end_to_end() {
        // The library-scanner fixtures are all under 2 s, so this guards the
        // decode -> grid -> phrase path on real bytes rather than asserting
        // specific structure (golden phrase fixtures arrive with T1.2.6).
        let audio = fixture_audio("flac/tagged-techno-140.flac");
        let grid = detect_beat_grid(&audio, None).expect("beat grid");
        let map = detect_phrases(&audio, Some(&grid), None).expect("phrases");

        assert_eq!(map.method, PhraseMethod::BeatGridNovelty);
        assert_eq!(map.pipeline_version, PHRASE_PIPELINE_VERSION);
        assert!((0.0..=1.0).contains(&map.confidence));
        for p in &map.phrases {
            assert!(p.start_seconds < p.end_seconds);
            assert!(p.length_bars > 0);
            assert!((0.0..=1.0).contains(&p.confidence));
            assert!(
                p.end_seconds <= audio.duration_seconds + grid.bar_duration,
                "phrase overruns track: end {} vs duration {}",
                p.end_seconds,
                audio.duration_seconds
            );
        }
    }

    /// Regression: snapping could push the last boundary onto the final bar, which
    /// produced a zero-length trailing segment and an out-of-bounds `bar_times[n_bars]`
    /// (a 4-bar track panicked with "index out of bounds: the len is 4 but the index is 4").
    #[test]
    fn snap_boundaries_stay_strictly_inside_the_bar_range() {
        let allowed = &PhraseOptions::default().allowed_lengths_bars;

        // Two candidates that each snap to 4 bars: the second would land on bar 8 of
        // an 8-bar track.
        let out = snap_boundaries(&[4, 8], 8, allowed, 2);
        assert_eq!(
            out,
            vec![4],
            "the boundary at the final bar must be dropped"
        );

        for total_bars in 4..=16 {
            let out = snap_boundaries(&[1, 2, 4, 8, 16, 32], total_bars, allowed, 2);
            assert!(
                out.iter().all(|&b| b < total_bars),
                "boundaries must stay inside 0..{total_bars}, got {out:?}"
            );
        }
    }

    /// End-to-end companion to [`snap_boundaries_stay_strictly_inside_the_bar_range`]:
    /// the 16-beat fixtures are only 4 bars long, so a boundary snapping to the last
    /// bar used to panic deep inside `detect_phrases`.
    #[test]
    fn four_bar_fixture_segments_without_indexing_past_the_last_bar() {
        let audio = fixture_audio("analysis/house-128.wav");
        let grid = detect_beat_grid(&audio, None).expect("beat grid");
        let map = detect_phrases(&audio, Some(&grid), None).expect("phrases");

        assert!(!map.phrases.is_empty(), "a 4-bar track must still segment");
        for p in &map.phrases {
            assert!(p.start_seconds < p.end_seconds);
            assert!(p.start_bar < 4, "start_bar must index a real bar");
        }
    }

    #[test]
    fn steady_track_yields_single_phrase() {
        let am = [220.0, 261.63, 329.63];
        let sections = [SectionSpec {
            bars: 16,
            amp: 0.5,
            chord: am,
            ramp_to: None,
        }];
        let samples = structure_track(120.0, &sections, DEFAULT_SAMPLE_RATE);
        let audio = mono_audio(samples, DEFAULT_SAMPLE_RATE);
        let grid = perfect_grid(120.0, audio.duration_seconds);

        let map = detect_phrases(&audio, Some(&grid), None).expect("phrases");
        assert_eq!(map.phrases.len(), 1, "got {:?}", map.phrases);
        let only = &map.phrases[0];
        assert_eq!(only.kind, SectionKind::Phrase);
        assert_eq!(only.start_bar, 0);
        assert!(only.length_bars >= 16);
    }
}
