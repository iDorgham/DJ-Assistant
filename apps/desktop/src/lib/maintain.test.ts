import assert from "node:assert/strict";
import { test } from "node:test";

import type { HealthCategoryView, MaintainTrack } from "@dj-assistant/shared";

import {
  affectedNote,
  categoryDetail,
  duplicatesSummary,
  formatDuration,
  formatQuality,
  healthSummary,
  keepConfirmLabel,
  prepCheckDetail,
  prepScopeText,
  prepVerdictText,
  prepVerdictTone,
  reasonLabel,
  scoreText,
  scoreTone,
  suggestedKeeper,
  versionChipLabel,
  versionKindLabel,
  versionsSummary,
} from "./maintain.ts";

function track(id: string, format: string | null, bitrateKbps: number | null): MaintainTrack {
  return { id, title: "T", artist: "A", durationMs: 1, filePath: `/${id}`, format, bitrateKbps };
}

function category(partial: Partial<HealthCategoryView>): HealthCategoryView {
  return {
    id: "files",
    label: "Files",
    weight: 15,
    configured: true,
    score: 100,
    counts: [],
    affected: [],
    affectedTotal: 0,
    ...partial,
  };
}

test("durations format as m:ss and unknown lengths as a dash", () => {
  assert.equal(formatDuration(432_000), "7:12");
  assert.equal(formatDuration(61_499), "1:01");
  assert.equal(formatDuration(0), "–");
  assert.equal(formatDuration(Number.NaN), "–");
});

test("quality joins format and bitrate", () => {
  assert.equal(formatQuality({ format: "mp3", bitrateKbps: 320 }), "MP3 · 320 kbps");
  assert.equal(formatQuality({ format: "flac", bitrateKbps: null }), "FLAC");
  assert.equal(formatQuality({ format: null, bitrateKbps: 0 }), "");
});

test("the suggested keeper prefers lossless, then bitrate, then list order", () => {
  assert.equal(suggestedKeeper([track("a", "mp3", 320), track("b", "flac", 900)]), "b");
  assert.equal(suggestedKeeper([track("a", "mp3", 192), track("b", "mp3", 320)]), "b");
  assert.equal(suggestedKeeper([track("a", "mp3", 320), track("b", "mp3", 320)]), "a");
  assert.equal(suggestedKeeper([]), null);
});

test("reason and confirm wording", () => {
  assert.equal(reasonLabel("same_isrc"), "Same ISRC");
  assert.equal(reasonLabel("near_match"), "Same artist, title and length");
  assert.match(keepConfirmLabel(1), /other copy/);
  assert.match(keepConfirmLabel(2), /other 2 copies/);
  assert.match(keepConfirmLabel(1), /stays on disk/);
});

test("duplicate summary names groups, copies and hidden groups", () => {
  assert.equal(duplicatesSummary(0, 0, 0), "No duplicates found.");
  assert.equal(duplicatesSummary(0, 0, 2), "No duplicates found. 2 kept-both groups are hidden.");
  assert.equal(duplicatesSummary(1, 2, 0), "1 group to review · 2 skipped file copies");
});

test("version chips show the marker as written, else the kind", () => {
  assert.equal(versionChipLabel("extended", "Extended Mix"), "Extended Mix");
  assert.equal(versionChipLabel("original", null), "Original");
  assert.equal(versionChipLabel("vip", "  "), "VIP");
  assert.equal(versionKindLabel("instrumental"), "Instrumental");
  assert.equal(versionsSummary(0), "No version families found.");
  assert.match(versionsSummary(3), /^3 records have/);
});

test("score tone bands and text", () => {
  assert.equal(scoreTone(92), "good");
  assert.equal(scoreTone(70), "fair");
  assert.equal(scoreTone(10), "poor");
  assert.equal(scoreTone(null), "neutral");
  // The colour follows the number shown, which is rounded.
  assert.equal(scoreTone(84.6), "good");
  assert.equal(scoreTone(59.4), "poor");
  assert.equal(scoreText(84.6), "85");
  assert.equal(scoreText(null), "–");
});

test("category detail explains neutral, clear and failing categories", () => {
  assert.equal(
    categoryDetail(category({ configured: false, score: null })),
    "Not set up yet — does not affect the score"
  );
  assert.equal(
    categoryDetail(category({ counts: [{ label: "Missing on disk", count: 0 }] })),
    "All clear"
  );
  assert.equal(
    categoryDetail(
      category({
        counts: [
          { label: "Missing BPM", count: 3 },
          { label: "Missing key", count: 0 },
          { label: "Analysis incomplete", count: 5 },
        ],
      })
    ),
    "Missing BPM: 3 · Analysis incomplete: 5"
  );
});

test("affected note appears only when the list is capped", () => {
  assert.equal(affectedNote(500, 812), "Showing 500 of 812 tracks.");
  assert.equal(affectedNote(3, 3), null);
});

test("health summary covers empty, healthy and needs-care libraries", () => {
  assert.match(healthSummary(null, 0), /No tracks yet/);
  assert.match(healthSummary(97, 10), /looks healthy/);
  assert.match(healthSummary(70, 1), /over 1 track\./);
});

const prepCheck = (severity: "blocker" | "warning", failingTotal: number) => ({
  id: severity,
  label: severity,
  severity,
  fix: "Fix it",
  failing: [],
  failingTotal,
});

test("the prep verdict counts the failing blockers and warnings", () => {
  const checks = [prepCheck("blocker", 2), prepCheck("warning", 1), prepCheck("warning", 0)];
  assert.equal(
    prepVerdictText({ verdict: "not_ready", scope: "selection", checks }),
    "Not ready — 1 blocker · 1 warning."
  );
  assert.equal(
    prepVerdictText({
      verdict: "almost_ready",
      scope: "library",
      checks: [prepCheck("warning", 3)],
    }),
    "Almost ready — 1 warning."
  );
  assert.equal(
    prepVerdictText({ verdict: "ready", scope: "library", checks: [] }),
    "Ready to play — every check passes."
  );
  assert.match(prepVerdictText({ verdict: "empty", scope: "selection", checks: [] }), /selected/);
  assert.equal(prepVerdictTone("not_ready"), "poor");
  assert.equal(prepVerdictTone("empty"), "neutral");
});

test("the prep scope names the selection or the library, and removed picks", () => {
  assert.equal(
    prepScopeText({ scope: "selection", trackCount: 1, skippedCount: 0 }),
    "1 selected track"
  );
  assert.equal(
    prepScopeText({ scope: "library", trackCount: 94, skippedCount: 0 }),
    "the whole library (94 tracks)"
  );
  assert.equal(
    prepScopeText({ scope: "selection", trackCount: 10, skippedCount: 2 }),
    "10 selected tracks; 2 selected tracks are no longer in the library"
  );
});

test("a prep check reads all clear or its failing count and fix", () => {
  assert.equal(prepCheckDetail({ failingTotal: 0, fix: "Analyze" }), "All clear");
  assert.equal(prepCheckDetail({ failingTotal: 3, fix: "Analyze" }), "3 tracks — Analyze");
});
