//! The artwork backfill, executed against the real migrated schema.
//!
//! `crates/core/src/artwork_backfill.rs` holds the SQL as data and never runs
//! it, so on its own it only proves that a string contains a substring. This is
//! where the two claims get tested as behaviour:
//!
//! * the candidate query prepares on both schema shapes and selects exactly the
//!   rows still missing artwork;
//! * the write lands in `artwork_hash` / `artwork_path` / `artwork_mime` and
//!   nowhere else — not even `updated_at`.
//!
//! Both halves run the statements `core` built, not a paraphrase of them.

use std::collections::HashMap;
use std::path::PathBuf;

use dj_assistant_core::artwork_backfill::{candidates_sql, plan_artwork_write};
use dj_assistant_core::library_schema::LibrarySchema;
use dj_assistant_core::{CachedArtwork, WriteValue};
use dj_assistant_schema_tests::{open_migrated, open_migrated_through, seed_track};
use rusqlite::types::Value;
use rusqlite::{params, Connection};

/// Binds a core value the way the desktop executor does.
fn bind(value: &WriteValue) -> Value {
    match value {
        WriteValue::Null => Value::Null,
        WriteValue::Text(text) => Value::Text(text.clone()),
        WriteValue::Int(number) => Value::Integer(*number),
    }
}

/// Runs a statement core built, exactly as the desktop executor does.
fn execute(conn: &Connection, stmt: &dj_assistant_core::WriteStatement) -> usize {
    let bound: Vec<Value> = stmt.params.iter().map(bind).collect();
    conn.execute(&stmt.sql, rusqlite::params_from_iter(bound.iter()))
        .unwrap_or_else(|e| panic!("core statement must run as built: {e}\n{}", stmt.sql))
}

/// The library rows a backfill run would pick up, in the order it would take them.
fn candidates(conn: &Connection, schema: &LibrarySchema) -> Vec<(String, String)> {
    let sql = candidates_sql(schema);
    let mut stmt = conn
        .prepare(&sql)
        .unwrap_or_else(|e| panic!("the candidate query must prepare: {e}\n{sql}"));
    stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap_or_else(|e| panic!("the candidate query must run: {e}\n{sql}"))
        .map(|row| row.expect("candidate row must read"))
        .collect()
}

/// Every column of one track, as SQLite holds it.
fn snapshot(conn: &Connection, id: &str) -> HashMap<String, Value> {
    let mut stmt = conn
        .prepare("SELECT * FROM tracks WHERE id = ?1")
        .expect("tracks row must be readable");
    let names: Vec<String> = (0..stmt.column_count())
        .map(|index| stmt.column_name(index).expect("column name").to_string())
        .collect();
    let values: Vec<Value> = stmt
        .query_row(params![id], |row| {
            (0..names.len())
                .map(|index| row.get::<_, Value>(index))
                .collect()
        })
        .expect("the seeded track must be there");
    names.into_iter().zip(values).collect()
}

/// A second track, distinct by hash so the dedup constraint stays out of the way.
fn seed_other(conn: &Connection, id: &str) {
    conn.execute(
        "INSERT INTO tracks (
            id, workspace_id, file_path, file_hash, file_size, duration_ms, format,
            title, artist, analysis_status, created_at, updated_at
        ) VALUES (?1, 'default', ?2, ?1, 2048, 180_000, 'mp3', 'Second', 'Artist', 'pending',
                  '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![id, format!(r"D:\Music\{id}.mp3")],
    )
    .expect("second track insert must succeed");
}

fn cached(id: &str) -> CachedArtwork {
    CachedArtwork {
        hash: id.repeat(32),
        path: PathBuf::from(format!(r"C:\cache\{}.jpg", id.repeat(32))),
        mime_type: "image/jpeg".to_string(),
    }
}

#[test]
fn the_candidate_query_runs_and_carries_the_path_the_job_needs() {
    let conn = open_migrated();
    seed_track(&conn);

    let found = candidates(&conn, &LibrarySchema::CURRENT);
    assert_eq!(
        found,
        vec![("track-1".to_string(), r"D:\Music\track.mp3".to_string())],
        "an empty artwork slot is exactly one candidate, with the file to read"
    );
}

#[test]
fn a_track_that_already_has_artwork_is_never_a_candidate() {
    // The idempotence rule: a second run, or a re-run after the user picked
    // their own cover, must not overwrite it.
    let conn = open_migrated();
    let id = seed_track(&conn);
    seed_other(&conn, "track-2");
    execute(&conn, &plan_artwork_write("track-2", &cached("2")));

    let found: Vec<String> = candidates(&conn, &LibrarySchema::CURRENT)
        .into_iter()
        .map(|(id, _)| id)
        .collect();
    assert_eq!(found, vec![id], "only the empty slot is offered");
}

#[test]
fn a_soft_removed_track_is_not_a_candidate() {
    let conn = open_migrated();
    seed_track(&conn);
    seed_other(&conn, "track-2");
    conn.execute(
        "UPDATE tracks SET removed_at = '2026-11-01 10:00:00' WHERE id = 'track-2'",
        [],
    )
    .expect("the removal stamp must apply");

    let found: Vec<String> = candidates(&conn, &LibrarySchema::CURRENT)
        .into_iter()
        .map(|(id, _)| id)
        .collect();
    assert_eq!(found, vec!["track-1".to_string()]);
}

#[test]
fn the_write_fills_the_artwork_columns_and_nothing_else() {
    let conn = open_migrated();
    let id = seed_track(&conn);
    let artwork = cached("a");
    let before = snapshot(&conn, &id);

    let changed = execute(&conn, &plan_artwork_write(&id, &artwork));
    assert_eq!(changed, 1, "one candidate, one row");

    let after = snapshot(&conn, &id);
    let mut touched: Vec<&str> = before
        .keys()
        .filter(|column| before[*column] != after[*column])
        .map(String::as_str)
        .collect();
    touched.sort_unstable();
    assert_eq!(
        touched,
        vec!["artwork_hash", "artwork_mime", "artwork_path"],
        "a backfill is not an edit: title, rating, comments and updated_at must survive"
    );
    assert_eq!(after["artwork_hash"], Value::Text(artwork.hash.clone()));
    assert_eq!(
        after["artwork_path"],
        Value::Text(artwork.path.to_string_lossy().into_owned())
    );
    assert_eq!(
        after["artwork_mime"],
        Value::Text(artwork.mime_type.clone())
    );
}

#[test]
fn a_second_run_finds_nothing_left_to_do() {
    let conn = open_migrated();
    let id = seed_track(&conn);
    execute(&conn, &plan_artwork_write(&id, &cached("b")));
    assert!(
        candidates(&conn, &LibrarySchema::CURRENT).is_empty(),
        "a filled slot must drop out of the query, which is what makes a re-run safe"
    );

    let after_first = snapshot(&conn, &id);
    execute(&conn, &plan_artwork_write(&id, &cached("b")));
    assert_eq!(
        snapshot(&conn, &id),
        after_first,
        "the same content written twice is a no-op"
    );
}

#[test]
fn the_query_prepares_on_a_database_older_than_the_removal_column() {
    // Issue #61's shape: a snapshot taken before migration 008 must stay
    // readable, which is why the query is built per schema and not hardcoded.
    let conn = open_migrated_through(7);
    seed_track(&conn);

    let found = candidates(&conn, &LibrarySchema::PRE_REMOVAL);
    assert_eq!(
        found,
        vec![("track-1".to_string(), r"D:\Music\track.mp3".to_string())],
        "a pre-008 library has nothing soft-removed, so every empty slot is a candidate"
    );
}
