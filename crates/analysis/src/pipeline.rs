//! Full-track analysis orchestration (T1.2.1).
//!
//! Composes the deterministic analyzers — BPM/beat grid (T1.1.3), key (T1.1.4),
//! phrase/structure (T1.1.5), vocal presence (T1.1.6), loudness (T1.1.7) — into a
//! single per-track pass and produces an [`AnalysisResults`] ready for SQLite
//! persistence (T1.2.3). Decoding uses Symphonia (`crate::decoder`); each
//! analyzer may resample/normalize internally, so the decoded buffer is passed
//! by reference and consumed by every detector.
//!
//! ## Degradation contract
//! Each detector degrades gracefully on its own: a per-analyzer error is
//! recorded in `AnalysisResults::errors` but does not abort the remaining
//! detectors, so one failure does not void every other result. Only a hard
//! failure to open/decode the file (or empty decoded audio) surfaces as `Err`.

use std::path::Path;

use crate::bpm::{detect_beat_grid, BeatGrid};
use crate::decoder::decode_audio_file;
use crate::error::AnalysisError;
use crate::key::detect_key;
use crate::loudness::detect_loudness;
use crate::phrase::detect_phrases;
use crate::version::analysis_version;
use crate::vocal::detect_vocal_presence;

/// A track is considered to have notable vocals when its mean vocal-band
///     presence reaches this value. Maps the `0..=1` [`crate::vocal::VocalProfile::presence`]
/// onto the boolean `tracks.vocal_presence` column (the implemented schema is
/// `INTEGER`; `DATA_MODEL.md` lists the column as `REAL 0–1` — a separate doc
/// reconciliation).
pub const VOCAL_PRESENCE_THRESHOLD: f32 = 0.5;

/// Results of a full analysis pass, mapped 1:1 to `tracks` columns (T1.2.3).
#[derive(Debug, Clone)]
pub struct AnalysisResults {
    /// `bpm` (from the beat grid). `None` when no tempo was established.
    pub bpm: Option<f32>,
    /// `key_camelot` (e.g. `"8A"`). `None` when no confident tonal centre.
    pub key_camelot: Option<String>,
    /// `key_classical` (e.g. `"A minor"`). `None` when no confident tonal centre.
    pub key_classical: Option<String>,
    /// `loudness_lufs` (EBU R128 integrated LUFS, floored at −70).
    pub loudness_lufs: Option<f32>,
    /// `vocal_presence` (0/1), derived from `VocalProfile::presence`.
    pub vocal_presence: bool,
    /// `phrase_confidence` (mean segment confidence, `0..=1`). `None` only on
    /// a hard detector error.
    pub phrase_confidence: Option<f32>,
    /// `analysis_version` — composite pipeline+model version stamped per track.
    pub analysis_version: String,
    /// Per-analyzer degradation notes (empty when every analyzer succeeded).
    pub errors: Vec<String>,
}

/// Runs the full deterministic analysis pipeline on one audio file.
///
/// Decode → BPM/beat grid → key → phrase (on the grid) → vocal presence →
/// loudness, then stamps the composite [`analysis_version`]. Returns the
/// per-track results ready for persistence; the caller maps them to `tracks`
/// columns and sets `analysis_status`.
pub fn run_full_analysis<P: AsRef<Path>>(path: P) -> Result<AnalysisResults, AnalysisError> {
    let audio = decode_audio_file(path)?;
    if audio.samples.is_empty() {
        return Err(AnalysisError::EmptyAudio);
    }

    let mut results = AnalysisResults {
        bpm: None,
        key_camelot: None,
        key_classical: None,
        loudness_lufs: None,
        vocal_presence: false,
        phrase_confidence: None,
        analysis_version: analysis_version(),
        errors: Vec::new(),
    };

    // 1. BPM + beat grid (phrase segmentation depends on this grid).
    let grid: Option<BeatGrid> = match detect_beat_grid(&audio, None) {
        Ok(g) => {
            if g.bpm > 0.0 {
                results.bpm = Some(g.bpm);
            } else {
                results
                    .errors
                    .push("bpm: no tempo established (bpm == 0.0)".to_string());
            }
            Some(g)
        }
        Err(e) => {
            results.errors.push(format!("bpm: {e}"));
            None
        }
    };

    // 2. Key (classical name + Camelot code).
    match detect_key(&audio, None) {
        Ok(k) => {
            results.key_camelot = k.key_camelot;
            results.key_classical = k.key_classical;
        }
        Err(e) => results.errors.push(format!("key: {e}")),
    }

    // 3. Phrase segmentation (uses the beat grid; degrades to an empty map).
    match detect_phrases(&audio, grid.as_ref(), None) {
        Ok(p) => {
            results.phrase_confidence = Some(p.confidence);
        }
        Err(e) => results.errors.push(format!("phrase: {e}")),
    }

    // 4. Vocal presence / density.
    match detect_vocal_presence(&audio, None) {
        Ok(v) => {
            results.vocal_presence = v.presence >= VOCAL_PRESENCE_THRESHOLD;
        }
        Err(e) => results.errors.push(format!("vocal: {e}")),
    }

    // 5. Loudness (EBU R128).
    match detect_loudness(&audio) {
        Ok(l) => {
            results.loudness_lufs = Some(l.integrated_lufs);
        }
        Err(e) => results.errors.push(format!("loudness: {e}")),
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// Path to the real FLAC fixture, matching the convention used across the
    /// `bpm`/`key`/`phrase`/`vocal`/`loudness` modules.
    fn fixture_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("fixtures")
            .join("audio")
            .join("flac/tagged-techno-140.flac")
    }

    #[test]
    fn full_analysis_on_flac_fixture_populates_results() {
        let results = run_full_analysis(fixture_path())
            .expect("full analysis of the FLAC fixture must succeed");

        // The composite version stamp is always present and matches the
        // canonical aggregation of per-analyzer pipeline versions.
        assert!(!results.analysis_version.is_empty());
        assert_eq!(results.analysis_version, analysis_version());

        // Loudness and phrase always return finite values for non-empty audio
        // (they degrade to the -70 LUFS floor / 0.0 confidence rather than
        // error), so these are populated whenever decode succeeds.
        assert!(
            results.loudness_lufs.is_some(),
            "loudness_lufs must be populated for non-empty audio; errors: {:?}",
            results.errors
        );
        assert!(
            results.phrase_confidence.is_some(),
            "phrase_confidence must be populated (degrades to 0.0, not None); errors: {:?}",
            results.errors
        );

        // BPM and key detection on real audio can degrade (tempo not established /
        // no tonal centre), which is recorded as a per-analyzer note, not a
        // pipeline failure. Print the full picture for anyone reading --nocapture.
        println!(
            "fixture analysis: bpm={:?} key_camelot={:?} key_classical={:?} \
             loudness={:?} vocal={} phrase_confidence={:?} errors={:?}",
            results.bpm,
            results.key_camelot,
            results.key_classical,
            results.loudness_lufs,
            results.vocal_presence,
            results.phrase_confidence,
            results.errors
        );
    }

    #[test]
    fn analysis_version_is_stamped_with_the_composite() {
        let results = run_full_analysis(fixture_path()).unwrap();
        let expected = analysis_version();
        assert_eq!(
            results.analysis_version, expected,
            "per-track analysis_version must equal the composite stamp"
        );
        assert!(!results.analysis_version.is_empty());
    }

    #[test]
    fn nonexistent_file_returns_decode_error() {
        let err = run_full_analysis("does/not/exist.flac");
        assert!(
            err.is_err(),
            "a missing file must surface as an error, not an AnalysisResults"
        );
        let e = err.unwrap_err();
        // AudioDecodeError::Io is wrapped as AnalysisError::Decode.
        assert!(
            matches!(e, AnalysisError::Decode(_)),
            "decode failure should be AnalysisError::Decode, got {e:?}"
        );
    }
}
