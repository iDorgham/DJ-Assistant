//! The source branches of `library_query.rs` executed against a real SQLite.
//!
//! The build-level tests in `library_query.rs` can only assert the rendered
//! SQL text and bound values. What they cannot see is whether the statements
//! actually run against the app's schema, in the documented bind order, with
//! the semantics the UI relies on: the folder boundary (`House` must not pick
//! up `House2`), separator normalisation on Windows-spelled paths, `LIKE`
//! wildcard escaping, and the reserved playlist/storage sources matching no
//! rows. A mutation that keeps the string shape but breaks the execution (a
//! swapped `REPLACE` argument, a misplaced `ESCAPE`) would leave those tests
//! green.
//!
//! The `rusqlite` dependency is behind core's `cli` feature, so this target is too:
//!
//! ```text
//! cargo test -p dj-assistant-core --features cli
//! ```

use dj_assistant_core::library_query::{BuiltQuery, QueryParam, TrackFilters, TrackQuery};
use dj_assistant_core::library_reads::{
    folder_counts_from_paths, tag_vocabulary_rows, PRESENT_FILE_PATHS_SQL,
};
use dj_assistant_core::{cluster_tags, TagValue};
use rusqlite::{params, Connection};

const MIGRATIONS: [&str; 9] = [
    include_str!("../../../apps/desktop/src-tauri/migrations/001_initial_schema.sql"),
    include_str!("../../../apps/desktop/src-tauri/migrations/002_track_tags.sql"),
    include_str!("../../../apps/desktop/src-tauri/migrations/003_enrichment_providers.sql"),
    include_str!("../../../apps/desktop/src-tauri/migrations/004_enrichment_candidates.sql"),
    include_str!("../../../apps/desktop/src-tauri/migrations/005_chart_snapshots.sql"),
    include_str!("../../../apps/desktop/src-tauri/migrations/006_track_energy.sql"),
    include_str!("../../../apps/desktop/src-tauri/migrations/007_track_tags_table.sql"),
    include_str!("../../../apps/desktop/src-tauri/migrations/008_tracks_removed_at.sql"),
    include_str!("../../../apps/desktop/src-tauri/migrations/009_beatgrid_confidence.sql"),
];

/// A current-schema library in memory, exercising every axis the source
/// branches filter on: genre case, separators, folder boundaries, wildcards,
/// root paths, and soft removal.
fn seeded() -> Connection {
    let conn = Connection::open_in_memory().expect("in-memory sqlite");
    for sql in MIGRATIONS {
        conn.execute_batch(sql)
            .expect("the migrations must apply cleanly");
    }
    let insert = |id: &str, title: &str, genre: Option<&str>, path: &str, removed: bool| {
        conn.execute(
            "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, \
             duration_ms, format, title, artist, genre, analysis_status, \
             created_at, updated_at, removed_at) \
             VALUES (?1, 'default', ?2, ?3, 1024, 240000, 'mp3', ?4, 'Artist', ?5, \
                     'complete', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', \
                     ?6)",
            params![
                id,
                path,
                format!("hash-{id}"),
                title,
                genre,
                if removed {
                    Some("2026-01-03T00:00:00Z")
                } else {
                    None
                },
            ],
        )
        .expect("track insert must succeed");
    };
    insert(
        "t1",
        "Anchor One",
        Some("Deep House"),
        "/Music/House/a.mp3",
        false,
    );
    // Same folder spelled with Windows separators and a different genre case.
    insert(
        "t2",
        "Anchor Two",
        Some("deep house"),
        "\\Music\\House\\b.mp3",
        false,
    );
    // The boundary sibling: /Music/House must never select it.
    insert(
        "t3",
        "Boundary",
        Some("Tech House"),
        "/Music/House2/c.mp3",
        false,
    );
    insert("t4", "Elsewhere", Some("Deep House"), "/other/d.mp3", false);
    // Same folder, no genre at all.
    insert("t5", "No Genre", None, "/Music/House/e.mp3", false);
    // A folder id carrying LIKE wildcards must be escaped on the bound side.
    insert(
        "t6",
        "Percent",
        Some("Tech House"),
        "/Music/H%use/x.mp3",
        false,
    );
    // Soft-removed: invisible to every read below.
    insert(
        "t7",
        "Removed",
        Some("Deep House"),
        "/Music/House/f.mp3",
        true,
    );
    conn
}

fn rusqlite_values(items: &[QueryParam]) -> Vec<rusqlite::types::Value> {
    items
        .iter()
        .map(|p| match p {
            QueryParam::Text(v) => rusqlite::types::Value::Text(v.clone()),
            QueryParam::Int(v) => rusqlite::types::Value::Integer(*v),
            QueryParam::Real(v) => rusqlite::types::Value::Real(*v),
        })
        .collect()
}

fn select_titles(conn: &Connection, built: &BuiltQuery) -> Vec<String> {
    let mut stmt = conn
        .prepare(&built.select_sql)
        .expect("select_sql must run");
    let values = rusqlite_values(&built.params);
    let refs: Vec<&dyn rusqlite::types::ToSql> = values
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();
    stmt.query_map(refs.as_slice(), |row| row.get::<_, String>(1))
        .expect("select must bind and run")
        .flatten()
        .collect()
}

fn count(conn: &Connection, built: &BuiltQuery) -> i64 {
    let mut stmt = conn.prepare(&built.count_sql).expect("count_sql must run");
    // The documented contract: bind every parameter except the trailing
    // pagination pair. Executing with that prefix proves the reading.
    let filter_params = &built.params[..built.params.len().saturating_sub(2)];
    let values = rusqlite_values(filter_params);
    let refs: Vec<&dyn rusqlite::types::ToSql> = values
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();
    stmt.query_row(refs.as_slice(), |row| row.get::<_, i64>(0))
        .expect("count must bind and run")
}

fn titles(conn: &Connection, query: &TrackQuery) -> Vec<String> {
    let built = query
        .build("id, title", 100, 0)
        .expect("the query must build");
    let found = select_titles(conn, &built);
    assert_eq!(
        count(conn, &built) as usize,
        found.len(),
        "count and select must agree for the same query: {built:?}"
    );
    found
}

fn source(kind: &str, id: &str) -> TrackQuery {
    TrackQuery {
        source: Some(kind.to_string()),
        source_id: Some(id.to_string()),
        ..Default::default()
    }
}

#[test]
fn all_source_returns_every_present_track() {
    let conn = seeded();
    let ids = titles(&conn, &TrackQuery::default());
    assert_eq!(ids.len(), 6, "all six present tracks: {ids:?}");
}

#[test]
fn category_source_matches_genre_folded_and_trimmed() {
    let conn = seeded();
    let mut found = titles(&conn, &source("category", " Deep House "));
    found.sort();
    // t1 + t2 (lowercase spelling) + t4; the removed t7 must not appear.
    assert_eq!(found, ["Anchor One", "Anchor Two", "Elsewhere"]);
}

#[test]
fn folder_source_normalizes_separators_and_honours_the_boundary() {
    let conn = seeded();
    let mut found = titles(&conn, &source("folder", "/Music/House"));
    found.sort();
    // t1 (slash), t2 (backslash spelling), t5 (no genre); NOT t3 (House2)
    // and NOT the removed t7.
    assert_eq!(found, ["Anchor One", "Anchor Two", "No Genre"]);

    let boundary = titles(&conn, &source("folder", "/Music/House2"));
    assert_eq!(boundary, ["Boundary"]);
}

#[test]
fn a_windows_spelled_folder_id_still_selects_slash_rows() {
    let conn = seeded();
    let mut win = titles(&conn, &source("folder", "\\Music\\House"));
    win.sort();
    assert_eq!(win, ["Anchor One", "Anchor Two", "No Genre"]);
}

#[test]
fn folder_source_escapes_like_wildcards() {
    let conn = seeded();
    // The percent belongs to the folder name, not to the pattern.
    let found = titles(&conn, &source("folder", "/Music/H%use"));
    assert_eq!(found, ["Percent"]);
}

#[test]
fn root_folder_source_selects_everything_under_slash() {
    let conn = seeded();
    let found = titles(&conn, &source("folder", "/"));
    assert_eq!(found.len(), 6, "every present track starts with /");
}

#[test]
fn playlist_and_storage_sources_return_no_rows() {
    let conn = seeded();
    for kind in ["playlist", "storage"] {
        let found = titles(&conn, &source(kind, "anything"));
        assert!(found.is_empty(), "{kind} must match nothing, got {found:?}");
    }
}

#[test]
fn search_and_bounds_and_pagination_execute_in_bind_order() {
    let conn = seeded();
    let query = TrackQuery {
        query: Some("anchor".to_string()),
        filters: TrackFilters {
            genre: vec!["deep house".to_string()],
            bpm_min: Some(100.0),
            ..Default::default()
        },
        ..Default::default()
    };
    // Seeded rows carry NULL bpm, so the bounded read is empty — which only
    // holds if the search, genre and bpm bounds all bind into the WHERE
    // clause in the order the placeholders are numbered.
    assert!(
        titles(&conn, &query).is_empty(),
        "NULL bpm must fail the bound"
    );

    let search_only = TrackQuery {
        query: Some("anchor".to_string()),
        ..Default::default()
    };
    let built = search_only
        .build("id, title", 1, 1)
        .expect("query must build");
    let page = select_titles(&conn, &built);
    // Matches are t1 and t2; created_at ties, id ASC breaks it, so page 2
    // of size 1 holds Anchor Two.
    assert_eq!(page, ["Anchor Two"]);
    assert_eq!(count(&conn, &built), 2, "count ignores pagination");
}

#[test]
fn present_file_paths_sql_feeds_the_library_wide_folder_counts() {
    let conn = seeded();
    let mut stmt = conn
        .prepare(PRESENT_FILE_PATHS_SQL)
        .expect("the read must run on the app schema");
    let paths: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .expect("paths must read")
        .flatten()
        .collect();
    let counts = folder_counts_from_paths(paths);
    // t2's backslash spelling folds into /music/house (the fold is on the
    // lower-cased key; the representative keeps one raw spelling); the
    // removed t7 is out.
    let house = counts
        .iter()
        .find(|(folder, _)| folder.to_lowercase() == "/music/house");
    assert!(house.is_some(), "House must appear: {counts:?}");
    assert_eq!(house.expect("checked above").1, 3, "t1, t2 and t5");
    assert!(
        counts.iter().all(|(folder, _)| !folder.contains('\\')),
        "separator spellings must fold into one key: {counts:?}"
    );
}

/// The seeded library plus a tag vocabulary: two spellings on t1, one on t2,
/// and one on the soft-removed t7 that every read must hide.
fn tagged() -> Connection {
    let conn = seeded();
    for (id, tag) in [
        ("t1", "Melodic House"),
        ("t1", "melodic house "),
        ("t2", "Melodic House"),
        ("t7", "Removed Tag"),
    ] {
        conn.execute(
            "INSERT INTO track_tags (track_id, tag) VALUES (?1, ?2)",
            params![id, tag],
        )
        .expect("tag insert must succeed");
    }
    conn
}

fn vocabulary(conn: &Connection, ids: Option<&[String]>) -> Vec<(String, String)> {
    let read = tag_vocabulary_rows(ids).expect("the read must build");
    let mut stmt = conn
        .prepare(&read.sql)
        .expect("the read must run on the app schema");
    stmt.query_map(rusqlite::params_from_iter(read.params.iter()), |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })
    .expect("the vocabulary must bind and run")
    .collect::<Result<Vec<_>, _>>()
    .expect("every vocabulary row must decode")
}

#[test]
fn the_tag_vocabulary_runs_and_excludes_soft_removed_tracks() {
    let conn = tagged();
    let mut rows = vocabulary(&conn, None);
    rows.sort();
    assert_eq!(
        rows,
        [
            ("t1".to_string(), "Melodic House".to_string()),
            ("t1".to_string(), "melodic house ".to_string()),
            ("t2".to_string(), "Melodic House".to_string()),
        ],
        "t7's tag must stay hidden with its track"
    );
}

#[test]
fn the_tag_vocabulary_honours_an_id_list() {
    let conn = tagged();
    let rows = vocabulary(&conn, Some(&["t2".to_string()]));
    assert_eq!(rows, [("t2".to_string(), "Melodic House".to_string())]);
}

#[test]
fn the_vocabulary_rows_feed_the_clustering_engine_end_to_end() {
    let conn = tagged();
    let rows = vocabulary(&conn, None);
    let mut by_tag: std::collections::BTreeMap<String, Vec<String>> =
        std::collections::BTreeMap::new();
    for (track_id, tag) in rows {
        by_tag.entry(tag).or_default().push(track_id);
    }
    let values: Vec<TagValue> = by_tag
        .into_iter()
        .map(|(raw, track_ids)| TagValue { raw, track_ids })
        .collect();
    let report = cluster_tags(&values);
    // Two distinct spellings — the three rows group into two vocabulary entries.
    assert_eq!(report.scanned_tags, 2);
    assert_eq!(report.clusters.len(), 1);
    assert_eq!(report.clusters[0].key, "melodic house");
    // t1 carries both spellings; the union is {t1, t2}, not a sum of 3.
    assert_eq!(report.clusters[0].distinct_track_count, 2);
}
