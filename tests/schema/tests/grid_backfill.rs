//! The beat-grid confidence backfill (issue #89), run against the real
//! migrated schema.
//!
//! `crates/core/src/grid_backfill.rs` owns the selection and the update; this
//! file executes them so the claims are proven, not assumed: only `complete`
//! rows at the current version are owed a value, only the confidence is
//! written, and a row that changed since it was selected is left alone.

use dj_assistant_core::grid_backfill::{GRID_BACKFILL_ROWS_SQL, GRID_BACKFILL_UPDATE_SQL};
use dj_assistant_schema_tests::open_migrated;
use rusqlite::Connection;

const CURRENT: &str = "bpm:bpm.1.0.0;key:key.1.0.0";
const OLDER: &str = "bpm:bpm.0.9.0;key:key.1.0.0";

fn seed(
    conn: &Connection,
    id: &str,
    status: &str,
    version: &str,
    confidence: Option<f64>,
    removed: bool,
) {
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, title, artist, \
         bpm, key_camelot, analysis_status, analysis_version, beatgrid_confidence, removed_at) \
         VALUES (?1, 'default', ?2, ?3, 1024, 'Title', 'Artist', 140.0, '8A', ?4, ?5, ?6, ?7)",
        rusqlite::params![
            id,
            format!("D:\\Music\\{id}.flac"),
            format!("hash-{id}"),
            status,
            version,
            confidence,
            removed.then_some("2026-11-20 10:00:00"),
        ],
    )
    .expect("track insert must succeed");
}

fn owed(conn: &Connection) -> Vec<(String, String, Option<f64>)> {
    let mut stmt = conn
        .prepare(GRID_BACKFILL_ROWS_SQL)
        .expect("the selection must prepare against the migrated schema");
    stmt.query_map([CURRENT], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .expect("the selection must run")
        .collect::<Result<Vec<_>, _>>()
        .expect("every row must read")
}

fn write(conn: &Connection, id: &str, confidence: f64) -> usize {
    conn.execute(
        GRID_BACKFILL_UPDATE_SQL,
        rusqlite::params![confidence, id, CURRENT],
    )
    .expect("the update must run")
}

fn library() -> Connection {
    let conn = open_migrated();
    seed(&conn, "owed-b", "complete", CURRENT, None, false);
    seed(&conn, "owed-a", "complete", CURRENT, None, false);
    seed(&conn, "has-value", "complete", CURRENT, Some(0.7), false);
    seed(&conn, "older-version", "complete", OLDER, None, false);
    seed(&conn, "review", "needs_review", CURRENT, None, false);
    seed(&conn, "failed", "failed", CURRENT, None, false);
    seed(&conn, "removed", "complete", CURRENT, None, true);
    conn
}

#[test]
fn only_complete_rows_at_the_current_version_without_a_value_are_owed() {
    let conn = library();
    let ids: Vec<String> = owed(&conn).into_iter().map(|(id, _, _)| id).collect();
    // The others are either filled, still queued for a full analysis, or gone.
    assert_eq!(ids, ["owed-a", "owed-b"]);
}

#[test]
fn the_selection_carries_the_path_and_the_stored_bpm() {
    let conn = library();
    let (_, path, bpm) = owed(&conn).remove(0);
    assert_eq!(path, "D:\\Music\\owed-a.flac");
    assert_eq!(bpm, Some(140.0));
}

#[test]
fn the_update_writes_only_the_confidence() {
    let conn = library();
    assert_eq!(write(&conn, "owed-a", 0.82), 1);
    let row: (Option<f64>, Option<f64>, String, String) = conn
        .query_row(
            "SELECT beatgrid_confidence, bpm, key_camelot, analysis_version \
             FROM tracks WHERE id = 'owed-a'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .unwrap();
    assert_eq!(
        row,
        (
            Some(0.82),
            Some(140.0),
            "8A".to_string(),
            CURRENT.to_string()
        )
    );
    // Filled rows leave the selection, so a second pass is a no-op.
    let ids: Vec<String> = owed(&conn).into_iter().map(|(id, _, _)| id).collect();
    assert_eq!(ids, ["owed-b"]);
}

#[test]
fn the_update_leaves_a_row_that_changed_since_it_was_selected() {
    let conn = library();
    // A full analysis got there first and stored its own value.
    conn.execute(
        "UPDATE tracks SET beatgrid_confidence = 0.4 WHERE id = 'owed-a'",
        [],
    )
    .unwrap();
    assert_eq!(write(&conn, "owed-a", 0.9), 0);
    // A row re-stamped by a newer analysis, and a row removed meanwhile.
    conn.execute(
        "UPDATE tracks SET analysis_version = 'newer' WHERE id = 'owed-b'",
        [],
    )
    .unwrap();
    assert_eq!(write(&conn, "owed-b", 0.9), 0);
    assert_eq!(write(&conn, "removed", 0.9), 0);
    // And every row outside the selection is refused too.
    for id in ["has-value", "older-version", "review", "failed"] {
        assert_eq!(write(&conn, id, 0.9), 0, "{id}");
    }
    let kept: Option<f64> = conn
        .query_row(
            "SELECT beatgrid_confidence FROM tracks WHERE id = 'owed-a'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(kept, Some(0.4));
}
