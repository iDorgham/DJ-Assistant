//! Provider helpers that need no API key and no network access.
//!
//! Two things live here:
//!
//! 1. **Store search links** (Tier 0 of the store integration): Beatport,
//!    Traxsource, Juno Download, Bandcamp and Discogs expose no stable public
//!    catalog API for a desktop client, so the shippable step is a
//!    well-formed per-track search URL the DJ can open to buy the release.
//!    Building the URL is pure and unit-tested; opening it is the UI's job.
//! 2. **Provider registry**: the closed set of streaming-export and
//!    metadata-enrichment providers the app will support, so new integrations
//!    extend an enum instead of growing one-off `spotify_*` commands.
//!
//! Nothing here performs I/O. Online lookups (MusicBrainz, iTunes Search,
//! Deezer, AcoustID) belong behind the opt-in enrichment pipeline with caching
//! and rate limiting — see ADR-0007.

/// Streaming-export targets (publish a set as a playlist, metadata only).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum StreamingProvider {
    Spotify,
    Deezer,
    AppleMusic,
    YouTubeMusic,
    SoundCloud,
    Tidal,
}

impl StreamingProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            StreamingProvider::Spotify => "spotify",
            StreamingProvider::Deezer => "deezer",
            StreamingProvider::AppleMusic => "apple_music",
            StreamingProvider::YouTubeMusic => "youtube_music",
            StreamingProvider::SoundCloud => "soundcloud",
            StreamingProvider::Tidal => "tidal",
        }
    }

    pub fn all() -> [StreamingProvider; 6] {
        [
            StreamingProvider::Spotify,
            StreamingProvider::Deezer,
            StreamingProvider::AppleMusic,
            StreamingProvider::YouTubeMusic,
            StreamingProvider::SoundCloud,
            StreamingProvider::Tidal,
        ]
    }

    /// What works today per target. Only Deezer reads are live and keyless;
    /// every write path needs credentials + OAuth (TP / TX.2b).
    pub fn capabilities(self) -> ProviderCapabilities {
        match self {
            StreamingProvider::Deezer => ProviderCapabilities {
                live_match: true,
                isrc_search: true,
                playlist_write: false,
                needs_app_id: true,
            },
            _ => ProviderCapabilities {
                live_match: false,
                isrc_search: false,
                playlist_write: false,
                needs_app_id: true,
            },
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "spotify" => Some(StreamingProvider::Spotify),
            "deezer" => Some(StreamingProvider::Deezer),
            "apple_music" | "applemusic" | "apple-music" => Some(StreamingProvider::AppleMusic),
            "youtube_music" | "youtubemusic" | "youtube-music" | "youtube" => {
                Some(StreamingProvider::YouTubeMusic)
            }
            "soundcloud" => Some(StreamingProvider::SoundCloud),
            "tidal" => Some(StreamingProvider::Tidal),
            _ => None,
        }
    }
}

/// Buy-link stores (metadata + outbound link only — never audio).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum StoreProvider {
    Beatport,
    Traxsource,
    JunoDownload,
    Bandcamp,
    Discogs,
}

impl StoreProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            StoreProvider::Beatport => "beatport",
            StoreProvider::Traxsource => "traxsource",
            StoreProvider::JunoDownload => "juno_download",
            StoreProvider::Bandcamp => "bandcamp",
            StoreProvider::Discogs => "discogs",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            StoreProvider::Beatport => "Beatport",
            StoreProvider::Traxsource => "Traxsource",
            StoreProvider::JunoDownload => "Juno Download",
            StoreProvider::Bandcamp => "Bandcamp",
            StoreProvider::Discogs => "Discogs",
        }
    }

    pub fn all() -> [StoreProvider; 5] {
        [
            StoreProvider::Beatport,
            StoreProvider::Traxsource,
            StoreProvider::JunoDownload,
            StoreProvider::Bandcamp,
            StoreProvider::Discogs,
        ]
    }
}

/// One outbound buy-link for a track.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoreLink {
    pub provider: String,
    pub label: String,
    pub url: String,
}

/// What works today per streaming target.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderCapabilities {
    /// Catalog matching without credentials (Deezer reads only, today).
    pub live_match: bool,
    /// Exact ISRC lookup (vs fuzzy-only).
    pub isrc_search: bool,
    /// Playlist publishing wired end to end.
    pub playlist_write: bool,
    /// Writes need a registered application ID + OAuth.
    pub needs_app_id: bool,
}

/// Percent-encodes a search query (RFC 3986 unreserved set kept as-is).
pub fn encode_query(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for byte in raw.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(byte as char);
        } else if byte == b' ' {
            out.push('+');
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// Builds the search URL for one store. Returns `None` when both artist and
/// title are blank (a search for nothing helps nobody).
pub fn store_search_url(provider: StoreProvider, artist: &str, title: &str) -> Option<String> {
    let query = format!("{} {}", artist.trim(), title.trim());
    let query = query.trim();
    if query.is_empty() {
        return None;
    }
    let encoded = encode_query(query);
    let url = match provider {
        StoreProvider::Beatport => format!("https://www.beatport.com/search?q={encoded}"),
        StoreProvider::Traxsource => {
            format!("https://www.traxsource.com/search?term={encoded}")
        }
        StoreProvider::JunoDownload => {
            format!("https://www.junodownload.com/search/?q={encoded}")
        }
        StoreProvider::Bandcamp => format!("https://bandcamp.com/search?q={encoded}"),
        StoreProvider::Discogs => format!("https://www.discogs.com/search/?q={encoded}&type=all"),
    };
    Some(url)
}

/// Builds buy-links for every known store, skipping stores with no URL.
pub fn store_links_for_track(artist: &str, title: &str) -> Vec<StoreLink> {
    StoreProvider::all()
        .iter()
        .filter_map(|provider| {
            store_search_url(*provider, artist, title).map(|url| StoreLink {
                provider: provider.as_str().to_string(),
                label: provider.label().to_string(),
                url,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streaming_provider_round_trips() {
        assert_eq!(
            StreamingProvider::parse("Spotify"),
            Some(StreamingProvider::Spotify)
        );
        assert_eq!(
            StreamingProvider::parse("apple-music"),
            Some(StreamingProvider::AppleMusic)
        );
        assert_eq!(StreamingProvider::Deezer.as_str(), "deezer");
        assert_eq!(StreamingProvider::parse("beatport"), None);
        assert_eq!(StreamingProvider::all().len(), 6);
    }

    #[test]
    fn only_deezer_reads_are_live() {
        let dz = StreamingProvider::Deezer.capabilities();
        assert!(dz.live_match && dz.isrc_search);
        assert!(!dz.playlist_write && dz.needs_app_id);
        for provider in StreamingProvider::all() {
            if provider != StreamingProvider::Deezer {
                let caps = provider.capabilities();
                assert!(!caps.live_match && !caps.playlist_write);
            }
        }
    }

    #[test]
    fn store_links_cover_all_stores_with_stable_prefixes() {
        let links = store_links_for_track("Bicep", "Glue");
        assert_eq!(links.len(), 5);
        let by_provider = |name: &str| {
            links
                .iter()
                .find(|l| l.provider == name)
                .unwrap()
                .url
                .clone()
        };
        assert!(by_provider("beatport").starts_with("https://www.beatport.com/search?q="));
        assert!(by_provider("traxsource").starts_with("https://www.traxsource.com/search?term="));
        assert!(by_provider("juno_download").starts_with("https://www.junodownload.com/search/?q="));
        assert!(by_provider("bandcamp").starts_with("https://bandcamp.com/search?q="));
        assert!(by_provider("discogs").contains("&type=all"));
        for link in &links {
            assert!(link.url.contains("Bicep+Glue"), "url was {}", link.url);
        }
    }

    #[test]
    fn query_encoding_handles_special_characters() {
        let url = store_search_url(StoreProvider::Beatport, "Âme", "Fiori (Dixon Edit)").unwrap();
        assert!(!url.contains(' '), "spaces must be encoded: {url}");
        assert!(!url.contains('('), "parens must be encoded: {url}");
        assert!(url.contains("Dixon"), "readable part kept: {url}");
    }

    #[test]
    fn blank_artist_and_title_yield_no_links() {
        assert_eq!(store_search_url(StoreProvider::Beatport, "  ", " "), None);
        assert!(store_links_for_track("", "").is_empty());
    }
}
