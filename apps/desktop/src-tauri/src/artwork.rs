//! The embedded-artwork backfill job: the thin executor around
//! `dj_assistant_core::artwork_backfill`.
//!
//! The rules — which rows are candidates, what one file yields, what gets
//! written — all live in `core` and are tested there and in
//! `tests/schema/tests/artwork_backfill.rs`. This file only owns what a Tauri
//! job owns: the database round trips, the worker thread and the progress
//! events. Keeping it that way is what lets the rules be verified on a box
//! where this crate's own test harness cannot load.
//!
//! A re-scan cannot fix a library imported before artwork caching: the
//! fingerprint matches an existing row, so the scanner reports the file as a
//! duplicate and never re-reads its tags. This job goes to the file directly.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use rusqlite::{types::Value, Connection};
use tauri::{AppHandle, Emitter};

use dj_assistant_core::artwork_backfill::{
    candidates_sql, extract_and_cache, plan_artwork_write, ArtworkSource, BackfillTally,
};
use dj_assistant_core::library_schema::LibrarySchema;
use dj_assistant_core::WriteValue;

use crate::db::Database;
use crate::models::{ArtworkBackfillCompletedEvent, ArtworkBackfillProgressEvent};

/// One backfill at a time. The writes are idempotent, so a second run is
/// wasted work rather than corrupt work — but on a large library it is a lot of
/// wasted file reads, and the button is easy to click twice.
static RUNNING: AtomicBool = AtomicBool::new(false);

/// Clears [`RUNNING`] when the worker thread ends, including on a panic.
struct RunSlot;

impl Drop for RunSlot {
    fn drop(&mut self) {
        RUNNING.store(false, Ordering::SeqCst);
    }
}

/// One row the run still has to look at.
pub struct Candidate {
    pub id: String,
    pub file_path: String,
}

/// The rows a backfill would fill, read once up front.
///
/// Read before the thread starts rather than streamed from it: the command's
/// response carries the count, so the progress events can be fractions from
/// the first file, and the database is not held open across thousands of file
/// reads. The schema shape is probed here rather than assumed — a library
/// migrated up to 008 has no `removed_at` to filter on (issue #61).
pub fn read_candidates(conn: &Connection) -> Result<Vec<Candidate>, String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(tracks)")
        .map_err(|e| format!("cannot read the library schema: {e}"))?;
    let columns: HashSet<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("cannot read the library schema: {e}"))?
        .flatten()
        .collect();

    let schema = LibrarySchema::from_columns(&columns);
    let sql = candidates_sql(&schema);
    let mut candidates = conn
        .prepare(&sql)
        .map_err(|e| format!("the candidate query must prepare: {e}"))?;
    let rows = candidates
        .query_map([], |row| {
            Ok(Candidate {
                id: row.get(0)?,
                file_path: row.get(1)?,
            })
        })
        .map_err(|e| format!("the candidate query must run: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("cannot read the candidates: {e}"))
}

/// Runs every candidate on a worker thread, emitting progress as it goes.
///
/// Errors are reported, never thrown: the run is already off the UI thread, and
/// one unreadable file must not abandon the rest of the library. A `write error`
/// is the one outcome `BackfillTally` cannot express — the file was readable and
/// its art was cached, but the row was not updated — so it is counted apart and
/// left out of the tally rather than recorded under a bucket that would misreport
/// it.
pub fn start(
    app: AppHandle,
    db: Arc<Mutex<Database>>,
    artwork_dir: PathBuf,
    job_id: String,
    candidates: Vec<Candidate>,
) -> Result<(), String> {
    if RUNNING.swap(true, Ordering::SeqCst) {
        return Err("An artwork backfill is already running.".to_string());
    }

    let total = candidates.len();
    std::thread::spawn(move || {
        let _slot = RunSlot;
        run(app, db, artwork_dir, job_id, candidates, total);
    });
    Ok(())
}

fn run(
    app: AppHandle,
    db: Arc<Mutex<Database>>,
    artwork_dir: PathBuf,
    job_id: String,
    candidates: Vec<Candidate>,
    total: usize,
) {
    let start_time = Instant::now();
    let mut tally = BackfillTally::default();
    let mut processed = 0usize;
    let mut write_errors = 0usize;

    for candidate in candidates {
        processed += 1;
        let source = extract_and_cache(Path::new(&candidate.file_path), &artwork_dir);

        if let ArtworkSource::Cached(artwork) = &source {
            let statement = plan_artwork_write(&candidate.id, artwork);
            let written = db
                .lock()
                .map_err(|_| "the database is unavailable".to_string())
                .and_then(|guard| execute(guard.conn(), &statement));
            if let Err(error) = written {
                write_errors += 1;
                emit_progress(
                    &app,
                    &job_id,
                    processed,
                    total,
                    &candidate.file_path,
                    Some(error),
                );
                continue;
            }
        }

        tally.record(&source);
        emit_progress(&app, &job_id, processed, total, &candidate.file_path, None);
    }

    let _ = app.emit(
        "artwork:completed",
        ArtworkBackfillCompletedEvent {
            job_id,
            total_scanned: tally.scanned as usize,
            total_filled: tally.filled as usize,
            without_art: tally.without_art as usize,
            missing_file: tally.missing_file as usize,
            unreadable: tally.unreadable as usize,
            write_errors,
            duration_ms: start_time.elapsed().as_millis(),
        },
    );
}

fn emit_progress(
    app: &AppHandle,
    job_id: &str,
    processed: usize,
    total: usize,
    current_path: &str,
    error: Option<String>,
) {
    let _ = app.emit(
        "artwork:progress",
        ArtworkBackfillProgressEvent {
            job_id: job_id.to_string(),
            processed,
            total,
            current_path: current_path.to_string(),
            error,
        },
    );
}

/// Runs a statement `core` built, binding every value like the other write paths.
fn execute(
    conn: &Connection,
    statement: &dj_assistant_core::WriteStatement,
) -> Result<usize, String> {
    let params: Vec<Value> = statement
        .params
        .iter()
        .map(|value| match value {
            WriteValue::Null => Value::Null,
            WriteValue::Text(text) => Value::Text(text.clone()),
            WriteValue::Int(number) => Value::Integer(*number),
        })
        .collect();

    conn.execute(&statement.sql, rusqlite::params_from_iter(params.iter()))
        .map_err(|e| format!("cannot record the artwork: {e}"))
}
