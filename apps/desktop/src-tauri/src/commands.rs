use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use dj_assistant_core::library_query::QueryParam;
use dj_assistant_core::library_reads::{
    analysis_candidates, tag_health_rows, GENRE_COUNTS_SQL, REMOVED_TRACKS_SQL,
    SIMILAR_CANDIDATES_SQL,
};
use dj_assistant_core::library_remove::{
    after_doc, before_doc, check_undoable, input_doc, parse_states, present_states, read_statement,
    remove_statement, removed_states, restore_statements, restored_doc, skill_run_insert,
    undo_statements, SkillRun, Statement, TrackState, MARK_UNDONE_SQL, REMOVE_SKILL_NAME,
    RESTORE_SKILL_NAME, UNDO_READ_SQL,
};
use dj_assistant_core::patch::{
    check_metadata_undoable, number_value, tags_match, text_value, METADATA_SKILL_NAME,
    PATCH_COLUMNS, RATING_SKILL_NAME,
};
use dj_assistant_core::reveal::reveal_command;

use crate::db::Database;
use crate::models::{
    AnalyzeLibraryRequest, AnalyzeLibraryResponse, CuePoint, FindSimilarTracksRequest,
    FindSimilarTracksResponse, GenreCount, GetArtworkRequest, GetTrackRequest, GetTrackResponse,
    ListGenresResponse, ListRemovedTracksResponse, ListTracksRequest, ListTracksResponse,
    ProviderAccount, ProviderCapability, ProviderStatusResponse, RemoveTracksRequest,
    RemoveTracksResponse, RemovedTrack, RestoreTracksRequest, RestoreTracksResponse,
    RevealInFileManagerRequest, ScanFolderRequest, ScanFolderResponse, SetTrackRatingRequest,
    SetTrackRatingResponse, SimilarTrackResult, StoreLink, StoreLinksRequest, StoreLinksResponse,
    TagHealthRequest, TagHealthResponse, TagHealthTotals, TrackDetail, TrackGaps, TrackSummary,
    UndoRemoveTracksRequest, UndoRemoveTracksResponse, UndoTrackMetadataRequest,
    UndoTrackMetadataResponse, UpdateTrackMetadataRequest, UpdateTrackMetadataResponse,
};
use crate::scanner::run_scan;
use crate::security::validate_and_canonicalize_dir;

/// Upper bound for a single `list_tracks` page. The library UI paginates in
/// 200-row windows; a larger cap would let a stray request materialize the
/// whole library in memory.
const MAX_LIST_LIMIT: i64 = 1000;

/// Highest star rating `tracks.user_rating` stores (`0` clears the rating).
const MAX_TRACK_RATING: i64 = 5;

/// Highest energy level `tracks.energy` stores (`0` clears the energy).
const MAX_TRACK_ENERGY: i64 = 10;

/// Summary columns shared by `list_tracks` and `get_track`, in `TrackSummary` order.
const TRACK_SUMMARY_COLUMNS: &str =
    "id, file_path, file_hash, title, artist, album, genre, label, year, bpm, \
     key_camelot, key_classical, duration_ms, format, analysis_status, user_rating, energy, \
     comments, artwork_hash, created_at, updated_at";

/// Number of columns in [`TRACK_SUMMARY_COLUMNS`] — the offset the detail
/// columns start at in `get_track`.
const TRACK_SUMMARY_COLUMN_COUNT: usize = 21;

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

    // `limit`/`offset` are clamped rather than trusted: the IPC surface is a
    // public boundary and a negative LIMIT would mean "no limit" in SQLite.
    let limit = request.limit.unwrap_or(200).clamp(0, MAX_LIST_LIMIT);
    let offset = request.offset.unwrap_or(0).max(0);

    let built = request
        .into_query()
        .build(TRACK_SUMMARY_COLUMNS, limit, offset)
        .map_err(|err| err.to_string())?;

    // Parameter order is filters…, then LIMIT, then OFFSET, so the count query
    // binds the prefix and the list query binds everything.
    let params: Vec<rusqlite::types::Value> = built.params.iter().map(to_sql_value).collect();
    let count_params = &params[..params.len().saturating_sub(2)];

    // rusqlite 0.40 removed the `usize` `FromSql` impl, so COUNT(*) (SQLite's
    // native i64) is read as `i64` and narrowed for the response payload.
    let total: i64 = conn
        .query_row(
            &built.count_sql,
            rusqlite::params_from_iter(count_params.iter()),
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(&built.select_sql).map_err(|e| e.to_string())?;
    let rows_iter = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), map_track_summary)
        .map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();
    for track in rows_iter.flatten() {
        tracks.push(track);
    }

    // The tags of the page, in one grouped query (T2.1.7). A join would
    // multiply a track with three tags into three rows and break the
    // one-row-per-track shape the pagination and the sort rely on.
    let track_ids: Vec<String> = tracks.iter().map(|track| track.id.clone()).collect();
    let tag_map = load_tags(conn, &track_ids)?;
    for track in &mut tracks {
        track.tags = tag_map.get(&track.id).cloned().unwrap_or_default();
    }

    Ok(ListTracksResponse {
        tracks,
        total: total as usize,
    })
}

/// The custom tags of the given tracks, grouped by track id (T2.1.7).
///
/// Tags come back sorted, so a track's tag list has one stable order
/// everywhere it is shown.
fn load_tags(
    conn: &rusqlite::Connection,
    track_ids: &[String],
) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
    let mut tags: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    if track_ids.is_empty() {
        return Ok(tags);
    }
    let placeholders = std::iter::repeat_n("?", track_ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT track_id, tag FROM track_tags WHERE track_id IN ({placeholders}) ORDER BY tag ASC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(track_ids.iter()), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;
    for row in rows.flatten() {
        tags.entry(row.0).or_default().push(row.1);
    }
    Ok(tags)
}

/// Maps a core query parameter onto the `rusqlite` value type.
fn to_sql_value(param: &QueryParam) -> rusqlite::types::Value {
    match param {
        QueryParam::Text(value) => rusqlite::types::Value::Text(value.clone()),
        QueryParam::Int(value) => rusqlite::types::Value::Integer(*value),
        QueryParam::Real(value) => rusqlite::types::Value::Real(*value),
    }
}

/// Distinct non-empty genres with their track counts, for the library filter
/// UI. Case variants collapse into one entry (the filter itself is
/// case-insensitive), ordered by popularity then alphabetically so the most
/// useful options come first.
#[tauri::command]
pub async fn list_genres(
    db: State<'_, Arc<Mutex<Database>>>,
) -> Result<ListGenresResponse, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let mut stmt = conn.prepare(GENRE_COUNTS_SQL).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(GenreCount {
                genre: row.get(0)?,
                count: row.get::<_, i64>(1)? as usize,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut genres = Vec::new();
    for genre in rows.flatten() {
        genres.push(genre);
    }

    Ok(ListGenresResponse { genres })
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
        label: row.get(base + 7)?,
        year: row.get(base + 8)?,
        bpm: row.get(base + 9)?,
        key_camelot: row.get(base + 10)?,
        key_classical: row.get(base + 11)?,
        duration_ms: row.get(base + 12)?,
        format: row.get(base + 13)?,
        analysis_status: row.get(base + 14)?,
        user_rating: row.get(base + 15)?,
        energy: row.get(base + 16)?,
        comments: row.get(base + 17)?,
        artwork_hash: row.get(base + 18)?,
        created_at: row.get(base + 19)?,
        updated_at: row.get(base + 20)?,
        // The custom tags are read by a second, grouped query (see
        // `load_tags`): a join would duplicate a track per tag.
        tags: Vec::new(),
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

            // The detail columns start after the summary columns.
            let base = TRACK_SUMMARY_COLUMN_COUNT;
            let vocal_int: Option<i64> = row.get(base + 5)?;
            let vocal_presence = vocal_int.map(|v| v != 0);

            Ok(TrackDetail {
                summary,
                file_size: row.get(base)?,
                sample_rate: row.get(base + 1)?,
                channels: row.get(base + 2)?,
                bit_depth: row.get(base + 3)?,
                loudness_lufs: row.get(base + 4)?,
                vocal_presence,
                phrase_confidence: row.get(base + 6)?,
                analysis_version: row.get(base + 7)?,
                notes: row.get(base + 8)?,
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

    // The custom tags of the one track (T2.1.7).
    let tag_map = load_tags(conn, std::slice::from_ref(&request.track_id))?;
    detailed.summary.tags = tag_map.get(&request.track_id).cloned().unwrap_or_default();

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

#[tauri::command]
pub async fn analyze_library(
    app: AppHandle,
    db: State<'_, Arc<Mutex<Database>>>,
    request: AnalyzeLibraryRequest,
) -> Result<AnalyzeLibraryResponse, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let force = request.force.unwrap_or(false);
    // `core` builds the work list, so the bind order — every id, then the
    // analysis version — is fixed where its tests cover it. A soft-removed
    // track is not work: the library no longer shows it, and analysing it in
    // the background would keep a file the DJ took out of play.
    let candidates = analysis_candidates(
        request.track_ids.as_deref(),
        force,
        &dj_assistant_analysis::analysis_version(),
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(&candidates.sql).map_err(|e| e.to_string())?;
    let mut rows: Vec<(String, String)> = Vec::new();
    {
        let mut iter = stmt
            .query(rusqlite::params_from_iter(candidates.params.iter()))
            .map_err(|e| e.to_string())?;
        while let Some(row) = iter.next().map_err(|e| e.to_string())? {
            let id: String = row.get(0).map_err(|e| e.to_string())?;
            let path: String = row.get(1).map_err(|e| e.to_string())?;
            rows.push((id, path));
        }
    }
    if rows.is_empty() {
        return Ok(AnalyzeLibraryResponse {
            job_id: Uuid::new_v4().to_string(),
            total: 0,
        });
    }

    let job_id = Uuid::new_v4().to_string();
    let db_clone = Arc::clone(&db);
    crate::analysis::run_analysis_queue(app, db_clone, job_id.clone(), rows.clone());
    Ok(AnalyzeLibraryResponse {
        job_id,
        total: rows.len(),
    })
}

/// Ranks library tracks by mix-compatibility with a seed track.
///
/// Purely local: BPM (45%) / Camelot key (35%) / genre (10%) / duration (10%),
/// renormalised over the signals both tracks have. No network, no audio read.
#[tauri::command]
pub async fn find_similar_tracks(
    db: State<'_, Arc<Mutex<Database>>>,
    request: FindSimilarTracksRequest,
) -> Result<FindSimilarTracksResponse, String> {
    use dj_assistant_core::{find_similar, TrackFeatures};

    let limit = request.limit.unwrap_or(10).clamp(1, 50) as usize;
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let load_features = |track_id: &str| -> Result<TrackFeatures, String> {
        conn.query_row(
            "SELECT id, bpm, key_camelot, genre, duration_ms FROM tracks WHERE id = ?1",
            [&track_id],
            |row| {
                Ok(TrackFeatures {
                    id: row.get(0)?,
                    bpm: row.get(1)?,
                    key_camelot: row.get(2)?,
                    genre: row.get(3)?,
                    duration_ms: row.get(4)?,
                })
            },
        )
        .map_err(|e| format!("Track not found: {e}"))
    };

    let seed = load_features(&request.track_id)?;

    // Rank every candidate: the pre-sort subset must be deliberate, not an
    // unordered `LIMIT 5000` that can hide the best match in large libraries.
    // Scoring is cheap pure math over small feature rows.
    let mut stmt = conn
        .prepare(SIMILAR_CANDIDATES_SQL)
        .map_err(|e| e.to_string())?;
    let candidates: Vec<TrackFeatures> = stmt
        .query_map([&request.track_id], |row| {
            Ok(TrackFeatures {
                id: row.get(0)?,
                bpm: row.get(1)?,
                key_camelot: row.get(2)?,
                genre: row.get(3)?,
                duration_ms: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    let ranked = find_similar(&seed, &candidates, limit);
    if ranked.is_empty() {
        return Ok(FindSimilarTracksResponse {
            seed_track_id: request.track_id,
            results: Vec::new(),
        });
    }

    let placeholders: Vec<String> = ranked.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "SELECT {TRACK_SUMMARY_COLUMNS} FROM tracks WHERE id IN ({})",
        placeholders.join(",")
    );
    let mut summary_stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let ids: Vec<&str> = ranked.iter().map(|r| r.track_id.as_str()).collect();
    let summaries: Vec<TrackSummary> = summary_stmt
        .query_map(rusqlite::params_from_iter(ids.iter()), map_track_summary)
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    // The custom tags of the ranked tracks (T2.1.7).
    let summary_ids: Vec<String> = summaries.iter().map(|s| s.id.clone()).collect();
    let tag_map = load_tags(conn, &summary_ids)?;
    let mut summaries = summaries;
    for summary in &mut summaries {
        summary.tags = tag_map.get(&summary.id).cloned().unwrap_or_default();
    }

    let by_id: std::collections::HashMap<&str, &TrackSummary> =
        summaries.iter().map(|s| (s.id.as_str(), s)).collect();
    let results: Vec<SimilarTrackResult> = ranked
        .iter()
        .filter_map(|r| {
            by_id
                .get(r.track_id.as_str())
                .map(|summary| SimilarTrackResult {
                    track: (*summary).clone(),
                    score: r.score,
                    reasons: r.reasons.clone(),
                })
        })
        .collect();

    Ok(FindSimilarTracksResponse {
        seed_track_id: request.track_id,
        results,
    })
}

/// Reports which tag/artwork fields are missing or placeholder per track.
///
/// Local gap detection only — the read half of enrichment. Online lookup
/// (MusicBrainz / iTunes / Deezer) consumes this output in a later step and
/// always goes through preview → apply → undo.
#[tauri::command]
pub async fn track_tag_health(
    db: State<'_, Arc<Mutex<Database>>>,
    request: TagHealthRequest,
) -> Result<TagHealthResponse, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let limit = request.limit.unwrap_or(200).clamp(1, 2000) as usize;

    let read = tag_health_rows(request.track_ids.as_deref()).map_err(|e| e.to_string())?;

    fn blank(value: &Option<String>) -> bool {
        value.as_deref().map(str::trim).unwrap_or("").is_empty()
    }

    struct TagHealthRow {
        id: String,
        title: String,
        artist: String,
        album: Option<String>,
        genre: Option<String>,
        year: Option<i64>,
        bpm: Option<f64>,
        key: Option<String>,
        artwork: Option<String>,
        isrc: Option<String>,
        duration_ms: i64,
    }

    impl TagHealthRow {
        /// Tag-side gaps come from the shared core definition so the IPC
        /// surface and the enrichment proposer can never disagree; BPM/key/
        /// duration are analysis-sourced and checked here.
        fn missing_fields(&self) -> Vec<String> {
            let mut missing = dj_assistant_core::missing_fields(&dj_assistant_core::LocalTrack {
                title: self.title.clone(),
                artist: self.artist.clone(),
                album: self.album.clone(),
                genre: self.genre.clone(),
                year: self.year.map(|y| y as i32),
                isrc: self.isrc.clone(),
                artwork_hash: self.artwork.clone(),
            });
            if self.bpm.is_none() {
                missing.push("bpm".to_string());
            }
            if blank(&self.key) {
                missing.push("key".to_string());
            }
            if self.duration_ms <= 0 {
                missing.push("duration".to_string());
            }
            missing
        }
    }

    let mut stmt = conn.prepare(&read.sql).map_err(|e| e.to_string())?;
    let rows: Vec<TagHealthRow> = stmt
        .query_map(rusqlite::params_from_iter(read.params.iter()), |row| {
            Ok(TagHealthRow {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                genre: row.get(4)?,
                year: row.get(5)?,
                bpm: row.get(6)?,
                key: row.get(7)?,
                artwork: row.get(8)?,
                isrc: row.get(9)?,
                duration_ms: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    let mut gaps: Vec<TrackGaps> = Vec::new();
    let mut totals: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut with_gaps = 0usize;
    let mut score_sum = 0.0;
    for row in &rows {
        let missing = row.missing_fields();
        score_sum += dj_assistant_core::tag_health_score(&missing);
        if missing.is_empty() {
            continue;
        }
        with_gaps += 1;
        for field in &missing {
            *totals.entry(field.clone()).or_insert(0) += 1;
        }
        if gaps.len() < limit {
            gaps.push(TrackGaps {
                track_id: row.id.clone(),
                title: row.title.clone(),
                artist: row.artist.clone(),
                score: dj_assistant_core::tag_health_score(&missing),
                missing,
            });
        }
    }
    let mut totals_vec: Vec<TagHealthTotals> = totals
        .into_iter()
        .map(|(field, missing_count)| TagHealthTotals {
            field: field.to_string(),
            missing_count,
        })
        .collect();
    totals_vec.sort_by(|a, b| {
        b.missing_count
            .cmp(&a.missing_count)
            .then_with(|| a.field.cmp(&b.field))
    });

    Ok(TagHealthResponse {
        checked: rows.len(),
        with_gaps,
        gaps,
        totals: totals_vec,
        average_score: if rows.is_empty() {
            None
        } else {
            Some(score_sum / rows.len() as f64)
        },
    })
}

/// Builds per-store buy-link search URLs for a track (Beatport, Traxsource,
/// Juno Download, Bandcamp, Discogs). Pure URL construction — no API, no
/// network, no audio. This is Tier 0 of the store integration (ADR-0007).
#[tauri::command]
pub async fn store_links_for_track(
    db: State<'_, Arc<Mutex<Database>>>,
    request: StoreLinksRequest,
) -> Result<StoreLinksResponse, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let (artist, title): (String, String) = conn
        .query_row(
            "SELECT artist, title FROM tracks WHERE id = ?1",
            [&request.track_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Track not found: {e}"))?;

    let links: Vec<StoreLink> = dj_assistant_core::store_links_for_track(&artist, &title)
        .into_iter()
        .map(|l| StoreLink {
            provider: l.provider,
            label: l.label,
            url: l.url,
        })
        .collect();

    Ok(StoreLinksResponse {
        track_id: request.track_id,
        artist,
        title,
        links,
    })
}

/// Lists connected streaming accounts plus the supported provider enums.
///
/// Today this reads the local `streaming_accounts` table (empty until the
/// first OAuth flow lands) and advertises the registry both the matcher and
/// the UI bind to — adding Deezer/Apple Music/YouTube/SoundCloud/TIDAL later
/// extends rows and matchers, not this contract.
#[tauri::command]
pub async fn provider_status(
    db: State<'_, Arc<Mutex<Database>>>,
) -> Result<ProviderStatusResponse, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let mut stmt = conn
        .prepare(
            "SELECT id, provider, account_label, scopes, expires_at, revoked_at \
             FROM streaming_accounts WHERE revoked_at IS NULL ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let connected: Vec<ProviderAccount> = stmt
        .query_map([], |row| {
            let scopes_raw: String = row.get(3)?;
            let scopes: Vec<String> = serde_json::from_str(&scopes_raw).unwrap_or_default();
            Ok(ProviderAccount {
                id: row.get(0)?,
                provider: row.get(1)?,
                account_label: row.get(2)?,
                scopes,
                expires_at: row.get(4)?,
                revoked_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    Ok(ProviderStatusResponse {
        connected,
        supported_streaming: [
            "spotify",
            "deezer",
            "apple_music",
            "youtube_music",
            "soundcloud",
            "tidal",
        ]
        .iter()
        .map(|s| (*s).to_string())
        .collect(),
        supported_stores: [
            "beatport",
            "traxsource",
            "juno_download",
            "bandcamp",
            "discogs",
        ]
        .iter()
        .map(|s| (*s).to_string())
        .collect(),
        capabilities: dj_assistant_core::StreamingProvider::all()
            .iter()
            .map(|p| {
                let caps = p.capabilities();
                ProviderCapability {
                    provider: p.as_str().to_string(),
                    live_match: caps.live_match,
                    isrc_search: caps.isrc_search,
                    playlist_write: caps.playlist_write,
                    needs_app_id: caps.needs_app_id,
                }
            })
            .collect(),
    })
}

// --- Track metadata write path: rating + energy (T2.1.4 / T2.1.6) ---
//
// The scalar metadata columns a write may touch, and the rules that decide
// what a value means, live in the core crate (`dj_assistant_core::patch`),
// where their tests run on every toolchain.

/// The metadata a write may touch.
///
/// `None` leaves a column untouched. For the numeric columns `Some(0)` clears
/// the value (both are stored as NULL and 0 is not a valid rating or energy
/// level); for the text columns an empty string clears it the same way.
///
/// The tag list is a **set**, not a scalar: `Some(vec![])` removes every tag
/// of the track and `Some(vec!["peak"])` replaces the whole set.
#[derive(Debug, Clone, Default)]
struct MetadataPatch {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    genre: Option<String>,
    label: Option<String>,
    year: Option<i64>,
    comments: Option<String>,
    rating: Option<i64>,
    energy: Option<i64>,
    tags: Option<Vec<String>>,
}

/// The value a patch writes to one column.
#[derive(Debug, Clone, PartialEq)]
enum ColumnValue {
    /// A text column. `None` clears it (the column becomes NULL).
    Text(Option<String>),
    /// A numeric column. `None` clears it (the column becomes NULL).
    Number(Option<i64>),
}

impl ColumnValue {
    /// The bound SQL value for this column.
    fn to_sql(&self) -> rusqlite::types::Value {
        match self {
            ColumnValue::Text(Some(text)) => rusqlite::types::Value::Text(text.clone()),
            ColumnValue::Text(None) => rusqlite::types::Value::Null,
            ColumnValue::Number(Some(number)) => rusqlite::types::Value::Integer(*number),
            ColumnValue::Number(None) => rusqlite::types::Value::Null,
        }
    }
}

/// The metadata a write may touch.
///
/// The rules that decide what a value means — an empty text clears the
/// column, a zero number clears it — live in the core crate
/// (`dj_assistant_core::patch`), where their tests run on every toolchain:
/// the desktop crate's own test harness does not load on
/// `stable-x86_64-pc-windows-gnu`.
impl MetadataPatch {
    /// The value the patch writes to `column`, or `None` when the patch does
    /// not touch that column at all.
    fn value_for(&self, column: &str) -> Option<ColumnValue> {
        match column {
            "title" => self
                .title
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "artist" => self
                .artist
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "album" => self
                .album
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "genre" => self
                .genre
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "label" => self
                .label
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "comments" => self
                .comments
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "year" => self.year.map(|v| ColumnValue::Number(number_value(v))),
            "user_rating" => self.rating.map(|v| ColumnValue::Number(number_value(v))),
            "energy" => self.energy.map(|v| ColumnValue::Number(number_value(v))),
            _ => None,
        }
    }

    /// Rejects values the columns cannot hold, before anything is written.
    fn validate(&self) -> Result<(), String> {
        if let Some(rating) = self.rating {
            if !(0..=MAX_TRACK_RATING).contains(&rating) {
                return Err(format!("rating must be between 0 and {MAX_TRACK_RATING}"));
            }
        }
        if let Some(energy) = self.energy {
            if !(0..=MAX_TRACK_ENERGY).contains(&energy) {
                return Err(format!("energy must be between 0 and {MAX_TRACK_ENERGY}"));
            }
        }
        if let Some(year) = self.year {
            if year != 0 && !(1000..=9999).contains(&year) {
                return Err("year must be between 1000 and 9999".to_string());
            }
        }
        // The title and the artist name the track in the table; emptying one
        // of them would leave a row the user cannot identify.
        for (label, value) in [("title", &self.title), ("artist", &self.artist)] {
            if let Some(value) = value {
                if value.trim().is_empty() {
                    return Err(format!("{label} cannot be empty"));
                }
            }
        }
        if self.is_empty() {
            return Err("nothing to update".to_string());
        }
        Ok(())
    }

    /// True when the patch would not touch a single column or tag.
    fn is_empty(&self) -> bool {
        PATCH_COLUMNS
            .iter()
            .all(|column| self.value_for(column).is_none())
            && self.tags.is_none()
    }

    /// The normalised tag set the patch writes, or `None` when it leaves the
    /// tags untouched.
    ///
    /// The set is normalised here — trimmed, lower-cased, de-duplicated — so
    /// the database and the filter always agree on what a tag is.
    fn normalized_tags(&self) -> Option<Vec<String>> {
        self.tags
            .as_ref()
            .map(|tags| dj_assistant_core::normalize_tags(tags))
    }
}

/// The value a patch writes to `column`, or `None` when the patch leaves the
/// column alone — or when the row already holds the requested value.
///
/// The second case is what keeps the undo snapshot honest: a value that does
/// not change is neither written nor recorded, so there is nothing to
/// restore, and the track is not counted as updated.
fn changed_value(
    patch: &MetadataPatch,
    column: &str,
    current: &rusqlite::types::Value,
) -> Option<rusqlite::types::Value> {
    let stored = patch.value_for(column)?.to_sql();
    (stored != *current).then_some(stored)
}

/// Writes metadata to one or more tracks.
///
/// The write is reversible: the previous values are snapshotted in a
/// `skill_runs` row and the returned `undoId` restores them. An absent field
/// leaves its column untouched, so the rating widget and the metadata editor
/// share this one write path.
#[tauri::command]
pub async fn update_track_metadata(
    db: State<'_, Arc<Mutex<Database>>>,
    request: UpdateTrackMetadataRequest,
) -> Result<UpdateTrackMetadataResponse, String> {
    if request.track_ids.is_empty() {
        return Err("no tracks selected".to_string());
    }
    let patch = MetadataPatch {
        title: request.title,
        artist: request.artist,
        album: request.album,
        genre: request.genre,
        label: request.label,
        year: request.year,
        comments: request.comments,
        rating: request.rating,
        energy: request.energy,
        tags: request.tags,
    };
    patch.validate()?;

    let mut db_guard = db.lock().map_err(|e| e.to_string())?;
    let (undo_id, updated) = apply_metadata_patch(
        db_guard.conn_mut(),
        METADATA_SKILL_NAME,
        &request.track_ids,
        patch,
    )?;

    Ok(UpdateTrackMetadataResponse { undo_id, updated })
}

/// Sets the star rating on one or more tracks.
///
/// A thin wrapper over the same write path as [`update_track_metadata`]: the
/// undo snapshot behaves identically, so a rating can be reverted with the
/// same `undoId` round-trip.
#[tauri::command]
pub async fn set_track_rating(
    db: State<'_, Arc<Mutex<Database>>>,
    request: SetTrackRatingRequest,
) -> Result<SetTrackRatingResponse, String> {
    if request.track_ids.is_empty() {
        return Err("no tracks selected".to_string());
    }
    let patch = MetadataPatch {
        rating: Some(request.rating),
        ..Default::default()
    };
    patch.validate()?;

    let mut db_guard = db.lock().map_err(|e| e.to_string())?;
    let (undo_id, updated) = apply_metadata_patch(
        db_guard.conn_mut(),
        RATING_SKILL_NAME,
        &request.track_ids,
        patch,
    )?;

    Ok(SetTrackRatingResponse { undo_id, updated })
}

/// Restores the values a rating/energy write replaced.
///
/// The snapshot is marked `undone`, so a second undo of the same id is
/// refused instead of restoring twice.
///
/// Only a metadata snapshot is restored at all. Every write path shares the
/// `skill_runs` table, and a remove snapshot holds `removed_at` — not a patch
/// column — so it would restore nothing while still being spent, leaving the
/// track out of the library with no way back. [`check_metadata_undoable`]
/// refuses it before the row is touched.
///
/// A snapshot only restores what it still describes: when a track was edited
/// again after the snapshot was taken, its current value no longer matches the
/// snapshot's `after_state`. Such a track is skipped (and counted) instead of
/// being overwritten with the older value.
#[tauri::command]
pub async fn undo_track_metadata(
    db: State<'_, Arc<Mutex<Database>>>,
    request: UndoTrackMetadataRequest,
) -> Result<UndoTrackMetadataResponse, String> {
    let mut db_guard = db.lock().map_err(|e| e.to_string())?;
    let tx = db_guard
        .conn_mut()
        .transaction()
        .map_err(|e| e.to_string())?;

    let (skill_name, status, before_raw, after_raw): (
        String,
        String,
        Option<String>,
        Option<String>,
    ) = tx
        .query_row(UNDO_READ_SQL, [&request.undo_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|_| format!("undo snapshot not found: {}", request.undo_id))?;

    check_metadata_undoable(&skill_name, &status)
        .map_err(|reason| format!("undo snapshot {}: {reason}", request.undo_id))?;

    let before_raw =
        before_raw.ok_or_else(|| format!("undo snapshot {} has no snapshot", request.undo_id))?;
    let before: serde_json::Value = serde_json::from_str(&before_raw).map_err(|e| e.to_string())?;
    let snapshot = before
        .as_object()
        .ok_or_else(|| format!("undo snapshot {} has a corrupt snapshot", request.undo_id))?;

    // The state the write produced. It is what the current values are checked
    // against, so an undo never overwrites a newer edit.
    let after: serde_json::Map<String, serde_json::Value> = match after_raw {
        Some(raw) => {
            let parsed: serde_json::Value =
                serde_json::from_str(&raw).map_err(|e| e.to_string())?;
            parsed.as_object().cloned().ok_or_else(|| {
                format!(
                    "undo snapshot {} has a corrupt after-state",
                    request.undo_id
                )
            })?
        }
        None => serde_json::Map::new(),
    };

    let mut restored = 0usize;
    let mut skipped = 0usize;
    for (track_id, values) in snapshot {
        // The columns this snapshot touches. Only those are read and written
        // back, so an undo never touches anything else. `tags` is not a
        // column — it is a set of rows in `track_tags`.
        let columns: Vec<&str> = PATCH_COLUMNS
            .iter()
            .copied()
            .filter(|column| values.get(*column).is_some())
            .collect();
        let restores_tags = values.get("tags").is_some();
        if columns.is_empty() && !restores_tags {
            continue;
        }

        // A newer edit won: the snapshot no longer describes the current
        // values, so it must not overwrite them.
        if !snapshot_still_current(&tx, track_id, &columns, after.get(track_id))? {
            skipped += 1;
            continue;
        }
        // The tag set is a set: a newer edit that added or removed a tag
        // changed the set, and the snapshot must not overwrite it either.
        if restores_tags && !tags_still_current(&tx, track_id, after.get(track_id))? {
            skipped += 1;
            continue;
        }

        // `?1` is always the track id; the snapshotted columns are bound.
        if !columns.is_empty() {
            let mut assignments: Vec<String> = Vec::new();
            let mut params: Vec<rusqlite::types::Value> = vec![track_id.clone().into()];
            for column in &columns {
                if let Some(value) = values.get(*column) {
                    params.push(json_to_sql_value(value));
                    assignments.push(format!("{column} = ?{}", params.len()));
                }
            }
            let sql = format!(
                "UPDATE tracks SET {}, updated_at = datetime('now') WHERE id = ?1",
                assignments.join(", ")
            );
            tx.execute(&sql, rusqlite::params_from_iter(params.iter()))
                .map_err(|e| e.to_string())?;
        }

        // The tag set is restored as a whole: the current rows are dropped and
        // the snapshot's rows are re-inserted. The delete and the inserts
        // share this transaction with the scalar restore, so a track never
        // keeps half of its old set.
        if restores_tags {
            let restored_tags = snapshot_tags(values.get("tags"));
            rewrite_tags(&tx, track_id, &restored_tags)?;
        }

        restored += 1;
    }

    tx.execute(MARK_UNDONE_SQL, rusqlite::params![request.undo_id])
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(UndoTrackMetadataResponse { restored, skipped })
}

/// Runs a statement built in `core` — SQL text plus its bound parameters.
///
/// The desktop layer is the executor and nothing else: every decision about
/// what a write does lives in `crates/core`, where it is unit-testable.
fn execute_core(tx: &rusqlite::Transaction<'_>, stmt: &Statement) -> Result<usize, String> {
    tx.execute(&stmt.sql, rusqlite::params_from_iter(stmt.params.iter()))
        .map_err(|e| e.to_string())
}

/// Takes tracks out of the library index (T2.1.10).
///
/// The audio files are never touched, and neither is the rest of the row:
/// `removed_at` is the only column written, so the cue points, tags and
/// analysis a hard `DELETE` would cascade away are still there when the user
/// changes their mind. The snapshot goes into `skill_runs` inside the same
/// transaction as the stamp — a remove that cannot be undone is not shipped.
#[tauri::command]
pub async fn remove_tracks(
    db: State<'_, Arc<Mutex<Database>>>,
    request: RemoveTracksRequest,
) -> Result<RemoveTracksResponse, String> {
    let read = read_statement(&request.track_ids).map_err(|e| e.to_string())?;

    let mut db_guard = db.lock().map_err(|e| e.to_string())?;
    let tx = db_guard
        .conn_mut()
        .transaction()
        .map_err(|e| e.to_string())?;

    let found: Vec<TrackState> = {
        let mut stmt = tx.prepare(&read.sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(read.params.iter()), |row| {
                Ok(TrackState {
                    id: row.get(0)?,
                    removed_at: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    // A track already out of the library belongs to an earlier remove, with an
    // undo of its own. Re-stamping it here would let this snapshot bring it back
    // from under that action, so it is left out of both the write and the
    // record.
    let present = present_states(&found);
    if present.is_empty() {
        return Ok(RemoveTracksResponse {
            undo_id: None,
            removed: 0,
        });
    }
    let ids: Vec<String> = present.iter().map(|state| state.id.clone()).collect();

    // The timestamp comes from SQLite, so the after-state records exactly what
    // the write stores — the value undo compares the row against.
    let removed_at: String = tx
        .query_row("SELECT datetime('now')", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let update = remove_statement(&ids, &removed_at).map_err(|e| e.to_string())?;
    let removed = execute_core(&tx, &update)?;
    let undo_id = Uuid::new_v4().to_string();
    execute_core(
        &tx,
        &skill_run_insert(&SkillRun {
            id: undo_id.clone(),
            workspace_id: "default".to_string(),
            skill_name: REMOVE_SKILL_NAME,
            before_state: before_doc(&present),
            after_state: after_doc(&present, &removed_at),
            input_summary: input_doc(&ids),
        }),
    )?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(RemoveTracksResponse {
        undo_id: Some(undo_id),
        removed,
    })
}

/// Runs a removal snapshot backwards, one command for both directions.
///
/// Mirrors [`undo_track_metadata`]: the snapshot is refused unless it is an
/// applied remove *or* an applied restore, each track is restored only while it
/// still holds the state that write left, and the snapshot is marked `undone` so
/// a second undo of the same id cannot fire. Which way it goes — clearing
/// `removed_at` or putting the original stamp back — is read off the snapshot
/// itself, in `core`'s `undo_statements`.
#[tauri::command]
pub async fn undo_remove_tracks(
    db: State<'_, Arc<Mutex<Database>>>,
    request: UndoRemoveTracksRequest,
) -> Result<UndoRemoveTracksResponse, String> {
    let mut db_guard = db.lock().map_err(|e| e.to_string())?;
    let tx = db_guard
        .conn_mut()
        .transaction()
        .map_err(|e| e.to_string())?;

    let (skill_name, status, before_raw, after_raw): (
        String,
        String,
        Option<String>,
        Option<String>,
    ) = tx
        .query_row(UNDO_READ_SQL, [&request.undo_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|_| format!("undo snapshot not found: {}", request.undo_id))?;

    check_undoable(&skill_name, &status).map_err(|e| e.to_string())?;
    let before_raw =
        before_raw.ok_or_else(|| format!("undo snapshot {} has no snapshot", request.undo_id))?;
    let after_raw =
        after_raw.ok_or_else(|| format!("undo snapshot {} has no after-state", request.undo_id))?;
    let before = parse_states(&before_raw).map_err(|e| e.to_string())?;
    let after = parse_states(&after_raw).map_err(|e| e.to_string())?;

    let mut restored = 0;
    let mut skipped = 0;
    for stmt in undo_statements(&before, &after).map_err(|e| e.to_string())? {
        // Each statement carries the state the write left in its WHERE, so a
        // track that was removed again in between matches nothing and stays
        // out — the newer action wins.
        if execute_core(&tx, &stmt)? == 0 {
            skipped += 1;
        } else {
            restored += 1;
        }
    }

    tx.execute(MARK_UNDONE_SQL, rusqlite::params![request.undo_id])
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(UndoRemoveTracksResponse { restored, skipped })
}

/// Lists the tracks a soft remove took out of the library (issue #62).
///
/// The one read in the app that asks for `removed_at IS NOT NULL`, and the
/// reason the rule lives in `crates/core`: the removed view is the surface that
/// makes a removal recoverable once its Undo toast has gone, so it has to be
/// the only place those rows are ever shown. Nothing is filtered further — a
/// removal the user did from a selection is still here.
#[tauri::command]
pub async fn list_removed_tracks(
    db: State<'_, Arc<Mutex<Database>>>,
) -> Result<ListRemovedTracksResponse, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db_guard
        .conn()
        .prepare(REMOVED_TRACKS_SQL)
        .map_err(|e| e.to_string())?;
    let tracks = stmt
        .query_map([], |row| {
            Ok(RemovedTrack {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                file_path: row.get(4)?,
                duration_ms: row.get(5)?,
                removed_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let total = tracks.len();
    Ok(ListRemovedTracksResponse { tracks, total })
}

/// Puts tracks back into the library from the removed view (issue #62).
///
/// A write of its own rather than the original remove's undo replayed: the
/// removal's `skill_runs` id lives in a toast, so by the time the user opens
/// this view there is usually nothing left that could name it. The tracks and
/// their stamps come from the rows themselves, the clear goes through the same
/// guarded statement builder the undo uses, and the snapshot is written in this
/// transaction — so the restore is undoable on its own, and undoing it puts the
/// track's *original* stamp back instead of inventing a new removal time.
#[tauri::command]
pub async fn restore_tracks(
    db: State<'_, Arc<Mutex<Database>>>,
    request: RestoreTracksRequest,
) -> Result<RestoreTracksResponse, String> {
    let read = read_statement(&request.track_ids).map_err(|e| e.to_string())?;

    let mut db_guard = db.lock().map_err(|e| e.to_string())?;
    let tx = db_guard
        .conn_mut()
        .transaction()
        .map_err(|e| e.to_string())?;

    let found: Vec<TrackState> = {
        let mut stmt = tx.prepare(&read.sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(read.params.iter()), |row| {
                Ok(TrackState {
                    id: row.get(0)?,
                    removed_at: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    // A track still in the library was not removed by anything, so it is left
    // out of both the write and the snapshot — the same rule that keeps a
    // re-remove from recording an undo that could resurrect it.
    let removed = removed_states(&found);
    if removed.is_empty() {
        return Ok(RestoreTracksResponse {
            undo_id: None,
            restored: 0,
            skipped: 0,
        });
    }

    // Each statement matches the stamp the read returned, so a track removed
    // again in between holds a newer value, matches nothing and is skipped.
    let statements = restore_statements(&removed).map_err(|e| e.to_string())?;
    let mut cleared: Vec<TrackState> = Vec::new();
    let mut skipped = 0;
    for (state, stmt) in removed.iter().zip(&statements) {
        if execute_core(&tx, stmt)? == 0 {
            skipped += 1;
        } else {
            cleared.push(state.clone());
        }
    }
    if cleared.is_empty() {
        return Ok(RestoreTracksResponse {
            undo_id: None,
            restored: 0,
            skipped,
        });
    }

    let ids: Vec<String> = cleared.iter().map(|state| state.id.clone()).collect();
    let undo_id = Uuid::new_v4().to_string();
    execute_core(
        &tx,
        &skill_run_insert(&SkillRun {
            id: undo_id.clone(),
            workspace_id: "default".to_string(),
            skill_name: RESTORE_SKILL_NAME,
            before_state: before_doc(&cleared),
            after_state: restored_doc(&cleared),
            input_summary: input_doc(&ids),
        }),
    )?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(RestoreTracksResponse {
        undo_id: Some(undo_id),
        restored: cleared.len(),
        skipped,
    })
}

/// Shows a track's file in the operating system's file manager.
///
/// The path is handed to the program as an argument — never through a shell —
/// and the app does not read or write the file, so this cannot change a
/// library in any way.
#[tauri::command]
pub async fn reveal_in_file_manager(request: RevealInFileManagerRequest) -> Result<bool, String> {
    if !std::path::Path::new(&request.path).exists() {
        return Err(format!(
            "The file is not where the library says it is: {}",
            request.path
        ));
    }
    let command = reveal_command(std::env::consts::OS, &request.path)
        .ok_or_else(|| format!("Reveal is not supported on {}.", std::env::consts::OS))?;

    // The spawn is what is checked, not the exit code: `explorer` reports
    // failure even when it opened the folder. A missing helper — no
    // `xdg-open` on a minimal Linux box — surfaces here as a readable error.
    let mut process = std::process::Command::new(command.program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        if command.verbatim {
            // `arg` would wrap the whole `/select,"…"` in quotes and Explorer
            // then looks for a file whose name starts with a quote. Each
            // argument already carries the quoting the shell wants.
            for arg in &command.args {
                process.raw_arg(arg);
            }
        } else {
            process.args(&command.args);
        }
    }
    #[cfg(not(windows))]
    {
        // Nothing outside Windows asks for verbatim arguments.
        process.args(&command.args);
    }
    process.spawn().map_err(|e| {
        format!(
            "Couldn't open {} to reveal {}: {e}",
            command.program, request.path
        )
    })?;

    Ok(true)
}

/// True when the track's current values still match the state the snapshot
/// recorded *after* its write.
///
/// A mismatch means the track was edited again after the snapshot was taken,
/// so restoring the snapshot would overwrite the newer edit.
fn snapshot_still_current(
    tx: &rusqlite::Transaction<'_>,
    track_id: &str,
    columns: &[&str],
    expected: Option<&serde_json::Value>,
) -> Result<bool, String> {
    let expected = match expected.and_then(serde_json::Value::as_object) {
        Some(values) => values,
        // Without an after-state there is nothing to compare against, so the
        // snapshot cannot prove it still describes the current values.
        None => return Ok(false),
    };
    if columns.is_empty() {
        // Nothing scalar to compare — the tag set is checked separately.
        return Ok(true);
    }

    // Column names come from the snapshot's own keys, never from user input.
    let sql = format!("SELECT {} FROM tracks WHERE id = ?1", columns.join(", "));
    let current: Vec<rusqlite::types::Value> = match tx.query_row(&sql, [track_id], |row| {
        let mut values = Vec::with_capacity(columns.len());
        for index in 0..columns.len() {
            values.push(row.get::<_, rusqlite::types::Value>(index)?);
        }
        Ok(values)
    }) {
        Ok(values) => values,
        // The track is gone: there is nothing left to restore.
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(false),
        Err(e) => return Err(e.to_string()),
    };

    Ok(values_match_snapshot(columns, &current, expected))
}

/// True when the current column values still match the state the snapshot
/// recorded after its write.
///
/// A mismatch means the track was edited again after the snapshot was taken,
/// so restoring the snapshot would overwrite that newer edit.
fn values_match_snapshot(
    columns: &[&str],
    current: &[rusqlite::types::Value],
    expected: &serde_json::Map<String, serde_json::Value>,
) -> bool {
    columns.iter().zip(current.iter()).all(|(column, value)| {
        let recorded = expected
            .get(*column)
            .map(json_to_sql_value)
            .unwrap_or(rusqlite::types::Value::Null);
        recorded == *value
    })
}

/// True when the track's current tag set still matches the set the snapshot
/// recorded *after* its write.
///
/// A tag set is a set, not a scalar: a newer edit that added or removed a tag
/// changed the set, and restoring the older set would overwrite that edit.
fn tags_still_current(
    tx: &rusqlite::Transaction<'_>,
    track_id: &str,
    expected: Option<&serde_json::Value>,
) -> Result<bool, String> {
    let current = current_tags(tx, track_id)?;
    Ok(tag_set_matches_snapshot(&current, expected))
}

/// True when the current tag set still matches the set the snapshot recorded
/// after its write.
///
/// A tag set is a set, not a scalar: a newer edit that added or removed a tag
/// changed the set, and restoring the older set would overwrite that edit.
/// Without an after-state there is nothing to compare against, so the
/// snapshot cannot prove it still describes the current set.
fn tag_set_matches_snapshot(current: &[String], expected: Option<&serde_json::Value>) -> bool {
    let Some(expected_tags) = expected.and_then(|value| value.get("tags")) else {
        return false;
    };
    let Some(expected_tags) = expected_tags.as_array() else {
        return false;
    };
    let expected_tags: Vec<String> = expected_tags
        .iter()
        .filter_map(|value| value.as_str().map(str::to_string))
        .collect();
    // The set rule lives in the core crate, where its test runs.
    tags_match(current, &expected_tags)
}

/// The tags of one track, in the order the read path returns them.
fn current_tags(tx: &rusqlite::Transaction<'_>, track_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = tx
        .prepare("SELECT tag FROM track_tags WHERE track_id = ?1 ORDER BY tag ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([track_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

/// The tag set a snapshot records, as a list.
fn snapshot_tags(value: Option<&serde_json::Value>) -> Vec<String> {
    value
        .and_then(|value| value.as_array())
        .map(|values| {
            values
                .iter()
                .filter_map(|value| value.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

/// Replaces a track's tag rows with `tags`.
///
/// The delete and the inserts share the caller's transaction, so a track
/// never keeps half of its old set.
fn rewrite_tags(
    tx: &rusqlite::Transaction<'_>,
    track_id: &str,
    tags: &[String],
) -> Result<(), String> {
    tx.execute("DELETE FROM track_tags WHERE track_id = ?1", [track_id])
        .map_err(|e| e.to_string())?;
    for tag in tags {
        tx.execute(
            "INSERT OR IGNORE INTO track_tags (track_id, tag) VALUES (?1, ?2)",
            rusqlite::params![track_id, tag],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Applies a metadata patch and records the undo snapshot.
///
/// The track UPDATE, the tag rewrite and the `skill_runs` INSERT share one
/// transaction: a crash between them would leave the library changed with no
/// way back. Only the columns and the tag set the patch really changed are
/// snapshotted, so an undo restores exactly what the write changed.
///
/// The returned count is the number of tracks whose value actually changed: a
/// track that already held the requested value is not written, not counted and
/// not snapshotted.
fn apply_metadata_patch(
    conn: &mut rusqlite::Connection,
    skill_name: &str,
    track_ids: &[String],
    patch: MetadataPatch,
) -> Result<(String, usize), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // The scalar columns this patch touches. The names come from the fixed
    // allow-list, never from user input.
    let columns: Vec<&str> = PATCH_COLUMNS
        .iter()
        .copied()
        .filter(|column| patch.value_for(column).is_some())
        .collect();
    let new_tags = patch.normalized_tags();

    // Ids are bound, never interpolated into the SQL text.
    let placeholders = std::iter::repeat_n("?", track_ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let select_list = if columns.is_empty() {
        "id".to_string()
    } else {
        format!("id, {}", columns.join(", "))
    };
    let select_sql = format!("SELECT {select_list} FROM tracks WHERE id IN ({placeholders})");
    let rows: Vec<(String, Vec<rusqlite::types::Value>)> = {
        let mut stmt = tx.prepare(&select_sql).map_err(|e| e.to_string())?;
        // A row that fails to map is an error, not a row to skip.
        let collected = stmt
            .query_map(rusqlite::params_from_iter(track_ids.iter()), |row| {
                let mut values = Vec::with_capacity(columns.len());
                for index in 0..columns.len() {
                    values.push(row.get::<_, rusqlite::types::Value>(index + 1)?);
                }
                Ok((row.get::<_, String>(0)?, values))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        collected
    };

    let mut before = serde_json::Map::new();
    let mut after = serde_json::Map::new();
    let mut updated = 0usize;

    for (track_id, current_values) in &rows {
        let mut assignments: Vec<String> = Vec::new();
        let mut params: Vec<rusqlite::types::Value> = vec![track_id.clone().into()];
        let mut before_values = serde_json::Map::new();
        let mut after_values = serde_json::Map::new();

        for (index, column) in columns.iter().enumerate() {
            let column = *column;
            let current = &current_values[index];
            // Only a column whose value really differs is written and
            // snapshotted. A track that already holds the requested value is
            // left alone: the write would change nothing, so it is neither
            // counted as updated nor recorded in the snapshot (there is
            // nothing to restore).
            let Some(stored) = changed_value(&patch, column, current) else {
                continue;
            };
            params.push(stored.clone());
            assignments.push(format!("{column} = ?{}", params.len()));
            before_values.insert(column.to_string(), sql_value_to_json(current));
            after_values.insert(column.to_string(), sql_value_to_json(&stored));
        }

        // The tag set is compared as a whole: a track whose tags already match
        // is left alone, exactly like a column whose value already matches.
        let mut tags_changed = false;
        if let Some(new_tags) = &new_tags {
            let previous_tags = current_tags(&tx, track_id)?;
            if previous_tags != *new_tags {
                tags_changed = true;
                before_values.insert(
                    "tags".to_string(),
                    serde_json::Value::Array(
                        previous_tags
                            .iter()
                            .map(|tag| serde_json::Value::from(tag.clone()))
                            .collect(),
                    ),
                );
                after_values.insert(
                    "tags".to_string(),
                    serde_json::Value::Array(
                        new_tags
                            .iter()
                            .map(|tag| serde_json::Value::from(tag.clone()))
                            .collect(),
                    ),
                );
            }
        }

        if assignments.is_empty() && !tags_changed {
            continue;
        }

        if !assignments.is_empty() {
            let sql = format!(
                "UPDATE tracks SET {}, updated_at = datetime('now') WHERE id = ?1",
                assignments.join(", ")
            );
            tx.execute(&sql, rusqlite::params_from_iter(params.iter()))
                .map_err(|e| e.to_string())?;
        }

        if tags_changed {
            rewrite_tags(&tx, track_id, new_tags.as_deref().unwrap_or(&[]))?;
        }

        updated += 1;
        before.insert(track_id.clone(), serde_json::Value::Object(before_values));
        after.insert(track_id.clone(), serde_json::Value::Object(after_values));
    }

    let undo_id = Uuid::new_v4().to_string();
    let input_summary = serde_json::json!({
        "trackIds": track_ids,
        "rating": patch.rating,
        "energy": patch.energy,
        "title": patch.title,
        "artist": patch.artist,
        "album": patch.album,
        "genre": patch.genre,
        "label": patch.label,
        "year": patch.year,
        "comments": patch.comments,
        "tags": patch.tags,
    });
    tx.execute(
        "INSERT INTO skill_runs (
            id, workspace_id, skill_name, status, input_summary, before_state, after_state,
            error, created_at
        ) VALUES (?1, 'default', ?2, 'success', ?3, ?4, ?5, NULL, datetime('now'))",
        rusqlite::params![
            undo_id,
            skill_name,
            input_summary.to_string(),
            serde_json::Value::Object(before).to_string(),
            serde_json::Value::Object(after).to_string(),
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok((undo_id, updated))
}

/// Converts a bound SQL value into the JSON shape the snapshot stores.
fn sql_value_to_json(value: &rusqlite::types::Value) -> serde_json::Value {
    match value {
        rusqlite::types::Value::Null => serde_json::Value::Null,
        rusqlite::types::Value::Integer(number) => serde_json::Value::from(*number),
        rusqlite::types::Value::Real(number) => serde_json::Value::from(*number),
        rusqlite::types::Value::Text(text) => serde_json::Value::from(text.clone()),
        // No patched column is a blob, and a blob would not survive the JSON
        // snapshot faithfully — it is stored as null rather than mangled.
        rusqlite::types::Value::Blob(_) => serde_json::Value::Null,
    }
}

/// Converts a snapshot value back into a bound SQL value. JSON `null` restores
/// as NULL, a string as text and a number as an integer.
fn json_to_sql_value(value: &serde_json::Value) -> rusqlite::types::Value {
    match value {
        serde_json::Value::Null => rusqlite::types::Value::Null,
        serde_json::Value::Number(number) => number
            .as_i64()
            .map(rusqlite::types::Value::Integer)
            .or_else(|| number.as_f64().map(rusqlite::types::Value::Real))
            .unwrap_or(rusqlite::types::Value::Null),
        serde_json::Value::String(text) => rusqlite::types::Value::Text(text.clone()),
        _ => rusqlite::types::Value::Null,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(value: &str) -> rusqlite::types::Value {
        rusqlite::types::Value::Text(value.to_string())
    }

    fn int(value: i64) -> rusqlite::types::Value {
        rusqlite::types::Value::Integer(value)
    }

    /// The snapshot's after-state, as the undo path reads it.
    fn snapshot_map(value: serde_json::Value) -> serde_json::Map<String, serde_json::Value> {
        value
            .as_object()
            .cloned()
            .expect("the after-state must be a JSON object")
    }

    #[test]
    fn the_patch_allow_list_is_closed() {
        // The column names are interpolated into the SQL text, so the list is
        // the only thing that keeps a user-supplied name out of it. The list
        // itself lives in the core crate, where the test runs on every
        // toolchain.
        assert_eq!(
            PATCH_COLUMNS,
            [
                "title",
                "artist",
                "album",
                "genre",
                "label",
                "year",
                "comments",
                "user_rating",
                "energy",
            ]
        );
    }

    #[test]
    fn a_text_value_is_trimmed_and_an_empty_one_clears_the_column() {
        assert_eq!(
            text_value("  Night Drive  "),
            Some("Night Drive".to_string())
        );
        assert_eq!(text_value("   "), None);
    }

    #[test]
    fn a_zero_number_clears_the_column() {
        assert_eq!(number_value(0), None);
        assert_eq!(number_value(4), Some(4));
    }

    #[test]
    fn value_for_maps_every_editable_column() {
        let patch = MetadataPatch {
            title: Some(" Night Drive ".into()),
            year: Some(2026),
            rating: Some(3),
            ..Default::default()
        };
        assert_eq!(
            patch.value_for("title"),
            Some(ColumnValue::Text(Some("Night Drive".into())))
        );
        assert_eq!(
            patch.value_for("year"),
            Some(ColumnValue::Number(Some(2026)))
        );
        assert_eq!(
            patch.value_for("user_rating"),
            Some(ColumnValue::Number(Some(3)))
        );
        assert_eq!(
            patch.value_for("genre"),
            None,
            "an untouched column is absent"
        );
        assert_eq!(patch.value_for("energy"), None);
    }

    #[test]
    fn an_empty_text_field_clears_its_column() {
        let patch = MetadataPatch {
            genre: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(patch.value_for("genre"), Some(ColumnValue::Text(None)));
    }

    #[test]
    fn validate_rejects_values_the_columns_cannot_hold() {
        assert!(MetadataPatch {
            rating: Some(6),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(MetadataPatch {
            energy: Some(11),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(MetadataPatch {
            year: Some(99),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(MetadataPatch {
            title: Some("   ".into()),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(MetadataPatch::default().validate().is_err());
    }

    #[test]
    fn a_tag_only_patch_is_a_real_change() {
        // Clearing every tag is a change, so the patch is not empty and the
        // write is not refused.
        let patch = MetadataPatch {
            tags: Some(Vec::new()),
            ..Default::default()
        };
        assert!(!patch.is_empty());
        assert!(patch.validate().is_ok());
    }

    #[test]
    fn the_tag_set_is_normalised_before_it_is_stored() {
        let patch = MetadataPatch {
            tags: Some(vec![" Peak ".into(), "warmup".into(), "peak".into()]),
            ..Default::default()
        };
        assert_eq!(
            patch.normalized_tags(),
            Some(vec!["peak".to_string(), "warmup".to_string()])
        );
    }

    #[test]
    fn a_value_that_already_matches_is_not_written() {
        let patch = MetadataPatch {
            title: Some("Night Drive".into()),
            ..Default::default()
        };
        assert_eq!(changed_value(&patch, "title", &text("Night Drive")), None);
        assert_eq!(
            changed_value(&patch, "title", &text("Day Break")),
            Some(text("Night Drive"))
        );
        assert_eq!(
            changed_value(&patch, "genre", &text("House")),
            None,
            "a column the patch does not touch is never written"
        );
    }

    #[test]
    fn clearing_a_column_that_holds_a_value_is_a_change() {
        let patch = MetadataPatch {
            genre: Some(String::new()),
            ..Default::default()
        };
        assert_eq!(
            changed_value(&patch, "genre", &text("House")),
            Some(rusqlite::types::Value::Null)
        );
        assert_eq!(
            changed_value(&patch, "genre", &rusqlite::types::Value::Null),
            None,
            "a column that is already empty needs no write"
        );
    }

    #[test]
    fn the_snapshot_matches_only_while_the_values_are_unchanged() {
        let expected = snapshot_map(serde_json::json!({ "title": "Night", "user_rating": 3 }));
        assert!(values_match_snapshot(
            &["title", "user_rating"],
            &[text("Night"), int(3)],
            &expected
        ));
        assert!(
            !values_match_snapshot(&["title", "user_rating"], &[text("Day"), int(3)], &expected),
            "a newer edit must not be overwritten by an older snapshot"
        );
        assert!(
            !values_match_snapshot(
                &["title", "user_rating"],
                &[text("Night"), int(4)],
                &expected
            ),
            "a changed rating is a newer edit too"
        );
    }

    #[test]
    fn the_tag_set_matches_only_while_the_set_is_unchanged() {
        let expected = serde_json::json!({ "tags": ["peak", "warmup"] });
        assert!(tag_set_matches_snapshot(
            &["peak".to_string(), "warmup".to_string()],
            Some(&expected)
        ));
        assert!(
            !tag_set_matches_snapshot(&["peak".to_string(), "build".to_string()], Some(&expected)),
            "a tag added after the snapshot must not be overwritten"
        );
        assert!(
            !tag_set_matches_snapshot(&["peak".to_string()], Some(&expected)),
            "a removed tag must not come back"
        );
        assert!(
            !tag_set_matches_snapshot(&["peak".to_string(), "warmup".to_string()], None),
            "without an after-state the snapshot cannot prove it is current"
        );
    }

    #[test]
    fn a_snapshot_reads_its_tag_set_from_the_json_array() {
        assert_eq!(
            snapshot_tags(Some(&serde_json::json!(["peak", "warmup"]))),
            vec!["peak".to_string(), "warmup".to_string()]
        );
        assert!(snapshot_tags(None).is_empty());
        assert!(snapshot_tags(Some(&serde_json::json!("peak"))).is_empty());
    }
}
