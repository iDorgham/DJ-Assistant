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

/// One labelled count in a library summary.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StatQuery {
    /// Stable machine-readable label, e.g. `missing_bpm`.
    pub key: &'static str,
    /// The statement to run. Always a `SELECT`.
    pub sql: &'static str,
}

/// The per-status breakdown, returned as `(status, count)` rows.
///
/// The status is folded exactly the way [`crate::library_query`] folds its
/// `analysis_status` filter — `LOWER(...)`, no `TRIM` — so the counts and the
/// list agree on what "complete" means. A second fold rule here would let the
/// summary and the list disagree about the same track.
pub const STATUS_BREAKDOWN_SQL: &str = "SELECT LOWER(analysis_status) AS status, \
     COUNT(*) AS n FROM tracks WHERE removed_at IS NULL \
     GROUP BY LOWER(analysis_status) ORDER BY status";

/// The scalar counts that make up a library summary, in output order.
///
/// * `total` — every track still in the library.
/// * `missing_bpm` / `missing_key` — tracks the analyser has not filled in.
/// * `analyzed` — tracks the analyser completed.
/// * `unrated` — tracks the DJ has not rated.
/// * `duplicate_groups` / `duplicate_files` — the same content imported more
///   than once, counted by `file_hash`. The schema's `unique_hash_per_workspace`
///   constraint makes a duplicate *within* a workspace impossible, so a group
///   here can only span workspaces — the shape a re-import takes.
pub fn stat_queries() -> Vec<StatQuery> {
    vec![
        StatQuery {
            key: "total",
            sql: "SELECT COUNT(*) FROM tracks WHERE removed_at IS NULL",
        },
        StatQuery {
            key: "analyzed",
            sql: "SELECT COUNT(*) FROM tracks WHERE removed_at IS NULL AND LOWER(analysis_status) = 'complete'",
        },
        StatQuery {
            key: "missing_bpm",
            sql: "SELECT COUNT(*) FROM tracks WHERE removed_at IS NULL AND bpm IS NULL",
        },
        StatQuery {
            key: "missing_key",
            sql: "SELECT COUNT(*) FROM tracks WHERE removed_at IS NULL AND (key_camelot IS NULL OR TRIM(key_camelot) = '')",
        },
        StatQuery {
            key: "unrated",
            sql: "SELECT COUNT(*) FROM tracks WHERE removed_at IS NULL AND user_rating IS NULL",
        },
        StatQuery {
            key: "duplicate_groups",
            sql: "SELECT COUNT(*) FROM (SELECT file_hash FROM tracks \
                  WHERE removed_at IS NULL GROUP BY file_hash HAVING COUNT(*) > 1)",
        },
        StatQuery {
            key: "duplicate_files",
            sql: "SELECT COALESCE(SUM(copies), 0) FROM (SELECT COUNT(*) AS copies FROM tracks \
                  WHERE removed_at IS NULL GROUP BY file_hash HAVING COUNT(*) > 1)",
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library_query::TrackQuery;

    fn query(key: &str) -> StatQuery {
        stat_queries()
            .into_iter()
            .find(|q| q.key == key)
            .unwrap_or_else(|| panic!("stat {key} must exist"))
    }

    #[test]
    fn every_stat_has_a_unique_key() {
        let queries = stat_queries();
        let mut keys: Vec<&str> = queries.iter().map(|q| q.key).collect();
        keys.sort_unstable();
        let count = keys.len();
        keys.dedup();
        assert_eq!(keys.len(), count, "stat keys must be unique");
    }

    #[test]
    fn every_stat_is_a_select() {
        for stat in stat_queries() {
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

    #[test]
    fn status_breakdown_is_a_select_grouped_by_status() {
        let sql = STATUS_BREAKDOWN_SQL.to_ascii_uppercase();
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
        for stat in stat_queries() {
            assert!(
                stat.sql.contains("removed_at IS NULL"),
                "stat {} must exclude soft-removed tracks: {}",
                stat.key,
                stat.sql
            );
        }
        assert!(STATUS_BREAKDOWN_SQL.contains("removed_at IS NULL"));
    }

    #[test]
    fn missing_counts_cover_null_and_blank_values() {
        assert!(query("missing_bpm").sql.contains("bpm IS NULL"));
        assert!(query("missing_key").sql.contains("key_camelot IS NULL"));
        assert!(query("missing_key").sql.contains("TRIM(key_camelot) = ''"));
    }

    #[test]
    fn duplicate_counts_are_grouped_by_hash() {
        for key in ["duplicate_groups", "duplicate_files"] {
            let sql = query(key).sql;
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
        assert!(query("analyzed").sql.contains("LOWER(analysis_status)"));
        assert!(STATUS_BREAKDOWN_SQL.contains("LOWER(analysis_status)"));
    }
}
