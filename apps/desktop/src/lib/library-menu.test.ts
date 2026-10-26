import assert from "node:assert/strict";
import { test } from "node:test";

import {
  appliesToWholeSelection,
  BLOCKED_ACTIONS,
  describeRemove,
  describeUndoRemove,
  isBlocked,
  isDisabled,
  itemTooltip,
  MENU_LAYOUT,
  type MenuEntry,
} from "./library-menu.ts";

// The §3.5 sequence, as the menu must render it. A divider splits the groups
// the spec draws lines between.
const SPEC_ORDER = [
  "play",
  "analyze",
  "editTags",
  "fixTags",
  "rate",
  "addToPlaylist",
  "addToSet",
  "findInPlaylists",
  "mixSuggestions",
  "findSmallerOnline",
  "findNewOnline",
  "viewColumns",
  "reveal",
  "copyPath",
  "remove",
];

const itemsOf = (layout: readonly MenuEntry[]) =>
  layout.filter((entry): entry is Extract<MenuEntry, { kind: "item" }> => entry.kind === "item");

const groupsOf = (layout: readonly MenuEntry[]): string[][] => {
  const groups: string[][] = [[]];
  for (const entry of layout) {
    if (entry.kind === "divider") groups.push([]);
    else groups[groups.length - 1].push(entry.id);
  }
  return groups;
};

// --- The order of the menu (§3.5) ------------------------------------------
// The component is `.tsx` and the desktop harness runs `.test.ts` only, so the
// order lives here — where a change to it can actually fail a test.

test("the menu lists the §3.5 items in spec order", () => {
  assert.deepEqual(
    itemsOf(MENU_LAYOUT).map((item) => item.id),
    SPEC_ORDER
  );
});

test("the menu groups the items where the spec draws a line", () => {
  assert.deepEqual(groupsOf(MENU_LAYOUT), [
    ["play", "analyze"],
    ["editTags", "fixTags", "rate"],
    ["addToPlaylist", "addToSet", "findInPlaylists", "mixSuggestions"],
    ["findSmallerOnline", "findNewOnline"],
    ["viewColumns"],
    ["reveal", "copyPath"],
    ["remove"],
  ]);
});

test("the destructive item is last", () => {
  // "Remove from library…" closes the menu. Anything after it invites a
  // stray click straight past a confirm-less delete.
  assert.equal(MENU_LAYOUT[MENU_LAYOUT.length - 1].kind, "item");
  assert.equal(itemsOf(MENU_LAYOUT)[itemsOf(MENU_LAYOUT).length - 1].id, "remove");
});

test("every item has a label, and a blocked one matches its stub", () => {
  for (const item of itemsOf(MENU_LAYOUT)) {
    assert.ok(item.label.length > 0, `${item.id} needs a label`);
    const blocked = BLOCKED_ACTIONS.find((action) => action.id === item.id);
    if (blocked) assert.equal(item.label, blocked.label, item.id);
  }
});

test("a disabled item always explains itself", () => {
  // A greyed-out row with no tooltip reads as a bug.
  for (const item of itemsOf(MENU_LAYOUT)) {
    if (!isDisabled(item.id)) continue;
    const tooltip = itemTooltip(item);
    assert.ok(
      tooltip !== undefined && tooltip.length > 0,
      `${item.id} is disabled without a reason`
    );
  }
  assert.ok(itemsOf(MENU_LAYOUT).some((entry) => isDisabled(entry.id)));
});

test("the live items are not disabled", () => {
  for (const id of ["play", "editTags", "rate", "viewColumns", "reveal", "copyPath", "remove"]) {
    assert.equal(isDisabled(id), false, id);
  }
});

test("no blocked action is missing from the menu", () => {
  const laid = new Set(itemsOf(MENU_LAYOUT).map((item) => item.id));
  for (const action of BLOCKED_ACTIONS) {
    assert.ok(laid.has(action.id), action.id);
  }
});

// --- The blocked stubs (T2.1.10 Batch B/C) ---------------------------------
// `docs/ui/03-LIBRARY-VIEW.md` §3.5 lists menu items whose features do not
// exist yet. The spec for this batch is that they are *visible but disabled,
// with a tooltip that says when they land* — so a user can see the shape of
// the feature and is not left guessing whether the app forgot the item.

test("every blocked action carries a tooltip that is not the label", () => {
  assert.ok(BLOCKED_ACTIONS.length > 0, "the blocked list must not be empty");
  for (const action of BLOCKED_ACTIONS) {
    assert.ok(action.label.length > 0, `${action.id} needs a label`);
    assert.ok(action.tooltip.length > 0, `${action.id} needs a tooltip`);
    assert.notEqual(action.tooltip, action.label, `${action.id} tooltip must add information`);
  }
});

test("the blocked ids are exactly the features the partial report lists", () => {
  assert.deepEqual(BLOCKED_ACTIONS.map((action) => action.id).sort(), [
    "addToPlaylist",
    "addToSet",
    "analyze",
    "findInPlaylists",
    "findNewOnline",
    "findSmallerOnline",
    "mixSuggestions",
  ]);
});

test("analyze is blocked with the selection-scoped message", () => {
  assert.equal(
    BLOCKED_ACTIONS.find((action) => action.id === "analyze")?.tooltip,
    "Selection-scoped analysis coming soon"
  );
});

test("mix suggestions points at the slice that builds it", () => {
  assert.equal(
    BLOCKED_ACTIONS.find((action) => action.id === "mixSuggestions")?.tooltip,
    "Coming in Slice 6"
  );
});

test("the playlist family points at phase 3", () => {
  for (const id of ["addToPlaylist", "addToSet", "findInPlaylists"]) {
    assert.equal(
      BLOCKED_ACTIONS.find((action) => action.id === id)?.tooltip,
      "Coming in Phase 3",
      id
    );
  }
});

test("the actions this batch ships are never blocked", () => {
  // A regression here would silently turn Remove back into a dead item.
  for (const id of ["remove", "reveal", "copyPath", "play", "editTags", "rate", "viewColumns"]) {
    assert.equal(isBlocked(id), false, id);
  }
});

test("an unknown id is not blocked", () => {
  assert.equal(isBlocked("notAMenuItem"), false);
});

// --- Selection semantics (§3.5 rules) --------------------------------------

test("the whole-selection actions are the ones the spec names", () => {
  // "Multi-select: Analyze, Fix tags, Add to playlist/set, Remove apply to the
  // whole selection" — plus Rate, which §3.4 says applies to every selected
  // track.
  for (const id of ["analyze", "fixTags", "addToPlaylist", "addToSet", "remove", "rate"]) {
    assert.equal(appliesToWholeSelection(id), true, id);
  }
});

test("single-row actions act on the primary row", () => {
  // "Play, Edit tags, Find in playlists, Mix suggestions, online find act on
  // the focused/primary row (or first selected)". Reveal and Copy path follow
  // the same rule: the first selected track names the file.
  for (const id of [
    "play",
    "editTags",
    "findInPlaylists",
    "mixSuggestions",
    "findSmallerOnline",
    "findNewOnline",
    "reveal",
    "copyPath",
  ]) {
    assert.equal(appliesToWholeSelection(id), false, id);
  }
});

// --- The toast copy ---------------------------------------------------------

test("remove announces how many tracks left", () => {
  assert.equal(describeRemove(1), "Removed 1 track from library");
  assert.equal(describeRemove(3), "Removed 3 tracks from library");
});

test("a remove that changed nothing says so", () => {
  // The selection can be entirely tracks that were already removed. Offering
  // an Undo for a write that never happened would be a lie about the snapshot.
  assert.equal(
    describeRemove(0),
    "Nothing to remove — those tracks are already out of the library"
  );
});

test("undoing a remove reports restored and skipped separately", () => {
  assert.equal(describeUndoRemove(1, 0), "Undone — 1 track back in the library");
  assert.equal(describeUndoRemove(2, 0), "Undone — 2 tracks back in the library");
  assert.equal(
    describeUndoRemove(2, 1),
    "Undone — 2 tracks back in the library, 1 skipped (removed again since)"
  );
  assert.equal(describeUndoRemove(0, 2), "Nothing restored — 2 tracks removed again since");
  assert.equal(describeUndoRemove(0, 1), "Nothing restored — 1 track removed again since");
});
