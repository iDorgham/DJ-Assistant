/**
 * Beat-grid confidence presentation (T2.4.3). The analysis layer stores the
 * grid's alignment ratio (`tracks.beatgrid_confidence`, 0..=1); this module
 * turns it into the tier and label the player chip renders.
 */

/** Below this a grid is a third noise beats — P2.11 wants it flagged. */
export const GRID_CONFIDENCE_LOW_THRESHOLD = 0.5;
/** At or above this the grid can be trusted without a listening check. */
export const GRID_CONFIDENCE_HIGH_THRESHOLD = 0.8;

export type GridConfidenceTier = "unknown" | "low" | "medium" | "high";

export function gridConfidenceTier(confidence: number | null | undefined): GridConfidenceTier {
  if (confidence == null || !Number.isFinite(confidence)) return "unknown";
  if (confidence < 0 || confidence > 1) return "unknown";
  if (confidence < GRID_CONFIDENCE_LOW_THRESHOLD) return "low";
  if (confidence < GRID_CONFIDENCE_HIGH_THRESHOLD) return "medium";
  return "high";
}

/** Whole-percentage label ("87%"); null when there is nothing to show. */
export function formatGridConfidence(confidence: number | null | undefined): string | null {
  if (gridConfidenceTier(confidence) === "unknown") return null;
  return `${Math.round((confidence as number) * 100)}%`;
}

/** The counts the launch backfill (issue #89) reports back. */
export interface GridBackfillCounts {
  updated: number;
  failed: number;
}

/**
 * Status-line wording for the one-off launch backfill, or null when it filled
 * nothing and has nothing to report. Failures alone are logged, not shown: the
 * user did not start this pass and those rows keep showing no chip, as before.
 */
export function gridBackfillStatus(
  counts: GridBackfillCounts
): { message: string; tone: "ok" | "error" } | null {
  if (counts.updated <= 0) return null;
  const tracks = `${counts.updated} track${counts.updated === 1 ? "" : "s"}`;
  if (counts.failed > 0) {
    return {
      message: `Measured beat-grid confidence for ${tracks} — ${counts.failed} couldn't be read.`,
      tone: "error",
    };
  }
  return { message: `Measured beat-grid confidence for ${tracks}.`, tone: "ok" };
}
