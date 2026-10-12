//! Duplicate detection for library scans.
//!
//! Two kinds of duplicate have to be caught:
//!
//! 1. **Already imported** — the fingerprint exists in the database from a
//!    previous scan.
//! 2. **Repeated within one scan** — two paths in the same batch share a
//!    fingerprint (the same file under two names, or a copied file).
//!
//! The original implementation only performed check (1). Because the database is
//! only written after the check, both copies of an intra-batch duplicate passed
//! it, and the second insert then violated the `UNIQUE(workspace_id, file_hash)`
//! constraint — surfacing as a spurious import *error* rather than a duplicate.
//! [`ScanDeduplicator`] closes that gap by remembering fingerprints already
//! claimed during the current run.

use std::collections::HashSet;

/// Outcome of testing one candidate file against both duplicate sources.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DuplicateKind {
    /// Safe to import.
    Unique,
    /// The fingerprint was already claimed earlier in this same scan.
    WithinScan,
    /// The fingerprint already exists in the database.
    AlreadyImported,
}

impl DuplicateKind {
    /// Convenience for callers that only need a boolean.
    pub fn is_duplicate(self) -> bool {
        !matches!(self, DuplicateKind::Unique)
    }
}

/// Tracks fingerprints seen during a single scan run.
///
/// The database is consulted through a caller-supplied closure so this type stays
/// free of SQLite (and therefore of Tauri).
#[derive(Debug, Default)]
pub struct ScanDeduplicator {
    claimed_in_scan: HashSet<String>,
}

impl ScanDeduplicator {
    pub fn new() -> Self {
        Self::default()
    }

    /// Number of distinct fingerprints claimed during this scan.
    pub fn claimed_count(&self) -> usize {
        self.claimed_in_scan.len()
    }

    /// Classifies `fingerprint`, consulting `exists_in_db` only when the
    /// fingerprint has not already been claimed in this run.
    ///
    /// On [`DuplicateKind::Unique`] the fingerprint is recorded as claimed, so a
    /// later file with the same fingerprint is reported as
    /// [`DuplicateKind::WithinScan`] without another database round-trip.
    pub fn classify<F>(&mut self, fingerprint: &str, exists_in_db: F) -> DuplicateKind
    where
        F: FnOnce(&str) -> bool,
    {
        if self.claimed_in_scan.contains(fingerprint) {
            return DuplicateKind::WithinScan;
        }

        if exists_in_db(fingerprint) {
            // Deliberately not recorded as claimed: it is not ours to claim, and
            // recording it would not change the outcome for later files.
            return DuplicateKind::AlreadyImported;
        }

        self.claimed_in_scan.insert(fingerprint.to_string());
        DuplicateKind::Unique
    }

    /// Releases a fingerprint that was claimed but then failed to import, so a
    /// later file with the same hash is not wrongly reported as a duplicate.
    pub fn release(&mut self, fingerprint: &str) {
        self.claimed_in_scan.remove(fingerprint);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_occurrence_is_unique() {
        let mut dedup = ScanDeduplicator::new();
        assert_eq!(dedup.classify("hash-a", |_| false), DuplicateKind::Unique);
        assert_eq!(dedup.claimed_count(), 1);
    }

    #[test]
    fn repeated_fingerprint_within_one_scan_is_detected() {
        // The regression this type exists for: two files, same content, one scan.
        let mut dedup = ScanDeduplicator::new();
        assert_eq!(dedup.classify("hash-a", |_| false), DuplicateKind::Unique);
        assert_eq!(
            dedup.classify("hash-a", |_| false),
            DuplicateKind::WithinScan
        );
    }

    #[test]
    fn existing_database_row_is_reported_as_already_imported() {
        let mut dedup = ScanDeduplicator::new();
        assert_eq!(
            dedup.classify("hash-a", |_| true),
            DuplicateKind::AlreadyImported
        );
    }

    #[test]
    fn database_is_not_consulted_for_an_intra_scan_repeat() {
        // Proves the short-circuit: the closure must not run a second time.
        let mut dedup = ScanDeduplicator::new();
        dedup.classify("hash-a", |_| false);

        let mut db_calls = 0;
        let kind = dedup.classify("hash-a", |_| {
            db_calls += 1;
            false
        });

        assert_eq!(kind, DuplicateKind::WithinScan);
        assert_eq!(db_calls, 0, "in-scan duplicates must not hit the database");
    }

    #[test]
    fn distinct_fingerprints_are_all_unique() {
        let mut dedup = ScanDeduplicator::new();
        for hash in ["a", "b", "c", "d"] {
            assert_eq!(dedup.classify(hash, |_| false), DuplicateKind::Unique);
        }
        assert_eq!(dedup.claimed_count(), 4);
    }

    #[test]
    fn already_imported_is_not_claimed_and_can_be_imported_again_elsewhere() {
        // An existing row must not consume a claim: the same hash in a different
        // workspace/library should still be classifiable honestly.
        let mut dedup = ScanDeduplicator::new();
        assert_eq!(
            dedup.classify("hash-a", |_| true),
            DuplicateKind::AlreadyImported
        );
        assert_eq!(dedup.claimed_count(), 0);
        assert_eq!(
            dedup.classify("hash-a", |_| false),
            DuplicateKind::Unique,
            "once the DB no longer has it, it becomes importable"
        );
    }

    #[test]
    fn releasing_a_failed_import_allows_a_later_attempt() {
        let mut dedup = ScanDeduplicator::new();
        assert_eq!(dedup.classify("hash-a", |_| false), DuplicateKind::Unique);

        // Import failed (e.g. metadata error); give the claim back.
        dedup.release("hash-a");

        assert_eq!(
            dedup.classify("hash-a", |_| false),
            DuplicateKind::Unique,
            "a released fingerprint must be importable again"
        );
    }

    #[test]
    fn is_duplicate_helper_matches_variants() {
        assert!(!DuplicateKind::Unique.is_duplicate());
        assert!(DuplicateKind::WithinScan.is_duplicate());
        assert!(DuplicateKind::AlreadyImported.is_duplicate());
    }
}
