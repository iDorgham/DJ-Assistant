import assert from "node:assert/strict";
import { test } from "node:test";

import { camelotColor, parseCamelot } from "./camelot.ts";

test("parses Camelot codes with whitespace and lowercase letters", () => {
  assert.deepEqual(parseCamelot("8A"), { number: 8, letter: "A" });
  assert.deepEqual(parseCamelot(" 08a "), { number: 8, letter: "A" });
  assert.equal(parseCamelot("13A"), null);
  assert.equal(parseCamelot("0B"), null);
  assert.equal(parseCamelot("H"), null);
  assert.equal(parseCamelot("A minor"), null);
  assert.equal(parseCamelot(null), null);
});

test("Camelot palette matches the reference wheel", () => {
  assert.equal(camelotColor("1A")?.hex, "#C2E3A0");
  assert.equal(camelotColor("5A")?.hex, "#A0C2E3");
  assert.equal(camelotColor("8A")?.hex, "#E3A0E3");
  assert.equal(camelotColor("10A")?.hex, "#E3A0A0");
  assert.equal(camelotColor("5B")?.hex, "#C8DBEF");
  assert.equal(camelotColor("8B")?.hex, "#EFC8EF");
  assert.equal(camelotColor("10B")?.hex, "#EFC8C8");
});

test("Camelot colour exposes translucent border and background", () => {
  const color = camelotColor("8A");
  assert.ok(color);
  assert.equal(color.border, "#E3A0E399");
  assert.equal(color.background, "#E3A0E31F");
  assert.equal(camelotColor("not-a-key"), null);
});

test("light theme uses deeper Camelot tints for readable chip text", () => {
  assert.equal(camelotColor("5A", "light")?.hex, "#224D77");
  assert.equal(camelotColor("8A", "light")?.hex, "#772277");
  assert.equal(camelotColor("5B", "light")?.hex, "#1F456B");
  assert.equal(camelotColor("8A", "light")?.border, "#77227766");
  assert.equal(camelotColor("8A", "light")?.background, "#77227714");
});
