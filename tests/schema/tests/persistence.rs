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

/// Mirrors `list_tracks`'s non-search SELECT + ORDER BY in commands.rs.
const LIST_TRACKS_SQL: &str =
    "SELECT id, file_path, file_hash, title, artist, album, genre, bpm, key_camelot, key_classical, \
     duration_ms, format, analysis_status, user_rating, comments, artwork_hash, created_at, updated_at \
     FROM tracks ORDER BY created_at DESC LIMIT ?1 OFFSET ?2";

/// Mirrors `list_tracks`'s search SELECT (note the four repeated `?1` binds).
const SEARCH_TRACKS_SQL: &str = "SELECT id, file_path, file_hash, title, artist, album, genre, bpm, key_camelot, key_classical, \
     duration_ms, format, analysis_status, user_rating, comments, artwork_hash, created_at, updated_at \
     FROM tracks \
     WHERE (LOWER(title) LIKE ?1 OR LOWER(artist) LIKE ?1 OR LOWER(album) LIKE ?1 OR LOWER(file_path) LIKE ?1) \
     ORDER BY created_at DESC LIMIT ?2 OFFSET ?3";

/// Mirrors `list_tracks`'s count queries.
const COUNT_ALL_SQL: &str = "SELECT COUNT(*) FROM tracks";
const COUNT_SEARCH_SQL: &str = "SELECT COUNT(*) FROM tracks \
     WHERE (LOWER(title) LIKE ?1 OR LOWER(artist) LIKE ?1 OR LOWER(album) LIKE ?1 OR LOWER(file_path) LIKE ?1)";

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
        let like = format!("%{}%", term.to_lowercase());
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
        let like = format!("%{}%", term.to_lowercase());
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
