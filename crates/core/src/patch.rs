//! The metadata write rules (Slice 3A — T2.1.7 / T2.1.13).
//!
//! These are the pure rules the desktop IPC layer applies before it writes:
//! which columns a write may touch, what a value means (an empty value
//! clears the column), and when a snapshot still describes the current state.
//!
//! They live here, in the Tauri-free core crate, because the desktop crate's
//! test harness does not load on `stable-x86_64-pc-windows-gnu` — a rule that
//! only lives there is a rule that is never executed.

/// The scalar metadata columns a write may touch, in a fixed order.
///
/// The names are interpolated into the SQL text, so this list is a **closed
/// allow-list** — never a user-supplied string.
pub const PATCH_COLUMNS: [&str; 9] = [
    "title",
    "artist",
    "album",
    "genre",
    "label",
    "year",
    "comments",
    "user_rating",
    "energy",
];

/// A text value: trimmed, and an empty value clears the column.
///
/// The column becomes NULL rather than an empty string, so a track with no
/// genre reads as "no genre" everywhere — the table cell, the filter and the
/// tag health report.
pub fn text_value(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

/// The `skill_runs.skill_name` a metadata-editor write records.
pub const METADATA_SKILL_NAME: &str = "update_track_metadata";

/// The `skill_runs.skill_name` a star-rating write records.
pub const RATING_SKILL_NAME: &str = "set_track_rating";

/// Every write path whose snapshot [`check_metadata_undoable`] accepts.
///
/// The name is the only thing telling an undo which columns its snapshot
/// describes. Every `skill_runs` row shares one table, so an undo id from
/// another path can reach this command; [`crate::library_remove`] holds the
/// remove's own name and guard.
pub const METADATA_SKILL_NAMES: [&str; 2] = [METADATA_SKILL_NAME, RATING_SKILL_NAME];

/// Guards the metadata undo against a snapshot it has no business restoring.
///
/// The error is a message rather than an enum: the undo path has one rule
/// ("this snapshot is not mine to restore") and the IPC layer turns anything
/// into a string anyway.
pub fn check_metadata_undoable(skill_name: &str, status: &str) -> Result<(), String> {
    if !METADATA_SKILL_NAMES.contains(&skill_name) {
        return Err(format!(
            "snapshot is a {skill_name} write, not a metadata edit"
        ));
    }
    if status != "success" {
        return Err(format!("snapshot is {status}, not applied"));
    }
    Ok(())
}

/// `0` clears a column, so it is stored as NULL rather than as a zero.
///
/// A rating of 0 and an energy of 0 are not values — they are the "clear it"
/// signal, and no track may hold either.
pub fn number_value(value: i64) -> Option<i64> {
    (value != 0).then_some(value)
}

/// True when two tag sets hold the same tags.
///
/// A tag set is a **set**, not a list: the order the tags arrive in does not
/// matter, only the membership does. The snapshot compares the current set
/// with the set the write produced, so a tag that was added or removed after
/// the snapshot makes the sets differ — and the older snapshot must not
/// overwrite the newer edit.
pub fn tags_match(current: &[String], expected: &[String]) -> bool {
    if current.len() != expected.len() {
        return false;
    }
    let mut current: Vec<&str> = current.iter().map(String::as_str).collect();
    let mut expected: Vec<&str> = expected.iter().map(String::as_str).collect();
    current.sort_unstable();
    expected.sort_unstable();
    current == expected
}

#[cfg(test)]
mod tests {
    use super::{
        check_metadata_undoable, number_value, tags_match, text_value, METADATA_SKILL_NAME,
        METADATA_SKILL_NAMES, PATCH_COLUMNS, RATING_SKILL_NAME,
    };
    use crate::library_remove::REMOVE_SKILL_NAME;

    fn tags(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn the_patch_allow_list_is_closed() {
        // The column names are interpolated into the SQL text, so the list is
        // the only thing that keeps a user-supplied name out of it.
        assert_eq!(
            PATCH_COLUMNS,
            [
                "title",
                "artist",
                "album",
                "genre",
                "label",
                "year",
                "comments",
                "user_rating",
                "energy"
            ]
        );
    }

    #[test]
    fn a_text_value_is_trimmed_and_an_empty_one_clears_the_column() {
        assert_eq!(
            text_value("  Night Drive  "),
            Some("Night Drive".to_string())
        );
        assert_eq!(text_value("   "), None);
        assert_eq!(text_value(""), None);
    }

    #[test]
    fn a_zero_number_clears_the_column() {
        assert_eq!(number_value(0), None);
        assert_eq!(number_value(4), Some(4));
    }

    #[test]
    fn the_same_tags_in_a_different_order_are_the_same_set() {
        assert!(tags_match(
            &tags(&["peak", "warmup"]),
            &tags(&["warmup", "peak"])
        ));
    }

    #[test]
    fn a_changed_set_is_not_the_same_set() {
        assert!(
            !tags_match(&tags(&["peak", "warmup"]), &tags(&["peak", "build"])),
            "a tag added after the snapshot must not be overwritten"
        );
        assert!(
            !tags_match(&tags(&["peak"]), &tags(&["peak", "warmup"])),
            "a removed tag must not come back"
        );
        assert!(!tags_match(&tags(&[]), &tags(&["peak"])));
    }

    #[test]
    fn an_empty_set_matches_only_another_empty_set() {
        assert!(tags_match(&[], &[]));
        assert!(!tags_match(&[], &tags(&["peak"])));
    }

    #[test]
    fn the_write_paths_name_their_snapshots() {
        assert_eq!(METADATA_SKILL_NAME, "update_track_metadata");
        assert_eq!(RATING_SKILL_NAME, "set_track_rating");
        assert_eq!(
            METADATA_SKILL_NAMES,
            [METADATA_SKILL_NAME, RATING_SKILL_NAME]
        );
    }

    #[test]
    fn a_remove_snapshot_is_not_the_metadata_undo_s_to_restore() {
        // The two write paths share the `skill_runs` table, so one undo id can
        // be handed to either command. A remove snapshot holds only
        // `removed_at`, which is not a patch column: the metadata undo would
        // restore nothing and still mark the snapshot spent, destroying the
        // only path back into the library.
        assert!(!METADATA_SKILL_NAMES.contains(&REMOVE_SKILL_NAME));
        let err = check_metadata_undoable(REMOVE_SKILL_NAME, "success")
            .expect_err("a remove snapshot must be refused");
        assert!(err.contains(REMOVE_SKILL_NAME), "{err}");
    }

    #[test]
    fn only_an_applied_metadata_write_is_undoable() {
        assert!(check_metadata_undoable(METADATA_SKILL_NAME, "success").is_ok());
        assert!(check_metadata_undoable(RATING_SKILL_NAME, "success").is_ok());
        assert!(check_metadata_undoable(RATING_SKILL_NAME, "undone").is_err());
        assert!(check_metadata_undoable(RATING_SKILL_NAME, "failed").is_err());
        assert!(check_metadata_undoable("", "success").is_err());
    }
}
