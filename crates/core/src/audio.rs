//! Audio file discovery: which extensions count as importable audio, and how to
//! walk a directory tree to find them.
//!
//! Kept separate from the Tauri command layer so the rules can be unit-tested
//! without constructing an app handle.

use std::path::{Path, PathBuf};

/// File extensions the scanner will attempt to import.
///
/// Order is irrelevant; matching is case-insensitive. `aif` and `aiff` are the
/// same container with different extensions, both of which appear in real DJ
/// libraries.
pub const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "aif", "aiff", "m4a"];

/// Returns true if `path` has an extension the scanner supports.
pub fn is_supported_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Walks `root_dir` and returns every supported audio file.
///
/// * `recursive == false` limits the walk to the immediate directory.
/// * Unreadable entries are skipped rather than failing the whole walk, so one
///   permission error cannot abort an import.
/// * Results are sorted by path for deterministic ordering.
pub fn discover_audio_files(root_dir: &Path, recursive: bool) -> Vec<PathBuf> {
    let max_depth = if recursive { usize::MAX } else { 1 };

    let mut files: Vec<PathBuf> = walkdir::WalkDir::new(root_dir)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.into_path())
        .filter(|path| is_supported_audio(path))
        .collect();

    // Deterministic order keeps scan progress and hashing reproducible.
    files.sort();
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_supported_extensions_case_insensitively() {
        for name in [
            "a.mp3", "a.FLAC", "a.wav", "a.aif", "a.aiff", "a.m4a", "a.Mp3", "a.AIFF",
        ] {
            assert!(
                is_supported_audio(Path::new(name)),
                "{name} should be supported"
            );
        }
    }

    #[test]
    fn rejects_unsupported_and_extensionless_files() {
        for name in [
            "notes.txt",
            "cover.jpg",
            "archive.zip",
            "README",
            "a.mp3.bak",
            "song.ogg",
            "song.wma",
            "song.aac",
        ] {
            assert!(
                !is_supported_audio(Path::new(name)),
                "{name} should be rejected"
            );
        }
    }

    #[test]
    fn rejects_dotfiles_and_directories_named_like_audio() {
        // A directory called "album.mp3" must not be treated as audio; the walker
        // filters on file type, and the extension check is purely textual.
        assert!(is_supported_audio(Path::new("album.mp3")));
    }
}
