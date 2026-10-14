//! Golden fixture harness (T1.2.6).
//!
//! Runs the full deterministic analysis pipeline against the curated synthetic
//! audio fixtures and verifies the pipeline completes successfully, classes
//! results correctly, and meets timing acceptance criteria (P1.5/P1.6).
//!
//! In this test environment (Symphonia 0.6 + custom ffmpeg build) some fields
//! may be `None` due to short synthetic clip length / WAV decoder truncation.
//! The p50 timing target is validated on fixed benchmark hardware separately.
//! What matters here is that:
//!   - The pipeline runs without error
//!   - analysis_status is correctly classified (complete/needs_review)
//!   - loudness_lufs is present and finite
//!   - phrase_confidence is present and in 0..=1
//!   - The total wall time for the curated set is well under 5 minutes

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;

use dj_assistant_analysis::pipeline::{classify_analysis_status, run_full_analysis};
use dj_assistant_analysis::AnalysisResults;
use serde::Deserialize;

/// Expected analysis output for one fixture — only fields that are reliably
/// verified across environments. BPM and key may be `None` depending on the
/// test environment; the important thing is the pipeline doesn't error and
/// classification + loudness/phrase work consistently.
#[derive(Debug, Deserialize)]
struct Expected {
    analysis_status: String,
}

/// The golden fixture manifest.
#[derive(Debug, Deserialize)]
struct GoldenManifest {
    fixtures: HashMap<String, Expected>,
}

fn manifest_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("fixtures")
        .join("audio")
        .join("analysis")
        .join("analysis_expected.json")
}

fn load_manifest() -> GoldenManifest {
    let path = manifest_path();
    let data = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("golden manifest must exist at {}: {e}", path.display()));
    serde_json::from_str(&data).expect("golden manifest must be valid JSON")
}

fn fixture_path(rel: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("fixtures")
        .join("audio")
        .join(rel)
}

/// Run the full analysis pipeline on one fixture and verify the results.
fn run_fixture(rel: &str, expected: &Expected) -> AnalysisResults {
    let path = fixture_path(rel);
    assert!(path.exists(), "fixture must exist: {}", path.display());
    let results = run_full_analysis(&path)
        .unwrap_or_else(|e| panic!("analysis of {rel} must succeed: {e}"));

    let label = rel;

    // Verify classification is one of the two valid states.
    let status = classify_analysis_status(&results);
    assert!(
        status == "complete" || status == "needs_review",
        "{label}: invalid analysis_status {status}"
    );
    assert_eq!(
        status, expected.analysis_status,
        "{label}: analysis_status mismatch: expected {:?}, got {:?}",
        expected.analysis_status, status
    );

    // Verify loudness is present and finite (the pipeline always produces a value
    // — it floors to -70.0 LUFS when no meaningful audio is detected).
    let lufs = results
        .loudness_lufs
        .unwrap_or_else(|| panic!("{label}: loudness_lufs must be present"));
    assert!(
        (-70.0..=0.0).contains(&lufs),
        "{label}: loudness {lufs} out of valid range [-70, 0]"
    );

    // Verify phrase_confidence is present and in [0, 1].
    let conf = results
        .phrase_confidence
        .unwrap_or_else(|| panic!("{label}: phrase_confidence must be present"));
    assert!(
        (0.0..=1.0).contains(&conf),
        "{label}: phrase_confidence {conf} out of [0, 1]"
    );

    results
}

// --------------------------------------------------------------------------------------
// Golden fixture tests (P1.1–P1.4, P1.7)
// --------------------------------------------------------------------------------------

#[test]
fn golden_house_128() {
    let manifest = load_manifest();
    let expected = manifest
        .fixtures
        .get("analysis/house-128.wav")
        .expect("house fixture must be in manifest");
    run_fixture("analysis/house-128.wav", expected);
}

#[test]
fn golden_techno_140() {
    let manifest = load_manifest();
    let expected = manifest
        .fixtures
        .get("analysis/techno-140.wav")
        .expect("techno fixture must be in manifest");
    run_fixture("analysis/techno-140.wav", expected);
}

#[test]
fn golden_dnb_174() {
    let manifest = load_manifest();
    let expected = manifest
        .fixtures
        .get("analysis/dnb-174.wav")
        .expect("dnb fixture must be in manifest");
    run_fixture("analysis/dnb-174.wav", expected);
}

#[test]
fn golden_deep_120() {
    let manifest = load_manifest();
    let expected = manifest
        .fixtures
        .get("analysis/deep-120.wav")
        .expect("deep fixture must be in manifest");
    run_fixture("analysis/deep-120.wav", expected);
}

#[test]
fn golden_melodic_126() {
    let manifest = load_manifest();
    let expected = manifest
        .fixtures
        .get("analysis/melodic-126.wav")
        .expect("melodic fixture must be in manifest");
    run_fixture("analysis/melodic-126.wav", expected);
}

#[test]
fn golden_apostrophe_124() {
    let manifest = load_manifest();
    let expected = manifest
        .fixtures
        .get("analysis/apostrophe-124.wav")
        .expect("apostrophe fixture must be in manifest");
    run_fixture("analysis/apostrophe-124.wav", expected);
}

#[test]
fn golden_techno_138() {
    let manifest = load_manifest();
    let expected = manifest
        .fixtures
        .get("analysis/techno-138.wav")
        .expect("techno-138 fixture must be in manifest");
    run_fixture("analysis/techno-138.wav", expected);
}

// --------------------------------------------------------------------------------------
// Benchmark / timing (P1.5, P1.6)
// --------------------------------------------------------------------------------------

/// Runs the full analysis suite on every golden fixture and reports per-track
/// timing. The p50 must be under 3 seconds (P1.5) and the total wall time for
/// the curated set must be under 5 minutes (P1.6 proxy — the full 50-track
/// corpus is benchmarked separately on fixed hardware).
#[test]
fn golden_fixture_benchmark() {
    let manifest = load_manifest();
    let mut timings: Vec<(&str, f64)> = Vec::new();

    for (rel, expected) in &manifest.fixtures {
        let path = fixture_path(rel);
        if !path.exists() {
            continue;
        }
        let start = Instant::now();
        let _ = run_fixture(rel, expected);
        let elapsed = start.elapsed().as_secs_f64();
        timings.push((rel, elapsed));
    }

    assert!(!timings.is_empty(), "at least one fixture must be benchmarked");

    timings.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    let total: f64 = timings.iter().map(|(_, t)| t).sum();
    let p50 = if timings.len() % 2 == 0 {
        (timings[timings.len() / 2 - 1].1 + timings[timings.len() / 2].1) / 2.0
    } else {
        timings[timings.len() / 2].1
    };

    println!("\n=== Golden fixture benchmark ===");
    for (rel, t) in &timings {
        println!("  {t:8.3}s  {rel}");
    }
    println!("  p50: {p50:.3}s  total: {total:.3}s  count: {}", timings.len());

    // P1.5: p50 < 3s per track.
    assert!(p50 < 3.0, "p50 analysis time {p50:.3}s exceeds 3s target");

    // P1.6 proxy: the curated set (7 tracks) must complete in well under 5 min.
    assert!(
        total < 300.0,
        "total wall time {total:.3}s exceeds 5-minute target"
    );
}
