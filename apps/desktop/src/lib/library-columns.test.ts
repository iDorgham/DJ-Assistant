import assert from "node:assert/strict";
import { test } from "node:test";

import type { TrackSummary } from "@dj-assistant/shared";

import type { ColumnId, ColumnState } from "./library-columns.ts";
import {
  ARTWORK_MIN_WIDTH,
  COLUMN_IDS,
  DEFAULT_LIBRARY_COLUMNS,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  PLACEHOLDER,
  autoFitWidth,
  canHideColumn,
  clampColumnWidth,
  columnDefinition,
  loadLibraryColumns,
  mergeWithDefaults,
  moveColumn,
  resetLibraryColumns,
  saveLibraryColumns,
  setColumnWidth,
  toggleColumnVisible,
  totalColumnWidth,
  trackColumnText,
  trackColumnTooltip,
  validateColumnConfig,
  visibleColumns,
} from "./library-columns.ts";

/** `ui-state.test.ts` pattern: an injected fake, so persistence is testable without a DOM. */
function fakeStorage(initial: Record<string, string> = {}): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
} & {
  dump: () => Record<string, string>;
} {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => void map.set(key, value),
    dump: () => Object.fromEntries(map),
  };
}

/**
 * §3.2's Default=On columns, plus Fingerprint: it predates that table and the
 * library uses it to spot duplicate imports, so this slice keeps it visible.
 */
const SPEC_DEFAULT_VISIBLE: ColumnId[] = [
  "index",
  "title",
  "artist",
  "album",
  "bpm",
  "key",
  "time",
  "status",
  "fingerprint",
];

function visibleIds(columns: readonly ColumnState[]): ColumnId[] {
  return columns.filter((column) => column.visible).map((column) => column.id);
}

function pick(columns: readonly ColumnState[], id: ColumnId): ColumnState {
  const found = columns.find((column) => column.id === id);
  if (!found) throw new Error(`no ${id} column in the config`);
  return found;
}

/** A stored payload or a plain-JS caller can carry an id TypeScript never saw. */
const NOT_A_COLUMN = "nope" as unknown as ColumnId;

test("every documented column id has a definition", () => {
  for (const id of COLUMN_IDS) {
    assert.ok(columnDefinition(id), `${id} has no column definition`);
  }
});

test("defaults match the column table in docs/ui/03 §3.2", () => {
  assert.deepEqual(visibleIds(DEFAULT_LIBRARY_COLUMNS), SPEC_DEFAULT_VISIBLE);
  // The rich cells (Energy bars, tag chips, editable stars, artwork thumb) are later
  // slices, so they start switched off and the framework still has to carry their ids.
  const deferredCells: ColumnId[] = [
    "energy",
    "tags",
    "rating",
    "artwork",
    "label",
    "year",
    "lufs",
    "color",
  ];
  for (const id of deferredCells) {
    assert.equal(
      pick(DEFAULT_LIBRARY_COLUMNS, id).visible,
      false,
      `${id} should default to hidden`
    );
  }
});

test("no column starts outside the clamped width range", () => {
  for (const column of DEFAULT_LIBRARY_COLUMNS) {
    assert.ok(column.width >= MIN_COLUMN_WIDTH, `${column.id} is narrower than the minimum`);
    assert.ok(column.width <= MAX_COLUMN_WIDTH, `${column.id} is wider than the maximum`);
  }
});

test("only columns the list query can sort are sortable", () => {
  const sortable = COLUMN_IDS.filter((id) => columnDefinition(id).sortable !== null).map(
    (id) => id
  );
  assert.deepEqual(sortable, [
    "index",
    "title",
    "artist",
    "bpm",
    "key",
    "energy",
    "rating",
    "time",
  ]);
});

test("toggling a plain column hides it", () => {
  const next = toggleColumnVisible(DEFAULT_LIBRARY_COLUMNS, "album");
  assert.equal(pick(next, "album").visible, false);
  // The original config is not mutated.
  assert.equal(pick(DEFAULT_LIBRARY_COLUMNS, "album").visible, true);
});

test("the last visible identity column cannot be hidden", () => {
  const onlyTitle = toggleColumnVisible(DEFAULT_LIBRARY_COLUMNS, "artist");
  assert.equal(pick(onlyTitle, "artist").visible, false);
  assert.equal(pick(onlyTitle, "title").visible, true);

  const refused = toggleColumnVisible(onlyTitle, "title");
  assert.equal(pick(refused, "title").visible, true);
  assert.deepEqual(
    visibleIds(refused),
    visibleIds(onlyTitle).filter((id) => id !== "artist")
  );
});

test("hiding a column that is not an identity column never strands the table", () => {
  const next = toggleColumnVisible(toggleColumnVisible(DEFAULT_LIBRARY_COLUMNS, "title"), "artist");
  assert.ok(
    visibleIds(next).some((id) => id === "title" || id === "artist"),
    "both identity columns ended up hidden"
  );
});

test("reorder moves a column to the target position", () => {
  const next = moveColumn(DEFAULT_LIBRARY_COLUMNS, "artist", "title");
  const ids = next.map((column) => column.id);
  assert.ok(
    ids.indexOf("artist") < ids.indexOf("title"),
    `artist was not placed before title: ${ids.join(", ")}`
  );
  assert.equal(new Set(ids).size, ids.length, "reorder duplicated a column");
});

test("reorder with an unknown column is a no-op", () => {
  assert.deepEqual(moveColumn(DEFAULT_LIBRARY_COLUMNS, NOT_A_COLUMN, "title"), [
    ...DEFAULT_LIBRARY_COLUMNS,
  ]);
});

test("clampColumnWidth keeps a dragged width inside the resizable range", () => {
  assert.equal(clampColumnWidth(10), MIN_COLUMN_WIDTH);
  assert.equal(clampColumnWidth(9999), MAX_COLUMN_WIDTH);
  assert.equal(clampColumnWidth(123.6), 124);
  assert.equal(clampColumnWidth(Number.NaN), MIN_COLUMN_WIDTH, "a bad measurement needs a bound");
});

test("width is clamped to the resizable range", () => {
  assert.equal(
    pick(setColumnWidth(DEFAULT_LIBRARY_COLUMNS, "title", 10), "title").width,
    MIN_COLUMN_WIDTH
  );
  assert.equal(
    pick(setColumnWidth(DEFAULT_LIBRARY_COLUMNS, "title", 9999), "title").width,
    MAX_COLUMN_WIDTH
  );
  assert.equal(
    pick(setColumnWidth(DEFAULT_LIBRARY_COLUMNS, "title", Number.NaN), "title").width,
    columnDefinition("title").defaultWidth
  );
});

test("auto-fit grows with the longest value and stays inside the range", () => {
  const short = autoFitWidth("9A", columnDefinition("key"));
  const long = autoFitWidth(
    "An extremely long album name that keeps going",
    columnDefinition("key")
  );
  assert.ok(long > short, "auto-fit did not grow with the content");
  assert.ok(short >= MIN_COLUMN_WIDTH);
  assert.ok(long <= MAX_COLUMN_WIDTH);
});

test("auto-fit leaves room for the artwork thumb and its cell padding", () => {
  const fitted = autoFitWidth("", columnDefinition("artwork"));
  assert.ok(
    fitted >= ARTWORK_MIN_WIDTH,
    `artwork auto-fit is ${fitted}px, narrower than the 36px thumb plus padding`
  );
  assert.ok(ARTWORK_MIN_WIDTH >= 36 + 16, "the artwork minimum must fit px-2 around the thumb");
});

test("auto-fit counts header controls and cell decorations", () => {
  // Sortable headers add a 12px icon and a 4px gap next to the label.
  assert.ok(
    autoFitWidth("", columnDefinition("time")) > autoFitWidth("", columnDefinition("size")),
    "the header sort icon was not counted"
  );

  // Status renders a chip: px-2 padding, a 12px icon and a 4px gap.
  assert.ok(
    autoFitWidth("Needs review", columnDefinition("status")) >
      autoFitWidth("Needs review", columnDefinition("genre")),
    "the status chip was not counted"
  );

  // Format renders a bordered pill inside px-1.5.
  assert.ok(
    autoFitWidth("aiffc", columnDefinition("format")) >= 5 * 7 + 32 + 12 + 2,
    "the format pill chrome was not counted"
  );
});

test("the table width follows the drag preview and the committed widths", () => {
  const shown = visibleColumns(DEFAULT_LIBRARY_COLUMNS);
  const titleWidth = pick(shown, "title").width;
  const sum = shown.reduce((total, column) => total + column.width, 0);

  assert.equal(totalColumnWidth(shown), sum, "the table must render exactly its columns");
  assert.equal(totalColumnWidth(shown, null), sum);
  assert.equal(
    totalColumnWidth(shown, { id: "title", width: titleWidth - 120 }),
    sum - 120,
    "the preview did not move the table edge with the drag"
  );
  assert.equal(
    totalColumnWidth(shown, { id: "title", width: 10 }),
    sum - titleWidth + MIN_COLUMN_WIDTH,
    "the preview width was not clamped like the commit"
  );
});

test("config round-trips through storage", () => {
  const storage = fakeStorage();
  const edited = setColumnWidth(
    toggleColumnVisible(moveColumn(DEFAULT_LIBRARY_COLUMNS, "artist", "title"), "album"),
    "title",
    340
  );
  saveLibraryColumns("library", edited, storage);
  assert.deepEqual(loadLibraryColumns("library", storage), edited);
});

test("column state is stored per view", () => {
  const storage = fakeStorage();
  saveLibraryColumns("library", DEFAULT_LIBRARY_COLUMNS, storage);
  assert.deepEqual(Object.keys(storage.dump()), ["dj-assistant.columns.v1.library"]);
  // Another view has no state yet, so it falls back to the defaults rather than
  // inheriting the library's arrangement.
  assert.deepEqual(loadLibraryColumns("analysis", storage), [...DEFAULT_LIBRARY_COLUMNS]);
});

test("an unreadable payload falls back to the defaults", () => {
  const storage = fakeStorage({ "dj-assistant.columns.v1.library": "{ not json" });
  assert.deepEqual(loadLibraryColumns("library", storage), [...DEFAULT_LIBRARY_COLUMNS]);
});

test("unknown ids, duplicates and bad widths are repaired", () => {
  const hostile = [
    { id: "disco", visible: true, width: 120 },
    { id: "title", visible: true, width: 120 },
    { id: "title", visible: false, width: 99999 },
    { id: "bpm", visible: true, width: "64" },
  ];
  const repaired = mergeWithDefaults(hostile as unknown as ColumnState[]);

  // The invented id is gone, and every real column is present exactly once.
  const ids = repaired.map((column) => column.id);
  assert.equal(ids.length, COLUMN_IDS.length);
  assert.deepEqual(new Set(ids), new Set(COLUMN_IDS));
  assert.equal(pick(repaired, "title").visible, true, "the collapse kept the later duplicate");
  assert.ok(pick(repaired, "title").width <= MAX_COLUMN_WIDTH);
  // Kept entries hold their stored order; missing defaults are appended after them.
  assert.deepEqual(ids.slice(0, 2), ["title", "bpm"]);
  assert.deepEqual(
    ids.slice(2),
    COLUMN_IDS.filter((id) => id !== "title" && id !== "bpm")
  );
});

test("a stored config that hides every identity column is repaired", () => {
  const stored = DEFAULT_LIBRARY_COLUMNS.map((column) =>
    column.id === "title" || column.id === "artist" ? { ...column, visible: false } : column
  );
  const repaired = mergeWithDefaults(stored);
  assert.ok(
    repaired.some((column) => (column.id === "title" || column.id === "artist") && column.visible),
    "no identity column was left visible"
  );
});

test("validateColumnConfig rejects shapes that are not a column list", () => {
  assert.equal(validateColumnConfig(null), null);
  assert.equal(validateColumnConfig("title"), null);
  assert.equal(validateColumnConfig({ id: "title" }), null);
  assert.deepEqual(validateColumnConfig([]), []);
});

test("reset returns a fresh copy of the defaults", () => {
  const reset = resetLibraryColumns();
  assert.deepEqual(reset, [...DEFAULT_LIBRARY_COLUMNS]);
  assert.notEqual(reset, DEFAULT_LIBRARY_COLUMNS, "reset handed back the shared array");
  const mutated = resetLibraryColumns();
  mutated[0].visible = false;
  assert.equal(DEFAULT_LIBRARY_COLUMNS[0].visible, true, "defaults are mutable shared state");
});

test("visibleColumns keeps stored order and hides the rest", () => {
  const edited = moveColumn(
    toggleColumnVisible(DEFAULT_LIBRARY_COLUMNS, "album"),
    "artist",
    "title"
  );
  assert.deepEqual(
    visibleColumns(edited).map((column) => column.id),
    ["index", "artist", "title", "bpm", "key", "time", "status", "fingerprint"]
  );
});

test("canHideColumn tells the picker which toggles are actually available", () => {
  assert.equal(canHideColumn(DEFAULT_LIBRARY_COLUMNS, "album"), true);
  assert.equal(canHideColumn(DEFAULT_LIBRARY_COLUMNS, "title"), true);
  const onlyTitle = toggleColumnVisible(DEFAULT_LIBRARY_COLUMNS, "artist");
  assert.equal(canHideColumn(onlyTitle, "title"), false, "the last identity column is pinned");
  assert.equal(canHideColumn(onlyTitle, "artist"), true, "a hidden column can still be re-shown");
});

const FULL_TRACK: TrackSummary = {
  id: "t1",
  filePath: "D:/music/sets/opener.mp3",
  fileHash: "a1b2c3d4e5f6",
  title: "Night Drive",
  artist: "Vela",
  album: "Afterhours",
  genre: "Melodic House",
  label: "Night Records",
  year: 2026,
  bpm: 124.5,
  keyCamelot: "8A",
  keyClassical: "Am",
  durationMs: 425000,
  format: "mp3",
  analysisStatus: "needs_review",
  userRating: 4,
  energy: 7,
  comments: "Great build, keep for the closing hour.",
  tags: ["peak", "warmup"],
  artworkHash: "art1",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

const BARE_TRACK: TrackSummary = {
  id: "t2",
  filePath: "D:/music/unknown.mp3",
  fileHash: "",
  title: "",
  artist: "",
  durationMs: 0,
  analysisStatus: "pending",
  tags: [],
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

test("every column renders the text the table shows", () => {
  const actual: Record<string, string> = {};
  for (const id of [
    "title",
    "artist",
    "album",
    "genre",
    "bpm",
    "key",
    "time",
    "rating",
    "energy",
    "comment",
    "path",
    "format",
    "fingerprint",
    "status",
  ] as ColumnId[]) {
    actual[id] = trackColumnText(FULL_TRACK, id);
  }
  assert.deepEqual(actual, {
    title: "Night Drive",
    artist: "Vela",
    album: "Afterhours",
    genre: "Melodic House",
    bpm: "124.5",
    key: "8A",
    time: "7:05",
    rating: "★★★★☆",
    energy: "7",
    comment: "Great build, keep for the closing hour.",
    path: "D:/music/sets/opener.mp3",
    format: "mp3",
    fingerprint: "a1b2c3d4...",
    status: "Needs review",
  });
});

test("missing tags fall back to a dash instead of an empty cell", () => {
  assert.equal(trackColumnText(BARE_TRACK, "title"), "Untitled");
  assert.equal(trackColumnText(BARE_TRACK, "artist"), "Unknown Artist");
  assert.equal(trackColumnText(BARE_TRACK, "album"), PLACEHOLDER);
  assert.equal(trackColumnText(BARE_TRACK, "bpm"), PLACEHOLDER);
  assert.equal(trackColumnText(BARE_TRACK, "rating"), PLACEHOLDER);
  assert.equal(trackColumnText(BARE_TRACK, "fingerprint"), PLACEHOLDER);
  assert.equal(trackColumnText(BARE_TRACK, "status"), "Pending");
  for (const id of COLUMN_IDS) {
    if (id === "index" || id === "artwork") continue;
    assert.ok(
      trackColumnText(BARE_TRACK, id).length > 0,
      `${id} rendered nothing for a bare track`
    );
  }
});

test("columns without data in this slice show a placeholder, not a fake value", () => {
  // LUFS, color, cue counts and file size still need fields the list query
  // does not return (later T2.1.x slices). Tags, label and year landed in 3A.
  const notYetSourced: ColumnId[] = ["lufs", "color", "cues", "size"];
  for (const id of notYetSourced) {
    assert.equal(trackColumnText(FULL_TRACK, id), PLACEHOLDER, `${id} has no source field`);
  }
});

test("the tags, label and year columns render their own field", () => {
  // Slice 3A: the tags, the label and the year reached `TrackSummary`.
  assert.equal(trackColumnText(FULL_TRACK, "tags"), "peak, warmup");
  assert.equal(trackColumnText(FULL_TRACK, "label"), "Night Records");
  assert.equal(trackColumnText(FULL_TRACK, "year"), "2026");
  // A track without them shows the placeholder, never a fake value.
  assert.equal(trackColumnText(BARE_TRACK, "tags"), PLACEHOLDER);
  assert.equal(trackColumnText(BARE_TRACK, "label"), PLACEHOLDER);
  assert.equal(trackColumnText(BARE_TRACK, "year"), PLACEHOLDER);
});

test("the tags tooltip names every tag, not just the visible chips", () => {
  assert.equal(trackColumnTooltip(FULL_TRACK, "tags"), "peak, warmup");
  assert.equal(trackColumnTooltip(BARE_TRACK, "tags"), undefined);
});

test("the energy column reports the level the meter shows", () => {
  assert.equal(trackColumnText(FULL_TRACK, "energy"), "7");
  assert.equal(trackColumnText(BARE_TRACK, "energy"), PLACEHOLDER, "no energy set yet");
  assert.equal(
    trackColumnText({ ...FULL_TRACK, energy: null }, "energy"),
    PLACEHOLDER,
    "a cleared energy is not a zero"
  );
});

test("tooltips keep the details the cells shorten", () => {
  const longComment =
    "Keeps the floor moving through the break, cue at 3:20 for the second drop and ride the outro.";
  const fullHash = "9f2c1ab34d5e6f708192a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4";
  const track: TrackSummary = { ...FULL_TRACK, comments: longComment, fileHash: fullHash };

  assert.ok(
    trackColumnText(track, "comment").length < longComment.length,
    "the comment cell was not shortened, so this test proves nothing"
  );
  assert.equal(trackColumnTooltip(track, "comment"), longComment);
  assert.ok(trackColumnText(track, "fingerprint").length < fullHash.length);
  assert.equal(trackColumnTooltip(track, "fingerprint"), fullHash);
  assert.equal(trackColumnTooltip(track, "key"), "Camelot 8A • Am");
  assert.equal(trackColumnTooltip(FULL_TRACK, "rating"), "4 / 5");
  assert.equal(trackColumnTooltip(FULL_TRACK, "energy"), "Energy 7 / 10");
});

test("tooltips are absent when there is no extra detail to show", () => {
  assert.equal(trackColumnTooltip(BARE_TRACK, "rating"), "Unrated");
  assert.equal(trackColumnTooltip(BARE_TRACK, "energy"), "No energy set");
  assert.equal(trackColumnTooltip(BARE_TRACK, "comment"), undefined);
  assert.equal(trackColumnTooltip(BARE_TRACK, "fingerprint"), undefined);
  // Only one key notation exists, so the cell already shows all of it.
  assert.equal(trackColumnTooltip({ ...FULL_TRACK, keyClassical: null }, "key"), undefined);
  // Columns whose cells are not shortened do not repeat themselves on hover.
  assert.equal(trackColumnTooltip(FULL_TRACK, "title"), undefined);
  assert.equal(trackColumnTooltip(FULL_TRACK, "path"), undefined);
});
