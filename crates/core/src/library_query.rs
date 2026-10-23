//! Pure SQL builder for the library list query behind `list_tracks` (T2.1.2).
//!
//! Kept in `core` (and therefore Tauri-free) so the filtering/sorting contract
//! can be unit tested on any toolchain. The desktop command only maps
//! [`QueryParam`] values onto `rusqlite` and reads the rows back.
//!
//! Safety: every user-supplied **value** is emitted as a bound parameter, and
//! column/direction choices come from closed allow-lists — no user input is
//! ever interpolated into SQL text.

use serde::{Deserialize, Serialize};

/// Filter set from `ListTracksRequest.filters` (`docs/architecture/API_CONTRACTS.md` §2.1).
///
/// Empty or whitespace-only list entries are ignored, matching strings are
/// trimmed and compared case-insensitively (`key_camelot` and `analysis_status`
/// fold to upper/lower case respectively).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TrackFilters {
    /// Inclusive lower BPM bound.
    pub bpm_min: Option<f64>,
    /// Inclusive upper BPM bound.
    pub bpm_max: Option<f64>,
    /// Camelot codes, e.g. `["8A", "9A"]`.
    pub key_camelot: Vec<String>,
    /// `pending` | `complete` | `failed` | `needs_review`.
    pub analysis_status: Vec<String>,
    /// Genre names, matched case-insensitively.
    pub genre: Vec<String>,
    /// Custom tags, matched case-insensitively against `track_tags` (T2.1.7).
    pub tag: Vec<String>,
    /// Inclusive minimum star rating (0–5).
    pub rating_min: Option<i64>,
    /// Inclusive minimum energy level (1–10).
    pub energy_min: Option<i64>,
    /// Inclusive maximum energy level (1–10).
    pub energy_max: Option<i64>,
}

impl TrackFilters {
    /// True when no filter would narrow the query.
    pub fn is_empty(&self) -> bool {
        self.bpm_min.is_none()
            && self.bpm_max.is_none()
            && self.rating_min.is_none()
            && self.energy_min.is_none()
            && self.energy_max.is_none()
            && self.key_camelot.iter().all(|k| k.trim().is_empty())
            && self.analysis_status.iter().all(|s| s.trim().is_empty())
            && self.genre.iter().all(|g| g.trim().is_empty())
            && self.tag.iter().all(|t| t.trim().is_empty())
    }

    /// Number of distinct active filter groups (for UI badges/tests).
    pub fn active_count(&self) -> usize {
        [
            self.bpm_min.is_some() || self.bpm_max.is_some(),
            !self.normalized_keys().is_empty(),
            !self.normalized_statuses().is_empty(),
            !self.normalized_genres().is_empty(),
            !self.normalized_tags().is_empty(),
            self.rating_min.is_some(),
            self.energy_min.is_some() || self.energy_max.is_some(),
        ]
        .iter()
        .filter(|active| **active)
        .count()
    }

    /// Rejects values that can never be satisfied instead of silently returning
    /// an empty library.
    pub fn validate(&self) -> Result<(), QueryError> {
        for (label, value) in [("bpmMin", self.bpm_min), ("bpmMax", self.bpm_max)] {
            if let Some(v) = value {
                if !v.is_finite() {
                    return Err(QueryError::NonFiniteBpm {
                        field: label,
                        value: v,
                    });
                }
                if v < 0.0 {
                    return Err(QueryError::NegativeBpm {
                        field: label,
                        value: v,
                    });
                }
            }
        }
        if let (Some(min), Some(max)) = (self.bpm_min, self.bpm_max) {
            if min > max {
                return Err(QueryError::InvertedBpmRange { min, max });
            }
        }
        if let Some(rating) = self.rating_min {
            if !(0..=5).contains(&rating) {
                return Err(QueryError::RatingOutOfRange { value: rating });
            }
        }
        // Energy is a 1-10 user scale; 0 would mean "cleared", so it is not a
        // valid bound.
        for energy in [self.energy_min, self.energy_max].into_iter().flatten() {
            if !(1..=10).contains(&energy) {
                return Err(QueryError::EnergyOutOfRange { value: energy });
            }
        }
        if let (Some(min), Some(max)) = (self.energy_min, self.energy_max) {
            if min > max {
                return Err(QueryError::InvertedEnergyRange { min, max });
            }
        }
        Ok(())
    }

    fn normalized_keys(&self) -> Vec<String> {
        // SQLite's `UPPER()` is ASCII-only too; Camelot codes are ASCII, so this
        // matches the column case-folding exactly.
        normalize_list(&self.key_camelot, str::to_ascii_uppercase)
    }

    fn normalized_statuses(&self) -> Vec<String> {
        // `LOWER()` in the bundled SQLite only folds ASCII, so fold the bound
        // values the same way; a Unicode fold here would never match the column.
        normalize_list(&self.analysis_status, str::to_ascii_lowercase)
    }

    fn normalized_genres(&self) -> Vec<String> {
        // See `normalized_statuses`: keep this ASCII-only to mirror SQLite.
        normalize_list(&self.genre, str::to_ascii_lowercase)
    }

    fn normalized_tags(&self) -> Vec<String> {
        // Tags are stored lower-cased, so the filter folds the same way.
        normalize_list(&self.tag, str::to_ascii_lowercase)
    }
}

/// Trims, drops empties, applies `fold` to each entry and de-duplicates while
/// preserving the caller's order (so SQL and parameter order stay predictable).
fn normalize_list(values: &[String], fold: impl Fn(&str) -> String) -> Vec<String> {
    let mut out: Vec<String> = Vec::with_capacity(values.len());
    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }
        let folded = fold(trimmed);
        if !out.iter().any(|existing| existing == &folded) {
            out.push(folded);
        }
    }
    out
}

/// A bound SQL parameter. The desktop layer maps these 1:1 onto
/// `rusqlite::types::Value`.
#[derive(Debug, Clone, PartialEq)]
pub enum QueryParam {
    Text(String),
    Int(i64),
    Real(f64),
}

/// The list query: free-text search, filters, sorting and pagination.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TrackQuery {
    /// Free-text search across title, artist, album and file path.
    pub query: Option<String>,
    pub filters: TrackFilters,
    /// One of [`SORT_KEYS`]; unknown values fall back to the default ordering.
    pub sort_by: Option<String>,
    /// `asc` | `desc`; ignored when unrecognised.
    pub sort_dir: Option<String>,
}

/// Sort keys accepted by [`TrackQuery`] — the contract in
/// `packages/shared` (`ListTracksRequest.sortBy`).
pub const SORT_KEYS: [&str; 8] = [
    "title",
    "artist",
    "bpm",
    "key",
    "duration",
    "imported_at",
    "rating",
    "energy",
];

/// The column a sort key orders by.
///
/// Exposed so a caller that runs against one specific database schema — the
/// headless `dj-query` CLI, which may be pointed at a library that predates
/// the newest migration — can check the column exists *before* building a
/// query, instead of letting SQLite fail with "no such column".
///
/// The default order (`imported_at` / newest first) maps to `created_at`.
pub fn sort_column(sort_by: Option<&str>) -> &'static str {
    match sort_by {
        Some("title") => "title",
        Some("artist") => "artist",
        Some("bpm") => "bpm",
        Some("key") => "key_camelot",
        Some("duration") => "duration_ms",
        Some("rating") => "user_rating",
        Some("energy") => "energy",
        _ => "created_at",
    }
}

/// A fully rendered query: WHERE/ORDER text plus the parameters to bind.
#[derive(Debug, Clone, PartialEq)]
pub struct BuiltQuery {
    /// Matches the requested rows without pagination (`SELECT COUNT(*) ...`).
    pub count_sql: String,
    /// Full list statement, with `LIMIT`/`OFFSET` parameters appended.
    pub select_sql: String,
    /// Parameters in statement order: filters first, then limit, then offset.
    pub params: Vec<QueryParam>,
}

impl TrackQuery {
    /// Renders the SQL and parameter list. Values are always bound; only
    /// allow-listed column names and directions are interpolated.
    pub fn build(&self, columns: &str, limit: i64, offset: i64) -> Result<BuiltQuery, QueryError> {
        self.filters.validate()?;

        let mut conditions: Vec<String> = Vec::new();
        let mut params: Vec<QueryParam> = Vec::new();

        if let Some(search) = self.search_pattern() {
            // One placeholder reused by every searched column keeps the
            // parameter list short and the intent obvious. `ESCAPE` makes
            // `%`/`_` from the search box match literally instead of acting as
            // wildcards. The comment (T2.1.13) and the custom tags (T2.1.7)
            // are searched too, so a tag or a note is findable from the one
            // search box.
            let index = params.len() + 1;
            conditions.push(format!(
                "(LOWER(title) LIKE ?{index} ESCAPE '\\' \
                 OR LOWER(artist) LIKE ?{index} ESCAPE '\\' \
                 OR LOWER(album) LIKE ?{index} ESCAPE '\\' \
                 OR LOWER(file_path) LIKE ?{index} ESCAPE '\\' \
                 OR LOWER(comments) LIKE ?{index} ESCAPE '\\' \
                 OR EXISTS (SELECT 1 FROM track_tags tt \
                            WHERE tt.track_id = tracks.id \
                              AND LOWER(tt.tag) LIKE ?{index} ESCAPE '\\'))"
            ));
            params.push(QueryParam::Text(search));
        }

        if let Some(min) = self.filters.bpm_min {
            params.push(QueryParam::Real(min));
            conditions.push(format!("bpm >= ?{}", params.len()));
        }
        if let Some(max) = self.filters.bpm_max {
            params.push(QueryParam::Real(max));
            conditions.push(format!("bpm <= ?{}", params.len()));
        }

        push_in_condition(
            &mut conditions,
            &mut params,
            "UPPER(key_camelot) IN",
            self.filters.normalized_keys(),
        );
        push_in_condition(
            &mut conditions,
            &mut params,
            "LOWER(analysis_status) IN",
            self.filters.normalized_statuses(),
        );
        push_in_condition(
            &mut conditions,
            &mut params,
            "LOWER(TRIM(genre)) IN",
            self.filters.normalized_genres(),
        );

        // The tag filter is an `EXISTS`, not a join: a track can carry several
        // tags, and a join would multiply the rows and break the one-row-per-
        // track shape the pagination and the NULLs-last sort rely on.
        if !self.filters.normalized_tags().is_empty() {
            let placeholders: Vec<String> = self
                .filters
                .normalized_tags()
                .into_iter()
                .map(|tag| {
                    params.push(QueryParam::Text(tag));
                    format!("?{}", params.len())
                })
                .collect();
            conditions.push(format!(
                "EXISTS (SELECT 1 FROM track_tags tt WHERE tt.track_id = tracks.id AND LOWER(tt.tag) IN ({}))",
                placeholders.join(", ")
            ));
        }

        if let Some(rating) = self.filters.rating_min {
            params.push(QueryParam::Int(rating));
            conditions.push(format!("user_rating >= ?{}", params.len()));
        }

        if let Some(energy) = self.filters.energy_min {
            params.push(QueryParam::Int(energy));
            conditions.push(format!("energy >= ?{}", params.len()));
        }
        if let Some(energy) = self.filters.energy_max {
            params.push(QueryParam::Int(energy));
            conditions.push(format!("energy <= ?{}", params.len()));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", conditions.join(" AND "))
        };

        let order_clause = self.order_clause();

        let limit_index = params.len() + 1;
        let offset_index = params.len() + 2;
        let select_sql = format!(
            "SELECT {columns} FROM tracks{where_clause}{order_clause} LIMIT ?{limit_index} OFFSET ?{offset_index}"
        );
        params.push(QueryParam::Int(limit));
        params.push(QueryParam::Int(offset));

        Ok(BuiltQuery {
            count_sql: format!("SELECT COUNT(*) FROM tracks{where_clause}"),
            select_sql,
            params,
        })
    }

    /// Trimmed, ASCII-lowercased `LIKE` pattern, or `None` for a blank query.
    /// `%` and `_` are matched literally so a user typing them does not change
    /// the search semantics.
    ///
    /// The fold is ASCII-only on purpose: the pattern is compared against
    /// `LOWER(column)`, and SQLite's built-in `LOWER()` does not fold non-ASCII
    /// characters, so a Unicode fold here could never match the column.
    fn search_pattern(&self) -> Option<String> {
        let query = self
            .query
            .as_deref()
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        if query.is_empty() {
            return None;
        }
        let escaped = query
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_");
        Some(format!("%{escaped}%"))
    }

    /// ` ORDER BY ...` clause, always present so pagination is deterministic.
    fn order_clause(&self) -> String {
        let (column, nullable, default_dir) = match self.sort_by.as_deref() {
            Some("title") => ("LOWER(title)", false, "ASC"),
            Some("artist") => ("LOWER(artist)", false, "ASC"),
            Some("bpm") => ("bpm", true, "ASC"),
            Some("key") => ("key_camelot", true, "ASC"),
            Some("duration") => ("duration_ms", false, "ASC"),
            // Rating and energy are user-assigned and nullable: unrated tracks
            // sort last in both directions, best/highest first by default.
            Some("rating") => ("user_rating", true, "DESC"),
            Some("energy") => ("energy", true, "DESC"),
            // `imported_at` is the default order and reads newest-first.
            _ => ("created_at", false, "DESC"),
        };

        let direction = match self.sort_dir.as_deref() {
            Some("asc") => "ASC",
            Some("desc") => "DESC",
            _ => default_dir,
        };

        // Nullable columns sort unknown values last in both directions, so an
        // unanalyzed track never displaces real data at the top of the list.
        let primary = if nullable {
            format!("{column} IS NULL, {column} {direction}")
        } else {
            format!("{column} {direction}")
        };
        // `id` is the insertion-order tiebreaker: several rows can share a
        // second-resolution `created_at`, and stable pagination needs an
        // unambiguous total order.
        format!(" ORDER BY {primary}, id ASC")
    }
}

/// Appends `column IN (?, ?, ...)` for a non-empty value list.
fn push_in_condition(
    conditions: &mut Vec<String>,
    params: &mut Vec<QueryParam>,
    column: &str,
    values: Vec<String>,
) {
    if values.is_empty() {
        return;
    }
    let placeholders: Vec<String> = values
        .into_iter()
        .map(|value| {
            params.push(QueryParam::Text(value));
            format!("?{}", params.len())
        })
        .collect();
    conditions.push(format!("{column} ({})", placeholders.join(", ")));
}

/// Rejected filter combinations. All of them are caller mistakes that would
/// otherwise yield a confusing empty list.
#[derive(Debug, Clone, PartialEq)]
pub enum QueryError {
    InvertedBpmRange { min: f64, max: f64 },
    NegativeBpm { field: &'static str, value: f64 },
    NonFiniteBpm { field: &'static str, value: f64 },
    RatingOutOfRange { value: i64 },
    EnergyOutOfRange { value: i64 },
    InvertedEnergyRange { min: i64, max: i64 },
}

impl std::fmt::Display for QueryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvertedBpmRange { min, max } => {
                write!(f, "bpmMin ({min}) must not exceed bpmMax ({max})")
            }
            Self::NegativeBpm { field, value } => {
                write!(f, "{field} must be a positive BPM (got {value})")
            }
            Self::NonFiniteBpm { field, value } => {
                write!(f, "{field} must be a finite number (got {value})")
            }
            Self::RatingOutOfRange { value } => {
                write!(f, "ratingMin must be between 0 and 5 (got {value})")
            }
            Self::EnergyOutOfRange { value } => {
                write!(
                    f,
                    "energyMin/energyMax must be between 1 and 10 (got {value})"
                )
            }
            Self::InvertedEnergyRange { min, max } => {
                write!(f, "energyMin ({min}) must not exceed energyMax ({max})")
            }
        }
    }
}

impl std::error::Error for QueryError {}

#[cfg(test)]
mod tests {
    use super::*;

    const COLUMNS: &str = "id, title";

    fn build(query: TrackQuery) -> BuiltQuery {
        query.build(COLUMNS, 50, 0).expect("query must be valid")
    }

    #[test]
    fn empty_query_has_no_where_and_a_stable_default_order() {
        let built = build(TrackQuery::default());
        assert_eq!(built.count_sql, "SELECT COUNT(*) FROM tracks");
        assert_eq!(
            built.select_sql,
            "SELECT id, title FROM tracks ORDER BY created_at DESC, id ASC LIMIT ?1 OFFSET ?2"
        );
        assert_eq!(built.params, vec![QueryParam::Int(50), QueryParam::Int(0)]);
    }

    #[test]
    fn search_matches_every_searchable_field_with_one_shared_placeholder() {
        let built = build(TrackQuery {
            query: Some("  Deep House  ".into()),
            ..Default::default()
        });
        assert_eq!(
            built.count_sql,
            "SELECT COUNT(*) FROM tracks WHERE (LOWER(title) LIKE ?1 ESCAPE '\\' \
             OR LOWER(artist) LIKE ?1 ESCAPE '\\' OR LOWER(album) LIKE ?1 ESCAPE '\\' \
             OR LOWER(file_path) LIKE ?1 ESCAPE '\\' OR LOWER(comments) LIKE ?1 ESCAPE '\\' \
             OR EXISTS (SELECT 1 FROM track_tags tt WHERE tt.track_id = tracks.id \
             AND LOWER(tt.tag) LIKE ?1 ESCAPE '\\'))"
        );
        assert_eq!(
            built.params,
            vec![
                QueryParam::Text("%deep house%".into()),
                QueryParam::Int(50),
                QueryParam::Int(0)
            ]
        );
    }

    #[test]
    fn search_escapes_like_wildcards_so_they_match_literally() {
        let built = build(TrackQuery {
            query: Some("100%_pure".into()),
            ..Default::default()
        });
        assert_eq!(built.params[0], QueryParam::Text("%100\\%\\_pure%".into()));
    }

    #[test]
    fn blank_search_is_ignored() {
        let built = build(TrackQuery {
            query: Some("   ".into()),
            ..Default::default()
        });
        assert!(!built.count_sql.contains("WHERE"));
        assert_eq!(built.params.len(), 2);
    }

    #[test]
    fn bpm_range_binds_two_parameters() {
        let built = build(TrackQuery {
            filters: TrackFilters {
                bpm_min: Some(124.0),
                bpm_max: Some(132.5),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(
            built.count_sql,
            "SELECT COUNT(*) FROM tracks WHERE bpm >= ?1 AND bpm <= ?2"
        );
        assert_eq!(
            built.params,
            vec![
                QueryParam::Real(124.0),
                QueryParam::Real(132.5),
                QueryParam::Int(50),
                QueryParam::Int(0)
            ]
        );
    }

    #[test]
    fn key_status_and_genre_lists_are_normalized_and_numbered_in_order() {
        let built = build(TrackQuery {
            filters: TrackFilters {
                bpm_min: Some(120.0),
                key_camelot: vec![" 8a ".into(), "9A".into(), "8A".into(), "".into()],
                analysis_status: vec!["Complete".into(), "needs_review".into()],
                genre: vec!["Techno".into(), "house".into()],
                rating_min: Some(3),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(
            built.count_sql,
            "SELECT COUNT(*) FROM tracks WHERE bpm >= ?1 AND UPPER(key_camelot) IN (?2, ?3) \
             AND LOWER(analysis_status) IN (?4, ?5) AND LOWER(TRIM(genre)) IN (?6, ?7) \
             AND user_rating >= ?8"
        );
        assert_eq!(
            built.params,
            vec![
                QueryParam::Real(120.0),
                QueryParam::Text("8A".into()),
                QueryParam::Text("9A".into()),
                QueryParam::Text("complete".into()),
                QueryParam::Text("needs_review".into()),
                QueryParam::Text("techno".into()),
                QueryParam::Text("house".into()),
                QueryParam::Int(3),
                QueryParam::Int(50),
                QueryParam::Int(0),
            ]
        );
    }

    #[test]
    fn search_and_filters_combine_with_contiguous_placeholders() {
        let built = build(TrackQuery {
            query: Some("peak".into()),
            filters: TrackFilters {
                bpm_max: Some(130.0),
                genre: vec!["techno".into()],
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(
            built.count_sql,
            "SELECT COUNT(*) FROM tracks WHERE (LOWER(title) LIKE ?1 ESCAPE '\\' \
             OR LOWER(artist) LIKE ?1 ESCAPE '\\' OR LOWER(album) LIKE ?1 ESCAPE '\\' \
             OR LOWER(file_path) LIKE ?1 ESCAPE '\\' OR LOWER(comments) LIKE ?1 ESCAPE '\\' \
             OR EXISTS (SELECT 1 FROM track_tags tt WHERE tt.track_id = tracks.id \
             AND LOWER(tt.tag) LIKE ?1 ESCAPE '\\')) AND bpm <= ?2 \
             AND LOWER(TRIM(genre)) IN (?3)"
        );
        assert!(built
            .select_sql
            .ends_with("ORDER BY created_at DESC, id ASC LIMIT ?4 OFFSET ?5"));
        assert_eq!(built.params.len(), 5);
    }

    #[test]
    fn tag_filter_binds_one_parameter_per_tag() {
        let built = build(TrackQuery {
            filters: TrackFilters {
                tag: vec!["Peak".into(), "warm".into()],
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(
            built.count_sql,
            "SELECT COUNT(*) FROM tracks WHERE EXISTS (SELECT 1 FROM track_tags tt \
             WHERE tt.track_id = tracks.id AND LOWER(tt.tag) IN (?1, ?2))"
        );
        assert_eq!(
            built.params,
            vec![
                QueryParam::Text("peak".into()),
                QueryParam::Text("warm".into()),
                QueryParam::Int(50),
                QueryParam::Int(0)
            ]
        );
    }

    #[test]
    fn a_blank_tag_is_not_a_filter() {
        let built = build(TrackQuery {
            filters: TrackFilters {
                tag: vec!["  ".into()],
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(!built.count_sql.contains("WHERE"));
        assert_eq!(built.params.len(), 2);
        assert!(TrackFilters {
            tag: vec![" ".into()],
            ..Default::default()
        }
        .is_empty());
    }

    #[test]
    fn the_tag_filter_keeps_the_row_shape_one_row_per_track() {
        // A track with three tags must still match once, not three times: the
        // filter is an `EXISTS`, so the pagination tiebreaker and the
        // NULLs-last sort keep working.
        let built = build(TrackQuery {
            filters: TrackFilters {
                tag: vec!["peak".into()],
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(!built.count_sql.contains("JOIN"));
        assert!(!built.select_sql.contains("JOIN"));
    }

    #[test]
    fn sort_keys_map_to_allow_listed_columns() {
        let cases = [
            ("title", " ORDER BY LOWER(title) ASC, id ASC"),
            ("artist", " ORDER BY LOWER(artist) ASC, id ASC"),
            ("bpm", " ORDER BY bpm IS NULL, bpm ASC, id ASC"),
            (
                "key",
                " ORDER BY key_camelot IS NULL, key_camelot ASC, id ASC",
            ),
            ("duration", " ORDER BY duration_ms ASC, id ASC"),
            ("imported_at", " ORDER BY created_at DESC, id ASC"),
            (
                "rating",
                " ORDER BY user_rating IS NULL, user_rating DESC, id ASC",
            ),
            ("energy", " ORDER BY energy IS NULL, energy DESC, id ASC"),
        ];
        for (sort_by, expected) in cases {
            let built = build(TrackQuery {
                sort_by: Some(sort_by.into()),
                ..Default::default()
            });
            assert!(
                built.select_sql.contains(expected),
                "sort {sort_by}: {}",
                built.select_sql
            );
        }
    }

    #[test]
    fn sort_column_agrees_with_the_rendered_order_by() {
        // `sort_column` is what a schema-aware caller uses to check a column
        // exists before building a query, so it must not drift from the
        // ORDER BY the builder actually renders.
        for sort_by in SORT_KEYS {
            let column = sort_column(Some(sort_by));
            let built = build(TrackQuery {
                sort_by: Some(sort_by.into()),
                ..Default::default()
            });
            assert!(
                built.select_sql.contains(column),
                "sort {sort_by} should order by {column}: {}",
                built.select_sql
            );
        }
        // An unknown key falls back to the default (newest first) order.
        assert_eq!(sort_column(None), "created_at");
        assert_eq!(
            sort_column(Some("file_path; DROP TABLE tracks")),
            "created_at"
        );
    }

    #[test]
    fn sort_direction_is_explicit_and_nulls_stay_last() {
        let ascending = build(TrackQuery {
            sort_by: Some("bpm".into()),
            sort_dir: Some("asc".into()),
            ..Default::default()
        });
        assert!(ascending
            .select_sql
            .contains("ORDER BY bpm IS NULL, bpm ASC, id ASC"));

        let descending = build(TrackQuery {
            sort_by: Some("bpm".into()),
            sort_dir: Some("desc".into()),
            ..Default::default()
        });
        assert!(descending
            .select_sql
            .contains("ORDER BY bpm IS NULL, bpm DESC, id ASC"));

        let imported_ascending = build(TrackQuery {
            sort_by: Some("imported_at".into()),
            sort_dir: Some("asc".into()),
            ..Default::default()
        });
        assert!(imported_ascending
            .select_sql
            .contains("ORDER BY created_at ASC, id ASC"));
    }

    #[test]
    fn unknown_sort_values_fall_back_instead_of_reaching_sql() {
        let built = build(TrackQuery {
            sort_by: Some("file_path; DROP TABLE tracks".into()),
            sort_dir: Some("sideways".into()),
            ..Default::default()
        });
        assert!(built
            .select_sql
            .ends_with("ORDER BY created_at DESC, id ASC LIMIT ?1 OFFSET ?2"));
        assert!(!built.select_sql.contains("DROP"));
    }

    #[test]
    fn filter_values_are_parameterized_never_interpolated() {
        let injected = "techno') OR 1=1 --".to_string();
        let built = build(TrackQuery {
            filters: TrackFilters {
                genre: vec![injected.clone()],
                ..Default::default()
            },
            ..Default::default()
        });
        assert!(!built.count_sql.contains("1=1"));
        assert_eq!(
            built.params[0],
            QueryParam::Text(injected.to_ascii_lowercase())
        );
    }

    #[test]
    fn non_ascii_values_are_folded_the_same_way_as_sqlite_lower() {
        // SQLite's built-in `LOWER()` only folds ASCII, so the bound values must
        // be folded the same way or a non-ASCII genre such as `Électro` would
        // never match the column that produced it.
        let built = build(TrackQuery {
            query: Some("Électro".into()),
            filters: TrackFilters {
                genre: vec!["Électro".into()],
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(built.params[0], QueryParam::Text("%Électro%".into()));
        assert!(
            built
                .params
                .iter()
                .any(|param| param == &QueryParam::Text("Électro".into())),
            "non-ASCII case is preserved so it equals SQLite's LOWER(column)"
        );
    }

    #[test]
    fn active_count_counts_groups_not_values() {
        let mut filters = TrackFilters {
            key_camelot: vec!["8A".into(), "9A".into()],
            ..Default::default()
        };
        assert_eq!(filters.active_count(), 1);
        filters.genre = vec!["  ".into()];
        assert_eq!(filters.active_count(), 1, "blank values are not active");
        filters.rating_min = Some(0);
        assert_eq!(filters.active_count(), 2);
        filters.bpm_min = Some(120.0);
        assert_eq!(filters.active_count(), 3);
        filters.tag = vec!["peak".into()];
        assert_eq!(filters.active_count(), 4);
        assert!(!filters.is_empty());
        assert!(TrackFilters::default().is_empty());
    }

    #[test]
    fn validate_rejects_impossible_ranges() {
        let inverted = TrackQuery {
            filters: TrackFilters {
                bpm_min: Some(140.0),
                bpm_max: Some(120.0),
                ..Default::default()
            },
            ..Default::default()
        };
        assert_eq!(
            inverted.build(COLUMNS, 10, 0).unwrap_err(),
            QueryError::InvertedBpmRange {
                min: 140.0,
                max: 120.0
            }
        );

        let negative = TrackQuery {
            filters: TrackFilters {
                bpm_min: Some(-1.0),
                ..Default::default()
            },
            ..Default::default()
        };
        assert_eq!(
            negative.build(COLUMNS, 10, 0).unwrap_err(),
            QueryError::NegativeBpm {
                field: "bpmMin",
                value: -1.0
            }
        );

        let nan = TrackQuery {
            filters: TrackFilters {
                bpm_max: Some(f64::NAN),
                ..Default::default()
            },
            ..Default::default()
        };
        assert!(matches!(
            nan.build(COLUMNS, 10, 0).unwrap_err(),
            QueryError::NonFiniteBpm {
                field: "bpmMax",
                ..
            }
        ));

        let rating = TrackQuery {
            filters: TrackFilters {
                rating_min: Some(6),
                ..Default::default()
            },
            ..Default::default()
        };
        assert_eq!(
            rating.build(COLUMNS, 10, 0).unwrap_err(),
            QueryError::RatingOutOfRange { value: 6 }
        );
    }

    #[test]
    fn validate_accepts_boundary_values() {
        let query = TrackQuery {
            filters: TrackFilters {
                bpm_min: Some(0.0),
                bpm_max: Some(0.0),
                rating_min: Some(0),
                ..Default::default()
            },
            ..Default::default()
        };
        let built = query.build(COLUMNS, 1, 0).expect("boundaries are valid");
        assert!(built.count_sql.contains("bpm >= ?1 AND bpm <= ?2"));

        let top = TrackQuery {
            filters: TrackFilters {
                rating_min: Some(5),
                ..Default::default()
            },
            ..Default::default()
        };
        assert!(top.build(COLUMNS, 1, 0).is_ok());
    }

    #[test]
    fn params_deserialize_from_the_contract_shape() {
        let json = r#"{
            "query": " deep ",
            "filters": {
                "bpmMin": 120,
                "bpmMax": 130,
                "keyCamelot": ["8A"],
                "analysisStatus": ["complete"],
                "genre": ["House"],
                "tag": ["Peak"],
                "ratingMin": 3,
                "energyMin": 2,
                "energyMax": 8
            },
            "sortBy": "bpm",
            "sortDir": "desc"
        }"#;
        let query: TrackQuery = serde_json::from_str(json).expect("contract JSON must parse");
        assert_eq!(query.query.as_deref(), Some(" deep "));
        assert_eq!(query.filters.bpm_min, Some(120.0));
        assert_eq!(query.filters.rating_min, Some(3));
        assert_eq!(query.filters.energy_min, Some(2));
        assert_eq!(query.filters.energy_max, Some(8));
        assert_eq!(query.filters.tag, vec!["Peak".to_string()]);
        assert_eq!(query.sort_by.as_deref(), Some("bpm"));
        let built = query.build(COLUMNS, 200, 0).expect("must build");
        assert!(built.select_sql.contains("bpm IS NULL, bpm DESC"));
        assert!(built.count_sql.contains("track_tags"));
    }

    #[test]
    fn omitted_fields_use_defaults() {
        let query: TrackQuery = serde_json::from_str("{}").expect("empty request must parse");
        assert_eq!(query, TrackQuery::default());
        assert!(query.filters.is_empty());
    }

    #[test]
    fn energy_min_only_binds_one_parameter() {
        let built = build(TrackQuery {
            filters: TrackFilters {
                energy_min: Some(3),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(
            built.count_sql,
            "SELECT COUNT(*) FROM tracks WHERE energy >= ?1"
        );
        assert_eq!(
            built.params,
            vec![QueryParam::Int(3), QueryParam::Int(50), QueryParam::Int(0)]
        );
    }

    #[test]
    fn energy_max_only_binds_one_parameter() {
        let built = build(TrackQuery {
            filters: TrackFilters {
                energy_max: Some(8),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(
            built.count_sql,
            "SELECT COUNT(*) FROM tracks WHERE energy <= ?1"
        );
        assert_eq!(
            built.params,
            vec![QueryParam::Int(8), QueryParam::Int(50), QueryParam::Int(0)]
        );
    }

    #[test]
    fn energy_range_binds_two_parameters() {
        let built = build(TrackQuery {
            filters: TrackFilters {
                energy_min: Some(3),
                energy_max: Some(7),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(
            built.count_sql,
            "SELECT COUNT(*) FROM tracks WHERE energy >= ?1 AND energy <= ?2"
        );
        assert_eq!(
            built.params,
            vec![
                QueryParam::Int(3),
                QueryParam::Int(7),
                QueryParam::Int(50),
                QueryParam::Int(0)
            ]
        );
    }

    #[test]
    fn energy_bounds_follow_the_rating_floor_in_parameter_order() {
        // The rating floor binds before the energy bounds: the front end and
        // the schema contract test mirror this exact order.
        let built = build(TrackQuery {
            filters: TrackFilters {
                rating_min: Some(3),
                energy_min: Some(2),
                energy_max: Some(8),
                ..Default::default()
            },
            ..Default::default()
        });
        assert_eq!(
            built.count_sql,
            "SELECT COUNT(*) FROM tracks WHERE user_rating >= ?1 AND energy >= ?2 AND energy <= ?3"
        );
        assert_eq!(
            built.params,
            vec![
                QueryParam::Int(3),
                QueryParam::Int(2),
                QueryParam::Int(8),
                QueryParam::Int(50),
                QueryParam::Int(0)
            ]
        );
    }

    #[test]
    fn validate_rejects_out_of_range_energy() {
        let too_low = TrackQuery {
            filters: TrackFilters {
                energy_min: Some(0),
                ..Default::default()
            },
            ..Default::default()
        };
        assert_eq!(
            too_low.build(COLUMNS, 10, 0).unwrap_err(),
            QueryError::EnergyOutOfRange { value: 0 }
        );

        let too_high = TrackQuery {
            filters: TrackFilters {
                energy_max: Some(11),
                ..Default::default()
            },
            ..Default::default()
        };
        assert_eq!(
            too_high.build(COLUMNS, 10, 0).unwrap_err(),
            QueryError::EnergyOutOfRange { value: 11 }
        );
    }

    #[test]
    fn validate_rejects_an_inverted_energy_range() {
        let inverted = TrackQuery {
            filters: TrackFilters {
                energy_min: Some(8),
                energy_max: Some(3),
                ..Default::default()
            },
            ..Default::default()
        };
        assert_eq!(
            inverted.build(COLUMNS, 10, 0).unwrap_err(),
            QueryError::InvertedEnergyRange { min: 8, max: 3 }
        );
    }

    #[test]
    fn rating_and_energy_sort_direction_can_be_overridden() {
        let rating_ascending = build(TrackQuery {
            sort_by: Some("rating".into()),
            sort_dir: Some("asc".into()),
            ..Default::default()
        });
        assert!(rating_ascending
            .select_sql
            .contains("ORDER BY user_rating IS NULL, user_rating ASC, id ASC"));

        let energy_ascending = build(TrackQuery {
            sort_by: Some("energy".into()),
            sort_dir: Some("asc".into()),
            ..Default::default()
        });
        assert!(energy_ascending
            .select_sql
            .contains("ORDER BY energy IS NULL, energy ASC, id ASC"));
    }

    #[test]
    fn energy_bounds_count_as_one_filter_group() {
        let mut filters = TrackFilters::default();
        assert!(filters.is_empty());
        filters.energy_min = Some(2);
        assert!(!filters.is_empty(), "an energy bound narrows the query");
        assert_eq!(filters.active_count(), 1);
        filters.energy_max = Some(8);
        assert_eq!(filters.active_count(), 1, "both bounds are one group");
    }
}
