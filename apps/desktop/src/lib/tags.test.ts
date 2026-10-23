import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMetadataUpdatePayload,
  metadataEditorValues,
  normalizeTags,
  summarizeTags,
  validateMetadataValues,
  type MetadataEditorValues,
} from "./tags.ts";

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

const TRACK = {
  title: "Night Drive",
  artist: "Vela",
  album: "Afterhours",
  genre: "Melodic House",
  label: "Night Records",
  year: 2026,
  tags: ["peak", "warmup"],
  comments: "Keep for the closing hour.",
};

test("metadataEditorValues copies the track's values", () => {
  const values = metadataEditorValues(TRACK);
  assert.equal(values.title, "Night Drive");
  assert.equal(values.label, "Night Records");
  assert.equal(values.year, "2026");
  assert.deepEqual(values.tags, ["peak", "warmup"]);
});

test("metadataEditorValues copies the tag list instead of aliasing it", () => {
  const values = metadataEditorValues(TRACK);
  values.tags.push("edited");
  assert.deepEqual(TRACK.tags, ["peak", "warmup"], "the row must not be mutated");
});

test("metadataEditorValues turns a missing field into an empty string", () => {
  const values = metadataEditorValues({
    title: "T",
    artist: "A",
    album: null,
    genre: null,
    label: null,
    year: null,
    tags: [],
    comments: null,
  });
  assert.equal(values.album, "");
  assert.equal(values.label, "");
  assert.equal(values.year, "");
  assert.equal(values.comments, "");
});

test("validateMetadataValues rejects an empty title or artist", () => {
  const base: MetadataEditorValues = {
    title: "T",
    artist: "A",
    album: "",
    genre: "",
    label: "",
    year: "",
    tags: [],
    comments: "",
  };
  assert.equal(validateMetadataValues(base), null);
  assert.match(validateMetadataValues({ ...base, title: "  " }) ?? "", /Title/);
  assert.match(validateMetadataValues({ ...base, artist: "" }) ?? "", /Artist/);
});

test("validateMetadataValues rejects a year that is not four digits", () => {
  const base: MetadataEditorValues = {
    title: "T",
    artist: "A",
    album: "",
    genre: "",
    label: "",
    year: "2026",
    tags: [],
    comments: "",
  };
  assert.equal(validateMetadataValues(base), null);
  assert.match(validateMetadataValues({ ...base, year: "26" }) ?? "", /four digits/);
  assert.match(validateMetadataValues({ ...base, year: "abcd" }) ?? "", /four digits/);
  assert.match(validateMetadataValues({ ...base, year: "0999" }) ?? "", /between 1000 and 9999/);
});

test("buildMetadataUpdatePayload sends every field the editor owns", () => {
  const payload = buildMetadataUpdatePayload(["t1", "t2"], {
    title: " Night Drive ",
    artist: " Vela ",
    album: " Afterhours ",
    genre: "",
    label: "",
    year: " 2026 ",
    tags: ["Peak", "peak", "warmup"],
    comments: "Keep for the closing hour.",
  });
  assert.deepEqual(payload.trackIds, ["t1", "t2"]);
  assert.equal(payload.title, "Night Drive");
  assert.equal(payload.artist, "Vela");
  assert.equal(payload.album, "Afterhours");
  assert.equal(payload.genre, "", "an empty field clears its column");
  assert.equal(payload.label, "");
  assert.equal(payload.year, 2026);
  assert.equal(payload.comments, "Keep for the closing hour.");
  assert.deepEqual(payload.tags, ["peak", "warmup"], "the tag list is the complete set");
});

test("buildMetadataUpdatePayload sends 0 for an empty year — the clear value", () => {
  const payload = buildMetadataUpdatePayload(["t1"], {
    title: "T",
    artist: "A",
    album: "",
    genre: "",
    label: "",
    year: "",
    tags: [],
    comments: "",
  });
  assert.equal(payload.year, 0);
  assert.deepEqual(payload.tags, []);
});
