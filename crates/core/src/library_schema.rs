//! Which library schema a read is being built for.
//!
//! The desktop app migrates its database on startup, so it always reads the newest
//! shape. `dj-query` cannot say the same: it is pointed at whatever file the caller
//! names, including a snapshot taken before a migration ran. A library last opened
//! before migration 008 has no `tracks.removed_at` column, so the soft-removal
//! predicate every library read leads with is not merely unwanted there — it is a
//! statement SQLite cannot prepare (`no such column: removed_at`), which is how
//! issue #61 left the CLI unable to read the library at all.
//!
//! `core` still does not touch a database: the caller that holds the connection
//! decides what the schema has and hands that answer to the builders. So this is a
//! value, not a probe — `PRAGMA table_info(tracks)` stays in the CLI, where reading
//! the columns already happens.

use std::collections::HashSet;

/// The part of a `tracks` schema the library reads depend on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LibrarySchema {
    /// Whether `tracks.removed_at` exists (migration 008).
    pub removal_tracked: bool,
}

impl LibrarySchema {
    /// The schema the app migrates to — what a library the app has opened holds.
    pub const CURRENT: Self = Self {
        removal_tracked: true,
    };

    /// A database last opened before migration 008: nothing can have been
    /// soft-removed in it, because there is nowhere to record that it was.
    pub const PRE_REMOVAL: Self = Self {
        removal_tracked: false,
    };

    /// The shape of a database whose `tracks` table has these columns.
    ///
    /// Enables removal tracking only if `columns` contains the exact name
    /// `removed_at`. An empty set yields [`Self::PRE_REMOVAL`]; other schema
    /// requirements are not validated.
    pub fn from_columns(columns: &HashSet<String>) -> Self {
        Self {
            removal_tracked: columns.contains("removed_at"),
        }
    }

    /// The condition that keeps soft-removed tracks out of a library read.
    ///
    /// `1 = 1` rather than a dropped clause: the two shapes then come from one
    /// statement template, so a filter edited for the app cannot silently miss the
    /// CLI's copy. The tests in [`crate::library_query`] and [`crate::library_stats`]
    /// assert that the degraded text differs from the current one *only* here.
    ///
    /// Dropping the predicate is exact, not approximate, for a database that has no
    /// column to remove with — every row in it is present by definition. That is also
    /// why the degraded shape must never be used when the column *does* exist: there,
    /// it would show tracks the Library view took away.
    pub fn rows_condition(&self) -> &'static str {
        if self.removal_tracked {
            "removed_at IS NULL"
        } else {
            "1 = 1"
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn columns(names: &[&str]) -> HashSet<String> {
        names.iter().map(|name| name.to_string()).collect()
    }

    #[test]
    fn the_removal_column_alone_decides_the_shape() {
        assert_eq!(
            LibrarySchema::from_columns(&columns(&["id", "title", "removed_at"])),
            LibrarySchema::CURRENT
        );
        assert_eq!(
            LibrarySchema::from_columns(&columns(&["id", "title"])),
            LibrarySchema::PRE_REMOVAL
        );
    }

    #[test]
    fn a_schema_without_the_column_never_names_it() {
        // The whole point of the degraded shape: it has to prepare on a database
        // migration 008 never touched.
        assert_eq!(
            LibrarySchema::CURRENT.rows_condition(),
            "removed_at IS NULL"
        );
        assert_eq!(LibrarySchema::PRE_REMOVAL.rows_condition(), "1 = 1");
    }

    #[test]
    fn the_named_shapes_match_the_columns_they_describe() {
        // A const that drifted from `from_columns` would hand the CLI a capability
        // it had not detected.
        assert_eq!(
            LibrarySchema::from_columns(&columns(&["removed_at"])),
            LibrarySchema::CURRENT
        );
        assert_eq!(
            LibrarySchema::from_columns(&HashSet::new()),
            LibrarySchema::PRE_REMOVAL
        );
    }
}
