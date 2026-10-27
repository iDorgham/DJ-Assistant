//! Issue #61 — a library older than migration 008 must still be readable.
//!
//! `dj-query` runs the app's own statements, so on a database last opened
//! before `tracks.removed_at` existed every library read dies on
//! `no such column: removed_at` — the CLI, and any agent driving it, cannot
//! read the library at all. These tests pin both halves of the fix: the strict
//! read keeps hiding soft-removed tracks, and the degraded read runs on the
//! older schema while changing nothing except the removal predicate.
//!
//! The statements are executed exactly as the CLI gets them from `core`. A copy
//! of the SQL in here would keep passing when the real statement drifts.

use dj_assistant_core::library_query::{QueryParam, TrackFilters, TrackQuery};
use dj_assistant_core::library_reads::missing_file_paths_sql;
use dj_assistant_core::library_schema::LibrarySchema;
use dj_assistant_core::library_stats::{stat_queries, status_breakdown_sql};
use dj_assistant_schema_tests::{open_migrated, open_migrated_through, seed_track};
use rusqlite::Connection;

/// The columns `dj-query` asks for. Every one of them exists in migration 001,
/// so a failure here is about `removed_at` and never about a missing column the
/// CLI already handles with a `NULL AS <name>` fallback.
const LIST_COLUMNS: &str = "id, title, artist, bpm, analysis_status";

/// A library with two tracks, as the scanner would leave it.
///
/// Returns how many tracks it wrote, so the assertions read as "the whole
/// library" instead of a magic number.
fn seeded(conn: &Connection) -> usize {
    seed_track(conn);
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms, \
                            format, title, artist, genre, analysis_status, created_at, updated_at) \
         VALUES ('track-2', 'default', 'D:\\Music\\second.mp3', 'def456', 2048, 180000, 'mp3', \
                 'Second Title', 'Test Artist', 'Techno', 'complete', \
                 '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')",
        [],
    )
    .expect("second track insert must succeed");
    2
}

/// Does the `tracks` table have this column?
fn has_column(conn: &Connection, column: &str) -> bool {
    let mut stmt = conn
        .prepare("PRAGMA table_info(tracks)")
        .expect("table_info must be readable");
    let names: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .expect("table_info rows")
        .flatten()
        .collect();
    names.iter().any(|name| name == column)
}

/// The core parameters as SQLite values — the mapping the CLI and the desktop
/// command layer both do, so a test that forgets it is not proof of anything.
fn values(params: &[QueryParam]) -> Vec<rusqlite::types::Value> {
    params
        .iter()
        .map(|param| match param {
            QueryParam::Text(value) => rusqlite::types::Value::Text(value.clone()),
            QueryParam::Int(value) => rusqlite::types::Value::Integer(*value),
            QueryParam::Real(value) => rusqlite::types::Value::Real(*value),
        })
        .collect()
}

/// The library list, as `dj-query` builds and runs it.
fn list_count(conn: &Connection, schema: &LibrarySchema) -> Result<i64, rusqlite::Error> {
    let built = TrackQuery::default()
        .build_with(schema, LIST_COLUMNS, 100, 0)
        .expect("the list query must build");
    // The count statement carries the filter parameters only — limit and offset
    // belong to the page, exactly as `dj-query` splits them.
    let params = values(&built.params[..built.params.len() - 2]);
    conn.query_row(
        &built.count_sql,
        rusqlite::params_from_iter(params.iter()),
        |row| row.get(0),
    )
}

/// One summary count.
fn stat_count(
    conn: &Connection,
    schema: &LibrarySchema,
    key: &str,
) -> Result<i64, rusqlite::Error> {
    let sql = stat_queries(schema)
        .into_iter()
        .find(|stat| stat.key == key)
        .unwrap_or_else(|| panic!("stat {key} must exist"))
        .sql;
    conn.query_row(&sql, [], |row| row.get(0))
}

#[test]
fn a_library_older_than_the_removal_migration_has_no_removed_at_column() {
    // The precondition every test below leans on: migration 001 is what a
    // snapshot taken before the app was opened again looks like.
    let legacy = open_migrated_through(1);
    assert!(
        !has_column(&legacy, "removed_at"),
        "a migration-001 database must not carry `removed_at`"
    );
    assert!(has_column(&legacy, "title"), "it is still a library");

    let current = open_migrated();
    assert!(
        has_column(&current, "removed_at"),
        "the migrated schema must carry `removed_at` — otherwise this file tests nothing"
    );
}

#[test]
fn the_strict_read_fails_on_that_database() {
    // The bug as reported: not a panic, but an error out of SQLite that leaves
    // the CLI with nothing to show. Pinned so a "fix" that quietly stops
    // filtering removals on a migrated library is still caught by the tests in
    // `soft_remove.rs`.
    let conn = open_migrated_through(1);
    seeded(&conn);

    let error = list_count(&conn, &LibrarySchema::CURRENT)
        .expect_err("the strict read must fail without the column");
    assert!(
        error.to_string().contains("no such column: removed_at"),
        "unexpected failure: {error}"
    );

    let error = stat_count(&conn, &LibrarySchema::CURRENT, "total")
        .expect_err("the strict summary must fail without the column");
    assert!(
        error.to_string().contains("no such column: removed_at"),
        "unexpected failure: {error}"
    );
}

#[test]
fn the_degraded_read_lists_a_library_older_than_the_removal_migration() {
    let conn = open_migrated_through(1);
    let tracks = seeded(&conn);

    assert_eq!(
        list_count(&conn, &LibrarySchema::PRE_REMOVAL).expect("the degraded count must run"),
        tracks as i64
    );

    // …and the rows themselves, not only the count.
    let built = TrackQuery::default()
        .build_with(&LibrarySchema::PRE_REMOVAL, LIST_COLUMNS, 100, 0)
        .expect("the list query must build");
    let params = values(&built.params);
    let mut stmt = conn
        .prepare(&built.select_sql)
        .expect("the degraded SELECT must prepare");
    let titles: Vec<String> = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            row.get::<_, String>(1)
        })
        .expect("the degraded SELECT must run")
        .flatten()
        .collect();
    assert_eq!(titles.len(), tracks);
    assert!(titles.contains(&"Test Title".to_string()));
}

#[test]
fn the_degraded_read_keeps_every_filter_a_library_can_still_answer() {
    // Dropping the removal predicate must not drop the user's filters — the
    // warning says the schema is old, not that the library is unfilterable.
    let conn = open_migrated_through(1);
    seeded(&conn);
    conn.execute("UPDATE tracks SET bpm = 124 WHERE id = 'track-1'", [])
        .expect("bpm update must succeed");
    conn.execute("UPDATE tracks SET bpm = 128 WHERE id = 'track-2'", [])
        .expect("bpm update must succeed");

    let query = TrackQuery {
        filters: TrackFilters {
            bpm_min: Some(126.0),
            genre: vec!["techno".into()],
            ..Default::default()
        },
        ..Default::default()
    };
    let built = query
        .build_with(&LibrarySchema::PRE_REMOVAL, LIST_COLUMNS, 100, 0)
        .expect("the degraded query must build");
    let count_params = values(&built.params[..built.params.len() - 2]);
    let total: i64 = conn
        .query_row(
            &built.count_sql,
            rusqlite::params_from_iter(count_params.iter()),
            |row| row.get(0),
        )
        .expect("the degraded count must run");
    assert_eq!(total, 1, "the BPM and genre filters still narrow the list");
    assert!(
        !built.count_sql.contains("removed_at"),
        "no reference to the missing column may survive: {}",
        built.count_sql
    );
}

#[test]
fn every_degraded_summary_statement_runs_on_the_older_database() {
    let conn = open_migrated_through(1);
    let tracks = seeded(&conn);

    for stat in stat_queries(&LibrarySchema::PRE_REMOVAL) {
        assert!(
            !stat.sql.contains("removed_at"),
            "stat {} still names the missing column: {}",
            stat.key,
            stat.sql
        );
        conn.query_row(&stat.sql, [], |row| row.get::<_, i64>(0))
            .unwrap_or_else(|e| panic!("stat {} must run on a pre-008 library: {e}", stat.key));
    }

    assert_eq!(
        stat_count(&conn, &LibrarySchema::PRE_REMOVAL, "total")
            .expect("the degraded total must run"),
        tracks as i64
    );

    let sql = status_breakdown_sql(&LibrarySchema::PRE_REMOVAL);
    let mut stmt = conn
        .prepare(&sql)
        .expect("the degraded status breakdown must prepare");
    let breakdown: Vec<(String, i64)> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .expect("the degraded status breakdown must run")
        .flatten()
        .collect();
    assert_eq!(
        breakdown.iter().map(|(_, count)| count).sum::<i64>(),
        tracks as i64,
        "the breakdown still accounts for the whole library"
    );

    let sql = missing_file_paths_sql(&LibrarySchema::PRE_REMOVAL);
    let mut stmt = conn
        .prepare(&sql)
        .expect("the degraded missing-files statement must prepare");
    let paths: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .expect("the degraded missing-files statement must run")
        .flatten()
        .collect();
    assert_eq!(paths.len(), tracks, "every track is still checked on disk");
}

#[test]
fn the_degraded_read_only_differs_about_tracks_that_can_really_be_removed() {
    // The degraded shape is exact on an unmigrated database — without the
    // column, no track can have been taken away. This is the proof of that
    // claim, run on a *migrated* library where removals do exist: the strict
    // read hides the removed track, the degraded read shows it.
    let conn = open_migrated();
    let tracks = seeded(&conn);
    conn.execute(
        "UPDATE tracks SET removed_at = '2026-01-03T00:00:00Z' WHERE id = 'track-2'",
        [],
    )
    .expect("soft remove must succeed");

    assert_eq!(
        list_count(&conn, &LibrarySchema::CURRENT).expect("the strict count must run"),
        tracks as i64 - 1
    );
    assert_eq!(
        list_count(&conn, &LibrarySchema::PRE_REMOVAL).expect("the degraded count must run"),
        tracks as i64,
        "the degraded read is the one that shows a removed track — never use it \
         when the column exists"
    );
    assert_eq!(
        stat_count(&conn, &LibrarySchema::PRE_REMOVAL, "total")
            .expect("the degraded total must run"),
        tracks as i64
    );
}

#[test]
fn the_current_shape_is_the_one_the_app_reads() {
    // `build()` is what the desktop app calls, so it has to stay the strict
    // read. A default that drifted to the degraded shape would leak soft-
    // removed tracks into the Library view.
    let conn = open_migrated();
    let tracks = seeded(&conn);
    conn.execute(
        "UPDATE tracks SET removed_at = '2026-01-03T00:00:00Z' WHERE id = 'track-1'",
        [],
    )
    .expect("soft remove must succeed");

    let built = TrackQuery::default()
        .build(LIST_COLUMNS, 100, 0)
        .expect("the list query must build");
    let params = values(&built.params[..built.params.len() - 2]);
    let total: i64 = conn
        .query_row(
            &built.count_sql,
            rusqlite::params_from_iter(params.iter()),
            |row| row.get(0),
        )
        .expect("the strict count must run");
    assert_eq!(total, tracks as i64 - 1);
    assert_eq!(
        built.params,
        TrackQuery::default()
            .build_with(&LibrarySchema::CURRENT, LIST_COLUMNS, 100, 0)
            .expect("the current shape must build")
            .params
    );
}
