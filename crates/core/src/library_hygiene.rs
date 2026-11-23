//! The SQL and row shape behind the Maintain reads: duplicates (T2.3.1),
//! versions (T2.3.2) and the Library Health Score (T2.3.3).
//!
//! Same contract as [`crate::library_reads`]: `core` holds the SQL as data and
//! never runs it; the desktop command executes it and `tests/schema` runs the
//! exact text against the migrated schema. Every library-wide read filters
//! `removed_at IS NULL` — a soft-removed track is not part of the library the
//! user is asking about.

use crate::duplicates::DuplicateInput;
use crate::library_health::HealthTrack;
use crate::versions::VersionInput;

/// One present track with every field the three Maintain reads need, in
/// [`HYGIENE_TRACKS_SQL`] column order.
pub const HYGIENE_TRACKS_SQL: &str = "SELECT id, title, artist, album, genre, year, label, \
     mood, energy, bpm, key_camelot, analysis_status, isrc, mix_name, duration_ms, format, \
     bitrate_kbps, file_path, \
     EXISTS(SELECT 1 FROM track_tags tt WHERE tt.track_id = tracks.id) \
     FROM tracks WHERE removed_at IS NULL ORDER BY id";

/// The library row a fingerprint already belongs to: `(id, file_path)`.
pub const TRACK_BY_HASH_SQL: &str = "SELECT id, file_path FROM tracks WHERE file_hash = ?1 LIMIT 1";

/// Records (or re-points) a skipped byte-identical copy: `?1` path, `?2` the
/// library track it duplicates, `?3` the shared fingerprint.
pub const RECORD_COPY_SQL: &str = "INSERT INTO duplicate_files (file_path, track_id, file_hash) \
     VALUES (?1, ?2, ?3) \
     ON CONFLICT(file_path) DO UPDATE SET track_id = excluded.track_id, \
     file_hash = excluded.file_hash";

/// Recorded copies of present tracks: `(copy_path, track_id, detected_at)`.
///
/// A copy whose path is now the track's own path (the original was moved and
/// the copy re-imported in its place) is not a copy any more and is hidden.
pub const DUPLICATE_COPIES_SQL: &str = "SELECT d.file_path, d.track_id, d.detected_at \
     FROM duplicate_files d JOIN tracks t ON t.id = d.track_id \
     WHERE t.removed_at IS NULL AND d.file_path <> t.file_path \
     ORDER BY d.detected_at DESC, d.file_path ASC";

/// Forgets one recorded copy (`?1` path). Deletes the record, never the file.
pub const FORGET_COPY_SQL: &str = "DELETE FROM duplicate_files WHERE file_path = ?1";

/// Every dismissed ("keep both") duplicate group key.
pub const DISMISSED_KEYS_SQL: &str = "SELECT group_key FROM duplicate_dismissals";

/// Dismisses a group (`?1` key). Idempotent.
pub const DISMISS_GROUP_SQL: &str =
    "INSERT OR IGNORE INTO duplicate_dismissals (group_key) VALUES (?1)";

/// A row of [`HYGIENE_TRACKS_SQL`].
#[derive(Debug, Clone, Default, PartialEq)]
pub struct HygieneRow {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i64>,
    pub label: Option<String>,
    pub mood: Option<String>,
    pub energy: Option<i64>,
    pub bpm: Option<f64>,
    pub key: Option<String>,
    pub analysis_status: String,
    pub isrc: Option<String>,
    pub mix_name: Option<String>,
    pub duration_ms: i64,
    pub format: Option<String>,
    pub bitrate_kbps: Option<i64>,
    pub file_path: String,
    pub has_tags: bool,
}

impl HygieneRow {
    pub fn duplicate_input(&self) -> DuplicateInput {
        DuplicateInput {
            id: self.id.clone(),
            title: self.title.clone(),
            artist: self.artist.clone(),
            mix_name: self.mix_name.clone(),
            isrc: self.isrc.clone(),
            duration_ms: self.duration_ms,
        }
    }

    pub fn version_input(&self) -> VersionInput {
        VersionInput {
            id: self.id.clone(),
            title: self.title.clone(),
            artist: self.artist.clone(),
            mix_name: self.mix_name.clone(),
        }
    }

    /// `file_missing` is the caller's disk check.
    pub fn health_track(&self, file_missing: bool) -> HealthTrack {
        HealthTrack {
            id: self.id.clone(),
            title: self.title.clone(),
            artist: self.artist.clone(),
            album: self.album.clone(),
            genre: self.genre.clone(),
            year: self.year,
            label: self.label.clone(),
            mood: self.mood.clone(),
            energy: self.energy,
            has_tags: self.has_tags,
            bpm: self.bpm,
            key: self.key.clone(),
            analysis_status: self.analysis_status.clone(),
            file_missing,
        }
    }
}

/// Whether a scan hit on an existing fingerprint is a *copy* worth recording,
/// rather than the same file seen again by a rescan.
///
/// On Windows separators and case are folded — the same file reached as
/// `D:\Music\a.mp3` and `d:/music/a.mp3` is not a copy. Elsewhere paths compare
/// exactly: a backslash, a leading space or a capital is a legitimate part of a
/// Unix file name.
pub fn is_distinct_copy(existing_path: &str, candidate_path: &str) -> bool {
    if cfg!(windows) {
        let fold = |path: &str| path.replace('\\', "/").to_lowercase();
        fold(existing_path) != fold(candidate_path)
    } else {
        existing_path != candidate_path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rescanning_the_same_file_is_not_a_copy() {
        assert!(!is_distinct_copy("/music/a.mp3", "/music/a.mp3"));
        assert!(is_distinct_copy("/music/a.mp3", "/backup/a.mp3"));
    }

    #[cfg(windows)]
    #[test]
    fn windows_folds_separators_and_case() {
        assert!(!is_distinct_copy("C:\\Music\\a.mp3", "c:/music/A.mp3"));
    }

    #[cfg(not(windows))]
    #[test]
    fn unix_paths_compare_exactly() {
        assert!(is_distinct_copy("/music/a.mp3", "/music/A.mp3"));
        assert!(is_distinct_copy("/music/a\\b.mp3", "/music/a/b.mp3"));
    }

    #[test]
    fn library_wide_reads_skip_removed_tracks() {
        assert!(HYGIENE_TRACKS_SQL.contains("removed_at IS NULL"));
        assert!(DUPLICATE_COPIES_SQL.contains("removed_at IS NULL"));
    }

    #[test]
    fn row_conversions_carry_the_fields_across() {
        let row = HygieneRow {
            id: "a".into(),
            title: "Song (Radio Edit)".into(),
            artist: "X".into(),
            isrc: Some("GBAAA2400001".into()),
            duration_ms: 1000,
            has_tags: true,
            analysis_status: "complete".into(),
            ..HygieneRow::default()
        };
        assert_eq!(row.duplicate_input().isrc.as_deref(), Some("GBAAA2400001"));
        assert_eq!(row.version_input().title, "Song (Radio Edit)");
        let health = row.health_track(true);
        assert!(health.file_missing && health.has_tags);
    }
}
