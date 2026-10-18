//! Persistence and command-layer tests.
//!
//! `commands.rs::list_tracks` and `get_track` are Tauri commands, so they cannot be
//! called directly without an app handle. These tests exercise the *same* SQL and
//! row-mapping contracts against a **file-backed** database, which lets them cover
//! the two things Phase 0 still needed human proof for:
//!
//! * **P0.8** — data survives a full close/reopen of the database (the real
//!   "restart the app" behaviour, minus the window).
//! * **P0.6** — the exact column lists the list/detail UI renders are selectable
//!   and map to the expected values.
//!
//! File-backed rather than in-memory is the point: an in-memory database cannot
//! demonstrate persistence.

use std::path::PathBuf;

use rusqlite::{params, Connection};

use dj_assistant_schema_tests::open_migrated_at;

/// Mirrors `list_tracks`'s unfiltered SELECT built by
/// `crates/core/src/library_query.rs`: newest first, with `id` as the stable
/// tiebreaker and LIMIT/OFFSET bound as parameters.
const LIST_TRACKS_SQL: &str =
    "SELECT id, file_path, file_hash, title, artist, album, genre, bpm, key_camelot, key_classical, \
     duration_ms, format, analysis_status, user_rating, comments, artwork_hash, created_at, updated_at \
     FROM tracks ORDER BY created_at DESC, id ASC LIMIT ?1 OFFSET ?2";

/// Mirrors the search SELECT (four repeated `?1` binds plus `ESCAPE` so `%`/`_`
/// in the search box match literally).
const SEARCH_TRACKS_SQL: &str = "SELECT id, file_path, file_hash, title, artist, album, genre, bpm, key_camelot, key_classical, \
     duration_ms, format, analysis_status, user_rating, comments, artwork_hash, created_at, updated_at \
     FROM tracks \
     WHERE (LOWER(title) LIKE ?1 ESCAPE '\\' \
        OR LOWER(artist) LIKE ?1 ESCAPE '\\' \
        OR LOWER(album) LIKE ?1 ESCAPE '\\' \
        OR LOWER(file_path) LIKE ?1 ESCAPE '\\') \
     ORDER BY created_at DESC, id ASC LIMIT ?2 OFFSET ?3";

/// Mirrors the count queries emitted by the query builder.
const COUNT_ALL_SQL: &str = "SELECT COUNT(*) FROM tracks";
const COUNT_SEARCH_SQL: &str = "SELECT COUNT(*) FROM tracks \
     WHERE (LOWER(title) LIKE ?1 ESCAPE '\\' \
        OR LOWER(artist) LIKE ?1 ESCAPE '\\' \
        OR LOWER(album) LIKE ?1 ESCAPE '\\' \
        OR LOWER(file_path) LIKE ?1 ESCAPE '\\')";

/// Mirrors the builder's filtered SELECT for
/// `{bpmMin: 120, bpmMax: 130, keyCamelot: ["8a"], analysisStatus: ["complete"],
/// genre: ["techno"], ratingMin: 3, sortBy: "bpm", sortDir: "asc"}`.
const FILTER_TRACKS_SQL: &str = "SELECT id, title FROM tracks \
     WHERE bpm >= ?1 AND bpm <= ?2 \
       AND UPPER(key_camelot) IN (?3) \
       AND LOWER(analysis_status) IN (?4) \
       AND LOWER(TRIM(genre)) IN (?5) \
       AND user_rating >= ?6 \
     ORDER BY bpm IS NULL, bpm ASC, id ASC LIMIT ?7 OFFSET ?8";

/// Count half of the same filtered query (no LIMIT/OFFSET placeholders).
const COUNT_FILTER_SQL: &str = "SELECT COUNT(*) FROM tracks \
     WHERE bpm >= ?1 AND bpm <= ?2 \
       AND UPPER(key_camelot) IN (?3) \
       AND LOWER(analysis_status) IN (?4) \
       AND LOWER(TRIM(genre)) IN (?5) \
       AND user_rating >= ?6";

/// Mirrors the builder's `{sortBy: "bpm", sortDir: "asc"}` SELECT: unknown BPMs
/// sort last in both directions.
const SORT_BPM_SQL: &str = "SELECT id, title FROM tracks \
     ORDER BY bpm IS NULL, bpm ASC, id ASC LIMIT ?1 OFFSET ?2";

/// Escapes `LIKE` wildcards the way the query builder does, so a search for a
/// literal `%`, `_` or `\` behaves the same here as in the app.
fn like_pattern(term: &str) -> String {
    let escaped = term
        .to_ascii_lowercase()
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}

/// The 18 columns `map_track_summary` reads, in order.
#[derive(Debug, PartialEq)]
struct TrackRow {
    id: String,
    file_path: String,
    file_hash: String,
    title: String,
    artist: String,
    album: Option<String>,
    genre: Option<String>,
    bpm: Option<f64>,
    key_camelot: Option<String>,
    key_classical: Option<String>,
    duration_ms: i64,
    format: Option<String>,
    analysis_status: String,
    user_rating: Option<i64>,
    comments: Option<String>,
    artwork_hash: Option<String>,
    created_at: String,
    updated_at: String,
}

fn map_row(row: &rusqlite::Row) -> rusqlite::Result<TrackRow> {
    Ok(TrackRow {
        id: row.get(0)?,
        file_path: row.get(1)?,
        file_hash: row.get(2)?,
        title: row.get(3)?,
        artist: row.get(4)?,
        album: row.get(5)?,
        genre: row.get(6)?,
        bpm: row.get(7)?,
        key_camelot: row.get(8)?,
        key_classical: row.get(9)?,
        duration_ms: row.get(10)?,
        format: row.get(11)?,
        analysis_status: row.get(12)?,
        user_rating: row.get(13)?,
        comments: row.get(14)?,
        artwork_hash: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

/// Fields for a seeded track, mirroring the scanner's INSERT.
struct SeedTrack<'a> {
    id: &'a str,
    title: &'a str,
    artist: &'a str,
    album: Option<&'a str>,
    duration_ms: i64,
    hash: &'a str,
    created_at: &'a str,
}

/// Inserts one track, mirroring the scanner's INSERT.
fn insert_track(conn: &Connection, track: &SeedTrack<'_>) {
    conn.execute(
        "INSERT INTO tracks (
            id, workspace_id, file_path, file_hash, file_size, duration_ms, format,
            title, artist, album, genre, year, analysis_status, created_at, updated_at
        ) VALUES (?1, 'default', ?2, ?3, ?4, ?5, 'flac', ?6, ?7, ?8, 'House', 2024, 'pending', ?9, ?9)",
        params![
            track.id,
            format!("D:\\Music\\{}.flac", track.title),
            track.hash,
            1024i64,
            track.duration_ms,
            track.title,
            track.artist,
            track.album,
            track.created_at,
        ],
    )
    .expect("track insert must succeed");
}

fn temp_db(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join("dj-assistant-persistence");
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join(name);
    // Start from a clean slate so re-runs are deterministic.
    for suffix in ["", "-wal", "-shm"] {
        let _ = std::fs::remove_file(format!("{}{}", path.display(), suffix));
    }
    path
}

#[test]
fn library_survives_a_full_close_and_reopen() {
    // P0.8: the real "restart the app" behaviour. Database::new opens the file and
    // runs migrations; closing it and constructing a new Database must find the
    // previously imported tracks, with migration 001 not re-applied destructively.
    let db_path = temp_db("persistence.db");

    let expected_titles = ["Midnight Groove", "Warehouse Pulse", "Rolling Deep"];

    {
        let conn = open_migrated_at(&db_path);
        for (i, title) in expected_titles.iter().enumerate() {
            insert_track(
                &conn,
                &SeedTrack {
                    id: &format!("track-{i}"),
                    title,
                    artist: "Test Artist",
                    album: Some("Test Album"),
                    duration_ms: 180_000 + i as i64,
                    hash: &format!("hash-{i}"),
                    created_at: &format!("2026-01-0{}T00:00:00Z", i + 1),
                },
            );
        }
        let count: i64 = conn.query_row(COUNT_ALL_SQL, [], |r| r.get(0)).unwrap();
        assert_eq!(count, 3, "three tracks written before closing");
        // `conn` (and the Database) is dropped here — equivalent to quitting the app.
    }

    // --- Reopen, as a fresh launch would ---
    let conn = open_migrated_at(&db_path);

    let count: i64 = conn.query_row(COUNT_ALL_SQL, [], |r| r.get(0)).unwrap();
    assert_eq!(count, 3, "tracks must survive a reopen");

    let titles: Vec<String> = conn
        .prepare(LIST_TRACKS_SQL)
        .unwrap()
        .query_map(params![200i64, 0i64], |r| r.get::<_, String>(3))
        .unwrap()
        .map(Result::unwrap)
        .collect();

    // ORDER BY created_at DESC -> most recent first.
    assert_eq!(
        titles,
        vec!["Rolling Deep", "Warehouse Pulse", "Midnight Groove"]
    );

    let migrations: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(migrations, 1, "migration must not be re-stamped on reopen");

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn list_tracks_returns_every_ui_field_with_correct_values() {
    // P0.6: the list UI renders these fields; assert they are selectable and map.
    let db_path = temp_db("list-fields.db");
    let conn = open_migrated_at(&db_path);

    insert_track(
        &conn,
        &SeedTrack {
            id: "t1",
            title: "Midnight Groove",
            artist: "Kaspar Nyx",
            album: Some("Deep Cuts Vol. 1"),
            duration_ms: 937,
            hash: "abc123",
            created_at: "2026-01-01T00:00:00Z",
        },
    );

    let mut stmt = conn.prepare(LIST_TRACKS_SQL).unwrap();
    let rows: Vec<TrackRow> = stmt
        .query_map(params![200i64, 0i64], map_row)
        .unwrap()
        .map(Result::unwrap)
        .collect();

    assert_eq!(rows.len(), 1);
    let row = &rows[0];
    assert_eq!(row.id, "t1");
    assert_eq!(row.title, "Midnight Groove");
    assert_eq!(row.artist, "Kaspar Nyx");
    assert_eq!(row.album.as_deref(), Some("Deep Cuts Vol. 1"));
    assert_eq!(row.genre.as_deref(), Some("House"));
    assert_eq!(row.format.as_deref(), Some("flac"));
    assert_eq!(row.duration_ms, 937, "duration must be a real value, not 0");
    assert_eq!(row.analysis_status, "pending");
    assert!(row.file_path.ends_with("Midnight Groove.flac"));

    // Not-yet-analysed fields are NULL rather than fabricated.
    assert_eq!(row.bpm, None);
    assert_eq!(row.key_camelot, None);
    assert_eq!(row.user_rating, None);

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn list_tracks_paginates_with_limit_and_offset() {
    let db_path = temp_db("pagination.db");
    let conn = open_migrated_at(&db_path);

    for i in 0..5 {
        insert_track(
            &conn,
            &SeedTrack {
                id: &format!("t{i}"),
                title: &format!("Track {i}"),
                artist: "Artist",
                album: None,
                duration_ms: 1000,
                hash: &format!("hash-{i}"),
                created_at: &format!("2026-01-0{}T00:00:00Z", i + 1),
            },
        );
    }

    let page: Vec<String> = conn
        .prepare(LIST_TRACKS_SQL)
        .unwrap()
        .query_map(params![2i64, 0i64], |r| r.get::<_, String>(3))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(page, vec!["Track 4", "Track 3"], "first page, newest first");

    let page2: Vec<String> = conn
        .prepare(LIST_TRACKS_SQL)
        .unwrap()
        .query_map(params![2i64, 2i64], |r| r.get::<_, String>(3))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(
        page2,
        vec!["Track 2", "Track 1"],
        "offset must skip the first page"
    );

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn search_matches_title_artist_album_and_path_case_insensitively() {
    // P0.6: the search box in the UI. Mirrors commands.rs's LOWER(...) LIKE ?1.
    let db_path = temp_db("search.db");
    let conn = open_migrated_at(&db_path);

    insert_track(
        &conn,
        &SeedTrack {
            id: "t1",
            title: "Midnight Groove",
            artist: "Kaspar Nyx",
            album: Some("Deep Cuts"),
            duration_ms: 900,
            hash: "h1",
            created_at: "2026-01-01T00:00:00Z",
        },
    );
    insert_track(
        &conn,
        &SeedTrack {
            id: "t2",
            title: "Warehouse Pulse",
            artist: "Anhalt",
            album: Some("Berlin Sessions"),
            duration_ms: 900,
            hash: "h2",
            created_at: "2026-01-02T00:00:00Z",
        },
    );

    let search = |term: &str| -> Vec<String> {
        let like = like_pattern(term);
        conn.prepare(SEARCH_TRACKS_SQL)
            .unwrap()
            .query_map(params![like, 200i64, 0i64], |r| r.get::<_, String>(3))
            .unwrap()
            .map(Result::unwrap)
            .collect()
    };

    assert_eq!(search("midnight"), vec!["Midnight Groove"], "matches title");
    assert_eq!(
        search("MIDNIGHT"),
        vec!["Midnight Groove"],
        "search is case-insensitive"
    );
    assert_eq!(search("anhalt"), vec!["Warehouse Pulse"], "matches artist");
    assert_eq!(search("berlin"), vec!["Warehouse Pulse"], "matches album");
    assert_eq!(
        search("kaspar"),
        vec!["Midnight Groove"],
        "matches artist again"
    );
    assert_eq!(
        search("\\music\\"),
        vec!["Warehouse Pulse", "Midnight Groove"],
        "matches file path"
    );
    assert!(search("nonexistent-xyz").is_empty(), "no false positives");

    // The count query must agree with the row query, or the UI total lies.
    for term in ["midnight", "anhalt", "house", "nonexistent-xyz"] {
        let like = like_pattern(term);
        let total: i64 = conn
            .query_row(COUNT_SEARCH_SQL, params![like], |r| r.get(0))
            .unwrap();
        assert_eq!(
            total as usize,
            search(term).len(),
            "count/rows disagree for {term:?}"
        );
    }

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn get_track_returns_a_detail_row_and_its_cues() {
    // P0.6 / cue contract: the detail query's 25 columns plus its cue join.
    let db_path = temp_db("detail.db");
    let conn = open_migrated_at(&db_path);
    insert_track(
        &conn,
        &SeedTrack {
            id: "t1",
            title: "Midnight Groove",
            artist: "Kaspar Nyx",
            album: Some("Deep Cuts"),
            duration_ms: 937,
            hash: "h1",
            created_at: "2026-01-01T00:00:00Z",
        },
    );

    conn.execute(
        "INSERT INTO cue_points (id, track_id, position_ms, cue_type, slot, label, color_hex, source)
         VALUES ('c1', 't1', 1500, 'hot_cue', 1, 'Intro', '#3b82f6', 'ai_generated')",
        [],
    )
    .unwrap();

    let detail_sql =
        "SELECT id, file_path, file_hash, title, artist, album, genre, bpm, key_camelot, \
         duration_ms, format, analysis_status, user_rating, created_at, updated_at, \
         file_size, sample_rate, channels, bit_depth, key_classical, loudness_lufs, \
         vocal_presence, phrase_confidence, analysis_version, notes \
         FROM tracks WHERE id = ?";

    let (title, file_size): (String, i64) = conn
        .query_row(detail_sql, params!["t1"], |r| Ok((r.get(3)?, r.get(15)?)))
        .expect("detail query must match the schema");
    assert_eq!(title, "Midnight Groove");
    assert_eq!(file_size, 1024);

    let cues: Vec<(i64, String, String)> = conn
        .prepare(
            "SELECT id, track_id, slot, position_ms, label, cue_type, color_hex, source, created_at
             FROM cue_points WHERE track_id = ? ORDER BY position_ms ASC",
        )
        .unwrap()
        .query_map(params!["t1"], |r| {
            Ok((
                r.get::<_, i64>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, String>(7)?,
            ))
        })
        .unwrap()
        .map(Result::unwrap)
        .collect();

    assert_eq!(
        cues,
        vec![(1500, "Intro".to_string(), "ai_generated".to_string())]
    );

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn analysis_status_accepts_needs_review_and_complete() {
    // T1.2.4: the persist path writes 'needs_review' when signals are missing
    // and 'complete' when all analyzers succeeded. This test mirrors the exact
    // UPDATE from analysis.rs::persist_analysis_results and verifies both
    // statuses are storable and readable.
    let db_path = temp_db("analysis-status.db");
    let conn = open_migrated_at(&db_path);
    insert_track(
        &conn,
        &SeedTrack {
            id: "t1",
            title: "Test Track",
            artist: "Artist",
            album: None,
            duration_ms: 1000,
            hash: "h1",
            created_at: "2026-01-01T00:00:00Z",
        },
    );

    // Mirror the UPDATE from persist_analysis_results with needs_review.
    conn.execute(
        "UPDATE tracks SET
            bpm = ?1,
            key_camelot = ?2,
            key_classical = ?3,
            loudness_lufs = ?4,
            vocal_presence = ?5,
            phrase_confidence = ?6,
            analysis_status = ?7,
            analysis_version = ?8,
            updated_at = ?9
         WHERE id = ?10",
        params![
            None::<f64>,
            None::<String>,
            None::<String>,
            None::<f64>,
            0i64,
            None::<f64>,
            "needs_review",
            "test-v1",
            "2026-01-02T00:00:00Z",
            "t1",
        ],
    )
    .expect("needs_review UPDATE must succeed");

    let status: String = conn
        .query_row(
            "SELECT analysis_status FROM tracks WHERE id = 't1'",
            [],
            |r| r.get(0),
        )
        .expect("analysis_status must be readable");
    assert_eq!(status, "needs_review");

    // Now write complete with all signals present.
    conn.execute(
        "UPDATE tracks SET
            bpm = ?1,
            key_camelot = ?2,
            key_classical = ?3,
            loudness_lufs = ?4,
            vocal_presence = ?5,
            phrase_confidence = ?6,
            analysis_status = ?7,
            analysis_version = ?8,
            updated_at = ?9
         WHERE id = ?10",
        params![
            128.0f64,
            "8A",
            "A minor",
            -8.0f64,
            0i64,
            0.75f64,
            "complete",
            "test-v1",
            "2026-01-02T00:00:00Z",
            "t1",
        ],
    )
    .expect("complete UPDATE must succeed");

    let status: String = conn
        .query_row(
            "SELECT analysis_status FROM tracks WHERE id = 't1'",
            [],
            |r| r.get(0),
        )
        .expect("analysis_status must be readable");
    assert_eq!(status, "complete");

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn concurrent_second_connection_sees_committed_tracks() {
    // The app holds one connection; a second reader (e.g. a future CLI or test) must
    // see committed rows. This is what makes WAL mode useful and proves durability
    // rather than just in-process visibility.
    let db_path = temp_db("second-connection.db");

    let writer = open_migrated_at(&db_path);
    insert_track(
        &writer,
        &SeedTrack {
            id: "t1",
            title: "Committed Track",
            artist: "Artist",
            album: None,
            duration_ms: 1000,
            hash: "h1",
            created_at: "2026-01-01T00:00:00Z",
        },
    );

    let reader = Connection::open(&db_path).expect("second connection must open");
    let count: i64 = reader.query_row(COUNT_ALL_SQL, [], |r| r.get(0)).unwrap();
    assert_eq!(count, 1, "a second connection must see committed tracks");

    drop(reader);
    drop(writer);
    let _ = std::fs::remove_file(&db_path);
}

/// Inserts a track with analysis/tag values populated, for filter tests.
#[allow(clippy::too_many_arguments)]
fn insert_filterable_track(
    conn: &Connection,
    id: &str,
    genre: &str,
    bpm: Option<f64>,
    key_camelot: Option<&str>,
    analysis_status: &str,
    user_rating: Option<i64>,
) {
    conn.execute(
        "INSERT INTO tracks (
            id, workspace_id, file_path, file_hash, file_size, duration_ms, format,
            title, artist, album, genre, year, bpm, key_camelot, key_classical,
            analysis_status, user_rating, created_at, updated_at
        ) VALUES (?1, 'default', ?2, ?3, 1024, 180000, 'flac', ?1, 'Artist', NULL, ?4, 2024,
                  ?5, ?6, NULL, ?7, ?8, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![
            id,
            format!("D:\\Music\\{id}.flac"),
            format!("hash-{id}"),
            genre,
            bpm,
            key_camelot,
            analysis_status,
            user_rating,
        ],
    )
    .expect("filterable track insert must succeed");
}

#[test]
fn filtered_list_query_narrows_on_bpm_key_status_genre_and_rating() {
    // T2.1.2: the library filter panel. This mirrors the exact SQL emitted by
    // `crates/core/src/library_query.rs` for the representative filter set on
    // FILTER_TRACKS_SQL, so a schema/query drift fails here.
    let db_path = temp_db("filters.db");
    let conn = open_migrated_at(&db_path);

    //                      id    genre     bpm    key     status       rating
    insert_filterable_track(
        &conn,
        "t1",
        "Techno",
        Some(124.0),
        Some("8A"),
        "complete",
        Some(4),
    ); // match
    insert_filterable_track(
        &conn,
        "t2",
        "Techno",
        Some(140.0),
        Some("8A"),
        "complete",
        Some(4),
    ); // bpm high
    insert_filterable_track(
        &conn,
        "t3",
        "House",
        Some(124.0),
        Some("8A"),
        "complete",
        Some(4),
    ); // genre
    insert_filterable_track(
        &conn,
        "t4",
        "Techno",
        Some(124.0),
        Some("8A"),
        "pending",
        Some(4),
    ); // status
    insert_filterable_track(
        &conn,
        "t5",
        "Techno",
        Some(124.0),
        Some("9A"),
        "complete",
        Some(4),
    ); // key
    insert_filterable_track(
        &conn,
        "t6",
        "Techno",
        Some(124.0),
        Some("8A"),
        "complete",
        Some(1),
    ); // rating
    insert_filterable_track(
        &conn,
        "t7",
        "Techno",
        Some(120.0),
        Some("8A"),
        "complete",
        Some(3),
    ); // match (bounds)
    insert_filterable_track(&conn, "t8", "Techno", None, Some("8A"), "complete", Some(3)); // no bpm

    let ids: Vec<String> = conn
        .prepare(FILTER_TRACKS_SQL)
        .unwrap()
        .query_map(
            params![120.0f64, 130.0f64, "8A", "complete", "techno", 3i64, 200i64, 0i64],
            |r| r.get(0),
        )
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(
        ids,
        vec!["t7".to_string(), "t1".to_string()],
        "only in-range, matching tracks survive; ASC BPM puts 120 before 124"
    );

    let total: i64 = conn
        .query_row(
            COUNT_FILTER_SQL,
            params![120.0f64, 130.0f64, "8A", "complete", "techno", 3i64],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(total as usize, ids.len(), "count/rows must agree");

    // Unfiltered BPM ordering: NULLs last, ascending otherwise.
    let bpm_sorted_ids: Vec<String> = conn
        .prepare(SORT_BPM_SQL)
        .unwrap()
        .query_map(params![200i64, 0i64], |r| r.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(
        bpm_sorted_ids.last().map(String::as_str),
        Some("t8"),
        "a NULL bpm sorts last, so unanalyzed tracks never lead the list"
    );

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn filtered_query_survives_case_variant_tags() {
    // The scanner stores whatever the file tags say ("TECHNO", "Techno"), while
    // the filter panel sends a single canonical option. Lower/upper-casing in
    // SQL must collapse them.
    let db_path = temp_db("filter-case.db");
    let conn = open_migrated_at(&db_path);

    insert_filterable_track(
        &conn,
        "a",
        "TECHNO",
        Some(128.0),
        Some("8A"),
        "COMPLETE",
        Some(5),
    );
    insert_filterable_track(
        &conn,
        "b",
        "techno",
        Some(126.0),
        Some("8a"),
        "complete",
        Some(3),
    );

    let ids: Vec<String> = conn
        .prepare(FILTER_TRACKS_SQL)
        .unwrap()
        .query_map(
            params![120.0f64, 130.0f64, "8A", "complete", "techno", 3i64, 200i64, 0i64],
            |r| r.get(0),
        )
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(ids, vec!["b".to_string(), "a".to_string()]);

    let _ = std::fs::remove_file(&db_path);
}
