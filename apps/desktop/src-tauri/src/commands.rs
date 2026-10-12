use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::db::Database;
use crate::models::{
    CuePoint, GetArtworkRequest, GetTrackRequest, GetTrackResponse, ListTracksRequest,
    ListTracksResponse, ScanFolderRequest, ScanFolderResponse, TrackDetail, TrackSummary,
};
use crate::scanner::run_scan;
use crate::security::validate_and_canonicalize_dir;

/// Summary columns shared by `list_tracks` and `get_track`, in `TrackSummary` order.
const TRACK_SUMMARY_COLUMNS: &str = "id, file_path, file_hash, title, artist, album, genre, bpm, \
     key_camelot, key_classical, duration_ms, format, analysis_status, user_rating, comments, \
     artwork_hash, created_at, updated_at";

#[tauri::command]
pub async fn scan_folder(
    app: AppHandle,
    db: State<'_, Arc<Mutex<Database>>>,
    request: ScanFolderRequest,
) -> Result<ScanFolderResponse, String> {
    let canonical_path = validate_and_canonicalize_dir(&request.path)?;
    let job_id = Uuid::new_v4().to_string();
    let recursive = request.recursive.unwrap_or(true);

    // Embedded artwork is cached next to the database so `get_artwork` can serve
    // it without touching the library files again.
    let artwork_dir = app
        .path()
        .app_data_dir()
        .map(|dir| dir.join("artwork"))
        .unwrap_or_else(|_| std::path::PathBuf::from("artwork"));

    let db_clone = Arc::clone(&db);
    run_scan(
        app,
        db_clone,
        canonical_path,
        recursive,
        artwork_dir,
        job_id.clone(),
    );

    Ok(ScanFolderResponse {
        job_id,
        estimated_files: None,
    })
}

#[tauri::command]
pub async fn list_tracks(
    db: State<'_, Arc<Mutex<Database>>>,
    request: ListTracksRequest,
) -> Result<ListTracksResponse, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let query_param = request.query.unwrap_or_default().trim().to_lowercase();
    let limit = request.limit.unwrap_or(200);
    let offset = request.offset.unwrap_or(0);

    let has_query = !query_param.is_empty();
    let search_like = format!("%{}%", query_param);

    let count_sql = if has_query {
        "SELECT COUNT(*) FROM tracks WHERE (LOWER(title) LIKE ?1 OR LOWER(artist) LIKE ?1 OR LOWER(album) LIKE ?1 OR LOWER(file_path) LIKE ?1)"
    } else {
        "SELECT COUNT(*) FROM tracks"
    };

    // rusqlite 0.40 removed the `usize` `FromSql` impl, so COUNT(*) (SQLite's
    // native i64) is read as `i64` and narrowed for the response payload.
    let total_rows: i64 = if has_query {
        let mut count_stmt = conn.prepare(count_sql).map_err(|e| e.to_string())?;
        count_stmt
            .query_row([&search_like], |row| row.get(0))
            .map_err(|e| e.to_string())?
    } else {
        let mut count_stmt = conn.prepare(count_sql).map_err(|e| e.to_string())?;
        count_stmt
            .query_row([], |row| row.get(0))
            .map_err(|e| e.to_string())?
    };

    let total = total_rows as usize;

    let select_sql = if has_query {
        format!(
            "SELECT {TRACK_SUMMARY_COLUMNS}
         FROM tracks
         WHERE (LOWER(title) LIKE ?1 OR LOWER(artist) LIKE ?1 OR LOWER(album) LIKE ?1 OR LOWER(file_path) LIKE ?1)
         ORDER BY created_at DESC
         LIMIT ?2 OFFSET ?3"
        )
    } else {
        format!(
            "SELECT {TRACK_SUMMARY_COLUMNS}
         FROM tracks
         ORDER BY created_at DESC
         LIMIT ?1 OFFSET ?2"
        )
    };

    let mut stmt = conn.prepare(&select_sql).map_err(|e| e.to_string())?;

    let rows_iter = if has_query {
        stmt.query_map(
            rusqlite::params![search_like, limit, offset],
            map_track_summary,
        )
        .map_err(|e| e.to_string())?
    } else {
        stmt.query_map(rusqlite::params![limit, offset], map_track_summary)
            .map_err(|e| e.to_string())?
    };

    let mut tracks = Vec::new();
    for track in rows_iter.flatten() {
        tracks.push(track);
    }

    Ok(ListTracksResponse { tracks, total })
}

fn map_track_summary_at(row: &rusqlite::Row, base: usize) -> rusqlite::Result<TrackSummary> {
    Ok(TrackSummary {
        id: row.get(base)?,
        file_path: row.get(base + 1)?,
        file_hash: row.get(base + 2)?,
        title: row.get(base + 3)?,
        artist: row.get(base + 4)?,
        album: row.get(base + 5)?,
        genre: row.get(base + 6)?,
        bpm: row.get(base + 7)?,
        key_camelot: row.get(base + 8)?,
        key_classical: row.get(base + 9)?,
        duration_ms: row.get(base + 10)?,
        format: row.get(base + 11)?,
        analysis_status: row.get(base + 12)?,
        user_rating: row.get(base + 13)?,
        comments: row.get(base + 14)?,
        artwork_hash: row.get(base + 15)?,
        created_at: row.get(base + 16)?,
        updated_at: row.get(base + 17)?,
    })
}

fn map_track_summary(row: &rusqlite::Row) -> rusqlite::Result<TrackSummary> {
    map_track_summary_at(row, 0)
}

#[tauri::command]
pub async fn get_track(
    db: State<'_, Arc<Mutex<Database>>>,
    request: GetTrackRequest,
) -> Result<GetTrackResponse, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let sql = format!(
        "SELECT {TRACK_SUMMARY_COLUMNS},
                file_size, sample_rate, channels, bit_depth, loudness_lufs,
                vocal_presence, phrase_confidence, analysis_version, notes
         FROM tracks WHERE id = ?"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let track = stmt
        .query_row([&request.track_id], |row| {
            let summary = map_track_summary_at(row, 0)?;

            let vocal_int: Option<i64> = row.get(23)?;
            let vocal_presence = vocal_int.map(|v| v != 0);

            Ok(TrackDetail {
                summary,
                file_size: row.get(18)?,
                sample_rate: row.get(19)?,
                channels: row.get(20)?,
                bit_depth: row.get(21)?,
                loudness_lufs: row.get(22)?,
                vocal_presence,
                phrase_confidence: row.get(24)?,
                analysis_version: row.get(25)?,
                notes: row.get(26)?,
                cues: Vec::new(),
            })
        })
        .map_err(|e| format!("Track not found: {}", e))?;

    // Load cues
    let mut cue_stmt = conn
        .prepare(
            "SELECT id, track_id, slot, position_ms, label, cue_type, color_hex, source, created_at
         FROM cue_points WHERE track_id = ? ORDER BY position_ms ASC",
        )
        .map_err(|e| e.to_string())?;

    let cue_iter = cue_stmt
        .query_map([&request.track_id], |row| {
            Ok(CuePoint {
                id: row.get(0)?,
                track_id: row.get(1)?,
                slot: row.get(2)?,
                position_ms: row.get(3)?,
                label: row.get(4)?,
                cue_type: row.get(5)?,
                color_hex: row.get(6)?,
                source: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut cues = Vec::new();
    for cue in cue_iter.flatten() {
        cues.push(cue);
    }

    let mut detailed = track;
    detailed.cues = cues;

    Ok(GetTrackResponse { track: detailed })
}

/// Serves cached cover art for a track as a `data:` URL.
///
/// Returns `Ok(None)` when the track has no cached artwork (or the cache file
/// disappeared), so a missing thumbnail is never a hard error for the UI.
#[tauri::command]
pub async fn get_artwork(
    db: State<'_, Arc<Mutex<Database>>>,
    request: GetArtworkRequest,
) -> Result<Option<String>, String> {
    use base64::Engine;

    let (path, mime) = {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        let conn = db_guard.conn();

        let mut stmt = conn
            .prepare("SELECT artwork_path, artwork_mime FROM tracks WHERE id = ?")
            .map_err(|e| e.to_string())?;

        stmt.query_row([&request.track_id], |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        })
        .map_err(|e| format!("Track not found: {}", e))?
    };

    let Some(path) = path else {
        return Ok(None);
    };

    let bytes = match std::fs::read(&path) {
        Ok(bytes) => bytes,
        Err(err) => {
            log::warn!("Cached artwork is unreadable at {}: {}", path, err);
            return Ok(None);
        }
    };

    let mime = mime.unwrap_or_else(|| "image/jpeg".to_string());
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(Some(format!("data:{mime};base64,{encoded}")))
}
