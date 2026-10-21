use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use dj_assistant_core::library_query::QueryParam;

use crate::db::Database;
use crate::models::{
    AnalyzeLibraryRequest, AnalyzeLibraryResponse, CuePoint, FindSimilarTracksRequest,
    FindSimilarTracksResponse, GenreCount, GetArtworkRequest, GetTrackRequest, GetTrackResponse,
    ListGenresResponse, ListTracksRequest, ListTracksResponse, ProviderAccount, ProviderCapability,
    ProviderStatusResponse, ScanFolderRequest, ScanFolderResponse, SetTrackRatingRequest,
    SetTrackRatingResponse, SimilarTrackResult, StoreLink, StoreLinksRequest, StoreLinksResponse,
    TagHealthRequest, TagHealthResponse, TagHealthTotals, TrackDetail, TrackGaps, TrackSummary,
    UndoTrackMetadataRequest, UndoTrackMetadataResponse, UpdateTrackMetadataRequest,
    UpdateTrackMetadataResponse,
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
const TRACK_SUMMARY_COLUMNS: &str = "id, file_path, file_hash, title, artist, album, genre, bpm, \
     key_camelot, key_classical, duration_ms, format, analysis_status, user_rating, energy, \
     comments, artwork_hash, created_at, updated_at";

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

    Ok(ListTracksResponse {
        tracks,
        total: total as usize,
    })
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

    let mut stmt = conn
        .prepare(
            "SELECT MIN(TRIM(genre)), COUNT(*)
             FROM tracks
             WHERE genre IS NOT NULL AND TRIM(genre) <> ''
             GROUP BY LOWER(TRIM(genre))
             ORDER BY COUNT(*) DESC, LOWER(TRIM(genre)) ASC",
        )
        .map_err(|e| e.to_string())?;

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
        bpm: row.get(base + 7)?,
        key_camelot: row.get(base + 8)?,
        key_classical: row.get(base + 9)?,
        duration_ms: row.get(base + 10)?,
        format: row.get(base + 11)?,
        analysis_status: row.get(base + 12)?,
        user_rating: row.get(base + 13)?,
        energy: row.get(base + 14)?,
        comments: row.get(base + 15)?,
        artwork_hash: row.get(base + 16)?,
        created_at: row.get(base + 17)?,
        updated_at: row.get(base + 18)?,
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

            let vocal_int: Option<i64> = row.get(24)?;
            let vocal_presence = vocal_int.map(|v| v != 0);

            Ok(TrackDetail {
                summary,
                file_size: row.get(19)?,
                sample_rate: row.get(20)?,
                channels: row.get(21)?,
                bit_depth: row.get(22)?,
                loudness_lufs: row.get(23)?,
                vocal_presence,
                phrase_confidence: row.get(25)?,
                analysis_version: row.get(26)?,
                notes: row.get(27)?,
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

#[tauri::command]
pub async fn analyze_library(
    app: AppHandle,
    db: State<'_, Arc<Mutex<Database>>>,
    request: AnalyzeLibraryRequest,
) -> Result<AnalyzeLibraryResponse, String> {
    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let force = request.force.unwrap_or(false);
    // NOTE: params must follow placeholder order in the SQL below. The
    // `IN (...)` ID placeholders come first, so the version value is pushed
    // *after* the IDs — binding it first mis-assigns it to the first ID
    // placeholder and returns no work for explicit selections.
    let mut conditions = Vec::new();
    if !force {
        conditions.push(
            "(analysis_status != 'complete' OR analysis_version IS NULL OR analysis_version != ?)",
        );
    }

    let (base_sql, params): (String, Vec<rusqlite::types::Value>) =
        if let Some(ref ids) = request.track_ids {
            if ids.is_empty() {
                return Err("track_ids cannot be empty when provided".to_string());
            }
            let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
            let mut sql = format!(
                "SELECT id, file_path FROM tracks WHERE id IN ({})",
                placeholders.join(",")
            );
            if !conditions.is_empty() {
                sql.push_str(&format!(" AND {}", conditions.join(" AND ")));
            }
            let mut params: Vec<rusqlite::types::Value> =
                ids.iter().map(|id| id.clone().into()).collect();
            if !force {
                params.push(dj_assistant_analysis::analysis_version().into());
            }
            (sql, params)
        } else {
            let mut sql = "SELECT id, file_path FROM tracks".to_string();
            if !conditions.is_empty() {
                sql.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
            }
            let params: Vec<rusqlite::types::Value> = if !force {
                vec![dj_assistant_analysis::analysis_version().into()]
            } else {
                Vec::new()
            };
            (sql, params)
        };

    let mut stmt = conn.prepare(&base_sql).map_err(|e| e.to_string())?;
    let mut rows: Vec<(String, String)> = Vec::new();
    {
        let mut iter = stmt
            .query(rusqlite::params_from_iter(params.iter()))
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
        .prepare("SELECT id, bpm, key_camelot, genre, duration_ms FROM tracks WHERE id != ?1")
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

    let mut sql = "SELECT id, title, artist, album, genre, year, bpm, key_camelot, \
        artwork_hash, isrc, duration_ms FROM tracks"
        .to_string();
    let mut params: Vec<String> = Vec::new();
    if let Some(ids) = request.track_ids.as_ref() {
        if ids.is_empty() {
            return Err("track_ids cannot be empty when provided".to_string());
        }
        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        sql.push_str(&format!(" WHERE id IN ({})", placeholders.join(",")));
        params.extend(ids.iter().cloned());
    }

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

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows: Vec<TagHealthRow> = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
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

/// The metadata columns a write may touch.
///
/// `None` leaves a column untouched; `Some(0)` clears it, because both
/// columns are stored as NULL and 0 is not a valid rating or energy level.
#[derive(Debug, Clone, Copy, Default)]
struct MetadataPatch {
    rating: Option<i64>,
    energy: Option<i64>,
}

impl MetadataPatch {
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
        if self.rating.is_none() && self.energy.is_none() {
            return Err("nothing to update".to_string());
        }
        Ok(())
    }
}

/// `0` clears a column, so it is stored as NULL rather than as a zero.
fn stored_value(value: i64) -> Option<i64> {
    (value != 0).then_some(value)
}

/// Writes a rating and/or an energy level to one or more tracks.
///
/// The write is reversible: the previous values are snapshotted in a
/// `skill_runs` row and the returned `undoId` restores them.
#[tauri::command]
pub async fn update_track_metadata(
    db: State<'_, Arc<Mutex<Database>>>,
    request: UpdateTrackMetadataRequest,
) -> Result<UpdateTrackMetadataResponse, String> {
    if request.track_ids.is_empty() {
        return Err("no tracks selected".to_string());
    }
    let patch = MetadataPatch {
        rating: request.rating,
        energy: request.energy,
    };
    patch.validate()?;

    let mut db_guard = db.lock().map_err(|e| e.to_string())?;
    let (undo_id, updated) = apply_metadata_patch(
        db_guard.conn_mut(),
        "update_track_metadata",
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
        energy: None,
    };
    patch.validate()?;

    let mut db_guard = db.lock().map_err(|e| e.to_string())?;
    let (undo_id, updated) = apply_metadata_patch(
        db_guard.conn_mut(),
        "set_track_rating",
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

    let (status, before_raw, after_raw): (String, Option<String>, Option<String>) = tx
        .query_row(
            "SELECT status, before_state, after_state FROM skill_runs WHERE id = ?1",
            [&request.undo_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| format!("undo snapshot not found: {}", request.undo_id))?;

    if status != "success" {
        return Err(format!(
            "undo snapshot {} is {status}, not applied",
            request.undo_id
        ));
    }

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
        // back, so an undo never touches anything else.
        let mut columns: Vec<&str> = Vec::new();
        if values.get("user_rating").is_some() {
            columns.push("user_rating");
        }
        if values.get("energy").is_some() {
            columns.push("energy");
        }
        if columns.is_empty() {
            continue;
        }

        // A newer edit won: the snapshot no longer describes the current
        // values, so it must not overwrite them.
        if !snapshot_still_current(&tx, track_id, &columns, after.get(track_id))? {
            skipped += 1;
            continue;
        }

        // `?1` is always the track id; the snapshotted columns are bound.
        let mut assignments: Vec<String> = Vec::new();
        let mut params: Vec<rusqlite::types::Value> = vec![track_id.clone().into()];
        if let Some(rating) = values.get("user_rating") {
            params.push(json_to_sql_value(rating));
            assignments.push(format!("user_rating = ?{}", params.len()));
        }
        if let Some(energy) = values.get("energy") {
            params.push(json_to_sql_value(energy));
            assignments.push(format!("energy = ?{}", params.len()));
        }
        let sql = format!(
            "UPDATE tracks SET {}, updated_at = datetime('now') WHERE id = ?1",
            assignments.join(", ")
        );
        restored += tx
            .execute(&sql, rusqlite::params_from_iter(params.iter()))
            .map_err(|e| e.to_string())? as usize;
    }

    tx.execute(
        "UPDATE skill_runs SET status = 'undone' WHERE id = ?1",
        [&request.undo_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(UndoTrackMetadataResponse { restored, skipped })
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

    // Column names come from the snapshot's own keys, never from user input.
    let sql = format!("SELECT {} FROM tracks WHERE id = ?1", columns.join(", "));
    let current: Vec<Option<i64>> = match tx.query_row(&sql, [track_id], |row| {
        let mut values = Vec::with_capacity(columns.len());
        for column in columns {
            values.push(row.get::<_, Option<i64>>(*column)?);
        }
        Ok(values)
    }) {
        Ok(values) => values,
        // The track is gone: there is nothing left to restore.
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(false),
        Err(e) => return Err(e.to_string()),
    };

    Ok(columns.iter().zip(current.iter()).all(|(column, value)| {
        let recorded = expected
            .get(*column)
            .map(json_to_sql_value)
            .unwrap_or(rusqlite::types::Value::Null);
        recorded == rusqlite::types::Value::from(*value)
    }))
}

/// Applies a rating/energy patch and records the undo snapshot.
///
/// The track UPDATE and the `skill_runs` INSERT share one transaction: a crash
/// between them would leave the library changed with no way back. Only the
/// columns the patch touched are snapshotted, so an undo restores exactly
/// what the write changed.
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

    // Ids are bound, never interpolated into the SQL text.
    let placeholders = std::iter::repeat_n("?", track_ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let select_sql =
        format!("SELECT id, user_rating, energy FROM tracks WHERE id IN ({placeholders})");
    let rows: Vec<(String, Option<i64>, Option<i64>)> = {
        let mut stmt = tx.prepare(&select_sql).map_err(|e| e.to_string())?;
        // A row that fails to map is an error, not a row to skip.
        let collected = stmt
            .query_map(rusqlite::params_from_iter(track_ids.iter()), |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        collected
    };

    let mut before = serde_json::Map::new();
    let mut after = serde_json::Map::new();
    let mut updated = 0usize;

    for (track_id, previous_rating, previous_energy) in &rows {
        let mut assignments: Vec<String> = Vec::new();
        let mut params: Vec<rusqlite::types::Value> = vec![track_id.clone().into()];
        let mut before_values = serde_json::Map::new();
        let mut after_values = serde_json::Map::new();

        // Only a column whose value really differs is written and snapshotted.
        // A track that already holds the requested value is left alone: the
        // write would change nothing, so it is neither counted as updated nor
        // recorded in the snapshot (there is nothing to restore).
        if let Some(rating) = patch.rating {
            let stored = stored_value(rating);
            if stored != *previous_rating {
                params.push(stored.into());
                assignments.push(format!("user_rating = ?{}", params.len()));
                before_values.insert(
                    "user_rating".to_string(),
                    serde_json::Value::from(*previous_rating),
                );
                after_values.insert("user_rating".to_string(), serde_json::Value::from(stored));
            }
        }
        if let Some(energy) = patch.energy {
            let stored = stored_value(energy);
            if stored != *previous_energy {
                params.push(stored.into());
                assignments.push(format!("energy = ?{}", params.len()));
                before_values.insert(
                    "energy".to_string(),
                    serde_json::Value::from(*previous_energy),
                );
                after_values.insert("energy".to_string(), serde_json::Value::from(stored));
            }
        }

        if assignments.is_empty() {
            continue;
        }

        let sql = format!(
            "UPDATE tracks SET {}, updated_at = datetime('now') WHERE id = ?1",
            assignments.join(", ")
        );
        updated += tx
            .execute(&sql, rusqlite::params_from_iter(params.iter()))
            .map_err(|e| e.to_string())? as usize;

        before.insert(track_id.clone(), serde_json::Value::Object(before_values));
        after.insert(track_id.clone(), serde_json::Value::Object(after_values));
    }

    let undo_id = Uuid::new_v4().to_string();
    let input_summary = serde_json::json!({
        "trackIds": track_ids,
        "rating": patch.rating,
        "energy": patch.energy,
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

/// Converts a snapshot value back into a bound SQL value. Anything that is not
/// an integer (including JSON `null`) restores as NULL.
fn json_to_sql_value(value: &serde_json::Value) -> rusqlite::types::Value {
    match value {
        serde_json::Value::Null => rusqlite::types::Value::Null,
        serde_json::Value::Number(number) => number
            .as_i64()
            .map(rusqlite::types::Value::Integer)
            .unwrap_or(rusqlite::types::Value::Null),
        _ => rusqlite::types::Value::Null,
    }
}
