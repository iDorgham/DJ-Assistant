import assert from "node:assert/strict";
import { test } from "node:test";

import type { TrackSummary } from "@dj-assistant/shared";

import {
  activeFilterCount,
  clampEnergy,
  clampRating,
  defaultSortDirection,
  describeFilters,
  describeMetadataUndo,
  describeMetadataWrite,
  filterTracks,
  formatBpm,
  formatDuration,
  formatEnergy,
  formatKey,
  formatRating,
  hasFilterValue,
  matchesQuery,
  normalizeFilters,
  scanPercent,
  shortHash,
  SORT_OPTIONS,
  toggleFilterValue,
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
    energy: null,
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

test("formatEnergy renders the level, or an em dash when none is set", () => {
  assert.equal(formatEnergy(1), "1");
  assert.equal(formatEnergy(10), "10");
  assert.equal(formatEnergy(6), "6");
  assert.equal(formatEnergy(null), "—");
  assert.equal(formatEnergy(undefined), "—");
  assert.equal(formatEnergy(0), "—", "0 is outside the 1-10 scale");
  assert.equal(formatEnergy(11), "10", "clamps above the scale");
});

test("clampEnergy and clampRating keep values inside their scale", () => {
  assert.equal(clampEnergy(5), 5);
  assert.equal(clampEnergy(0), 0, "0 means 'no energy set'");
  assert.equal(clampEnergy(11), 10);
  assert.equal(clampEnergy(-2), 0);
  assert.equal(clampEnergy(Number.NaN), 0);
  assert.equal(clampEnergy(4.4), 4);

  assert.equal(clampRating(3), 3);
  assert.equal(clampRating(0), 0, "0 means 'no rating set'");
  assert.equal(clampRating(6), 5);
  assert.equal(clampRating(-1), 0);
  assert.equal(clampRating(Number.NaN), 0);
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

test("normalizeFilters drops empty values and canonicalizes keys", () => {
  assert.equal(normalizeFilters(undefined), undefined);
  assert.equal(normalizeFilters({}), undefined);

  const normalized = normalizeFilters({
    bpmMin: 120,
    bpmMax: 130,
    keyCamelot: [" 8a ", "8A", "", "9b"],
    analysisStatus: ["complete"],
    genre: [" Techno ", "techno", "House"],
    ratingMin: 3,
  });
  assert.deepEqual(normalized, {
    bpmMin: 120,
    bpmMax: 130,
    keyCamelot: ["8A", "9B"],
    analysisStatus: ["complete"],
    genre: ["Techno", "House"],
    ratingMin: 3,
  });

  assert.equal(
    normalizeFilters({ keyCamelot: ["  "], genre: [] }),
    undefined,
    "blank lists are not an active filter"
  );
});

test("normalizeFilters ignores non-finite numeric bounds", () => {
  assert.deepEqual(normalizeFilters({ bpmMin: Number.NaN, bpmMax: 140 }), { bpmMax: 140 });
  assert.equal(normalizeFilters({ bpmMin: Number.POSITIVE_INFINITY }), undefined);
});

test("activeFilterCount counts groups, not individual values", () => {
  assert.equal(activeFilterCount(undefined), 0);
  assert.equal(activeFilterCount({}), 0);
  assert.equal(activeFilterCount({ keyCamelot: ["8A", "9A"] }), 1);
  assert.equal(activeFilterCount({ keyCamelot: ["8A"], genre: ["Techno"], ratingMin: 0 }), 3);
  assert.equal(activeFilterCount({ bpmMin: 120, bpmMax: 130 }), 1, "range is one group");
  assert.equal(
    activeFilterCount({ energyMin: 3, energyMax: 8 }),
    1,
    "the energy range is one group (matches the Rust counter)"
  );
  assert.equal(
    activeFilterCount({ ratingMin: 4, energyMin: 3 }),
    2,
    "rating and energy are separate groups"
  );
});

test("describeFilters summarizes active filters for the toolbar", () => {
  assert.deepEqual(describeFilters(undefined), []);
  assert.deepEqual(describeFilters({}), []);
  assert.deepEqual(describeFilters({ bpmMin: 120, bpmMax: 130 }), ["BPM 120–130"]);
  assert.deepEqual(describeFilters({ bpmMin: 120 }), ["BPM ≥ 120"]);
  assert.deepEqual(describeFilters({ bpmMax: 130 }), ["BPM ≤ 130"]);
  assert.deepEqual(describeFilters({ keyCamelot: ["8A", "9A"] }), ["Key 8A, 9A"]);
  assert.deepEqual(describeFilters({ analysisStatus: ["complete", "needs_review"] }), [
    "Status Analyzed, Needs review",
  ]);
  assert.deepEqual(describeFilters({ genre: ["Techno"] }), ["Genre Techno"]);
  assert.deepEqual(describeFilters({ ratingMin: 4 }), ["Rating ≥ 4★"]);
  assert.deepEqual(describeFilters({ energyMin: 3, energyMax: 8 }), ["Energy 3–8"]);
  assert.deepEqual(describeFilters({ energyMin: 3 }), ["Energy ≥ 3"]);
  assert.deepEqual(describeFilters({ energyMax: 8 }), ["Energy ≤ 8"]);
});

test("toggleFilterValue adds and removes case-insensitively", () => {
  assert.deepEqual(toggleFilterValue(undefined, "8A"), ["8A"]);
  assert.deepEqual(toggleFilterValue(["8A"], "9A"), ["8A", "9A"]);
  assert.deepEqual(toggleFilterValue(["8A", "9a"], "9A"), ["8A"], "removal ignores casing");
  assert.deepEqual(toggleFilterValue(["  "], "House"), ["House"], "blanks are dropped");
});

test("hasFilterValue matches case-insensitively and tolerates blanks", () => {
  assert.equal(hasFilterValue(["8a"], "8A"), true);
  assert.equal(hasFilterValue(["8A"], "9A"), false);
  assert.equal(hasFilterValue(undefined, "8A"), false);
});

test("defaultSortDirection puts newest imports first and everything else A-Z", () => {
  assert.equal(defaultSortDirection("imported_at"), "desc");
  for (const key of ["title", "artist", "bpm", "key", "duration"] as const) {
    assert.equal(defaultSortDirection(key), "asc");
  }
});

test("defaultSortDirection reads rating and energy best-first", () => {
  assert.equal(defaultSortDirection("rating"), "desc");
  assert.equal(defaultSortDirection("energy"), "desc");
});

test("normalizeFilters keeps the energy bounds", () => {
  assert.deepEqual(normalizeFilters({ energyMin: 3, energyMax: 8 }), {
    energyMin: 3,
    energyMax: 8,
  });
  assert.deepEqual(
    normalizeFilters({ energyMin: Number.NaN, energyMax: 8 }),
    { energyMax: 8 },
    "a non-finite bound is not an active filter"
  );
  assert.deepEqual(
    normalizeFilters({ energyMin: 3.5, energyMax: 8 }),
    { energyMax: 8 },
    "a fractional bound is dropped: the backend reads the bounds as integers"
  );
  assert.deepEqual(
    normalizeFilters({ ratingMin: 3.5 }),
    undefined,
    "a fractional rating bound is not forwarded either"
  );
});

test("SORT_OPTIONS offers rating and energy next to the other sort keys", () => {
  const values = SORT_OPTIONS.map((option) => option.value);
  assert.ok(values.includes("rating"));
  assert.ok(values.includes("energy"));
  assert.equal(new Set(values).size, values.length, "every sort key is offered exactly once");
});

test("describeMetadataWrite reports the changed tracks, not the selection", () => {
  assert.equal(describeMetadataWrite("rating", 3), "Rating saved for 3 tracks");
  assert.equal(describeMetadataWrite("rating", 1), "Rating saved for 1 track");
  assert.equal(describeMetadataWrite("energy", 2), "Energy saved for 2 tracks");
  assert.equal(
    describeMetadataWrite("rating", 0),
    "Rating unchanged — nothing to save",
    "a write that changed nothing is not announced as a save"
  );
  assert.equal(describeMetadataWrite("energy", 0), "Energy unchanged — nothing to save");
});

test("describeMetadataUndo offers no undo when nothing changed", () => {
  assert.equal(describeMetadataUndo("rating", 0, 1, "Title"), null);
  assert.equal(describeMetadataUndo("energy", 0, 3, "Title"), null);
});

test("describeMetadataUndo names the track only for a single-track edit", () => {
  assert.equal(describeMetadataUndo("rating", 1, 1, "Nightcall"), "Rated “Nightcall”");
  assert.equal(describeMetadataUndo("energy", 1, 1, "Nightcall"), "Set energy on “Nightcall”");
  assert.equal(describeMetadataUndo("rating", 1, 1, null), "Rated “Untitled”");
  assert.equal(
    describeMetadataUndo("rating", 1, 4, "Nightcall"),
    "Rated 1 track",
    "a multi-track edit never names one track"
  );
  assert.equal(describeMetadataUndo("rating", 3, 4, "Nightcall"), "Rated 3 tracks");
  assert.equal(describeMetadataUndo("energy", 2, 4, "Nightcall"), "Set energy on 2 tracks");
});
