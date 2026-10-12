//! End-to-end tests over the synthetic audio fixture corpus.
//!
//! These compose the same `dj-assistant-core` functions that
//! `apps/desktop/src-tauri/src/scanner.rs::run_scan` calls, in the same order, so
//! they exercise the real scan pipeline without linking Tauri/WebView2:
//!
//!   discover_audio_files -> compute_file_fingerprint -> ScanDeduplicator -> extract_metadata
//!
//! They cover Phase 0 acceptance criteria P0.3 (stable hashes), P0.4 (duplicate
//! detection), P0.5 (metadata for common formats) and P0.7 (corrupt files must
//! not abort a scan).
//!
//! The corpus is produced by `scripts/make-fixtures.py`. If it has not been
//! generated, `corpus_root` returns `None` and every test is skipped with an
//! explanatory message rather than failing — run `python scripts/make-fixtures.py`
//! to populate it.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use dj_assistant_core::{
    compute_file_fingerprint, discover_audio_files, extract_metadata, ExtractedMetadata,
    ScanDeduplicator,
};

/// `<repo>/fixtures/audio`.
fn corpus_root() -> Option<PathBuf> {
    // CARGO_MANIFEST_DIR is <repo>/crates/core
    let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()?
        .parent()?
        .to_path_buf();
    let audio = repo.join("fixtures").join("audio");
    if audio.is_dir() {
        Some(audio)
    } else {
        None
    }
}

/// Skips (rather than fails) when the corpus has not been generated.
macro_rules! corpus_or_skip {
    () => {
        match corpus_root() {
            Some(p) => p,
            None => {
                eprintln!("SKIP: fixtures/audio missing; run `python scripts/make-fixtures.py`");
                return;
            }
        }
    };
}

/// Replicates the scanner's per-file flow and returns what it would import.
fn run_pipeline(root: &Path) -> ScanOutcome {
    let mut dedup = ScanDeduplicator::new();
    let mut outcome = ScanOutcome::default();

    for path in discover_audio_files(root, true) {
        outcome.discovered += 1;

        let hash = match compute_file_fingerprint(&path) {
            Ok(h) => h,
            Err(e) => {
                outcome.hash_errors.push((path.clone(), e.to_string()));
                continue;
            }
        };

        // No database in this test, so `exists_in_db` is always false; the point is
        // to exercise in-batch duplicate detection.
        if dedup.classify(&hash, |_| false).is_duplicate() {
            outcome.duplicates.push((path.clone(), hash));
            continue;
        }

        match extract_metadata(&path) {
            Ok(meta) => outcome.imported.push((path, hash, meta)),
            Err(e) => {
                dedup.release(&hash);
                outcome.metadata_errors.push((path, e));
            }
        }
    }

    outcome
}

#[derive(Default)]
struct ScanOutcome {
    discovered: usize,
    imported: Vec<(PathBuf, String, ExtractedMetadata)>,
    duplicates: Vec<(PathBuf, String)>,
    hash_errors: Vec<(PathBuf, String)>,
    metadata_errors: Vec<(PathBuf, String)>,
}

#[test]
fn corpus_is_not_empty_and_contains_corrupt_cases() {
    let root = corpus_or_skip!();
    let files = discover_audio_files(&root, true);

    assert!(
        !files.is_empty(),
        "fixture corpus must contain audio files; regenerate fixtures/audio"
    );

    // A corpus with no deliberately-broken files cannot test P0.7.
    let has_corrupt = files.iter().any(|p| {
        p.components()
            .any(|c| c.as_os_str().to_string_lossy() == "corrupt")
    });
    assert!(
        has_corrupt,
        "fixture corpus must include a corrupt/ directory to exercise P0.7"
    );
}

#[test]
fn scan_imports_every_readable_file_without_aborting() {
    // P0.7: one bad file must not stop the scan. Every discovered file should end
    // up either imported or explicitly recorded as an error - never silently lost,
    // and never a panic.
    let root = corpus_or_skip!();
    let outcome = run_pipeline(&root);

    assert!(outcome.discovered > 0, "nothing discovered");
    assert_eq!(
        outcome.discovered,
        outcome.imported.len() + outcome.duplicates.len() + outcome.hash_errors.len(),
        "every discovered file must be accounted for (imported, duplicate, or hash error)"
    );
    assert!(
        outcome.hash_errors.is_empty(),
        "hashing must not fail for existing files: {:?}",
        outcome.hash_errors
    );
}

#[test]
fn corrupt_files_still_import_with_fallbacks() {
    // P0.7 continued: a file that exists but whose tags cannot be parsed must yield
    // Ok with fallback values, not an error, so the scan continues.
    let root = corpus_or_skip!();
    let outcome = run_pipeline(&root);

    assert!(
        outcome.metadata_errors.is_empty(),
        "readable-but-corrupt files must not produce metadata errors: {:?}",
        outcome.metadata_errors
    );

    let corrupt: Vec<_> = outcome
        .imported
        .iter()
        .filter(|(p, _, _)| {
            p.components()
                .any(|c| c.as_os_str().to_string_lossy() == "corrupt")
        })
        .collect();

    assert!(
        !corrupt.is_empty(),
        "expected corrupt fixtures to reach the import stage"
    );

    for (path, _, meta) in corrupt {
        assert!(
            !meta.title.trim().is_empty(),
            "corrupt file {:?} must fall back to a filename-derived title",
            path
        );
    }
}

#[test]
fn fingerprints_are_stable_across_repeated_scans() {
    // P0.3: rescanning must produce identical fingerprints, otherwise every rescan
    // would re-import the whole library.
    let root = corpus_or_skip!();

    let first: HashMap<PathBuf, String> = run_pipeline(&root)
        .imported
        .into_iter()
        .map(|(p, h, _)| (p, h))
        .collect();

    let second: HashMap<PathBuf, String> = run_pipeline(&root)
        .imported
        .into_iter()
        .map(|(p, h, _)| (p, h))
        .collect();

    assert_eq!(
        first.len(),
        second.len(),
        "a rescan must import the same number of files"
    );

    for (path, hash) in &first {
        assert_eq!(
            second.get(path),
            Some(hash),
            "fingerprint for {:?} changed between scans",
            path
        );
    }
}

#[test]
fn byte_identical_copies_are_detected_as_duplicates() {
    // P0.4: the corpus intentionally contains the same file under two names. Note
    // this only works because ScanDeduplicator remembers fingerprints claimed
    // during the run - the original code compared against the database alone and
    // would have imported both.
    let root = corpus_or_skip!();
    let outcome = run_pipeline(&root);

    let duplicate_names: Vec<String> = outcome
        .duplicates
        .iter()
        .map(|(p, _)| p.file_name().unwrap().to_string_lossy().to_string())
        .collect();

    assert!(
        !duplicate_names.is_empty(),
        "expected at least one in-batch duplicate; found none in {:?}",
        outcome
            .imported
            .iter()
            .map(|(p, _, _)| p.file_name().unwrap().to_string_lossy().to_string())
            .collect::<Vec<_>>()
    );

    // Each duplicate must share its fingerprint with exactly one imported file.
    let imported_hashes: HashMap<&str, &Path> = outcome
        .imported
        .iter()
        .map(|(p, h, _)| (h.as_str(), p.as_path()))
        .collect();

    for (path, hash) in &outcome.duplicates {
        let original = imported_hashes.get(hash.as_str());
        assert!(
            original.is_some(),
            "duplicate {:?} has fingerprint {} matching no imported file",
            path,
            hash
        );
        assert_ne!(
            *original.unwrap(),
            path.as_path(),
            "a file cannot be a duplicate of itself"
        );
    }
}

#[test]
fn unsupported_extensions_are_never_discovered() {
    // The corpus contains fixtures/audio/unsupported/notes.txt; it must be ignored.
    let root = corpus_or_skip!();
    let files = discover_audio_files(&root, true);

    for path in &files {
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        assert!(
            dj_assistant_core::SUPPORTED_EXTENSIONS.contains(&ext.as_str()),
            "discovered an unsupported file: {:?}",
            path
        );
    }
}

#[test]
fn tagged_fixtures_yield_expected_metadata() {
    // P0.5: tag values must survive extraction for each supported container.
    // Assertions are structural (non-empty, plausible) rather than pinned to exact
    // strings, so the corpus can be regenerated without churning these tests. The
    // manifest-driven test pins the exact values.
    let root = corpus_or_skip!();
    let outcome = run_pipeline(&root);

    let mut by_format: HashMap<String, Vec<&ExtractedMetadata>> = HashMap::new();
    for (path, _, meta) in &outcome.imported {
        if path
            .components()
            .any(|c| c.as_os_str().to_string_lossy() == "corrupt")
        {
            continue;
        }
        by_format.entry(meta.format.clone()).or_default().push(meta);
    }

    // The corpus must cover the formats Phase 0 claims support for.
    for expected in ["wav", "flac", "aiff", "mp3", "m4a"] {
        assert!(
            by_format.contains_key(expected),
            "corpus is missing a non-corrupt .{} fixture (found {:?})",
            expected,
            by_format.keys().collect::<Vec<_>>()
        );
    }

    for (format, metas) in &by_format {
        for meta in metas {
            assert!(
                !meta.title.trim().is_empty(),
                "{} fixture has an empty title",
                format
            );
            assert!(
                !meta.artist.trim().is_empty(),
                "{} fixture has an empty artist",
                format
            );
        }
    }
}
