import assert from "node:assert/strict";
import { test } from "node:test";

import type { TrackSummary } from "@dj-assistant/shared";

import {
  filterTracks,
  formatBpm,
  formatDuration,
  formatKey,
  formatRating,
  matchesQuery,
  scanPercent,
  shortHash,
  truncateComment,
} from "./library.ts";

function track(over: Partial<TrackSummary> = {}): TrackSummary {
  return {
    id: "t1",
    filePath: "D:\\Music\\artist - title.mp3",
    fileHash: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    title: "Title",
    artist: "Artist",
    album: "Album",
    genre: null,
    bpm: null,
    keyCamelot: null,
    keyClassical: null,
    durationMs: 185_000,
    format: "mp3",
    analysisStatus: "pending",
    userRating: null,
    comments: null,
    artworkHash: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

test("formatDuration renders m:ss", () => {
  assert.equal(formatDuration(185_000), "3:05");
  assert.equal(formatDuration(60_000), "1:00");
  assert.equal(formatDuration(9_000), "0:09");
  assert.equal(formatDuration(3_600_000), "60:00");
});

test("formatDuration handles unknown or invalid input", () => {
  assert.equal(formatDuration(0), "--:--");
  assert.equal(formatDuration(-5), "--:--");
  assert.equal(formatDuration(Number.NaN), "--:--");
  assert.equal(formatDuration(Number.POSITIVE_INFINITY), "--:--");
});

test("shortHash truncates long hashes and tolerates missing ones", () => {
  assert.equal(shortHash("a1b2c3d4e5f6"), "a1b2c3d4...");
  assert.equal(shortHash("abc"), "abc");
  assert.equal(shortHash(null), "—");
  assert.equal(shortHash(undefined), "—");
});

test("scanPercent computes progress and defaults while total is unknown", () => {
  assert.equal(scanPercent(0, 0), 25);
  assert.equal(scanPercent(5, 10), 50);
  assert.equal(scanPercent(10, 10), 100);
  assert.equal(scanPercent(20, 10), 100, "never exceeds 100%");
});

test("formatBpm renders whole numbers plainly and one decimal otherwise", () => {
  assert.equal(formatBpm(128), "128");
  assert.equal(formatBpm(128.06), "128.1");
  assert.equal(formatBpm(174.5), "174.5");
  assert.equal(formatBpm(0), "—");
  assert.equal(formatBpm(-1), "—");
  assert.equal(formatBpm(Number.NaN), "—");
  assert.equal(formatBpm(null), "—");
  assert.equal(formatBpm(undefined), "—");
});

test("formatKey prefers the Camelot code and falls back to the classical name", () => {
  assert.equal(formatKey("8A", "A minor"), "8A");
  assert.equal(formatKey(null, "A minor"), "A minor");
  assert.equal(formatKey("  ", "  "), "—");
  assert.equal(formatKey(null, null), "—");
  assert.equal(formatKey(undefined, undefined), "—");
});

test("formatRating renders five stars with the filled ones first", () => {
  assert.equal(formatRating(0), "☆☆☆☆☆");
  assert.equal(formatRating(4), "★★★★☆");
  assert.equal(formatRating(5), "★★★★★");
  assert.equal(formatRating(6), "★★★★★", "clamps above the scale");
  assert.equal(formatRating(null), "—");
  assert.equal(formatRating(undefined), "—");
});

test("truncateComment collapses whitespace and ellipsizes long comments", () => {
  assert.equal(truncateComment("Peak time   weapon"), "Peak time weapon");
  assert.equal(truncateComment("short"), "short");
  assert.equal(truncateComment("  "), "—");
  assert.equal(truncateComment(null), "—");
  assert.equal(truncateComment(undefined), "—");

  const long = "a".repeat(60);
  const truncated = truncateComment(long, 20);
  assert.equal(truncated.length, 20);
  assert.equal(truncated.at(-1), "…");
  assert.equal(truncateComment("a".repeat(20), 20), "a".repeat(20), "exact fit is untouched");
});

test("matchesQuery searches title, artist, album and path case-insensitively", () => {
  const t = track();
  assert.ok(matchesQuery(t, "title"));
  assert.ok(matchesQuery(t, "ARTIST"));
  assert.ok(matchesQuery(t, "album"));
  assert.ok(matchesQuery(t, "music"));
  assert.ok(matchesQuery(t, "   "), "blank query matches everything");
  assert.equal(matchesQuery(t, "techno"), false);
});

test("matchesQuery survives null optional fields", () => {
  const t = track({
    title: "Only Title",
    artist: "Only Artist",
    album: null,
    filePath: "C:\\a.mp3",
  });
  assert.ok(matchesQuery(t, "only"));
  assert.equal(matchesQuery(t, "album"), false);
});

test("filterTracks returns the original list for a blank query", () => {
  const tracks = [track({ id: "1", title: "Alpha" }), track({ id: "2", title: "Beta" })];
  assert.equal(filterTracks(tracks, "").length, 2);
  assert.deepEqual(
    filterTracks(tracks, "beta").map((t) => t.id),
    ["2"]
  );
  assert.deepEqual(filterTracks(tracks, "zzz"), []);
});
