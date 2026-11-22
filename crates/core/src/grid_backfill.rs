//! Backfills `tracks.beatgrid_confidence` for rows analysed before migration
//! 009 added it (issue #89).
//!
//! Pure rules, like the rest of `core`: which rows are owed a value, what may
//! be written, and the statements that do it. The desktop layer decodes the
//! files and executes them.
//!
//! The rules the module exists to keep:
//!
//! * **Only rows the normal analysis queue will never revisit.** A row that is
//!   `complete` at the current composite `analysis_version` is skipped by
//!   `analysis_candidates`, so its new column would stay `NULL` forever. Rows
//!   that are `failed` or `needs_review`, or stamped with an older version,
//!   are still queued and get the value from their next full analysis.
//! * **Only the confidence is written.** The pass recomputes the beat grid,
//!   but BPM, key and every other column keep the values the user already
//!   sees. No version bump, so nothing else is re-analysed.
//! * **A grid that disagrees with the stored tempo is not trusted.** The
//!   confidence describes one grid; if the recomputed BPM is not the stored
//!   BPM (the file changed, or the tempo was edited by hand), writing it
//!   would describe a grid the row does not have. Such a row is left for a
//!   forced re-analysis.
//! * **The write never races a full analysis.** The `UPDATE` repeats the
//!   selection predicate, so a row a full analysis re-stamped meanwhile is
//!   left as that analysis wrote it.

/// The rows owed a confidence: present, `complete` at the current composite
/// version (`?1`), and still `NULL`. Ordered for a stable, resumable pass.
pub const GRID_BACKFILL_ROWS_SQL: &str = "SELECT id, file_path, bpm FROM tracks \
     WHERE removed_at IS NULL \
       AND analysis_status = 'complete' \
       AND analysis_version = ?1 \
       AND beatgrid_confidence IS NULL \
     ORDER BY id";

/// Writes one row's confidence (`?1`) for track `?2`, only while the row is
/// still in the state [`GRID_BACKFILL_ROWS_SQL`] selected at version `?3`.
/// Zero rows changed means a full analysis or a removal got there first.
pub const GRID_BACKFILL_UPDATE_SQL: &str = "UPDATE tracks SET beatgrid_confidence = ?1 \
     WHERE id = ?2 \
       AND removed_at IS NULL \
       AND analysis_status = 'complete' \
       AND analysis_version = ?3 \
       AND beatgrid_confidence IS NULL";

/// How far the recomputed BPM may sit from the stored one and still be the
/// same grid. This is a deliberate allowance, not storage slack: the `f32`
/// detector value widens losslessly to the stored 8-byte `REAL`, so a matching
/// file gives the identical value and only a changed file or detector drifts.
pub const GRID_BPM_TOLERANCE: f64 = 0.01;

/// What the backfill does with one recomputed grid.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum GridBackfill {
    /// Write this confidence (`0..=1`).
    Write(f64),
    /// No tempo was established now, so there is no grid to describe.
    NoTempo,
    /// The row stores no BPM, or a different one: the grid is not the row's.
    BpmMismatch,
}

/// Decides one row from its stored BPM and the recomputed grid.
pub fn decide_grid_backfill(
    stored_bpm: Option<f64>,
    grid_bpm: f64,
    confidence: f64,
) -> GridBackfill {
    if !grid_bpm.is_finite() || grid_bpm <= 0.0 {
        return GridBackfill::NoTempo;
    }
    match stored_bpm {
        Some(stored) if (stored - grid_bpm).abs() <= GRID_BPM_TOLERANCE => {
            GridBackfill::Write(confidence.clamp(0.0, 1.0))
        }
        _ => GridBackfill::BpmMismatch,
    }
}

#[cfg(test)]
mod tests {
    use super::{decide_grid_backfill, GridBackfill};

    #[test]
    fn a_grid_at_the_stored_tempo_writes_its_confidence() {
        assert_eq!(
            decide_grid_backfill(Some(140.0), 140.0, 0.82),
            GridBackfill::Write(0.82)
        );
        assert_eq!(
            decide_grid_backfill(Some(127.995), 128.0, 0.5),
            GridBackfill::Write(0.5)
        );
    }

    #[test]
    fn a_confidence_outside_its_range_is_clamped() {
        assert_eq!(
            decide_grid_backfill(Some(140.0), 140.0, 1.4),
            GridBackfill::Write(1.0)
        );
        assert_eq!(
            decide_grid_backfill(Some(140.0), 140.0, -0.2),
            GridBackfill::Write(0.0)
        );
    }

    #[test]
    fn no_tempo_now_writes_nothing() {
        assert_eq!(
            decide_grid_backfill(Some(140.0), 0.0, 0.0),
            GridBackfill::NoTempo
        );
        assert_eq!(
            decide_grid_backfill(Some(140.0), f64::NAN, 0.9),
            GridBackfill::NoTempo
        );
    }

    #[test]
    fn a_grid_that_is_not_the_rows_grid_writes_nothing() {
        assert_eq!(
            decide_grid_backfill(Some(140.0), 70.0, 0.9),
            GridBackfill::BpmMismatch
        );
        assert_eq!(
            decide_grid_backfill(Some(140.0), 140.05, 0.9),
            GridBackfill::BpmMismatch
        );
        assert_eq!(
            decide_grid_backfill(None, 140.0, 0.9),
            GridBackfill::BpmMismatch
        );
    }
}
