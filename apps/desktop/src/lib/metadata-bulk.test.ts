import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBulkDiff,
  buildBulkPatch,
  bulkSeedValues,
  changedBulkFields,
  surveyFields,
  validateBulkValues,
} from "./metadata-bulk.ts";
import type { MetadataSource } from "./tags.ts";

/** A row with only the editable fields filled in, the rest left blank. */
function track(over: Partial<MetadataSource> & { title: string }): MetadataSource {
  return { artist: "A", tags: [], ...over };
}

const HOUSE = track({ id: "1", title: "One", genre: "House", year: 2024, tags: ["peak"] });
const TECHNO = track({ id: "2", title: "Two", genre: "Techno", year: 2024, tags: ["peak"] });
const BLANK_GENRE = track({ id: "3", title: "Three", year: 2021, tags: [] });

test("a field every track agrees on surveys as that value", () => {
  const survey = surveyFields([HOUSE, TECHNO]);
  assert.deepEqual(survey.year, { state: "single", value: "2024" });
  assert.deepEqual(survey.tags, { state: "single", value: "peak" });
});

test("a field the tracks disagree on surveys as mixed with its distinct count", () => {
  const survey = surveyFields([HOUSE, TECHNO]);
  assert.deepEqual(survey.genre, { state: "mixed", count: 2 });
});

test("a blank alongside a value is a disagreement, not a shared blank", () => {
  // One track has no genre: the selection is mixed, so the editor must not
  // offer a single value the user could mistake for the whole selection's.
  const survey = surveyFields([HOUSE, BLANK_GENRE]);
  assert.deepEqual(survey.genre, { state: "mixed", count: 2 });
});

test("a field every track leaves empty surveys as blank", () => {
  const survey = surveyFields(
    [HOUSE, TECHNO].map((entry) => track({ id: entry.id, title: entry.title }))
  );
  assert.deepEqual(survey.label, { state: "blank" });
});

test("the tag set is compared as a set, so chip order is not a difference", () => {
  const a = track({ id: "1", title: "One", tags: ["peak", "warmup"] });
  const b = track({ id: "2", title: "Two", tags: ["warmup", "peak"] });
  assert.deepEqual(surveyFields([a, b]).tags, { state: "single", value: "peak, warmup" });
});

test("the dialog seeds an agreed field and leaves a mixed one empty", () => {
  // A mixed field seeds blank rather than the focused track's value: whatever
  // the dialog holds is what a bulk write would apply to every track.
  const values = bulkSeedValues([HOUSE, TECHNO]);
  assert.equal(values.genre, "");
  assert.equal(values.year, "2024");
});

test("a single track seeds every field with its own value", () => {
  assert.deepEqual(bulkSeedValues([HOUSE]), {
    title: "One",
    artist: "A",
    album: "",
    genre: "House",
    label: "",
    year: "2024",
    tags: ["peak"],
    comments: "",
  });
});

test("the seed copies the tag list instead of aliasing the row's", () => {
  // The dialog edits its own chips; mutating the seed must not reach the row
  // the table is still rendering.
  const values = bulkSeedValues([HOUSE]);
  values.tags.push("edited");
  assert.deepEqual(HOUSE.tags, ["peak"]);
});

test("an untouched field is not a change", () => {
  const from = bulkSeedValues([HOUSE, TECHNO]);
  assert.deepEqual(changedBulkFields(from, { ...from }), []);
});

test("a mixed field left empty is not a change", () => {
  // The user opened the dialog on a mixed selection and only edited the
  // comment: the empty genre must not be read as "clear the genre".
  const from = bulkSeedValues([HOUSE, TECHNO]);
  assert.deepEqual(changedBulkFields(from, { ...from, comments: "prime time" }), ["comments"]);
});

test("typing over a mixed field is a change to that field alone", () => {
  const from = bulkSeedValues([HOUSE, TECHNO]);
  assert.deepEqual(changedBulkFields(from, { ...from, genre: "Melodic House" }), ["genre"]);
});

test("the patch carries only the changed fields", () => {
  const from = bulkSeedValues([HOUSE, TECHNO]);
  const patch = buildBulkPatch(["1", "2"], from, { ...from, comments: "closed set" });
  assert.deepEqual(patch, { trackIds: ["1", "2"], comments: "closed set" });
  assert.equal("genre" in patch, false, "an untouched column must be absent, not empty");
  assert.equal("tags" in patch, false, "an absent tag list leaves the tags alone");
});

test("clearing a field the selection agreed on writes the empty value", () => {
  const from = bulkSeedValues([HOUSE, TECHNO]);
  const patch = buildBulkPatch(["1", "2"], from, { ...from, year: "" });
  assert.deepEqual(changedBulkFields(from, { ...from, year: "" }), ["year"]);
  // `0` is the backend's "clear the year" value.
  assert.equal(patch.year, 0);
});

test("removing a chip replaces the whole tag set", () => {
  const from = bulkSeedValues([HOUSE, TECHNO]);
  const patch = buildBulkPatch(["1", "2"], from, { ...from, tags: [] });
  assert.deepEqual(patch.tags, []);
});

test("an empty title or artist is refused only when it is being written", () => {
  // A single track seeds its own title, so clearing it is a write of an empty
  // title — the column is NOT NULL and the row would be unnameable.
  const single = bulkSeedValues([HOUSE]);
  assert.match(validateBulkValues(single, { ...single, title: "" }) ?? "", /title/i);
  assert.match(validateBulkValues(single, { ...single, artist: "  " }) ?? "", /artist/i);
  // A mixed selection seeds the title blank; leaving it blank writes nothing,
  // so the editor must not refuse a save that only touches the comment.
  const from = bulkSeedValues([HOUSE, TECHNO]);
  assert.equal(validateBulkValues(from, { ...from, comments: "x" }), null);
});

test("a malformed year is refused only when it is being written", () => {
  const from = bulkSeedValues([HOUSE, TECHNO]);
  assert.equal(validateBulkValues(from, { ...from, comments: "x" }), null);
  assert.match(validateBulkValues(from, { ...from, year: "26" }) ?? "", /year/i);
});

test("the diff lists one row per changed field with before and after", () => {
  const from = bulkSeedValues([HOUSE, TECHNO]);
  const rows = buildBulkDiff(
    from,
    { ...from, comments: "prime time" },
    surveyFields([HOUSE, TECHNO])
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].field, "comments");
  assert.equal(rows[0].before, "—");
  assert.equal(rows[0].after, "prime time");
});

test("a mixed field reads its before from the survey, not from the seed", () => {
  // The seed is empty; the truth about what the write replaces is that the
  // selection holds two different genres.
  const tracks = [HOUSE, TECHNO];
  const from = bulkSeedValues(tracks);
  const rows = buildBulkDiff(from, { ...from, genre: "Melodic House" }, surveyFields(tracks));
  assert.equal(rows[0].before, "Mixed (2 values)");
  assert.equal(rows[0].after, "Melodic House");
});

test("a cleared field reads its after as cleared", () => {
  const tracks = [HOUSE, TECHNO];
  const from = bulkSeedValues(tracks);
  const rows = buildBulkDiff(from, { ...from, year: "" }, surveyFields(tracks));
  assert.equal(rows[0].before, "2024");
  assert.equal(rows[0].after, "Cleared");
});

test("an untouched selection produces an empty diff", () => {
  const tracks = [HOUSE, TECHNO];
  const from = bulkSeedValues(tracks);
  assert.deepEqual(buildBulkDiff(from, { ...from }, surveyFields(tracks)), []);
});
