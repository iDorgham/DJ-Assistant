//! Version detection and grouping (T2.3.2).
//!
//! A DJ library holds the same record several times on purpose: the Radio
//! Edit for a warm-up, the Extended Mix for mixing, the Instrumental for a
//! mashup, a remix by someone else. Those are **versions**, not duplicates, and
//! the library should show them as one family instead of asking the user to
//! "resolve" them.
//!
//! The rules here are deliberately text-only and conservative:
//!
//! * The version is read from a trailing `(…)` / `[…]` group or a ` - …`
//!   suffix of the title, falling back to the `mix_name` tag.
//! * Tracks group when their normalised artist and base title agree.
//! * A group is reported only when it holds at least two *different* versions —
//!   two copies of the same version are a duplicate question
//!   ([`crate::duplicates`]), not a version family.
//!
//! Nothing here writes: grouping is a read the Maintain view renders.

use std::collections::BTreeMap;

/// The recognised version families, in classification precedence order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum VersionKind {
    Original,
    Radio,
    Extended,
    Club,
    Instrumental,
    Acapella,
    Dub,
    Vip,
    Remix,
    Edit,
    Live,
    /// A version marker the classifier does not recognise (e.g. "Sunrise Mix").
    Other,
}

impl VersionKind {
    /// The stable id used over IPC.
    pub fn as_str(self) -> &'static str {
        match self {
            VersionKind::Original => "original",
            VersionKind::Radio => "radio",
            VersionKind::Extended => "extended",
            VersionKind::Club => "club",
            VersionKind::Instrumental => "instrumental",
            VersionKind::Acapella => "acapella",
            VersionKind::Dub => "dub",
            VersionKind::Vip => "vip",
            VersionKind::Remix => "remix",
            VersionKind::Edit => "edit",
            VersionKind::Live => "live",
            VersionKind::Other => "other",
        }
    }
}

/// What [`parse_version`] reads out of a title.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedVersion {
    /// The title with the version marker removed, as displayed.
    pub base_title: String,
    pub kind: VersionKind,
    /// The marker text as written ("Extended Mix", "Bicep Remix"), `None` for
    /// an unmarked title.
    pub label: Option<String>,
}

/// Lowercases, folds `&` to `and`, drops punctuation and collapses whitespace.
///
/// Shared with duplicate matching so both features agree on when two strings
/// are "the same name".
pub fn normalize_name(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut last_space = true;
    for ch in value.trim().to_lowercase().chars() {
        if ch == '&' {
            if !last_space {
                out.push(' ');
            }
            out.push_str("and ");
            last_space = true;
        } else if ch.is_alphanumeric() {
            out.push(ch);
            last_space = false;
        } else if !last_space {
            out.push(' ');
            last_space = true;
        }
    }
    out.trim_end().to_string()
}

/// The artist with any `feat.` / `ft.` / `featuring` credit removed, normalised.
pub fn normalize_artist(artist: &str) -> String {
    let normalized = normalize_name(artist);
    for marker in [" featuring ", " feat ", " ft "] {
        if let Some(index) = normalized.find(marker) {
            return normalized[..index].trim().to_string();
        }
    }
    normalized
}

/// Classifies version-marker text. `None` when the text is not a version
/// marker at all (a `(feat. X)` credit, a catalogue note).
pub fn classify_marker(text: &str) -> Option<VersionKind> {
    let words: Vec<String> = normalize_name(text)
        .split(' ')
        .filter(|w| !w.is_empty())
        .map(str::to_string)
        .collect();
    if words.is_empty() {
        return None;
    }
    let has = |w: &str| words.iter().any(|x| x == w);
    let first = words[0].as_str();
    if matches!(first, "feat" | "ft" | "featuring" | "with") {
        return None;
    }
    let kind = if has("instrumental") {
        VersionKind::Instrumental
    } else if has("acapella") || has("acappella") || (has("a") && has("cappella")) {
        VersionKind::Acapella
    } else if has("radio") {
        VersionKind::Radio
    } else if has("extended") {
        VersionKind::Extended
    } else if has("club") {
        VersionKind::Club
    } else if has("dub") {
        VersionKind::Dub
    } else if has("vip") {
        VersionKind::Vip
    } else if has("remix") || has("rmx") || has("rework") || has("bootleg") || has("refix") {
        VersionKind::Remix
    } else if has("edit") {
        VersionKind::Edit
    } else if has("live") {
        VersionKind::Live
    } else if has("original") {
        VersionKind::Original
    } else if has("mix") || has("version") {
        VersionKind::Other
    } else {
        return None;
    };
    Some(kind)
}

/// Splits a trailing `(…)` or `[…]` group off `title`: `(rest, inner)`.
fn split_trailing_group(title: &str) -> Option<(&str, &str)> {
    let trimmed = title.trim_end();
    let close = trimmed.chars().last()?;
    let open = match close {
        ')' => '(',
        ']' => '[',
        _ => return None,
    };
    let start = trimmed.rfind(open)?;
    let inner = &trimmed[start + open.len_utf8()..trimmed.len() - close.len_utf8()];
    Some((&trimmed[..start], inner))
}

/// Reads the version out of a title, falling back to the `mix_name` tag.
///
/// Trailing groups are peeled right to left, so `Song (feat. X) (Extended
/// Mix)` and `Song (Extended Mix) [Remastered]` both resolve. Only the first
/// recognised marker counts; non-version groups such as a `feat.` credit are
/// dropped from the base title so they do not split a family.
pub fn parse_version(title: &str, mix_name: Option<&str>) -> ParsedVersion {
    let mut rest = title.trim().to_string();
    let mut found: Option<(VersionKind, String)> = None;

    // Peel trailing bracket groups.
    while let Some((head, inner)) = split_trailing_group(&rest) {
        let inner = inner.trim().to_string();
        let head = head.trim_end().to_string();
        if found.is_none() {
            if let Some(kind) = classify_marker(&inner) {
                found = Some((kind, inner));
                rest = head;
                continue;
            }
        }
        // A non-version group (feat., remaster note) or one after the marker:
        // drop it from the base so it does not split the family.
        rest = head;
    }

    // ` - Extended Mix` style suffix.
    if found.is_none() {
        if let Some(index) = rest.rfind(" - ") {
            let suffix = rest[index + 3..].trim().to_string();
            if let Some(kind) = classify_marker(&suffix) {
                found = Some((kind, suffix));
                rest = rest[..index].trim_end().to_string();
            }
        }
    }

    if found.is_none() {
        if let Some(mix) = mix_name.map(str::trim).filter(|m| !m.is_empty()) {
            if let Some(kind) = classify_marker(mix) {
                found = Some((kind, mix.to_string()));
            }
        }
    }

    let base_title = if rest.trim().is_empty() {
        title.trim().to_string()
    } else {
        rest.trim().to_string()
    };
    match found {
        Some((kind, label)) => ParsedVersion {
            base_title,
            kind,
            label: Some(label),
        },
        None => ParsedVersion {
            base_title,
            kind: VersionKind::Original,
            label: None,
        },
    }
}

/// One track as version grouping sees it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionInput {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub mix_name: Option<String>,
}

/// One member of a version family.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionMember {
    pub id: String,
    pub kind: VersionKind,
    pub label: Option<String>,
}

/// Tracks that are versions of the same record.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionGroup {
    /// `normalised artist | normalised base title` — stable across scans.
    pub key: String,
    /// Display artist and base title, taken from the first member.
    pub artist: String,
    pub base_title: String,
    /// Ordered by kind, then label, then id.
    pub members: Vec<VersionMember>,
}

/// Groups `tracks` into version families with at least two distinct versions.
///
/// Families are ordered by artist then base title; tracks with a blank artist
/// or title are skipped — there is nothing to match them on.
pub fn group_versions(tracks: &[VersionInput]) -> Vec<VersionGroup> {
    let mut families: BTreeMap<String, VersionGroup> = BTreeMap::new();
    for track in tracks {
        let artist = normalize_artist(&track.artist);
        let parsed = parse_version(&track.title, track.mix_name.as_deref());
        let base = normalize_name(&parsed.base_title);
        if artist.is_empty() || base.is_empty() {
            continue;
        }
        let key = format!("{artist}|{base}");
        let group = families.entry(key.clone()).or_insert_with(|| VersionGroup {
            key,
            artist: track.artist.trim().to_string(),
            base_title: parsed.base_title.clone(),
            members: Vec::new(),
        });
        group.members.push(VersionMember {
            id: track.id.clone(),
            kind: parsed.kind,
            label: parsed.label,
        });
    }

    families
        .into_values()
        .filter_map(|mut group| {
            let mut distinct: Vec<(VersionKind, String)> = group
                .members
                .iter()
                .map(|m| {
                    (
                        m.kind,
                        m.label.as_deref().map(normalize_name).unwrap_or_default(),
                    )
                })
                .collect();
            distinct.sort();
            distinct.dedup();
            if group.members.len() < 2 || distinct.len() < 2 {
                return None;
            }
            group.members.sort_by(|a, b| {
                a.kind
                    .cmp(&b.kind)
                    .then_with(|| a.label.cmp(&b.label))
                    .then_with(|| a.id.cmp(&b.id))
            });
            Some(group)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(id: &str, artist: &str, title: &str, mix: Option<&str>) -> VersionInput {
        VersionInput {
            id: id.into(),
            title: title.into(),
            artist: artist.into(),
            mix_name: mix.map(str::to_string),
        }
    }

    #[test]
    fn parses_bracketed_and_dashed_markers() {
        let p = parse_version("Opus (Radio Edit)", None);
        assert_eq!(p.base_title, "Opus");
        assert_eq!(p.kind, VersionKind::Radio);
        assert_eq!(p.label.as_deref(), Some("Radio Edit"));

        let p = parse_version("Opus - Extended Mix", None);
        assert_eq!(
            (p.base_title.as_str(), p.kind),
            ("Opus", VersionKind::Extended)
        );

        let p = parse_version("Opus [Instrumental]", None);
        assert_eq!(p.kind, VersionKind::Instrumental);

        let p = parse_version("Opus (Bicep Remix)", None);
        assert_eq!(p.kind, VersionKind::Remix);
        assert_eq!(p.label.as_deref(), Some("Bicep Remix"));
    }

    #[test]
    fn feat_credits_and_trailing_notes_do_not_split_the_base() {
        let p = parse_version("Song (feat. Kim) (Club Mix)", None);
        assert_eq!((p.base_title.as_str(), p.kind), ("Song", VersionKind::Club));
        let p = parse_version("Song (Dub) [Remastered 2019]", None);
        assert_eq!((p.base_title.as_str(), p.kind), ("Song", VersionKind::Dub));
        let p = parse_version("Song (feat. Kim)", None);
        assert_eq!(
            (p.base_title.as_str(), p.kind),
            ("Song", VersionKind::Original)
        );
        assert_eq!(p.label, None);
    }

    #[test]
    fn precedence_prefers_the_more_specific_word() {
        assert_eq!(
            classify_marker("Extended Club Mix"),
            Some(VersionKind::Extended)
        );
        assert_eq!(classify_marker("Radio Edit"), Some(VersionKind::Radio));
        assert_eq!(
            classify_marker("Instrumental Dub"),
            Some(VersionKind::Instrumental)
        );
        assert_eq!(classify_marker("Sunrise Mix"), Some(VersionKind::Other));
        assert_eq!(classify_marker("feat. Mix Master"), None);
        assert_eq!(classify_marker("Remastered"), None);
    }

    #[test]
    fn mix_name_is_the_fallback_marker() {
        let p = parse_version("Opus", Some("Extended Mix"));
        assert_eq!(
            (p.base_title.as_str(), p.kind),
            ("Opus", VersionKind::Extended)
        );
        // The title wins when it carries its own marker.
        let p = parse_version("Opus (Radio Edit)", Some("Extended Mix"));
        assert_eq!(p.kind, VersionKind::Radio);
    }

    #[test]
    fn groups_distinct_versions_of_one_record() {
        let groups = group_versions(&[
            input("a", "Eric Prydz", "Opus (Radio Edit)", None),
            input("b", "Eric Prydz", "Opus (Extended Mix)", None),
            input("c", "eric prydz feat. Someone", "Opus", None),
            input("d", "Other", "Opus (Radio Edit)", None),
        ]);
        assert_eq!(groups.len(), 1);
        let ids: Vec<&str> = groups[0].members.iter().map(|m| m.id.as_str()).collect();
        // Original < Radio < Extended in kind order.
        assert_eq!(ids, ["c", "a", "b"]);
        assert_eq!(groups[0].key, "eric prydz|opus");
    }

    #[test]
    fn two_copies_of_the_same_version_are_not_a_family() {
        let groups = group_versions(&[
            input("a", "X", "Song (Extended Mix)", None),
            input("b", "X", "Song - Extended Mix", None),
        ]);
        assert!(groups.is_empty());
    }

    #[test]
    fn different_remixes_are_distinct_versions() {
        let groups = group_versions(&[
            input("a", "X", "Song (A Remix)", None),
            input("b", "X", "Song (B Remix)", None),
        ]);
        assert_eq!(groups.len(), 1);
    }

    #[test]
    fn blank_artist_or_title_is_skipped() {
        assert!(group_versions(&[
            input("a", "", "Song (Radio Edit)", None),
            input("b", "", "Song (Extended Mix)", None),
        ])
        .is_empty());
    }

    #[test]
    fn normalization_folds_case_ampersand_and_punctuation() {
        assert_eq!(normalize_name("  Above & Beyond! "), "above and beyond");
        assert_eq!(normalize_name("Above and Beyond"), "above and beyond");
        assert_eq!(normalize_artist("Kx ft. Y"), "kx");
    }
}
