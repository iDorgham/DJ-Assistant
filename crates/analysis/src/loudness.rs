//! EBU R128 loudness measurement (integrated LUFS, true peak, loudness range).
//!
//! Deterministic path for T1.1.7 ("Loudness (EBU R128)"), implemented on the
//! pure-Rust `ebur128` crate (BS.1770-4 K-weighting, 400 ms blocks with 75%
//! overlap, absolute gate at -70 LUFS + relative gate at -10 LU, EBU Tech 3342
//! loudness range, inter-sample true peak). MODELS.md §2 sanctions the
//! crate-based approach ("Native / crate"); there is no ONNX seam because a
//! deterministic spec has no alternate engine.
//!
//! # Measurement semantics
//!
//! - Channels are fed to the meter natively: mono as mono, stereo as stereo.
//!   BS.1770 sums channel powers, so mono-downmixing stereo first would
//!   misread correlated content by ~9 LU — never downmix before measuring.
//!   Material with more than two channels (rare in DJ libraries) is
//!   downmixed to stereo via the normalizer and measured as stereo.
//! - Non-finite crate results are floored: silence yields no gated blocks,
//!   so integrated loudness and true peak map to -70.0 (the spec's own
//!   absolute-gate threshold — a finite, spec-anchored sentinel that fits
//!   the `loudness_lufs REAL` column, DATA_MODEL.md §2); loudness range
//!   maps to 0.0.
//!
//! # Deviations from the house analyzer pattern
//!
//! Unlike `bpm`/`key`/`phrase`/`vocal`, this module has no options struct
//! (BS.1770 has no tunables) and no method enum (deterministic spec, no
//! alternate engine). The `pipeline_version` stamp stays so T1.1.8 can
//! record `analysis_version` per track.

use ebur128::{EbuR128, Mode};

use crate::decoder::DecodedAudio;
use crate::error::AnalysisError;
use crate::normalizer::to_stereo;

/// Pipeline version stamp for loudness results. Bump when the algorithm or
/// the underlying crate version changes in a way that affects outputs.
pub const LOUDNESS_PIPELINE_VERSION: &str = "loudness.1.0.0";

/// Floor applied to silence/undefined loudness and true-peak results.
///
/// -70 LUFS is the BS.1770 absolute gate: blocks quieter than this never
/// enter the integration, so a measured integrated loudness below the floor
/// is undefined rather than meaningful.
pub const SILENCE_FLOOR: f32 = -70.0;

/// EBU R128 loudness profile for a track.
#[derive(Debug, Clone, PartialEq)]
pub struct LoudnessProfile {
    /// Gated integrated loudness in LUFS, floored at [`SILENCE_FLOOR`].
    pub integrated_lufs: f32,
    /// Maximum inter-sample true peak across channels, in dBTP, floored at
    /// [`SILENCE_FLOOR`].
    pub true_peak_dbtp: f32,
    /// Loudness range (EBU Tech 3342) in LU; 0.0 for silence or audio too
    /// short to support a short-term distribution.
    pub loudness_range_lu: f32,
    /// Pipeline version that produced this profile (see [`LOUDNESS_PIPELINE_VERSION`]).
    pub pipeline_version: &'static str,
}

/// Measures EBU R128 loudness for a track.
///
/// Only empty audio is an [`AnalysisError`]; every other input (including
/// silence and sub-block audio) yields a finite profile.
pub fn detect_loudness(audio: &DecodedAudio) -> Result<LoudnessProfile, AnalysisError> {
    if audio.samples.is_empty() {
        return Err(AnalysisError::EmptyAudio);
    }

    // Feed channels natively: BS.1770 sums channel powers, so mono-downmixing
    // stereo first would misread correlated content. Only >2ch material —
    // rare in DJ libraries — is downmixed to stereo before measuring.
    let (samples, channels): (&[f32], u32) = match audio.channels {
        1 | 2 => (&audio.samples, audio.channels as u32),
        _ => (
            &to_stereo(&audio.samples, audio.channels).map_err(AnalysisError::Normalization)?,
            2,
        ),
    };

    let mut meter = EbuR128::new(
        channels,
        audio.sample_rate,
        Mode::I | Mode::LRA | Mode::TRUE_PEAK,
    )
    .map_err(|e| AnalysisError::Loudness(e.to_string()))?;
    meter
        .add_frames_f32(samples)
        .map_err(|e| AnalysisError::Loudness(e.to_string()))?;

    let integrated = meter
        .loudness_global()
        .map_err(|e| AnalysisError::Loudness(e.to_string()))?;
    let range = meter
        .loudness_range()
        .map_err(|e| AnalysisError::Loudness(e.to_string()))?;
    let mut true_peak = f64::NEG_INFINITY;
    for ch in 0..channels {
        let peak = meter
            .true_peak(ch)
            .map_err(|e| AnalysisError::Loudness(e.to_string()))?;
        true_peak = true_peak.max(20.0 * peak.log10());
    }

    Ok(LoudnessProfile {
        integrated_lufs: floor_loudness(integrated),
        true_peak_dbtp: floor_loudness(true_peak),
        loudness_range_lu: sanitize_range(range),
        pipeline_version: LOUDNESS_PIPELINE_VERSION,
    })
}

/// Maps a crate dB-domain result onto the finite output domain: non-finite
/// or below-floor values become [`SILENCE_FLOOR`] (the BS.1770 absolute gate,
/// so nothing measurable sits below it anyway).
fn floor_loudness(db: f64) -> f32 {
    if db.is_finite() {
        db.max(SILENCE_FLOOR as f64) as f32
    } else {
        SILENCE_FLOOR
    }
}

/// Maps a crate loudness-range result onto the finite output domain:
/// non-finite values (silence, or audio too short for a short-term
/// distribution) become 0.0.
fn sanitize_range(lu: f64) -> f32 {
    if lu.is_finite() {
        lu.max(0.0) as f32
    } else {
        0.0
    }
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

    #[test]
    fn empty_audio_returns_error() {
        let audio = mono_audio(Vec::new(), 44100);
        let res = detect_loudness(&audio);
        assert!(matches!(res, Err(AnalysisError::EmptyAudio)));
    }

    #[test]
    fn silent_audio_floors_to_minus_seventy() {
        // Digital silence produces no gated blocks: integrated and true peak
        // must land on the spec-anchored -70 floor, LRA on 0.
        let audio = mono_audio(vec![0.0f32; 44100], 44100);
        let profile = detect_loudness(&audio).expect("profile");

        assert_eq!(profile.integrated_lufs, SILENCE_FLOOR);
        assert_eq!(profile.true_peak_dbtp, SILENCE_FLOOR);
        assert_eq!(profile.loudness_range_lu, 0.0);
        assert_eq!(profile.pipeline_version, LOUDNESS_PIPELINE_VERSION);
    }

    #[test]
    fn pipeline_version_is_semverish() {
        // House format: "name.major.minor.patch" (as in bpm.1.0.0, vocal.1.0.0).
        let parts: Vec<&str> = LOUDNESS_PIPELINE_VERSION.split('.').collect();
        assert_eq!(
            parts.len(),
            4,
            "expected loudness.X.Y.Z, got {LOUDNESS_PIPELINE_VERSION}"
        );
        assert_eq!(parts[0], "loudness");
        assert!(
            parts[1..].iter().all(|p| p.parse::<u32>().is_ok()),
            "numeric version components expected in {LOUDNESS_PIPELINE_VERSION}"
        );
    }

    #[test]
    fn sine_known_lufs() {
        // Spec anchor: a full-scale 1 kHz sine measures -3.01 LUFS, so an
        // amplitude-0.1 sine must read -23.01 LUFS (K-weighting is ~0 dB at
        // 1 kHz). Pins K-weighting + gating end-to-end.
        let sr = 44100u32;
        let audio = mono_audio(sine_signal(1000.0, 4.0, sr, 0.1), sr);

        let profile = detect_loudness(&audio).expect("profile");
        assert!(
            (profile.integrated_lufs - -23.01).abs() < 0.25,
            "expected ~-23.01 LUFS, got {}",
            profile.integrated_lufs
        );
    }

    #[test]
    fn correlated_stereo_is_three_lu_louder_than_mono() {
        // BS.1770 sums channel powers: identical L=R content measures
        // mono + 3.01 LU. Feeding a mono downmix instead would misread by
        // ~9 LU, so this test pins native-channel feeding.
        let sr = 44100u32;
        let tone = sine_signal(1000.0, 4.0, sr, 0.1);
        let mono = detect_loudness(&mono_audio(tone.clone(), sr)).expect("mono");
        let stereo = detect_loudness(&stereo_audio(tone.clone(), tone, sr)).expect("stereo");

        let delta = stereo.integrated_lufs - mono.integrated_lufs;
        assert!(
            (delta - 3.01).abs() < 0.25,
            "expected stereo ~mono+3.01 LU, got delta {delta}"
        );
    }

    #[test]
    fn relative_gate_excludes_quiet_section() {
        // 8 s loud + 8 s 40 dB quieter: the quiet half sits below the
        // relative gate (-10 LU under the running integrated), so gated
        // integration must match a constant-loud reference, not the average.
        let sr = 44100u32;
        let mut loud = sine_signal(1000.0, 8.0, sr, 0.5);
        loud.extend(sine_signal(1000.0, 8.0, sr, 0.005));
        let gated = detect_loudness(&mono_audio(loud, sr)).expect("gated");

        let reference = sine_signal(1000.0, 8.0, sr, 0.5);
        let constant = detect_loudness(&mono_audio(reference, sr)).expect("constant");

        assert!(
            (gated.integrated_lufs - constant.integrated_lufs).abs() < 0.5,
            "quiet section should be gated out: gated {} vs constant {}",
            gated.integrated_lufs,
            constant.integrated_lufs
        );
    }

    #[test]
    fn constant_sine_has_near_zero_lra() {
        let sr = 44100u32;
        let audio = mono_audio(sine_signal(1000.0, 8.0, sr, 0.3), sr);

        let profile = detect_loudness(&audio).expect("profile");
        assert!(
            profile.loudness_range_lu < 0.5,
            "constant sine LRA should be ~0, got {}",
            profile.loudness_range_lu
        );
    }

    #[test]
    fn two_level_track_has_positive_lra() {
        // 8 s at -9 LUFS + 8 s at -29 LUFS: the short-term distribution is
        // bimodal, so LRA must span the ~20 LU step (EBU Tech 3342).
        let sr = 44100u32;
        let mut track = sine_signal(1000.0, 8.0, sr, 0.5);
        track.extend(sine_signal(1000.0, 8.0, sr, 0.05));

        let profile = detect_loudness(&mono_audio(track, sr)).expect("profile");
        assert!(
            profile.loudness_range_lu > 10.0,
            "two-level track LRA should exceed 10 LU, got {}",
            profile.loudness_range_lu
        );
    }

    #[test]
    fn true_peak_of_full_scale_sine() {
        // 1 kHz barely clips 1.0; at 44.1 kHz its inter-sample peak is
        // within millidB of the sample peak, so dBTP ~= -0.01.
        let sr = 44100u32;
        let audio = mono_audio(sine_signal(1000.0, 4.0, sr, 0.999), sr);

        let profile = detect_loudness(&audio).expect("profile");
        assert!(
            (profile.true_peak_dbtp - -0.01).abs() < 0.2,
            "expected ~-0.01 dBTP, got {}",
            profile.true_peak_dbtp
        );
    }

    #[test]
    fn inter_sample_overshoot_detects_above_sample_peak() {
        // Alternating-sample sequences reconstruct above their sample peak
        // (the canonical true-peak probe); the meter's oversampled detector
        // must catch what sample peaks miss.
        let sr = 44100u32;
        let n = 2 * sr as usize;
        let alternating: Vec<f32> = (0..n)
            .map(|i| if i % 2 == 0 { 0.8 } else { -0.8 })
            .collect();
        let audio = mono_audio(alternating, sr);

        let profile = detect_loudness(&audio).expect("profile");
        let sample_peak_db = 20.0 * 0.8f64.log10();
        assert!(
            profile.true_peak_dbtp > sample_peak_db as f32 + 0.1,
            "true peak {} dBTP should clearly exceed sample peak {} dBFS",
            profile.true_peak_dbtp,
            sample_peak_db
        );
    }

    #[test]
    fn real_flac_fixture_runs_end_to_end() {
        // 42 ms stereo fixture: sub-block audio must still produce a finite
        // profile through decode -> native stereo feed -> meter -> floors.
        // (Golden loudness fixtures with musical length arrive with T1.2.6.)
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("fixtures")
            .join("audio")
            .join("flac/tagged-techno-140.flac");
        let audio = crate::decoder::decode_audio_file(&path).expect("fixture should decode");

        let profile = detect_loudness(&audio).expect("profile");
        assert_eq!(profile.pipeline_version, LOUDNESS_PIPELINE_VERSION);
        assert!(
            profile.integrated_lufs >= SILENCE_FLOOR && profile.integrated_lufs <= 5.0,
            "integrated {} out of plausible range",
            profile.integrated_lufs
        );
        assert!(
            profile.true_peak_dbtp >= SILENCE_FLOOR && profile.true_peak_dbtp <= 6.0,
            "true peak {} out of plausible range",
            profile.true_peak_dbtp
        );
        assert!(
            (0.0..=60.0).contains(&profile.loudness_range_lu),
            "LRA {} out of plausible range",
            profile.loudness_range_lu
        );
    }
}
