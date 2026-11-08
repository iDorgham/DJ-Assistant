import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classicalFromCamelot,
  formatKeyForNotation,
  KEY_NOTATIONS,
  KEY_NOTATION_EXAMPLES,
  KEY_NOTATION_LABELS,
} from "./key-format.ts";

test("Camelot codes map to the compact Open Key notation", () => {
  assert.equal(classicalFromCamelot("1A"), "1m");
  assert.equal(classicalFromCamelot("1B"), "1d");
  assert.equal(classicalFromCamelot("8A"), "8m");
  assert.equal(classicalFromCamelot("12B"), "12d");
  assert.equal(classicalFromCamelot(" 8a "), "8m");
  assert.equal(classicalFromCamelot("nope"), null);
  assert.equal(classicalFromCamelot(null), null);
});

test("the Camelot preference shows the Camelot code first", () => {
  assert.equal(formatKeyForNotation("8A", "A minor", "camelot"), "8A");
  assert.equal(formatKeyForNotation(null, "A minor", "camelot"), "A minor");
  assert.equal(formatKeyForNotation(" 8A ", " A minor ", "camelot"), "8A");
});

test("the classical preference shows 1m / 1d and falls back to the full name", () => {
  assert.equal(formatKeyForNotation("8A", "A minor", "classical"), "8m");
  assert.equal(formatKeyForNotation("8B", "C major", "classical"), "8d");
  assert.equal(formatKeyForNotation(null, "A minor", "classical"), "A minor");
});

test("both shows the Camelot code and the other notation", () => {
  assert.equal(formatKeyForNotation("8A", "A minor", "both"), "8A · A minor");
  assert.equal(formatKeyForNotation("8A", null, "both"), "8A · 8m");
  assert.equal(formatKeyForNotation("8A", "8m", "both"), "8A · 8m");
  assert.equal(formatKeyForNotation(null, "A minor", "both"), "A minor");
});

test("a missing key is the table's em dash in every notation", () => {
  for (const notation of KEY_NOTATIONS) {
    assert.equal(formatKeyForNotation(null, null, notation), "—");
    assert.equal(formatKeyForNotation("  ", "  ", notation), "—");
  }
});

test("the preference has a label and an example for the Settings surface", () => {
  for (const notation of KEY_NOTATIONS) {
    assert.ok(KEY_NOTATION_LABELS[notation].length > 0);
    assert.ok(KEY_NOTATION_EXAMPLES[notation].length > 0);
  }
});
