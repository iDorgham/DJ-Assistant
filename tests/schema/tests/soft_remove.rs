//! The reversible-remove contract, run against the real migrated schema.
//!
//! `crates/core/src/library_remove.rs` holds the SQL as data and never runs it;
//! this file is where it executes. It is the only place that can prove the two
//! claims the feature is built on:
//!
//! * **Nothing is lost.** A remove takes a track out of every library read but
//!   leaves its row — and therefore its cue points and tags — in the database.
//! * **Nothing is unrecoverable.** The `skill_runs` snapshot written in the
//!   same transaction brings exactly those tracks back, once.
//!
//! Both halves run through `crates/core`, so the statements under test are the
//! ones the app sends, not a paraphrase of them.

use dj_assistant_core::library_query::TrackQuery;
use dj_assistant_core::library_reads::{
    analysis_candidates, enrichment_targets, missing_file_paths_sql, tag_health_rows,
    GENRE_COUNTS_SQL, OWNED_ISRC_SQL, SIMILAR_CANDIDATES_SQL,
};
use dj_assistant_core::library_remove::{
    after_doc, before_doc, check_undoable, input_doc, parse_states, present_states, read_statement,
    remove_statement, skill_run_insert, undo_statements, RemoveError, SkillRun, Statement,
    TrackState, MARK_UNDONE_SQL, REMOVE_SKILL_NAME, UNDO_READ_SQL,
};
use dj_assistant_core::library_schema::LibrarySchema;
use dj_assistant_core::patch::{check_metadata_undoable, PATCH_COLUMNS};
use dj_assistant_schema_tests::{open_migrated, seed_cue, seed_track, TRACK_SUMMARY_COLUMNS};
use rusqlite::{params, Connection};

const STAMP: &str = "2026-10-27 10:00:00";

/// Runs a statement built by `core` against `conn`.
fn execute(conn: &Connection, stmt: &Statement) -> usize {
    conn.execute(&stmt.sql, rusqlite::params_from_iter(stmt.params.iter()))
        .unwrap_or_else(|e| panic!("core statement must run as built: {e}\n{}", stmt.sql))
}

/// Reads the snapshot row the way the undo command does.
fn read_snapshot(conn: &Connection, run_id: &str) -> (String, String, String, String) {
    conn.query_row(UNDO_READ_SQL, [run_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            row.get::<_, Option<String>>(3)?.unwrap_or_default(),
        ))
    })
    .expect("the remove must leave a snapshot row")
}

/// The library as the list query sees it: the ids it would render.
fn listed_ids(conn: &Connection) -> Vec<String> {
    use dj_assistant_core::library_query::QueryParam;

    let built = TrackQuery::default()
        .build(TRACK_SUMMARY_COLUMNS, 200, 0)
        .expect("baseline list query must build");
    let params: Vec<rusqlite::types::Value> = built
        .params
        .iter()
        .map(|param| match param {
            QueryParam::Text(value) => rusqlite::types::Value::Text(value.clone()),
            QueryParam::Int(value) => rusqlite::types::Value::Integer(*value),
            QueryParam::Real(value) => rusqlite::types::Value::Real(*value),
        })
        .collect();
    let mut stmt = conn.prepare(&built.select_sql).unwrap();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            row.get::<_, String>(0)
        })
        .unwrap();
    rows.map(|r| r.unwrap()).collect()
}

/// Removes the selection exactly the way the `remove_tracks` command does: read
/// the current state, stamp what is present, and record the snapshot in the
/// same breath. Returns how many tracks left the library.
fn remove_tracks(conn: &Connection, run_id: &str, ids: &[String]) -> usize {
    let read = read_statement(ids).unwrap();
    let mut stmt = conn.prepare(&read.sql).unwrap();
    let found: Vec<TrackState> = stmt
        .query_map(rusqlite::params_from_iter(read.params.iter()), |row| {
            Ok(TrackState {
                id: row.get(0)?,
                removed_at: row.get(1)?,
            })
        })
        .unwrap()
        .map(|r| r.unwrap())
        .collect();
    drop(stmt);

    let present = present_states(&found);
    if present.is_empty() {
        return 0;
    }
    let ids: Vec<String> = present.iter().map(|state| state.id.clone()).collect();

    let before = before_doc(&present);
    let after = after_doc(&present, STAMP);
    let removed = execute(conn, &remove_statement(&ids, STAMP).unwrap());
    assert_eq!(removed, ids.len(), "every present track is stamped");
    execute(
        conn,
        &skill_run_insert(&SkillRun {
            id: run_id.into(),
            workspace_id: "default".into(),
            before_state: before,
            after_state: after,
            input_summary: input_doc(&ids),
        }),
    );
    removed
}

/// Undoes `run_id` the way the `undo_remove_tracks` command does, returning the
/// number of tracks restored.
fn undo_remove(conn: &Connection, run_id: &str) -> Result<usize, RemoveError> {
    let (skill_name, status, before_raw, after_raw) = read_snapshot(conn, run_id);
    check_undoable(&skill_name, &status)?;
    let before = parse_states(&before_raw)?;
    let after = parse_states(&after_raw)?;
    let mut restored = 0;
    for stmt in undo_statements(&before, &after)? {
        restored += execute(conn, &stmt);
    }
    conn.execute(MARK_UNDONE_SQL, [run_id]).unwrap();
    Ok(restored)
}

fn tag_count(conn: &Connection, track_id: &str) -> i64 {
    conn.query_row(
        "SELECT COUNT(*) FROM track_tags WHERE track_id = ?1",
        [track_id],
        |r| r.get(0),
    )
    .unwrap()
}

fn cue_count(conn: &Connection, track_id: &str) -> i64 {
    conn.query_row(
        "SELECT COUNT(*) FROM cue_points WHERE track_id = ?1",
        [track_id],
        |r| r.get(0),
    )
    .unwrap()
}

fn insert_tag(conn: &Connection, track_id: &str, tag: &str) {
    conn.execute(
        "INSERT INTO track_tags (track_id, tag) VALUES (?1, ?2)",
        params![track_id, tag],
    )
    .unwrap();
}

fn removed_at(conn: &Connection, track_id: &str) -> Option<Option<String>> {
    conn.query_row(
        "SELECT removed_at FROM tracks WHERE id = ?1",
        [track_id],
        |r| r.get::<_, Option<String>>(0),
    )
    .ok()
}

#[test]
fn a_removed_track_leaves_the_list_and_keeps_its_row() {
    let conn = open_migrated();
    let a = seed_track(&conn);
    let b = {
        let id = "track-2".to_string();
        conn.execute(
            "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms, \
             format, title, artist, created_at, updated_at) \
             VALUES (?1, 'default', ?2, 'h2', 1024, 240000, 'mp3', 'Second', 'Artist', \
             '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![id, "D:\\Music\\two.mp3"],
        )
        .unwrap();
        id
    };
    seed_cue(&conn, &a);
    insert_tag(&conn, &a, "peak");

    assert_eq!(listed_ids(&conn).len(), 2);
    assert_eq!(remove_tracks(&conn, "run-1", &[a.clone(), b.clone()]), 2);

    // Gone from the library view...
    assert_eq!(listed_ids(&conn), Vec::<String>::new());
    // ...but the row, its cues and its tags are all still there. This is the
    // whole reason the feature is a soft remove: a DELETE would cascade away
    // the analysis and the cue grid the DJ built, and nothing could bring them
    // back.
    assert_eq!(removed_at(&conn, &a), Some(Some(STAMP.to_string())));
    assert_eq!(cue_count(&conn, &a), 1, "cues must survive a remove");
    assert_eq!(tag_count(&conn, &a), 1, "tags must survive a remove");
    // The file on disk is never touched — the path is still what it was.
    let path: String = conn
        .query_row("SELECT file_path FROM tracks WHERE id = ?1", [&a], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(path, "D:\\Music\\track.mp3");
}

#[test]
fn undoing_a_remove_brings_the_tracks_back_once() {
    let conn = open_migrated();
    let a = seed_track(&conn);
    assert_eq!(remove_tracks(&conn, "run-1", std::slice::from_ref(&a)), 1);
    assert_eq!(listed_ids(&conn), Vec::<String>::new());

    assert_eq!(undo_remove(&conn, "run-1").unwrap(), 1);
    assert_eq!(listed_ids(&conn), vec![a.clone()]);
    assert_eq!(removed_at(&conn, &a), Some(None), "back to present");

    // The snapshot is spent: a second undo refuses rather than restoring twice
    // (or, with a different statement order, stamping the track again).
    let (skill, status, _, _) = read_snapshot(&conn, "run-1");
    assert_eq!(skill, REMOVE_SKILL_NAME);
    assert_eq!(status, "undone");
    assert!(
        undo_remove(&conn, "run-1").is_err(),
        "second undo is refused"
    );
    assert_eq!(listed_ids(&conn), vec![a]);
}

#[test]
fn undo_only_restores_what_the_snapshot_still_describes() {
    let conn = open_migrated();
    let a = seed_track(&conn);
    let b = "track-2".to_string();
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms, \
         format, title, artist, created_at, updated_at) \
         VALUES (?1, 'default', ?2, 'h2', 1024, 240000, 'mp3', 'Second', 'Artist', \
         '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![b, "D:\\Music\\two.mp3"],
    )
    .unwrap();

    assert_eq!(remove_tracks(&conn, "run-1", &[a.clone(), b.clone()]), 2);

    // Something stamped `b` again after the snapshot — a later remove of its
    // own, with its own undo. Restoring the older snapshot must not undo that
    // newer action by writing `b` back.
    conn.execute(
        "UPDATE tracks SET removed_at = '2026-12-31 23:59:59' WHERE id = ?1",
        [&b],
    )
    .unwrap();

    assert_eq!(
        undo_remove(&conn, "run-1").unwrap(),
        1,
        "only the track still in the snapshotted state comes back"
    );
    assert_eq!(listed_ids(&conn), vec![a]);
    assert_eq!(
        removed_at(&conn, &b),
        Some(Some("2026-12-31 23:59:59".to_string())),
        "the newer removal is left alone"
    );
}

#[test]
fn a_remove_of_an_already_removed_track_is_not_snapshotted() {
    let conn = open_migrated();
    let a = seed_track(&conn);
    assert_eq!(remove_tracks(&conn, "run-1", std::slice::from_ref(&a)), 1);

    // Removing it again changes nothing, so it must not write a snapshot that
    // an undo could use to resurrect it out from under run-1.
    assert_eq!(remove_tracks(&conn, "run-2", std::slice::from_ref(&a)), 0);
    let runs: i64 = conn
        .query_row("SELECT COUNT(*) FROM skill_runs", [], |r| r.get(0))
        .unwrap();
    assert_eq!(runs, 1, "a remove that changes nothing records nothing");
}

#[test]
fn a_remove_snapshot_from_another_write_path_is_not_undoable() {
    let conn = open_migrated();
    conn.execute(
        "INSERT INTO skill_runs (id, workspace_id, skill_name, status, before_state, after_state, created_at) \
         VALUES ('run-9', 'default', 'set_track_rating', 'success', '{\"track-1\":{\"user_rating\":4}}', \
         '{\"track-1\":{\"user_rating\":3}}', datetime('now'))",
        [],
    )
    .unwrap();
    let (skill, status, _, _) = read_snapshot(&conn, "run-9");
    assert!(check_undoable(&skill, &status).is_err());
}

#[test]
fn the_library_summary_and_the_list_agree_after_a_remove() {
    // `dj-query --stats` and the list read the same rows or the two views
    // contradict each other about how big the library is.
    use dj_assistant_core::library_stats::stat_queries;

    let conn = open_migrated();
    let a = seed_track(&conn);
    let b = "track-2".to_string();
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms, \
         format, title, artist, created_at, updated_at) \
         VALUES (?1, 'default', ?2, 'h2', 1024, 240000, 'mp3', 'Second', 'Artist', \
         '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![b, "D:\\Music\\two.mp3"],
    )
    .unwrap();
    remove_tracks(&conn, "run-1", std::slice::from_ref(&a));

    let total = stat_queries(&LibrarySchema::CURRENT)
        .into_iter()
        .find(|q| q.key == "total")
        .expect("total stat");
    let counted: i64 = conn.query_row(&total.sql, [], |r| r.get(0)).unwrap();
    assert_eq!(counted as usize, listed_ids(&conn).len());
    assert_eq!(counted, 1, "the removed track is not in the summary either");
}

/// A second track, differing from [`seed_track`]'s in every column a
/// library-wide read looks at: genre, ISRC, BPM, key, duration and path.
fn seed_second_track(conn: &Connection, id: &str) {
    conn.execute(
        "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, duration_ms, \
         format, title, artist, genre, isrc, bpm, key_camelot, analysis_status, created_at, updated_at) \
         VALUES (?1, 'default', ?2, 'other-hash', 2048, 300000, 'flac', 'Second', 'Artist', \
         'Techno', 'USX2R2400002', 140.0, '8A', 'pending', \
         '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![id, "D:\\Music\\two.flac"],
    )
    .unwrap();
}

/// The first column of every row a read returns.
fn first_column(conn: &Connection, sql: &str, params: &[String]) -> Vec<String> {
    let mut stmt = conn
        .prepare(sql)
        .unwrap_or_else(|e| panic!("core read must run as built: {e}\n{sql}"));
    stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        row.get::<_, String>(0)
    })
    .unwrap()
    .map(|row| row.expect("a read row must map"))
    .collect()
}

/// A read over the whole library, as the app sends it.
fn read_ids(conn: &Connection, built: &Statement) -> Vec<String> {
    first_column(conn, &built.sql, &built.params)
}

#[test]
fn every_library_wide_read_skips_a_removed_track() {
    // The row stays so an undo can restore it — which is exactly why each read
    // has to ask for the library the user sees. A track that still shows up in
    // one of these is analysed, scored, enriched or counted behind its own
    // absence from the list.
    let conn = open_migrated();
    let kept = seed_track(&conn);
    let gone = "track-2".to_string();
    seed_second_track(&conn, &gone);
    remove_tracks(&conn, "run-1", std::slice::from_ref(&gone));

    let genre_options = first_column(&conn, GENRE_COUNTS_SQL, &[]);
    assert_eq!(
        genre_options,
        vec!["House".to_string()],
        "one genre option left"
    );

    let pool = first_column(&conn, SIMILAR_CANDIDATES_SQL, std::slice::from_ref(&kept));
    assert!(
        pool.is_empty(),
        "the seed's pool must not hold a removed track"
    );

    for built in [
        analysis_candidates(None, true, "2026.10").unwrap(),
        analysis_candidates(Some(&[gone.clone(), kept.clone()]), false, "2026.10").unwrap(),
        tag_health_rows(None).unwrap(),
        enrichment_targets(None).unwrap(),
    ] {
        let ids = read_ids(&conn, &built);
        assert!(
            !ids.contains(&gone),
            "a removed track is still read by: {}",
            built.sql
        );
        assert!(
            ids.contains(&kept),
            "the present track must stay readable by: {}",
            built.sql
        );
    }

    assert!(first_column(&conn, OWNED_ISRC_SQL, &[]).is_empty());
    assert_eq!(
        first_column(&conn, &missing_file_paths_sql(&LibrarySchema::CURRENT), &[]),
        vec!["D:\\Music\\track.mp3".to_string()]
    );

    // And the reads come back with the track: filtering is a view, not a loss.
    assert_eq!(undo_remove(&conn, "run-1").unwrap(), 1);
    assert_eq!(
        first_column(&conn, OWNED_ISRC_SQL, &[]),
        vec!["USX2R2400002".to_string()]
    );
    assert_eq!(
        first_column(&conn, GENRE_COUNTS_SQL, &[]).len(),
        2,
        "both genres are offered again once the remove is undone"
    );
}

#[test]
fn the_metadata_undo_refuses_a_remove_snapshot_without_spending_it() {
    // Both write paths answer with an `undoId` from the one `skill_runs` table,
    // so a remove id can reach the metadata command. Its snapshot holds
    // `removed_at`, which is not a patch column: the metadata undo would
    // restore nothing and still mark the row `undone`, and a spent remove
    // snapshot is a track permanently out of the library.
    let conn = open_migrated();
    let a = seed_track(&conn);
    remove_tracks(&conn, "run-1", std::slice::from_ref(&a));

    let (skill, status, before_raw, _) = read_snapshot(&conn, "run-1");
    assert_eq!(skill, REMOVE_SKILL_NAME);
    assert!(check_metadata_undoable(&skill, &status).is_err());
    assert!(
        !PATCH_COLUMNS.contains(&"removed_at"),
        "the metadata undo cannot restore the one column a remove wrote"
    );

    // Refusing changes nothing, so the remove is still undoable.
    let (_, after_status, _, _) = read_snapshot(&conn, "run-1");
    assert_eq!(after_status, "success");
    assert!(before_raw.contains("removed_at"));
    assert!(listed_ids(&conn).is_empty());
    assert_eq!(undo_remove(&conn, "run-1").unwrap(), 1);
    assert_eq!(listed_ids(&conn), vec![a]);
}
