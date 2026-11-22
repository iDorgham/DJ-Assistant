//! The Tag Surgeon's bulk apply (T2.2.4), run against the real migrated schema.
//!
//! `crates/core/src/tag_rewrite.rs` plans the rewrite and its undo snapshot; the
//! desktop executor runs them. This file executes the same statements against
//! SQLite so the claims the apply is built on are proven, not assumed:
//!
//! * **Only the confirmed spellings change.** Other tags and other tracks keep
//!   their bytes; the canonical spelling is stored exactly as the preview showed.
//! * **Removed tracks are never rewritten**, and the scan that feeds the apply
//!   reads the same library the user sees.
//! * **The apply is undone by the shared metadata undo**, which refuses a track
//!   whose tag set changed after the apply.

use dj_assistant_core::library_reads::tag_vocabulary_rows;
use dj_assistant_core::library_remove::{MARK_UNDONE_SQL, UNDO_READ_SQL};
use dj_assistant_core::library_writes::{
    plan_metadata_undo, WriteStatement, WriteValue, CURRENT_TAGS_SQL,
};
use dj_assistant_core::patch::check_metadata_undoable;
use dj_assistant_core::tag_rewrite::{
    plan_tag_rewrite, tag_rewrite_skill_run, validate_renames, TagRename,
};
use dj_assistant_schema_tests::open_migrated;
use rusqlite::Connection;

fn bind(value: &WriteValue) -> rusqlite::types::Value {
    match value {
        WriteValue::Null => rusqlite::types::Value::Null,
        WriteValue::Text(text) => rusqlite::types::Value::Text(text.clone()),
        WriteValue::Int(number) => rusqlite::types::Value::Integer(*number),
    }
}

fn execute(conn: &Connection, stmt: &WriteStatement) {
    let params: Vec<rusqlite::types::Value> = stmt.params.iter().map(bind).collect();
    conn.execute(&stmt.sql, rusqlite::params_from_iter(params.iter()))
        .unwrap_or_else(|e| panic!("core statement must run as built: {e}\n{}", stmt.sql));
}

fn seed(conn: &Connection, id: &str, removed: bool, tags: &[&str]) {
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, title, artist, \
         removed_at) VALUES (?1, 'default', ?2, ?3, 1024, 'Title', 'Artist', ?4)",
        rusqlite::params![
            id,
            format!("D:\\Music\\{id}.mp3"),
            format!("hash-{id}"),
            removed.then_some("2026-11-20 10:00:00"),
        ],
    )
    .expect("track insert must succeed");
    for tag in tags {
        conn.execute(
            "INSERT INTO track_tags (track_id, tag) VALUES (?1, ?2)",
            rusqlite::params![id, tag],
        )
        .expect("tag insert must succeed");
    }
}

fn tags(conn: &Connection, id: &str) -> Vec<String> {
    let mut stmt = conn
        .prepare(CURRENT_TAGS_SQL)
        .expect("tag read must prepare");
    stmt.query_map([id], |row| row.get::<_, String>(0))
        .expect("tag read must run")
        .flatten()
        .collect()
}

fn rename(from: &str, to: &str) -> TagRename {
    TagRename {
        from: from.to_string(),
        to: to.to_string(),
    }
}

/// Reads the scan's vocabulary exactly as the desktop command does, grouped by
/// track, so the apply is planned from what the scan sees.
fn vocabulary(conn: &Connection, ids: &[String]) -> Vec<(String, Vec<String>)> {
    let read = tag_vocabulary_rows(Some(ids)).expect("the vocabulary read must build");
    let params: Vec<rusqlite::types::Value> = read
        .params
        .iter()
        .map(|p| rusqlite::types::Value::Text(p.clone()))
        .collect();
    let mut stmt = conn
        .prepare(&read.sql)
        .expect("the vocabulary read must prepare");
    let rows: Vec<(String, String)> = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .expect("the vocabulary read must run")
        .collect::<Result<_, _>>()
        .expect("every row must read");
    // The vocabulary query is unordered, so one track's rows need not be adjacent.
    let mut grouped: std::collections::BTreeMap<String, Vec<String>> =
        std::collections::BTreeMap::new();
    for (track_id, tag) in rows {
        grouped.entry(track_id).or_default().push(tag);
    }
    grouped.into_iter().collect()
}

/// Runs the apply the way the desktop command does and returns the undo id.
fn apply(conn: &Connection, ids: &[String], renames: &[TagRename]) -> (String, usize) {
    let map = validate_renames(renames).expect("the renames must validate");
    let planned = plan_tag_rewrite(&vocabulary(conn, ids), &map);
    if planned.is_empty() {
        return (String::new(), 0);
    }
    let mut before = serde_json::Map::new();
    let mut after = serde_json::Map::new();
    for entry in &planned {
        for statement in &entry.tag_statements {
            execute(conn, statement);
        }
        before.insert(
            entry.track_id.clone(),
            serde_json::Value::Object(entry.before.clone()),
        );
        after.insert(
            entry.track_id.clone(),
            serde_json::Value::Object(entry.after.clone()),
        );
    }
    let undo_id = "tag-apply-1".to_string();
    let run = tag_rewrite_skill_run(&undo_id, ids, renames, before, after);
    let params: Vec<rusqlite::types::Value> = run
        .params
        .iter()
        .map(|p| rusqlite::types::Value::Text(p.clone()))
        .collect();
    conn.execute(&run.sql, rusqlite::params_from_iter(params.iter()))
        .expect("the snapshot row must insert");
    (undo_id, planned.len())
}

/// Runs the shared metadata undo's sequence against a snapshot.
/// Returns `(restored, skipped)`.
fn undo(conn: &Connection, undo_id: &str) -> (usize, usize) {
    let (skill_name, status, before_raw, after_raw): (String, String, String, String) = conn
        .query_row(UNDO_READ_SQL, [undo_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .expect("the snapshot must be readable");
    check_metadata_undoable(&skill_name, &status).expect("a tag apply undoes");
    let before: serde_json::Value = serde_json::from_str(&before_raw).unwrap();
    let after: serde_json::Value = serde_json::from_str(&after_raw).unwrap();
    let planned = plan_metadata_undo(&before, &after).expect("the snapshot must plan");
    let (mut restored, mut skipped) = (0, 0);
    for entry in &planned {
        if let Some(expected) = &entry.expected_tags {
            let mut current = tags(conn, &entry.track_id);
            let mut wanted = expected.clone();
            current.sort();
            wanted.sort();
            if current != wanted {
                skipped += 1;
                continue;
            }
        }
        for statement in &entry.tag_statements {
            execute(conn, statement);
        }
        restored += 1;
    }
    conn.execute(MARK_UNDONE_SQL, [undo_id])
        .expect("the snapshot must be marked undone");
    (restored, skipped)
}

fn library() -> Connection {
    let conn = open_migrated();
    seed(&conn, "t1", false, &["House", "peak"]);
    seed(&conn, "t2", false, &["house", "peak"]);
    seed(&conn, "t3", false, &["techno"]);
    seed(&conn, "t4", true, &["house"]);
    conn
}

fn ids(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

#[test]
fn only_the_confirmed_spelling_changes_and_the_canonical_form_is_stored_exactly() {
    let conn = library();
    let (undo_id, updated) = apply(
        &conn,
        &ids(&["t1", "t2", "t3"]),
        &[rename("House", "house")],
    );
    assert_eq!(updated, 1);
    assert!(!undo_id.is_empty());
    assert_eq!(tags(&conn, "t1"), ["house", "peak"]);
    // t2 already carries the canonical spelling, so it is not rewritten.
    assert_eq!(tags(&conn, "t2"), ["house", "peak"]);
    // A track with no matching spelling is never touched.
    assert_eq!(tags(&conn, "t3"), ["techno"]);
}

#[test]
fn a_removed_track_is_neither_scanned_nor_rewritten() {
    let conn = library();
    let (_, updated) = apply(&conn, &ids(&["t4"]), &[rename("House", "house")]);
    assert_eq!(
        updated, 0,
        "the soft-removed track must be invisible to the apply"
    );
    assert_eq!(tags(&conn, "t4"), ["house"]);
}

#[test]
fn undo_restores_every_track_the_apply_rewrote() {
    let conn = library();
    let (undo_id, _) = apply(&conn, &ids(&["t1", "t2"]), &[rename("House", "house")]);
    let (restored, skipped) = undo(&conn, &undo_id);
    assert_eq!((restored, skipped), (1, 0));
    assert_eq!(tags(&conn, "t1"), ["House", "peak"]);
    assert_eq!(tags(&conn, "t2"), ["house", "peak"]);
}

#[test]
fn undo_refuses_a_track_whose_tags_changed_after_the_apply() {
    let conn = library();
    let (undo_id, _) = apply(&conn, &ids(&["t1", "t2"]), &[rename("House", "house")]);
    // Someone edits t1 after the apply: the undo must leave that edit alone.
    conn.execute(
        "DELETE FROM track_tags WHERE track_id = 't1' AND tag = 'peak'",
        [],
    )
    .unwrap();
    // Only t1 was rewritten, so t1 is the one track the snapshot describes.
    let (restored, skipped) = undo(&conn, &undo_id);
    assert_eq!((restored, skipped), (0, 1));
    assert_eq!(
        tags(&conn, "t1"),
        ["house"],
        "the newer edit survives the undo"
    );
}

#[test]
fn a_second_undo_of_the_same_apply_is_refused() {
    let conn = library();
    let (undo_id, _) = apply(&conn, &ids(&["t1"]), &[rename("House", "house")]);
    undo(&conn, &undo_id);
    let status: String = conn
        .query_row(UNDO_READ_SQL, [undo_id.as_str()], |row| row.get(1))
        .unwrap();
    assert_eq!(status, "undone");
    assert!(check_metadata_undoable("tag_surgeon_apply", &status).is_err());
}
