//! Custom-tag normalisation (Slice 3A — T2.1.7).
//!
//! A tag is a **set member**, not free text: the same tag typed as `Peak` and
//! `peak` is one tag. The write path stores the normalised spelling and the
//! filter folds its values the same way, so the library and the filter can
//! never disagree about what a tag is.
//!
//! The fold is ASCII-only on purpose: SQLite's built-in `LOWER()` folds ASCII
//! only, so a Unicode fold here would produce a tag the filter could never
//! match.

/// Normalises a list of tags: trimmed, blanks dropped, ASCII-lowercased,
/// de-duplicated and sorted.
///
/// Sorting is deliberate — the tag rows are read back in that order, so the
/// chips of a track have one stable order everywhere they are shown.
pub fn normalize_tags(values: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::with_capacity(values.len());
    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }
        let folded = trimmed.to_ascii_lowercase();
        if !out.contains(&folded) {
            out.push(folded);
        }
    }
    out.sort();
    out
}

#[cfg(test)]
mod tests {
    use super::normalize_tags;

    fn tags(values: &[&str]) -> Vec<String> {
        normalize_tags(
            &values
                .iter()
                .map(|value| value.to_string())
                .collect::<Vec<_>>(),
        )
    }

    #[test]
    fn trims_and_lowercases() {
        assert_eq!(tags(&["  Peak  "]), vec!["peak".to_string()]);
    }

    #[test]
    fn drops_blank_entries() {
        assert_eq!(tags(&["", "   ", "\t"]), Vec::<String>::new());
    }

    #[test]
    fn de_duplicates_case_insensitively() {
        assert_eq!(tags(&["Peak", "peak", "PEAK"]), vec!["peak".to_string()]);
    }

    #[test]
    fn sorts_the_result() {
        assert_eq!(
            tags(&["Warmup", "peak", "build"]),
            vec![
                "build".to_string(),
                "peak".to_string(),
                "warmup".to_string()
            ]
        );
    }

    #[test]
    fn keeps_the_inner_spaces_of_a_tag() {
        assert_eq!(tags(&["peak time"]), vec!["peak time".to_string()]);
    }

    #[test]
    fn an_empty_list_yields_no_tags() {
        assert!(normalize_tags(&[]).is_empty());
    }
}
