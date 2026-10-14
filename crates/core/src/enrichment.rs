//! Online metadata enrichment: pure query builders, response parsers and
//! match confidence for tag/artwork lookup.
//!
//! No I/O happens here — HTTP transport, rate limiting and database writes
//! live in the desktop crate (`apps/desktop/src-tauri/src/enrichment.rs`), so
//! this module stays unit-testable on any toolchain. Parsers are validated
//! against trimmed real API responses (see tests).
//!
//! Posture (ADR-0007): enrichment fills gaps found by `missing_fields` through
//! ISRC-first → fingerprint → fuzzy matching with confidence tiers, always
//! preview → apply → undo. Only metadata and search queries leave the device;
//! audio preview/stream URLs in provider responses are never fetched.

use crate::providers::encode_query;

/// Enrichment / external-similarity sources.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EnrichmentProvider {
    MusicBrainz,
    ITunes,
    Deezer,
    /// Needs `DISCOGS_TOKEN` at call time (personal token, strict limits).
    Discogs,
    /// Needs `LASTFM_API_KEY` at call time.
    LastFm,
    /// Needs `ACOUSTID_API_KEY` *and* a Chromaprint fingerprint, whose local
    /// computation still needs the native Chromaprint library (documented
    /// follow-up) — wired for query/parse, skipped with reason until then.
    AcoustId,
}

impl EnrichmentProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            EnrichmentProvider::MusicBrainz => "musicbrainz",
            EnrichmentProvider::ITunes => "itunes",
            EnrichmentProvider::Deezer => "deezer",
            EnrichmentProvider::Discogs => "discogs",
            EnrichmentProvider::LastFm => "lastfm",
            EnrichmentProvider::AcoustId => "acoustid",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            EnrichmentProvider::MusicBrainz => "MusicBrainz",
            EnrichmentProvider::ITunes => "iTunes Search",
            EnrichmentProvider::Deezer => "Deezer",
            EnrichmentProvider::Discogs => "Discogs",
            EnrichmentProvider::LastFm => "Last.fm",
            EnrichmentProvider::AcoustId => "AcoustID",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "musicbrainz" | "musicbrainz.org" | "mb" => Some(EnrichmentProvider::MusicBrainz),
            "itunes" | "itunes_search" | "apple" => Some(EnrichmentProvider::ITunes),
            "deezer" => Some(EnrichmentProvider::Deezer),
            "discogs" => Some(EnrichmentProvider::Discogs),
            "lastfm" | "last.fm" | "last_fm" => Some(EnrichmentProvider::LastFm),
            "acoustid" | "chromaprint" => Some(EnrichmentProvider::AcoustId),
            _ => None,
        }
    }

    pub fn all() -> [EnrichmentProvider; 6] {
        [
            EnrichmentProvider::MusicBrainz,
            EnrichmentProvider::ITunes,
            EnrichmentProvider::Deezer,
            EnrichmentProvider::Discogs,
            EnrichmentProvider::LastFm,
            EnrichmentProvider::AcoustId,
        ]
    }

    /// True when a user-supplied credential must be present at call time.
    pub fn needs_key(self) -> bool {
        matches!(
            self,
            EnrichmentProvider::Discogs | EnrichmentProvider::LastFm | EnrichmentProvider::AcoustId
        )
    }
}

/// The tag-side fields of a local track relevant to enrichment. BPM/key/
/// duration are analysis-sourced and intentionally absent — enrichment fills
/// tag fields only.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct LocalTrack {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub isrc: Option<String>,
    pub artwork_hash: Option<String>,
}

fn is_blank(value: &Option<String>) -> bool {
    value.as_deref().map(str::trim).unwrap_or("").is_empty()
}

/// Names the tag fields that are missing or placeholder. `"artist"` means
/// "Unknown Artist" or blank; `"title"` means blank or "Untitled".
pub fn missing_fields(local: &LocalTrack) -> Vec<String> {
    let mut missing = Vec::new();
    if local.title.trim().is_empty() || local.title == "Untitled" {
        missing.push("title".to_string());
    }
    if local.artist.trim().is_empty() || local.artist == "Unknown Artist" {
        missing.push("artist".to_string());
    }
    if is_blank(&local.album) {
        missing.push("album".to_string());
    }
    if is_blank(&local.genre) {
        missing.push("genre".to_string());
    }
    if local.year.is_none() {
        missing.push("year".to_string());
    }
    if is_blank(&local.isrc) {
        missing.push("isrc".to_string());
    }
    if is_blank(&local.artwork_hash) {
        missing.push("artwork".to_string());
    }
    missing
}

/// One candidate from a provider catalog.
#[derive(Debug, Clone, PartialEq)]
pub struct ProviderCandidate {
    pub provider: String,
    pub provider_id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub isrc: Option<String>,
    /// Direct image URL (Cover Art Archive front, iTunes 600px, Deezer XL).
    /// Audio preview URLs in responses are never fetched and never stored here.
    pub artwork_url: Option<String>,
    /// Confidence vs the queried local track (see `match_confidence`).
    pub confidence: f64,
    /// Human-facing catalog page (recording / track view / deezer link).
    pub source_url: Option<String>,
    pub duration_ms: Option<i64>,
}

/// A single field change proposed for review: current → proposed.
#[derive(Debug, Clone, PartialEq)]
pub struct FieldProposal {
    pub field: String,
    pub current: Option<String>,
    pub proposed: String,
}

/// Proposes values only for fields that are gaps locally and present on the
/// candidate. Artwork is proposed as the image URL when the track has none.
pub fn propose_fields(local: &LocalTrack, candidate: &ProviderCandidate) -> Vec<FieldProposal> {
    let gaps = missing_fields(local);
    let mut out = Vec::new();
    let mut consider = |field: &str, current: Option<String>, proposed: Option<&str>| {
        if gaps.iter().any(|g| g == field) {
            if let Some(value) = proposed {
                let value = value.trim();
                if !value.is_empty() {
                    out.push(FieldProposal {
                        field: field.to_string(),
                        current,
                        proposed: value.to_string(),
                    });
                }
            }
        }
    };
    consider("title", Some(local.title.clone()), Some(&candidate.title));
    consider(
        "artist",
        Some(local.artist.clone()),
        Some(&candidate.artist),
    );
    consider("album", local.album.clone(), candidate.album.as_deref());
    consider("genre", local.genre.clone(), candidate.genre.as_deref());
    consider(
        "year",
        local.year.map(|y| y.to_string()),
        candidate.year.map(|y| y.to_string()).as_deref(),
    );
    consider("isrc", local.isrc.clone(), candidate.isrc.as_deref());
    consider("artwork", None, candidate.artwork_url.as_deref());
    out
}

/// Normalizes a name for comparison: lowercase, punctuation dropped, whitespace
/// collapsed. `"BICEP"` and `"Bicep (Official)"` normalize alike except for the
/// parenthetical — kept deliberately so mixes/edits still match.
pub fn normalize_name(raw: &str) -> String {
    raw.to_ascii_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Confidence that a candidate is the same recording, from normalized
/// title/artist comparison:
///
/// - both exact → `0.92` (high: ISRC or provider exactness can still promote)
/// - one exact → `0.65` (review)
/// - both contain each other → `0.50` (review floor)
/// - otherwise → `0.35` (low)
pub fn match_confidence(
    local_artist: &str,
    local_title: &str,
    cand_artist: &str,
    cand_title: &str,
) -> f64 {
    let (la, lt) = (normalize_name(local_artist), normalize_name(local_title));
    let (ca, ct) = (normalize_name(cand_artist), normalize_name(cand_title));
    if la.is_empty() || lt.is_empty() || ca.is_empty() || ct.is_empty() {
        return 0.35;
    }
    let artist_exact = la == ca;
    let title_exact = lt == ct;
    if artist_exact && title_exact {
        0.92
    } else if artist_exact || title_exact {
        0.65
    } else if (la.contains(&ca) || ca.contains(&la)) && (lt.contains(&ct) || ct.contains(&lt)) {
        0.50
    } else {
        0.35
    }
}

/// Review tier for a confidence score: high auto-applies only with explicit
/// confirmation elsewhere; review/low always need the DJ's eyes.
pub fn confidence_tier(score: f64) -> &'static str {
    if score >= 0.85 {
        "high"
    } else if score >= 0.50 {
        "review"
    } else {
        "low"
    }
}

fn search_query(artist: &str, title: &str) -> Option<String> {
    let query = format!("{} {}", artist.trim(), title.trim());
    let query = query.trim();
    if query.is_empty() {
        None
    } else {
        Some(encode_query(query))
    }
}

/// MusicBrainz recording search (`inc=isrcs` so the join key comes back when
/// the catalog has one). Requires a descriptive User-Agent at call time.
pub fn musicbrainz_search_url(artist: &str, title: &str) -> Option<String> {
    let query = format!("{} {}", artist.trim(), title.trim());
    let query = query.trim();
    if query.is_empty() {
        return None;
    }
    // Lucene `recording:`/`artist:` clauses beat a bare query for DJ catalogs.
    let clauses = format!(
        "recording:{} AND artist:{}",
        encode_query(title.trim()),
        encode_query(artist.trim())
    );
    Some(format!(
        "https://musicbrainz.org/ws/2/recording/?query={clauses}&fmt=json&limit=5&inc=isrcs"
    ))
}

/// iTunes Search API: free, no auth. `entity=song` keeps albums out.
pub fn itunes_search_url(artist: &str, title: &str) -> Option<String> {
    search_query(artist, title).map(|q| {
        format!("https://itunes.apple.com/search?term={q}&media=music&entity=song&limit=5")
    })
}

/// Deezer public search: free, no auth. ISRC-pinned lookup lives separately.
pub fn deezer_search_url(artist: &str, title: &str) -> Option<String> {
    search_query(artist, title)
        .map(|q| format!("https://api.deezer.com/search?q={q}&limit=5&order=RATING"))
}

/// Exact Deezer track lookup by ISRC — the deterministic join before fuzzy.
pub fn deezer_isrc_url(isrc: &str) -> Option<String> {
    let isrc = isrc.trim().to_ascii_uppercase();
    if isrc.is_empty() {
        None
    } else {
        Some(format!("https://api.deezer.com/track/isrc:{isrc}"))
    }
}

/// Cover Art Archive front image for a MusicBrainz release MBID
/// (302-redirects to the image; the caller follows redirects).
pub fn cover_art_front_url(release_mbid: &str) -> String {
    format!(
        "https://coverartarchive.org/release/{}/front",
        release_mbid.trim()
    )
}

/// iTunes serves `…/100x100bb.jpg`; the same path renders up to 600px.
pub fn itunes_artwork_600(url100: &str) -> String {
    url100.replace("100x100bb", "600x600bb")
}

/// Tag Health Score 0–100 from a gap list: identity fields dominate, artwork
/// and ISRC matter for enrichment, analysis-sourced fields weigh less (they
/// resolve through the analysis queue, not lookup).
///
/// Weights: title 25, artist 25, album 10, genre 5, year 5, isrc 10,
/// artwork 10, bpm 4, key 4, duration 2.
pub fn tag_health_score(missing: &[String]) -> f64 {
    let mut score: f64 = 100.0;
    for field in missing {
        score -= match field.as_str() {
            "title" | "artist" => 25.0,
            "album" | "isrc" | "artwork" => 10.0,
            "genre" | "year" => 5.0,
            "bpm" | "key" => 4.0,
            "duration" => 2.0,
            _ => 0.0,
        };
    }
    score.clamp(0.0, 100.0)
}

/// Mean score over per-track scores; `None` for an empty library.
pub fn average_health_score(scores: &[f64]) -> Option<f64> {
    if scores.is_empty() {
        return None;
    }
    Some(scores.iter().sum::<f64>() / scores.len() as f64)
}

/// Discogs database search. The token travels as a query parameter (per the
/// Discogs API); the caller appends it from `DISCOGS_TOKEN`.
pub fn discogs_search_url(artist: &str, title: &str, token: &str) -> Option<String> {
    search_query(artist, title).and_then(|q| {
        let token = token.trim();
        if token.is_empty() {
            return None;
        }
        Some(format!(
            "https://api.discogs.com/database/search?q={q}&type=release&token={}",
            encode_query(token)
        ))
    })
}

/// Last.fm `track.search`. Key from `LASTFM_API_KEY`.
pub fn lastfm_search_url(artist: &str, title: &str, api_key: &str) -> Option<String> {
    let key = api_key.trim();
    if key.is_empty() {
        return None;
    }
    let track = encode_query(title.trim());
    let artist = encode_query(artist.trim());
    if track.is_empty() && artist.is_empty() {
        return None;
    }
    Some(format!(
        "https://ws.audioscrobbler.com/2.0/?method=track.search&track={track}&artist={artist}&api_key={}&format=json&limit=5",
        encode_query(key)
    ))
}

/// AcoustID lookup for a locally-computed Chromaprint fingerprint.
/// Fingerprint computation needs the native Chromaprint library (pending);
/// the query shape and parser ship now so that path is a drop-in.
pub fn acoustid_lookup_url(fingerprint: &str, duration_secs: u32, api_key: &str) -> Option<String> {
    let (fp, key) = (fingerprint.trim(), api_key.trim());
    if fp.is_empty() || key.is_empty() || duration_secs == 0 {
        return None;
    }
    Some(format!(
        "https://api.acoustid.org/v2/lookup?client={}&meta=recordings+isrcs&duration={duration_secs}&fingerprint={}",
        encode_query(key),
        encode_query(fp)
    ))
}

/// Splits a Discogs `"Artist - Title"` search title on the first separator.
pub fn split_discogs_title(raw: &str) -> (String, String) {
    match raw.split_once(" - ") {
        Some((artist, title)) => (artist.trim().to_string(), title.trim().to_string()),
        None => (String::new(), raw.trim().to_string()),
    }
}

/// Parses a Discogs search response (`type=release` results carry
/// `cover_image`; titles are `"Artist - Title"`).
pub fn parse_discogs_response(
    json: &str,
    local_artist: &str,
    local_title: &str,
    max: usize,
) -> Result<Vec<ProviderCandidate>, String> {
    let doc: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("discogs: invalid JSON: {e}"))?;
    let results = doc
        .get("results")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for item in results.iter().take(max.max(1)) {
        let id = item
            .get("id")
            .and_then(|v| {
                v.as_u64()
                    .map(|n| n.to_string())
                    .or_else(|| v.as_str().map(str::to_string))
            })
            .unwrap_or_default();
        let raw_title = item.get("title").and_then(|v| v.as_str()).unwrap_or("");
        let (artist, title) = split_discogs_title(raw_title);
        if id.is_empty() || title.is_empty() || artist.is_empty() {
            continue;
        }
        let confidence = match_confidence(local_artist, local_title, &artist, &title);
        out.push(ProviderCandidate {
            provider: EnrichmentProvider::Discogs.as_str().to_string(),
            provider_id: id.clone(),
            title,
            artist,
            album: None,
            genre: item
                .get("genre")
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            year: item
                .get("year")
                .and_then(|v| {
                    v.as_str()
                        .map(str::to_string)
                        .or_else(|| v.as_u64().map(|n| n.to_string()))
                })
                .and_then(|s| parse_year(&s)),
            isrc: None,
            artwork_url: item
                .get("cover_image")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            confidence,
            source_url: item
                .get("uri")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            duration_ms: None,
        });
    }
    Ok(out)
}

/// Parses a Last.fm `track.search` response.
pub fn parse_lastfm_response(
    json: &str,
    local_artist: &str,
    local_title: &str,
    max: usize,
) -> Result<Vec<ProviderCandidate>, String> {
    let doc: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("lastfm: invalid JSON: {e}"))?;
    let tracks = doc
        .pointer("/results/trackmatches/track")
        .and_then(|t| t.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for item in tracks.iter().take(max.max(1)) {
        let title = item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let artist = item
            .get("artist")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if title.is_empty() || artist.is_empty() {
            continue;
        }
        let mbid = item
            .get("mbid")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .unwrap_or_default();
        let confidence = match_confidence(local_artist, local_title, artist, title);
        out.push(ProviderCandidate {
            provider: EnrichmentProvider::LastFm.as_str().to_string(),
            provider_id: if mbid.is_empty() {
                format!("lastfm:{artist}:{title}")
            } else {
                mbid
            },
            title: title.to_string(),
            artist: artist.to_string(),
            album: None,
            genre: None,
            year: None,
            isrc: None,
            artwork_url: None,
            confidence,
            source_url: item.get("url").and_then(|v| v.as_str()).map(str::to_string),
            duration_ms: None,
        });
    }
    Ok(out)
}

/// Parses an AcoustID lookup response, flattening the top recording per
/// result (highest score first as returned).
pub fn parse_acoustid_response(
    json: &str,
    local_artist: &str,
    local_title: &str,
    max: usize,
) -> Result<Vec<ProviderCandidate>, String> {
    let doc: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("acoustid: invalid JSON: {e}"))?;
    if doc.get("status").and_then(|v| v.as_str()).unwrap_or("") != "ok" {
        return Err("acoustid: response status is not ok".to_string());
    }
    let results = doc
        .get("results")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for result in results.iter().take(max.max(1)) {
        let recording = result
            .get("recordings")
            .and_then(|r| r.as_array())
            .and_then(|a| a.first());
        let Some(rec) = recording else { continue };
        let mbid = rec.get("id").and_then(|v| v.as_str()).unwrap_or("").trim();
        let title = rec
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let artist = rec
            .get("artists")
            .and_then(|a| a.as_array())
            .and_then(|a| a.first())
            .and_then(|a| a.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if mbid.is_empty() || title.is_empty() || artist.is_empty() {
            continue;
        }
        let base = match_confidence(local_artist, local_title, artist, title);
        let acoustic = result
            .get("score")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.5)
            .clamp(0.0, 1.0);
        out.push(ProviderCandidate {
            provider: EnrichmentProvider::AcoustId.as_str().to_string(),
            provider_id: mbid.to_string(),
            title: title.to_string(),
            artist: artist.to_string(),
            album: None,
            genre: None,
            year: None,
            isrc: rec
                .get("isrcs")
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_ascii_uppercase()),
            artwork_url: None,
            confidence: (0.5 * base + 0.5 * acoustic).clamp(0.0, 1.0),
            source_url: Some(format!("https://musicbrainz.org/recording/{mbid}")),
            duration_ms: rec
                .get("duration")
                .and_then(|v| v.as_u64())
                .map(|s| s as i64 * 1000),
        });
    }
    Ok(out)
}

fn parse_year(raw: &str) -> Option<i32> {
    raw.get(..4)?
        .parse::<i32>()
        .ok()
        .filter(|y| (1000..=2100).contains(y))
}

fn first_artist_credit(value: &serde_json::Value) -> Option<String> {
    value
        .get("artist-credit")?
        .as_array()?
        .first()?
        .get("name")?
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Parses a MusicBrainz recording search response. Tolerates missing
/// `releases`/`isrcs` (common on compilation or sparse entries).
pub fn parse_musicbrainz_response(
    json: &str,
    local_artist: &str,
    local_title: &str,
    max: usize,
) -> Result<Vec<ProviderCandidate>, String> {
    let doc: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("musicbrainz: invalid JSON: {e}"))?;
    let recordings = doc
        .get("recordings")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for rec in recordings.iter().take(max.max(1)) {
        let mbid = rec.get("id").and_then(|v| v.as_str()).unwrap_or("").trim();
        let title = rec
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let artist = first_artist_credit(rec).unwrap_or_default();
        if mbid.is_empty() || title.is_empty() || artist.is_empty() {
            continue;
        }
        let release = rec
            .get("releases")
            .and_then(|r| r.as_array())
            .and_then(|r| r.first());
        let album = release
            .and_then(|r| r.get("title"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        let year = release
            .and_then(|r| {
                r.get("first-release-date")
                    .or_else(|| r.get("date"))
                    .and_then(|v| v.as_str())
            })
            .or_else(|| rec.get("first-release-date").and_then(|v| v.as_str()))
            .and_then(parse_year);
        let isrc = rec
            .get("isrcs")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_ascii_uppercase());
        let artwork_url = release
            .and_then(|r| r.get("id"))
            .and_then(|v| v.as_str())
            .map(cover_art_front_url);
        let confidence = match_confidence(local_artist, local_title, &artist, title);
        out.push(ProviderCandidate {
            provider: EnrichmentProvider::MusicBrainz.as_str().to_string(),
            provider_id: mbid.to_string(),
            title: title.to_string(),
            artist: artist.clone(),
            album,
            genre: None,
            year,
            isrc,
            artwork_url,
            confidence,
            source_url: Some(format!("https://musicbrainz.org/recording/{mbid}")),
            duration_ms: rec.get("length").and_then(|v| v.as_i64()),
        });
    }
    Ok(out)
}

/// Parses an iTunes Search song response. `previewUrl` (audio) is ignored by
/// design — metadata only.
pub fn parse_itunes_response(
    json: &str,
    local_artist: &str,
    local_title: &str,
    max: usize,
) -> Result<Vec<ProviderCandidate>, String> {
    let doc: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("itunes: invalid JSON: {e}"))?;
    let results = doc
        .get("results")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = Vec::new();
    for item in results.iter().take(max.max(1)) {
        let is_track = item
            .get("wrapperType")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            == "track";
        if !is_track {
            continue;
        }
        let title = item
            .get("trackName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let artist = item
            .get("artistName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if title.is_empty() || artist.is_empty() {
            continue;
        }
        let provider_id = item
            .get("trackId")
            .and_then(|v| v.as_u64())
            .map(|n| n.to_string())
            .unwrap_or_default();
        if provider_id.is_empty() {
            continue;
        }
        let confidence = match_confidence(local_artist, local_title, artist, title);
        out.push(ProviderCandidate {
            provider: EnrichmentProvider::ITunes.as_str().to_string(),
            provider_id,
            title: title.to_string(),
            artist: artist.to_string(),
            album: item
                .get("collectionName")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            genre: item
                .get("primaryGenreName")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            year: item
                .get("releaseDate")
                .and_then(|v| v.as_str())
                .and_then(parse_year),
            isrc: None,
            artwork_url: item
                .get("artworkUrl100")
                .and_then(|v| v.as_str())
                .map(itunes_artwork_600),
            confidence,
            source_url: item
                .get("trackViewUrl")
                .and_then(|v| v.as_str())
                .map(str::to_string),
            duration_ms: item
                .get("trackTimeMillis")
                .and_then(|v| v.as_u64())
                .map(|ms| ms as i64),
        });
    }
    Ok(out)
}

/// Parses a Deezer search (or single-track) response. `preview` (audio) is
/// ignored by design — metadata only.
pub fn parse_deezer_response(
    json: &str,
    local_artist: &str,
    local_title: &str,
    max: usize,
) -> Result<Vec<ProviderCandidate>, String> {
    let doc: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("deezer: invalid JSON: {e}"))?;
    let items: Vec<serde_json::Value> =
        if let Some(data) = doc.get("data").and_then(|d| d.as_array()) {
            data.clone()
        } else if doc.get("id").is_some() {
            vec![doc]
        } else {
            Vec::new()
        };
    let mut out = Vec::new();
    for item in items.iter().take(max.max(1)) {
        let id = item
            .get("id")
            .and_then(|v| {
                v.as_u64()
                    .map(|n| n.to_string())
                    .or_else(|| v.as_str().map(str::to_string))
            })
            .unwrap_or_default();
        let title = item
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let artist = item
            .get("artist")
            .and_then(|a| a.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if id.is_empty() || title.is_empty() || artist.is_empty() {
            continue;
        }
        let confidence = match_confidence(local_artist, local_title, artist, title);
        out.push(ProviderCandidate {
            provider: EnrichmentProvider::Deezer.as_str().to_string(),
            provider_id: id,
            title: title.to_string(),
            artist: artist.to_string(),
            album: item
                .get("album")
                .and_then(|a| a.get("title"))
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
            genre: None,
            year: None,
            isrc: item
                .get("isrc")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_ascii_uppercase()),
            artwork_url: item
                .get("album")
                .and_then(|a| {
                    a.get("cover_xl")
                        .or_else(|| a.get("cover_big"))
                        .and_then(|v| v.as_str())
                })
                .map(str::to_string),
            confidence,
            source_url: item
                .get("link")
                .and_then(|v| v.as_str())
                .map(str::to_string),
            duration_ms: item
                .get("duration")
                .and_then(|v| v.as_u64())
                .map(|s| s as i64 * 1000),
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tagged_local() -> LocalTrack {
        LocalTrack {
            title: "Glue".to_string(),
            artist: "Unknown Artist".to_string(),
            album: None,
            genre: None,
            year: None,
            isrc: None,
            artwork_hash: None,
        }
    }

    #[test]
    fn provider_names_round_trip() {
        assert_eq!(
            EnrichmentProvider::parse("MusicBrainz"),
            Some(EnrichmentProvider::MusicBrainz)
        );
        assert_eq!(
            EnrichmentProvider::parse("ITUNES"),
            Some(EnrichmentProvider::ITunes)
        );
        assert_eq!(
            EnrichmentProvider::parse("deezer"),
            Some(EnrichmentProvider::Deezer)
        );
        assert_eq!(EnrichmentProvider::Deezer.as_str(), "deezer");
        assert_eq!(EnrichmentProvider::parse("beatport"), None);
        assert_eq!(
            EnrichmentProvider::parse("discogs"),
            Some(EnrichmentProvider::Discogs)
        );
        assert_eq!(
            EnrichmentProvider::parse("last.fm"),
            Some(EnrichmentProvider::LastFm)
        );
        assert_eq!(
            EnrichmentProvider::parse("acoustid"),
            Some(EnrichmentProvider::AcoustId)
        );
        assert_eq!(EnrichmentProvider::all().len(), 6);
    }

    #[test]
    fn missing_fields_flags_placeholders() {
        let gaps = missing_fields(&tagged_local());
        assert!(gaps.contains(&"artist".to_string()));
        assert!(gaps.contains(&"album".to_string()));
        assert!(gaps.contains(&"isrc".to_string()));
        assert!(gaps.contains(&"artwork".to_string()));
        assert!(!gaps.contains(&"title".to_string()));

        let full = LocalTrack {
            title: "Glue".to_string(),
            artist: "Bicep".to_string(),
            album: Some("Bicep".to_string()),
            genre: Some("Electronic".to_string()),
            year: Some(2017),
            isrc: Some("GBCFB1700229".to_string()),
            artwork_hash: Some("abc".to_string()),
        };
        assert!(missing_fields(&full).is_empty());
    }

    #[test]
    fn proposals_cover_only_gaps() {
        let candidate = ProviderCandidate {
            provider: "itunes".to_string(),
            provider_id: "1240586502".to_string(),
            title: "Glue (Different Title)".to_string(),
            artist: "Bicep".to_string(),
            album: Some("Bicep".to_string()),
            genre: Some("Electronic".to_string()),
            year: Some(2017),
            isrc: None,
            artwork_url: Some("https://example.com/600x600bb.jpg".to_string()),
            confidence: 0.9,
            source_url: None,
            duration_ms: Some(269150),
        };
        let proposals = propose_fields(&tagged_local(), &candidate);
        let fields: Vec<&str> = proposals.iter().map(|p| p.field.as_str()).collect();
        // Title is not a gap locally, so it is never proposed — even though it differs.
        assert!(!fields.contains(&"title"));
        assert!(fields.contains(&"artist"));
        assert!(fields.contains(&"album"));
        assert!(fields.contains(&"artwork"));
        assert!(
            !fields.contains(&"isrc"),
            "candidate has no ISRC to propose"
        );
        let artist = proposals.iter().find(|p| p.field == "artist").unwrap();
        assert_eq!(artist.current.as_deref(), Some("Unknown Artist"));
        assert_eq!(artist.proposed, "Bicep");
    }

    #[test]
    fn confidence_tiers_match_documented_thresholds() {
        assert!((match_confidence("Bicep", "Glue", "Bicep", "Glue") - 0.92).abs() < 1e-9);
        assert!((match_confidence("Bicep", "Glue", "Bicep", "Atlas") - 0.65).abs() < 1e-9);
        assert!((match_confidence("BICEP", "glue", "bicep", "GLUE") - 0.92).abs() < 1e-9);
        assert!((match_confidence("Bicep", "Glue", "Bicep Live", "Glue Live") - 0.50).abs() < 1e-9);
        assert!((match_confidence("Bicep", "Glue", "Nova", "Orbit") - 0.35).abs() < 1e-9);
        assert_eq!(confidence_tier(0.92), "high");
        assert_eq!(confidence_tier(0.65), "review");
        assert_eq!(confidence_tier(0.2), "low");
    }

    #[test]
    fn search_urls_are_well_formed() {
        let mb = musicbrainz_search_url("Bicep", "Glue").unwrap();
        assert!(mb.starts_with("https://musicbrainz.org/ws/2/recording/?query="));
        assert!(mb.contains("inc=isrcs"));
        assert!(mb.contains("fmt=json"));
        let itunes = itunes_search_url("Bicep", "Glue").unwrap();
        assert!(itunes.contains("entity=song"));
        assert!(itunes.contains("Bicep+Glue"));
        let dz = deezer_search_url("Bicep", "Glue").unwrap();
        assert!(dz.starts_with("https://api.deezer.com/search?q="));
        assert_eq!(
            deezer_isrc_url("gbcfb1700229").as_deref(),
            Some("https://api.deezer.com/track/isrc:GBCFB1700229")
        );
        assert_eq!(musicbrainz_search_url("  ", ""), None);
        assert_eq!(itunes_search_url("", ""), None);
        assert_eq!(deezer_isrc_url("  "), None);
    }

    #[test]
    fn artwork_helpers_build_expected_urls() {
        assert_eq!(
            cover_art_front_url("94bb6174-54ea-4356-9ec7-3e7d4849b9c9"),
            "https://coverartarchive.org/release/94bb6174-54ea-4356-9ec7-3e7d4849b9c9/front"
        );
        assert_eq!(
            itunes_artwork_600("https://example.com/a/100x100bb.jpg"),
            "https://example.com/a/600x600bb.jpg"
        );
        assert_eq!(
            itunes_artwork_600("https://example.com/a.png"),
            "https://example.com/a.png",
            "no size token passes through unchanged"
        );
    }

    /// Trimmed real iTunes response for Bicep — Glue (verified 2026-10-14).
    const ITUNES_GLUE: &str = r#"{"resultCount":1,"results":[{"wrapperType":"track","kind":"song","trackId":1240586502,"artistName":"Bicep","collectionName":"Bicep","trackName":"Glue","trackViewUrl":"https://music.apple.com/us/album/glue/1240586047?i=1240586502","previewUrl":"https://audio-ssl.itunes.apple.com/preview.m4a","artworkUrl100":"https://is1-ssl.mzstatic.com/image/thumb/abc/100x100bb.jpg","releaseDate":"2017-08-03T12:00:00Z","trackTimeMillis":269150,"primaryGenreName":"Electronic"}]}"#;

    #[test]
    fn itunes_parser_reads_the_real_shape() {
        let cands = parse_itunes_response(ITUNES_GLUE, "Bicep", "Glue", 5).unwrap();
        assert_eq!(cands.len(), 1);
        let c = &cands[0];
        assert_eq!(c.provider_id, "1240586502");
        assert_eq!(c.album.as_deref(), Some("Bicep"));
        assert_eq!(c.genre.as_deref(), Some("Electronic"));
        assert_eq!(c.year, Some(2017));
        assert_eq!(c.duration_ms, Some(269150));
        assert_eq!(
            c.artwork_url.as_deref(),
            Some("https://is1-ssl.mzstatic.com/image/thumb/abc/600x600bb.jpg")
        );
    }

    /// Trimmed real Deezer response for Bicep — Glue (verified 2026-10-14).
    const DEEZER_GLUE: &str = r#"{"data":[{"id":389034231,"title":"Glue","isrc":"GBCFB1700229","link":"https://www.deezer.com/track/389034231","duration":269,"preview":"https://cdnt-preview.dzcdn.net/preview.mp3","artist":{"id":369056,"name":"Bicep"},"album":{"id":45442201,"title":"Glue","cover_xl":"https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg"}}],"total":10}"#;

    #[test]
    fn deezer_parser_reads_the_real_shape() {
        let cands = parse_deezer_response(DEEZER_GLUE, "Bicep", "Glue", 5).unwrap();
        assert_eq!(cands.len(), 1);
        let c = &cands[0];
        assert_eq!(c.provider_id, "389034231");
        assert_eq!(c.isrc.as_deref(), Some("GBCFB1700229"));
        assert_eq!(c.duration_ms, Some(269000));
        assert!(c.artwork_url.as_deref().unwrap().contains("1000x1000"));
        assert!(c
            .source_url
            .as_deref()
            .unwrap()
            .starts_with("https://www.deezer.com/track/"));
    }

    #[test]
    fn deezer_parser_handles_single_track_shape() {
        // `GET /track/isrc:…` returns the object directly, without `data`.
        let single = r#"{"id":389034231,"title":"Glue","isrc":"GBCFB1700229","duration":269,"artist":{"name":"Bicep"},"album":{"title":"Glue","cover_xl":"https://cdn.example/xl.jpg"}}"#;
        let cands = parse_deezer_response(single, "Bicep", "Glue", 5).unwrap();
        assert_eq!(cands.len(), 1);
        assert_eq!(cands[0].provider_id, "389034231");
    }

    /// Trimmed real MusicBrainz response for Bicep — Glue (verified 2026-10-14;
    /// top hit is a Tomorrowland compilation — the review queue exists for this).
    const MB_GLUE: &str = r#"{"count":19,"recordings":[{"id":"92840808-91e2-493d-8dd6-f01ae42668da","title":"Glue","length":188000,"artist-credit":[{"name":"Bicep"}],"first-release-date":"2019-07-19","releases":[{"id":"94bb6174-54ea-4356-9ec7-3e7d4849b9c9","title":"Tomorrowland 2019 15 Years Compilation","date":"2019-07-19"}]}]}"#;

    #[test]
    fn musicbrainz_parser_reads_the_real_shape() {
        let cands = parse_musicbrainz_response(MB_GLUE, "Bicep", "Glue", 5).unwrap();
        assert_eq!(cands.len(), 1);
        let c = &cands[0];
        assert_eq!(c.provider_id, "92840808-91e2-493d-8dd6-f01ae42668da");
        assert_eq!(
            c.album.as_deref(),
            Some("Tomorrowland 2019 15 Years Compilation")
        );
        assert_eq!(c.year, Some(2019));
        assert_eq!(c.isrc, None, "no ISRCs on this entry");
        assert_eq!(
            c.artwork_url.as_deref(),
            Some("https://coverartarchive.org/release/94bb6174-54ea-4356-9ec7-3e7d4849b9c9/front")
        );
    }

    #[test]
    fn parsers_tolerate_empty_and_garbage() {
        assert!(parse_itunes_response(r#"{"resultCount":0}"#, "a", "b", 5)
            .unwrap()
            .is_empty());
        assert!(parse_deezer_response(r#"{"data":[]}"#, "a", "b", 5)
            .unwrap()
            .is_empty());
        assert!(parse_musicbrainz_response(r#"{}"#, "a", "b", 5)
            .unwrap()
            .is_empty());
        assert!(parse_itunes_response("nope", "a", "b", 5).is_err());
        assert!(parse_deezer_response("nope", "a", "b", 5).is_err());
        assert!(parse_musicbrainz_response("nope", "a", "b", 5).is_err());
    }

    #[test]
    fn health_score_weights_identity_fields_highest() {
        assert!((tag_health_score(&[]) - 100.0).abs() < 1e-9);
        assert!((tag_health_score(&["artist".to_string()]) - 75.0).abs() < 1e-9);
        assert!((tag_health_score(&["bpm".to_string(), "key".to_string()]) - 92.0).abs() < 1e-9);
        let all = [
            "title", "artist", "album", "genre", "year", "isrc", "artwork", "bpm", "key",
            "duration",
        ]
        .iter()
        .map(|s| (*s).to_string())
        .collect::<Vec<_>>();
        assert!((tag_health_score(&all) - 0.0).abs() < 1e-9);
        assert_eq!(average_health_score(&[]), None);
        assert!((average_health_score(&[100.0, 50.0]).unwrap() - 75.0).abs() < 1e-9);
    }

    #[test]
    fn keyed_provider_urls_are_built_and_gated() {
        let dz = discogs_search_url("Bicep", "Glue", "tok123").unwrap();
        assert!(dz.starts_with("https://api.discogs.com/database/search?"));
        assert!(dz.contains("type=release"));
        assert_eq!(discogs_search_url("Bicep", "Glue", "  "), None);
        let fm = lastfm_search_url("Bicep", "Glue", "key123").unwrap();
        assert!(fm.contains("method=track.search"));
        assert!(fm.contains("format=json"));
        assert_eq!(lastfm_search_url("Bicep", "Glue", ""), None);
        let ac = acoustid_lookup_url("fingerprint-bytes", 269, "key123").unwrap();
        assert!(ac.starts_with("https://api.acoustid.org/v2/lookup?"));
        assert!(ac.contains("meta=recordings+isrcs"));
        assert_eq!(acoustid_lookup_url("", 269, "key123"), None);
        assert_eq!(acoustid_lookup_url("fp", 0, "key123"), None);
        assert!(EnrichmentProvider::Discogs.needs_key());
        assert!(!EnrichmentProvider::MusicBrainz.needs_key());
    }

    #[test]
    fn discogs_titles_split_on_first_separator() {
        assert_eq!(
            split_discogs_title("Bicep - Glue"),
            ("Bicep".to_string(), "Glue".to_string())
        );
        assert_eq!(
            split_discogs_title("A - B - C"),
            ("A".to_string(), "B - C".to_string())
        );
        assert_eq!(
            split_discogs_title("Untitled"),
            (String::new(), "Untitled".to_string())
        );
    }

    /// Documented Discogs search shape (`type=release`).
    const DISCOGS_GLUE: &str = r#"{"results":[{"id":1234567,"type":"release","title":"Bicep - Glue","year":"2017","label":["Ninja Tune"],"genre":["Electronic"],"cover_image":"https://img.discogs.com/abc.jpg","uri":"https://www.discogs.com/release/1234567-Bicep-Glue"}]}"#;

    #[test]
    fn discogs_parser_reads_the_documented_shape() {
        let cands = parse_discogs_response(DISCOGS_GLUE, "Bicep", "Glue", 5).unwrap();
        assert_eq!(cands.len(), 1);
        let c = &cands[0];
        assert_eq!(c.provider_id, "1234567");
        assert_eq!(c.artist, "Bicep");
        assert_eq!(c.title, "Glue");
        assert_eq!(c.year, Some(2017));
        assert_eq!(c.genre.as_deref(), Some("Electronic"));
        assert!(c.artwork_url.as_deref().unwrap().starts_with("https://"));
    }

    /// Documented Last.fm `track.search` shape.
    const LASTFM_GLUE: &str = r#"{"results":{"trackmatches":{"track":[{"name":"Glue","artist":"Bicep","url":"https://www.last.fm/music/Bicep/_/Glue","listeners":"412001","mbid":"92840808-91e2-493d-8dd6-f01ae42668da"}]}}}"#;

    #[test]
    fn lastfm_parser_reads_the_documented_shape() {
        let cands = parse_lastfm_response(LASTFM_GLUE, "Bicep", "Glue", 5).unwrap();
        assert_eq!(cands.len(), 1);
        let c = &cands[0];
        assert_eq!(c.provider_id, "92840808-91e2-493d-8dd6-f01ae42668da");
        assert_eq!(
            c.source_url.as_deref(),
            Some("https://www.last.fm/music/Bicep/_/Glue")
        );
        assert_eq!(c.artwork_url, None, "search carries no artwork");
    }

    /// Documented AcoustID lookup shape (`meta=recordings+isrcs`).
    const ACOUSTID_GLUE: &str = r#"{"status":"ok","results":[{"id":"abc-123","score":0.94,"recordings":[{"id":"92840808-91e2-493d-8dd6-f01ae42668da","title":"Glue","duration":269,"artists":[{"name":"Bicep"}],"isrcs":["GBCFB1700229"]}]}]}"#;

    #[test]
    fn acoustid_parser_blends_acoustic_and_name_scores() {
        let cands = parse_acoustid_response(ACOUSTID_GLUE, "Bicep", "Glue", 5).unwrap();
        assert_eq!(cands.len(), 1);
        let c = &cands[0];
        assert_eq!(c.isrc.as_deref(), Some("GBCFB1700229"));
        assert_eq!(c.duration_ms, Some(269000));
        // 0.5 * name(0.92) + 0.5 * acoustic(0.94) = 0.93.
        assert!((c.confidence - 0.93).abs() < 1e-9);
        assert!(parse_acoustid_response(r#"{"status":"error"}"#, "a", "b", 5).is_err());
    }
}
