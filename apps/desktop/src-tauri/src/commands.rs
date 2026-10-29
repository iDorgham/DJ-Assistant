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
use dj_assistant_core::library_writes::{
    patch_columns, plan_metadata_undo, plan_metadata_write, read_patch_statement, write_skill_run,
    MetadataPatch, WriteStatement, WriteValue, CURRENT_TAGS_SQL,
};
use dj_assistant_core::patch::{
    check_metadata_undoable, tags_match, METADATA_SKILL_NAME, RATING_SKILL_NAME,
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

// --- Track metadata write path: bulk edit (T2.1.3) + rating/energy/tags ---
//
// What a patch means, which columns it touches, and what an undo restores all
// live in `dj_assistant_core::library_writes`, where their tests run on every
// toolchain — the desktop crate's own test harness does not load on
// `stable-x86_64-pc-windows-gnu`. This layer is the executor: it binds the
// planned statements to a transaction and runs them.

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
        &patch,
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
        &patch,
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

    // The state the write produced. It is what the restores are guarded on, so
    // an undo never overwrites a newer edit.
    let after: serde_json::Value = match after_raw {
        Some(raw) => serde_json::from_str(&raw).map_err(|e| e.to_string())?,
        None => serde_json::Value::Null,
    };

    let planned = plan_metadata_undo(&before, &after)
        .map_err(|reason| format!("undo snapshot {}: {reason}", request.undo_id))?;

    let mut restored = 0usize;
    let mut skipped = 0usize;
    for entry in &planned {
        // Both guards are checked before anything is written, so a track is
        // either fully restored or left exactly as the newer edit left it.
        //
        // The tag set is a set: a newer edit that added or removed a tag
        // changed it, and the snapshot must not overwrite that either.
        if let Some(expected_tags) = &entry.expected_tags {
            let current = current_tags(&tx, &entry.track_id)?;
            if !tags_match(&current, expected_tags) {
                skipped += 1;
                continue;
            }
        }
        // The scalar restore carries the write's after-state in its WHERE
        // clause: zero rows means the track was edited again after the
        // snapshot, or has since left the library.
        if let Some(restore) = &entry.restore {
            if execute_write(&tx, restore)? == 0 {
                skipped += 1;
                continue;
            }
        }

        // The tag set is restored as a whole: the current rows are dropped and
        // the snapshot's rows are re-inserted. The delete and the inserts
        // share this transaction with the scalar restore, so a track never
        // keeps half of its old set.
        for statement in &entry.tag_statements {
            execute_write(&tx, statement)?;
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

/// The tags of one track, in the order the snapshot recorded them.
fn current_tags(tx: &rusqlite::Transaction<'_>, track_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = tx.prepare(CURRENT_TAGS_SQL).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([track_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    Ok(rows.flatten().collect())
}

/// The current tag set of every track the write is about to touch.
///
/// Only read when the patch carries tags: a rating edit over a thousand-track
/// selection should not pay for a thousand tag lookups.
fn current_tag_sets(
    tx: &rusqlite::Transaction<'_>,
    track_ids: &[String],
) -> Result<Vec<(String, Vec<String>)>, String> {
    track_ids
        .iter()
        .map(|id| current_tags(tx, id).map(|tags| (id.clone(), tags)))
        .collect()
}

/// Runs a statement planned in `core` — SQL text plus its bound parameters.
///
/// The desktop layer is the executor and nothing else: every decision about
/// what a write does lives in `crates/core`, where it is unit-testable. Values
/// are bound, never interpolated, so a track id or a tag can only be data.
fn execute_write(tx: &rusqlite::Transaction<'_>, stmt: &WriteStatement) -> Result<usize, String> {
    let params: Vec<rusqlite::types::Value> = stmt.params.iter().map(bind_value).collect();
    tx.execute(&stmt.sql, rusqlite::params_from_iter(params.iter()))
        .map_err(|e| e.to_string())
}

/// Maps a planned value onto the SQLite type it binds as.
fn bind_value(value: &WriteValue) -> rusqlite::types::Value {
    match value {
        WriteValue::Null => rusqlite::types::Value::Null,
        WriteValue::Text(text) => rusqlite::types::Value::Text(text.clone()),
        WriteValue::Int(number) => rusqlite::types::Value::Integer(*number),
    }
}

/// Reads a column back as the type `core` plans writes against.
///
/// A REAL or BLOB in a patched column is data the snapshot cannot round-trip,
/// so it reads as NULL — the same degradation [`WriteValue::from_json`] applies
/// when a snapshot is replayed, which keeps a write's "already matches" test
/// and its undo guard agreeing on the same value.
fn read_value(value: rusqlite::types::Value) -> WriteValue {
    match value {
        rusqlite::types::Value::Integer(number) => WriteValue::Int(number),
        rusqlite::types::Value::Text(text) => WriteValue::Text(text),
        _ => WriteValue::Null,
    }
}

/// Applies a metadata patch and records the undo snapshot.
///
/// The track UPDATEs, the tag rewrites and the one `skill_runs` INSERT share a
/// single transaction: a crash between them would leave the library changed
/// with no way back. Only the columns and the tag sets the patch really changed
/// are snapshotted, so an undo restores exactly what the write changed.
///
/// The returned count is the number of tracks whose value actually changed: a
/// track that already held the requested value is not written, not counted and
/// not snapshotted. The same path serves one track and a bulk selection.
fn apply_metadata_patch(
    conn: &mut rusqlite::Connection,
    skill_name: &'static str,
    track_ids: &[String],
    patch: &MetadataPatch,
) -> Result<(String, usize), String> {
    // The scalar columns this patch touches. The names come from the fixed
    // allow-list in `core`, never from user input.
    let columns = patch_columns(patch);
    // Ids are bound, never interpolated into the SQL text.
    let read = read_patch_statement(track_ids, &columns).map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // The rows the selection names, with the patched columns as they stand. An
    // id the library does not know matches no row, so a stale bulk selection
    // applies to what still exists.
    let params: Vec<rusqlite::types::Value> = read.params.iter().map(bind_value).collect();
    let rows: Vec<(String, Vec<WriteValue>)> = {
        let mut stmt = tx.prepare(&read.sql).map_err(|e| e.to_string())?;
        let collected = stmt
            .query_map(rusqlite::params_from_iter(params.iter()), |row| {
                let mut values = Vec::with_capacity(columns.len());
                for index in 0..columns.len() {
                    values.push(read_value(row.get::<_, rusqlite::types::Value>(index + 1)?));
                }
                Ok((row.get::<_, String>(0)?, values))
            })
            .map_err(|e| e.to_string())?
            // A row that fails to map is an error, not a row to skip.
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        collected
    };

    let tag_sets = if patch.normalized_tags().is_some() {
        let ids: Vec<String> = rows.iter().map(|(id, _)| id.clone()).collect();
        current_tag_sets(&tx, &ids)?
    } else {
        Vec::new()
    };

    let planned = plan_metadata_write(&rows, &tag_sets, &columns, patch);

    let mut before = serde_json::Map::new();
    let mut after = serde_json::Map::new();
    for entry in &planned {
        if let Some(update) = &entry.update {
            execute_write(&tx, update)?;
        }
        for statement in &entry.tag_statements {
            execute_write(&tx, statement)?;
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

    let undo_id = Uuid::new_v4().to_string();
    let run = write_skill_run(&undo_id, skill_name, track_ids, patch, before, after);
    tx.execute(&run.sql, rusqlite::params_from_iter(run.params.iter()))
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok((undo_id, planned.len()))
}

#[cfg(test)]
mod tests {
    use super::{bind_value, read_value, WriteValue};

    #[test]
    fn a_planned_value_binds_as_the_type_it_describes() {
        assert_eq!(
            bind_value(&WriteValue::Text("Night Drive".into())),
            rusqlite::types::Value::Text("Night Drive".to_string())
        );
        assert_eq!(
            bind_value(&WriteValue::Int(3)),
            rusqlite::types::Value::Integer(3)
        );
        assert_eq!(bind_value(&WriteValue::Null), rusqlite::types::Value::Null);
    }

    #[test]
    fn a_column_that_cannot_round_trip_through_the_snapshot_reads_as_null() {
        assert_eq!(
            read_value(rusqlite::types::Value::Text("House".into())),
            WriteValue::Text("House".to_string())
        );
        assert_eq!(
            read_value(rusqlite::types::Value::Integer(3)),
            WriteValue::Int(3)
        );
        assert_eq!(read_value(rusqlite::types::Value::Null), WriteValue::Null);
        // A patched column holds integer or text; anything else would be
        // written back mangled, so it is treated as no value at all.
        assert_eq!(
            read_value(rusqlite::types::Value::Real(3.5)),
            WriteValue::Null
        );
        assert_eq!(
            read_value(rusqlite::types::Value::Blob(vec![1])),
            WriteValue::Null
        );
    }
}
