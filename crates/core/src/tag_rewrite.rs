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
use crate::library_writes::{rewrite_tags_statements, PlannedTrackWrite};
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

#[cfg(test)]
mod tests {
    use super::{
        plan_tag_rewrite, renames_from_report, rewritten_tags, tag_rewrite_skill_run,
        validate_renames, TagRename,
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
}
