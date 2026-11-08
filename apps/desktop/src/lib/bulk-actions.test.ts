import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BULK_ACTIONS,
  bulkActionTooltip,
  describeSelection,
  isBulkActionBlocked,
  type BulkActionId,
} from "./bulk-actions.ts";

// The §6 sequence, with the T2.1.3 editor entry leading it.
const SPEC_ORDER: BulkActionId[] = [
  "editMetadata",
  "rate",
  "analyze",
  "fixTags",
  "addToPlaylist",
  "addToSet",
  "exportSelection",
  "clearSelection",
];

const LIVE: BulkActionId[] = ["editMetadata", "rate", "clearSelection"];

test("the bar follows the §6 order", () => {
  assert.deepEqual(
    BULK_ACTIONS.map((action) => action.id),
    SPEC_ORDER
  );
});

test("only the built actions are live", () => {
  for (const action of BULK_ACTIONS) {
    assert.equal(
      isBulkActionBlocked(action.id),
      !LIVE.includes(action.id),
      `${action.id} should ${LIVE.includes(action.id) ? "not " : ""}be blocked`
    );
  }
});

test("every blocked action explains itself", () => {
  for (const action of BULK_ACTIONS) {
    if (!isBulkActionBlocked(action.id)) continue;
    const reason = bulkActionTooltip(action);
    assert.ok(reason && reason.trim().length > 0, `${action.id} has no reason`);
  }
});

test("live actions carry no disabled reason", () => {
  for (const action of BULK_ACTIONS) {
    if (isBulkActionBlocked(action.id)) continue;
    assert.equal(bulkActionTooltip(action), undefined, `${action.id} should be live`);
  }
});

test("the blocked reasons match the row context menu where the feature is shared", () => {
  const reason = (id: BulkActionId) => BULK_ACTIONS.find((action) => action.id === id)?.tooltip;
  // Same feature, same wording: the two surfaces must not drift.
  assert.equal(reason("analyze"), "Selection-scoped analysis coming soon");
  assert.equal(reason("addToPlaylist"), "Coming in Phase 3");
  assert.equal(reason("addToSet"), "Coming in Phase 3");
});

test("the scope line names the count in words", () => {
  assert.equal(describeSelection(1), "1 track selected");
  assert.equal(describeSelection(2), "2 tracks selected");
  assert.equal(describeSelection(30), "30 tracks selected");
});

test("the scope line never prints a zero selection as a scope", () => {
  assert.equal(describeSelection(0), "No tracks selected");
  assert.equal(describeSelection(-1), "No tracks selected");
});
