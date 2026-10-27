//! The library-wide reads over `tracks` — everything the app asks the database
//! besides the list query.
//!
//! Same reason as [`crate::library_query`] and [`crate::library_stats`]: `core`
//! holds the SQL as data and never runs it, so the rules are unit-testable on
//! any toolchain and `tests/schema` can execute the exact text the app sends.
//!
//! The one rule this module exists to keep: **every read is over the library
//! the user sees.** A soft-removed track keeps its row — that is what makes an
//! undo possible — so a read that does not filter `removed_at` would report,
//! analyse, score or enrich tracks the Library view has taken away.
//!
//! Per-track detail reads (`get_track`, artwork, an undo snapshot) deliberately
//! do *not* filter: they answer for one id the caller already holds, and a row
//! waiting to be restored must still be readable.
//!
//! [`REMOVED_TRACKS_SQL`] is the one library-wide exception, and it is the
//! recovery surface itself: those rows are hidden everywhere else precisely so
//! this view can be the single place the user goes to bring one back.

use crate::library_remove::Statement;
use crate::library_schema::LibrarySchema;

/// The columns the tag-health report computes its gaps from.
pub const TAG_HEALTH_COLUMNS: &str = "id, title, artist, album, genre, year, bpm, key_camelot, \
    artwork_hash, isrc, duration_ms";

/// The columns the removed view renders, in `RemovedTrack` order.
///
/// `file_path` is here because the point of the view is to show the user that
/// the file is still on disk, and `removed_at` because when a track left is the
/// only thing that orders the list sensibly.
pub const REMOVED_TRACKS_COLUMNS: &str =
    "id, title, artist, album, file_path, duration_ms, removed_at";

/// The rows a soft remove took out of the library, newest departure first.
///
/// `ORDER BY removed_at DESC` puts the tracks the user removed a moment ago —
/// the ones they are most likely here about — at the top; `id` breaks ties so
/// two tracks stamped in the same second keep a stable order across pages.
pub const REMOVED_TRACKS_SQL: &str =
    "SELECT id, title, artist, album, file_path, duration_ms, removed_at \
     FROM tracks WHERE removed_at IS NOT NULL ORDER BY removed_at DESC, id ASC";

/// The columns an enrichment preview needs to match and judge a track.
pub const ENRICHMENT_TARGET_COLUMNS: &str =
    "id, title, artist, album, genre, year, isrc, artwork_hash";

/// The genre options of the library filter, with their track counts.
///
/// Case variants collapse into one entry (the filter itself is
/// case-insensitive), ordered by popularity then alphabetically so the most
/// useful options come first.
pub const GENRE_COUNTS_SQL: &str = "SELECT MIN(TRIM(genre)), COUNT(*) FROM tracks \
     WHERE removed_at IS NULL AND genre IS NOT NULL AND TRIM(genre) <> '' \
     GROUP BY LOWER(TRIM(genre)) ORDER BY COUNT(*) DESC, LOWER(TRIM(genre)) ASC";

/// The pool a similar-track ranking is scored against, minus the seed.
///
/// Every present track, not a `LIMIT 5000` prefix: the pre-sort subset has to
/// be deliberate or the best match hides in the tail of a large library.
pub const SIMILAR_CANDIDATES_SQL: &str = "SELECT id, bpm, key_camelot, genre, duration_ms \
     FROM tracks WHERE removed_at IS NULL AND id != ?1";

/// The ISRCs the library owns, for the taste score of a chart snapshot.
pub const OWNED_ISRC_SQL: &str =
    "SELECT UPPER(isrc) FROM tracks WHERE removed_at IS NULL AND isrc IS NOT NULL";

/// Builds a `SELECT` of every present track's path for the on-disk drift check.
/// This returns SQL without checking whether any file exists.
///
/// The schema shape is a parameter because `dj-query --check-files` reads
/// snapshots too, and one taken before migration 008 has no `removed_at` column
/// — see [`crate::library_schema`].
pub fn missing_file_paths_sql(schema: &LibrarySchema) -> String {
    format!(
        "SELECT file_path FROM tracks WHERE {}",
        schema.rows_condition()
    )
}

/// Why a read cannot be built.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadError {
    /// A selection-scoped read was asked for with nothing selected.
    EmptySelection,
}

impl std::fmt::Display for ReadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReadError::EmptySelection => write!(f, "no tracks selected"),
        }
    }
}

/// A `SELECT` of `columns` over the tracks still in the library, narrowed to
/// `ids` when a selection was given.
///
/// `columns` is interpolated, so it is a closed set of this module's consts —
/// never user input. The ids are always bound.
pub fn present_rows(columns: &str, ids: Option<&[String]>) -> Result<Statement, ReadError> {
    if let Some(ids) = ids {
        if ids.is_empty() {
            return Err(ReadError::EmptySelection);
        }
        let placeholders = ids
            .iter()
            .enumerate()
            .map(|(index, _)| format!("?{}", index + 1))
            .collect::<Vec<_>>()
            .join(", ");
        return Ok(Statement {
            sql: format!(
                "SELECT {columns} FROM tracks WHERE removed_at IS NULL AND id IN ({placeholders})"
            ),
            params: ids.to_vec(),
        });
    }

    Ok(Statement {
        sql: format!("SELECT {columns} FROM tracks WHERE removed_at IS NULL"),
        params: Vec::new(),
    })
}

/// The rows behind the tag-health report.
pub fn tag_health_rows(ids: Option<&[String]>) -> Result<Statement, ReadError> {
    present_rows(TAG_HEALTH_COLUMNS, ids)
}

/// The tracks an enrichment preview may propose fields for.
pub fn enrichment_targets(ids: Option<&[String]>) -> Result<Statement, ReadError> {
    present_rows(ENRICHMENT_TARGET_COLUMNS, ids)
}

/// The work list of the analyser: `(id, file_path)` for the tracks it should
/// visit — `ids` when the caller selected tracks, the whole library when it
/// did not, and only the ones not already at `analysis_version` unless `force`.
pub fn analysis_candidates(
    ids: Option<&[String]>,
    force: bool,
    analysis_version: &str,
) -> Result<Statement, ReadError> {
    let mut built = present_rows("id, file_path", ids)?;
    if force {
        return Ok(built);
    }
    // The version is the last placeholder, after every id: binding it earlier
    // lands it on the first id and an explicit selection returns no work.
    let index = built.params.len() + 1;
    built.sql.push_str(&format!(
        " AND (analysis_status != 'complete' OR analysis_version IS NULL \
         OR analysis_version != ?{index})"
    ));
    built.params.push(analysis_version.to_string());
    Ok(built)
}

#[cfg(test)]
mod tests {
    use super::{
        analysis_candidates, enrichment_targets, missing_file_paths_sql, present_rows,
        tag_health_rows, ReadError, ENRICHMENT_TARGET_COLUMNS, GENRE_COUNTS_SQL, OWNED_ISRC_SQL,
        REMOVED_TRACKS_COLUMNS, REMOVED_TRACKS_SQL, SIMILAR_CANDIDATES_SQL, TAG_HEALTH_COLUMNS,
    };
    use crate::library_remove::Statement;
    use crate::library_schema::LibrarySchema;

    fn ids(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    /// Every statement this module produces or hands out, as text.
    ///
    /// `REMOVED_TRACKS_SQL` is deliberately absent: it is the one read allowed
    /// to show a soft-removed track, and the test below is what proves it.
    fn all_read_sql() -> Vec<String> {
        let built = [
            present_rows(TAG_HEALTH_COLUMNS, None),
            present_rows(ENRICHMENT_TARGET_COLUMNS, Some(&ids(&["a", "b"]))),
            tag_health_rows(None),
            tag_health_rows(Some(&ids(&["a"]))),
            enrichment_targets(Some(&ids(&["a"]))),
            analysis_candidates(None, false, "v1"),
            analysis_candidates(Some(&ids(&["a", "b"])), true, "v1"),
        ];
        let mut out: Vec<String> = built
            .into_iter()
            .map(|statement| statement.expect("read must build").sql)
            .collect();
        out.extend([
            GENRE_COUNTS_SQL.to_string(),
            SIMILAR_CANDIDATES_SQL.to_string(),
            OWNED_ISRC_SQL.to_string(),
            missing_file_paths_sql(&LibrarySchema::CURRENT),
        ]);
        out
    }

    #[test]
    fn the_missing_file_paths_statement_follows_the_schema_shape() {
        // `dj-query --check-files` reads snapshots, and a snapshot older than
        // migration 008 has no `removed_at` column. The other reads in this
        // module are only ever sent by the app, which migrates on startup, so
        // they stay strict — this is the one the CLI also runs.
        assert_eq!(
            missing_file_paths_sql(&LibrarySchema::CURRENT),
            "SELECT file_path FROM tracks WHERE removed_at IS NULL"
        );
        assert_eq!(
            missing_file_paths_sql(&LibrarySchema::PRE_REMOVAL),
            "SELECT file_path FROM tracks WHERE 1 = 1"
        );
    }

    #[test]
    fn every_library_wide_read_skips_soft_removed_tracks() {
        for sql in all_read_sql() {
            assert!(
                sql.contains("removed_at IS NULL"),
                "a read must not report tracks the library took away: {sql}"
            );
        }
    }

    #[test]
    fn every_library_wide_read_is_a_select() {
        // These run on the read side of the app; one write hidden in a shared
        // statement would bypass every guard the write paths have.
        for sql in all_read_sql() {
            let upper = sql.to_ascii_uppercase();
            assert!(upper.trim_start().starts_with("SELECT"), "{sql}");
            for forbidden in ["UPDATE", "DELETE", "INSERT", "DROP", "ALTER"] {
                assert!(!upper.contains(forbidden), "{sql} must not mutate");
            }
        }
    }

    #[test]
    fn a_selection_is_bound_never_interpolated() {
        let hostile = ids(&["x' OR 1=1 --"]);
        let built = present_rows(TAG_HEALTH_COLUMNS, Some(&hostile)).unwrap();
        assert!(!built.sql.contains("OR 1=1"), "{}", built.sql);
        assert_eq!(built.params, hostile);
    }

    #[test]
    fn an_empty_selection_is_refused_rather_than_read_as_the_whole_library() {
        // `Some(&[])` means "nothing was picked". Turned into `id IN ()` it is
        // a syntax error, and dropped silently it becomes the *opposite*
        // request — a read over every track in the library.
        assert_eq!(
            present_rows(TAG_HEALTH_COLUMNS, Some(&[])).err(),
            Some(ReadError::EmptySelection)
        );
        assert_eq!(
            tag_health_rows(Some(&[])).err(),
            Some(ReadError::EmptySelection)
        );
        assert_eq!(
            analysis_candidates(Some(&[]), false, "v1").err(),
            Some(ReadError::EmptySelection)
        );
    }

    #[test]
    fn the_whole_library_is_read_without_an_id_filter() {
        let built = present_rows("id", None).unwrap();
        assert_eq!(built.sql, "SELECT id FROM tracks WHERE removed_at IS NULL");
        assert!(built.params.is_empty());
    }

    #[test]
    fn tag_health_reads_the_fields_its_gaps_are_computed_from() {
        let built = tag_health_rows(None).unwrap();
        assert_eq!(
            built.sql,
            format!("SELECT {TAG_HEALTH_COLUMNS} FROM tracks WHERE removed_at IS NULL")
        );
    }

    #[test]
    fn the_genre_list_keeps_its_case_folding_and_ordering() {
        assert_eq!(
            GENRE_COUNTS_SQL,
            "SELECT MIN(TRIM(genre)), COUNT(*) FROM tracks \
             WHERE removed_at IS NULL AND genre IS NOT NULL AND TRIM(genre) <> '' \
             GROUP BY LOWER(TRIM(genre)) ORDER BY COUNT(*) DESC, LOWER(TRIM(genre)) ASC"
        );
    }

    #[test]
    fn the_similarity_pool_excludes_the_seed_but_holds_every_present_track() {
        assert_eq!(
            SIMILAR_CANDIDATES_SQL,
            "SELECT id, bpm, key_camelot, genre, duration_ms FROM tracks \
             WHERE removed_at IS NULL AND id != ?1"
        );
    }

    #[test]
    fn analysis_work_skips_tracks_already_at_the_current_version_unless_forced() {
        let stale = analysis_candidates(None, false, "2026.10").unwrap();
        assert_eq!(
            stale.sql,
            "SELECT id, file_path FROM tracks WHERE removed_at IS NULL \
             AND (analysis_status != 'complete' OR analysis_version IS NULL \
             OR analysis_version != ?1)"
        );
        assert_eq!(stale.params, ids(&["2026.10"]));

        let forced = analysis_candidates(None, true, "2026.10").unwrap();
        assert_eq!(
            forced.sql,
            "SELECT id, file_path FROM tracks WHERE removed_at IS NULL"
        );
        assert!(forced.params.is_empty());
    }

    #[test]
    fn the_analysis_version_is_bound_after_the_selected_ids() {
        let built = analysis_candidates(Some(&ids(&["a", "b"])), false, "2026.10").unwrap();
        assert_eq!(
            built.sql,
            "SELECT id, file_path FROM tracks WHERE removed_at IS NULL AND id IN (?1, ?2) \
             AND (analysis_status != 'complete' OR analysis_version IS NULL \
             OR analysis_version != ?3)"
        );
        assert_eq!(built.params, ids(&["a", "b", "2026.10"]));
    }

    #[test]
    fn a_forced_selection_keeps_only_the_id_filter() {
        let built = analysis_candidates(Some(&ids(&["a"])), true, "2026.10").unwrap();
        assert_eq!(
            built.sql,
            "SELECT id, file_path FROM tracks WHERE removed_at IS NULL AND id IN (?1)"
        );
        assert_eq!(built.params, ids(&["a"]));
    }

    #[test]
    fn taste_and_drift_reads_are_over_the_library_the_user_sees() {
        assert_eq!(
            OWNED_ISRC_SQL,
            "SELECT UPPER(isrc) FROM tracks WHERE removed_at IS NULL AND isrc IS NOT NULL"
        );
        assert_eq!(
            missing_file_paths_sql(&LibrarySchema::CURRENT),
            "SELECT file_path FROM tracks WHERE removed_at IS NULL"
        );
    }

    #[test]
    fn a_built_read_binds_exactly_the_placeholders_it_has() {
        for built in [
            present_rows(TAG_HEALTH_COLUMNS, Some(&ids(&["a", "b", "c"]))).unwrap(),
            analysis_candidates(Some(&ids(&["a", "b"])), false, "v").unwrap(),
            analysis_candidates(None, false, "v").unwrap(),
        ] {
            let built: Statement = built;
            assert_eq!(
                built.sql.matches('?').count(),
                built.params.len(),
                "every bound value needs a placeholder: {}",
                built.sql
            );
        }
    }

    #[test]
    fn the_removed_view_is_the_one_read_that_holds_a_soft_removed_track() {
        // The recovery surface has to reach the rows every other read hides —
        // that is the whole point of the feature. It stays in this module so
        // the exception is visible next to the rule, and it is the only read
        // excluded from `all_read_sql` above.
        assert_eq!(
            REMOVED_TRACKS_SQL,
            format!(
                "SELECT {REMOVED_TRACKS_COLUMNS} FROM tracks \
             WHERE removed_at IS NOT NULL ORDER BY removed_at DESC, id ASC"
            )
        );
        let upper = REMOVED_TRACKS_SQL.to_ascii_uppercase();
        assert!(upper.trim_start().starts_with("SELECT"), "{upper}");
        assert!(
            REMOVED_TRACKS_COLUMNS.contains("removed_at"),
            "the view has to show when a track left"
        );
    }
}
