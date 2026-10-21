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
     duration_ms, format, analysis_status, user_rating, energy, comments, artwork_hash, created_at, updated_at \
     FROM tracks ORDER BY created_at DESC, id ASC LIMIT ?1 OFFSET ?2";

/// Mirrors the search SELECT (four repeated `?1` binds plus `ESCAPE` so `%`/`_`
/// in the search box match literally).
const SEARCH_TRACKS_SQL: &str = "SELECT id, file_path, file_hash, title, artist, album, genre, bpm, key_camelot, key_classical, \
     duration_ms, format, analysis_status, user_rating, energy, comments, artwork_hash, created_at, updated_at \
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
/// genre: ["techno"], ratingMin: 3, energyMin: 4, energyMax: 6, sortBy: "bpm",
/// sortDir: "asc"}`.
const FILTER_TRACKS_SQL: &str = "SELECT id, title FROM tracks \
     WHERE bpm >= ?1 AND bpm <= ?2 \
       AND UPPER(key_camelot) IN (?3) \
       AND LOWER(analysis_status) IN (?4) \
       AND LOWER(TRIM(genre)) IN (?5) \
       AND user_rating >= ?6 \
       AND energy >= ?7 AND energy <= ?8 \
     ORDER BY bpm IS NULL, bpm ASC, id ASC LIMIT ?9 OFFSET ?10";

/// Count half of the same filtered query (no LIMIT/OFFSET placeholders).
const COUNT_FILTER_SQL: &str = "SELECT COUNT(*) FROM tracks \
     WHERE bpm >= ?1 AND bpm <= ?2 \
       AND UPPER(key_camelot) IN (?3) \
       AND LOWER(analysis_status) IN (?4) \
       AND LOWER(TRIM(genre)) IN (?5) \
       AND user_rating >= ?6 \
       AND energy >= ?7 AND energy <= ?8";

/// Mirrors the builder's `{sortBy: "bpm", sortDir: "asc"}` SELECT: unknown BPMs
/// sort last in both directions.
const SORT_BPM_SQL: &str = "SELECT id, title FROM tracks \
     ORDER BY bpm IS NULL, bpm ASC, id ASC LIMIT ?1 OFFSET ?2";

/// Mirrors the builder's filtered SELECT for
/// `{ratingMin: 4, energyMin: 5, energyMax: 7, sortBy: "energy", sortDir: "asc"}`.
const ENERGY_RATED_SQL: &str = "SELECT id FROM tracks \
     WHERE user_rating >= ?1 \
       AND energy >= ?2 AND energy <= ?3 \
     ORDER BY energy IS NULL, energy ASC, id ASC LIMIT ?4 OFFSET ?5";

/// Count half of the energy/rating filtered query (no LIMIT/OFFSET placeholders).
const COUNT_ENERGY_RATED_SQL: &str = "SELECT COUNT(*) FROM tracks \
     WHERE user_rating >= ?1 \
       AND energy >= ?2 AND energy <= ?3";

/// Mirrors the builder for `{sortBy: "energy", sortDir: "desc"}`: the
/// highest energy first, unrated tracks last.
const SORT_ENERGY_DESC_SQL: &str = "SELECT id FROM tracks \
     ORDER BY energy IS NULL, energy DESC, id ASC LIMIT ?1 OFFSET ?2";

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

/// The 19 columns `map_track_summary` reads, in order.
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
    energy: Option<i64>,
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
        energy: row.get(14)?,
        comments: row.get(15)?,
        artwork_hash: row.get(16)?,
        created_at: row.get(17)?,
        updated_at: row.get(18)?,
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
    // P0.6 / cue contract: the detail query's 28 columns plus its cue join.
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

    // An energy level the detail row must carry through (T2.1.6).
    conn.execute("UPDATE tracks SET energy = 7 WHERE id = 't1'", [])
        .unwrap();

    conn.execute(
        "INSERT INTO cue_points (id, track_id, position_ms, cue_type, slot, label, color_hex, source)
         VALUES ('c1', 't1', 1500, 'hot_cue', 1, 'Intro', '#3b82f6', 'ai_generated')",
        [],
    )
    .unwrap();

    // Mirrors `commands.rs::get_track`: the summary projection
    // (`TRACK_SUMMARY_COLUMNS`) followed by the detail-only columns. The
    // summary part carries `energy`, so the detail row cannot drift from the
    // new summary contract without breaking this test.
    let detail_sql = "SELECT id, file_path, file_hash, title, artist, album, genre, bpm, \
         key_camelot, key_classical, duration_ms, format, analysis_status, \
         user_rating, energy, comments, artwork_hash, created_at, updated_at, \
         file_size, sample_rate, channels, bit_depth, loudness_lufs, \
         vocal_presence, phrase_confidence, analysis_version, notes \
         FROM tracks WHERE id = ?";

    let (title, file_size, energy): (String, i64, Option<i64>) = conn
        .query_row(detail_sql, params!["t1"], |r| {
            Ok((r.get(3)?, r.get(19)?, r.get(14)?))
        })
        .expect("detail query must match the schema");
    assert_eq!(title, "Midnight Groove");
    assert_eq!(file_size, 1024);
    assert_eq!(energy, Some(7), "the detail row carries the energy level");

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
    energy: Option<i64>,
) {
    conn.execute(
        "INSERT INTO tracks (
            id, workspace_id, file_path, file_hash, file_size, duration_ms, format,
            title, artist, album, genre, year, bpm, key_camelot, key_classical,
            analysis_status, user_rating, energy, created_at, updated_at
        ) VALUES (?1, 'default', ?2, ?3, 1024, 180000, 'flac', ?1, 'Artist', NULL, ?4, 2024,
                  ?5, ?6, NULL, ?7, ?8, ?9, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        params![
            id,
            format!("D:\\Music\\{id}.flac"),
            format!("hash-{id}"),
            genre,
            bpm,
            key_camelot,
            analysis_status,
            user_rating,
            energy,
        ],
    )
    .expect("filterable track insert must succeed");
}

#[test]
fn filtered_list_query_narrows_on_bpm_key_status_genre_rating_and_energy() {
    // T2.1.2: the library filter panel. This mirrors the exact SQL emitted by
    // `crates/core/src/library_query.rs` for the representative filter set on
    // FILTER_TRACKS_SQL, so a schema/query drift fails here.
    let db_path = temp_db("filters.db");
    let conn = open_migrated_at(&db_path);

    //                      id    genre     bpm    key     status       rating  energy
    insert_filterable_track(
        &conn,
        "t1",
        "Techno",
        Some(124.0),
        Some("8A"),
        "complete",
        Some(4),
        Some(5),
    ); // match
    insert_filterable_track(
        &conn,
        "t2",
        "Techno",
        Some(140.0),
        Some("8A"),
        "complete",
        Some(4),
        Some(5),
    ); // bpm high
    insert_filterable_track(
        &conn,
        "t3",
        "House",
        Some(124.0),
        Some("8A"),
        "complete",
        Some(4),
        Some(5),
    ); // genre
    insert_filterable_track(
        &conn,
        "t4",
        "Techno",
        Some(124.0),
        Some("8A"),
        "pending",
        Some(4),
        Some(5),
    ); // status
    insert_filterable_track(
        &conn,
        "t5",
        "Techno",
        Some(124.0),
        Some("9A"),
        "complete",
        Some(4),
        Some(5),
    ); // key
    insert_filterable_track(
        &conn,
        "t6",
        "Techno",
        Some(124.0),
        Some("8A"),
        "complete",
        Some(1),
        Some(5),
    ); // rating
    insert_filterable_track(
        &conn,
        "t7",
        "Techno",
        Some(120.0),
        Some("8A"),
        "complete",
        Some(3),
        Some(5),
    ); // match (bounds)
    insert_filterable_track(
        &conn,
        "t8",
        "Techno",
        None,
        Some("8A"),
        "complete",
        Some(3),
        Some(5),
    ); // no bpm
    insert_filterable_track(
        &conn,
        "t9",
        "Techno",
        Some(124.0),
        Some("8A"),
        "complete",
        Some(4),
        Some(9),
    ); // energy out of range

    let ids: Vec<String> = conn
        .prepare(FILTER_TRACKS_SQL)
        .unwrap()
        .query_map(
            params![120.0f64, 130.0f64, "8A", "complete", "techno", 3i64, 4i64, 6i64, 200i64, 0i64],
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
            params![120.0f64, 130.0f64, "8A", "complete", "techno", 3i64, 4i64, 6i64],
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
        Some(5),
    );

    let ids: Vec<String> = conn
        .prepare(FILTER_TRACKS_SQL)
        .unwrap()
        .query_map(
            params![120.0f64, 130.0f64, "8A", "complete", "techno", 3i64, 4i64, 6i64, 200i64, 0i64],
            |r| r.get(0),
        )
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(ids, vec!["b".to_string(), "a".to_string()]);

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn migrated_schema_has_an_energy_column() {
    // T2.1.6: migration 006 adds the user-assigned energy level. The column
    // must be a nullable INTEGER: an unrated track stores NULL, and the energy
    // filter depends on that (a NULL never matches a bounded range).
    let db_path = temp_db("energy-column.db");
    let conn = open_migrated_at(&db_path);

    let mut stmt = conn
        .prepare("SELECT type, \"notnull\" FROM pragma_table_info('tracks') WHERE name = 'energy'")
        .expect("pragma_table_info must be queryable");
    let mut rows = stmt.query([]).expect("the tracks columns must be readable");
    let column = rows
        .next()
        .expect("tracks.energy must exist after migration 006")
        .expect("the pragma row must be readable");
    let column_type: String = column.get(0).expect("the column type must be readable");
    let not_null: i64 = column.get(1).expect("the notnull flag must be readable");
    assert_eq!(column_type, "INTEGER", "energy is stored as a whole number");
    assert_eq!(not_null, 0, "energy must stay nullable for unrated tracks");
    drop(rows);
    drop(stmt);

    let versions: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = 6",
            [],
            |r| r.get(0),
        )
        .expect("schema_migrations must be queryable");
    assert_eq!(versions, 1, "migration 006 must be recorded exactly once");

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn filtered_query_narrows_on_the_energy_range_and_the_rating_floor() {
    // T2.1.6: the energy filter is a bounded range over a nullable column and
    // it sits next to the rating floor. This mirrors the SQL emitted by
    // `crates/core/src/library_query.rs` for
    // `{ratingMin: 4, energyMin: 5, energyMax: 7, sortBy: "energy", sortDir: "asc"}`.
    let db_path = temp_db("energy-filter.db");
    let conn = open_migrated_at(&db_path);

    let seed = |id: &str, rating: Option<i64>, energy: Option<i64>| {
        insert_filterable_track(
            &conn,
            id,
            "House",
            Some(120.0),
            Some("8A"),
            "complete",
            rating,
            energy,
        );
    };

    seed("e1", Some(4), Some(5)); // match
    seed("e2", Some(4), Some(7)); // match (upper bound)
    seed("e3", Some(4), Some(4)); // energy below the range
    seed("e4", Some(4), Some(8)); // energy above the range
    seed("e5", Some(3), Some(6)); // below the rating floor
    seed("e6", Some(4), None); // energy never set
    seed("e7", None, Some(6)); // rating never set

    let ids: Vec<String> = conn
        .prepare(ENERGY_RATED_SQL)
        .unwrap()
        .query_map(params![4i64, 5i64, 7i64, 200i64, 0i64], |r| r.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(
        ids,
        vec!["e1".to_string(), "e2".to_string()],
        "only tracks inside the energy range and above the rating floor survive"
    );
    assert!(
        !ids.iter().any(|id| id == "e6"),
        "a NULL energy must never match a bounded energy filter"
    );
    assert!(
        !ids.iter().any(|id| id == "e7"),
        "a NULL rating must never match a rating floor"
    );

    let total: i64 = conn
        .query_row(COUNT_ENERGY_RATED_SQL, params![4i64, 5i64, 7i64], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(total as usize, ids.len(), "count/rows must agree");

    // Sorting by energy descending: the highest energy first, unrated tracks last.
    let sorted: Vec<String> = conn
        .prepare(SORT_ENERGY_DESC_SQL)
        .unwrap()
        .query_map(params![200i64, 0i64], |r| r.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert_eq!(
        sorted,
        vec![
            "e4".to_string(),
            "e2".to_string(),
            "e5".to_string(),
            "e7".to_string(),
            "e1".to_string(),
            "e3".to_string(),
            "e6".to_string(),
        ],
        "energy sorts high to low and a NULL energy sorts last"
    );

    let _ = std::fs::remove_file(&db_path);
}
#[test]
fn rating_and_energy_sql_keeps_the_snapshot_round_trip() {
    // T2.1.4 / T2.1.6 — SCHEMA-LEVEL SQL COVERAGE ONLY.
    //
    // This test proves that the SQL shape the write path uses works against
    // the real schema: the write, the `skill_runs` snapshot row (with both
    // `before_state` and `after_state`) and the restore UPDATE.
    //
    // It does NOT cover the command's behaviour: `commands.rs::update_track_metadata`
    // and `commands.rs::undo_track_metadata` are Tauri commands and cannot be
    // invoked from this crate. The command-layer contract (including the
    // stale-snapshot skip) lives in the desktop crate.
    let db_path = temp_db("undo-metadata.db");
    let conn = open_migrated_at(&db_path);

    insert_filterable_track(
        &conn,
        "w1",
        "House",
        Some(120.0),
        Some("8A"),
        "complete",
        Some(3),
        None,
    );

    // --- The write: rating 4, energy 7. ---
    conn.execute(
        "UPDATE tracks SET user_rating = ?2, energy = ?3, updated_at = datetime('now') WHERE id = ?1",
        params!["w1", 4i64, 7i64],
    )
    .expect("the rating/energy write must succeed");

    let (rating, energy): (Option<i64>, Option<i64>) = conn
        .query_row(
            "SELECT user_rating, energy FROM tracks WHERE id = 'w1'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("the written values must be readable");
    assert_eq!(rating, Some(4), "the rating must be written");
    assert_eq!(energy, Some(7), "the energy must be written");

    // --- The undo snapshot: the values the write replaced. ---
    let undo_id = "11111111-2222-3333-4444-555555555555";
    conn.execute(
        "INSERT INTO skill_runs (
            id, workspace_id, skill_name, status, input_summary, before_state, after_state,
            error, created_at
        ) VALUES (?1, 'default', 'update_track_metadata', 'success', ?2, ?3, ?4, NULL, datetime('now'))",
        params![
            undo_id,
            r#"{"trackIds":["w1"],"rating":4,"energy":7}"#,
            r#"{"w1":{"user_rating":3,"energy":null}}"#,
            r#"{"w1":{"user_rating":4,"energy":7}}"#,
        ],
    )
    .expect("the undo snapshot must be insertable");

    let (status, before_state): (String, String) = conn
        .query_row(
            "SELECT status, before_state FROM skill_runs WHERE id = ?1",
            params![undo_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("the snapshot must be readable");
    assert_eq!(status, "success");
    assert_eq!(
        before_state, r#"{"w1":{"user_rating":3,"energy":null}}"#,
        "the snapshot holds the previous values, not the new ones"
    );

    // --- The undo: restore the snapshot and mark it undone. ---
    conn.execute(
        "UPDATE tracks SET user_rating = ?2, energy = ?3, updated_at = datetime('now') WHERE id = ?1",
        params!["w1", 3i64, None::<i64>],
    )
    .expect("the undo restore must succeed");
    conn.execute(
        "UPDATE skill_runs SET status = 'undone' WHERE id = ?1",
        params![undo_id],
    )
    .expect("the snapshot must be marked undone");

    let (rating, energy): (Option<i64>, Option<i64>) = conn
        .query_row(
            "SELECT user_rating, energy FROM tracks WHERE id = 'w1'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("the restored values must be readable");
    assert_eq!(rating, Some(3), "the previous rating must come back");
    assert_eq!(energy, None, "a NULL energy must be restored as NULL");

    let status: String = conn
        .query_row(
            "SELECT status FROM skill_runs WHERE id = ?1",
            params![undo_id],
            |r| r.get(0),
        )
        .expect("the snapshot status must be readable");
    assert_eq!(status, "undone", "a snapshot is only undoable once");

    let _ = std::fs::remove_file(&db_path);
}

#[test]
fn a_stale_metadata_snapshot_is_detectable_against_the_current_row() {
    // T2.1.4 / T2.1.6 — SCHEMA-LEVEL SQL COVERAGE ONLY.
    //
    // The undo command restores a snapshot only while it still describes the
    // row: it compares the current values with the `after_state` the write
    // recorded. This test proves the SQL that comparison relies on works
    // against the real schema, and that a second edit is what makes a
    // snapshot stale. The comparison itself lives in the desktop crate.
    let db_path = temp_db("stale-metadata.db");
    let conn = open_migrated_at(&db_path);

    insert_filterable_track(
        &conn,
        "w1",
        "House",
        Some(120.0),
        Some("8A"),
        "complete",
        Some(3),
        None,
    );

    // The write: rating 4, energy 7 — recorded in `after_state`.
    conn.execute(
        "UPDATE tracks SET user_rating = ?2, energy = ?3, updated_at = datetime('now') WHERE id = ?1",
        params!["w1", 4i64, 7i64],
    )
    .expect("the rating/energy write must succeed");

    let undo_id = "22222222-3333-4444-5555-666666666666";
    conn.execute(
        "INSERT INTO skill_runs (
            id, workspace_id, skill_name, status, input_summary, before_state, after_state,
            error, created_at
        ) VALUES (?1, 'default', 'update_track_metadata', 'success', ?2, ?3, ?4, NULL, datetime('now'))",
        params![
            undo_id,
            r#"{"trackIds":["w1"],"rating":4,"energy":7}"#,
            r#"{"w1":{"user_rating":3,"energy":null}}"#,
            r#"{"w1":{"user_rating":4,"energy":7}}"#,
        ],
    )
    .expect("the undo snapshot must be insertable");

    // The SQL the undo command reads the current values with.
    let current: (Option<i64>, Option<i64>) = conn
        .query_row(
            "SELECT user_rating, energy FROM tracks WHERE id = ?1",
            params!["w1"],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("the current values must be readable");
    assert_eq!(
        current,
        (Some(4), Some(7)),
        "the row still matches the recorded after_state, so the snapshot is current"
    );

    // A second edit makes the snapshot stale: the undo must skip the track
    // instead of overwriting the newer value.
    conn.execute(
        "UPDATE tracks SET user_rating = ?2, updated_at = datetime('now') WHERE id = ?1",
        params!["w1", 2i64],
    )
    .expect("the second edit must succeed");

    let current: (Option<i64>, Option<i64>) = conn
        .query_row(
            "SELECT user_rating, energy FROM tracks WHERE id = ?1",
            params!["w1"],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("the current values must be readable");
    assert_eq!(
        current,
        (Some(2), Some(7)),
        "the current rating no longer matches after_state, so the snapshot is stale"
    );

    let _ = std::fs::remove_file(&db_path);
}
