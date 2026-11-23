import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCompleted,
  applyProgress,
  backfillSummary,
  idleState,
  startRun,
} from "./artwork-backfill.ts";
import type {
  ArtworkBackfillCompletedEvent,
  ArtworkBackfillProgressEvent,
} from "@dj-assistant/shared";

const progress = (
  over: Partial<ArtworkBackfillProgressEvent> = {}
): ArtworkBackfillProgressEvent => ({
  jobId: "job-1",
  processed: 1,
  total: 3,
  currentPath: "D:/Music/one.mp3",
  ...over,
});

const completed = (
  over: Partial<ArtworkBackfillCompletedEvent> = {}
): ArtworkBackfillCompletedEvent => ({
  jobId: "job-1",
  totalScanned: 3,
  totalFilled: 2,
  withoutArt: 1,
  missingFile: 0,
  unreadable: 0,
  writeErrors: 0,
  durationMs: 412,
  ...over,
});

test("a started run is progress-aware from its first file", () => {
  const state = applyProgress(startRun("job-1", 3), progress());
  assert.equal(state.phase, "running");
  assert.equal(state.phase === "running" && state.processed, 1);
  assert.equal(state.phase === "running" && state.total, 3);
});

test("an event from another job is ignored", () => {
  // The listener is global and a run can be restarted; a stale event must not
  // drive the row the user is watching.
  const state = applyProgress(startRun("job-2", 5), progress({ jobId: "job-1" }));
  assert.equal(state.phase === "running" && state.processed, 0);
});

test("a file that could not be recorded is kept, not swallowed", () => {
  const failed = progress({ error: "cannot record the artwork: disk I/O error" });
  const state = applyProgress(
    applyProgress(startRun("job-1", 3), failed),
    progress({ processed: 2 })
  );
  assert.equal(state.phase === "running" && state.failed.length, 1);
  assert.equal(state.phase === "running" && state.failed[0], failed.currentPath);
  assert.equal(state.phase === "running" && state.processed, 2, "the run continues past a failure");
});

test("completion replaces the running state with the tally", () => {
  const state = applyCompleted(applyProgress(startRun("job-1", 3), progress()), completed());
  assert.equal(state.phase, "done");
  assert.equal(state.phase === "done" && state.filled, 2);
});

test("a late progress event cannot revive a finished run", () => {
  const done = applyCompleted(applyProgress(startRun("job-1", 3), progress()), completed());
  const state = applyProgress(done, progress({ processed: 99 }));
  assert.equal(state, done, "the state is left exactly as it was");
});

test("an idle row has nothing to say", () => {
  assert.equal(backfillSummary(idleState()), null);
});

test("the summary names what changed and stays quiet about zeros", () => {
  const summary = backfillSummary(applyCompleted(startRun("job-1", 3), completed()));
  assert.equal(summary, "2 covers added · 1 file has no embedded artwork");
});

test("an empty library says there was nothing to do", () => {
  const state = applyCompleted(
    startRun("job-1", 0),
    completed({ totalScanned: 0, totalFilled: 0, withoutArt: 0 })
  );
  assert.equal(backfillSummary(state), "Every track already has artwork");
});

test("the summary reports files it could not use", () => {
  const state = applyCompleted(
    startRun("job-1", 4),
    completed({
      totalScanned: 4,
      totalFilled: 1,
      withoutArt: 1,
      missingFile: 1,
      unreadable: 1,
    })
  );
  assert.equal(
    backfillSummary(state),
    "1 cover added · 1 file has no embedded artwork · 1 file is missing · 1 file could not be read"
  );
});

test("a row that never reached the database is reported as a failure", () => {
  const state = applyCompleted(
    startRun("job-1", 1),
    completed({ totalScanned: 1, totalFilled: 0, withoutArt: 0, writeErrors: 1 })
  );
  assert.equal(backfillSummary(state), "1 could not be saved");
});
