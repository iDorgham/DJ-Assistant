//! Contract tests for the library source branches (T2.1.12).
//!
//! The category / folder / reserved-source logic lives in
//! `crates/core/src/library_query.rs`; its unit tests only render SQL text.
//! Project rules additionally require a case in `tests/schema/tests/` that executes
//! the built statement against the real migrated schema, which is what this
//! file does - including the case-fold agreement with the folder list and the
//! separator-boundary behaviour the review rounds kept tripping over.

use dj_assistant_core::library_query::{QueryParam, TrackQuery};
use dj_assistant_schema_tests::open_migrated;
use rusqlite::{params, Connection};

fn insert(conn: &Connection, id: &str, genre: &str, file_path: &str) {
    conn.execute(
        "
INSERT INTO tracks (
            id, workspace_id, file_path, file_hash, file_size, duration_ms, format,
            title, artist, album, genre, year, analysis_status,
            created_at, updated_at
        ) VALUES (?1, 'default', ?2, ?3, 1024, 240000, 'mp3', ?1, 'A', 'B', ?4,
                  2024, 'complete', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
        ",
        params![id, file_path, format!("hash-{id}"), genre],
    )
    .expect("track insert must succeed");
}

/// One library covering every source branch: genre case variants, a
/// backslash path, a descendant folder, a sibling-prefix folder, a POSIX
/// path for the root branch, and a Techno row none of the House filters may
/// pick up.
fn seeded() -> Connection {
    let conn = open_migrated();
    insert(&conn, "t1", "House", "D:/Music/House/a.mp3");
    insert(&conn, "t2", "house ", "D:\\Music\\House\\b.mp3");
    insert(&conn, "t3", "HOUSE", "E:/Other/c.mp3");
    insert(&conn, "t4", "Techno", "/mnt/music/d.mp3");
    insert(&conn, "t5", "Deep House", "D:/Music/House/Sub/e.mp3");
    insert(&conn, "t6", "House", "D:/Music/HouseX/f.mp3");
    conn
}

/// Runs the built list statement for a query and returns the matched ids.
fn matched(conn: &Connection, request: &TrackQuery) -> Vec<String> {
    let built = request
        .build("id", 1000, 0)
        .expect("source queries must validate");
    let mut stmt = conn
        .prepare(&built.select_sql)
        .expect("select must prepare");
    for (index, param) in built.params.iter().enumerate() {
        match param {
            QueryParam::Text(value) => stmt
                .raw_bind_parameter(index + 1, value.as_str())
                .expect("text bind"),
            QueryParam::Int(value) => stmt.raw_bind_parameter(index + 1, value).expect("int bind"),
            QueryParam::Real(value) => stmt
                .raw_bind_parameter(index + 1, value)
                .expect("real bind"),
        }
    }
    let mut rows = Vec::new();
    let mut mapped = stmt.raw_query();
    while let Some(row) = mapped.next().expect("row read") {
        rows.push(row.get::<_, String>(0).expect("id column"));
    }
    rows.sort();
    rows
}

fn source(kind: &str, id: Option<&str>) -> TrackQuery {
    TrackQuery {
        source: Some(kind.to_string()),
        source_id: id.map(str::to_string),
        ..TrackQuery::default()
    }
}

#[test]
fn category_narrows_by_genre_with_sql_case_folding() {
    let conn = seeded();
    assert_eq!(
        matched(&conn, &source("category", Some(" house "))),
        ["t1", "t2", "t3", "t6"],
        "LOWER(TRIM(genre)) must fold ASCII case and trim, matching the folder list"
    );
    assert_eq!(
        matched(&conn, &source("category", Some("Deep House"))),
        ["t5"]
    );
}

#[test]
fn folder_is_recursive_and_stops_at_the_separator_boundary() {
    let conn = seeded();
    assert_eq!(
        matched(&conn, &source("folder", Some("D:/Music/House"))),
        ["t1", "t2", "t5"],
        "descendants match; the HouseX sibling prefix must not"
    );
    assert_eq!(
        matched(&conn, &source("folder", Some("D:\\Music\\House\\"))),
        ["t1", "t2", "t5"],
        "platform separators and trailing slashes normalise away"
    );
}

#[test]
fn folder_root_keeps_only_posix_paths() {
    let conn = seeded();
    assert_eq!(matched(&conn, &source("folder", Some("/"))), ["t4"]);
}

#[test]
fn reserved_and_unnarrowed_sources_match_the_contract() {
    let conn = seeded();
    assert!(matched(&conn, &source("playlist", Some("p1"))).is_empty());
    assert!(matched(&conn, &source("storage", Some("s1"))).is_empty());
    let all = matched(&conn, &source("category", None));
    assert_eq!(all.len(), 6, "an unset source id must not narrow");
    assert_eq!(matched(&conn, &source("folder", Some("  "))).len(), 6);
}
