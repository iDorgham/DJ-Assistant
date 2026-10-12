//! Shared helpers for integration tests that read the fixture corpus manifest.

#![allow(dead_code)] // Not every test binary uses every helper.

use std::path::{Path, PathBuf};

use serde::Deserialize;

/// One generated fixture, as described by `fixtures/audio/manifest.json`.
#[derive(Debug, Clone, Deserialize)]
pub struct ManifestFile {
    /// POSIX-style path relative to `fixtures/audio`.
    pub path: String,
    pub format: String,
    pub extension: String,
    pub bytes: u64,
    pub sha256: String,
    pub supported: bool,
    pub readable: bool,
    pub corrupt: bool,
    /// Relative path of the file this one duplicates, or null.
    pub duplicate_of: Option<String>,
    pub expected: Expected,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Expected {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    /// Present for audio fixtures; null where the container cannot report it.
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Manifest {
    pub manifest_version: u32,
    pub file_count: usize,
    pub supported_extensions: Vec<String>,
    pub files: Vec<ManifestFile>,
}

/// Absolute path to `<repo>/fixtures/audio`, or `None` when absent.
pub fn corpus_root() -> Option<PathBuf> {
    let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()?
        .parent()?
        .to_path_buf();
    let audio = repo.join("fixtures").join("audio");
    audio.is_dir().then_some(audio)
}

/// Loads and parses the manifest, or `None` when the corpus is not generated.
pub fn load_manifest() -> Option<(PathBuf, Manifest)> {
    let root = corpus_root()?;
    let raw = std::fs::read_to_string(root.join("manifest.json")).ok()?;
    let manifest: Manifest = serde_json::from_str(&raw).expect("manifest.json must be valid JSON");
    Some((root, manifest))
}

/// Prints the standard skip notice. Callers then `return` to skip the test.
pub fn skip_notice() {
    eprintln!("SKIP: fixtures/audio/manifest.json missing; run `python scripts/make-fixtures.py`");
}
