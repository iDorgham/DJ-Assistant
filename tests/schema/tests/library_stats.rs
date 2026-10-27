//! Contract tests for the library summary statements.
//!
//! `crates/core/src/library_stats.rs` holds the SQL behind the headless
//! `dj-query --stats` mode. The statements live in the core crate (no database
//! dependency there), so this crate is where they are executed against a real
//! migrated schema — the same place the list-query contract is verified.
//!
//! The point of these tests is that the summary and the list must never
//! disagree: `dj-query --stats` and `dj-query --status complete` have to count
//! the same rows.

use dj_assistant_core::library_query::{TrackFilters, TrackQuery};
use dj_assistant_core::library_schema::LibrarySchema;
use dj_assistant_core::library_stats::{stat_queries, status_breakdown_sql};
use dj_assistant_schema_tests::open_migrated;
use rusqlite::{params, Connection};

/// Inserts one track with a controllable analysis state.
#[allow(clippy::too_many_arguments)]
fn insert_track(
    conn: &Connection,
    id: &str,
    workspace: &str,
    hash: &str,
    status: &str,
    bpm: Option<f64>,
    key: Option<&str>,
    rating: Option<i64>,
) {
    conn.execute(
        "INSERT INTO tracks (
            id, workspace_id, file_path, file_hash, file_size, duration_ms, format,
            title, artist, album, genre, year, bpm, key_camelot, analysis_status,
            user_rating, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, 1024, 240000, 'mp3', ?5, 'Test Artist',
                  'Test Album', 'House', 2024, ?6, ?7, ?8, ?9, '2026-01-01T00:00:00Z',
                  '2026-01-01T00:00:00Z')",
        params![
            id,
            workspace,
            format!("D:\\Music\\{id}.mp3"),
            hash,
            format!("Title {id}"),
            bpm,
            key,
            status,
            rating
        ],
    )
    .expect("track insert must succeed");
}

/// A library with one of everything the summary counts.
fn seeded() -> Connection {
    let conn = open_migrated();
    // A second workspace: the schema's `unique_hash_per_workspace` constraint
    // makes a duplicate *within* a workspace impossible, so the duplicate stats
    // can only be exercised across two.
    conn.execute(
        "INSERT INTO workspaces (id, name) VALUES ('second', 'Second Library')",
        [],
    )
    .expect("workspace insert must succeed");
    // complete, with bpm, key and a rating
    insert_track(
        &conn,
        "t1",
        "default",
        "hash-1",
        "complete",
        Some(124.0),
        Some("8A"),
        Some(4),
    );
    // complete, no bpm, no key, no rating
    insert_track(
        &conn, "t2", "default", "hash-2", "complete", None, None, None,
    );
    // pending
    insert_track(
        &conn, "t3", "default", "hash-3", "pending", None, None, None,
    );
    // needs_review, blank key
    insert_track(
        &conn,
        "t4",
        "default",
        "hash-4",
        "needs_review",
        Some(128.0),
        Some("  "),
        Some(2),
    );
    // failed
    insert_track(&conn, "t5", "default", "hash-5", "failed", None, None, None);
    // the same content in another workspace: one duplicate group, two files
    insert_track(
        &conn,
        "t6",
        "second",
        "hash-1",
        "complete",
        Some(124.0),
        Some("8A"),
        Some(5),
    );
    conn
}

/// Runs one summary statement and returns its count.
fn count(conn: &Connection, key: &str) -> i64 {
    let stat = stat_queries(&LibrarySchema::CURRENT)
        .into_iter()
        .find(|stat| stat.key == key)
        .unwrap_or_else(|| panic!("stat {key} must exist"));
    conn.query_row(&stat.sql, [], |row| row.get(0))
        .unwrap_or_else(|e| panic!("stat {key} must run: {e}"))
}

/// Runs the production status-breakdown statement and returns its rows.
///
/// The statement is executed as exported — a copy of the SQL inside the test
/// would keep passing when the real statement drifts.
fn status_breakdown(conn: &Connection) -> Vec<(String, i64)> {
    let sql = status_breakdown_sql(&LibrarySchema::CURRENT);
    let mut stmt = conn.prepare(&sql).expect("status breakdown must prepare");
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .expect("status breakdown must run");
    rows.flatten().collect()
}

/// The list query's own count, for the same filter the summary uses.
fn list_count(conn: &Connection, status: &str) -> i64 {
    let built = TrackQuery {
        filters: TrackFilters {
            analysis_status: vec![status.to_string()],
            ..Default::default()
        },
        ..Default::default()
    }
    .build("id", 1000, 0)
    .expect("query must build");

    let params: Vec<rusqlite::types::Value> = built
        .params
        .iter()
        .map(|param| match param {
            dj_assistant_core::library_query::QueryParam::Text(value) => {
                rusqlite::types::Value::Text(value.clone())
            }
            dj_assistant_core::library_query::QueryParam::Int(value) => {
                rusqlite::types::Value::Integer(*value)
            }
            dj_assistant_core::library_query::QueryParam::Real(value) => {
                rusqlite::types::Value::Real(*value)
            }
        })
        .collect();
    let count_params = &params[..params.len().saturating_sub(2)];
    conn.query_row(
        &built.count_sql,
        rusqlite::params_from_iter(count_params.iter()),
        |row| row.get(0),
    )
    .expect("list count must run")
}

#[test]
fn total_counts_every_imported_track() {
    let conn = seeded();
    assert_eq!(count(&conn, "total"), 6);
}

#[test]
fn analyzed_counts_only_complete_tracks() {
    let conn = seeded();
    assert_eq!(count(&conn, "analyzed"), 3);
}

#[test]
fn missing_bpm_and_key_cover_null_and_blank_values() {
    let conn = seeded();
    // t2 (both null), t3 (both null), t5 (both null) -> 3
    assert_eq!(count(&conn, "missing_bpm"), 3);
    // t2, t3, t5 null plus t4 blank -> 4
    assert_eq!(count(&conn, "missing_key"), 4);
}

#[test]
fn unrated_counts_tracks_without_a_star_rating() {
    let conn = seeded();
    assert_eq!(count(&conn, "unrated"), 3);
}

#[test]
fn duplicate_counts_group_by_file_hash() {
    let conn = seeded();
    // t1 and t6 share hash-1: one group, two files.
    assert_eq!(count(&conn, "duplicate_groups"), 1);
    assert_eq!(count(&conn, "duplicate_files"), 2);
}

#[test]
fn status_breakdown_sums_to_the_total() {
    let conn = seeded();
    let breakdown = status_breakdown(&conn);

    let sum: i64 = breakdown.iter().map(|(_, count)| count).sum();
    assert_eq!(sum, count(&conn, "total"));

    let complete = breakdown
        .iter()
        .find(|(status, _)| status == "complete")
        .map(|(_, count)| *count)
        .expect("complete must appear in the breakdown");
    assert_eq!(complete, count(&conn, "analyzed"));
}

#[test]
fn the_summary_and_the_list_agree_on_the_same_tracks() {
    let conn = seeded();
    let breakdown = status_breakdown(&conn);

    for status in ["complete", "pending", "needs_review", "failed"] {
        let from_list = list_count(&conn, status);
        // The breakdown row of the very statement `dj-query --stats` prints.
        // A status that is missing from the breakdown means zero rows, so a
        // drift in the production statement shows up as a mismatch here.
        let from_stats = breakdown
            .iter()
            .find(|(breakdown_status, _)| breakdown_status == status)
            .map(|(_, count)| *count)
            .unwrap_or(0);
        assert_eq!(
            from_list, from_stats,
            "list and summary disagree about {status}"
        );
    }
}
