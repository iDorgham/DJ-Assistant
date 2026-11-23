/**
 * The artwork backfill's UI state, as a reduction of the job's events.
 *
 * Kept out of the component because the interesting behaviour is all here: two
 * runs can overlap in the event stream, a late event must not revive a finished
 * run, and a failure has to stay visible rather than vanish into a green
 * summary. The component just renders what this says.
 */
import type {
  ArtworkBackfillCompletedEvent,
  ArtworkBackfillProgressEvent,
} from "@dj-assistant/shared";

export type BackfillState =
  | { phase: "idle" }
  | {
      phase: "running";
      jobId: string;
      total: number;
      processed: number;
      /** Files whose artwork could not be recorded, by path. */
      failed: string[];
    }
  | {
      phase: "done";
      jobId: string;
      total: number;
      filled: number;
      withoutArt: number;
      missingFile: number;
      unreadable: number;
      writeErrors: number;
    };

export function idleState(): BackfillState {
  return { phase: "idle" };
}

/** The state the moment `backfill_artwork` answers, before any file is read. */
export function startRun(jobId: string, total: number): BackfillState {
  return { phase: "running", jobId, total, processed: 0, failed: [] };
}

export function applyProgress(
  state: BackfillState,
  event: ArtworkBackfillProgressEvent
): BackfillState {
  if (state.phase !== "running" || event.jobId !== state.jobId) {
    return state;
  }
  return {
    ...state,
    processed: event.processed,
    failed: event.error ? [...state.failed, event.currentPath] : state.failed,
  };
}

export function applyCompleted(
  state: BackfillState,
  event: ArtworkBackfillCompletedEvent
): BackfillState {
  if (state.phase !== "running" || event.jobId !== state.jobId) {
    return state;
  }
  return {
    phase: "done",
    jobId: event.jobId,
    total: event.totalScanned,
    filled: event.totalFilled,
    withoutArt: event.withoutArt,
    missingFile: event.missingFile,
    unreadable: event.unreadable,
    writeErrors: event.writeErrors,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * One honest line about a finished run: only what happened, never a zero that
 * reads like an achievement. `null` while there is nothing to report — the
 * running state carries its own progress, and a partial sentence would imply a
 * result the job has not produced yet.
 */
export function backfillSummary(state: BackfillState): string | null {
  if (state.phase !== "done") {
    return null;
  }
  const parts = [
    state.filled > 0 ? plural(state.filled, "cover added", "covers added") : null,
    state.withoutArt > 0
      ? `${plural(state.withoutArt, "file has", "files have")} no embedded artwork`
      : null,
    state.missingFile > 0 ? `${plural(state.missingFile, "file is", "files are")} missing` : null,
    state.unreadable > 0
      ? `${plural(state.unreadable, "file could", "files could")} not be read`
      : null,
    state.writeErrors > 0 ? `${state.writeErrors} could not be saved` : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" · ") : "Every track already has artwork";
}
