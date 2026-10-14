//! Local analysis job queue + SQLite persistence (T1.2.1 / T1.2.2 / T1.2.3 / T1.2.4).
//!
//! `run_analysis_queue` drains a list of `(track_id, file_path)` pairs on a
//! background thread (mirroring `scanner::run_scan`): for each track it runs the
//! full deterministic analyzer suite via `dj_assistant_analysis::run_full_analysis`,
//! persists the result columns and the composite `analysis_version` stamp, then
//! emits an `analysis:progress` event per track and a single `analysis:completed`
//! event when the queue drains. The UI wires those to per-track rows and a
//! progress bar.

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Instant;

use dj_assistant_analysis::{
    analysis_version, classify_analysis_status, run_full_analysis, AnalysisResults,
};
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};

use crate::db::Database;
use crate::models::{AnalysisCompletedEvent, AnalysisProgressEvent};

/// Persists one track's analysis results to `tracks` and stamps the composite
/// `analysis_version`, setting `analysis_status` via [`classify_analysis_status`].
/// Mirrors `commands.rs::get_track`'s column set; the exact SQL is
/// contract-tested in `tests/schema`.
pub fn persist_analysis_results(
    conn: &Connection,
    track_id: &str,
    results: &AnalysisResults,
) -> rusqlite::Result<()> {
    let status = classify_analysis_status(results);
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE tracks SET
            bpm                 = ?,
            key_camelot         = ?,
            key_classical       = ?,
            loudness_lufs       = ?,
            vocal_presence      = ?,
            phrase_confidence   = ?,
            analysis_status     = ?,
            analysis_version    = ?,
            updated_at          = ?
         WHERE id = ?",
        rusqlite::params![
            results.bpm.map(f64::from),
            &results.key_camelot,
            &results.key_classical,
            results.loudness_lufs.map(f64::from),
            if results.vocal_presence { 1i64 } else { 0i64 },
            results.phrase_confidence.map(f64::from),
            status,
            &results.analysis_version,
            now,
            track_id,
        ],
    )?;
    Ok(())
}

/// Marks a track's analysis as failed, clears any stale feature columns, and
/// stamps the `analysis_version` that was attempted (so a later, successful run
/// is still detected as a version change).
pub fn persist_analysis_failure(
    conn: &Connection,
    track_id: &str,
    version: &str,
) -> rusqlite::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE tracks SET
            bpm                 = NULL,
            key_camelot         = NULL,
            key_classical       = NULL,
            loudness_lufs       = NULL,
            vocal_presence      = 0,
            phrase_confidence   = NULL,
            analysis_status     = 'failed',
            analysis_version    = ?,
            updated_at          = ?
         WHERE id = ?",
        rusqlite::params![version, now, track_id],
    )?;
    Ok(())
}

/// Runs analysis for every `(track_id, file_path)` pair on a background thread.
///
/// The caller is responsible for selecting tracks (version-skip / explicit list);
/// this worker only runs, persists, and reports.
pub fn run_analysis_queue(
    app: AppHandle,
    db: Arc<Mutex<Database>>,
    job_id: String,
    tracks: Vec<(String, String)>,
) {
    thread::spawn(move || {
        let start_time = Instant::now();
        let total = tracks.len();
        let mut succeeded = 0usize;
        let mut failed = 0usize;
        let current_version = analysis_version();

        for (index, (track_id, file_path)) in tracks.into_iter().enumerate() {
            let processed = index + 1;

            let (status, error) = match run_full_analysis(&file_path) {
                Ok(results) => {
                    let review_status = classify_analysis_status(&results).to_string();
                    let guard = match db.lock() {
                        Ok(g) => g,
                        Err(_) => break,
                    };
                    match persist_analysis_results(guard.conn(), &track_id, &results) {
                        Ok(_) => {
                            succeeded += 1;
                            (review_status.clone(), None)
                        }
                        Err(e) => {
                            failed += 1;
                            (
                                "failed".to_string(),
                                Some(format!("database persist error: {e}")),
                            )
                        }
                    }
                }
                Err(e) => {
                    let guard = match db.lock() {
                        Ok(g) => g,
                        Err(_) => break,
                    };
                    match persist_analysis_failure(guard.conn(), &track_id, &current_version) {
                        Ok(_) => {
                            failed += 1;
                            ("failed".to_string(), Some(format!("{e}")))
                        }
                        Err(db_err) => {
                            failed += 1;
                            (
                                "failed".to_string(),
                                Some(format!(
                                    "analysis failed ({e}); database persist error ({db_err})"
                                )),
                            )
                        }
                    }
                }
            };

            let _ = app.emit(
                "analysis:progress",
                AnalysisProgressEvent {
                    job_id: job_id.clone(),
                    processed,
                    total,
                    track_id: track_id.clone(),
                    file_path: file_path.clone(),
                    analysis_status: status.clone(),
                    error,
                },
            );
        }

        let _ = app.emit(
            "analysis:completed",
            AnalysisCompletedEvent {
                job_id,
                total,
                succeeded,
                failed,
                duration_ms: start_time.elapsed().as_millis(),
            },
        );
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use dj_assistant_analysis::PHRASE_CONFIDENCE_REVIEW_THRESHOLD;

    fn base_results() -> AnalysisResults {
        AnalysisResults {
            bpm: Some(128.0),
            key_camelot: Some("8A".to_string()),
            key_classical: Some("A minor".to_string()),
            loudness_lufs: Some(-8.0),
            vocal_presence: false,
            phrase_confidence: Some(0.75),
            analysis_version: "test".to_string(),
            errors: Vec::new(),
        }
    }

    #[test]
    fn complete_when_all_signals_present() {
        assert_eq!(classify_analysis_status(&base_results()), "complete");
    }

    #[test]
    fn needs_review_when_bpm_missing() {
        let mut r = base_results();
        r.bpm = None;
        assert_eq!(classify_analysis_status(&r), "needs_review");
    }

    #[test]
    fn needs_review_when_key_missing() {
        let mut r = base_results();
        r.key_camelot = None;
        assert_eq!(classify_analysis_status(&r), "needs_review");
    }

    #[test]
    fn needs_review_when_phrase_confidence_low() {
        let mut r = base_results();
        r.phrase_confidence = Some(0.1);
        assert_eq!(classify_analysis_status(&r), "needs_review");
    }

    #[test]
    fn needs_review_when_any_analyzer_errored() {
        let mut r = base_results();
        r.errors.push("bpm: no tempo established".to_string());
        assert_eq!(classify_analysis_status(&r), "needs_review");
    }

    #[test]
    fn phrase_confidence_at_threshold_is_complete() {
        let mut r = base_results();
        r.phrase_confidence = Some(PHRASE_CONFIDENCE_REVIEW_THRESHOLD);
        assert_eq!(classify_analysis_status(&r), "complete");
    }

    #[test]
    fn needs_review_when_phrase_confidence_none() {
        // phrase_confidence is None only on a hard detector error, but treat
        // it as review-worthy defensively.
        let mut r = base_results();
        r.phrase_confidence = None;
        assert_eq!(classify_analysis_status(&r), "needs_review");
    }
}
