//! The bulk metadata write contract, run against the real migrated schema.
//!
//! `crates/core/src/library_writes.rs` holds the SQL as data and never runs it;
//! the desktop crate executes it, but its test harness cannot even load on this
//! box's toolchain. This file is the only place the planned statements actually
//! reach SQLite, so it is the only place that can prove the three claims the
//! feature is built on:
//!
//! * **Every selected track is written.** A bulk edit means nothing if the
//!   selection reads back short — one dropped id is a silent data loss.
//! * **Only the fields the patch carries change.** The editor sends the fields
//!   the user touched; an untouched column must survive the write.
//! * **The snapshot gives the values back.** Undo restores the scalars and the
//!   tag set, and refuses a track someone edited after the snapshot.

use dj_assistant_core::library_remove::{MARK_UNDONE_SQL, UNDO_READ_SQL};
use dj_assistant_core::library_writes::{
    plan_metadata_undo, plan_metadata_write, read_patch_statement, write_skill_run, WriteStatement,
    WriteValue, CURRENT_TAGS_SQL,
};
use dj_assistant_core::patch::{check_metadata_undoable, METADATA_SKILL_NAME, PATCH_COLUMNS};
use dj_assistant_core::{patch_columns, MetadataPatch};
use dj_assistant_schema_tests::open_migrated;
use rusqlite::Connection;
use std::collections::HashMap;

/// Binds a core value the way the desktop executor does.
fn bind(value: &WriteValue) -> rusqlite::types::Value {
    match value {
        WriteValue::Null => rusqlite::types::Value::Null,
        WriteValue::Text(text) => rusqlite::types::Value::Text(text.clone()),
        WriteValue::Int(number) => rusqlite::types::Value::Integer(*number),
    }
}

/// Binds and runs one statement core built, exactly as the desktop executor does.
fn execute(conn: &Connection, stmt: &WriteStatement) -> usize {
    let params: Vec<rusqlite::types::Value> = stmt.params.iter().map(bind).collect();
    conn.execute(&stmt.sql, rusqlite::params_from_iter(params.iter()))
        .unwrap_or_else(|e| panic!("core statement must run as built: {e}\n{}", stmt.sql))
}

/// Reads the selection through the statement core built, as `(id, column values)`.
///
/// This is the executor's first move and the one the bind order has to be right
/// for — a placeholder one off drops a track here, quietly.
fn read_selection(
    conn: &Connection,
    stmt: &WriteStatement,
    width: usize,
) -> Vec<(String, Vec<WriteValue>)> {
    let params: Vec<rusqlite::types::Value> = stmt.params.iter().map(bind).collect();
    let mut cursor = conn
        .prepare(&stmt.sql)
        .unwrap_or_else(|e| panic!("core SQL must prepare: {e}\n{}", stmt.sql));
    let rows = cursor
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            let id = row.get::<_, String>(0)?;
            let values = (1..=width)
                .map(|index| match row.get::<_, rusqlite::types::Value>(index) {
                    Ok(rusqlite::types::Value::Integer(number)) => WriteValue::Int(number),
                    Ok(rusqlite::types::Value::Text(text)) => WriteValue::Text(text),
                    _ => WriteValue::Null,
                })
                .collect::<Vec<WriteValue>>();
            Ok((id, values))
        })
        .unwrap_or_else(|e| panic!("core statement must run as built: {e}\n{}", stmt.sql));
    rows.collect::<Result<Vec<_>, _>>()
        .expect("every column must read")
}

/// Inserts a track carrying the values a bulk selection would show.
fn seed(conn: &Connection, id: &str, title: &str, genre: &str, year: i64, tags: &[&str]) {
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms, \
         format, title, artist, album, genre, label, year, comments, user_rating, energy) \
         VALUES (?1, 'default', ?2, ?3, 1024, 240000, 'mp3', ?4, 'Artist', 'Album', ?5, 'Label', \
                 ?6, 'note', 3, 5)",
        rusqlite::params![
            id,
            format!("D:\\Music\\{id}.mp3"),
            format!("hash-{id}"),
            title,
            genre,
            year,
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

/// One column of one row, as text — an empty string means the column is NULL.
fn column(conn: &Connection, id: &str, name: &str) -> String {
    let raw: Option<rusqlite::types::Value> = conn
        .query_row(
            &format!("SELECT {name} FROM tracks WHERE id = ?1"),
            [id],
            |row| row.get(0),
        )
        .unwrap_or_else(|e| panic!("{name} must be readable for {id}: {e}"));
    match raw {
        None | Some(rusqlite::types::Value::Null) => String::new(),
        Some(rusqlite::types::Value::Text(text)) => text,
        Some(rusqlite::types::Value::Integer(number)) => number.to_string(),
        Some(other) => panic!("{name} holds an unexpected value for {id}: {other:?}"),
    }
}

/// The tag set of one track, as the read path orders it.
fn tags(conn: &Connection, id: &str) -> Vec<String> {
    let mut stmt = conn
        .prepare(CURRENT_TAGS_SQL)
        .expect("the tag read must prepare");
    let found = stmt
        .query_map([id], |row| row.get::<_, String>(0))
        .expect("the tag read must run")
        .flatten()
        .collect();
    found
}

/// Set equality — the undo's tag guard compares sets, not lists.
fn same_set(left: &[String], right: &[String]) -> bool {
    let mut left = left.to_vec();
    let mut right = right.to_vec();
    left.sort();
    right.sort();
    left == right
}

/// Runs the desktop executor's sequence: read the selection, plan, write, snapshot.
///
/// Returns the undo id and the number of tracks the plan decided to touch.
fn apply_patch(conn: &Connection, ids: &[String], patch: &MetadataPatch) -> (String, usize) {
    let columns = patch_columns(patch);
    let read = read_patch_statement(ids, &columns).expect("the read must build");
    let selected = read_selection(conn, &read, columns.len());

    let tag_sets = if patch.tags.is_some() {
        selected
            .iter()
            .map(|(id, _)| (id.clone(), tags(conn, id)))
            .collect::<Vec<(String, Vec<String>)>>()
    } else {
        Vec::new()
    };

    let planned = plan_metadata_write(&selected, &tag_sets, &columns, patch);
    let mut before = serde_json::Map::new();
    let mut after = serde_json::Map::new();
    for entry in &planned {
        if let Some(update) = &entry.update {
            execute(conn, update);
        }
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

    let undo_id = format!("undo-{:04}", planned.len());
    let run = write_skill_run(&undo_id, METADATA_SKILL_NAME, ids, patch, before, after);
    conn.execute(&run.sql, rusqlite::params_from_iter(run.params.iter()))
        .expect("the snapshot insert must run");

    (undo_id, planned.len())
}

/// Runs the desktop undo command's sequence against a snapshot.
fn undo(conn: &Connection, undo_id: &str) -> usize {
    let (skill_name, status, before_raw, after_raw): (
        String,
        String,
        Option<String>,
        Option<String>,
    ) = conn
        .query_row(UNDO_READ_SQL, [undo_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .expect("the snapshot row must exist");
    check_metadata_undoable(&skill_name, &status).expect("a successful metadata write undoes");

    let before: serde_json::Value =
        serde_json::from_str(&before_raw.expect("the write stored a snapshot")).unwrap();
    let after: serde_json::Value = match after_raw {
        Some(raw) => serde_json::from_str(&raw).unwrap(),
        None => serde_json::Value::Null,
    };

    let planned = plan_metadata_undo(&before, &after).expect("the snapshot must plan");
    let mut restored = 0usize;
    for entry in &planned {
        // Both guards run before anything is written, so a track is either
        // fully restored or left exactly as the newer edit left it.
        if let Some(expected) = &entry.expected_tags {
            if !same_set(&tags(conn, &entry.track_id), expected) {
                continue;
            }
        }
        if let Some(restore) = &entry.restore {
            if execute(conn, restore) == 0 {
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
    restored
}

/// A patch with every field absent — the bulk editor sends only what changed.
fn patch() -> MetadataPatch {
    MetadataPatch {
        title: None,
        artist: None,
        album: None,
        genre: None,
        label: None,
        year: None,
        comments: None,
        rating: None,
        energy: None,
        tags: None,
    }
}

fn three_tracks() -> Connection {
    let conn = open_migrated();
    seed(&conn, "t1", "One", "House", 2024, &["peak"]);
    seed(&conn, "t2", "Two", "Techno", 2023, &["warmup"]);
    seed(&conn, "t3", "Three", "Trance", 2022, &[]);
    conn
}

fn three_ids() -> Vec<String> {
    vec!["t1".to_string(), "t2".to_string(), "t3".to_string()]
}

fn two_ids() -> Vec<String> {
    vec!["t1".to_string(), "t2".to_string()]
}

#[test]
fn a_bulk_patch_reads_back_the_whole_selection() {
    // The bind-order guard: a placeholder one off returns fewer rows than the
    // selection named, and the missing track is silently left out of the write.
    let conn = three_tracks();
    let read = read_patch_statement(&three_ids(), &["genre"]).expect("the read must build");
    let selected = read_selection(&conn, &read, 1);

    assert_eq!(
        selected
            .iter()
            .map(|(id, _)| id.as_str())
            .collect::<Vec<_>>(),
        vec!["t1", "t2", "t3"],
        "every selected track must be read\n{}",
        read.sql
    );
}

#[test]
fn a_single_track_patch_reaches_its_row() {
    let conn = three_tracks();
    let mut p = patch();
    p.genre = Some("Tech House".to_string());
    let (_, updated) = apply_patch(&conn, &["t1".to_string()], &p);

    assert_eq!(updated, 1, "one track, one write");
    assert_eq!(column(&conn, "t1", "genre"), "Tech House");
}

#[test]
fn a_bulk_patch_writes_every_selected_track() {
    let conn = three_tracks();
    let mut p = patch();
    p.label = Some("Ghostly".to_string());
    let (_, updated) = apply_patch(&conn, &three_ids(), &p);

    assert_eq!(updated, 3, "the whole selection must be written");
    for id in ["t1", "t2", "t3"] {
        assert_eq!(
            column(&conn, id, "label"),
            "Ghostly",
            "{id} missed the write"
        );
    }
}

#[test]
fn an_untouched_column_keeps_its_value() {
    // The footgun the dirty-field patch exists to kill: an editor that sends
    // blank for every field would wipe the columns the user never opened.
    let conn = open_migrated();
    seed(&conn, "t1", "One", "House", 2024, &["peak"]);
    seed(&conn, "t2", "Two", "Techno", 2023, &["warmup"]);

    let mut p = patch();
    p.comments = Some("closed opener".to_string());
    let (_, updated) = apply_patch(&conn, &two_ids(), &p);

    assert_eq!(updated, 2);
    assert_eq!(column(&conn, "t1", "title"), "One");
    assert_eq!(column(&conn, "t2", "title"), "Two");
    assert_eq!(column(&conn, "t1", "genre"), "House");
    assert_eq!(column(&conn, "t2", "genre"), "Techno");
    assert_eq!(column(&conn, "t1", "year"), "2024");
    assert_eq!(column(&conn, "t2", "year"), "2023");
    assert_eq!(tags(&conn, "t1"), vec!["peak".to_string()]);
    assert_eq!(tags(&conn, "t2"), vec!["warmup".to_string()]);
    assert_eq!(column(&conn, "t1", "comments"), "closed opener");
}

#[test]
fn an_emptied_year_clears_its_column() {
    // 0 is the clear value the editor sends for an emptied field, and core
    // stores it as NULL rather than as a zero no track may hold.
    let conn = open_migrated();
    seed(&conn, "t1", "One", "House", 2024, &[]);

    let mut p = patch();
    p.year = Some(0);
    let (_, updated) = apply_patch(&conn, &["t1".to_string()], &p);

    assert_eq!(updated, 1);
    assert_eq!(
        column(&conn, "t1", "year"),
        "",
        "the year must read back unset"
    );
}

#[test]
fn a_tag_patch_rewrites_the_set_for_the_whole_selection() {
    let conn = open_migrated();
    seed(&conn, "t1", "One", "House", 2024, &["peak", "old"]);
    seed(&conn, "t2", "Two", "Techno", 2023, &["warmup"]);

    let mut p = patch();
    p.tags = Some(vec!["closer".to_string()]);
    let (_, updated) = apply_patch(&conn, &two_ids(), &p);

    assert_eq!(updated, 2);
    assert_eq!(tags(&conn, "t1"), vec!["closer".to_string()]);
    assert_eq!(tags(&conn, "t2"), vec!["closer".to_string()]);
}

#[test]
fn a_track_that_already_matches_is_not_written() {
    let conn = open_migrated();
    seed(&conn, "t1", "One", "House", 2024, &[]);
    seed(&conn, "t2", "Two", "House", 2024, &[]);

    let mut p = patch();
    p.genre = Some("House".to_string());
    let (_, updated) = apply_patch(&conn, &two_ids(), &p);

    assert_eq!(
        updated, 0,
        "nothing changed, so nothing is counted or snapshotted"
    );
}

#[test]
fn the_snapshot_gives_the_values_and_tags_back() {
    let conn = open_migrated();
    seed(&conn, "t1", "One", "House", 2024, &["peak", "old"]);
    seed(&conn, "t2", "Two", "Techno", 2023, &["warmup"]);

    let mut p = patch();
    p.genre = Some("Tech House".to_string());
    p.year = Some(1999);
    p.tags = Some(vec!["closer".to_string()]);
    let (undo_id, _) = apply_patch(&conn, &two_ids(), &p);

    assert_eq!(column(&conn, "t1", "genre"), "Tech House");
    assert_eq!(tags(&conn, "t1"), vec!["closer".to_string()]);

    let restored = undo(&conn, &undo_id);
    assert_eq!(restored, 2, "both tracks must come back");
    assert_eq!(column(&conn, "t1", "genre"), "House");
    assert_eq!(column(&conn, "t1", "year"), "2024");
    assert_eq!(column(&conn, "t2", "genre"), "Techno");
    assert_eq!(column(&conn, "t2", "year"), "2023");
    assert_eq!(
        tags(&conn, "t1"),
        vec!["old".to_string(), "peak".to_string()]
    );
    assert_eq!(tags(&conn, "t2"), vec!["warmup".to_string()]);
}

#[test]
fn undo_refuses_a_track_someone_edited_after_the_snapshot() {
    let conn = open_migrated();
    seed(&conn, "t1", "One", "House", 2024, &[]);
    seed(&conn, "t2", "Two", "Techno", 2023, &[]);

    let mut p = patch();
    p.genre = Some("Tech House".to_string());
    let (undo_id, _) = apply_patch(&conn, &two_ids(), &p);

    // A newer edit lands on t1 after the snapshot.
    conn.execute("UPDATE tracks SET genre = 'Deep' WHERE id = 't1'", [])
        .expect("the newer edit must land");

    let restored = undo(&conn, &undo_id);
    assert_eq!(restored, 1, "only the untouched track restores");
    assert_eq!(column(&conn, "t1", "genre"), "Deep", "the newer edit wins");
    assert_eq!(column(&conn, "t2", "genre"), "Techno");
}

#[test]
fn undo_is_offered_once() {
    let conn = open_migrated();
    seed(&conn, "t1", "One", "House", 2024, &[]);

    let mut p = patch();
    p.genre = Some("Tech House".to_string());
    let (undo_id, _) = apply_patch(&conn, &["t1".to_string()], &p);

    assert_eq!(undo(&conn, &undo_id), 1);
    let (skill_name, status, _, _) = conn
        .query_row(UNDO_READ_SQL, [undo_id.as_str()], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })
        .expect("the snapshot row survives the undo");
    assert_eq!(status, "undone");
    assert!(
        check_metadata_undoable(&skill_name, &status).is_err(),
        "a second undo of the same snapshot must be refused"
    );
}

#[test]
fn the_snapshot_records_only_the_columns_the_patch_carried() {
    let conn = open_migrated();
    seed(&conn, "t1", "One", "House", 2024, &["peak"]);

    let mut p = patch();
    p.comments = Some("closed opener".to_string());
    let (undo_id, _) = apply_patch(&conn, &["t1".to_string()], &p);

    let raw: String = conn
        .query_row(
            "SELECT before_state FROM skill_runs WHERE id = ?1",
            [undo_id.as_str()],
            |row| row.get(0),
        )
        .expect("the snapshot must read back");
    let stored: HashMap<String, serde_json::Value> =
        serde_json::from_str(&raw).expect("the snapshot is JSON");
    let t1 = stored["t1"]
        .as_object()
        .expect("one track's before state")
        .clone();

    let recorded: Vec<&str> = PATCH_COLUMNS
        .iter()
        .copied()
        .filter(|column| t1.contains_key(*column))
        .collect();
    assert_eq!(
        recorded,
        vec!["comments"],
        "only the written column is snapshotted"
    );
}
