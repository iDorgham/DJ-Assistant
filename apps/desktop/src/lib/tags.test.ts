import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeTags, summarizeTags } from "./tags.ts";

test("normalizeTags trims, folds to lower case and drops blanks", () => {
  assert.deepEqual(normalizeTags(["  Peak  ", "", "   "]), ["peak"]);
});

test("normalizeTags de-duplicates case-insensitively", () => {
  assert.deepEqual(normalizeTags(["Peak", "peak", "PEAK"]), ["peak"]);
});

test("normalizeTags sorts the result so the chips have one stable order", () => {
  assert.deepEqual(normalizeTags(["Warmup", "peak", "build"]), ["build", "peak", "warmup"]);
});

test("normalizeTags keeps the inner spaces of a tag", () => {
  assert.deepEqual(normalizeTags(["peak time"]), ["peak time"]);
});

test("normalizeTags folds ASCII only, like SQLite's LOWER()", () => {
  // A Unicode fold would produce a tag the SQL filter could never match:
  // SQLite's built-in LOWER() folds ASCII letters only.
  assert.deepEqual(normalizeTags(["ÄÖÜ"]), ["ÄÖÜ"]);
  assert.deepEqual(normalizeTags(["MIXED case"]), ["mixed case"]);
});

test("normalizeTags on an empty list yields no tags", () => {
  assert.deepEqual(normalizeTags([]), []);
  assert.deepEqual(normalizeTags(undefined), []);
});

test("summarizeTags cuts the cell down to the visible chips", () => {
  const summary = summarizeTags(["a", "b", "c", "d"], 2);
  assert.deepEqual(summary.visible, ["a", "b"]);
  assert.equal(summary.overflow, 2);
});

test("summarizeTags reports no overflow when everything fits", () => {
  const summary = summarizeTags(["a", "b"], 2);
  assert.deepEqual(summary.visible, ["a", "b"]);
  assert.equal(summary.overflow, 0);
});

test("summarizeTags hides everything when the budget is zero", () => {
  const summary = summarizeTags(["a", "b"], 0);
  assert.deepEqual(summary.visible, []);
  assert.equal(summary.overflow, 2);
});

test("summarizeTags survives a broken budget", () => {
  const summary = summarizeTags(["a"], Number.NaN);
  assert.deepEqual(summary.visible, []);
  assert.equal(summary.overflow, 1);
});
