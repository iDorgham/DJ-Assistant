//! Multi-provider matching (TX.1 / TX.2a): live Deezer reads, no key required.
//!
//! `provider_match_tracks` / `provider_match_set` resolve local tracks against
//! the Deezer catalog — ISRC-exact first, then fuzzy search — with the same
//! confidence tiers as enrichment. They write nothing: no playlists, no
//! accounts, no audio.
//!
//! Playlist writes (`provider_export_playlist`) and OAuth (`provider_connect`)
//! ship once a Deezer application ID is configured (TX.2b); until then they
//! return `not_configured` naming the missing piece, `provider_status`
//! reports zero connected accounts, and the UI keeps export controls disabled
//! with that reason.

use std::sync::Mutex;

use tauri::State;

use crate::db::Database;
use crate::enrichment::RateLimiter;
use crate::models::{
    ProviderExportPlaylistRequest, ProviderMatchSetRequest, ProviderMatchTracksRequest,
    ProviderMatchTracksResponse, ProviderTrackMatch,
};

/// Local track identity needed for catalog matching.
struct MatchTarget {
    track_id: String,
    title: String,
    artist: String,
    isrc: Option<String>,
}

fn load_targets(
    conn: &rusqlite::Connection,
    track_ids: &[String],
) -> Result<Vec<MatchTarget>, String> {
    let mut targets = Vec::new();
    for track_id in track_ids {
        let row: Result<(String, String, Option<String>), _> = conn.query_row(
            "SELECT title, artist, isrc FROM tracks WHERE id = ?1",
            [track_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        );
        match row {
            Ok((title, artist, isrc)) => targets.push(MatchTarget {
                track_id: track_id.clone(),
                title,
                artist,
                isrc,
            }),
            Err(_) => {
                // Unknown IDs are reported, not fatal to the batch.
                targets.push(MatchTarget {
                    track_id: track_id.clone(),
                    title: String::new(),
                    artist: String::new(),
                    isrc: None,
                });
            }
        }
    }
    Ok(targets)
}

fn unmatched(track_id: &str) -> ProviderTrackMatch {
    ProviderTrackMatch {
        track_id: track_id.to_string(),
        provider: "deezer".to_string(),
        provider_id: None,
        title: None,
        artist: None,
        album: None,
        artwork_url: None,
        source_url: None,
        confidence: 0.0,
        tier: "low".to_string(),
        status: "unmatched".to_string(),
    }
}

async fn match_deezer(
    client: &reqwest::Client,
    targets: &[MatchTarget],
) -> Vec<ProviderTrackMatch> {
    use dj_assistant_core::{
        confidence_tier, deezer_isrc_url, deezer_search_url, match_confidence,
        parse_deezer_response,
    };

    let mut matches = Vec::new();
    for target in targets {
        let MatchTarget {
            track_id,
            title,
            artist,
            isrc,
        } = target;
        if title.trim().is_empty() && artist.trim().is_empty() {
            matches.push(unmatched(track_id));
            continue;
        }
        // ISRC-exact first; fuzzy search otherwise.
        let mut url = isrc
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .and_then(deezer_isrc_url);
        let mut exact = url.is_some();
        if url.is_none() {
            url = deezer_search_url(artist, title);
            exact = false;
        }
        let result = match url {
            None => None,
            Some(endpoint) => {
                // Deezer publishes no request quota; the shared limiter stays
                // reserved for providers that need one (MusicBrainz).
                match client.get(&endpoint).send().await {
                    Ok(response) if response.status().is_success() => match response.text().await {
                        Ok(text) => parse_deezer_response(&text, artist, title, 1)
                            .ok()
                            .and_then(|mut c| c.pop()),
                        Err(_) => None,
                    },
                    _ => None,
                }
            }
        };
        match result {
            None => matches.push(unmatched(track_id)),
            Some(candidate) => {
                // An ISRC hit is exact by construction; fuzzy hits keep the
                // name-based score so compilations land in review, not auto-add.
                let confidence = if exact {
                    0.95
                } else {
                    match_confidence(artist, title, &candidate.artist, &candidate.title)
                };
                let tier = confidence_tier(confidence).to_string();
                let status = if confidence >= 0.85 {
                    "matched"
                } else if confidence >= 0.50 {
                    "review"
                } else {
                    "unmatched"
                }
                .to_string();
                matches.push(ProviderTrackMatch {
                    track_id: track_id.clone(),
                    provider: "deezer".to_string(),
                    provider_id: Some(candidate.provider_id),
                    title: Some(candidate.title),
                    artist: Some(candidate.artist),
                    album: candidate.album,
                    artwork_url: candidate.artwork_url,
                    source_url: candidate.source_url,
                    confidence,
                    tier,
                    status,
                });
            }
        }
    }
    matches
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(crate::enrichment::USER_AGENT)
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("cannot build HTTP client: {e}"))
}

/// Matches explicit local tracks against one provider's catalog.
///
/// Only `"deezer"` is supported today: reads need no auth. Any other provider
/// returns `unsupported_provider` rather than a guess.
#[tauri::command]
pub async fn provider_match_tracks(
    db: State<'_, std::sync::Arc<Mutex<Database>>>,
    _limiter: State<'_, RateLimiter>,
    request: ProviderMatchTracksRequest,
) -> Result<ProviderMatchTracksResponse, String> {
    if !request.provider.trim().eq_ignore_ascii_case("deezer") {
        return Err(format!(
            "unsupported_provider: {} (supported: deezer)",
            request.provider
        ));
    }
    if request.track_ids.is_empty() {
        return Err("track_ids cannot be empty".to_string());
    }

    let client = http_client()?;
    let targets = {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        load_targets(db_guard.conn(), &request.track_ids)?
    };

    Ok(ProviderMatchTracksResponse {
        provider: "deezer".to_string(),
        matches: match_deezer(&client, &targets).await,
    })
}

/// Generic set match (TX.1): same Deezer matcher behind the provider contract.
///
/// `set_id` waits on Phase 3 sets — pass `track_ids` today. Spotify and other
/// targets return `unsupported_provider` until their matchers land (TP/TX.3).
#[tauri::command]
pub async fn provider_match_set(
    db: State<'_, std::sync::Arc<Mutex<Database>>>,
    _limiter: State<'_, RateLimiter>,
    request: ProviderMatchSetRequest,
) -> Result<ProviderMatchTracksResponse, String> {
    if !request.provider.trim().eq_ignore_ascii_case("deezer") {
        return Err(format!(
            "unsupported_provider: {} (supported: deezer)",
            request.provider
        ));
    }
    if request.set_id.is_some() {
        return Err("set matching waits on Phase 3 sets — pass track_ids for now".to_string());
    }
    let track_ids = request.track_ids.unwrap_or_default();
    if track_ids.is_empty() {
        return Err("track_ids cannot be empty (sets are not implemented yet)".to_string());
    }

    let client = http_client()?;
    let targets = {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        load_targets(db_guard.conn(), &track_ids)?
    };

    Ok(ProviderMatchTracksResponse {
        provider: "deezer".to_string(),
        matches: match_deezer(&client, &targets).await,
    })
}

/// Playlist publishing (TX.2b / TP): not wired yet — returns `not_configured`
/// naming the missing credential instead of a guess or a silent no-op.
#[tauri::command]
pub async fn provider_export_playlist(
    request: ProviderExportPlaylistRequest,
) -> Result<ProviderMatchTracksResponse, String> {
    let provider = request.provider.trim().to_ascii_lowercase();
    if provider == "deezer" {
        return Err(
            "not_configured: Deezer playlist writes need a registered application ID \
             (export DEEZER_APP_ID) plus the TX.2b OAuth flow — matching stays read-only"
                .to_string(),
        );
    }
    if provider == "spotify" {
        return Err(
            "not_configured: Spotify export lands in TP (desktop PKCE OAuth) — \
             set SPOTIFY_CLIENT_ID and implement the TP flow"
                .to_string(),
        );
    }
    Err(format!("unsupported_provider: {provider}"))
}
