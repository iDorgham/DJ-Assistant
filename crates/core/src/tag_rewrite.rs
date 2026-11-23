//! The Tag Surgeon's reversible bulk apply (T2.2.4).
//!
//! Pure planning, like [`crate::library_writes`]: this module decides what a
//! confirmed set of spelling renames does to each track's tag set and returns
//! the statements and the undo snapshot. The desktop layer executes them in one
//! transaction and never decides anything itself.
//!
//! The rules the module exists to keep:
//!
//! * **Only the confirmed renames are applied.** A rename maps one stored
//!   spelling to the canonical spelling the preview showed, and nothing else.
//!   A rename whose two sides do not fold to the same key is refused: the
//!   engine never invents an equivalence the user did not see.
//! * **The canonical spelling is stored as given.** Unlike the editor's write
//!   path, the apply does not lower-case tags, so "Melodic House" stays
//!   "Melodic House" — the spelling the preview promised.
//! * **A track whose tag set would not change is not written, counted or
//!   snapshotted**, the same rule the metadata write follows.
//! * **Every apply is undoable.** The snapshot is `{ track: { tags: [...] } }`
//!   in the shape [`crate::library_writes::plan_metadata_undo`] already
//!   restores, so the undo guard (a newer tag edit is never overwritten) is
//!   shared rather than re-implemented.

use std::collections::{BTreeMap, BTreeSet};

use crate::library_remove::{skill_run_insert, SkillRun, Statement};
use crate::library_writes::{plan_metadata_undo, rewrite_tags_statements, PlannedTrackWrite};
use crate::patch::TAG_REWRITE_SKILL_NAME;
use crate::tag_clustering::{normalize_tag, ClusterReport};

/// One confirmed spelling rewrite: every track carrying `from` gets `to`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TagRename {
    pub from: String,
    pub to: String,
}

/// Collapses internal whitespace and trims, the form a canonical spelling has.
fn collapsed(raw: &str) -> String {
    raw.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Checks the confirmed renames and returns them as a `from → to` map.
///
/// Refused: an empty list, a blank side, a rename that changes nothing, a
/// target that is not in canonical form, a pair whose fold keys differ, two
/// renames that send one spelling to two places, and a chain (a target that is
/// itself renamed) — a single pass would otherwise apply only half of it.
pub fn validate_renames(renames: &[TagRename]) -> Result<BTreeMap<String, String>, String> {
    if renames.is_empty() {
        return Err("no spellings to rewrite".to_string());
    }
    let mut map: BTreeMap<String, String> = BTreeMap::new();
    for rename in renames {
        if rename.from.trim().is_empty() || rename.to.trim().is_empty() {
            return Err("a tag spelling cannot be blank".to_string());
        }
        if rename.from == rename.to {
            return Err(format!("\"{}\" already has that spelling", rename.from));
        }
        if rename.to != collapsed(&rename.to) {
            return Err(format!(
                "\"{}\" must be trimmed and single-spaced",
                rename.to
            ));
        }
        if rename.to != rename.to.to_ascii_lowercase() {
            return Err(format!(
                "\"{}\" must be lowercase, as the tag editor saves it",
                rename.to
            ));
        }
        if normalize_tag(&rename.from) != normalize_tag(&rename.to) {
            return Err(format!(
                "\"{}\" is not another spelling of \"{}\"",
                rename.from, rename.to
            ));
        }
        match map.get(&rename.from) {
            Some(existing) if *existing != rename.to => {
                return Err(format!(
                    "\"{}\" is renamed to both \"{}\" and \"{}\"",
                    rename.from, existing, rename.to
                ));
            }
            _ => {
                map.insert(rename.from.clone(), rename.to.clone());
            }
        }
    }
    for target in map.values() {
        if map.get(target).is_some_and(|next| next != target) {
            return Err(format!("\"{target}\" is both a target and a rename source"));
        }
    }
    Ok(map)
}

/// The renames a scan implies: every spelling of a cluster other than its
/// canonical one becomes the canonical one. This is what the preview shows, so
/// applying it applies exactly what the user looked at.
pub fn renames_from_report(report: &ClusterReport) -> Vec<TagRename> {
    report
        .clusters
        .iter()
        .flat_map(|cluster| {
            cluster
                .members
                .iter()
                .filter(|member| member.raw != cluster.canonical)
                .map(|member| TagRename {
                    from: member.raw.clone(),
                    to: cluster.canonical.clone(),
                })
        })
        .collect()
}

/// A track's tag set after the renames: each tag mapped, duplicates merged,
/// sorted. Exact bytes throughout — no case or whitespace folding.
pub fn rewritten_tags(current: &[String], map: &BTreeMap<String, String>) -> Vec<String> {
    current
        .iter()
        .map(|tag| map.get(tag).cloned().unwrap_or_else(|| tag.clone()))
        .collect::<BTreeSet<String>>()
        .into_iter()
        .collect()
}

/// Plans the tag rewrites for the tracks that carry tags.
///
/// `tracks` holds `(track_id, current tags)` for each track the selection
/// names. A track whose set does not change produces no entry.
pub fn plan_tag_rewrite(
    tracks: &[(String, Vec<String>)],
    map: &BTreeMap<String, String>,
) -> Vec<PlannedTrackWrite> {
    let mut planned = Vec::new();
    for (track_id, current) in tracks {
        let previous: Vec<String> = current
            .iter()
            .cloned()
            .collect::<BTreeSet<String>>()
            .into_iter()
            .collect();
        let next = rewritten_tags(&previous, map);
        if next == previous {
            continue;
        }
        let as_array = |tags: &[String]| {
            serde_json::Value::Array(
                tags.iter()
                    .map(|tag| serde_json::Value::from(tag.clone()))
                    .collect(),
            )
        };
        let mut before = serde_json::Map::new();
        before.insert("tags".to_string(), as_array(&previous));
        let mut after = serde_json::Map::new();
        after.insert("tags".to_string(), as_array(&next));
        planned.push(PlannedTrackWrite {
            track_id: track_id.clone(),
            update: None,
            tag_statements: rewrite_tags_statements(track_id, &next),
            before,
            after,
        });
    }
    planned
}

/// The `skill_runs` row that makes the apply undoable. Its input summary
/// records what was asked — the scope and the renames — and the before/after
/// states hold the per-track truth.
pub fn tag_rewrite_skill_run(
    undo_id: &str,
    track_ids: &[String],
    renames: &[TagRename],
    before: serde_json::Map<String, serde_json::Value>,
    after: serde_json::Map<String, serde_json::Value>,
) -> Statement {
    let input = serde_json::json!({
        "trackIds": track_ids,
        "renames": renames
            .iter()
            .map(|rename| serde_json::json!({ "from": rename.from, "to": rename.to }))
            .collect::<Vec<_>>(),
    });
    skill_run_insert(&SkillRun {
        id: undo_id.to_string(),
        workspace_id: "default".to_string(),
        skill_name: TAG_REWRITE_SKILL_NAME,
        before_state: serde_json::Value::Object(before).to_string(),
        after_state: serde_json::Value::Object(after).to_string(),
        input_summary: input.to_string(),
    })
}

/// How many past applies the history list shows (T2.2.6).
pub const TAG_HISTORY_LIMIT: i64 = 50;

/// The Tag Surgeon's past applies, newest first (T2.2.6). `?1` is
/// [`TAG_REWRITE_SKILL_NAME`], `?2` the row limit. Only rows this path writes
/// (`success`) or its undo leaves (`undone`) are listed; `rowid` breaks ties
/// between applies stamped in the same second.
pub const TAG_HISTORY_SQL: &str =
    "SELECT id, status, input_summary, before_state, after_state, created_at \
     FROM skill_runs \
     WHERE skill_name = ?1 AND status IN ('success', 'undone') \
     ORDER BY created_at DESC, rowid DESC \
     LIMIT ?2";

/// One past apply, as the history list shows it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TagHistoryEntry {
    /// The `skill_runs` id — the same id the metadata undo takes.
    pub undo_id: String,
    /// SQLite `datetime('now')`: UTC, `YYYY-MM-DD HH:MM:SS`.
    pub created_at: String,
    /// The apply was already undone, so it cannot be undone again.
    pub undone: bool,
    /// The spellings the apply rewrote, in the order they were confirmed.
    pub renames: Vec<TagRename>,
    /// The tracks whose tag set the apply changed.
    pub track_count: usize,
}

/// Reads one history row. The row is written only by
/// [`tag_rewrite_skill_run`], so a summary or snapshot that does not parse is
/// a damaged row and is reported, not shown as an empty apply.
///
/// The snapshot pair must have exactly the shape the writer leaves: the same
/// non-empty set of tracks on both sides, each `{ "tags": [string, …] }`. That
/// is stricter than [`plan_metadata_undo`], which reads a missing `tags` as an
/// empty set: a damaged after-state would then become a guard that matches any
/// tagless track, and Undo could restore over a later edit. Such a row is
/// reported here instead of being offered an Undo. The pair is then planned
/// with [`plan_metadata_undo`] too, the same plan the Undo button runs. An
/// empty renames list is damage as well: [`validate_renames`] refuses one.
pub fn parse_tag_history_entry(
    undo_id: &str,
    status: &str,
    input_summary: Option<&str>,
    before_state: Option<&str>,
    after_state: Option<&str>,
    created_at: &str,
) -> Result<TagHistoryEntry, String> {
    let damaged = |what: &str| format!("tag history {undo_id}: {what}");
    let undone = match status {
        "success" => false,
        "undone" => true,
        other => return Err(damaged(&format!("unexpected status {other:?}"))),
    };
    let input: serde_json::Value =
        serde_json::from_str(input_summary.ok_or_else(|| damaged("no input summary"))?)
            .map_err(|_| damaged("input summary is not JSON"))?;
    let renames = input
        .get("renames")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| damaged("input summary has no renames"))?
        .iter()
        .map(|item| {
            let side = |key: &str| item.get(key).and_then(serde_json::Value::as_str);
            match (side("from"), side("to")) {
                (Some(from), Some(to)) => Ok(TagRename {
                    from: from.to_string(),
                    to: to.to_string(),
                }),
                _ => Err(damaged("a rename is missing a side")),
            }
        })
        .collect::<Result<Vec<_>, _>>()?;
    if renames.is_empty() {
        return Err(damaged("input summary names no renames"));
    }
    let snapshot = |raw: Option<&str>, side: &str| -> Result<serde_json::Value, String> {
        let value: serde_json::Value =
            serde_json::from_str(raw.ok_or_else(|| damaged(&format!("no {side} snapshot")))?)
                .map_err(|_| damaged(&format!("{side} snapshot is not JSON")))?;
        let tracks = value
            .as_object()
            .ok_or_else(|| damaged(&format!("{side} snapshot is not a track map")))?;
        for (track_id, entry) in tracks {
            let tag_set = entry
                .as_object()
                .filter(|fields| fields.len() == 1)
                .and_then(|fields| fields.get("tags"))
                .and_then(serde_json::Value::as_array);
            let well_formed = tag_set.is_some_and(|tags| tags.iter().all(|tag| tag.is_string()));
            if !well_formed {
                return Err(damaged(&format!(
                    "{side} snapshot for track {track_id} is not a tag set"
                )));
            }
        }
        Ok(value)
    };
    let before = snapshot(before_state, "before")?;
    let after = snapshot(after_state, "after")?;
    let (before_tracks, after_tracks) = (
        before
            .as_object()
            .map(|m| m.keys().collect::<BTreeSet<_>>()),
        after.as_object().map(|m| m.keys().collect::<BTreeSet<_>>()),
    );
    if before_tracks != after_tracks {
        return Err(damaged("before and after snapshots name different tracks"));
    }
    let track_count = after_tracks.map_or(0, |tracks| tracks.len());
    if track_count == 0 {
        return Err(damaged("snapshot names no tracks"));
    }
    plan_metadata_undo(&before, &after)
        .map_err(|reason| damaged(&format!("snapshot cannot be undone: {reason}")))?;
    Ok(TagHistoryEntry {
        undo_id: undo_id.to_string(),
        created_at: created_at.to_string(),
        undone,
        renames,
        track_count,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        parse_tag_history_entry, plan_tag_rewrite, renames_from_report, rewritten_tags,
        tag_rewrite_skill_run, validate_renames, TagRename,
    };
    use crate::library_writes::{plan_metadata_undo, WriteValue};
    use crate::tag_clustering::{cluster_tags, TagValue};

    fn rename(from: &str, to: &str) -> TagRename {
        TagRename {
            from: from.to_string(),
            to: to.to_string(),
        }
    }

    fn map(pairs: &[(&str, &str)]) -> std::collections::BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(from, to)| (from.to_string(), to.to_string()))
            .collect()
    }

    fn tags(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn a_valid_rename_becomes_a_map_entry() {
        let out = validate_renames(&[rename("Melodic House ", "melodic house")]).unwrap();
        assert_eq!(
            out.get("Melodic House "),
            Some(&"melodic house".to_string())
        );
    }

    #[test]
    fn invalid_renames_are_refused_before_anything_is_planned() {
        assert!(validate_renames(&[]).is_err());
        assert!(validate_renames(&[rename("  ", "House")]).is_err());
        assert!(validate_renames(&[rename("House", "House")]).is_err());
        // Not a spelling of the same key: never an invented equivalence.
        assert!(validate_renames(&[rename("Techno", "Trance")]).is_err());
        // The target must already be canonical: no hidden trimming.
        assert!(validate_renames(&[rename("house", " House ")]).is_err());
        assert!(validate_renames(&[rename("melodic house", "Melodic  House")]).is_err());
    }

    #[test]
    fn one_source_cannot_go_to_two_targets_and_no_chains() {
        // Two different lowercase targets for one source ("hôuse" folds alike).
        assert!(
            validate_renames(&[rename("House", "house"), rename("House", "h\u{f4}use")]).is_err()
        );
        // "House" → "house" while "house" → "hôuse" would apply only half.
        assert!(
            validate_renames(&[rename("House", "house"), rename("house", "h\u{f4}use")]).is_err()
        );
        // The same pair twice is harmless.
        assert!(validate_renames(&[rename("House", "house"), rename("House", "house")]).is_ok());
    }

    #[test]
    fn rewritten_tags_merge_duplicates_and_keep_exact_bytes() {
        let out = rewritten_tags(
            &tags(&["House", "house", "peak"]),
            &map(&[("house", "House")]),
        );
        assert_eq!(out, tags(&["House", "peak"]));
    }

    #[test]
    fn a_track_whose_tags_would_not_change_is_not_planned() {
        let planned = plan_tag_rewrite(
            &[
                ("t1".to_string(), tags(&["House", "peak"])),
                ("t2".to_string(), tags(&["house", "peak"])),
            ],
            &map(&[("house", "House")]),
        );
        assert_eq!(planned.len(), 1);
        assert_eq!(planned[0].track_id, "t2");
        assert!(planned[0].update.is_none());
        assert_eq!(
            planned[0].before.get("tags"),
            Some(&serde_json::json!(["house", "peak"]))
        );
        assert_eq!(
            planned[0].after.get("tags"),
            Some(&serde_json::json!(["House", "peak"]))
        );
    }

    #[test]
    fn a_whitespace_only_variant_is_rewritten() {
        // "house " and "house" are different stored bytes: the first must move.
        let planned = plan_tag_rewrite(
            &[("t1".to_string(), tags(&["house "]))],
            &map(&[("house ", "house")]),
        );
        assert_eq!(planned.len(), 1);
    }

    #[test]
    fn renames_from_a_scan_map_every_non_canonical_spelling() {
        let report = cluster_tags(&[
            TagValue {
                raw: "House".to_string(),
                track_ids: tags(&["t1", "t2"]),
            },
            TagValue {
                raw: "house".to_string(),
                track_ids: tags(&["t3"]),
            },
            TagValue {
                raw: "HOUSE".to_string(),
                track_ids: tags(&["t4"]),
            },
        ]);
        let renames = renames_from_report(&report);
        assert_eq!(
            renames,
            vec![rename("House", "house"), rename("HOUSE", "house")]
        );
        assert!(validate_renames(&renames).is_ok());
    }

    #[test]
    fn the_snapshot_is_restored_by_the_metadata_undo_with_its_guard() {
        // Apply, then check the undo the shared metadata path plans from the
        // very snapshot the apply records.
        let renames = [rename("House", "house")];
        let map = validate_renames(&renames).unwrap();
        let planned = plan_tag_rewrite(&[("t1".to_string(), tags(&["House", "peak"]))], &map);
        let before: serde_json::Map<String, serde_json::Value> = planned
            .iter()
            .map(|p| {
                (
                    p.track_id.clone(),
                    serde_json::Value::Object(p.before.clone()),
                )
            })
            .collect();
        let after: serde_json::Map<String, serde_json::Value> = planned
            .iter()
            .map(|p| {
                (
                    p.track_id.clone(),
                    serde_json::Value::Object(p.after.clone()),
                )
            })
            .collect();
        let run = tag_rewrite_skill_run(
            "u1",
            &tags(&["t1"]),
            &renames,
            before.clone(),
            after.clone(),
        );
        assert!(run.params.iter().any(|p| p == "tag_surgeon_apply"));

        let restores = plan_metadata_undo(
            &serde_json::Value::Object(before),
            &serde_json::Value::Object(after),
        )
        .unwrap();
        assert_eq!(restores.len(), 1);
        assert_eq!(restores[0].expected_tags, Some(tags(&["house", "peak"])));
        assert!(restores[0].restore.is_none());
        assert_eq!(
            restores[0].tag_statements[0].params[0],
            WriteValue::Text("t1".to_string())
        );
    }

    #[test]
    fn a_written_apply_reads_back_as_its_history_entry() {
        let renames = [
            rename("Melodic House ", "melodic house"),
            rename("TECHNO", "techno"),
        ];
        let mut before = serde_json::Map::new();
        let mut after = serde_json::Map::new();
        for id in ["t1", "t2", "t3"] {
            before.insert(
                id.to_string(),
                serde_json::json!({ "tags": ["Melodic House "] }),
            );
            after.insert(
                id.to_string(),
                serde_json::json!({ "tags": ["melodic house"] }),
            );
        }
        let run = tag_rewrite_skill_run(
            "u1",
            &tags(&["t1", "t2", "t3", "t4"]),
            &renames,
            before,
            after,
        );
        // Bound in skill_run_insert order: id, workspace, skill, input, before, after.
        let entry = parse_tag_history_entry(
            &run.params[0],
            "success",
            Some(&run.params[3]),
            Some(&run.params[4]),
            Some(&run.params[5]),
            "2026-11-22 10:15:00",
        )
        .unwrap();
        assert_eq!(entry.undo_id, "u1");
        assert!(!entry.undone);
        assert_eq!(entry.renames, renames.to_vec());
        // Changed tracks come from the snapshot, not the scanned scope.
        assert_eq!(entry.track_count, 3);
        assert_eq!(entry.created_at, "2026-11-22 10:15:00");
    }

    #[test]
    fn an_undone_apply_is_marked_undone() {
        let entry = parse_tag_history_entry(
            "u2",
            "undone",
            Some(r#"{"trackIds":["t1"],"renames":[{"from":"A","to":"a"}]}"#),
            Some(r#"{"t1":{"tags":["A"]}}"#),
            Some(r#"{"t1":{"tags":["a"]}}"#),
            "2026-11-22 10:16:00",
        )
        .unwrap();
        assert!(entry.undone);
        assert_eq!(entry.track_count, 1);
    }

    #[test]
    fn a_damaged_history_row_is_reported_not_shown_empty() {
        let input = Some(r#"{"renames":[{"from":"A","to":"a"}]}"#);
        let before = Some(r#"{"t1":{"tags":["A"]}}"#);
        let after = Some(r#"{"t1":{"tags":["a"]}}"#);
        let parse = |status, input, before, after| {
            parse_tag_history_entry("u3", status, input, before, after, "x")
        };
        assert!(parse("success", input, before, after).is_ok());
        assert!(parse("failed", input, before, after).is_err());
        assert!(parse("success", None, before, after).is_err());
        assert!(parse("success", Some("not json"), before, after).is_err());
        assert!(parse("success", Some(r#"{"trackIds":[]}"#), before, after).is_err());
        assert!(parse(
            "success",
            Some(r#"{"renames":[{"from":"A"}]}"#),
            before,
            after
        )
        .is_err());
        assert!(parse("success", input, before, None).is_err());
        assert!(parse("success", input, before, Some("[]")).is_err());
        let message = parse("success", None, before, after).unwrap_err();
        assert!(message.contains("u3"), "{message}");
    }

    #[test]
    fn an_empty_snapshot_is_damage_not_an_empty_apply() {
        let input = Some(r#"{"renames":[{"from":"A","to":"a"}]}"#);
        let message = parse_tag_history_entry("u4", "success", input, Some("{}"), Some("{}"), "x")
            .unwrap_err();
        assert!(message.contains("no tracks"), "{message}");
    }

    #[test]
    fn a_snapshot_the_undo_cannot_read_is_not_listed_as_undoable() {
        let input = Some(r#"{"renames":[{"from":"A","to":"a"}]}"#);
        let after = Some(r#"{"t1":{"tags":["a"]}}"#);
        // Each of these makes undo_track_metadata fail before it restores anything:
        // a missing column, text that is not JSON, and JSON that is not a track map.
        for before in [None, Some("not json"), Some("[]"), Some(r#"{"t1":"A"}"#)] {
            assert!(
                parse_tag_history_entry("u5", "success", input, before, after, "x").is_err(),
                "before = {before:?}"
            );
        }
    }

    #[test]
    fn an_apply_with_no_renames_is_damage() {
        let message = parse_tag_history_entry(
            "u6",
            "success",
            Some(r#"{"trackIds":["t1"],"renames":[]}"#),
            Some(r#"{"t1":{"tags":["A"]}}"#),
            Some(r#"{"t1":{"tags":["a"]}}"#),
            "x",
        )
        .unwrap_err();
        assert!(message.contains("no renames"), "{message}");
    }

    #[test]
    fn a_snapshot_that_would_fabricate_an_undo_guard_is_not_listed() {
        let input = Some(r#"{"renames":[{"from":"A","to":"a"}]}"#);
        let good = r#"{"t1":{"tags":["a"]}}"#;
        // plan_metadata_undo reads each of these after-states as an empty tag
        // set, which would match any tagless track; or the two sides name
        // different tracks. None may be offered an Undo.
        let damaged_pairs = [
            (r#"{"t1":{"tags":["A"]}}"#, r#"{"t1":{}}"#),
            (r#"{"t1":{"tags":["A"]}}"#, r#"{"t1":{"tags":"a"}}"#),
            (r#"{"t1":{"tags":["A"]}}"#, r#"{"t1":{"tags":[1]}}"#),
            (
                r#"{"t1":{"tags":["A"]}}"#,
                r#"{"t1":{"tags":["a"],"rating":3}}"#,
            ),
            (r#"{"t1":{}}"#, good),
            (r#"{"t2":{"tags":["A"]}}"#, good),
            (r#"{"t1":{"tags":["A"]},"t2":{"tags":["B"]}}"#, good),
        ];
        for (before, after) in damaged_pairs {
            assert!(
                parse_tag_history_entry("u7", "success", input, Some(before), Some(after), "x")
                    .is_err(),
                "before = {before}, after = {after}"
            );
        }
        // An empty tag set is a real outcome, not damage.
        assert!(parse_tag_history_entry(
            "u8",
            "success",
            input,
            Some(r#"{"t1":{"tags":["A"]}}"#),
            Some(r#"{"t1":{"tags":[]}}"#),
            "x"
        )
        .is_ok());
    }
}
