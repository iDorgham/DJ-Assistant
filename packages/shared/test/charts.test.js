/**
 * Shape tests for versioned chart snapshots (TD.3 Tier 1).
 *
 * Snapshots are data, not live API calls (Beatport exposes no public catalog
 * API). This guards the import format in `fixtures/charts/*.SAMPLE.json` so a
 * malformed snapshot fails fast at import time, not in the UI.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const sample = JSON.parse(
  readFileSync(join(root, "fixtures", "charts", "beatport-top100-techno.SAMPLE.json"), "utf8")
);

test("sample snapshot carries chart identity", () => {
  assert.equal(sample.provider, "beatport");
  assert.ok(["top100", "hype"].includes(sample.chart));
  assert.ok(sample.genre.length > 0);
  // camelCase to match the IPC contract (serde rename_all = "camelCase"):
  // the whole file must be passable to chart_import_snapshot as-is.
  assert.match(sample.snapshotDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal("snapshot_date" in sample, false, "no snake_case request keys");
  assert.ok(Array.isArray(sample.entries) && sample.entries.length > 0);
});

test("sample entries satisfy the import contract", () => {
  const seen = new Set();
  for (const entry of sample.entries) {
    assert.ok(Number.isInteger(entry.position) && entry.position >= 1 && entry.position <= 100);
    assert.ok(entry.title.trim().length > 0);
    assert.ok(entry.artist.trim().length > 0);
    assert.ok(!seen.has(entry.position), `duplicate position ${entry.position}`);
    seen.add(entry.position);
    if (entry.isrc !== undefined) {
      assert.equal(entry.isrc, entry.isrc.toUpperCase(), "ISRCs are stored upper-cased");
    }
    if (entry.bpm !== undefined) {
      assert.ok(entry.bpm > 0 && entry.bpm < 1000);
    }
    for (const key of ["key_camelot", "source_url", "artwork_url"]) {
      assert.equal(key in entry, false, `${key} must be camelCase for the IPC contract`);
    }
  }
});
