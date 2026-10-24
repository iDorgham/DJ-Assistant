import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ARTWORK_ROW_HEIGHT,
  DEFAULT_ROW_HEIGHT,
  rowHeightForColumns,
  shouldLoadMore,
  virtualWindow,
} from "./virtual-window.ts";

test("virtualWindow starts at the top with overscan on both sides", () => {
  assert.deepEqual(
    virtualWindow({
      scrollTop: 0,
      viewportHeight: 360,
      rowHeight: 36,
      rowCount: 1000,
      overscan: 4,
    }),
    { start: 0, end: 14, topPadding: 0, bottomPadding: 35496 }
  );
});

test("virtualWindow follows the scroll position and pads both sides", () => {
  assert.deepEqual(
    virtualWindow({
      scrollTop: 3600,
      viewportHeight: 360,
      rowHeight: 36,
      rowCount: 1000,
      overscan: 4,
    }),
    { start: 96, end: 114, topPadding: 3456, bottomPadding: 31896 }
  );
});

test("virtualWindow clamps the window at the end of the list", () => {
  assert.deepEqual(
    virtualWindow({
      scrollTop: 3240,
      viewportHeight: 360,
      rowHeight: 36,
      rowCount: 100,
      overscan: 4,
    }),
    { start: 86, end: 100, topPadding: 3096, bottomPadding: 0 }
  );
});

test("virtualWindow clamps an over-scrolled offset to the last row", () => {
  assert.deepEqual(
    virtualWindow({
      scrollTop: 1_000_000,
      viewportHeight: 360,
      rowHeight: 36,
      rowCount: 100,
      overscan: 4,
    }),
    { start: 86, end: 100, topPadding: 3096, bottomPadding: 0 }
  );
});

test("virtualWindow handles an empty list without padding", () => {
  assert.deepEqual(
    virtualWindow({
      scrollTop: 0,
      viewportHeight: 360,
      rowHeight: 36,
      rowCount: 0,
      overscan: 4,
    }),
    { start: 0, end: 0, topPadding: 0, bottomPadding: 0 }
  );
});

test("virtualWindow renders only the visible rows when overscan is zero", () => {
  assert.deepEqual(
    virtualWindow({
      scrollTop: 1800,
      viewportHeight: 360,
      rowHeight: 36,
      rowCount: 1000,
      overscan: 0,
    }),
    { start: 50, end: 60, topPadding: 1800, bottomPadding: 33840 }
  );
});

test("virtualWindow includes a partially visible last row", () => {
  assert.deepEqual(
    virtualWindow({
      scrollTop: 0,
      viewportHeight: 50,
      rowHeight: 36,
      rowCount: 100,
      overscan: 0,
    }),
    { start: 0, end: 2, topPadding: 0, bottomPadding: 3528 }
  );
});

test("virtualWindow keeps the padding sum equal to the full list height", () => {
  const result = virtualWindow({
    scrollTop: 3600,
    viewportHeight: 360,
    rowHeight: 36,
    rowCount: 1000,
    overscan: 4,
  });
  const renderedHeight = (result.end - result.start) * 36;
  assert.equal(result.topPadding + renderedHeight + result.bottomPadding, 1000 * 36);
});

test("rowHeightForColumns uses the plain row height by default", () => {
  assert.equal(DEFAULT_ROW_HEIGHT, 36);
  assert.equal(rowHeightForColumns([{ id: "title" }, { id: "artist" }]), 36);
  assert.equal(rowHeightForColumns([]), 36);
});

test("rowHeightForColumns uses the taller row when artwork is visible", () => {
  assert.equal(ARTWORK_ROW_HEIGHT, 48);
  assert.equal(rowHeightForColumns([{ id: "title" }, { id: "artwork" }, { id: "artist" }]), 48);
});

test("rowHeightForColumns follows chip and widget cells", () => {
  // Measured in the running app: a status/tag chip makes the row 40.66px and a
  // rating/energy widget makes it 38px. Rows are pinned to these values so the
  // spacer arithmetic matches the rendered pitch for every column set.
  assert.equal(rowHeightForColumns([{ id: "title" }, { id: "status" }]), 41);
  assert.equal(rowHeightForColumns([{ id: "tags" }]), 41);
  assert.equal(rowHeightForColumns([{ id: "format" }]), 41);
  assert.equal(rowHeightForColumns([{ id: "rating" }]), 38);
  assert.equal(rowHeightForColumns([{ id: "energy" }]), 38);
  assert.equal(rowHeightForColumns([{ id: "status" }, { id: "rating" }]), 41);
  assert.equal(rowHeightForColumns([{ id: "tags" }, { id: "artwork" }]), 48);
});

test("shouldLoadMore is false when the whole library is loaded", () => {
  assert.equal(shouldLoadMore(200, 200, 200), false);
  assert.equal(shouldLoadMore(50, 200, 200), false);
});

test("shouldLoadMore triggers when the window nears the loaded end", () => {
  assert.equal(shouldLoadMore(179, 200, 30_000, 20), false);
  assert.equal(shouldLoadMore(180, 200, 30_000, 20), true);
  assert.equal(shouldLoadMore(200, 200, 30_000, 20), true);
});

test("shouldLoadMore triggers at the loaded end without a threshold", () => {
  assert.equal(shouldLoadMore(199, 200, 30_000, 0), false);
  assert.equal(shouldLoadMore(200, 200, 30_000, 0), true);
});

test("shouldLoadMore asks for the first page when nothing is loaded yet", () => {
  assert.equal(shouldLoadMore(0, 0, 30_000), true);
  assert.equal(shouldLoadMore(0, 0, 0), false);
});
