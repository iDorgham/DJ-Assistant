//! Issue #61, end to end: the `dj-query` binary against a library that predates
//! migration 008.
//!
//! `tests/schema/tests/cli_migration_tolerance.rs` proves the *statements* work;
//! it hands a schema to the builders itself. What that cannot see is the half the
//! CLI owns: reading the schema of an actual file, deciding the shape from it, and
//! warning about the degradation. A CLI that always passed `LibrarySchema::CURRENT`
//! would leave every one of those tests green and still ship the bug.
//!
//! So this drives the real binary and reads what it prints.
//!
//! `dj-query` is built only with the `cli` feature, so this target is too:
//!
//! ```text
//! cargo test -p dj-assistant-core --features cli
//! ```

use std::path::PathBuf;
use std::process::Command;

use rusqlite::{params, Connection};

const MIGRATION_001: &str =
    include_str!("../../../apps/desktop/src-tauri/migrations/001_initial_schema.sql");
const MIGRATION_008: &str =
    include_str!("../../../apps/desktop/src-tauri/migrations/008_tracks_removed_at.sql");

/// The substring of the warning that says the read was degraded — and the only
/// thing a caller needs to know it must not trust the count as the app's own.
const WARNING: &str = "Database schema is outdated (missing 'removed_at' column)";

/// A two-track library at `versions`, in a per-process temp directory.
///
/// Written with rusqlite and closed before the CLI runs, so the file is left as
/// any snapshot is: a plain file the tool has to open read-only.
fn library(case: &str, migrations: &[&str], remove: Option<&str>) -> PathBuf {
    let dir =
        std::env::temp_dir().join(format!("dj-query-tolerance-{}-{case}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("temp directory must be creatable");
    let path = dir.join("dj_assistant.db");
    let _ = std::fs::remove_file(&path);

    let conn = Connection::open(&path).expect("a file-backed sqlite database");
    for sql in migrations {
        conn.execute_batch(sql)
            .expect("the migration must apply cleanly");
    }
    for id in ["t1", "t2"] {
        conn.execute(
            "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms, \
             format, title, artist, analysis_status, created_at, updated_at) \
             VALUES (?1, 'default', ?2, ?3, 1024, 240000, 'mp3', ?4, 'Artist', 'complete', \
                     '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![
                id,
                format!("D:\\Music\\{id}.mp3"),
                format!("hash-{id}"),
                format!("Title {id}")
            ],
        )
        .expect("track insert must succeed");
    }
    if let Some(id) = remove {
        conn.execute(
            "UPDATE tracks SET removed_at = '2026-01-03T00:00:00Z' WHERE id = ?1",
            [id],
        )
        .expect("soft remove must succeed");
    }
    drop(conn);
    path
}

/// Runs the built binary and returns `(stdout, stderr)`.
fn dj_query(args: &[&str]) -> (String, String) {
    let output = Command::new(env!("CARGO_BIN_EXE_dj-query"))
        .args(args)
        .output()
        .expect("dj-query must run");
    (
        String::from_utf8_lossy(&output.stdout).into_owned(),
        String::from_utf8_lossy(&output.stderr).into_owned(),
    )
}

#[test]
fn a_library_older_than_the_removal_migration_is_listed_with_a_warning() {
    let db = library("list", &[MIGRATION_001], None);
    let db_arg = db.to_string_lossy().to_string();
    let (stdout, stderr) = dj_query(&["--db", &db_arg, "--json"]);

    assert!(
        stderr.contains(WARNING),
        "a degraded read must say so on stderr, got: {stderr}"
    );
    let payload: serde_json::Value =
        serde_json::from_str(&stdout).expect("the warning must not break the JSON on stdout");
    assert_eq!(
        payload["total"].as_i64(),
        Some(2),
        "both tracks are listed instead of the read failing: {stdout}"
    );
    assert_eq!(payload["tracks"].as_array().map(Vec::len), Some(2));
}

#[test]
fn the_summary_and_the_drift_check_run_on_that_library() {
    let db = library("stats", &[MIGRATION_001], None);
    let db_arg = db.to_string_lossy().to_string();
    let (stdout, stderr) = dj_query(&["--db", &db_arg, "--stats", "--check-files", "--json"]);

    assert!(stderr.contains(WARNING), "the summary warns too: {stderr}");
    let payload: serde_json::Value =
        serde_json::from_str(&stdout).expect("the stats JSON must stay parseable");
    assert_eq!(payload["total"].as_i64(), Some(2));
    assert_eq!(payload["analyzed"].as_i64(), Some(2));
    assert_eq!(
        payload["by_status"]["complete"].as_i64(),
        Some(2),
        "the status breakdown must count the library it was given"
    );
    // The two files were never written, so the drift check has something to say —
    // proof the statement ran rather than returned nothing.
    assert_eq!(payload["missing_files"].as_i64(), Some(2));
}

#[test]
fn a_migrated_library_is_read_strictly_and_without_a_warning() {
    // The other half of the fix: detection must not degrade a database that can
    // answer the strict read, or a soft-removed track reappears.
    let db = library("current", &[MIGRATION_001, MIGRATION_008], Some("t2"));
    let db_arg = db.to_string_lossy().to_string();

    let (stdout, stderr) = dj_query(&["--db", &db_arg, "--json"]);
    assert!(
        !stderr.contains(WARNING),
        "a migrated library must not be warned about: {stderr}"
    );
    let payload: serde_json::Value = serde_json::from_str(&stdout).expect("valid JSON");
    assert_eq!(
        payload["total"].as_i64(),
        Some(1),
        "the removed track stays out of the list: {stdout}"
    );
    assert_eq!(payload["tracks"][0]["id"].as_str(), Some("t1"));

    let (stdout, _) = dj_query(&["--db", &db_arg, "--stats", "--json"]);
    let payload: serde_json::Value = serde_json::from_str(&stdout).expect("valid JSON");
    assert_eq!(payload["total"].as_i64(), Some(1));
}

#[test]
fn a_request_the_older_library_cannot_answer_is_still_refused() {
    // Tolerance is not a licence to answer a different question. Sorting by a
    // column the schema does not have stays an explicit refusal, exactly as
    // before this fix.
    let db = library("refuse", &[MIGRATION_001], None);
    let db_arg = db.to_string_lossy().to_string();
    let output = Command::new(env!("CARGO_BIN_EXE_dj-query"))
        .args(["--db", &db_arg, "--energy-min", "4"])
        .output()
        .expect("dj-query must run");

    assert!(!output.status.success(), "the request must be refused");
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    assert!(
        stderr.contains("no `energy` column"),
        "with the reason it was refused: {stderr}"
    );
}
