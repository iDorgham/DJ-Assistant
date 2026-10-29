//! The reversible metadata write (T2.1.3 bulk edit; T2.1.4/T2.1.6/T2.1.7/T2.1.13).
//!
//! Like [`crate::library_remove`], this module holds SQL as data and never runs
//! it — `core` stays free of a database dependency so the rules are unit
//! testable on any toolchain, and the desktop layer is the thin executor. The
//! statements are executed against the real migrated schema in
//! `tests/schema/tests/bulk_metadata.rs`.
//!
//! One write path serves one track and a bulk selection of thousands: the
//! caller hands it the track ids and a [`MetadataPatch`], and gets back the
//! statements that — run inside one transaction — apply the patch, snapshot
//! every track it changed, and leave an undo that restores exactly what the
//! write touched.
//!
//! The rules the module exists to keep:
//!
//! * **Only what the patch holds is written.** An absent field leaves its
//!   column untouched, so the bulk editor can send a partial patch instead of
//!   guessing a "Mixed" value for every field.
//! * **A value that already matches is not written.** Such a track is neither
//!   counted as updated nor snapshotted — there is nothing to restore.
//! * **Every write is undoable.** The updates and the `skill_runs` snapshot
//!   share one transaction, and the snapshot records each track's before/after
//!   values so the undo can also refuse to overwrite a newer edit.

use crate::library_remove::skill_run_insert;
use crate::patch::{number_value, tags_match, text_value, PATCH_COLUMNS};
use crate::tags::normalize_tags;

/// The highest star rating a track can hold.
pub const MAX_TRACK_RATING: i64 = 5;

/// The highest energy level a track can hold.
pub const MAX_TRACK_ENERGY: i64 = 10;

/// A bound value for a write statement.
///
/// `core` cannot name `rusqlite`, so the executor maps these onto
/// `rusqlite::types::Value` at the last moment. `Null` is a variant of its own
/// because a cleared column writes NULL, and a snapshot guard must be able to
/// say "the column still holds NULL".
#[derive(Debug, Clone, PartialEq)]
pub enum WriteValue {
    Null,
    Text(String),
    Int(i64),
}

impl WriteValue {
    /// The JSON shape the `skill_runs` snapshot stores.
    pub fn to_json(&self) -> serde_json::Value {
        match self {
            WriteValue::Null => serde_json::Value::Null,
            WriteValue::Text(text) => serde_json::Value::from(text.clone()),
            WriteValue::Int(number) => serde_json::Value::from(*number),
        }
    }

    /// Reads a snapshot value back. Anything the columns cannot hold — a
    /// float, an object, an array — restores as NULL rather than mangled.
    pub fn from_json(value: &serde_json::Value) -> WriteValue {
        match value {
            serde_json::Value::Null => WriteValue::Null,
            serde_json::Value::Number(number) => number
                .as_i64()
                .map(WriteValue::Int)
                .unwrap_or(WriteValue::Null),
            serde_json::Value::String(text) => WriteValue::Text(text.clone()),
            _ => WriteValue::Null,
        }
    }
}

/// A statement ready to run: SQL text plus the parameters in `?N` order.
///
/// Values are always bound — never interpolated — so a track id or a tag can
/// only ever be data. Column names come from the fixed [`PATCH_COLUMNS`]
/// allow-list, never from user input.
#[derive(Debug, Clone, PartialEq)]
pub struct WriteStatement {
    pub sql: String,
    pub params: Vec<WriteValue>,
}

/// The value a patch writes to one column.
#[derive(Debug, Clone, PartialEq)]
pub enum ColumnValue {
    /// A text column. `None` clears it (the column becomes NULL).
    Text(Option<String>),
    /// A numeric column. `None` clears it (the column becomes NULL).
    Number(Option<i64>),
}

impl ColumnValue {
    /// The bound value for this column.
    pub fn to_write(&self) -> WriteValue {
        match self {
            ColumnValue::Text(Some(text)) => WriteValue::Text(text.clone()),
            ColumnValue::Text(None) | ColumnValue::Number(None) => WriteValue::Null,
            ColumnValue::Number(Some(number)) => WriteValue::Int(*number),
        }
    }
}

/// The metadata a write may touch.
///
/// `None` leaves a column untouched. For the numeric columns `Some(0)` clears
/// the value (both are stored as NULL and 0 is not a valid rating or energy
/// level); for the text columns an empty string clears it the same way.
///
/// The tag list is a **set**, not a scalar: `Some(vec![])` removes every tag
/// of the track and `Some(vec!["peak"])` replaces the whole set.
#[derive(Debug, Clone, Default)]
pub struct MetadataPatch {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub label: Option<String>,
    pub year: Option<i64>,
    pub comments: Option<String>,
    pub rating: Option<i64>,
    pub energy: Option<i64>,
    pub tags: Option<Vec<String>>,
}

impl MetadataPatch {
    /// The value the patch writes to `column`, or `None` when the patch does
    /// not touch that column at all.
    pub fn value_for(&self, column: &str) -> Option<ColumnValue> {
        match column {
            "title" => self
                .title
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "artist" => self
                .artist
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "album" => self
                .album
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "genre" => self
                .genre
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "label" => self
                .label
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "comments" => self
                .comments
                .as_deref()
                .map(|v| ColumnValue::Text(text_value(v))),
            "year" => self.year.map(|v| ColumnValue::Number(number_value(v))),
            "user_rating" => self.rating.map(|v| ColumnValue::Number(number_value(v))),
            "energy" => self.energy.map(|v| ColumnValue::Number(number_value(v))),
            _ => None,
        }
    }

    /// Rejects values the columns cannot hold, before anything is written.
    pub fn validate(&self) -> Result<(), String> {
        if let Some(rating) = self.rating {
            if !(0..=MAX_TRACK_RATING).contains(&rating) {
                return Err(format!("rating must be between 0 and {MAX_TRACK_RATING}"));
            }
        }
        if let Some(energy) = self.energy {
            if !(0..=MAX_TRACK_ENERGY).contains(&energy) {
                return Err(format!("energy must be between 0 and {MAX_TRACK_ENERGY}"));
            }
        }
        if let Some(year) = self.year {
            if year != 0 && !(1000..=9999).contains(&year) {
                return Err("year must be between 1000 and 9999".to_string());
            }
        }
        // The title and the artist name the track in the table; emptying one
        // of them would leave a row the user cannot identify.
        for (label, value) in [("title", &self.title), ("artist", &self.artist)] {
            if let Some(value) = value {
                if value.trim().is_empty() {
                    return Err(format!("{label} cannot be empty"));
                }
            }
        }
        if self.is_empty() {
            return Err("nothing to update".to_string());
        }
        Ok(())
    }

    /// True when the patch would not touch a single column or tag.
    pub fn is_empty(&self) -> bool {
        PATCH_COLUMNS
            .iter()
            .all(|column| self.value_for(column).is_none())
            && self.tags.is_none()
    }

    /// The normalised tag set the patch writes, or `None` when it leaves the
    /// tags untouched.
    ///
    /// The set is normalised here — trimmed, lower-cased, de-duplicated — so
    /// the database and the filter always agree on what a tag is.
    pub fn normalized_tags(&self) -> Option<Vec<String>> {
        self.tags.as_ref().map(|tags| normalize_tags(tags))
    }
}

/// The columns the patch touches, in the fixed [`PATCH_COLUMNS`] order.
pub fn patch_columns(patch: &MetadataPatch) -> Vec<&'static str> {
    PATCH_COLUMNS
        .iter()
        .copied()
        .filter(|column| patch.value_for(column).is_some())
        .collect()
}

/// The value a patch writes to `column`, or `None` when the patch leaves the
/// column alone — or when the row already holds the requested value.
///
/// The second case is what keeps the undo snapshot honest: a value that does
/// not change is neither written nor recorded, so there is nothing to
/// restore, and the track is not counted as updated.
pub fn changed_value(
    patch: &MetadataPatch,
    column: &str,
    current: &WriteValue,
) -> Option<WriteValue> {
    let stored = patch.value_for(column)?.to_write();
    (stored != *current).then_some(stored)
}

/// The tags of one track, in the order the read path returns them.
pub const CURRENT_TAGS_SQL: &str =
    "SELECT tag FROM track_tags WHERE track_id = ?1 ORDER BY tag ASC";

/// The read half of the write: the tracks the selection names, with the values
/// of `columns` as they stand.
///
/// `ORDER BY id` keeps the snapshot — and so the undo — in the same order on
/// every run, which makes the recorded state comparable. Ids the library does
/// not know simply match no row: a bulk selection is applied to what exists.
///
/// The ids are the statement's only parameters, so the placeholders run from
/// `?1`: rusqlite counts the parameters a statement declares, and a base of
/// `?2` leaves one bound to nothing and the query rejected.
pub fn read_patch_statement(
    track_ids: &[String],
    columns: &[&str],
) -> Result<WriteStatement, String> {
    if track_ids.is_empty() {
        return Err("no tracks selected".to_string());
    }
    let placeholders = placeholders(track_ids, 1);
    let select_list = if columns.is_empty() {
        "id".to_string()
    } else {
        format!("id, {}", columns.join(", "))
    };
    Ok(WriteStatement {
        sql: format!("SELECT {select_list} FROM tracks WHERE id IN ({placeholders}) ORDER BY id"),
        params: track_ids
            .iter()
            .map(|id| WriteValue::Text(id.clone()))
            .collect(),
    })
}

/// Replaces a track's tag rows with `tags`.
///
/// The delete and the inserts run inside the caller's transaction, so a track
/// never keeps half of its old set.
pub fn rewrite_tags_statements(track_id: &str, tags: &[String]) -> Vec<WriteStatement> {
    let mut statements = vec![WriteStatement {
        sql: "DELETE FROM track_tags WHERE track_id = ?1".to_string(),
        params: vec![WriteValue::Text(track_id.to_string())],
    }];
    for tag in tags {
        statements.push(WriteStatement {
            sql: "INSERT OR IGNORE INTO track_tags (track_id, tag) VALUES (?1, ?2)".to_string(),
            params: vec![
                WriteValue::Text(track_id.to_string()),
                WriteValue::Text(tag.clone()),
            ],
        });
    }
    statements
}

/// One track's slice of a planned write.
#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTrackWrite {
    pub track_id: String,
    /// The scalar column write, `None` when only the tag set changed.
    pub update: Option<WriteStatement>,
    /// The tag rewrite, empty when the tag set did not change.
    pub tag_statements: Vec<WriteStatement>,
    /// The values before the write — what the undo restores. Only the fields
    /// the write really changes are recorded.
    pub before: serde_json::Map<String, serde_json::Value>,
    /// The values after the write — what the undo checks the row against
    /// before restoring, so a newer edit is never overwritten.
    pub after: serde_json::Map<String, serde_json::Value>,
}

/// Plans the per-track statements and snapshots for a metadata write.
///
/// `rows` holds what [`read_patch_statement`] returned — the `(id, current
/// values)` pairs in `columns` order — and `tag_sets` the current tag set of
/// every row (only read when the patch touches tags). A track whose values all
/// already match produces no plan entry at all: it is not written, not counted
/// and not snapshotted.
pub fn plan_metadata_write(
    rows: &[(String, Vec<WriteValue>)],
    tag_sets: &[(String, Vec<String>)],
    columns: &[&str],
    patch: &MetadataPatch,
) -> Vec<PlannedTrackWrite> {
    let new_tags = patch.normalized_tags();
    let mut planned = Vec::new();

    for (track_id, current_values) in rows {
        let mut assignments: Vec<String> = Vec::new();
        let mut params: Vec<WriteValue> = vec![WriteValue::Text(track_id.clone())];
        let mut before_values = serde_json::Map::new();
        let mut after_values = serde_json::Map::new();

        for (index, column) in columns.iter().enumerate() {
            let column = *column;
            let current = &current_values[index];
            let Some(stored) = changed_value(patch, column, current) else {
                continue;
            };
            params.push(stored.clone());
            assignments.push(format!("{column} = ?{}", params.len()));
            before_values.insert(column.to_string(), current.to_json());
            after_values.insert(column.to_string(), stored.to_json());
        }

        // The tag set is compared as a whole: a track whose tags already match
        // is left alone, exactly like a column whose value already matches.
        let mut tags_changed = false;
        let mut tag_statements = Vec::new();
        if let Some(new_tags) = &new_tags {
            let previous_tags = tag_sets
                .iter()
                .find(|(id, _)| id == track_id)
                .map(|(_, tags)| tags.clone())
                .unwrap_or_default();
            if !tags_match(&previous_tags, new_tags) {
                tags_changed = true;
                before_values.insert(
                    "tags".to_string(),
                    serde_json::Value::Array(
                        previous_tags
                            .iter()
                            .map(|tag| serde_json::Value::from(tag.clone()))
                            .collect(),
                    ),
                );
                after_values.insert(
                    "tags".to_string(),
                    serde_json::Value::Array(
                        new_tags
                            .iter()
                            .map(|tag| serde_json::Value::from(tag.clone()))
                            .collect(),
                    ),
                );
                tag_statements = rewrite_tags_statements(track_id, new_tags);
            }
        }

        if assignments.is_empty() && !tags_changed {
            continue;
        }

        let update = (!assignments.is_empty()).then(|| WriteStatement {
            sql: format!(
                "UPDATE tracks SET {}, updated_at = datetime('now') WHERE id = ?1",
                assignments.join(", ")
            ),
            params,
        });

        planned.push(PlannedTrackWrite {
            track_id: track_id.clone(),
            update,
            tag_statements,
            before: before_values,
            after: after_values,
        });
    }

    planned
}

/// The `input_summary` the `skill_runs` row records.
///
/// It is a record of what was asked, not what was written — the before/after
/// states hold the per-track truth.
pub fn input_doc(track_ids: &[String], patch: &MetadataPatch) -> String {
    serde_json::json!({
        "trackIds": track_ids,
        "rating": patch.rating,
        "energy": patch.energy,
        "title": patch.title,
        "artist": patch.artist,
        "album": patch.album,
        "genre": patch.genre,
        "label": patch.label,
        "year": patch.year,
        "comments": patch.comments,
        "tags": patch.tags,
    })
    .to_string()
}

/// The snapshot row that makes the write undoable, ready to run.
///
/// `skill_name` is always one of the module-level `*_SKILL_NAME` consts —
/// the undo commands read it back and guard with it.
pub fn write_skill_run(
    undo_id: &str,
    skill_name: &'static str,
    track_ids: &[String],
    patch: &MetadataPatch,
    before: serde_json::Map<String, serde_json::Value>,
    after: serde_json::Map<String, serde_json::Value>,
) -> crate::library_remove::Statement {
    skill_run_insert(&crate::library_remove::SkillRun {
        id: undo_id.to_string(),
        workspace_id: "default".to_string(),
        skill_name,
        before_state: serde_json::Value::Object(before).to_string(),
        after_state: serde_json::Value::Object(after).to_string(),
        input_summary: input_doc(track_ids, patch),
    })
}

/// One track's slice of a planned undo.
#[derive(Debug, Clone, PartialEq)]
pub struct PlannedTrackRestore {
    pub track_id: String,
    /// The scalar restore. Its WHERE carries the state the write left, so a
    /// track edited again after the snapshot matches no row — the newer edit
    /// wins — and the 0-rows result tells the executor to skip.
    pub restore: Option<WriteStatement>,
    /// The tag set the write left. The executor compares it with the track's
    /// current set and skips the whole track when they differ.
    pub expected_tags: Option<Vec<String>>,
    /// The delete + inserts that put the original tag set back.
    pub tag_statements: Vec<WriteStatement>,
}

/// Plans the per-track restores for a metadata undo.
///
/// `before` is the snapshot's `before_state` — `{ track_id: { column: value,
/// …, tags: [...] } }` — and `after` its `after_state`, the state the write
/// produced. The restore values come from `before`; the guards come from
/// `after`. A track with nothing to restore is left out of the plan.
pub fn plan_metadata_undo(
    before: &serde_json::Value,
    after: &serde_json::Value,
) -> Result<Vec<PlannedTrackRestore>, String> {
    let after = after.as_object().cloned().unwrap_or_default();
    let snapshot = before
        .as_object()
        .ok_or_else(|| "undo snapshot has a corrupt snapshot".to_string())?;

    let mut planned = Vec::new();
    for (track_id, values) in snapshot {
        let Some(values) = values.as_object() else {
            return Err(format!(
                "undo snapshot has a corrupt entry for track {track_id}"
            ));
        };

        // The columns this snapshot touches. Only those are written back, so
        // an undo never touches anything else. `tags` is not a column — it is
        // a set of rows in `track_tags`.
        let columns: Vec<&str> = PATCH_COLUMNS
            .iter()
            .copied()
            .filter(|column| values.get(*column).is_some())
            .collect();
        let restores_tags = values.get("tags").is_some();
        if columns.is_empty() && !restores_tags {
            continue;
        }

        let mut restore = None;
        if !columns.is_empty() {
            let mut params: Vec<WriteValue> = vec![WriteValue::Text(track_id.clone())];
            let mut assignments: Vec<String> = Vec::new();
            let mut guards: Vec<String> = Vec::new();
            for column in columns {
                // The value to restore comes from the snapshot; the guard is
                // the state the write left, so a newer edit cannot match.
                let restore_value = values
                    .get(column)
                    .map(WriteValue::from_json)
                    .unwrap_or(WriteValue::Null);
                let guard = after
                    .get(track_id)
                    .and_then(|values| values.get(column))
                    .map(WriteValue::from_json)
                    .unwrap_or(WriteValue::Null);
                params.push(restore_value);
                assignments.push(format!("{column} = ?{}", params.len()));
                params.push(guard);
                guards.push(format!("{column} IS ?{}", params.len()));
            }
            restore = Some(WriteStatement {
                sql: format!(
                    "UPDATE tracks SET {}, updated_at = datetime('now') \
                     WHERE id = ?1 AND {}",
                    assignments.join(", "),
                    guards.join(" AND ")
                ),
                params,
            });
        }

        let (expected_tags, tag_statements) = if restores_tags {
            // The tag set is a set: a newer edit that added or removed a tag
            // changed the set, and the snapshot must not overwrite it either.
            // The expected set is the write's after-state; the restored set is
            // the state the write replaced.
            let expected = after
                .get(track_id)
                .and_then(|values| values.get("tags"))
                .map(|value| {
                    value
                        .as_array()
                        .map(|entries| {
                            entries
                                .iter()
                                .filter_map(|entry| entry.as_str().map(str::to_string))
                                .collect::<Vec<String>>()
                        })
                        .unwrap_or_default()
                });
            let restored_tags = values
                .get("tags")
                .and_then(|value| value.as_array())
                .map(|entries| {
                    entries
                        .iter()
                        .filter_map(|entry| entry.as_str().map(str::to_string))
                        .collect::<Vec<String>>()
                })
                .unwrap_or_default();
            (
                Some(expected.unwrap_or_default()),
                rewrite_tags_statements(track_id, &restored_tags),
            )
        } else {
            (None, Vec::new())
        };

        planned.push(PlannedTrackRestore {
            track_id: track_id.clone(),
            restore,
            expected_tags,
            tag_statements,
        });
    }

    Ok(planned)
}

/// `?start, ?start+1, ...` — one placeholder per value, in bind order.
fn placeholders(values: &[String], start: usize) -> String {
    (0..values.len())
        .map(|i| format!("?{}", start + i))
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use super::{
        changed_value, input_doc, plan_metadata_undo, plan_metadata_write, read_patch_statement,
        rewrite_tags_statements, ColumnValue, MetadataPatch, WriteValue, CURRENT_TAGS_SQL,
        MAX_TRACK_ENERGY, MAX_TRACK_RATING,
    };
    use crate::patch::{check_metadata_undoable, PATCH_COLUMNS};
    use crate::tags::normalize_tags;

    fn text(value: &str) -> WriteValue {
        WriteValue::Text(value.to_string())
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
            MetadataPatch {
                title: Some("  Night Drive  ".into()),
                ..Default::default()
            }
            .value_for("title"),
            Some(ColumnValue::Text(Some("Night Drive".into())))
        );
        assert_eq!(
            MetadataPatch {
                genre: Some("   ".into()),
                ..Default::default()
            }
            .value_for("genre"),
            Some(ColumnValue::Text(None))
        );
    }

    #[test]
    fn a_zero_number_clears_the_column() {
        assert_eq!(
            MetadataPatch {
                rating: Some(0),
                ..Default::default()
            }
            .value_for("user_rating"),
            Some(ColumnValue::Number(None))
        );
        assert_eq!(
            MetadataPatch {
                rating: Some(4),
                ..Default::default()
            }
            .value_for("user_rating"),
            Some(ColumnValue::Number(Some(4)))
        );
    }

    #[test]
    fn value_for_maps_every_editable_column() {
        let patch = MetadataPatch {
            title: Some(" Night Drive ".into()),
            year: Some(2026),
            rating: Some(3),
            ..Default::default()
        };
        assert_eq!(
            patch.value_for("title"),
            Some(ColumnValue::Text(Some("Night Drive".into())))
        );
        assert_eq!(
            patch.value_for("year"),
            Some(ColumnValue::Number(Some(2026)))
        );
        assert_eq!(
            patch.value_for("user_rating"),
            Some(ColumnValue::Number(Some(3)))
        );
        assert_eq!(
            patch.value_for("genre"),
            None,
            "an untouched column is absent"
        );
        assert_eq!(patch.value_for("energy"), None);
    }

    #[test]
    fn validate_rejects_values_the_columns_cannot_hold() {
        assert!(MetadataPatch {
            rating: Some(MAX_TRACK_RATING + 1),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(MetadataPatch {
            energy: Some(MAX_TRACK_ENERGY + 1),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(MetadataPatch {
            year: Some(99),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(MetadataPatch {
            title: Some("   ".into()),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(MetadataPatch::default().validate().is_err());
    }

    #[test]
    fn a_tag_only_patch_is_a_real_change() {
        // Clearing every tag is a change, so the patch is not empty and the
        // write is not refused.
        let patch = MetadataPatch {
            tags: Some(Vec::new()),
            ..Default::default()
        };
        assert!(!patch.is_empty());
        assert!(patch.validate().is_ok());
    }

    #[test]
    fn the_tag_set_is_normalised_before_it_is_stored() {
        let patch = MetadataPatch {
            tags: Some(vec![" Peak ".into(), "warmup".into(), "peak".into()]),
            ..Default::default()
        };
        assert_eq!(
            patch.normalized_tags(),
            Some(vec!["peak".to_string(), "warmup".to_string()])
        );
    }

    #[test]
    fn a_value_that_already_matches_is_not_written() {
        let patch = MetadataPatch {
            title: Some("Night Drive".into()),
            ..Default::default()
        };
        assert_eq!(changed_value(&patch, "title", &text("Night Drive")), None);
        assert_eq!(
            changed_value(&patch, "title", &text("Day Break")),
            Some(text("Night Drive"))
        );
        assert_eq!(
            changed_value(&patch, "genre", &text("House")),
            None,
            "a column the patch does not touch is never written"
        );
    }

    #[test]
    fn clearing_a_column_that_holds_a_value_is_a_change() {
        let patch = MetadataPatch {
            genre: Some(String::new()),
            ..Default::default()
        };
        assert_eq!(
            changed_value(&patch, "genre", &text("House")),
            Some(WriteValue::Null)
        );
        assert_eq!(
            changed_value(&patch, "genre", &WriteValue::Null),
            None,
            "a column that is already empty needs no write"
        );
    }

    #[test]
    fn the_read_names_every_id_as_a_parameter() {
        let statement = read_patch_statement(
            &["a".to_string(), "b".to_string()],
            &["title", "user_rating"],
        )
        .unwrap();
        assert_eq!(statement.params.len(), 2);
        assert!(statement
            .sql
            .contains("SELECT id, title, user_rating FROM tracks"));
        // The ids are the only parameters, so they bind from ?1. Asserting the
        // exact clause is the point: a base of ?2 declares one parameter more
        // than the executor ever binds, and rusqlite rejects the query.
        assert!(
            statement.sql.contains("WHERE id IN (?1, ?2) ORDER BY id"),
            "{}",
            statement.sql
        );
        assert!(read_patch_statement(&[], &["title"]).is_err());
    }

    #[test]
    fn a_patch_writes_only_the_fields_it_holds() {
        // Three tracks, a patch that only sets the rating: the plan must not
        // assign a single other column.
        let patch = MetadataPatch {
            rating: Some(4),
            ..Default::default()
        };
        let columns = super::patch_columns(&patch);
        let rows = vec![
            ("t1".to_string(), vec![WriteValue::Int(2)]),
            ("t2".to_string(), vec![WriteValue::Int(3)]),
        ];
        let planned = plan_metadata_write(&rows, &[], &columns, &patch);
        assert_eq!(planned.len(), 2);
        for entry in &planned {
            let update = entry.update.as_ref().unwrap();
            assert!(update.sql.contains("user_rating = ?2"), "{}", update.sql);
            assert!(!update.sql.contains("title"), "{}", update.sql);
            assert_eq!(update.params[1], WriteValue::Int(4));
            // Only the changed field is snapshotted.
            assert_eq!(entry.before.len(), 1);
        }
        assert_eq!(
            planned[0].before.get("user_rating"),
            Some(&serde_json::json!(2))
        );
        assert_eq!(
            planned[1].before.get("user_rating"),
            Some(&serde_json::json!(3))
        );
    }

    #[test]
    fn a_track_already_holding_the_value_is_left_out_of_the_plan() {
        let patch = MetadataPatch {
            rating: Some(4),
            ..Default::default()
        };
        let columns = super::patch_columns(&patch);
        let rows = vec![
            ("t1".to_string(), vec![WriteValue::Int(4)]),
            ("t2".to_string(), vec![WriteValue::Int(2)]),
        ];
        let planned = plan_metadata_write(&rows, &[], &columns, &patch);
        assert_eq!(
            planned
                .iter()
                .map(|entry| entry.track_id.as_str())
                .collect::<Vec<_>>(),
            ["t2"],
            "a track whose value already matches is not written, counted or snapshotted"
        );
    }

    #[test]
    fn the_tag_set_is_compared_as_a_whole() {
        let patch = MetadataPatch {
            tags: Some(vec!["peak".to_string(), "warmup".to_string()]),
            ..Default::default()
        };
        let columns = super::patch_columns(&patch);
        assert!(columns.is_empty(), "tags are not a scalar column");
        let rows = vec![("t1".to_string(), vec![]), ("t2".to_string(), vec![])];
        let tag_sets = vec![
            (
                "t1".to_string(),
                vec!["warmup".to_string(), "peak".to_string()],
            ),
            ("t2".to_string(), vec!["build".to_string()]),
        ];
        let planned = plan_metadata_write(&rows, &tag_sets, &columns, &patch);
        assert_eq!(
            planned
                .iter()
                .map(|entry| entry.track_id.as_str())
                .collect::<Vec<_>>(),
            ["t2"],
            "the same set in a different order is the same set"
        );
        let entry = &planned[0];
        assert!(entry.update.is_none(), "a tag-only write touches no column");
        assert_eq!(
            entry.before.get("tags"),
            Some(&serde_json::json!(["build"]))
        );
        assert_eq!(
            entry.after.get("tags"),
            Some(&serde_json::json!(["peak", "warmup"]))
        );
        assert_eq!(entry.tag_statements.len(), 3, "one delete, two inserts");
        assert!(entry.tag_statements[0]
            .sql
            .contains("DELETE FROM track_tags"));
    }

    #[test]
    fn clearing_every_tag_is_a_write_of_its_own() {
        let patch = MetadataPatch {
            tags: Some(Vec::new()),
            ..Default::default()
        };
        let columns = super::patch_columns(&patch);
        let rows = vec![("t1".to_string(), vec![])];
        let tag_sets = vec![("t1".to_string(), vec!["peak".to_string()])];
        let planned = plan_metadata_write(&rows, &tag_sets, &columns, &patch);
        assert_eq!(planned.len(), 1);
        assert!(planned[0].update.is_none());
        assert_eq!(planned[0].after.get("tags"), Some(&serde_json::json!([])));
    }

    #[test]
    fn a_tag_rewrite_is_one_delete_and_one_insert_per_tag() {
        let statements = rewrite_tags_statements("t1", &["peak".to_string()]);
        assert_eq!(statements.len(), 2);
        assert_eq!(statements[1].params[1], text("peak"));
        assert!(rewrite_tags_statements("t1", &[])
            .iter()
            .all(|stmt| !stmt.sql.contains("INSERT")));
    }

    #[test]
    fn the_input_doc_records_the_request_not_the_result() {
        let patch = MetadataPatch {
            rating: Some(3),
            ..Default::default()
        };
        let doc: serde_json::Value =
            serde_json::from_str(&input_doc(&["t1".to_string()], &patch)).unwrap();
        assert_eq!(doc["trackIds"], serde_json::json!(["t1"]));
        assert_eq!(doc["rating"], serde_json::json!(3));
        assert_eq!(doc["title"], serde_json::Value::Null);
    }

    #[test]
    fn a_restore_sets_the_old_values_while_the_after_state_holds() {
        // A write changed the rating 2 → 4 and the title. The restore sets the
        // old values back, but only while the row still holds what the write
        // left — the after-state rides in the WHERE.
        let before = serde_json::json!({
            "t1": { "user_rating": 2, "title": "One" }
        });
        let after = serde_json::json!({
            "t1": { "user_rating": 4, "title": "Renamed" }
        });
        let planned = plan_metadata_undo(&before, &after).unwrap();
        assert_eq!(planned.len(), 1);
        let restore = planned[0].restore.as_ref().unwrap();
        // Columns follow the PATCH_COLUMNS order: title first, rating second.
        assert!(restore.sql.contains("title = ?2"), "{}", restore.sql);
        assert!(restore.sql.contains("user_rating = ?4"), "{}", restore.sql);
        assert!(restore.sql.contains("title IS ?3"), "{}", restore.sql);
        assert!(restore.sql.contains("user_rating IS ?5"), "{}", restore.sql);
        assert_eq!(restore.params[1], text("One"), "the old title");
        assert_eq!(restore.params[2], text("Renamed"), "the after-state guard");
        assert_eq!(restore.params[3], WriteValue::Int(2), "the old rating");
        assert_eq!(
            restore.params[4],
            WriteValue::Int(4),
            "the after-state guard"
        );
        assert!(planned[0].expected_tags.is_none());
        assert!(planned[0].tag_statements.is_empty());
    }

    #[test]
    fn a_restore_of_a_cleared_column_guards_on_null() {
        // The write cleared the genre; the undo must restore it only while the
        // column still holds NULL.
        let before = serde_json::json!({ "t1": { "genre": "House" } });
        let after = serde_json::json!({ "t1": { "genre": null } });
        let planned = plan_metadata_undo(&before, &after).unwrap();
        let restore = planned[0].restore.as_ref().unwrap();
        assert!(restore.sql.contains("genre IS ?3"), "{}", restore.sql);
        assert_eq!(restore.params[1], text("House"));
        assert_eq!(restore.params[2], WriteValue::Null);
    }

    #[test]
    fn a_restore_of_the_tag_set_is_guarded_by_the_after_state() {
        let before = serde_json::json!({ "t1": { "tags": ["peak"] } });
        let after = serde_json::json!({ "t1": { "tags": ["peak", "warmup"] } });
        let planned = plan_metadata_undo(&before, &after).unwrap();
        assert_eq!(
            planned[0].expected_tags,
            Some(vec!["peak".into(), "warmup".into()])
        );
        assert_eq!(planned[0].tag_statements.len(), 2);
        assert_eq!(planned[0].tag_statements[1].params[1], text("peak"));
        assert!(planned[0].restore.is_none());
    }

    #[test]
    fn a_restore_with_no_after_state_cannot_prove_the_tags_are_current() {
        // The `check_metadata_undoable`/UNDO_READ contract stores an empty
        // after-state only for writes that changed nothing — and a snapshot
        // with nothing changed has no tags to restore either. A missing entry
        // therefore means "guard on empty", never "restore blind".
        let before = serde_json::json!({ "t1": { "tags": ["peak"] } });
        let after = serde_json::json!({ "t1": {} });
        let planned = plan_metadata_undo(&before, &after).unwrap();
        assert_eq!(planned[0].expected_tags, Some(Vec::new()));
    }

    #[test]
    fn a_track_with_nothing_to_restore_is_left_out_of_the_plan() {
        let before = serde_json::json!({
            "t1": { "title": "One" },
            "t2": { "user_rating": 3 },
            "t3": {}
        });
        let planned = plan_metadata_undo(&before, &serde_json::json!({})).unwrap();
        assert_eq!(
            planned
                .iter()
                .map(|entry| entry.track_id.as_str())
                .collect::<Vec<_>>(),
            ["t1", "t2"],
            "an empty entry has neither columns nor a tag set to restore"
        );
    }

    #[test]
    fn a_corrupt_snapshot_is_refused() {
        assert!(plan_metadata_undo(&serde_json::json!([]), &serde_json::json!({})).is_err());
        assert!(plan_metadata_undo(
            &serde_json::json!({ "t1": "not-an-object" }),
            &serde_json::json!({})
        )
        .is_err());
    }

    #[test]
    fn the_current_tags_read_is_ordered_and_bound() {
        assert_eq!(
            CURRENT_TAGS_SQL,
            "SELECT tag FROM track_tags WHERE track_id = ?1 ORDER BY tag ASC"
        );
    }

    #[test]
    fn a_metadata_snapshot_is_not_another_path_s_to_undo() {
        // The plan does not check the skill name itself — the undo command
        // reads it off the snapshot row and guards with the shared rule.
        assert!(check_metadata_undoable("update_track_metadata", "success").is_ok());
    }

    #[test]
    fn normalize_tags_agrees_with_the_patch_normalisation() {
        assert_eq!(
            normalize_tags(&[" Peak ".into(), "PEAK".into(), "warmup".into()]),
            vec!["peak".to_string(), "warmup".to_string()]
        );
    }
}
