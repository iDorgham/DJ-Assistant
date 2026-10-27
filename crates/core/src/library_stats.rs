//! Library summary counts — the agent-facing "how healthy is this library?"
//! questions that the Library view does not model.
//!
//! [`crate::library_query`] owns the *list* query and is shared with the
//! desktop app verbatim. These counts have no UI counterpart yet, so they live
//! here as plain SQL:
//!
//! * `core` stays free of a database dependency — the statements are data, not
//!   code, so the crate still tests without SQLite;
//! * the SQL text is unit-testable in `core`;
//! * the desktop layer can reuse the same statements later without a copy.
//!
//! Every statement is a `SELECT` over present tracks, so a soft-removed row is
//! counted nowhere and the summary stays in step with the list. Nothing in this
//! module can write.
//!
//! "Present" is a schema question, though: a library older than migration 008 has
//! no `removed_at` column, and a statement that names it cannot even prepare there.
//! So the statements take a [`LibrarySchema`] — see [`crate::library_schema`] — and
//! both shapes are rendered from one template.

use crate::library_schema::LibrarySchema;

/// One labelled count in a library summary.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatQuery {
    /// Stable machine-readable label, e.g. `missing_bpm`.
    pub key: &'static str,
    /// The statement to run. Always a `SELECT`.
    pub sql: String,
}

/// Builds SQL yielding `(status, count)` rows ordered by status when executed.
///
/// Counts tracks across all workspaces, excluding soft-removed rows only when
/// `schema.removal_tracked` is true.
///
/// The status is folded exactly the way [`crate::library_query`] folds its
/// `analysis_status` filter — `LOWER(...)`, no `TRIM` — so the counts and the
/// list agree on what "complete" means. A second fold rule here would let the
/// summary and the list disagree about the same track.
pub fn status_breakdown_sql(schema: &LibrarySchema) -> String {
    format!(
        "SELECT LOWER(analysis_status) AS status, \
         COUNT(*) AS n FROM tracks WHERE {} \
         GROUP BY LOWER(analysis_status) ORDER BY status",
        schema.rows_condition()
    )
}

/// Builds the labeled scalar-count statements for a library summary, in output order.
///
/// Each statement yields one count across all workspaces when executed, excluding
/// soft-removed rows only when `schema.removal_tracked` is true.
///
/// * `total` — every track still in the library.
/// * `analyzed` — tracks whose lowercased analysis status is `complete`, without trimming.
/// * `missing_bpm` / `missing_key` — a NULL BPM, or a NULL or blank trimmed key.
/// * `unrated` — tracks with a NULL user rating; zero counts as rated.
/// * `duplicate_groups` / `duplicate_files` — the same content imported more
///   than once, counted by `file_hash`. The schema's `unique_hash_per_workspace`
///   constraint makes a duplicate *within* a workspace impossible, so a group
///   here can only span workspaces — the shape a re-import takes.
///   `duplicate_files` counts all tracks in those groups, including the first copy.
pub fn stat_queries(schema: &LibrarySchema) -> Vec<StatQuery> {
    let rows = schema.rows_condition();
    vec![
        StatQuery {
            key: "total",
            sql: format!("SELECT COUNT(*) FROM tracks WHERE {rows}"),
        },
        StatQuery {
            key: "analyzed",
            sql: format!(
                "SELECT COUNT(*) FROM tracks WHERE {rows} AND LOWER(analysis_status) = 'complete'"
            ),
        },
        StatQuery {
            key: "missing_bpm",
            sql: format!("SELECT COUNT(*) FROM tracks WHERE {rows} AND bpm IS NULL"),
        },
        StatQuery {
            key: "missing_key",
            sql: format!(
                "SELECT COUNT(*) FROM tracks WHERE {rows} AND \
                 (key_camelot IS NULL OR TRIM(key_camelot) = '')"
            ),
        },
        StatQuery {
            key: "unrated",
            sql: format!("SELECT COUNT(*) FROM tracks WHERE {rows} AND user_rating IS NULL"),
        },
        StatQuery {
            key: "duplicate_groups",
            sql: format!(
                "SELECT COUNT(*) FROM (SELECT file_hash FROM tracks \
                 WHERE {rows} GROUP BY file_hash HAVING COUNT(*) > 1)"
            ),
        },
        StatQuery {
            key: "duplicate_files",
            sql: format!(
                "SELECT COALESCE(SUM(copies), 0) FROM (SELECT COUNT(*) AS copies FROM tracks \
                 WHERE {rows} GROUP BY file_hash HAVING COUNT(*) > 1)"
            ),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library_query::TrackQuery;
    use crate::library_schema::LibrarySchema;

    fn query(schema: &LibrarySchema, key: &str) -> StatQuery {
        stat_queries(schema)
            .into_iter()
            .find(|q| q.key == key)
            .unwrap_or_else(|| panic!("stat {key} must exist"))
    }

    /// Every statement of one schema shape: the stats plus the breakdown.
    fn all_stat_sql(schema: &LibrarySchema) -> Vec<String> {
        let mut out: Vec<String> = stat_queries(schema).into_iter().map(|q| q.sql).collect();
        out.push(status_breakdown_sql(schema));
        out
    }

    #[test]
    fn every_stat_has_a_unique_key() {
        for schema in [LibrarySchema::CURRENT, LibrarySchema::PRE_REMOVAL] {
            let queries = stat_queries(&schema);
            let mut keys: Vec<&str> = queries.iter().map(|q| q.key).collect();
            keys.sort_unstable();
            let count = keys.len();
            keys.dedup();
            assert_eq!(keys.len(), count, "stat keys must be unique");
        }
    }

    #[test]
    fn every_stat_is_a_select() {
        for schema in [LibrarySchema::CURRENT, LibrarySchema::PRE_REMOVAL] {
            for stat in stat_queries(&schema) {
                assert!(
                    stat.sql
                        .trim_start()
                        .to_ascii_uppercase()
                        .starts_with("SELECT"),
                    "stat {} must be a SELECT: {}",
                    stat.key,
                    stat.sql
                );
                assert!(
                    !stat.sql.to_ascii_uppercase().contains("INSERT")
                        && !stat.sql.to_ascii_uppercase().contains("UPDATE")
                        && !stat.sql.to_ascii_uppercase().contains("DELETE")
                        && !stat.sql.to_ascii_uppercase().contains("DROP"),
                    "stat {} must not mutate the database",
                    stat.key
                );
            }
        }
    }

    #[test]
    fn status_breakdown_is_a_select_grouped_by_status() {
        let sql = status_breakdown_sql(&LibrarySchema::CURRENT).to_ascii_uppercase();
        assert!(sql.starts_with("SELECT"));
        assert!(sql.contains("WHERE REMOVED_AT IS NULL"));
        assert!(sql.contains("GROUP BY LOWER(ANALYSIS_STATUS)"));
    }

    #[test]
    fn every_stat_counts_present_tracks_only() {
        // A soft-removed track still has its row, so an unfiltered count would
        // report tracks the Library view cannot show. The list query already
        // filters `removed_at IS NULL`; if the stats drift from it, `dj-query
        // --stats` and `dj-query --status complete` disagree about the same
        // library.
        for sql in all_stat_sql(&LibrarySchema::CURRENT) {
            assert!(
                sql.contains("removed_at IS NULL"),
                "a summary statement must exclude soft-removed tracks: {sql}"
            );
        }
    }

    #[test]
    fn a_pre_removal_schema_drops_only_the_removal_predicate() {
        // Issue #61: the summary has to run on a library older than migration
        // 008. Both shapes come from one template, so the degraded text must be
        // the current one with the predicate swapped and nothing else changed —
        // a stat that loses `bpm IS NULL` along the way would silently report a
        // healthier library than the app does.
        let current = stat_queries(&LibrarySchema::CURRENT);
        let degraded = stat_queries(&LibrarySchema::PRE_REMOVAL);
        assert_eq!(
            degraded.len(),
            current.len(),
            "degrading must not drop a stat"
        );
        for (current, degraded) in current.iter().zip(degraded.iter()) {
            assert_eq!(degraded.key, current.key, "the output order must hold");
            assert_eq!(
                degraded.sql,
                current.sql.replace("removed_at IS NULL", "1 = 1"),
                "stat {} changed more than the removal predicate",
                current.key
            );
        }

        let current = status_breakdown_sql(&LibrarySchema::CURRENT);
        assert_eq!(
            status_breakdown_sql(&LibrarySchema::PRE_REMOVAL),
            current.replace("removed_at IS NULL", "1 = 1")
        );
    }

    #[test]
    fn missing_counts_cover_null_and_blank_values() {
        let schema = LibrarySchema::CURRENT;
        assert!(query(&schema, "missing_bpm").sql.contains("bpm IS NULL"));
        assert!(query(&schema, "missing_key")
            .sql
            .contains("key_camelot IS NULL"));
        assert!(query(&schema, "missing_key")
            .sql
            .contains("TRIM(key_camelot) = ''"));
    }

    #[test]
    fn duplicate_counts_are_grouped_by_hash() {
        let schema = LibrarySchema::CURRENT;
        for key in ["duplicate_groups", "duplicate_files"] {
            let sql = query(&schema, key).sql;
            assert!(sql.contains("file_hash"), "{key} must group by file_hash");
            assert!(sql.contains("HAVING COUNT(*) > 1"), "{key}");
            // Content, not location: the same audio at two paths is still a
            // duplicate. The schema's `unique_hash_per_workspace` constraint
            // means a group can only span workspaces.
            assert!(
                !sql.contains("file_path"),
                "{key} must not group by file_path"
            );
        }
    }

    #[test]
    fn stats_agree_with_the_list_query_about_status_case() {
        // The list query folds `analysis_status` with LOWER(); the stats must
        // fold it the same way or the two would disagree about what a
        // "Complete" track is.
        let built = TrackQuery {
            filters: crate::library_query::TrackFilters {
                analysis_status: vec!["Complete".into()],
                ..Default::default()
            },
            ..Default::default()
        }
        .build("id", 1, 0)
        .expect("query must build");
        assert!(built.count_sql.contains("LOWER(analysis_status) IN"));
        assert!(query(&LibrarySchema::CURRENT, "analyzed")
            .sql
            .contains("LOWER(analysis_status)"));
        assert!(status_breakdown_sql(&LibrarySchema::CURRENT).contains("LOWER(analysis_status)"));
    }
}
