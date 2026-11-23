//! The embedded-artwork backfill contract.
//!
//! A library imported before the scanner cached cover art holds rows with no
//! `artwork_hash` even though the files themselves carry an APIC frame, and a
//! re-scan cannot help: the fingerprint matches an existing row, so the file is
//! reported as a duplicate and skipped. The backfill re-reads the file and fills
//! the cache.
//!
//! These tests pin the two properties the feature is worthless without:
//!
//! * **Only the artwork columns are written.** The extractor re-reads title,
//!   artist, rating and comments on its way to the picture; a backfill that
//!   wrote any of those would silently roll back the user's edits.
//! * **A row that already has artwork is never selected**, so the run is
//!   idempotent and cannot overwrite art the user chose or enrichment fetched.

use std::path::{Path, PathBuf};

use dj_assistant_core::artwork_backfill::{
    candidates_sql, extract_and_cache, plan_artwork_write, ArtworkSource, BackfillTally,
};
use dj_assistant_core::library_schema::LibrarySchema;
use dj_assistant_core::{cache_artwork, EmbeddedArtwork, WriteValue};

/// A directory under the temp dir, unique per test name.
///
/// Created rather than reused: a leftover cache file from an earlier run would
/// make a "wrote nothing" assertion pass for the wrong reason.
fn scratch_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("dj-artwork-backfill-{name}"));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("scratch dir");
    dir
}

/// An mp3 whose ID3v2.4 tag carries a cover picture, mirroring the corpus the
/// importer sees. The audio payload is irrelevant: the extractor reads tags.
fn mp3_with_cover(dir: &Path, name: &str, picture: &[u8]) -> PathBuf {
    use id3::frame::{Picture, PictureType};
    use id3::{TagLike, Version};

    let path = dir.join(name);
    std::fs::write(&path, b"").expect("fixture file");
    let mut tag = id3::Tag::new();
    tag.set_title("Up to You");
    tag.set_artist("Space Motion");
    tag.add_frame(Picture {
        mime_type: "image/jpeg".to_string(),
        picture_type: PictureType::CoverFront,
        description: String::new(),
        data: picture.to_vec(),
    });
    tag.write_to_path(&path, Version::Id3v24)
        .expect("tagged mp3");
    path
}

/// A tagged file with no picture block at all.
fn tagless_mp3(dir: &Path, name: &str) -> PathBuf {
    use id3::Version;

    let path = dir.join(name);
    std::fs::write(&path, b"").expect("fixture file");
    id3::Tag::new()
        .write_to_path(&path, Version::Id3v24)
        .unwrap();
    path
}

const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46];

// --- the selection -------------------------------------------------------

#[test]
fn the_candidate_query_requires_an_empty_artwork_slot() {
    let sql = candidates_sql(&LibrarySchema::CURRENT);
    assert!(
        sql.contains("artwork_hash IS NULL"),
        "rows that already have artwork must never be offered: {sql}"
    );
    assert!(
        sql.contains(LibrarySchema::CURRENT.rows_condition()),
        "soft-removed tracks are not library rows: {sql}"
    );
    assert!(
        sql.contains("ORDER BY"),
        "a deterministic order makes a resumed run countable: {sql}"
    );
}

#[test]
fn a_schema_without_the_removal_column_is_still_selectable() {
    // Issue #61's lesson: a library older than migration 008 must stay readable.
    let sql = candidates_sql(&LibrarySchema::PRE_REMOVAL);
    assert!(
        !sql.contains("removed_at"),
        "a pre-008 database has no such column to name: {sql}"
    );
    assert!(sql.contains("1 = 1"), "{sql}");
}

// --- the per-file work ---------------------------------------------------

#[test]
fn embedded_cover_art_is_extracted_and_cached_under_its_content_hash() {
    let dir = scratch_dir("extract");
    let mp3 = mp3_with_cover(&dir, "cover.mp3", JPEG);
    let cache = dir.join("artwork");

    let outcome = extract_and_cache(&mp3, &cache);

    let art = match &outcome {
        ArtworkSource::Cached(art) => art,
        other => panic!("the file has an APIC frame, got {other:?}"),
    };
    let expected = cache_artwork(
        &EmbeddedArtwork {
            mime_type: "image/jpeg".to_string(),
            data: JPEG.to_vec(),
        },
        &cache,
    )
    .expect("reference cache write");

    // Same bytes must land on the same content-addressed entry the importer uses,
    // so a backfilled row and an imported row are indistinguishable downstream.
    assert_eq!(art.hash, expected.hash);
    assert_eq!(art.mime_type, "image/jpeg");
    assert!(art.path.exists(), "the cache file must be on disk");
    assert_eq!(
        art.path,
        cache.join(format!("{}.jpg", art.hash)),
        "the cached name is the BLAKE3 digest plus the mime extension"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_file_without_a_picture_reports_no_art_and_caches_nothing() {
    let dir = scratch_dir("no-art");
    let mp3 = tagless_mp3(&dir, "bare.mp3");
    let cache = dir.join("artwork");

    assert!(
        matches!(
            extract_and_cache(&mp3, &cache),
            ArtworkSource::NoEmbeddedArt
        ),
        "a tagless file is expected, not a failure"
    );
    let entries = std::fs::read_dir(&cache).map(|d| d.count()).unwrap_or(0);
    assert_eq!(entries, 0, "nothing may be written for a file with no art");

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_file_that_vanished_after_import_is_reported_as_missing() {
    let dir = scratch_dir("missing");
    let gone = dir.join("gone.mp3");

    assert!(matches!(
        extract_and_cache(&gone, &dir.join("artwork")),
        ArtworkSource::FileMissing
    ));

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_file_that_cannot_be_read_is_reported_rather_than_panicking() {
    let dir = scratch_dir("unreadable");
    // A directory is not a readable audio file: opening it fails the same way a
    // locked or permission-denied file does, without needing special privileges.

    assert!(matches!(
        extract_and_cache(&dir, &dir.join("artwork")),
        ArtworkSource::Unreadable
    ));

    let _ = std::fs::remove_dir_all(&dir);
}

// --- the write -----------------------------------------------------------

#[test]
fn the_write_sets_the_three_artwork_columns_and_nothing_else() {
    let dir = scratch_dir("write");
    let art = cache_artwork(
        &EmbeddedArtwork {
            mime_type: "image/png".to_string(),
            data: vec![0x89, 0x50, 0x4E, 0x47],
        },
        &dir,
    )
    .unwrap();

    let stmt = plan_artwork_write("track-1", &art);
    let sql = stmt.sql.to_ascii_lowercase();

    assert!(sql.contains("update tracks"), "{sql}");
    assert!(sql.contains("artwork_hash"), "{sql}");
    assert!(sql.contains("artwork_path"), "{sql}");
    assert!(sql.contains("artwork_mime"), "{sql}");
    assert!(sql.contains("where id = ?"), "{sql}");
    // The safety property: the extractor carries other fields, none may be written.
    for column in [
        "title",
        "artist",
        "album",
        "genre",
        "bpm",
        "user_rating",
        "comments",
    ] {
        assert!(
            !sql.contains(column),
            "the backfill must not touch that column: {sql}"
        );
    }

    assert_eq!(
        stmt.params,
        vec![
            WriteValue::Text(art.hash.clone()),
            WriteValue::Text(art.path.to_string_lossy().into_owned()),
            WriteValue::Text(art.mime_type.clone()),
            WriteValue::Text("track-1".to_string()),
        ],
        "hash, path, mime, then the id the row is keyed by"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

// --- the tally -----------------------------------------------------------

#[test]
fn the_tally_counts_each_outcome_once() {
    let dir = scratch_dir("tally");
    let art = cache_artwork(
        &EmbeddedArtwork {
            mime_type: "image/jpeg".to_string(),
            data: JPEG.to_vec(),
        },
        &dir,
    )
    .unwrap();

    let mut tally = BackfillTally::default();
    tally.record(&ArtworkSource::Cached(art.clone()));
    tally.record(&ArtworkSource::Cached(art));
    tally.record(&ArtworkSource::NoEmbeddedArt);
    tally.record(&ArtworkSource::FileMissing);
    tally.record(&ArtworkSource::Unreadable);

    assert_eq!(tally.scanned, 5, "every candidate considered is counted");
    assert_eq!(tally.filled, 2);
    assert_eq!(tally.without_art, 1);
    assert_eq!(tally.missing_file, 1);
    assert_eq!(tally.unreadable, 1);
    assert_eq!(
        tally.filled + tally.without_art + tally.missing_file + tally.unreadable,
        tally.scanned,
        "no candidate may fall through the tally"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_fresh_tally_is_empty() {
    let tally = BackfillTally::default();
    assert_eq!(tally.scanned, 0);
    assert_eq!(tally.filled, 0);
}
