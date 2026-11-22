//! The Maintain reads (duplicates, versions, health) run against the real
//! migrated schema. `crates/core/src/library_hygiene.rs` holds the SQL; this is
//! where it executes, so a column the migrations do not have fails here
//! instead of in the running app.

use dj_assistant_core::duplicates::{find_duplicate_groups, DEFAULT_DURATION_TOLERANCE_MS};
use dj_assistant_core::library_health::{compute_health, HealthContext};
use dj_assistant_core::library_hygiene::{
    HygieneRow, DISMISSED_KEYS_SQL, DISMISS_GROUP_SQL, DUPLICATE_COPIES_SQL, FORGET_COPY_SQL,
    HYGIENE_TRACKS_SQL, RECORD_COPY_SQL, TRACK_BY_HASH_SQL,
};
use dj_assistant_core::versions::group_versions;
use dj_assistant_schema_tests::open_migrated;
use rusqlite::{params, Connection};

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
            .map(|r| r.health_track(false))
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
        .query_row(TRACK_BY_HASH_SQL, ["h1"], |r| Ok((r.get(0)?, r.get(1)?)))
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

    assert_eq!(conn.execute(FORGET_COPY_SQL, ["/backup/a.mp3"]).unwrap(), 1);
    assert!(list(&conn).is_empty());
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
    conn.execute(DISMISS_GROUP_SQL, ["near_match:abc"]).unwrap();
    conn.execute(DISMISS_GROUP_SQL, ["near_match:abc"]).unwrap();
    let keys: Vec<String> = conn
        .prepare(DISMISSED_KEYS_SQL)
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .map(|r| r.unwrap())
        .collect();
    assert_eq!(keys, ["near_match:abc"]);
}
