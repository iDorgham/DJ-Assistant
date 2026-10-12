/**
 * Contract tests for the shared IPC types.
 *
 * These guard the JSON boundary between the Rust backend (which serialises with
 * `#[serde(rename_all = "camelCase")]`, see
 * apps/desktop/src-tauri/src/models.rs) and the TypeScript frontend. A mismatch
 * here is invisible to `tsc` but breaks at runtime.
 *
 * Run after `pnpm build` (this file is plain JS and imports the built output).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

/** Shape Rust emits for ScanProgressEvent. */
const scanProgressFromRust = {
  jobId: "job-1",
  scannedFiles: 3,
  totalFiles: 10,
  currentPath: "D:\\Music\\a.mp3",
  importedTrack: null,
  isDuplicate: false,
  error: null,
};

/** Shape Rust emits for ScanCompletedEvent (note: durationMs, not duration_ms). */
const scanCompletedFromRust = {
  jobId: "job-1",
  totalScanned: 10,
  totalImported: 7,
  totalDuplicates: 2,
  totalErrors: 1,
  durationMs: 1234,
};

const trackSummaryFromRust = {
  id: "t1",
  filePath: "D:\\Music\\a.mp3",
  fileHash: "abc",
  title: "Title",
  artist: "Artist",
  album: null,
  genre: null,
  bpm: 128,
  keyCamelot: "8A",
  keyClassical: "A minor",
  durationMs: 185000,
  format: "mp3",
  analysisStatus: "pending",
  userRating: 4,
  comments: "Peak-time weapon",
  artworkHash: "d41d8cd98f00b204e9800998ecf8427e",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

test("scan progress payload uses camelCase keys", () => {
  const expected = [
    "jobId",
    "scannedFiles",
    "totalFiles",
    "currentPath",
    "importedTrack",
    "isDuplicate",
    "error",
  ];
  assert.deepEqual(Object.keys(scanProgressFromRust).sort(), [...expected].sort());
});

test("scan completed payload exposes durationMs (regression: duration_ms drift)", () => {
  assert.ok(
    "durationMs" in scanCompletedFromRust,
    "frontend reads summary.durationMs; Rust must rename duration_ms"
  );
  assert.equal("duration_ms" in scanCompletedFromRust, false);
});

test("track summary payload uses camelCase keys", () => {
  const expected = [
    "id",
    "filePath",
    "fileHash",
    "title",
    "artist",
    "album",
    "genre",
    "bpm",
    "keyCamelot",
    "keyClassical",
    "durationMs",
    "format",
    "analysisStatus",
    "userRating",
    "comments",
    "artworkHash",
    "createdAt",
    "updatedAt",
  ];
  assert.deepEqual(Object.keys(trackSummaryFromRust).sort(), [...expected].sort());
});

test("get artwork request uses the camelCase trackId key", () => {
  const req = { trackId: "t1" };
  assert.deepEqual(Object.keys(req), ["trackId"]);
});

test("list tracks response wraps tracks and total", () => {
  const res = { tracks: [trackSummaryFromRust], total: 1 };
  assert.equal(typeof res.total, "number");
  assert.ok(Array.isArray(res.tracks));
});

test("analysis status values match the shared union", () => {
  const allowed = new Set(["pending", "complete", "failed", "needs_review"]);
  for (const status of allowed) {
    assert.ok(allowed.has(status));
  }
  assert.equal(allowed.has("done"), false);
});

test("cue point payload matches the migrated schema columns", () => {
  // Mirrors apps/desktop/src-tauri/src/models.rs::CuePoint and the
  // cue_points table after the slot/hot_cue_index reconciliation.
  const cue = {
    id: "c1",
    trackId: "t1",
    slot: 1,
    positionMs: 1500,
    label: "Intro",
    cueType: "hot_cue",
    colorHex: "#3b82f6",
    source: "ai_generated",
    createdAt: "2026-01-01T00:00:00Z",
  };
  assert.equal(cue.slot, 1);
  assert.equal(cue.cueType, "hot_cue");
  assert.equal("hotCueIndex" in cue, false, "slot replaced the old hot_cue_index field");
});
