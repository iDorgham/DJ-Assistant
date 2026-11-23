//! The embedded-artwork backfill: what a run selects, what it reads per file,
//! and what it writes back.
//!
//! A library imported before the scanner cached cover art holds rows with no
//! `artwork_hash` even though the files carry a picture, and a re-scan cannot
//! help: the fingerprint matches an existing row, so the file is reported as a
//! duplicate and skipped. The backfill goes straight to the file instead.
//!
//! Like [`crate::library_query`], this module holds SQL as data and never runs
//! it — `core` stays free of a database dependency so the rules are unit
//! testable on any toolchain, and the desktop layer is the thin executor. The
//! statements run against the real migrated schema in
//! `tests/schema/tests/artwork_backfill.rs`.
//!
//! Two rules the whole module exists to keep:
//!
//! * **Only the artwork columns are written.** The tag read walks past title,
//!   artist, rating and comments; writing any of them would roll back the
//!   user's edits behind their back.
//! * **A row that already has artwork is never selected**, so a run is
//!   idempotent and cannot overwrite art the user chose or enrichment fetched.

use std::path::Path;

use crate::library_schema::LibrarySchema;
use crate::library_writes::{WriteStatement, WriteValue};
use crate::metadata::{cache_artwork, CachedArtwork};

/// The library rows a backfill run works through: every track whose artwork
/// slot is empty, in a stable order.
///
/// `ORDER BY id` makes a resumed run countable against the same tally, the way
/// [`crate::library_remove`] orders its snapshot for the same reason.
pub fn candidates_sql(schema: &LibrarySchema) -> String {
    format!(
        "SELECT id, file_path FROM tracks WHERE {} AND artwork_hash IS NULL ORDER BY id",
        schema.rows_condition()
    )
}

/// What one candidate file yielded.
///
/// The four shapes are exhaustive and mutually exclusive: a tally that adds
/// them back up to the number of candidates considered proves no file fell
/// through the run unaccounted.
#[derive(Debug, Clone, PartialEq)]
pub enum ArtworkSource {
    /// A picture was found and is now in the content-addressed cache.
    Cached(CachedArtwork),
    /// The file was read and genuinely carries no picture.
    NoEmbeddedArt,
    /// The row names a file that is no longer on disk.
    FileMissing,
    /// The file or its container could not be read, so its art is unknown.
    ///
    /// Deliberately not [`Self::NoEmbeddedArt`]: a cache entry written from a
    /// NULL would tell the Library the track has no cover forever, when the
    /// honest state is that this run could not look. It also covers the
    /// containers the tag reader does not walk (m4a, ogg).
    Unreadable,
}

/// Reads one file's embedded cover art and caches it, without touching a
/// database or failing: the outcome *is* the return value.
///
/// The cache write goes through [`cache_artwork`], so a backfilled entry is
/// byte-identical to one the importer made and the two are indistinguishable
/// to [`crate::metadata`]'s readers and to `get_artwork`.
pub fn extract_and_cache(file_path: &Path, cache_dir: &Path) -> ArtworkSource {
    if !file_path.exists() {
        return ArtworkSource::FileMissing;
    }
    if !file_path.is_file() {
        return ArtworkSource::Unreadable;
    }

    let artwork = match crate::metadata::read_embedded_artwork(file_path) {
        Ok(Some(artwork)) => artwork,
        Ok(None) => return ArtworkSource::NoEmbeddedArt,
        Err(_) => return ArtworkSource::Unreadable,
    };

    match cache_artwork(&artwork, cache_dir) {
        Ok(cached) => ArtworkSource::Cached(cached),
        Err(_) => ArtworkSource::Unreadable,
    }
}

/// The write that records one cached picture against one track.
///
/// Exactly three columns, always bound, and `updated_at` is deliberately left
/// alone: a backfill is not an edit the user made, and the Library sorts by it.
pub fn plan_artwork_write(track_id: &str, artwork: &CachedArtwork) -> WriteStatement {
    WriteStatement {
        sql: "UPDATE tracks SET artwork_hash = ?1, artwork_path = ?2, artwork_mime = ?3 WHERE id = ?4"
            .to_string(),
        params: vec![
            WriteValue::Text(artwork.hash.clone()),
            WriteValue::Text(artwork.path.to_string_lossy().into_owned()),
            WriteValue::Text(artwork.mime_type.clone()),
            WriteValue::Text(track_id.to_string()),
        ],
    }
}

/// What a run has done so far, counted once per candidate.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct BackfillTally {
    /// Candidates considered, whatever the outcome.
    pub scanned: u64,
    /// Artwork written.
    pub filled: u64,
    pub without_art: u64,
    pub missing_file: u64,
    pub unreadable: u64,
}

impl BackfillTally {
    /// Accounts for one candidate. Every [`ArtworkSource`] shape lands in
    /// exactly one bucket, so `scanned` is always the other four summed.
    pub fn record(&mut self, source: &ArtworkSource) {
        self.scanned += 1;
        match source {
            ArtworkSource::Cached(_) => self.filled += 1,
            ArtworkSource::NoEmbeddedArt => self.without_art += 1,
            ArtworkSource::FileMissing => self.missing_file += 1,
            ArtworkSource::Unreadable => self.unreadable += 1,
        }
    }
}
