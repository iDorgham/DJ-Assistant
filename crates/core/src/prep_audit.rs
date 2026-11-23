//! Prep Auditor (T2.3.4): a pre-gig readiness checklist over a set of tracks.
//!
//! Sets arrive in Phase 3, so today the auditor runs over the tracks the user
//! selected in the library (the crate they plan to play) or, with nothing
//! selected, the whole library. Each check is either a **blocker** — the track
//! cannot be played as prepared (its file is gone, it was never analysed) — or
//! a **warning** that is worth fixing before the gig but does not stop it.
//!
//! The checks the spec lists that need a set *order* (energy-curve gaps, a
//! vocal clash at position 7) are not part of this checklist yet: a selection
//! has no order to check.
//!
//! Pure: the caller reads the rows, checks the disk and groups duplicates over
//! the same scope; nothing here touches SQL or the filesystem.

use std::collections::{BTreeSet, HashMap};

use crate::library_health::FileState;
use crate::tag_clustering::{cluster_tags, TagValue};

/// Below this a beat grid is flagged. Matches the player chip's "low" tier
/// (`GRID_CONFIDENCE_LOW_THRESHOLD` in `apps/desktop/src/lib/grid-confidence.ts`).
pub const GRID_CONFIDENCE_LOW: f64 = 0.5;

/// How many failing track ids a check returns for drill-down.
pub const FAILING_CAP: usize = 500;

/// Cue counts per track: `(track_id, count)` over present tracks.
pub const CUE_COUNTS_SQL: &str = "SELECT c.track_id, COUNT(*) FROM cue_points c \
     JOIN tracks t ON t.id = c.track_id WHERE t.removed_at IS NULL GROUP BY c.track_id";

/// One track as the auditor reads it.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct PrepTrack {
    pub id: String,
    pub bpm: Option<f64>,
    pub key: Option<String>,
    pub analysis_status: String,
    /// The analysed grid's alignment ratio, `0..=1`; `None` before analysis.
    pub beatgrid_confidence: Option<f64>,
    pub cue_count: u32,
    /// Set by the caller after checking the disk.
    pub file: FileState,
}

/// Whether a failing check stops the gig or only deserves a look.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Blocker,
    Warning,
}

impl Severity {
    pub fn as_str(self) -> &'static str {
        match self {
            Severity::Blocker => "blocker",
            Severity::Warning => "warning",
        }
    }
}

/// The overall answer to "can I play this?".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    /// Every check passes.
    Ready,
    /// Only warnings fail.
    AlmostReady,
    /// At least one blocker fails.
    NotReady,
    /// Nothing to audit.
    Empty,
}

impl Verdict {
    pub fn as_str(self) -> &'static str {
        match self {
            Verdict::Ready => "ready",
            Verdict::AlmostReady => "almost_ready",
            Verdict::NotReady => "not_ready",
            Verdict::Empty => "empty",
        }
    }
}

/// One checklist row. A passing check is reported too (`failing_total == 0`),
/// so the checklist shows what was checked, not only what failed.
#[derive(Debug, Clone, PartialEq)]
pub struct PrepCheck {
    pub id: &'static str,
    pub label: &'static str,
    pub severity: Severity,
    /// What fixing it means, in the user's words.
    pub fix: &'static str,
    /// Failing track ids in scope order, capped at [`FAILING_CAP`].
    pub failing_ids: Vec<String>,
    pub failing_total: u64,
}

impl PrepCheck {
    pub fn passed(&self) -> bool {
        self.failing_total == 0
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PrepAudit {
    pub verdict: Verdict,
    pub track_count: u64,
    pub checks: Vec<PrepCheck>,
}

/// Everything besides the track rows, computed by the caller over the same
/// scope.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct PrepContext {
    /// Ids of tracks in an open duplicate group with another track in scope.
    pub duplicate_ids: BTreeSet<String>,
    /// Ids of tracks carrying a tag spelling that another track in scope
    /// spells differently ([`tag_clash_ids`]).
    pub tag_clash_ids: BTreeSet<String>,
}

fn blank(value: &Option<String>) -> bool {
    value.as_deref().is_none_or(|v| v.trim().is_empty())
}

/// Tracks whose tag the Tag Surgeon would rewrite: within the scope's tag
/// vocabulary, every track carrying a spelling other than its cluster's
/// canonical one.
pub fn tag_clash_ids(values: &[TagValue]) -> BTreeSet<String> {
    let by_raw: HashMap<&str, &[String]> = values
        .iter()
        .map(|v| (v.raw.as_str(), v.track_ids.as_slice()))
        .collect();
    let mut ids = BTreeSet::new();
    for cluster in cluster_tags(values).clusters {
        for member in &cluster.members {
            if member.raw == cluster.canonical {
                continue;
            }
            if let Some(tracks) = by_raw.get(member.raw.as_str()) {
                ids.extend(tracks.iter().cloned());
            }
        }
    }
    ids
}

struct Check {
    id: &'static str,
    label: &'static str,
    severity: Severity,
    fix: &'static str,
    failing: Vec<String>,
    total: u64,
}

impl Check {
    fn new(id: &'static str, label: &'static str, severity: Severity, fix: &'static str) -> Self {
        Check {
            id,
            label,
            severity,
            fix,
            failing: Vec::new(),
            total: 0,
        }
    }

    fn record(&mut self, id: &str, failed: bool) {
        if failed {
            self.total += 1;
            if self.failing.len() < FAILING_CAP {
                self.failing.push(id.to_string());
            }
        }
    }

    fn finish(self) -> PrepCheck {
        PrepCheck {
            id: self.id,
            label: self.label,
            severity: self.severity,
            fix: self.fix,
            failing_ids: self.failing,
            failing_total: self.total,
        }
    }
}

/// Runs the checklist.
pub fn audit(tracks: &[PrepTrack], context: &PrepContext) -> PrepAudit {
    let mut files = Check::new(
        "files",
        "File missing or unreadable",
        Severity::Blocker,
        "Relink the track or rescan its folder",
    );
    let mut analysis = Check::new(
        "analysis",
        "Not analyzed (BPM, key or analysis incomplete)",
        Severity::Blocker,
        "Analyze these tracks",
    );
    let mut beatgrid = Check::new(
        "beatgrid",
        "Low beat-grid confidence",
        Severity::Warning,
        "Check the grid against the downbeat",
    );
    let mut cues = Check::new("cues", "No cue points", Severity::Warning, "Set cue points");
    let mut tags = Check::new(
        "tags",
        "Tag spelled differently on other tracks",
        Severity::Warning,
        "Tidy the spellings in Tag Surgeon",
    );
    let mut duplicates = Check::new(
        "duplicates",
        "Duplicate of another track here",
        Severity::Warning,
        "Keep one copy in Duplicates",
    );

    for track in tracks {
        let id = track.id.as_str();
        files.record(id, track.file != FileState::Present);
        analysis.record(
            id,
            track.bpm.is_none_or(|b| b <= 0.0)
                || blank(&track.key)
                || !track
                    .analysis_status
                    .trim()
                    .eq_ignore_ascii_case("complete"),
        );
        beatgrid.record(
            id,
            track
                .beatgrid_confidence
                .is_some_and(|c| c.is_finite() && c < GRID_CONFIDENCE_LOW),
        );
        cues.record(id, track.cue_count == 0);
        tags.record(id, context.tag_clash_ids.contains(id));
        duplicates.record(id, context.duplicate_ids.contains(id));
    }

    let checks: Vec<PrepCheck> = [files, analysis, beatgrid, cues, tags, duplicates]
        .into_iter()
        .map(Check::finish)
        .collect();
    let verdict = if tracks.is_empty() {
        Verdict::Empty
    } else if checks
        .iter()
        .any(|c| c.severity == Severity::Blocker && !c.passed())
    {
        Verdict::NotReady
    } else if checks.iter().any(|c| !c.passed()) {
        Verdict::AlmostReady
    } else {
        Verdict::Ready
    };
    PrepAudit {
        verdict,
        track_count: tracks.len() as u64,
        checks,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ready(id: &str) -> PrepTrack {
        PrepTrack {
            id: id.into(),
            bpm: Some(124.0),
            key: Some("8A".into()),
            analysis_status: "complete".into(),
            beatgrid_confidence: Some(0.9),
            cue_count: 4,
            file: FileState::Present,
        }
    }

    fn check<'a>(audit: &'a PrepAudit, id: &str) -> &'a PrepCheck {
        audit
            .checks
            .iter()
            .find(|c| c.id == id)
            .expect("check exists")
    }

    #[test]
    fn a_prepared_crate_is_ready_and_every_check_is_listed() {
        let report = audit(&[ready("a"), ready("b")], &PrepContext::default());
        assert_eq!(report.verdict, Verdict::Ready);
        assert_eq!(report.track_count, 2);
        let ids: Vec<_> = report.checks.iter().map(|c| c.id).collect();
        assert_eq!(
            ids,
            [
                "files",
                "analysis",
                "beatgrid",
                "cues",
                "tags",
                "duplicates"
            ]
        );
        assert!(report.checks.iter().all(PrepCheck::passed));
    }

    #[test]
    fn nothing_selected_is_empty_not_ready() {
        let report = audit(&[], &PrepContext::default());
        assert_eq!(report.verdict, Verdict::Empty);
    }

    #[test]
    fn a_missing_file_or_missing_analysis_blocks() {
        let mut gone = ready("gone");
        gone.file = FileState::Missing;
        let mut broken = ready("broken");
        broken.file = FileState::Unreadable;
        let mut raw = ready("raw");
        raw.analysis_status = "pending".into();
        let mut keyless = ready("keyless");
        keyless.key = Some("  ".into());
        let report = audit(
            &[gone, broken, raw, keyless, ready("ok")],
            &PrepContext::default(),
        );
        assert_eq!(report.verdict, Verdict::NotReady);
        assert_eq!(check(&report, "files").failing_ids, ["gone", "broken"]);
        assert_eq!(check(&report, "analysis").failing_ids, ["raw", "keyless"]);
        assert_eq!(check(&report, "files").severity, Severity::Blocker);
    }

    #[test]
    fn warnings_alone_make_it_almost_ready() {
        let mut shaky = ready("shaky");
        shaky.beatgrid_confidence = Some(0.3);
        let mut bare = ready("bare");
        bare.cue_count = 0;
        let context = PrepContext {
            duplicate_ids: ["dup".to_string()].into(),
            tag_clash_ids: ["clash".to_string()].into(),
        };
        let report = audit(&[shaky, bare, ready("dup"), ready("clash")], &context);
        assert_eq!(report.verdict, Verdict::AlmostReady);
        assert_eq!(check(&report, "beatgrid").failing_ids, ["shaky"]);
        assert_eq!(check(&report, "cues").failing_ids, ["bare"]);
        assert_eq!(check(&report, "duplicates").failing_ids, ["dup"]);
        assert_eq!(check(&report, "tags").failing_ids, ["clash"]);
    }

    #[test]
    fn an_unknown_grid_confidence_is_not_flagged_as_low() {
        let mut unknown = ready("u");
        unknown.beatgrid_confidence = None;
        let mut edge = ready("edge");
        edge.beatgrid_confidence = Some(GRID_CONFIDENCE_LOW);
        let report = audit(&[unknown, edge], &PrepContext::default());
        assert!(check(&report, "beatgrid").passed());
    }

    #[test]
    fn failing_ids_are_capped_but_the_total_is_not() {
        let tracks: Vec<_> = (0..FAILING_CAP + 3)
            .map(|i| {
                let mut t = ready(&format!("t{i}"));
                t.cue_count = 0;
                t
            })
            .collect();
        let report = audit(&tracks, &PrepContext::default());
        let cues = check(&report, "cues");
        assert_eq!(cues.failing_ids.len(), FAILING_CAP);
        assert_eq!(cues.failing_total, (FAILING_CAP + 3) as u64);
    }

    #[test]
    fn tag_clashes_are_the_tracks_off_the_canonical_spelling() {
        let values = vec![
            TagValue {
                raw: "deep house".into(),
                track_ids: vec!["a".into(), "b".into(), "c".into()],
            },
            TagValue {
                raw: "Deep  House".into(),
                track_ids: vec!["d".into()],
            },
            TagValue {
                raw: "déep house".into(),
                track_ids: vec!["e".into()],
            },
            TagValue {
                raw: "techno".into(),
                track_ids: vec!["f".into()],
            },
        ];
        // "deep house" is the canonical spelling; the other two are rewritten.
        let ids = tag_clash_ids(&values);
        assert_eq!(ids, ["d".to_string(), "e".to_string()].into());
    }

    #[test]
    fn cue_counts_skip_removed_tracks() {
        assert!(CUE_COUNTS_SQL.contains("removed_at IS NULL"));
    }
}
