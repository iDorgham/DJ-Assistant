//! The Maintain reads (duplicates, versions, health) run against the real
//! migrated schema. `crates/core/src/library_hygiene.rs` holds the SQL; this is
//! where it executes, so a column the migrations do not have fails here
//! instead of in the running app.

use dj_assistant_core::dedup::ScanDeduplicator;
use dj_assistant_core::duplicates::{find_duplicate_groups, DEFAULT_DURATION_TOLERANCE_MS};
use dj_assistant_core::library_health::{compute_health, FileState, HealthContext};
use dj_assistant_core::library_hygiene::{
    HygieneRow, COPY_IS_RECORDED_SQL, DISMISSED_KEYS_SQL, DISMISS_GROUP_SQL, DUPLICATE_COPIES_SQL,
    FORGET_COPY_SQL, HASH_IN_WORKSPACE_SQL, HYGIENE_TRACKS_SQL, RECORD_COPY_SQL,
    RELOCATE_TRACK_SQL, SCAN_WORKSPACE, TRACK_BY_HASH_SQL,
};
use dj_assistant_core::versions::group_versions;
use dj_assistant_schema_tests::open_migrated;
use rusqlite::{params, Connection, OptionalExtension};

fn insert(conn: &Connection, id: &str, path: &str, hash: &str, title: &str, isrc: Option<&str>) {
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms,
            format, title, artist, isrc, analysis_status)
         VALUES (?1, 'default', ?2, ?3, 1, 300000, 'mp3', ?4, 'Artist', ?5, 'complete')",
        params![id, path, hash, title, isrc],
    )
    .expect("track insert");
}

fn read_rows(conn: &Connection) -> Vec<HygieneRow> {
    let mut stmt = conn
        .prepare(HYGIENE_TRACKS_SQL)
        .expect("hygiene read must prepare");
    stmt.query_map([], |row| {
        Ok(HygieneRow {
            id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            album: row.get(3)?,
            genre: row.get(4)?,
            year: row.get(5)?,
            label: row.get(6)?,
            mood: row.get(7)?,
            energy: row.get(8)?,
            bpm: row.get(9)?,
            key: row.get(10)?,
            analysis_status: row.get(11)?,
            isrc: row.get(12)?,
            mix_name: row.get(13)?,
            duration_ms: row.get(14)?,
            format: row.get(15)?,
            bitrate_kbps: row.get(16)?,
            file_path: row.get(17)?,
            has_tags: row.get(18)?,
            beatgrid_confidence: row.get(19)?,
        })
    })
    .expect("hygiene read must run")
    .map(|r| r.expect("row"))
    .collect()
}

#[test]
fn hygiene_read_skips_removed_tracks_and_sees_tags() {
    let conn = open_migrated();
    insert(&conn, "a", "/m/a.mp3", "h1", "Song", None);
    insert(&conn, "b", "/m/b.mp3", "h2", "Gone", None);
    conn.execute(
        "UPDATE tracks SET removed_at = datetime('now') WHERE id = 'b'",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO track_tags (track_id, tag) VALUES ('a', 'warmup')",
        [],
    )
    .unwrap();

    let rows = read_rows(&conn);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].id, "a");
    assert!(rows[0].has_tags);
}

#[test]
fn duplicate_and_version_groups_come_out_of_real_rows() {
    let conn = open_migrated();
    insert(
        &conn,
        "a",
        "/m/a.mp3",
        "h1",
        "Song (Radio Edit)",
        Some("GBAAA2400001"),
    );
    insert(
        &conn,
        "b",
        "/m/b.flac",
        "h2",
        "Song (Radio Edit)",
        Some("GBAAA2400001"),
    );
    insert(&conn, "c", "/m/c.mp3", "h3", "Song (Extended Mix)", None);

    let rows = read_rows(&conn);
    let dupes = find_duplicate_groups(
        &rows
            .iter()
            .map(HygieneRow::duplicate_input)
            .collect::<Vec<_>>(),
        DEFAULT_DURATION_TOLERANCE_MS,
    );
    assert_eq!(dupes.len(), 1);
    assert_eq!(dupes[0].track_ids, ["a", "b"]);

    let versions = group_versions(
        &rows
            .iter()
            .map(HygieneRow::version_input)
            .collect::<Vec<_>>(),
    );
    assert_eq!(versions.len(), 1);
    assert_eq!(versions[0].members.len(), 3);

    let health = compute_health(
        &rows
            .iter()
            .map(|r| r.health_track(FileState::Present))
            .collect::<Vec<_>>(),
        &HealthContext::default(),
    );
    assert_eq!(health.track_count, 3);
    assert!(health.score.is_some());
}

#[test]
fn copies_are_recorded_listed_repointed_and_forgotten() {
    let conn = open_migrated();
    insert(&conn, "a", "/m/a.mp3", "h1", "Song", None);

    let (id, path): (String, String) = conn
        .query_row(TRACK_BY_HASH_SQL, ["default", "h1"], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .expect("hash lookup");
    assert_eq!((id.as_str(), path.as_str()), ("a", "/m/a.mp3"));

    conn.execute(RECORD_COPY_SQL, params!["/backup/a.mp3", "a", "h1"])
        .unwrap();
    // Recording the same path again is an upsert, not a constraint error.
    conn.execute(RECORD_COPY_SQL, params!["/backup/a.mp3", "a", "h1"])
        .unwrap();

    let list = |conn: &Connection| -> Vec<(String, String)> {
        let mut stmt = conn.prepare(DUPLICATE_COPIES_SQL).unwrap();
        stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    };
    assert_eq!(
        list(&conn),
        [("/backup/a.mp3".to_string(), "a".to_string())]
    );

    // A removed track's copies leave the list with it.
    conn.execute(
        "UPDATE tracks SET removed_at = datetime('now') WHERE id = 'a'",
        [],
    )
    .unwrap();
    assert!(list(&conn).is_empty());
    conn.execute("UPDATE tracks SET removed_at = NULL WHERE id = 'a'", [])
        .unwrap();

    // Recording the same path against another track repoints it: the upsert
    // must replace track_id and file_hash, not keep the stale owner.
    insert(&conn, "b", "/m/b.mp3", "h2", "Other", None);
    conn.execute(RECORD_COPY_SQL, params!["/backup/a.mp3", "b", "h2"])
        .unwrap();
    assert_eq!(
        list(&conn),
        [("/backup/a.mp3".to_string(), "b".to_string())]
    );
    let hash: String = conn
        .query_row(
            "SELECT file_hash FROM duplicate_files WHERE file_path = '/backup/a.mp3'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(hash, "h2");

    assert_eq!(conn.execute(FORGET_COPY_SQL, ["/backup/a.mp3"]).unwrap(), 1);
    assert!(list(&conn).is_empty());
}

#[test]
fn a_copy_path_imported_as_its_own_track_leaves_the_list() {
    let conn = open_migrated();
    insert(&conn, "a", "/m/a.mp3", "h1", "Song", None);
    conn.execute(RECORD_COPY_SQL, params!["/backup/a.mp3", "a", "h1"])
        .unwrap();
    let count = |conn: &Connection| -> i64 {
        conn.prepare(DUPLICATE_COPIES_SQL)
            .unwrap()
            .query_map([], |_| Ok(()))
            .unwrap()
            .count() as i64
    };
    assert_eq!(count(&conn), 1);
    // The skipped file later changed and was imported as a track of its own.
    // The query hides the record at once; the scanner then forgets it.
    insert(&conn, "b", "/backup/a.mp3", "h9", "Song", None);
    assert_eq!(count(&conn), 0, "an imported path is a track, not a copy");
    let set_removed = |conn: &Connection, removed: bool| {
        let sql = if removed {
            "UPDATE tracks SET removed_at = datetime('now') WHERE id = 'b'"
        } else {
            "UPDATE tracks SET removed_at = NULL WHERE id = 'b'"
        };
        conn.execute(sql, []).unwrap();
    };
    // The query alone is not enough: soft-removing that track would bring the
    // stale record back, though its bytes no longer match track a.
    set_removed(&conn, true);
    assert_eq!(
        count(&conn),
        1,
        "without the forget, the stale record returns"
    );
    set_removed(&conn, false);
    // So the scanner forgets the record after the import; then a soft remove
    // leaves the list empty.
    conn.execute(FORGET_COPY_SQL, ["/backup/a.mp3"]).unwrap();
    set_removed(&conn, true);
    assert_eq!(count(&conn), 0);
}

#[test]
fn the_hash_lookup_is_scoped_to_the_workspace() {
    let conn = open_migrated();
    insert(&conn, "a", "/m/a.mp3", "h1", "Song", None);
    // `optional()` keeps a query error an error; only "no row" is None.
    let other: Option<String> = conn
        .query_row(TRACK_BY_HASH_SQL, ["elsewhere", "h1"], |r| r.get(0))
        .optional()
        .expect("lookup must run");
    assert_eq!(other, None);
    let own: Option<String> = conn
        .query_row(TRACK_BY_HASH_SQL, ["default", "h1"], |r| r.get(0))
        .optional()
        .expect("lookup must run");
    assert_eq!(own.as_deref(), Some("a"));

    // The scanner's "already imported" check is scoped the same way, so a
    // fingerprint held only by another workspace does not block an import.
    let held = |workspace: &str| -> bool {
        conn.query_row(HASH_IN_WORKSPACE_SQL, [workspace, "h1"], |r| r.get(0))
            .expect("check must run")
    };
    assert!(held("default"));
    assert!(!held("elsewhere"));
}

/// The scanner's import decision, run the way `scanner.rs` runs it: the
/// core `ScanDeduplicator` asks the workspace-scoped `HASH_IN_WORKSPACE_SQL`
/// whether the fingerprint is already imported, then the import inserts into
/// the same `SCAN_WORKSPACE` the scanner binds. (`run_scan` itself needs a
/// Tauri `AppHandle`, so this is the closest a test can drive it.)
#[test]
fn a_scan_imports_a_file_whose_hash_only_another_workspace_holds() {
    let conn = open_migrated();
    conn.execute(
        "INSERT INTO workspaces (id, name, created_at) VALUES ('elsewhere', 'Other', datetime('now'))",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms,
            format, title, artist, analysis_status)
         VALUES ('x', 'elsewhere', '/other/a.mp3', 'h1', 1, 300000, 'mp3', 'Song', 'Artist', 'complete')",
        [],
    )
    .unwrap();

    let already_imported = |conn: &Connection, hash: &str| -> bool {
        conn.query_row(HASH_IN_WORKSPACE_SQL, [SCAN_WORKSPACE, hash], |r| r.get(0))
            .expect("check must run")
    };
    let mut dedup = ScanDeduplicator::new();
    let kind = dedup.classify("h1", |candidate| already_imported(&conn, candidate));
    assert!(
        !kind.is_duplicate(),
        "another workspace's row must not block the import"
    );

    // The import then succeeds in the scan workspace: UNIQUE(workspace_id,
    // file_hash) allows it.
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms,
            format, title, artist, analysis_status)
         VALUES ('a', ?1, '/m/a.mp3', 'h1', 1, 300000, 'mp3', 'Song', 'Artist', 'pending')",
        [SCAN_WORKSPACE],
    )
    .expect("the scan's insert must succeed");
    let rows: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tracks WHERE file_hash = 'h1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(rows, 2);

    // And a second copy in `default` is now a duplicate.
    let mut next_scan = ScanDeduplicator::new();
    let kind = next_scan.classify("h1", |candidate| already_imported(&conn, candidate));
    assert!(kind.is_duplicate());
}

#[test]
fn a_moved_track_is_repointed_and_a_recorded_copy_is_known() {
    let conn = open_migrated();
    insert(&conn, "a", "/m/a.mp3", "h1", "Song", None);
    conn.execute(
        RELOCATE_TRACK_SQL,
        params!["/new/a.mp3", "2026-11-23T00:00:00Z", "a"],
    )
    .unwrap();
    let path: String = conn
        .query_row("SELECT file_path FROM tracks WHERE id = 'a'", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(path, "/new/a.mp3");

    let known = |conn: &Connection, hash: &str| -> bool {
        conn.query_row(
            COPY_IS_RECORDED_SQL,
            params!["/backup/a.mp3", "a", hash],
            |r| r.get(0),
        )
        .unwrap()
    };
    assert!(!known(&conn, "h1"));
    conn.execute(RECORD_COPY_SQL, params!["/backup/a.mp3", "a", "h1"])
        .unwrap();
    assert!(known(&conn, "h1"));
    assert!(
        !known(&conn, "h2"),
        "a changed fingerprint is compared again"
    );
}

#[test]
fn a_copy_is_dropped_when_its_track_row_is_deleted() {
    let conn = open_migrated();
    insert(&conn, "a", "/m/a.mp3", "h1", "Song", None);
    conn.execute(RECORD_COPY_SQL, params!["/backup/a.mp3", "a", "h1"])
        .unwrap();
    conn.execute("DELETE FROM tracks WHERE id = 'a'", [])
        .unwrap();
    let left: i64 = conn
        .query_row("SELECT COUNT(*) FROM duplicate_files", [], |r| r.get(0))
        .unwrap();
    assert_eq!(left, 0, "ON DELETE CASCADE must clean up copies");
}

#[test]
fn dismissals_are_idempotent() {
    let conn = open_migrated();
    conn.execute(DISMISS_GROUP_SQL, ["dup:abc"]).unwrap();
    conn.execute(DISMISS_GROUP_SQL, ["dup:abc"]).unwrap();
    let keys: Vec<String> = conn
        .prepare(DISMISSED_KEYS_SQL)
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .map(|r| r.unwrap())
        .collect();
    assert_eq!(keys, ["dup:abc"]);
}
