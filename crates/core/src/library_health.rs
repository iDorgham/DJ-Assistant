//! Library Health Score (T2.3.3).
//!
//! Eight categories with the weights locked by plan decision D-050:
//! metadata 20, tags 15, analysis 15, files 15, duplicates 10, playlists 10,
//! sync 10, backup 5.
//!
//! **Unconfigured categories are neutral.** A category the app cannot measure
//! yet (there are no playlists, no sync target, no backup) reports no score and
//! drops out of the weighted mean; it neither props the total up nor drags it
//! down. A configured category that is failing counts in full.
//!
//! What is measured today, against the spec table in
//! `docs/specs/experience/maintain-and-tags.md`:
//!
//! * **Tags** — Style is not a separate field: D-026 keeps Style among the
//!   flat user tags, so custom-tag presence is the Style signal.
//! * **Analysis** — BPM, key, beat grid (a stored grid confidence) and the
//!   analysis status. Waveform peaks are not persisted per track, so waveform
//!   coverage is not part of the score yet.
//! * **Files** — missing, and unreadable or empty (the file cannot be opened
//!   or has zero bytes). Decoding every file to find corrupt audio is too slow
//!   for a report that runs on open, so a file that opens but is corrupt
//!   inside still counts as healthy.
//!
//! Every category carries the counts behind its score and the tracks it is
//! failing on, because a bare number is not actionable — the Maintain view
//! shows both.

/// One track as the health report reads it.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct HealthTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i64>,
    pub label: Option<String>,
    pub mood: Option<String>,
    pub energy: Option<i64>,
    /// Whether the track carries at least one custom tag.
    pub has_tags: bool,
    pub bpm: Option<f64>,
    pub key: Option<String>,
    pub analysis_status: String,
    /// Whether analysis stored a beat grid for the track.
    pub has_beatgrid: bool,
    /// Set by the caller after checking the disk.
    pub file: FileState,
}

/// What the caller's disk check found for a track's file.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum FileState {
    #[default]
    Present,
    Missing,
    /// Exists but cannot be opened, or has zero bytes.
    Unreadable,
}

/// Everything besides the track rows the report needs.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct HealthContext {
    /// Tracks that are an extra copy in an open duplicate group (group size
    /// minus one, summed), plus skipped byte-identical file copies.
    pub duplicate_extras: u64,
    /// Ids of tracks in open duplicate groups, for drill-down.
    pub duplicate_track_ids: Vec<String>,
    /// `None` while the app has no playlists to check.
    pub playlists: Option<RatioInput>,
    /// `None` while no sync target is configured.
    pub sync: Option<RatioInput>,
    /// `None` while no backup is configured.
    pub backup: Option<RatioInput>,
}

/// A category measured outside the track rows: `good` of `total`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RatioInput {
    pub good: u64,
    pub total: u64,
    /// Tracks behind the failures, for drill-down; capped at [`AFFECTED_CAP`]
    /// in the report.
    pub affected_ids: Vec<String>,
}

/// A labelled count shown under a category ("Missing BPM: 12").
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HealthCount {
    pub label: String,
    pub count: u64,
}

/// One scored category.
#[derive(Debug, Clone, PartialEq)]
pub struct HealthCategory {
    pub id: &'static str,
    pub label: &'static str,
    /// The locked weight, in percent.
    pub weight: u32,
    /// Whether the app can measure this category at all. A configured
    /// category over an empty library still has no score.
    pub configured: bool,
    /// 0–100, or `None` when there is nothing to score: the category is not
    /// configured (neutral), or the library is empty.
    pub score: Option<f64>,
    pub counts: Vec<HealthCount>,
    /// The tracks this category is failing on, capped at [`AFFECTED_CAP`].
    pub affected_ids: Vec<String>,
    /// How many tracks fail in total (may exceed `affected_ids.len()`).
    pub affected_total: u64,
}

/// The whole report.
#[derive(Debug, Clone, PartialEq)]
pub struct HealthReport {
    /// 0–100 over the configured categories, `None` for an empty library.
    pub score: Option<f64>,
    pub track_count: u64,
    pub categories: Vec<HealthCategory>,
}

/// The locked v1 weights (D-050), in category order.
pub const WEIGHTS: [(&str, &str, u32); 8] = [
    ("metadata", "Metadata", 20),
    ("tags", "Tags", 15),
    ("analysis", "Analysis", 15),
    ("files", "Files", 15),
    ("duplicates", "Duplicates", 10),
    ("playlists", "Playlists", 10),
    ("sync", "Sync", 10),
    ("backup", "Backup", 5),
];

/// How many affected track ids a category returns for drill-down.
pub const AFFECTED_CAP: usize = 500;

fn blank(value: &Option<String>) -> bool {
    value.as_deref().is_none_or(|v| v.trim().is_empty())
}

/// A coverage category: each check counts the tracks it fails on; the score is
/// the share of (track × check) cells that pass.
struct Coverage {
    checks: Vec<(&'static str, u64)>,
    affected: Vec<String>,
    affected_total: u64,
}

impl Coverage {
    fn new(labels: &[&'static str]) -> Self {
        Coverage {
            checks: labels.iter().map(|l| (*l, 0)).collect(),
            affected: Vec::new(),
            affected_total: 0,
        }
    }

    fn record(&mut self, id: &str, failures: &[bool]) {
        let mut any = false;
        for (slot, failed) in self.checks.iter_mut().zip(failures) {
            if *failed {
                slot.1 += 1;
                any = true;
            }
        }
        if any {
            self.affected_total += 1;
            if self.affected.len() < AFFECTED_CAP {
                self.affected.push(id.to_string());
            }
        }
    }

    fn score(&self, tracks: u64) -> Option<f64> {
        let cells = tracks * self.checks.len() as u64;
        if cells == 0 {
            return None;
        }
        let failed: u64 = self.checks.iter().map(|(_, n)| n).sum();
        Some(100.0 * (cells - failed) as f64 / cells as f64)
    }

    /// The share of tracks failing no check — for categories whose checks are
    /// alternatives (a file is missing *or* unreadable), not independent fields.
    fn track_score(&self, tracks: u64) -> Option<f64> {
        (tracks > 0).then(|| 100.0 * (tracks - self.affected_total) as f64 / tracks as f64)
    }

    fn counts(&self) -> Vec<HealthCount> {
        self.checks
            .iter()
            .map(|(label, count)| HealthCount {
                label: label.to_string(),
                count: *count,
            })
            .collect()
    }
}

fn ratio_score(input: Option<&RatioInput>) -> Option<f64> {
    input.map(|r| {
        if r.total == 0 {
            100.0
        } else {
            100.0 * r.good.min(r.total) as f64 / r.total as f64
        }
    })
}

/// Builds the report.
pub fn compute_health(tracks: &[HealthTrack], context: &HealthContext) -> HealthReport {
    let total = tracks.len() as u64;

    let mut metadata = Coverage::new(&[
        "Missing title",
        "Missing artist",
        "Missing album",
        "Missing genre",
        "Missing year",
        "Missing label",
    ]);
    let mut tags = Coverage::new(&[
        "Missing genre",
        "Missing mood",
        "Missing energy",
        "No custom tags",
    ]);
    let mut analysis = Coverage::new(&[
        "Missing BPM",
        "Missing key",
        "No beat grid",
        "Analysis incomplete",
    ]);
    let mut files = Coverage::new(&["Missing on disk", "Unreadable or empty"]);

    for track in tracks {
        metadata.record(
            &track.id,
            &[
                track.title.trim().is_empty(),
                track.artist.trim().is_empty(),
                blank(&track.album),
                blank(&track.genre),
                track.year.is_none_or(|y| y <= 0),
                blank(&track.label),
            ],
        );
        tags.record(
            &track.id,
            &[
                blank(&track.genre),
                blank(&track.mood),
                track.energy.is_none(),
                !track.has_tags,
            ],
        );
        analysis.record(
            &track.id,
            &[
                track.bpm.is_none_or(|b| b <= 0.0),
                blank(&track.key),
                !track.has_beatgrid,
                !track
                    .analysis_status
                    .trim()
                    .eq_ignore_ascii_case("complete"),
            ],
        );
        files.record(
            &track.id,
            &[
                track.file == FileState::Missing,
                track.file == FileState::Unreadable,
            ],
        );
    }

    let duplicate_score = (total > 0).then(|| {
        let extras = context.duplicate_extras.min(total);
        100.0 * (total - extras) as f64 / total as f64
    });
    let mut duplicate_ids = context.duplicate_track_ids.clone();
    duplicate_ids.truncate(AFFECTED_CAP);

    let coverage_category = |index: usize, coverage: &Coverage, score: Option<f64>| {
        let (id, label, weight) = WEIGHTS[index];
        HealthCategory {
            id,
            label,
            weight,
            configured: true,
            score,
            counts: coverage.counts(),
            affected_ids: coverage.affected.clone(),
            affected_total: coverage.affected_total,
        }
    };
    let ratio_category = |index: usize, input: Option<&RatioInput>, label: &str| {
        let (id, name, weight) = WEIGHTS[index];
        let counts = input
            .map(|r| {
                vec![HealthCount {
                    label: label.to_string(),
                    count: r.total.saturating_sub(r.good),
                }]
            })
            .unwrap_or_default();
        HealthCategory {
            id,
            label: name,
            weight,
            configured: input.is_some(),
            score: ratio_score(input),
            counts,
            affected_ids: input.map_or_else(Vec::new, |r| {
                r.affected_ids.iter().take(AFFECTED_CAP).cloned().collect()
            }),
            affected_total: input.map_or(0, |r| r.total.saturating_sub(r.good)),
        }
    };

    let categories = vec![
        coverage_category(0, &metadata, metadata.score(total)),
        coverage_category(1, &tags, tags.score(total)),
        coverage_category(2, &analysis, analysis.score(total)),
        coverage_category(3, &files, files.track_score(total)),
        HealthCategory {
            id: WEIGHTS[4].0,
            label: WEIGHTS[4].1,
            weight: WEIGHTS[4].2,
            configured: true,
            score: duplicate_score,
            counts: vec![HealthCount {
                label: "Extra copies".to_string(),
                count: context.duplicate_extras,
            }],
            affected_ids: duplicate_ids,
            affected_total: context.duplicate_track_ids.len() as u64,
        },
        ratio_category(5, context.playlists.as_ref(), "Broken entries"),
        ratio_category(6, context.sync.as_ref(), "Unresolved conflicts"),
        ratio_category(7, context.backup.as_ref(), "Stale backups"),
    ];

    let (weighted, weights) = categories
        .iter()
        .filter_map(|c| c.score.map(|s| (s * c.weight as f64, c.weight as f64)))
        .fold((0.0, 0.0), |(a, b), (s, w)| (a + s, b + w));
    let score = (total > 0 && weights > 0.0).then(|| weighted / weights);

    HealthReport {
        score,
        track_count: total,
        categories,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn complete(id: &str) -> HealthTrack {
        HealthTrack {
            id: id.into(),
            title: "T".into(),
            artist: "A".into(),
            album: Some("Al".into()),
            genre: Some("House".into()),
            year: Some(2020),
            label: Some("L".into()),
            mood: Some("Dark".into()),
            energy: Some(7),
            has_tags: true,
            bpm: Some(124.0),
            key: Some("8A".into()),
            analysis_status: "complete".into(),
            has_beatgrid: true,
            file: FileState::Present,
        }
    }

    #[test]
    fn weights_are_the_locked_v1_set() {
        let w: Vec<u32> = WEIGHTS.iter().map(|(_, _, w)| *w).collect();
        assert_eq!(w, [20, 15, 15, 15, 10, 10, 10, 5]);
        assert_eq!(w.iter().sum::<u32>(), 100);
    }

    #[test]
    fn a_complete_library_scores_100_and_unconfigured_categories_are_neutral() {
        let report = compute_health(&[complete("a"), complete("b")], &HealthContext::default());
        assert_eq!(report.score, Some(100.0));
        let neutral: Vec<&str> = report
            .categories
            .iter()
            .filter(|c| c.score.is_none())
            .map(|c| c.id)
            .collect();
        assert_eq!(neutral, ["playlists", "sync", "backup"]);
    }

    #[test]
    fn an_empty_library_has_no_score() {
        let report = compute_health(&[], &HealthContext::default());
        assert_eq!(report.score, None);
        assert_eq!(report.track_count, 0);
        // Still configured: an empty library is not an unbuilt feature.
        let configured: Vec<&str> = report
            .categories
            .iter()
            .filter(|c| c.configured)
            .map(|c| c.id)
            .collect();
        assert_eq!(
            configured,
            ["metadata", "tags", "analysis", "files", "duplicates"]
        );
    }

    #[test]
    fn a_missing_or_unreadable_file_fails_the_track_once() {
        let mut missing = complete("b");
        missing.file = FileState::Missing;
        let mut unreadable = complete("c");
        unreadable.file = FileState::Unreadable;
        let report = compute_health(
            &[complete("a"), missing, unreadable, complete("d")],
            &HealthContext::default(),
        );
        let files = report.categories.iter().find(|c| c.id == "files").unwrap();
        assert_eq!(files.score, Some(50.0));
        assert_eq!(files.affected_ids, ["b", "c"]);
        let counts: Vec<u64> = files.counts.iter().map(|c| c.count).collect();
        assert_eq!(counts, [1, 1]);
    }

    #[test]
    fn a_track_without_a_beat_grid_lowers_analysis() {
        let mut gridless = complete("a");
        gridless.has_beatgrid = false;
        let report = compute_health(&[gridless], &HealthContext::default());
        let analysis = report
            .categories
            .iter()
            .find(|c| c.id == "analysis")
            .unwrap();
        assert_eq!(analysis.score, Some(75.0));
    }

    #[test]
    fn failing_categories_count_with_their_weight() {
        let mut missing = complete("b");
        missing.file = FileState::Missing;
        let report = compute_health(&[complete("a"), missing], &HealthContext::default());
        let files = report.categories.iter().find(|c| c.id == "files").unwrap();
        assert_eq!(files.score, Some(50.0));
        assert_eq!(files.affected_ids, ["b"]);
        // Measured weights sum to 75; only files is below 100: (60*100 + 15*50) / 75 = 90.
        assert!((report.score.unwrap() - 90.0).abs() < 1e-9);
    }

    #[test]
    fn coverage_counts_each_failing_field() {
        let mut bare = complete("a");
        bare.album = None;
        bare.label = Some("  ".into());
        let report = compute_health(&[bare], &HealthContext::default());
        let metadata = &report.categories[0];
        let missing: Vec<(&str, u64)> = metadata
            .counts
            .iter()
            .filter(|c| c.count > 0)
            .map(|c| (c.label.as_str(), c.count))
            .collect();
        assert_eq!(missing, [("Missing album", 1), ("Missing label", 1)]);
        let score = metadata.score.unwrap();
        assert!((score - 100.0 * 4.0 / 6.0).abs() < 1e-9);
        assert_eq!(metadata.affected_total, 1);
    }

    #[test]
    fn duplicate_extras_reduce_the_duplicate_score() {
        let context = HealthContext {
            duplicate_extras: 1,
            duplicate_track_ids: vec!["a".into(), "b".into()],
            ..HealthContext::default()
        };
        let tracks: Vec<HealthTrack> = ["a", "b", "c", "d"].iter().map(|i| complete(i)).collect();
        let report = compute_health(&tracks, &context);
        let dup = report
            .categories
            .iter()
            .find(|c| c.id == "duplicates")
            .unwrap();
        assert_eq!(dup.score, Some(75.0));
        assert_eq!(dup.affected_total, 2);
    }

    #[test]
    fn a_configured_ratio_category_counts() {
        let context = HealthContext {
            backup: Some(RatioInput {
                good: 0,
                total: 1,
                affected_ids: vec!["a".into()],
            }),
            ..HealthContext::default()
        };
        let report = compute_health(&[complete("a")], &context);
        let backup = report.categories.iter().find(|c| c.id == "backup").unwrap();
        assert!(backup.configured);
        assert_eq!(backup.affected_ids, ["a"]);
        // Backup joins the 75 measured: (75*100 + 5*0) / 80 = 93.75.
        assert!((report.score.unwrap() - 93.75).abs() < 1e-9);
    }
}
