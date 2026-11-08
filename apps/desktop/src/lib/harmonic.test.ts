import assert from "node:assert/strict";
import { test } from "node:test";

import {
  camelotRelation,
  compatibleCamelotKeys,
  isCompatible,
  RELATION_LABELS,
  type CompatibilityMode,
} from "./harmonic.ts";

test("the same key and its relative major/minor are recognised", () => {
  assert.equal(camelotRelation("8A", "8A"), "same");
  assert.equal(camelotRelation("8A", "8B"), "relative");
  assert.equal(camelotRelation("8B", "8A"), "relative");
});

test("adjacent keys wrap around the wheel", () => {
  assert.equal(camelotRelation("8A", "9A"), "adjacent");
  assert.equal(camelotRelation("8A", "7A"), "adjacent");
  assert.equal(camelotRelation("12A", "1A"), "adjacent");
  assert.equal(camelotRelation("1A", "12A"), "adjacent");
});

test("wide keys are two steps away on the same ring", () => {
  assert.equal(camelotRelation("8A", "10A"), "wide");
  assert.equal(camelotRelation("8A", "6A"), "wide");
  assert.equal(camelotRelation("11A", "1A"), "wide");
  assert.equal(camelotRelation("12A", "2A"), "wide");
});

test("distant keys and diagonals are incompatible", () => {
  assert.equal(camelotRelation("8A", "11A"), "incompatible");
  assert.equal(camelotRelation("8A", "9B"), "incompatible");
  assert.equal(camelotRelation("12A", "3B"), "incompatible");
});

test("an unreadable key is unknown rather than incompatible", () => {
  assert.equal(camelotRelation(null, "8A"), "unknown");
  assert.equal(camelotRelation("8A", null), "unknown");
  assert.equal(camelotRelation("nope", "8A"), "unknown");
  assert.equal(camelotRelation("13A", "8A"), "unknown");
});

test("Strict accepts same, relative and adjacent; Wide adds ±2", () => {
  const strict: CompatibilityMode = "strict";
  const wide: CompatibilityMode = "wide";
  for (const relation of ["same", "relative", "adjacent"] as const) {
    assert.equal(isCompatible(relation, strict), true, relation);
    assert.equal(isCompatible(relation, wide), true, relation);
  }
  assert.equal(isCompatible("wide", strict), false);
  assert.equal(isCompatible("wide", wide), true);
  assert.equal(isCompatible("incompatible", strict), false);
  assert.equal(isCompatible("incompatible", wide), false);
  assert.equal(isCompatible("unknown", wide), false);
});

test("the compatible set is the reference plus its relatives and neighbours", () => {
  assert.deepEqual(compatibleCamelotKeys("8A", "strict"), ["7A", "8A", "8B", "9A"]);
  assert.deepEqual(compatibleCamelotKeys("8A", "wide"), ["6A", "7A", "8A", "8B", "9A", "10A"]);
});

test("the compatible set wraps at the edges of the wheel", () => {
  assert.deepEqual(compatibleCamelotKeys("12A", "strict"), ["1A", "11A", "12A", "12B"]);
  assert.deepEqual(compatibleCamelotKeys("1B", "wide"), ["1A", "1B", "2B", "3B", "11B", "12B"]);
});

test("an unreadable reference has no compatible set", () => {
  assert.deepEqual(compatibleCamelotKeys(null, "wide"), []);
  assert.deepEqual(compatibleCamelotKeys("not-a-key"), []);
});

test("every relation has a human label", () => {
  for (const relation of ["same", "relative", "adjacent", "wide", "incompatible", "unknown"]) {
    assert.ok(RELATION_LABELS[relation as keyof typeof RELATION_LABELS].length > 0);
  }
});
