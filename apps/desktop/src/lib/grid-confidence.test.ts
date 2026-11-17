import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatGridConfidence,
  gridConfidenceTier,
  GRID_CONFIDENCE_HIGH_THRESHOLD,
  GRID_CONFIDENCE_LOW_THRESHOLD,
} from "./grid-confidence.ts";

test("null and undefined confidence read as unknown", () => {
  assert.equal(gridConfidenceTier(null), "unknown");
  assert.equal(gridConfidenceTier(undefined), "unknown");
  assert.equal(formatGridConfidence(null), null);
  assert.equal(formatGridConfidence(undefined), null);
});

test("non-finite and out-of-range confidence read as unknown", () => {
  assert.equal(gridConfidenceTier(Number.NaN), "unknown");
  assert.equal(gridConfidenceTier(-0.2), "unknown");
  assert.equal(gridConfidenceTier(1.5), "unknown");
  assert.equal(formatGridConfidence(Number.NaN), null);
});

test("tiers split at the low and high thresholds", () => {
  assert.equal(gridConfidenceTier(0), "low");
  assert.equal(gridConfidenceTier(GRID_CONFIDENCE_LOW_THRESHOLD - 0.01), "low");
  assert.equal(gridConfidenceTier(GRID_CONFIDENCE_LOW_THRESHOLD), "medium");
  assert.equal(gridConfidenceTier(0.65), "medium");
  assert.equal(gridConfidenceTier(GRID_CONFIDENCE_HIGH_THRESHOLD), "high");
  assert.equal(gridConfidenceTier(1), "high");
});

test("the low threshold matches the needs_review flagging semantics", () => {
  // A grid below 0.5 alignment is a third noise beats — P2.11 wants those
  // flagged, so the badge must switch to the warning tone there.
  assert.equal(GRID_CONFIDENCE_LOW_THRESHOLD, 0.5);
});

test("confidence formats as a whole percentage", () => {
  assert.equal(formatGridConfidence(0.87), "87%");
  assert.equal(formatGridConfidence(1), "100%");
  assert.equal(formatGridConfidence(0), "0%");
});
