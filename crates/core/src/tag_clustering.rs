//! The Tag Surgeon's clustering engine (T2.2.1): fold, cluster, prefix edge.
//!
//! Pure algorithm — no SQL, no Tauri, no I/O. The contract lives in
//! `docs/superpowers/specs/2026-11-19-tag-surgeon-fuzzy-clustering-design.md`.

use unicode_normalization::UnicodeNormalization;

/// The fold key of a tag spelling: lowercase, accent-stripped, punctuation
/// turned into separators, whitespace collapsed. Idempotent by contract.
pub fn normalize_tag(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.to_lowercase().nfd() {
        if unicode_normalization::char::is_combining_mark(c) {
            continue;
        }
        out.push(if c.is_alphanumeric() { c } else { ' ' });
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// One raw spelling of a tag and the ids of the tracks carrying it. Ids, not
/// a count: a cluster's affected-track total is the union of its members.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TagValue {
    pub raw: String,
    pub track_ids: Vec<String>,
}

/// One spelling inside a cluster, with how many tracks carry it.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterMember {
    pub raw: String,
    pub track_count: usize,
}

/// Two or more spellings sharing one non-empty fold key.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpellingCluster {
    pub key: String,
    pub members: Vec<ClusterMember>,
    pub distinct_track_count: usize,
}

/// An advisory whole-word prefix relation between two different keys. Never
/// merges a cluster; carries displayable labels because its sides may be
/// singletons that appear in no cluster.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrefixEdge {
    pub narrower_key: String,
    pub narrower_label: String,
    pub narrower_tracks: usize,
    pub broader_key: String,
    pub broader_label: String,
    pub broader_tracks: usize,
    pub shared_prefix: String,
}

/// The read-only scan result. Deterministic: the same vocabulary serializes
/// byte-identically regardless of input row order.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterReport {
    pub scanned_tags: usize,
    pub ignored_tags: usize,
    pub clusters: Vec<SpellingCluster>,
    pub prefix_edges: Vec<PrefixEdge>,
}

/// The spelling a key is displayed as: most tracks, ties to the byte-smallest
/// raw. Members sort by the same rule, so `members[0]` is the representative.
fn representative<'a>(spellings: &[&'a TagValue]) -> &'a TagValue {
    spellings
        .iter()
        .copied()
        .max_by(|a, b| {
            a.track_ids
                .len()
                .cmp(&b.track_ids.len())
                .then_with(|| b.raw.cmp(&a.raw))
        })
        .expect("a fold bucket is never empty")
}

/// Folds the vocabulary into spelling clusters and advisory prefix edges.
/// Writes nothing; empty-key spellings are counted as ignored, never merged.
pub fn cluster_tags(values: &[TagValue]) -> ClusterReport {
    let mut buckets: std::collections::BTreeMap<String, Vec<&TagValue>> =
        std::collections::BTreeMap::new();
    let mut ignored_tags = 0usize;
    for value in values {
        let key = normalize_tag(&value.raw);
        if key.is_empty() {
            ignored_tags += 1;
            continue;
        }
        buckets.entry(key).or_default().push(value);
    }

    let mut clusters: Vec<SpellingCluster> = Vec::new();
    for (key, spellings) in &buckets {
        if spellings.len() < 2 {
            continue;
        }
        let mut members: Vec<ClusterMember> = spellings
            .iter()
            .map(|value| ClusterMember {
                raw: value.raw.clone(),
                track_count: value.track_ids.len(),
            })
            .collect();
        members.sort_by(|a, b| {
            b.track_count
                .cmp(&a.track_count)
                .then_with(|| a.raw.cmp(&b.raw))
        });
        let union: std::collections::BTreeSet<&str> = spellings
            .iter()
            .flat_map(|value| value.track_ids.iter().map(String::as_str))
            .collect();
        clusters.push(SpellingCluster {
            key: key.clone(),
            members,
            distinct_track_count: union.len(),
        });
    }
    clusters.sort_by(|a, b| {
        b.distinct_track_count
            .cmp(&a.distinct_track_count)
            .then_with(|| a.key.cmp(&b.key))
    });

    let keys: Vec<&String> = buckets.keys().collect();
    let mut prefix_edges: Vec<PrefixEdge> = Vec::new();
    for narrower in &keys {
        if narrower.chars().count() < 3 {
            continue;
        }
        let with_boundary = format!("{narrower} ");
        for broader in &keys {
            if narrower == broader || !broader.starts_with(&with_boundary) {
                continue;
            }
            let narrower_rep = representative(&buckets[*narrower]);
            let broader_rep = representative(&buckets[*broader]);
            prefix_edges.push(PrefixEdge {
                narrower_key: (*narrower).clone(),
                narrower_label: narrower_rep.raw.clone(),
                narrower_tracks: narrower_rep.track_ids.len(),
                broader_key: (*broader).clone(),
                broader_label: broader_rep.raw.clone(),
                broader_tracks: broader_rep.track_ids.len(),
                shared_prefix: (*narrower).clone(),
            });
        }
    }
    prefix_edges.sort_by(|a, b| {
        b.narrower_tracks
            .min(b.broader_tracks)
            .cmp(&a.narrower_tracks.min(a.broader_tracks))
            .then_with(|| a.narrower_key.cmp(&b.narrower_key))
            .then_with(|| a.broader_key.cmp(&b.broader_key))
    });

    ClusterReport {
        scanned_tags: values.len(),
        ignored_tags,
        clusters,
        prefix_edges,
    }
}

#[cfg(test)]
mod tests {
    use super::{cluster_tags, normalize_tag, ClusterReport, PrefixEdge, TagValue};

    fn value(raw: &str, ids: &[&str]) -> TagValue {
        TagValue {
            raw: raw.to_string(),
            track_ids: ids.iter().map(|id| id.to_string()).collect(),
        }
    }

    fn report(values: &[TagValue]) -> ClusterReport {
        cluster_tags(values)
    }

    #[test]
    fn folds_case() {
        assert_eq!(normalize_tag("Melodic House"), "melodic house");
        assert_eq!(normalize_tag("MELODIC HOUSE"), "melodic house");
    }

    #[test]
    fn folds_leading_trailing_and_internal_spacing() {
        assert_eq!(normalize_tag("  melodic   house  "), "melodic house");
        assert_eq!(normalize_tag("melodic house "), "melodic house");
    }

    #[test]
    fn folds_accents_and_diacritics() {
        assert_eq!(normalize_tag("RÜFÜS DU SOL"), "rufus du sol");
        assert_eq!(normalize_tag("rüfus  du sol "), "rufus du sol");
        // İ lowercases to i + U+0307; only the mark-strip removes the dot.
        assert_eq!(normalize_tag("İbrahim Çelik"), "ibrahim celik");
    }

    #[test]
    fn folds_punctuation_as_a_separator_not_a_deletion() {
        assert_eq!(normalize_tag("Hi-NRG"), "hi nrg");
        assert_eq!(normalize_tag("Hi NRG"), "hi nrg");
        assert_eq!(normalize_tag("Drum 'n' Bass"), "drum n bass");
        assert_eq!(normalize_tag("Drum N Bass"), "drum n bass");
        assert_eq!(normalize_tag("DJ-Lackmus"), "dj lackmus");
        assert_eq!(normalize_tag("DJ Lackmus"), "dj lackmus");
    }

    #[test]
    fn punctuation_only_tags_fold_to_the_empty_key() {
        assert_eq!(normalize_tag("!!!"), "");
        assert_eq!(normalize_tag("???"), "");
        assert_eq!(normalize_tag("   "), "");
        assert_eq!(normalize_tag(""), "");
    }

    #[test]
    fn non_decomposable_letters_fold_only_to_themselves() {
        // Deliberate non-folds: the folder never invents an equivalence.
        assert_eq!(normalize_tag("Straße"), "straße");
        assert_ne!(normalize_tag("Straße"), normalize_tag("Strasse"));
        assert_eq!(normalize_tag("Kırmızı"), "kırmızı");
        assert_ne!(normalize_tag("Kırmızı"), normalize_tag("Kirmizi"));
        assert_eq!(normalize_tag("Æon"), "æon");
        assert_eq!(normalize_tag("Ø"), "ø");
    }

    #[test]
    fn folding_is_idempotent() {
        for input in [
            "RÜFÜS DU SOL",
            "İbrahim Çelik",
            "Drum 'n' Bass",
            "Hi-NRG",
            "  melodic   house  ",
            "Straße",
            "!!!",
            "",
            "H;as",
        ] {
            let once = normalize_tag(input);
            assert_eq!(
                normalize_tag(&once),
                once,
                "fold key must be stable: {input}"
            );
        }
    }

    #[test]
    fn case_and_space_variants_form_one_cluster() {
        let out = report(&[
            value("Melodic House", &["t1", "t2"]),
            value("melodic house ", &["t3"]),
        ]);
        assert_eq!(out.scanned_tags, 2);
        assert_eq!(out.ignored_tags, 0);
        assert_eq!(out.clusters.len(), 1);
        let cluster = &out.clusters[0];
        assert_eq!(cluster.key, "melodic house");
        assert_eq!(cluster.distinct_track_count, 3);
        assert_eq!(cluster.members.len(), 2);
        assert_eq!(cluster.members[0].raw, "Melodic House");
        assert_eq!(cluster.members[0].track_count, 2);
        assert_eq!(cluster.members[1].raw, "melodic house ");
        assert_eq!(cluster.members[1].track_count, 1);
        assert!(out.prefix_edges.is_empty());
    }

    #[test]
    fn a_track_carrying_two_spellings_counts_once() {
        let out = report(&[value("House", &["t1"]), value("house", &["t1", "t2"])]);
        assert_eq!(out.clusters.len(), 1);
        // The union is {t1, t2}; the sum of member counts would say 3.
        assert_eq!(out.clusters[0].distinct_track_count, 2);
    }

    #[test]
    fn a_single_spelling_is_not_a_cluster() {
        let out = report(&[value("House", &["t1", "t2"])]);
        assert_eq!(out.scanned_tags, 1);
        assert!(out.clusters.is_empty());
        assert!(out.prefix_edges.is_empty());
    }

    #[test]
    fn empty_key_spellings_are_ignored_not_merged() {
        // Without the guard, "!!!" and "???" would share the empty key and
        // merge into one cluster — two unrelated tags declared duplicates.
        let out = report(&[
            value("!!!", &["t1"]),
            value("???", &["t2"]),
            value("House", &["t3"]),
        ]);
        assert_eq!(out.scanned_tags, 3);
        assert_eq!(out.ignored_tags, 2);
        assert!(out.clusters.is_empty());
    }

    #[test]
    fn an_empty_vocabulary_reports_nothing() {
        let out = report(&[]);
        assert_eq!(out.scanned_tags, 0);
        assert_eq!(out.ignored_tags, 0);
        assert!(out.clusters.is_empty());
        assert!(out.prefix_edges.is_empty());
    }

    #[test]
    fn representative_spelling_ties_break_to_the_byte_smallest_raw() {
        let out = report(&[
            value("melodic house", &["t1"]),
            value("Melodic House", &["t2"]),
        ]);
        // Equal track counts: 'M' (0x4D) sorts before 'm' (0x6D).
        assert_eq!(out.clusters[0].members[0].raw, "Melodic House");
    }

    #[test]
    fn a_prefix_edge_between_singletons_carries_displayable_labels() {
        // Neither side is a cluster, so the edge must carry its own labels —
        // the dialog is not allowed to render fold keys.
        let out = report(&[
            value("Melodic House", &["t1"]),
            value("Melodic House Techno", &["t2", "t3"]),
        ]);
        assert!(out.clusters.is_empty());
        assert_eq!(out.prefix_edges.len(), 1);
        assert_eq!(
            out.prefix_edges[0],
            PrefixEdge {
                narrower_key: "melodic house".to_string(),
                narrower_label: "Melodic House".to_string(),
                narrower_tracks: 1,
                broader_key: "melodic house techno".to_string(),
                broader_label: "Melodic House Techno".to_string(),
                broader_tracks: 2,
                shared_prefix: "melodic house".to_string(),
            }
        );
    }

    #[test]
    fn a_prefix_edge_requires_a_word_boundary() {
        let out = report(&[
            value("Melodic House", &["t1"]),
            value("Melodic Houseplants", &["t2"]),
        ]);
        assert!(out.prefix_edges.is_empty());
    }

    #[test]
    fn a_prefix_edge_requires_at_least_three_characters() {
        let too_short = report(&[value("Ho", &["t1"]), value("House Music", &["t2"])]);
        assert!(too_short.prefix_edges.is_empty());
        let long_enough = report(&[value("Dub", &["t1"]), value("Dub Techno", &["t2"])]);
        assert_eq!(long_enough.prefix_edges.len(), 1);
    }

    #[test]
    fn a_prefix_edge_never_merges_a_cluster() {
        let out = report(&[
            value("Melodic House", &["t1"]),
            value("melodic house", &["t2"]),
            value("Melodic House Techno", &["t3"]),
        ]);
        assert_eq!(out.clusters.len(), 1);
        assert_eq!(out.clusters[0].members.len(), 2);
        assert_eq!(out.clusters[0].distinct_track_count, 2);
        assert_eq!(out.prefix_edges.len(), 1);
    }

    fn ordering_vocabulary() -> Vec<TagValue> {
        vec![
            value("Deep House", &["t1", "t2", "t3"]),
            value("deep house", &["t4"]),
            value("Tech House", &["t5", "t6"]),
            value("tech house", &["t7"]),
            value("Acid House", &["t16", "t17", "t18"]),
            value("acid house", &["t19"]),
            value("Dub", &["t8", "t12"]),
            value("Dub Techno", &["t9", "t15"]),
            value("Ambient", &["t10"]),
            value("Ambient Dub", &["t11"]),
        ]
    }

    #[test]
    fn clusters_members_and_edges_follow_the_documented_ordering() {
        let out = report(&ordering_vocabulary());
        // Clusters: distinct count desc, then key asc — acid and deep tie at 4.
        let keys: Vec<&str> = out.clusters.iter().map(|c| c.key.as_str()).collect();
        assert_eq!(keys, ["acid house", "deep house", "tech house"]);
        // Members: track count desc, then raw asc.
        assert_eq!(out.clusters[1].members[0].raw, "Deep House");
        assert_eq!(out.clusters[1].members[1].raw, "deep house");
        // Edges: smaller side's count desc (dub: 2, ambient: 1), then keys.
        assert_eq!(out.prefix_edges.len(), 2);
        assert_eq!(out.prefix_edges[0].narrower_key, "dub");
        assert_eq!(out.prefix_edges[1].narrower_key, "ambient");
    }

    #[test]
    fn the_report_is_deterministic_and_permutation_invariant() {
        let values = ordering_vocabulary();
        let first = serde_json::to_string(&report(&values)).unwrap();
        let again = serde_json::to_string(&report(&values)).unwrap();
        assert_eq!(first, again, "two runs must be byte-identical");
        let mut reversed = values.clone();
        reversed.reverse();
        let permuted = serde_json::to_string(&report(&reversed)).unwrap();
        assert_eq!(first, permuted, "input order must not leak into the report");
    }

    #[test]
    fn the_wire_shape_is_camel_case() {
        let out = report(&[
            value("Melodic House", &["t1"]),
            value("melodic house", &["t2"]),
        ]);
        let json = serde_json::to_string(&out).unwrap();
        assert!(json.contains("\"scannedTags\""), "{json}");
        assert!(json.contains("\"distinctTrackCount\""), "{json}");
        assert!(json.contains("\"trackCount\""), "{json}");
        assert!(json.contains("\"prefixEdges\""), "{json}");
        assert!(!json.contains("scanned_tags"), "{json}");
    }
}
