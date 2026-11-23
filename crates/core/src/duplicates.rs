//! Library duplicate grouping (T2.3.1).
//!
//! The scanner already refuses a second copy of a byte-identical file
//! ([`crate::dedup`]): `UNIQUE(workspace_id, file_hash)` means two library rows
//! can never share a fingerprint. What reaches this module is therefore the
//! *other* half of the problem — rows that are different files of the same
//! recording:
//!
//! * **Same ISRC** — two rows carrying one International Standard Recording
//!   Code (an MP3 and a FLAC of one release, say).
//! * **Near match** — same normalised artist and title *including* the version
//!   marker, with durations within a tolerance. Keeping the marker in the key
//!   is what stops a Radio Edit and an Extended Mix from being called
//!   duplicates; those are versions ([`crate::versions`]).
//!
//! Byte-identical copies the scanner skipped are recorded separately (the
//! `duplicate_files` table) and are not grouped here — they are not rows.
//!
//! Grouping never writes and never decides: the user reviews every group and
//! the only resolutions are "keep both" (a dismissal) or a soft remove of the
//! copy they do not want, which is undoable.

use std::collections::{BTreeMap, HashSet};

use crate::versions::{normalize_artist, normalize_name, parse_version, version_identity};

/// Durations closer than this are treated as the same recording.
pub const DEFAULT_DURATION_TOLERANCE_MS: i64 = 2_000;

/// Why a group's tracks are believed to be one recording.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum DuplicateReason {
    SameIsrc,
    NearMatch,
}

impl DuplicateReason {
    pub fn as_str(self) -> &'static str {
        match self {
            DuplicateReason::SameIsrc => "same_isrc",
            DuplicateReason::NearMatch => "near_match",
        }
    }
}

/// One track as duplicate grouping sees it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DuplicateInput {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub mix_name: Option<String>,
    pub isrc: Option<String>,
    pub duration_ms: i64,
}

/// Tracks believed to be the same recording.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DuplicateGroup {
    /// Stable for a given membership: a dismissal stored under it stays valid
    /// until a track joins or leaves, at which point the group asks again.
    pub key: String,
    pub reason: DuplicateReason,
    /// Sorted ascending.
    pub track_ids: Vec<String>,
}

/// An ISRC with separators removed and upper-cased; `None` unless it has the
/// structure of a real code: a 2-letter country code, a 3-character registrant,
/// a 2-digit year and a 5-digit designation (`USRC17607839`).
pub fn normalize_isrc(isrc: &str) -> Option<String> {
    let cleaned = isrc
        .matches(|c: char| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_uppercase();
    let bytes = cleaned.as_bytes();
    let well_formed = bytes.len() == 12
        && bytes[..2].iter().all(u8::is_ascii_alphabetic)
        && bytes[5..].iter().all(u8::is_ascii_digit);
    well_formed.then_some(cleaned)
}

/// The group key: a hash of the sorted member ids, and nothing else.
///
/// The reason is deliberately left out — a dismissal is about *which tracks*
/// the user said to keep together, so it must survive the same tracks being
/// matched by different evidence (an ISRC tag added or removed later).
pub fn group_key(sorted_ids: &[String]) -> String {
    let mut hasher = blake3::Hasher::new();
    for id in sorted_ids {
        hasher.update(id.as_bytes());
        hasher.update(&[0]);
    }
    let hex = hasher.finalize().to_hex();
    format!("dup:{}", &hex[..16])
}

fn make_group(reason: DuplicateReason, mut ids: Vec<String>) -> DuplicateGroup {
    ids.sort();
    ids.dedup();
    DuplicateGroup {
        key: group_key(&ids),
        reason,
        track_ids: ids,
    }
}

/// Groups `tracks` into duplicate candidates.
///
/// ISRC groups come first. A near-match group whose members all sit inside one
/// ISRC group is dropped as redundant; any other overlap is kept, because the
/// two reasons are independent evidence the user should see. Groups are
/// ordered by reason, then by their first track id.
pub fn find_duplicate_groups(tracks: &[DuplicateInput], tolerance_ms: i64) -> Vec<DuplicateGroup> {
    let mut groups = Vec::new();

    let mut by_isrc: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for track in tracks {
        if let Some(code) = track.isrc.as_deref().and_then(normalize_isrc) {
            by_isrc.entry(code).or_default().push(track.id.clone());
        }
    }
    let isrc_groups: Vec<DuplicateGroup> = by_isrc
        .into_values()
        .filter(|ids| ids.len() > 1)
        .map(|ids| make_group(DuplicateReason::SameIsrc, ids))
        .collect();

    // Near match: same artist + full title (marker included), close durations.
    let mut by_name: BTreeMap<String, Vec<(i64, String)>> = BTreeMap::new();
    for track in tracks {
        if track.duration_ms <= 0 {
            continue; // Unknown length: too weak to call a duplicate.
        }
        let artist = normalize_artist(&track.artist);
        let parsed = parse_version(&track.title, track.mix_name.as_deref());
        let base = normalize_name(&parsed.base_title);
        if artist.is_empty() || base.is_empty() {
            continue;
        }
        // "Original Mix" and no marker are the same version.
        let (_, marker) = version_identity(parsed.kind, parsed.label.as_deref());
        by_name
            .entry(format!("{artist}|{base}|{marker}"))
            .or_default()
            .push((track.duration_ms, track.id.clone()));
    }

    let mut near_groups = Vec::new();
    for mut members in by_name.into_values() {
        if members.len() < 2 {
            continue;
        }
        members.sort();
        // Every member of a run stays within the tolerance of the run's
        // shortest track, so 300.0 s, 301.5 s and 303.0 s do not chain into
        // one group although the ends are 3 s apart.
        let mut run: Vec<String> = vec![members[0].1.clone()];
        let mut anchor = members[0].0;
        for (duration, id) in members.into_iter().skip(1) {
            if duration - anchor <= tolerance_ms {
                run.push(id);
            } else {
                if run.len() > 1 {
                    near_groups.push(make_group(DuplicateReason::NearMatch, run));
                }
                run = vec![id];
                anchor = duration;
            }
        }
        if run.len() > 1 {
            near_groups.push(make_group(DuplicateReason::NearMatch, run));
        }
    }

    let isrc_sets: Vec<HashSet<&String>> = isrc_groups
        .iter()
        .map(|g| g.track_ids.iter().collect())
        .collect();
    near_groups.retain(|group| {
        !isrc_sets
            .iter()
            .any(|set| group.track_ids.iter().all(|id| set.contains(id)))
    });

    groups.extend(isrc_groups);
    groups.extend(near_groups);
    groups.sort_by(|a, b| {
        a.reason
            .cmp(&b.reason)
            .then_with(|| a.track_ids.first().cmp(&b.track_ids.first()))
    });
    groups
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(id: &str, artist: &str, title: &str, isrc: Option<&str>, ms: i64) -> DuplicateInput {
        DuplicateInput {
            id: id.into(),
            title: title.into(),
            artist: artist.into(),
            mix_name: None,
            isrc: isrc.map(str::to_string),
            duration_ms: ms,
        }
    }

    #[test]
    fn same_isrc_groups_regardless_of_title() {
        let groups = find_duplicate_groups(
            &[
                t("a", "X", "Song", Some("GB-AAA-24-00001"), 300_000),
                t("b", "Y", "Other", Some("gbaaa2400001"), 1),
                t("c", "Z", "Q", Some("GBAAA2400002"), 1),
            ],
            DEFAULT_DURATION_TOLERANCE_MS,
        );
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].reason, DuplicateReason::SameIsrc);
        assert_eq!(groups[0].track_ids, ["a", "b"]);
    }

    #[test]
    fn near_match_needs_close_durations() {
        let groups = find_duplicate_groups(
            &[
                t("a", "X", "Song", None, 300_000),
                t("b", "x", "song!", None, 301_500),
                t("c", "X", "Song", None, 420_000),
            ],
            DEFAULT_DURATION_TOLERANCE_MS,
        );
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].reason, DuplicateReason::NearMatch);
        assert_eq!(groups[0].track_ids, ["a", "b"]);
    }

    #[test]
    fn different_versions_are_not_duplicates() {
        let groups = find_duplicate_groups(
            &[
                t("a", "X", "Song (Radio Edit)", None, 300_000),
                t("b", "X", "Song (Extended Mix)", None, 300_500),
            ],
            DEFAULT_DURATION_TOLERANCE_MS,
        );
        assert!(groups.is_empty());
    }

    #[test]
    fn original_mix_matches_an_unmarked_title() {
        let groups = find_duplicate_groups(
            &[
                t("a", "X", "Song (Original Mix)", None, 300_000),
                t("b", "X", "Song", None, 300_100),
            ],
            DEFAULT_DURATION_TOLERANCE_MS,
        );
        assert_eq!(groups.len(), 1);
    }

    #[test]
    fn unknown_duration_never_near_matches() {
        let groups = find_duplicate_groups(
            &[t("a", "X", "Song", None, 0), t("b", "X", "Song", None, 0)],
            DEFAULT_DURATION_TOLERANCE_MS,
        );
        assert!(groups.is_empty());
    }

    #[test]
    fn a_near_match_inside_an_isrc_group_is_not_repeated() {
        let groups = find_duplicate_groups(
            &[
                t("a", "X", "Song", Some("GBAAA2400001"), 300_000),
                t("b", "X", "Song", Some("GBAAA2400001"), 300_000),
            ],
            DEFAULT_DURATION_TOLERANCE_MS,
        );
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].reason, DuplicateReason::SameIsrc);
    }

    #[test]
    fn near_match_tolerance_does_not_chain() {
        let groups = find_duplicate_groups(
            &[
                t("a", "X", "Song", None, 300_000),
                t("b", "X", "Song", None, 301_500),
                t("c", "X", "Song", None, 303_000),
            ],
            DEFAULT_DURATION_TOLERANCE_MS,
        );
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].track_ids, ["a", "b"]);
    }

    #[test]
    fn group_key_is_stable_and_depends_on_membership_only() {
        let ab = group_key(&["a".into(), "b".into()]);
        assert_eq!(ab, group_key(&["a".into(), "b".into()]));
        assert_ne!(ab, group_key(&["a".into(), "b".into(), "c".into()]));
        assert!(ab.starts_with("dup:"));

        // The same two tracks keep one key whichever evidence groups them.
        let by_isrc = find_duplicate_groups(
            &[
                t("a", "X", "Song", Some("GBAAA2400001"), 300_000),
                t("b", "X", "Song", Some("GBAAA2400001"), 300_000),
            ],
            DEFAULT_DURATION_TOLERANCE_MS,
        );
        let by_name = find_duplicate_groups(
            &[
                t("a", "X", "Song", None, 300_000),
                t("b", "X", "Song", None, 300_000),
            ],
            DEFAULT_DURATION_TOLERANCE_MS,
        );
        assert_ne!(by_isrc[0].reason, by_name[0].reason);
        assert_eq!(by_isrc[0].key, by_name[0].key);
    }

    #[test]
    fn isrc_must_have_the_real_structure() {
        assert_eq!(
            normalize_isrc("us-rc1-76-07839"),
            Some("USRC17607839".into())
        );
        assert_eq!(normalize_isrc("123"), None);
        // Twelve characters, but no country code or numeric designation.
        assert_eq!(normalize_isrc("123456789012"), None);
        assert_eq!(normalize_isrc("USRC176ABCDE"), None);
    }
}
