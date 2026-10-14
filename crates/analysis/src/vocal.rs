//! Vocal presence / density estimation from decoded audio.
//!
//! Deterministic inference path for T1.1.6 ("Vocal presence / density").
//! Produces a per-frame presence curve plus a track-level aggregate (the
//! future `vocal_presence REAL 0-1` column, DATA_MODEL.md §2):
//!
//! 1. Decode -> mid signal (all-channel average) -> resample to the analysis
//!    rate. Stereo input also builds the side signal `(L-R)/2`.
//! 2. One STFT pass per signal (Hann, 4096/2048; ~46 ms hop = curve resolution).
//! 3. Per frame: vocal-band (300-4000 Hz) energy ratio of the mid signal over
//!    all energy >= 150 Hz — deep bass (kick/bass fundamentals) carries no
//!    voice information and would only deflate the ratio on bass-heavy
//!    masters — soft-mapped to `0.0..=1.0`.
//! 4. Per frame, stereo only: center dominance = mid / (mid + side) energy.
//!    Lead vocals sit center (dominance ~ 1); wide-panned synths split L/R
//!    (dominance ~ 0.5) and close the gate.
//! 5. The ratio-derived presence is gated by dominance, then median-smoothed
//!    (default 3 frames) so isolated transients cannot spike the curve.
//!
//! ## Grid independence and degradation
//! Unlike the phrase path, no beat grid is required: presence is a purely
//! local (frame-level) measurement. Only empty audio is an error; audio
//! shorter than one frame (or a zero hop) degrades to an empty curve with a
//! zero aggregate, never an error.
//!
//! ## ONNX seam
//! When an ONNX vocal-activity model is wired in (Phase 1 per MODELS.md, a
//! quantized Spleeter-class source-separation proxy), a model-derived
//! per-frame activity curve replaces steps 3-4 while smoothing, the
//! aggregate, and the [`VocalProfile`] contract stay unchanged — the same
//! post-processor seam as `bpm.rs`/`key.rs`.
//!
//! ## Known limits
//! A deterministic band ratio cannot fully separate sustained *centered*
//! chords from voices: center-stack pads will read as somewhat vocal.
//! [`VocalMethod::SpectralHeuristic`] marks results as heuristic; the ONNX
//! path is the intended fix (MODELS.md §2).

use num_complex::Complex;
use rustfft::{Fft, FftPlanner};

use crate::decoder::DecodedAudio;
use crate::error::AnalysisError;
use crate::normalizer::{resample, to_mono};

/// Pipeline version stamp for vocal results. Bump when the algorithm changes
/// in a way that affects outputs (see DATA_MODEL.md §5).
pub const VOCAL_PIPELINE_VERSION: &str = "vocal.1.0.0";

/// Which engine produced the vocal profile.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VocalMethod {
    /// Deterministic band-ratio heuristic (no external model).
    SpectralHeuristic,
    /// ONNX vocal-activity model (future hook; reuses this curve/aggregate contract).
    Onnx,
}

/// One point of the vocal presence curve.
#[derive(Debug, Clone, PartialEq)]
pub struct VocalPoint {
    /// Frame center in seconds from track start.
    pub start_seconds: f64,
    /// Presence estimate for this frame, `0.0..=1.0`.
    pub presence: f32,
}

/// Vocal presence / density profile for a track.
#[derive(Debug, Clone)]
pub struct VocalProfile {
    /// Presence curve in track order.
    pub curve: Vec<VocalPoint>,
    /// Track-level aggregate presence (mean of the curve), `0.0..=1.0`.
    pub presence: f32,
    /// Which engine produced this result.
    pub method: VocalMethod,
    /// Pipeline version that produced this profile (see [`VOCAL_PIPELINE_VERSION`]).
    pub pipeline_version: &'static str,
}

/// Options controlling vocal presence estimation. All fields have sensible defaults.
#[derive(Debug, Clone)]
pub struct VocalOptions {
    /// Resample mono audio to this rate before analysis.
    pub sample_rate: u32,
    /// STFT frame size (power of two recommended).
    pub frame_size: usize,
    /// STFT hop size (samples).
    pub hop_size: usize,
    /// Frequency band (Hz) treated as the vocal region (fundamental + formants).
    pub vocal_band_hz: (f32, f32),
    /// Median-smoothing window (frames) applied to the raw curve; 1 disables.
    pub smoothing_frames: usize,
}

impl Default for VocalOptions {
    fn default() -> Self {
        Self {
            sample_rate: 44100,
            frame_size: 4096,
            hop_size: 2048,
            vocal_band_hz: (300.0, 4000.0),
            smoothing_frames: 3,
        }
    }
}

/// Estimates vocal presence / density for a track.
///
/// Never depends on a beat grid; only empty audio is an [`AnalysisError`].
pub fn detect_vocal_presence(
    audio: &DecodedAudio,
    opts: Option<&VocalOptions>,
) -> Result<VocalProfile, AnalysisError> {
    if audio.samples.is_empty() {
        return Err(AnalysisError::EmptyAudio);
    }
    let opts = opts.cloned().unwrap_or_default();

    let mono = to_mono(&audio.samples, audio.channels).map_err(AnalysisError::Normalization)?;
    let mid = resample(&mono, audio.sample_rate, opts.sample_rate)
        .map_err(AnalysisError::Normalization)?;
    // Side signal (L-R)/2 for the center-dominance feature; None on mono input.
    let side = if audio.channels >= 2 {
        let planar = audio.channel_planar();
        let (l, r) = (&planar[0], &planar[1]);
        let n = l.len().min(r.len());
        let mut s = Vec::with_capacity(n);
        for i in 0..n {
            s.push((l[i] - r[i]) * 0.5);
        }
        Some(
            resample(&s, audio.sample_rate, opts.sample_rate)
                .map_err(AnalysisError::Normalization)?,
        )
    } else {
        None
    };

    let curve = presence_curve(
        &mid,
        side.as_deref(),
        opts.sample_rate,
        opts.frame_size,
        opts.hop_size,
        opts.vocal_band_hz,
        opts.smoothing_frames,
    );
    let presence = if curve.is_empty() {
        0.0
    } else {
        curve.iter().map(|p| p.presence).sum::<f32>() / curve.len() as f32
    };

    Ok(VocalProfile {
        curve,
        presence,
        method: VocalMethod::SpectralHeuristic,
        pipeline_version: VOCAL_PIPELINE_VERSION,
    })
}

/// Per-frame presence estimate: vocal-band energy ratio of the mid signal,
/// gated by center dominance (vocals sit center; hard-panned synths do not).
fn presence_curve(
    mid: &[f32],
    side: Option<&[f32]>,
    sample_rate: u32,
    frame_size: usize,
    hop_size: usize,
    band: (f32, f32),
    smoothing_frames: usize,
) -> Vec<VocalPoint> {
    if mid.len() < frame_size || hop_size == 0 {
        return Vec::new();
    }
    let num_frames = (mid.len() - frame_size) / hop_size + 1;
    let sr = sample_rate as f32;
    let nbins = frame_size / 2 + 1;
    // Hann tapering (as in phrase.rs) keeps band-energy sums clean of leakage.
    let window: Vec<f32> = (0..frame_size)
        .map(|i| {
            0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (frame_size - 1) as f32).cos()
        })
        .collect();
    let mut planner = FftPlanner::<f32>::new();
    let fft: std::sync::Arc<dyn Fft<f32>> = planner.plan_fft_forward(frame_size);

    let mut raw = Vec::with_capacity(num_frames);
    for i in 0..num_frames {
        let mut buf: Vec<Complex<f32>> = (0..frame_size)
            .map(|j| Complex::new(mid[i * hop_size + j] * window[j], 0.0))
            .collect();
        fft.process(&mut buf);

        let mut total = 0.0f32;
        let mut in_band = 0.0f32;
        for (k, c) in buf[..nbins].iter().enumerate().skip(1) {
            let e = c.norm() * c.norm();
            let f_hz = k as f32 * sr / frame_size as f32;
            // Deep bass (<150 Hz: kick + bass fundamentals) carries no voice
            // information and only deflates the ratio on bass-heavy masters,
            // so it is excluded from the denominator.
            if f_hz >= 150.0 {
                total += e;
            }
            if f_hz >= band.0 && f_hz <= band.1 {
                in_band += e;
            }
        }
        // Ratio floor/ceiling: broadband noise sits near ~17% in-band (band
        // width over Nyquist); voice/formant content climbs well past 50%.
        let ratio = if total > 1e-9 { in_band / total } else { 0.0 };
        let mut presence = ((ratio - 0.15) / 0.4).clamp(0.0, 1.0);

        if let Some(side_buf) = side {
            let mut sbuf: Vec<Complex<f32>> = (0..frame_size)
                .map(|j| Complex::new(side_buf[i * hop_size + j] * window[j], 0.0))
                .collect();
            fft.process(&mut sbuf);
            let mut side_total = 0.0f32;
            for (k, c) in sbuf[..nbins].iter().enumerate().skip(1) {
                if k as f32 * sr / frame_size as f32 >= 150.0 {
                    side_total += c.norm() * c.norm();
                }
            }
            // Fully centered content: side ~ 0 -> dominance 1. Hard-panned
            // L/R split: mid and side equal -> dominance 0.5 -> gate closed.
            let sum = total + side_total;
            if sum > 1e-9 {
                let dominance = total / sum;
                let gate = ((dominance - 0.55) / 0.3).clamp(0.0, 1.0);
                presence *= gate;
            }
        }

        raw.push(presence);
    }

    let smoothed = median_smooth(&raw, smoothing_frames);
    smoothed
        .into_iter()
        .enumerate()
        .map(|(i, presence)| VocalPoint {
            start_seconds: (i * hop_size + frame_size / 2) as f64 / sample_rate as f64,
            presence,
        })
        .collect()
}

/// Centered sliding median (window truncated at the edges).
fn median_smooth(values: &[f32], window: usize) -> Vec<f32> {
    if window <= 1 || values.is_empty() {
        return values.to_vec();
    }
    let half = window / 2;
    values
        .iter()
        .enumerate()
        .map(|(i, _)| {
            let lo = i.saturating_sub(half);
            let hi = (i + half + 1).min(values.len());
            let mut w: Vec<f32> = values[lo..hi].to_vec();
            w.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            w[w.len() / 2]
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    /// Builds a mono `DecodedAudio` from raw samples at `sample_rate`.
    fn mono_audio(samples: Vec<f32>, sample_rate: u32) -> DecodedAudio {
        DecodedAudio {
            sample_rate,
            channels: 1,
            duration_seconds: samples.len() as f64 / sample_rate as f64,
            samples,
        }
    }

    /// Builds an interleaved stereo `DecodedAudio` from per-channel buffers.
    fn stereo_audio(left: Vec<f32>, right: Vec<f32>, sample_rate: u32) -> DecodedAudio {
        assert_eq!(left.len(), right.len());
        let mut samples = Vec::with_capacity(left.len() * 2);
        for i in 0..left.len() {
            samples.push(left[i]);
            samples.push(right[i]);
        }
        DecodedAudio {
            sample_rate,
            channels: 2,
            duration_seconds: left.len() as f64 / sample_rate as f64,
            samples,
        }
    }

    /// A pure sine tone of constant amplitude.
    fn sine_signal(freq: f32, seconds: f64, sample_rate: u32, amp: f32) -> Vec<f32> {
        let n = (seconds * sample_rate as f64).round() as usize;
        (0..n)
            .map(|i| amp * (2.0 * PI * freq * i as f32 / sample_rate as f32).sin())
            .collect()
    }

    /// A synthetic lead-vocal stand-in: harmonic stack at 220 Hz with a formant
    /// bump around 1 kHz (so energy concentrates in the 300-4000 Hz band),
    /// 5 Hz vibrato, and 4 Hz syllabic amplitude modulation. Phase-accurate
    /// (per-harmonic phase accumulation) so the spectrum stays clean.
    fn vocal_signal(seconds: f64, sample_rate: u32) -> Vec<f32> {
        let f0 = 220.0f32;
        let nyquist = sample_rate as f32 / 2.0;
        let n = (seconds * sample_rate as f64).round() as usize;
        let mut phases = [0.0f32; 24];
        let mut out = Vec::with_capacity(n);
        for i in 0..n {
            let t = i as f32 / sample_rate as f32;
            let vib = 1.0 + 0.015 * (2.0 * PI * 5.0 * t).sin();
            let am = 0.75 + 0.25 * (2.0 * PI * 4.0 * t).sin();
            let mut v = 0.0f32;
            for (h, phase) in phases.iter_mut().enumerate() {
                let fh = f0 * (h + 1) as f32 * vib;
                if fh > nyquist {
                    break;
                }
                let lfc = (fh / 1000.0).log2();
                let formant = (-0.5 * lfc * lfc).exp();
                *phase += 2.0 * PI * fh / sample_rate as f32;
                v += formant / (h + 1) as f32 * phase.sin();
            }
            out.push(v * am);
        }
        out
    }

    /// Deterministic LCG noise (reproducible across runs/platforms).
    struct Lcg(u32);
    impl Lcg {
        fn bipolar(&mut self) -> f32 {
            self.0 = self.0.wrapping_mul(1664525).wrapping_add(1013904223);
            (self.0 >> 8) as f32 / 8_388_608.0 - 1.0
        }
    }

    /// Sawtooth via per-harmonic phase accumulation (nyquist-safe).
    fn saw_signal(freq: f32, seconds: f64, sample_rate: u32, amp: f32) -> Vec<f32> {
        let nyquist = sample_rate as f32 / 2.0;
        let n = (seconds * sample_rate as f64).round() as usize;
        let mut phases = [0.0f32; 24];
        let mut out = Vec::with_capacity(n);
        for _ in 0..n {
            let mut v = 0.0f32;
            for (h, phase) in phases.iter_mut().enumerate() {
                let fh = freq * (h + 1) as f32;
                if fh > nyquist {
                    break;
                }
                *phase += 2.0 * PI * fh / sample_rate as f32;
                v += phase.sin() / (h + 1) as f32;
            }
            out.push(v * amp);
        }
        out
    }

    /// Overlays `add` onto `base` starting at `start_seconds` (mix in place).
    fn overlay(base: &mut [f32], add: &[f32], start_seconds: f64, sample_rate: u32) {
        let start = (start_seconds * sample_rate as f64).round() as usize;
        for (i, &a) in add.iter().enumerate() {
            let idx = start + i;
            if idx < base.len() {
                base[idx] += a;
            }
        }
    }

    /// A panned-instrumental club bed: kick + high-hats centered, in-band saw
    /// stabs hard-panned (alternating L/R) — zero lead vocal, by construction.
    fn panned_instrumental_track(seconds: f64, sample_rate: u32) -> (Vec<f32>, Vec<f32>) {
        let n = (seconds * sample_rate as f64).round() as usize;
        let mut l = vec![0.0f32; n];
        let mut r = vec![0.0f32; n];

        // Kick: 55 Hz with exponential decay every 0.5 s, centered.
        let beat = (0.5 * sample_rate as f64).round() as usize;
        let kick_len = ((0.35f64) * sample_rate as f64).round() as usize;
        let mut pos = 0usize;
        while pos < n {
            for i in 0..kick_len.min(n.saturating_sub(pos)) {
                let tau = i as f32 / sample_rate as f32;
                let env = (-tau / 0.15).exp();
                let v = 0.6 * env * (2.0 * PI * 55.0 * tau).sin();
                l[pos + i] += v;
                r[pos + i] += v;
            }
            pos += beat;
        }

        // Hats: first-difference of LCG noise (tilts energy above 4 kHz), centered.
        let mut rng = Lcg(0x1234_5678);
        let mut prev = 0.0f32;
        for slot in l.iter_mut().zip(r.iter_mut()) {
            let x = rng.bipolar();
            let hp = x - prev;
            prev = x;
            let v = 0.15 * hp;
            *slot.0 += v;
            *slot.1 += v;
        }

        // Saw stabs at 220 Hz, 0.35 s on each 0.5 s beat, hard-panned alternating.
        let stab_len = ((0.35f64) * sample_rate as f64).round() as usize;
        let stab = saw_signal(
            220.0,
            stab_len as f64 / sample_rate as f64,
            sample_rate,
            0.5,
        );
        let mut beat_idx = 0usize;
        let mut pos = 0usize;
        while pos < n {
            let dst = if beat_idx.is_multiple_of(2) {
                &mut l
            } else {
                &mut r
            };
            overlay(dst, &stab, pos as f64 / sample_rate as f64, sample_rate);
            pos += beat;
            beat_idx += 1;
        }

        (l, r)
    }

    /// A wide stereo instrumental bed: two different continuous saw chords,
    /// one hard-panned L, one hard-panned R (the classic wide-supersaw pad),
    /// over the centered kick/hat rhythm. In-band content never stops, so a
    /// band ratio alone reads it as vocal; center dominance must save it.
    fn wide_pads_track(seconds: f64, sample_rate: u32) -> (Vec<f32>, Vec<f32>) {
        let n = (seconds * sample_rate as f64).round() as usize;
        let mut l = vec![0.0f32; n];
        let mut r = vec![0.0f32; n];

        // Rhythm bed (centered), continuous quiet kick + hats.
        let beat = (0.5 * sample_rate as f64).round() as usize;
        let kick_len = ((0.35f64) * sample_rate as f64).round() as usize;
        let mut pos = 0usize;
        while pos < n {
            for i in 0..kick_len.min(n.saturating_sub(pos)) {
                let tau = i as f32 / sample_rate as f32;
                let env = (-tau / 0.15).exp();
                let v = 0.6 * env * (2.0 * PI * 55.0 * tau).sin();
                l[pos + i] += v;
                r[pos + i] += v;
            }
            pos += beat;
        }
        let mut rng = Lcg(0x1234_5678);
        let mut prev = 0.0f32;
        for slot in l.iter_mut().zip(r.iter_mut()) {
            let x = rng.bipolar();
            let v = 0.15 * (x - prev);
            prev = x;
            *slot.0 += v;
            *slot.1 += v;
        }

        // Continuous hard-panned chords: Am saw L, C saw R.
        let secs = n as f64 / sample_rate as f64;
        let pad_l = saw_signal(220.0, secs, sample_rate, 0.45);
        let pad_r = saw_signal(261.63, secs, sample_rate, 0.45);
        for i in 0..n {
            l[i] += pad_l[i];
            r[i] += pad_r[i];
        }

        (l, r)
    }

    #[test]
    fn wide_panned_pads_read_low_presence() {
        let sr = 44100u32;
        let (l, r) = wide_pads_track(8.0, sr);
        let audio = stereo_audio(l, r, sr);

        let profile = detect_vocal_presence(&audio, None).expect("profile");
        assert!(!profile.curve.is_empty());
        assert!(
            profile.presence < 0.35,
            "mean presence {} should read low for wide-panned pads",
            profile.presence
        );
    }

    #[test]
    fn audio_shorter_than_one_frame_degrades_to_empty_curve() {
        // 1000 samples < frame_size 4096: must yield an empty curve with zero
        // aggregate, never an error or an arithmetic panic.
        let audio = mono_audio(vec![0.3f32; 1000], 44100);
        let profile = detect_vocal_presence(&audio, None).expect("profile");
        assert!(profile.curve.is_empty());
        assert_eq!(profile.presence, 0.0);
        assert_eq!(profile.method, VocalMethod::SpectralHeuristic);
        assert_eq!(profile.pipeline_version, VOCAL_PIPELINE_VERSION);
    }

    #[test]
    fn zero_hop_degrades_to_empty_curve() {
        let audio = mono_audio(vec![0.3f32; 44100], 44100);
        let opts = VocalOptions {
            hop_size: 0,
            ..Default::default()
        };
        let profile = detect_vocal_presence(&audio, Some(&opts)).expect("profile");
        assert!(profile.curve.is_empty());
        assert_eq!(profile.presence, 0.0);
    }

    #[test]
    fn silent_audio_yields_zero_presence() {
        let audio = mono_audio(vec![0.0f32; 44100], 44100);
        let profile = detect_vocal_presence(&audio, None).expect("profile");
        assert_eq!(profile.presence, 0.0);
        assert!(profile.curve.iter().all(|p| p.presence == 0.0));
    }

    #[test]
    fn curve_separates_alternating_sections() {
        // 8 s instrumental / 8 s vocal / 8 s instrumental / 8 s vocal: the
        // curve must track the structure (the density-over-time contract).
        let sr = 44100u32;
        let section_secs = 8.0;
        let mut l = Vec::new();
        let mut r = Vec::new();
        for section in 0..4 {
            if section % 2 == 0 {
                let (il, ir) = panned_instrumental_track(section_secs, sr);
                l.extend(il);
                r.extend(ir);
            } else {
                let voice = vocal_signal(section_secs, sr);
                let bass = sine_signal(55.0, section_secs, sr, 0.5);
                let mix: Vec<f32> = voice
                    .iter()
                    .zip(bass.iter())
                    .map(|(&v, &b)| v * 0.8 + b)
                    .collect();
                l.extend(mix.iter().copied());
                r.extend(mix.iter().copied());
            }
        }
        let audio = stereo_audio(l, r, sr);

        let profile = detect_vocal_presence(&audio, None).expect("profile");
        let mean_over = |from: f64, to: f64| -> f32 {
            let pts: Vec<f32> = profile
                .curve
                .iter()
                .filter(|p| p.start_seconds >= from && p.start_seconds < to)
                .map(|p| p.presence)
                .collect();
            pts.iter().sum::<f32>() / pts.len() as f32
        };
        let instr = (mean_over(0.0, 8.0) + mean_over(16.0, 24.0)) / 2.0;
        let vocal = (mean_over(8.0, 16.0) + mean_over(24.0, 32.0)) / 2.0;
        assert!(
            vocal > instr + 0.25,
            "vocal sections ({vocal}) must clearly exceed instrumental ones ({instr})"
        );
    }

    #[test]
    fn mono_lead_vocal_reads_high_presence() {
        // Mono input has no side signal: the center-dominance gate must default
        // open and the band ratio alone must carry the detection.
        let sr = 44100u32;
        let audio = mono_audio(vocal_signal(8.0, sr), sr);

        let profile = detect_vocal_presence(&audio, None).expect("profile");
        assert!(!profile.curve.is_empty());
        assert!(
            profile.presence > 0.5,
            "mean presence {} should read high for a mono lead vocal",
            profile.presence
        );
    }

    #[test]
    fn isolated_transient_does_not_spike_curve() {
        // A 20 ms in-band burst (shorter than one hop) lands in a single frame;
        // median smoothing must keep it from spiking the curve.
        let sr = 44100u32;
        let secs = 4.0;
        let bed = panned_instrumental_track(secs, sr);
        let burst = saw_signal(880.0, 0.02, sr, 0.8);
        let mut l = bed.0;
        let mut r = bed.1;
        overlay(&mut l, &burst, 2.0, sr);
        overlay(&mut r, &burst, 2.0, sr);
        let audio = stereo_audio(l, r, sr);

        let profile = detect_vocal_presence(&audio, None).expect("profile");
        let max = profile
            .curve
            .iter()
            .map(|p| p.presence)
            .fold(0.0f32, f32::max);
        assert!(
            max < 0.4,
            "curve max {} should stay low through an isolated transient",
            max
        );
    }

    #[test]
    fn panned_instrumental_reads_low_presence() {
        let sr = 44100u32;
        let (l, r) = panned_instrumental_track(8.0, sr);
        let audio = stereo_audio(l, r, sr);

        let profile = detect_vocal_presence(&audio, None).expect("profile");
        assert!(!profile.curve.is_empty());
        assert!(
            profile.presence < 0.35,
            "mean presence {} should read low for a panned instrumental",
            profile.presence
        );
    }

    #[test]
    fn centered_voice_over_bass_reads_high_presence() {
        let sr = 44100u32;
        let voice = vocal_signal(8.0, sr);
        let bass = sine_signal(55.0, 8.0, sr, 0.5);
        let mix: Vec<f32> = voice
            .iter()
            .zip(bass.iter())
            .map(|(&v, &b)| v * 0.8 + b)
            .collect();
        let audio = stereo_audio(mix.clone(), mix, sr);

        let profile = detect_vocal_presence(&audio, None).expect("profile");
        assert_eq!(profile.method, VocalMethod::SpectralHeuristic);
        assert_eq!(profile.pipeline_version, VOCAL_PIPELINE_VERSION);
        assert!(!profile.curve.is_empty(), "curve should have points");
        assert!(
            profile.presence > 0.5,
            "mean presence {} should read high for a lead vocal",
            profile.presence
        );
    }

    #[test]
    fn real_flac_fixture_runs_end_to_end() {
        // The library-scanner fixture is 1.7 s of real music, so it pins the full
        // decode -> mid/side -> STFT -> gate -> smoothing path on real bytes.
        // Sub-frame degradation is pinned separately with a synthetic clip below.
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("fixtures")
            .join("audio")
            .join("flac/tagged-techno-140.flac");
        let audio = crate::decoder::decode_audio_file(&path).expect("fixture should decode");
        // Regression: the decode loop used to keep only the final packet, which
        // turned this 1.71 s fixture into 42 ms of audio.
        assert!(
            (audio.duration_seconds - 1.714286).abs() < 0.05,
            "fixture decoded to {:.3}s; expected the whole ~1.714s file",
            audio.duration_seconds
        );

        // Real musical length: the default 4096-sample frame fits, so the full
        // analysis path runs.
        let profile = detect_vocal_presence(&audio, None).expect("profile");
        assert_eq!(profile.method, VocalMethod::SpectralHeuristic);
        assert_eq!(profile.pipeline_version, VOCAL_PIPELINE_VERSION);
        assert!(
            !profile.curve.is_empty(),
            "a 1.7s fixture must produce a vocal curve"
        );
        assert!((0.0..=1.0).contains(&profile.presence));

        // Sub-frame audio (shorter than one default frame) still degrades to an
        // empty curve rather than erroring.
        let sub_frame = mono_audio(vec![0.2; 512], 44100);
        let degraded = detect_vocal_presence(&sub_frame, None).expect("profile");
        assert!(degraded.curve.is_empty());
        assert_eq!(degraded.presence, 0.0);

        // Frame-size-scaled options run the same path with a smaller frame.
        let opts = VocalOptions {
            frame_size: 1024,
            hop_size: 512,
            ..Default::default()
        };
        let scaled = detect_vocal_presence(&audio, Some(&opts)).expect("profile");
        assert!(!scaled.curve.is_empty(), "scaled options should fit frames");
        assert!((0.0..=1.0).contains(&scaled.presence));
        let mut last_t = -1.0f64;
        for p in &scaled.curve {
            assert!((0.0..=1.0).contains(&p.presence), "presence {}", p.presence);
            assert!(p.start_seconds > last_t, "curve times must ascend");
            assert!(
                p.start_seconds <= audio.duration_seconds,
                "curve point {} past track end {}",
                p.start_seconds,
                audio.duration_seconds
            );
            last_t = p.start_seconds;
        }
    }

    #[test]
    fn empty_audio_returns_error() {
        let audio = mono_audio(Vec::new(), 44100);
        let res = detect_vocal_presence(&audio, None);
        assert!(matches!(res, Err(AnalysisError::EmptyAudio)));
    }
}
