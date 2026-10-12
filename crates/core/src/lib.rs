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
pub mod fingerprint;
pub mod metadata;
pub mod mp3;
pub mod riff;

pub use aiff::aiff_duration_ms;
pub use audio::{discover_audio_files, is_supported_audio, SUPPORTED_EXTENSIONS};
pub use dedup::{DuplicateKind, ScanDeduplicator};
pub use fingerprint::{compute_file_fingerprint, FINGERPRINT_WINDOW};
pub use metadata::{
    cache_artwork, camelot_from_key, extract_metadata, CachedArtwork, EmbeddedArtwork,
    ExtractedMetadata,
};
pub use mp3::mp3_duration_ms;
pub use riff::wav_duration_ms;

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
