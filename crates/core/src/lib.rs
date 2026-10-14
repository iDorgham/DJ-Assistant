//! Tauri-free core logic for DJ Assistant.
//!
//! Everything here must stay independent of Tauri and WebView2 so it can be unit
//! tested on any toolchain — including `stable-x86_64-pc-windows-gnu`, where the
//! Tauri-linked test harness fails to load.
//!
//! The desktop crate (`apps/desktop/src-tauri`) is the thin Tauri/IPC layer on
//! top of these functions.

pub mod aiff;
pub mod audio;
pub mod dedup;
pub mod enrichment;
pub mod fingerprint;
pub mod metadata;
pub mod mp3;
pub mod providers;
pub mod riff;
pub mod similarity;

pub use aiff::aiff_duration_ms;
pub use audio::{discover_audio_files, is_supported_audio, SUPPORTED_EXTENSIONS};
pub use dedup::{DuplicateKind, ScanDeduplicator};
pub use enrichment::{
    acoustid_lookup_url, average_health_score, confidence_tier, cover_art_front_url,
    deezer_isrc_url, deezer_search_url, discogs_search_url, itunes_artwork_600, itunes_search_url,
    lastfm_search_url, match_confidence, missing_fields, musicbrainz_search_url, normalize_name,
    parse_acoustid_response, parse_deezer_response, parse_discogs_response, parse_itunes_response,
    parse_lastfm_response, parse_musicbrainz_response, propose_fields, split_discogs_title,
    tag_health_score, EnrichmentProvider, FieldProposal, LocalTrack, ProviderCandidate,
};
pub use fingerprint::{compute_file_fingerprint, FINGERPRINT_WINDOW};
pub use metadata::{
    cache_artwork, camelot_from_key, extract_metadata, CachedArtwork, EmbeddedArtwork,
    ExtractedMetadata,
};
pub use mp3::mp3_duration_ms;
pub use providers::{
    store_links_for_track, store_search_url, ProviderCapabilities, StoreLink, StoreProvider,
    StreamingProvider,
};
pub use riff::wav_duration_ms;
pub use similarity::{bpm_similarity, camelot_distance, find_similar, ScoredTrack, TrackFeatures};

use std::path::Path;

/// Best-effort duration for a container that `audiotags` cannot report.
///
/// Returns `None` for formats without a supported parser, and for files whose
/// headers are unusable — callers treat that as "unknown", not as zero-length.
pub fn container_duration_ms(path: &Path) -> Option<i64> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_lowercase();

    match ext.as_str() {
        "wav" => riff::wav_duration_ms(path),
        "aif" | "aiff" | "aifc" => aiff::aiff_duration_ms(path),
        "mp3" => mp3::mp3_duration_ms(path),
        _ => None,
    }
}
