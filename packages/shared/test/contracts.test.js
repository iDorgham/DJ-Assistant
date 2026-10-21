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
  energy: null,
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
    "energy",
    "comments",
    "artworkHash",
    "createdAt",
    "updatedAt",
  ];
  assert.deepEqual(Object.keys(trackSummaryFromRust).sort(), [...expected].sort());
});

test("track metadata write and undo use camelCase keys", () => {
  // Mirrors models.rs::UpdateTrackMetadataRequest/Response +
  // UndoTrackMetadataRequest/Response.
  const req = { trackIds: ["t1", "t2"], rating: 4, energy: 7 };
  assert.deepEqual(Object.keys(req).sort(), ["energy", "rating", "trackIds"]);
  const res = { undoId: "run-1", updated: 2 };
  assert.deepEqual(Object.keys(res).sort(), ["undoId", "updated"]);
  const undoReq = { undoId: "run-1" };
  assert.deepEqual(Object.keys(undoReq), ["undoId"]);
  // `skipped` counts the tracks that were edited again after the snapshot, so
  // the undo must not overwrite the newer edit.
  const undoRes = { restored: 1, skipped: 2 };
  assert.deepEqual(Object.keys(undoRes).sort(), ["restored", "skipped"]);
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

test("analyze library request/response use camelCase keys", () => {
  // Mirrors models.rs::AnalyzeLibraryRequest/Response.
  const req = { trackIds: ["t1", "t2"], force: true };
  assert.deepEqual(Object.keys(req).sort(), ["force", "trackIds"]);
  const res = { jobId: "job-1", total: 2 };
  assert.deepEqual(Object.keys(res).sort(), ["jobId", "total"]);
});

test("analysis progress event uses camelCase keys", () => {
  // Mirrors models.rs::AnalysisProgressEvent.
  const event = {
    jobId: "job-1",
    processed: 3,
    total: 10,
    trackId: "t2",
    filePath: "D:\\Music\\a.mp3",
    analysisStatus: "complete",
    error: null,
  };
  assert.deepEqual(Object.keys(event).sort(), [
    "analysisStatus",
    "error",
    "filePath",
    "jobId",
    "processed",
    "total",
    "trackId",
  ]);
});

test("analysis completed event uses camelCase keys", () => {
  // Mirrors models.rs::AnalysisCompletedEvent.
  const event = {
    jobId: "job-1",
    total: 10,
    succeeded: 9,
    failed: 1,
    durationMs: 4500,
  };
  assert.deepEqual(Object.keys(event).sort(), [
    "durationMs",
    "failed",
    "jobId",
    "succeeded",
    "total",
  ]);
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

test("find similar tracks request/response use camelCase keys", () => {
  // Mirrors models.rs::FindSimilarTracksRequest/Response + SimilarTrackResult
  // (which flattens TrackSummary, so track keys stay camelCase too).
  const req = { trackId: "t1", limit: 10 };
  assert.deepEqual(Object.keys(req).sort(), ["limit", "trackId"]);
  const result = {
    ...trackSummaryFromRust,
    score: 0.93,
    reasons: ["same key 8A", "same BPM"],
  };
  assert.ok(result.score >= 0 && result.score <= 1, "score is 0–1");
  assert.ok(Array.isArray(result.reasons));
  assert.equal("track_id" in result, false, "flattened summary must stay camelCase");
  const res = { seedTrackId: "t1", results: [result] };
  assert.deepEqual(Object.keys(res).sort(), ["results", "seedTrackId"]);
});

test("tag health payload exposes gaps and per-field totals", () => {
  // Mirrors models.rs::TagHealthResponse.
  const res = {
    checked: 94,
    withGaps: 12,
    gaps: [
      {
        trackId: "t2",
        title: "X",
        artist: "Unknown Artist",
        missing: ["artist", "bpm", "artwork", "isrc"],
        score: 51,
      },
    ],
    totals: [{ field: "isrc", missingCount: 12 }],
    averageScore: 88.5,
  };
  assert.deepEqual(Object.keys(res).sort(), [
    "averageScore",
    "checked",
    "gaps",
    "totals",
    "withGaps",
  ]);
  assert.deepEqual(Object.keys(res.gaps[0]).sort(), [
    "artist",
    "missing",
    "score",
    "title",
    "trackId",
  ]);
  assert.deepEqual(Object.keys(res.totals[0]).sort(), ["field", "missingCount"]);
});

test("store links payload carries provider, label and https url", () => {
  // Mirrors models.rs::StoreLinksResponse; URLs are store search pages only.
  const res = {
    trackId: "t1",
    artist: "Bicep",
    title: "Glue",
    links: [
      {
        provider: "beatport",
        label: "Beatport",
        url: "https://www.beatport.com/search?q=Bicep+Glue",
      },
    ],
  };
  assert.deepEqual(Object.keys(res).sort(), ["artist", "links", "title", "trackId"]);
  for (const link of res.links) {
    assert.deepEqual(Object.keys(link).sort(), ["label", "provider", "url"]);
    assert.ok(link.url.startsWith("https://"), "store links are outbound https only");
  }
});

test("provider status payload uses the closed provider enums", () => {
  // Mirrors models.rs::ProviderStatusResponse + core provider registry.
  const res = {
    connected: [],
    supportedStreaming: [
      "spotify",
      "deezer",
      "apple_music",
      "youtube_music",
      "soundcloud",
      "tidal",
    ],
    supportedStores: ["beatport", "traxsource", "juno_download", "bandcamp", "discogs"],
    capabilities: [
      {
        provider: "deezer",
        liveMatch: true,
        isrcSearch: true,
        playlistWrite: false,
        needsAppId: true,
      },
    ],
  };
  assert.deepEqual(Object.keys(res).sort(), [
    "capabilities",
    "connected",
    "supportedStores",
    "supportedStreaming",
  ]);
  assert.ok(
    res.supportedStreaming.includes("spotify"),
    "spotify stays the reference export target"
  );
  assert.ok(
    res.supportedStores.includes("beatport"),
    "beatport covered via buy-links (no catalog API)"
  );
});

test("enrichment preview/apply/undo payloads use camelCase keys", () => {
  // Mirrors models.rs::EnrichmentPreviewResponse + TrackProposal + apply/undo.
  const previewReq = { provider: "musicbrainz", limit: 25 };
  assert.deepEqual(Object.keys(previewReq).sort(), ["limit", "provider"]);
  const res = {
    runId: "run-1",
    provider: "musicbrainz",
    proposedTracks: 1,
    proposedChanges: 2,
    skipped: 0,
    proposals: [
      {
        trackId: "t2",
        title: "X",
        artist: "Unknown Artist",
        provider: "musicbrainz",
        providerId: "mbid-1",
        confidence: 0.92,
        tier: "high",
        sourceUrl: "https://musicbrainz.org/recording/mbid-1",
        changes: [
          { field: "artist", current: "Unknown Artist", proposed: "Bicep" },
          { field: "album", current: null, proposed: "Bicep" },
        ],
      },
    ],
  };
  assert.deepEqual(Object.keys(res).sort(), [
    "proposals",
    "proposedChanges",
    "proposedTracks",
    "provider",
    "runId",
    "skipped",
  ]);
  const proposal = res.proposals[0];
  assert.ok(proposal.confidence >= 0 && proposal.confidence <= 1);
  assert.deepEqual(Object.keys(proposal.changes[0]).sort(), ["current", "field", "proposed"]);
  const applyRes = { runId: "run-1", applied: 2, skipped: 0 };
  assert.deepEqual(Object.keys(applyRes).sort(), ["applied", "runId", "skipped"]);
  const undoRes = { runId: "run-1", restored: 1 };
  assert.deepEqual(Object.keys(undoRes).sort(), ["restored", "runId"]);
});

test("enrichment progress event uses camelCase keys", () => {
  const event = {
    runId: "run-1",
    processed: 3,
    total: 10,
    trackId: "t2",
    status: "proposed (high)",
  };
  assert.deepEqual(Object.keys(event).sort(), ["processed", "runId", "status", "total", "trackId"]);
});

test("provider match payload carries tier and status per track", () => {
  // Mirrors models.rs::ProviderMatchTracksResponse (TX.1/TX.2a: live reads, no writes).
  const res = {
    provider: "deezer",
    matches: [
      {
        trackId: "t1",
        provider: "deezer",
        providerId: "389034231",
        title: "Glue",
        artist: "Bicep",
        album: "Glue",
        artworkUrl: "https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg",
        sourceUrl: "https://www.deezer.com/track/389034231",
        confidence: 0.95,
        tier: "high",
        status: "matched",
      },
    ],
  };
  assert.deepEqual(Object.keys(res).sort(), ["matches", "provider"]);
  const match = res.matches[0];
  assert.ok(["matched", "review", "unmatched"].includes(match.status));
  assert.ok(["high", "review", "low"].includes(match.tier));
});

test("chart snapshot import/list payloads use camelCase keys", () => {
  // Mirrors models.rs::ChartImportRequest/Response + ChartListResponse.
  // Shape-validated against fixtures/charts/beatport-top100-techno.SAMPLE.json.
  const importReq = {
    provider: "beatport",
    chart: "top100",
    genre: "techno",
    snapshotDate: "2026-10-14",
    entries: [
      {
        position: 1,
        title: "Sample Peak A",
        artist: "Sample Artist",
        label: "Sample Records",
        isrc: "XXAAA2600001",
        bpm: 132.0,
        keyCamelot: "11A",
        sourceUrl: "https://www.beatport.com/search?q=Sample+Artist+Sample+Peak+A",
      },
    ],
  };
  assert.deepEqual(Object.keys(importReq).sort(), [
    "chart",
    "entries",
    "genre",
    "provider",
    "snapshotDate",
  ]);
  const importRes = {
    provider: "beatport",
    chart: "top100",
    genre: "techno",
    snapshotDate: "2026-10-14",
    imported: 3,
    skipped: 0,
  };
  assert.deepEqual(Object.keys(importRes).sort(), [
    "chart",
    "genre",
    "imported",
    "provider",
    "skipped",
    "snapshotDate",
  ]);
  const listRes = {
    provider: "beatport",
    chart: "top100",
    genre: "techno",
    snapshotDate: "2026-10-14",
    entries: [
      {
        position: 1,
        title: "Sample Peak A",
        artist: "Sample Artist",
        label: "Sample Records",
        isrc: "XXAAA2600001",
        bpm: 132.0,
        keyCamelot: "11A",
        artworkUrl: null,
        sourceUrl: "https://www.beatport.com/search?q=Sample+Artist+Sample+Peak+A",
        owned: false,
        tasteScore: 0.93,
      },
    ],
    total: 3,
  };
  assert.deepEqual(Object.keys(listRes).sort(), [
    "chart",
    "entries",
    "genre",
    "provider",
    "snapshotDate",
    "total",
  ]);
});

test("list tracks request uses camelCase filter and sort keys", () => {
  // T2.1.2: filters run server-side, so a snake_case drift here silently
  // disables filtering (serde drops unknown fields instead of failing).
  const request = {
    query: "deep",
    filters: {
      bpmMin: 120,
      bpmMax: 130,
      keyCamelot: ["8A", "9A"],
      analysisStatus: ["complete"],
      genre: ["Techno"],
      ratingMin: 3,
    },
    sortBy: "bpm",
    sortDir: "desc",
    limit: 200,
    offset: 0,
  };
  assert.deepEqual(Object.keys(request.filters).sort(), [
    "analysisStatus",
    "bpmMax",
    "bpmMin",
    "genre",
    "keyCamelot",
    "ratingMin",
  ]);
  for (const snake of ["bpm_min", "bpm_max", "key_camelot", "analysis_status", "rating_min"]) {
    assert.equal(snake in request.filters, false, `${snake} would be ignored by serde`);
  }
  assert.deepEqual(Object.keys(request).sort(), [
    "filters",
    "limit",
    "offset",
    "query",
    "sortBy",
    "sortDir",
  ]);
});

test("list genres response carries genre/count pairs", () => {
  const response = { genres: [{ genre: "Techno", count: 12 }] };
  assert.deepEqual(Object.keys(response), ["genres"]);
  assert.deepEqual(Object.keys(response.genres[0]).sort(), ["count", "genre"]);
});
