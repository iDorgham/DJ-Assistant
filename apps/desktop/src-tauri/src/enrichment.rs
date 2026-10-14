//! Online enrichment transport + orchestration (TE.1 / TE.3).
//!
//! - Transport fetches provider JSON and cover-art images over HTTPS with a
//!   descriptive User-Agent (required by MusicBrainz) and per-provider rate
//!   limiting. Audio preview/stream URLs in responses are never requested.
//! - Orchestration implements preview → apply → undo against migration 003/004
//!   tables: proposals persist in `enrichment_candidates`, snapshots in
//!   `enrichment_runs.before_state` / `after_state`, provider IDs in
//!   `external_ids`. Text and artwork apply to DB canonical fields only —
//!   source audio files are never touched, and restored artwork pointers stay
//!   valid because the cache is content-addressed and append-only.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::Database;
use crate::models::{
    EnrichmentApplyRequest, EnrichmentApplyResponse, EnrichmentPreviewRequest,
    EnrichmentPreviewResponse, EnrichmentProgressEvent, EnrichmentUndoRequest,
    EnrichmentUndoResponse, TrackProposal,
};

/// Required by MusicBrainz (they throttle or block anonymous clients).
pub const USER_AGENT: &str = "DJ-Assistant/0.1.0 (https://github.com/iDorgham/dj-assistant)";
/// MusicBrainz asks for at most ~1 request/second per client.
const MUSICBRAINZ_MIN_INTERVAL: Duration = Duration::from_millis(1100);
const HTTP_TIMEOUT: Duration = Duration::from_secs(20);
/// Refuse absurdly large "images" before they hit memory or disk.
const MAX_IMAGE_BYTES: usize = 10_000_000;

/// Last-call timestamps for rate-limited providers. Managed Tauri state.
#[derive(Default)]
pub struct RateLimiter {
    last_musicbrainz: Mutex<Option<Instant>>,
    last_discogs: Mutex<Option<Instant>>,
}

impl RateLimiter {
    async fn wait_for(&self, slot: &Mutex<Option<Instant>>, interval: Duration) {
        let delay = {
            let guard = slot.lock().unwrap_or_else(|e| e.into_inner());
            match *guard {
                Some(last) => interval.saturating_sub(last.elapsed()),
                None => Duration::ZERO,
            }
        };
        if !delay.is_zero() {
            tokio::time::sleep(delay).await;
        }
        let mut guard = slot.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(Instant::now());
    }

    async fn wait_musicbrainz(&self) {
        self.wait_for(&self.last_musicbrainz, MUSICBRAINZ_MIN_INTERVAL)
            .await;
    }

    async fn wait_discogs(&self) {
        // Authenticated Discogs quota is 60 requests/minute.
        self.wait_for(&self.last_discogs, MUSICBRAINZ_MIN_INTERVAL)
            .await;
    }
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(HTTP_TIMEOUT)
        .build()
        .map_err(|e| format!("cannot build HTTP client: {e}"))
}

async fn fetch_json(
    client: &reqwest::Client,
    limiter: &RateLimiter,
    provider: dj_assistant_core::EnrichmentProvider,
    url: &str,
) -> Result<serde_json::Value, String> {
    if provider == dj_assistant_core::EnrichmentProvider::MusicBrainz {
        limiter.wait_musicbrainz().await;
    } else if provider == dj_assistant_core::EnrichmentProvider::Discogs {
        limiter.wait_discogs().await;
    }
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("{}: request failed: {e}", provider.as_str()))?;
    let status = response.status();
    if status.as_u16() == 429 {
        return Err(format!(
            "{}: rate limited (429) — wait a minute and retry",
            provider.as_str()
        ));
    }
    if !status.is_success() {
        return Err(format!(
            "{}: unexpected status {}",
            provider.as_str(),
            status.as_u16()
        ));
    }
    response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("{}: invalid JSON: {e}", provider.as_str()))
}

/// Downloads a cover-art image: redirects followed, MIME must be an image,
/// body capped before it is trusted.
async fn fetch_image(client: &reqwest::Client, url: &str) -> Result<(Vec<u8>, String), String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("artwork download failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "artwork download failed: status {}",
            response.status().as_u16()
        ));
    }
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .split(';')
        .next()
        .unwrap_or("image/jpeg")
        .trim()
        .to_string();
    if !mime.starts_with("image/") {
        return Err(format!("artwork is not an image (got {mime})"));
    }
    let mut bytes = Vec::new();
    let mut response = response;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("artwork download failed: {e}"))?
    {
        if chunk.len() > MAX_IMAGE_BYTES - bytes.len() {
            return Err(format!("artwork too large (cap {MAX_IMAGE_BYTES})"));
        }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.is_empty() {
        return Err("artwork download was empty".to_string());
    }
    Ok((bytes, mime))
}

fn artwork_dir(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("artwork"))
        .unwrap_or_else(|_| std::path::PathBuf::from("artwork"))
}

fn emit_progress(app: &AppHandle, payload: &EnrichmentProgressEvent) {
    if let Err(e) = app.emit("enrichment:progress", payload) {
        log::warn!("enrichment:progress emit failed: {e}");
    }
}

fn upsert_external_id(
    conn: &rusqlite::Connection,
    track_id: &str,
    provider: &str,
    provider_id: &str,
    confidence: f64,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO external_ids (track_id, provider, provider_id, confidence)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (track_id, provider) DO UPDATE SET
           provider_id = excluded.provider_id, confidence = excluded.confidence",
        rusqlite::params![track_id, provider, provider_id, confidence],
    )?;
    Ok(())
}

/// Looks up gap tracks on one provider and records reviewable proposals.
///
/// One provider per run (the UI offers the choice; default MusicBrainz).
/// Nothing is applied here — `enrichment_apply` does that from the recorded
/// candidates, so preview and apply can never disagree.
#[tauri::command]
pub async fn enrichment_preview(
    app: AppHandle,
    db: State<'_, std::sync::Arc<Mutex<Database>>>,
    limiter: State<'_, RateLimiter>,
    request: EnrichmentPreviewRequest,
) -> Result<EnrichmentPreviewResponse, String> {
    use dj_assistant_core::{
        discogs_search_url, itunes_search_url, lastfm_search_url, musicbrainz_search_url,
        parse_acoustid_response, parse_deezer_response, parse_discogs_response,
        parse_itunes_response, parse_lastfm_response, parse_musicbrainz_response, propose_fields,
        EnrichmentProvider, LocalTrack, ProviderCandidate,
    };

    let provider = request
        .provider
        .as_deref()
        .map(EnrichmentProvider::parse)
        .unwrap_or(Some(EnrichmentProvider::MusicBrainz))
        .ok_or_else(|| {
            format!(
                "unknown enrichment provider: {}",
                request.provider.as_deref().unwrap_or("")
            )
        })?;
    // Key-gated providers fail the whole run up front with an actionable
    // message instead of one skip per track.
    let api_key = match provider {
        EnrichmentProvider::Discogs => std::env::var("DISCOGS_TOKEN").unwrap_or_default(),
        EnrichmentProvider::LastFm => std::env::var("LASTFM_API_KEY").unwrap_or_default(),
        EnrichmentProvider::AcoustId => std::env::var("ACOUSTID_API_KEY").unwrap_or_default(),
        _ => String::new(),
    };
    if provider.needs_key() && api_key.trim().is_empty() {
        let var = match provider {
            EnrichmentProvider::Discogs => "DISCOGS_TOKEN",
            EnrichmentProvider::LastFm => "LASTFM_API_KEY",
            _ => "ACOUSTID_API_KEY",
        };
        return Err(format!(
            "{}: not configured — export {var} with a free API key/token and retry",
            provider.as_str()
        ));
    }
    if provider == EnrichmentProvider::AcoustId {
        return Err(
            "acoustid: local fingerprinting needs the native Chromaprint library (pending) — \
             query shape and parser are ready; fingerprint computation is the remaining piece"
                .to_string(),
        );
    }
    // Polite default: free catalog APIs are shared infrastructure.
    let limit = request.limit.unwrap_or(25).clamp(1, 50) as usize;

    let client = http_client()?;
    let run_id = uuid::Uuid::new_v4().to_string();

    // Resolve target tracks: explicit list, else tracks that have tag gaps.
    // Gap detection reuses the same core definition as `track_tag_health`.
    struct Target {
        id: String,
        title: String,
        artist: String,
        local: LocalTrack,
    }
    struct PreviewRow {
        id: String,
        title: String,
        artist: String,
        album: Option<String>,
        genre: Option<String>,
        year: Option<i64>,
        isrc: Option<String>,
        artwork: Option<String>,
    }
    let targets: Vec<Target> = {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        let conn = db_guard.conn();
        let mut sql =
            "SELECT id, title, artist, album, genre, year, isrc, artwork_hash FROM tracks"
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
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows: Vec<PreviewRow> = stmt
            .query_map(rusqlite::params_from_iter(params.iter()), |row| {
                Ok(PreviewRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    artist: row.get(2)?,
                    album: row.get(3)?,
                    genre: row.get(4)?,
                    year: row.get(5)?,
                    isrc: row.get(6)?,
                    artwork: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .flatten()
            .collect();
        let mut targets = Vec::new();
        for row in rows.into_iter().take(limit) {
            let local = LocalTrack {
                title: row.title.clone(),
                artist: row.artist.clone(),
                album: row.album,
                genre: row.genre,
                year: row.year.map(|y| y as i32),
                isrc: row.isrc,
                artwork_hash: row.artwork,
            };
            if dj_assistant_core::missing_fields(&local).is_empty() {
                continue;
            }
            targets.push(Target {
                id: row.id,
                title: row.title,
                artist: row.artist,
                local,
            });
            if targets.len() >= limit {
                break;
            }
        }
        targets
    };

    // Record the run first so progress events and candidates have a home.
    {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        db_guard
            .conn()
            .execute(
                "INSERT INTO enrichment_runs (id, workspace_id, provider, status)
                 VALUES (?1, 'default', ?2, 'preview')",
                rusqlite::params![run_id, provider.as_str()],
            )
            .map_err(|e| e.to_string())?;
    }

    let mut proposals: Vec<TrackProposal> = Vec::new();
    let mut skipped = 0usize;
    let total = targets.len();

    for (index, target) in targets.iter().enumerate() {
        let url = match provider {
            EnrichmentProvider::MusicBrainz => {
                musicbrainz_search_url(&target.artist, &target.title)
            }
            EnrichmentProvider::ITunes => itunes_search_url(&target.artist, &target.title),
            EnrichmentProvider::Deezer => {
                dj_assistant_core::deezer_search_url(&target.artist, &target.title)
            }
            EnrichmentProvider::Discogs => {
                discogs_search_url(&target.artist, &target.title, &api_key)
            }
            EnrichmentProvider::LastFm => {
                lastfm_search_url(&target.artist, &target.title, &api_key)
            }
            // Rejected up front (needs a local fingerprint); kept exhaustive.
            EnrichmentProvider::AcoustId => None,
        };
        let lookup = async {
            let url =
                url.ok_or_else(|| "nothing searchable (blank artist and title)".to_string())?;
            let body = fetch_json(&client, &limiter, provider, &url).await?;
            let text = serde_json::to_string(&body).map_err(|e| e.to_string())?;
            let mut candidates: Vec<ProviderCandidate> = match provider {
                EnrichmentProvider::MusicBrainz => {
                    parse_musicbrainz_response(&text, &target.artist, &target.title, 1)?
                }
                EnrichmentProvider::ITunes => {
                    parse_itunes_response(&text, &target.artist, &target.title, 1)?
                }
                EnrichmentProvider::Deezer => {
                    parse_deezer_response(&text, &target.artist, &target.title, 1)?
                }
                EnrichmentProvider::Discogs => {
                    parse_discogs_response(&text, &target.artist, &target.title, 1)?
                }
                EnrichmentProvider::LastFm => {
                    parse_lastfm_response(&text, &target.artist, &target.title, 1)?
                }
                EnrichmentProvider::AcoustId => {
                    parse_acoustid_response(&text, &target.artist, &target.title, 1)?
                }
            };
            candidates
                .pop()
                .ok_or_else(|| "no catalog match".to_string())
        };
        let candidate = lookup.await;
        let candidate = match candidate {
            Ok(candidate) => candidate,
            Err(reason) => {
                skipped += 1;
                emit_progress(
                    &app,
                    &EnrichmentProgressEvent {
                        run_id: run_id.clone(),
                        processed: index + 1,
                        total,
                        track_id: target.id.clone(),
                        status: format!("skipped: {reason}"),
                    },
                );
                continue;
            }
        };

        let changes = propose_fields(&target.local, &candidate);
        if changes.is_empty() {
            skipped += 1;
            emit_progress(
                &app,
                &EnrichmentProgressEvent {
                    run_id: run_id.clone(),
                    processed: index + 1,
                    total,
                    track_id: target.id.clone(),
                    status: "skipped: match has nothing new".to_string(),
                },
            );
            continue;
        }

        let tier = dj_assistant_core::confidence_tier(candidate.confidence).to_string();
        {
            let db_guard = db.lock().map_err(|e| e.to_string())?;
            let conn = db_guard.conn();
            for change in &changes {
                let field_value = if change.field == "artwork" {
                    candidate.artwork_url.clone()
                } else {
                    None
                };
                conn.execute(
                    "INSERT INTO enrichment_candidates
                     (id, run_id, track_id, provider, provider_id, confidence, status,
                      field, current_value, proposed_value, artwork_url, source_url)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                    rusqlite::params![
                        uuid::Uuid::new_v4().to_string(),
                        run_id,
                        target.id,
                        provider.as_str(),
                        candidate.provider_id,
                        candidate.confidence,
                        tier,
                        change.field,
                        change.current,
                        change.proposed,
                        field_value,
                        candidate.source_url,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }
            upsert_external_id(
                conn,
                &target.id,
                provider.as_str(),
                &candidate.provider_id,
                candidate.confidence,
            )
            .map_err(|e| e.to_string())?;
        }

        proposals.push(TrackProposal {
            track_id: target.id.clone(),
            title: target.title.clone(),
            artist: target.artist.clone(),
            provider: provider.as_str().to_string(),
            provider_id: candidate.provider_id.clone(),
            confidence: candidate.confidence,
            tier: tier.clone(),
            source_url: candidate.source_url.clone(),
            changes: changes
                .into_iter()
                .map(|c| crate::models::ProposedChange {
                    field: c.field,
                    current: c.current,
                    proposed: c.proposed,
                })
                .collect(),
        });
        emit_progress(
            &app,
            &EnrichmentProgressEvent {
                run_id: run_id.clone(),
                processed: index + 1,
                total,
                track_id: target.id.clone(),
                status: format!("proposed ({tier})"),
            },
        );
    }

    let proposed_changes: usize = proposals.iter().map(|p| p.changes.len()).sum();
    {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        db_guard
            .conn()
            .execute(
                "UPDATE enrichment_runs SET proposed_count = ?1 WHERE id = ?2",
                rusqlite::params![proposed_changes as i64, run_id],
            )
            .map_err(|e| e.to_string())?;
    }

    Ok(EnrichmentPreviewResponse {
        run_id,
        provider: provider.as_str().to_string(),
        proposed_tracks: proposals.len(),
        proposed_changes,
        skipped,
        proposals,
    })
}

/// Applies recorded preview proposals to DB canonical fields.
///
/// Text fields update in place; artwork downloads only when the track has none
/// (a failed download skips just that field). Snapshots go to
/// `enrichment_runs.before_state` / `after_state` for undo.
#[tauri::command]
pub async fn enrichment_apply(
    app: AppHandle,
    db: State<'_, std::sync::Arc<Mutex<Database>>>,
    request: EnrichmentApplyRequest,
) -> Result<EnrichmentApplyResponse, String> {
    let client = http_client()?;
    let art_dir = artwork_dir(&app);

    struct CandidateRow {
        track_id: String,
        field: String,
        proposed: String,
        artwork_url: Option<String>,
    }
    let rows: Vec<CandidateRow> = {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        let conn = db_guard.conn();
        let status: String = conn
            .query_row(
                "SELECT status FROM enrichment_runs WHERE id = ?1",
                [&request.run_id],
                |row| row.get(0),
            )
            .map_err(|_| format!("enrichment run not found: {}", request.run_id))?;
        if status != "preview" {
            return Err(format!("run {} is {status}, not preview", request.run_id));
        }
        let mut sql = "SELECT track_id, field, proposed_value, artwork_url
             FROM enrichment_candidates WHERE run_id = ?1"
            .to_string();
        let mut params: Vec<String> = vec![request.run_id.clone()];
        if let Some(ids) = request.track_ids.as_ref() {
            if ids.is_empty() {
                return Err("track_ids cannot be empty when provided".to_string());
            }
            let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
            sql.push_str(&format!(" AND track_id IN ({})", placeholders.join(",")));
            params.extend(ids.iter().cloned());
        }
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows: Vec<CandidateRow> = stmt
            .query_map(rusqlite::params_from_iter(params.iter()), |row| {
                Ok(CandidateRow {
                    track_id: row.get(0)?,
                    field: row.get(1)?,
                    proposed: row.get(2)?,
                    artwork_url: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .flatten()
            .collect();
        rows
    };

    // Group by track; snapshot current values first for undo.
    let mut by_track: std::collections::BTreeMap<String, Vec<CandidateRow>> =
        std::collections::BTreeMap::new();
    for row in rows {
        by_track.entry(row.track_id.clone()).or_default().push(row);
    }

    let mut applied = 0usize;
    let mut skipped = 0usize;
    let mut before = serde_json::Map::new();
    let mut after = serde_json::Map::new();

    for (track_id, fields) in &by_track {
        struct CurrentTrack {
            title: String,
            artist: String,
            album: Option<String>,
            genre: Option<String>,
            year: Option<i64>,
            isrc: Option<String>,
            art_hash: Option<String>,
            art_path: Option<String>,
            art_mime: Option<String>,
        }
        let current = {
            let db_guard = db.lock().map_err(|e| e.to_string())?;
            db_guard
                .conn()
                .query_row(
                    "SELECT title, artist, album, genre, year, isrc,
                            artwork_hash, artwork_path, artwork_mime
                     FROM tracks WHERE id = ?1",
                    [track_id],
                    |row| {
                        Ok(CurrentTrack {
                            title: row.get(0)?,
                            artist: row.get(1)?,
                            album: row.get(2)?,
                            genre: row.get(3)?,
                            year: row.get(4)?,
                            isrc: row.get(5)?,
                            art_hash: row.get(6)?,
                            art_path: row.get(7)?,
                            art_mime: row.get(8)?,
                        })
                    },
                )
                .map_err(|e| format!("track not found: {e}"))?
        };
        let CurrentTrack {
            title,
            artist,
            album,
            genre,
            year,
            isrc,
            art_hash,
            art_path,
            art_mime,
        } = current;
        before.insert(
            track_id.clone(),
            serde_json::json!({
                "title": title, "artist": artist, "album": album, "genre": genre,
                "year": year, "isrc": isrc,
                "artwork_hash": art_hash, "artwork_path": art_path, "artwork_mime": art_mime,
            }),
        );

        let mut new_title = title.clone();
        let mut new_artist = artist.clone();
        let mut new_album = album.clone();
        let mut new_genre = genre.clone();
        let mut new_year = year;
        let mut new_isrc = isrc.clone();
        let (mut new_hash, mut new_path, mut new_mime) =
            (art_hash.clone(), art_path.clone(), art_mime.clone());
        let mut track_applied = 0usize;

        for field in fields {
            match field.field.as_str() {
                "title" => {
                    new_title = field.proposed.clone();
                    track_applied += 1;
                }
                "artist" => {
                    new_artist = field.proposed.clone();
                    track_applied += 1;
                }
                "album" => {
                    new_album = Some(field.proposed.clone());
                    track_applied += 1;
                }
                "genre" => {
                    new_genre = Some(field.proposed.clone());
                    track_applied += 1;
                }
                "year" => {
                    if let Ok(y) = field.proposed.parse::<i64>() {
                        new_year = Some(y);
                        track_applied += 1;
                    } else {
                        skipped += 1;
                    }
                }
                "isrc" => {
                    new_isrc = Some(field.proposed.clone());
                    track_applied += 1;
                }
                "artwork" => {
                    // Artwork fills only an empty slot; a failed download skips
                    // just this field — text proposals still apply.
                    if art_hash.is_some() {
                        skipped += 1;
                        continue;
                    }
                    let url = field
                        .artwork_url
                        .clone()
                        .unwrap_or_else(|| field.proposed.clone());
                    match fetch_image(&client, &url).await {
                        Ok((bytes, mime)) => {
                            match dj_assistant_core::cache_artwork(
                                &dj_assistant_core::EmbeddedArtwork {
                                    mime_type: mime.clone(),
                                    data: bytes,
                                },
                                &art_dir,
                            ) {
                                Ok(cached) => {
                                    new_hash = Some(cached.hash);
                                    new_path = Some(cached.path.to_string_lossy().to_string());
                                    new_mime = Some(cached.mime_type);
                                    track_applied += 1;
                                }
                                Err(e) => {
                                    log::warn!("artwork cache failed for {track_id}: {e}");
                                    skipped += 1;
                                }
                            }
                        }
                        Err(e) => {
                            log::warn!("artwork download skipped for {track_id}: {e}");
                            skipped += 1;
                        }
                    }
                }
                unknown => {
                    log::warn!("unknown enrichment field {unknown} for {track_id}");
                    skipped += 1;
                }
            }
        }

        {
            let db_guard = db.lock().map_err(|e| e.to_string())?;
            db_guard
                .conn()
                .execute(
                    "UPDATE tracks SET title = ?1, artist = ?2, album = ?3, genre = ?4,
                     year = ?5, isrc = ?6, artwork_hash = ?7, artwork_path = ?8,
                     artwork_mime = ?9, updated_at = datetime('now') WHERE id = ?10",
                    rusqlite::params![
                        new_title, new_artist, new_album, new_genre, new_year, new_isrc, new_hash,
                        new_path, new_mime, track_id,
                    ],
                )
                .map_err(|e| e.to_string())?;
        }
        after.insert(
            track_id.clone(),
            serde_json::json!({
                "title": new_title, "artist": new_artist, "album": new_album,
                "genre": new_genre, "year": new_year, "isrc": new_isrc,
                "artwork_hash": new_hash, "artwork_path": new_path,
                "artwork_mime": new_mime,
            }),
        );
        applied += track_applied;
    }

    {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        db_guard
            .conn()
            .execute(
                "UPDATE enrichment_runs SET status = 'applied', applied_count = ?1,
                 before_state = ?2, after_state = ?3 WHERE id = ?4",
                rusqlite::params![
                    applied as i64,
                    serde_json::Value::Object(before).to_string(),
                    serde_json::Value::Object(after).to_string(),
                    request.run_id,
                ],
            )
            .map_err(|e| e.to_string())?;
    }

    Ok(EnrichmentApplyResponse {
        run_id: request.run_id,
        applied,
        skipped,
    })
}

/// Restores a run's `before_state` snapshot: exact values back, run marked
/// `undone`. Restored artwork pointers stay valid because the cache is
/// content-addressed and append-only.
#[tauri::command]
pub async fn enrichment_undo(
    db: State<'_, std::sync::Arc<Mutex<Database>>>,
    request: EnrichmentUndoRequest,
) -> Result<EnrichmentUndoResponse, String> {
    let (status, before_raw): (String, Option<String>) = {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        db_guard
            .conn()
            .query_row(
                "SELECT status, before_state FROM enrichment_runs WHERE id = ?1",
                [&request.run_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| format!("enrichment run not found: {}", request.run_id))?
    };
    if status != "applied" {
        return Err(format!("run {} is {status}, not applied", request.run_id));
    }
    let before: serde_json::Value = before_raw
        .ok_or_else(|| format!("run {} has no snapshot", request.run_id))
        .and_then(|raw| serde_json::from_str(&raw).map_err(|e| e.to_string()))?;
    let snapshot = before
        .as_object()
        .ok_or_else(|| format!("run {} has a corrupt snapshot", request.run_id))?;

    let mut restored = 0usize;
    {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        let conn = db_guard.conn();
        for (track_id, values) in snapshot {
            let get_str = |key: &str| -> Option<String> {
                values.get(key).and_then(|v| v.as_str()).map(str::to_string)
            };
            let year = values.get("year").and_then(|v| v.as_i64());
            let changed = conn
                .execute(
                    "UPDATE tracks SET title = ?1, artist = ?2, album = ?3, genre = ?4,
                     year = ?5, isrc = ?6, artwork_hash = ?7, artwork_path = ?8,
                     artwork_mime = ?9, updated_at = datetime('now') WHERE id = ?10",
                    rusqlite::params![
                        get_str("title").unwrap_or_default(),
                        get_str("artist").unwrap_or_else(|| "Unknown Artist".to_string()),
                        get_str("album"),
                        get_str("genre"),
                        year,
                        get_str("isrc"),
                        get_str("artwork_hash"),
                        get_str("artwork_path"),
                        get_str("artwork_mime"),
                        track_id,
                    ],
                )
                .map_err(|e| e.to_string())?;
            restored += changed;
        }
        conn.execute(
            "UPDATE enrichment_runs SET status = 'undone' WHERE id = ?1",
            [&request.run_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(EnrichmentUndoResponse {
        run_id: request.run_id,
        restored,
    })
}
