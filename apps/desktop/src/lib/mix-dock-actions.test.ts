import assert from "node:assert/strict";
import { test } from "node:test";

import { addSuggestionToSelection, replaceSeedInSelection } from "./mix-dock-actions.ts";

test("add appends a new suggestion", () => {
  assert.deepEqual(addSuggestionToSelection(["a", "b"], "x"), ["a", "b", "x"]);
  assert.deepEqual(addSuggestionToSelection([], "x"), ["x"]);
});

test("add of an already-selected track returns the same array", () => {
  const selection = ["a", "x"];
  assert.equal(addSuggestionToSelection(selection, "x"), selection);
});

test("replace swaps the seed in place, keeping the selection order", () => {
  assert.deepEqual(replaceSeedInSelection(["a", "b", "c"], "b", "x"), ["a", "x", "c"]);
});

test("replace without a seed appends the candidate", () => {
  assert.deepEqual(replaceSeedInSelection(["a", "b"], null, "x"), ["a", "b", "x"]);
});

test("replace with a seed that is not in the selection appends the candidate", () => {
  assert.deepEqual(replaceSeedInSelection(["a", "b"], "z", "x"), ["a", "b", "x"]);
});

test("replace of a seed whose candidate is already selected drops the seed only", () => {
  assert.deepEqual(replaceSeedInSelection(["a", "x"], "a", "x"), ["x"]);
  assert.deepEqual(replaceSeedInSelection(["a", "x", "b"], "a", "x"), ["x", "b"]);
});

test("replace that changes nothing returns the same array", () => {
  const selection = ["a", "x"];
  assert.equal(replaceSeedInSelection(selection, null, "x"), selection);
});
