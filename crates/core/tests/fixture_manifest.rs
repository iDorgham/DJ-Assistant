//! Manifest-driven fixture tests: pins the *exact* values the scanner must extract.
//!
//! `tests/scan_corpus.rs` checks pipeline behaviour structurally; this file asserts
//! against `fixtures/audio/manifest.json`, which records what each generated file
//! actually contains. That makes P0.5 ("metadata correctly extracted for MP3, FLAC,
//! AIFF, WAV") a precise, machine-checkable claim rather than a spot check.

mod common;

use std::collections::HashMap;

use dj_assistant_core::{
    compute_file_fingerprint, discover_audio_files, extract_metadata, is_supported_audio,
};

use common::{load_manifest, skip_notice, ManifestFile};

/// Duration comparison tolerance, in milliseconds.
///
/// Deliberately tight: WAV and AIFF durations are parsed straight from the file
/// header (exact to the millisecond) and FLAC reports a precise value. The original
/// 1100 ms tolerance was loose enough that a completely broken WAV/AIFF duration
/// (0 ms) still passed — this value makes such a regression fail for every fixture
/// except the sub-200 ms MP3, whose frame-derived duration is the only one that
/// genuinely drifts.
const DURATION_TOLERANCE_MS: i64 = 200;

#[test]
fn manifest_matches_the_files_on_disk() {
    let Some((root, manifest)) = load_manifest() else {
        skip_notice();
        return;
    };

    assert_eq!(manifest.manifest_version, 1, "unexpected manifest version");
    assert_eq!(
        manifest.files.len(),
        manifest.file_count,
        "file_count disagrees with the files array"
    );

    let mut seen: HashMap<&str, &ManifestFile> = HashMap::new();
    for entry in &manifest.files {
        let absolute = root.join(&entry.path);
        assert!(
            absolute.is_file(),
            "manifest lists {} but the file is missing",
            entry.path
        );

        let actual_bytes = std::fs::metadata(&absolute).unwrap().len();
        assert_eq!(
            actual_bytes, entry.bytes,
            "byte size drifted for {} — regenerate fixtures",
            entry.path
        );

        assert!(
            seen.insert(entry.path.as_str(), entry).is_none(),
            "duplicate manifest entry for {}",
            entry.path
        );
    }
}

#[test]
fn discovery_decisions_match_the_manifest() {
    let Some((root, manifest)) = load_manifest() else {
        skip_notice();
        return;
    };

    let discovered: Vec<String> = discover_audio_files(&root, true)
        .into_iter()
        .map(|p| {
            p.strip_prefix(&root)
                .expect("discovered paths must live under the corpus root")
                .to_string_lossy()
                .replace('\\', "/")
        })
        .collect();

    let mut expected: Vec<String> = manifest
        .files
        .iter()
        .filter(|f| f.supported)
        .map(|f| f.path.clone())
        .collect();
    expected.sort();
    let mut actual = discovered.clone();
    actual.sort();

    assert_eq!(
        actual, expected,
        "the set of discovered audio files must match the manifest's supported files"
    );
}

#[test]
fn supported_flag_agrees_with_the_discovery_rules() {
    let Some((root, manifest)) = load_manifest() else {
        skip_notice();
        return;
    };

    for entry in &manifest.files {
        let absolute = root.join(&entry.path);
        assert_eq!(
            is_supported_audio(&absolute),
            entry.supported,
            "supported flag disagrees with the scanner rules for {}",
            entry.path
        );
    }
}

#[test]
fn supported_extensions_match_the_scanner() {
    // The manifest documents the extensions the corpus treats as supported. It must
    // mirror `dj_assistant_core::SUPPORTED_EXTENSIONS`, otherwise the discovery
    // assertions below would be validating against a stale list.
    let Some((_root, manifest)) = load_manifest() else {
        skip_notice();
        return;
    };

    let mut manifest_exts = manifest.supported_extensions.clone();
    manifest_exts.sort();

    let mut scanner_exts: Vec<String> = dj_assistant_core::SUPPORTED_EXTENSIONS
        .iter()
        .map(|ext| ext.to_string())
        .collect();
    scanner_exts.sort();

    assert_eq!(
        manifest_exts, scanner_exts,
        "manifest supported_extensions must mirror dj_assistant_core::SUPPORTED_EXTENSIONS"
    );
}

#[test]
fn tags_match_the_manifest_exactly() {
    // P0.5, the precise version.
    let Some((root, manifest)) = load_manifest() else {
        skip_notice();
        return;
    };

    let mut checked = 0;

    for entry in &manifest.files {
        if !entry.supported || !entry.readable {
            continue;
        }

        let absolute = root.join(&entry.path);
        let meta = extract_metadata(&absolute)
            .unwrap_or_else(|e| panic!("{} should extract, got error: {}", entry.path, e));

        // Title/artist always have a value (tag or filename/unknown fallback).
        assert_eq!(
            meta.title,
            entry.expected.title.clone().unwrap_or_else(|| {
                // Fallback is the filename stem.
                std::path::Path::new(&entry.path)
                    .file_stem()
                    .unwrap()
                    .to_string_lossy()
                    .to_string()
            }),
            "title mismatch for {}",
            entry.path
        );

        assert_eq!(
            meta.artist,
            entry
                .expected
                .artist
                .clone()
                .unwrap_or_else(|| "Unknown Artist".to_string()),
            "artist mismatch for {}",
            entry.path
        );

        assert_eq!(
            meta.album, entry.expected.album,
            "album mismatch for {}",
            entry.path
        );
        assert_eq!(
            meta.genre, entry.expected.genre,
            "genre mismatch for {}",
            entry.path
        );
        assert_eq!(
            meta.year, entry.expected.year,
            "year mismatch for {}",
            entry.path
        );
        assert_eq!(
            meta.format, entry.format,
            "format mismatch for {}",
            entry.path
        );

        if let Some(expected_secs) = entry.expected.duration_seconds {
            let expected_ms = (expected_secs * 1000.0).round() as i64;
            let delta = (meta.duration_ms - expected_ms).abs();
            assert!(
                delta <= DURATION_TOLERANCE_MS,
                "duration for {} was {}ms, expected ~{}ms (delta {}ms > tolerance {}ms)",
                entry.path,
                meta.duration_ms,
                expected_ms,
                delta,
                DURATION_TOLERANCE_MS
            );
            checked += 1;
        }
    }

    assert!(
        checked > 0,
        "no fixture declared an expected duration; the manifest looks wrong"
    );
}

#[test]
fn corrupt_and_unreadable_fixtures_never_error() {
    // P0.7: files flagged corrupt must still extract (with fallbacks) so a single
    // bad file cannot abort a library scan.
    let Some((root, manifest)) = load_manifest() else {
        skip_notice();
        return;
    };

    let corrupt: Vec<&ManifestFile> = manifest.files.iter().filter(|f| f.corrupt).collect();
    assert!(
        !corrupt.is_empty(),
        "manifest declares no corrupt fixtures; P0.7 cannot be verified"
    );

    for entry in corrupt {
        let absolute = root.join(&entry.path);
        let result = extract_metadata(&absolute);
        assert!(
            result.is_ok(),
            "corrupt fixture {} must not produce an error, got {:?}",
            entry.path,
            result.err()
        );

        let meta = result.unwrap();
        assert!(
            !meta.title.trim().is_empty(),
            "corrupt fixture {} must fall back to a non-empty title",
            entry.path
        );
    }
}

#[test]
fn duplicate_entries_share_a_fingerprint_and_originals_do_not() {
    // P0.4, the precise version: the manifest names which file duplicates which.
    let Some((root, manifest)) = load_manifest() else {
        skip_notice();
        return;
    };

    let duplicates: Vec<&ManifestFile> = manifest
        .files
        .iter()
        .filter(|f| f.duplicate_of.is_some())
        .collect();
    assert!(
        !duplicates.is_empty(),
        "manifest declares no duplicates; P0.4 cannot be verified"
    );

    for dup in duplicates {
        let dup_path = root.join(&dup.path);
        let original_rel = dup.duplicate_of.as_ref().unwrap();
        let original_path = root.join(original_rel);

        assert!(
            original_path.is_file(),
            "{} claims to duplicate {} which does not exist",
            dup.path,
            original_rel
        );

        let dup_hash = compute_file_fingerprint(&dup_path).unwrap();
        let original_hash = compute_file_fingerprint(&original_path).unwrap();

        assert_eq!(
            dup_hash, original_hash,
            "{} should fingerprint identically to {}",
            dup.path, original_rel
        );

        // Byte-identity, not just fingerprint equality: the manifest records a
        // sha256 per file, so compare the duplicate's against the original's.
        let original_entry = manifest
            .files
            .iter()
            .find(|f| f.path == *original_rel)
            .unwrap_or_else(|| panic!("{} is not listed in the manifest", original_rel));
        assert_eq!(
            dup.sha256, original_entry.sha256,
            "{} is declared a duplicate of {} but their bytes differ",
            dup.path, original_rel
        );
    }
}

#[test]
fn all_non_duplicate_fixtures_have_distinct_fingerprints() {
    // Guards the other direction of P0.4: distinct files must NOT collide, or the
    // scanner would wrongly skip real tracks.
    let Some((root, manifest)) = load_manifest() else {
        skip_notice();
        return;
    };

    let mut by_hash: HashMap<String, Vec<String>> = HashMap::new();
    for entry in manifest.files.iter().filter(|f| f.supported && f.readable) {
        let hash = compute_file_fingerprint(root.join(&entry.path)).unwrap();
        by_hash.entry(hash).or_default().push(entry.path.clone());
    }

    let declared_dup_paths: Vec<&String> = manifest
        .files
        .iter()
        .filter(|f| f.duplicate_of.is_some())
        .map(|f| &f.path)
        .collect();

    for (hash, paths) in by_hash {
        if paths.len() <= 1 {
            continue;
        }
        // A collision is only acceptable when every path in the group is either a
        // declared duplicate, or the *original* that some other path duplicates.
        let explained = paths.iter().all(|p| {
            declared_dup_paths.contains(&p)
                || manifest
                    .files
                    .iter()
                    .any(|f| f.duplicate_of.as_ref() == Some(p))
        });
        assert!(
            explained,
            "fingerprint collision {} on {:?} is not declared in the manifest",
            hash, paths
        );
    }
}
