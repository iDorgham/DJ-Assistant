import assert from "node:assert/strict";
import { test } from "node:test";

import {
  appliesToWholeSelection,
  BLOCKED_ACTIONS,
  clampMenuPosition,
  describeRemove,
  describeRemovedCount,
  describeRestore,
  describeUndoRemove,
  describeUndoRestore,
  isBlocked,
  isDisabled,
  itemTooltip,
  MENU_LAYOUT,
  MENU_VIEWPORT_MARGIN,
  menuRating,
  starClickRating,
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
// `docs/ui-ux/03-LIBRARY-VIEW.md` §3.5 lists menu items whose features do not
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

test("a restore reports what came back and what was skipped", () => {
  assert.equal(describeRestore(1, 0), "Restored 1 track to library");
  assert.equal(describeRestore(3, 0), "Restored 3 tracks to library");
  assert.equal(
    describeRestore(2, 1),
    "Restored 2 tracks to library, 1 skipped (removed again since)"
  );
  assert.equal(describeRestore(0, 2), "Nothing restored — 2 tracks removed again since");
});

test("undoing a restore removes again, and says so", () => {
  // The same undo command serves both directions, so the wording has to come
  // from which snapshot it ran: "back in the library" here would be a lie.
  assert.equal(describeUndoRestore(2, 0), "Undone — 2 tracks removed again");
  assert.equal(describeUndoRestore(1, 0), "Undone — 1 track removed again");
  assert.equal(
    describeUndoRestore(1, 2),
    "Undone — 1 track removed again, 2 skipped (changed since)"
  );
  assert.equal(describeUndoRestore(0, 1), "Nothing undone — 1 track changed since");
});

test("the removed button counts what is hidden", () => {
  assert.equal(describeRemovedCount(0), "Removed");
  assert.equal(describeRemovedCount(4), "Removed (4)");
});

// The menu is `.tsx`, and the desktop runner collects `.test.ts` only — so the
// decisions the component makes live here, where they actually run. These four
// replace the seven `assert.equal(true, true)` placeholders that shipped in
// `RowContextMenu.test.tsx` and were never collected.

test("the menu opens at the cursor when it fits", () => {
  assert.deepEqual(clampMenuPosition(100, 200, 180, 320, 1200, 800), { left: 100, top: 200 });
});

test("the menu flips towards the cursor at the right and bottom edges", () => {
  // 1160 + 180 + 8 > 1200, so it opens to the left of the cursor.
  assert.deepEqual(clampMenuPosition(1160, 200, 180, 320, 1200, 800), {
    left: 1160 - 180,
    top: 200,
  });
  assert.deepEqual(clampMenuPosition(100, 760, 180, 320, 1200, 800), {
    left: 100,
    top: 760 - 320,
  });
});

test("a menu larger than the viewport still keeps its margin", () => {
  const { left, top } = clampMenuPosition(50, 50, 4000, 4000, 1200, 800);
  assert.equal(left, MENU_VIEWPORT_MARGIN);
  assert.equal(top, MENU_VIEWPORT_MARGIN);
  // Whatever the cursor: the upper bound collapses below the margin, so the
  // margin is the only position left to return.
  assert.deepEqual(clampMenuPosition(600, 400, 4000, 4000, 1200, 800), {
    left: MENU_VIEWPORT_MARGIN,
    top: MENU_VIEWPORT_MARGIN,
  });
});

test("the last position that still fits keeps the cursor, margin included", () => {
  // 1012 + 180 + 8 is exactly 1200: the panel fits where it is, so nothing moves.
  assert.deepEqual(clampMenuPosition(1012, 472, 180, 320, 1200, 800), { left: 1012, top: 472 });
});

test("a cursor on the viewport edge does not leave the menu flush against it", () => {
  // Flipping alone would land the panel's far edge exactly on the viewport edge,
  // with no margin — the case a bare `x - width` flip gets wrong.
  assert.deepEqual(clampMenuPosition(1200, 800, 180, 320, 1200, 800), {
    left: 1200 - 180 - MENU_VIEWPORT_MARGIN,
    top: 800 - 320 - MENU_VIEWPORT_MARGIN,
  });
});

test("a flip near the start of an axis stops at the margin", () => {
  // 100 + 600 + 8 > 700, so it flips to 100 - 600 = -500 — off the left edge.
  // The flipped coordinate is bounded too, so it lands on the margin instead.
  assert.deepEqual(clampMenuPosition(100, 300, 600, 100, 700, 800), {
    left: MENU_VIEWPORT_MARGIN,
    top: 300,
  });
});

test("an axis that fits is not moved because the other one flipped", () => {
  // The panel is too tall for y = 700 but fits comfortably at x = 400; the two
  // axes are clamped apart, so one flip cannot drag the other.
  assert.deepEqual(clampMenuPosition(400, 700, 180, 320, 1200, 800), {
    left: 400,
    top: 700 - 320,
  });
});

test("an unrated track shows no lit stars, and out-of-range ratings clamp", () => {
  assert.equal(menuRating(null), 0);
  const unrated: number | undefined = undefined;
  assert.equal(menuRating(unrated), 0);
  assert.equal(menuRating(0), 0);
  assert.equal(menuRating(3), 3);
  assert.equal(menuRating(9), 5);
  assert.equal(menuRating(-2), 0);
  assert.equal(menuRating(2.6), 3);
});

test("clicking the lit star clears the rating; any other star sets it", () => {
  assert.equal(starClickRating(3, 3), 0);
  assert.equal(starClickRating(3, 5), 5);
  assert.equal(starClickRating(null, 4), 4);
  assert.equal(starClickRating(0, 1), 1);
});

// --- Fix tags goes live with the Tag Surgeon scan (T2.2.1) ------------------

test("fixTags is live: not disabled, no stub tooltip, whole-selection", () => {
  assert.equal(isDisabled("fixTags"), false);
  assert.equal(isBlocked("fixTags"), false);
  const entry = itemsOf(MENU_LAYOUT).find((item) => item.id === "fixTags");
  assert.ok(entry, "fixTags must stay in the layout");
  assert.equal(itemTooltip(entry), undefined, "the stub tooltip must be gone");
  assert.equal(appliesToWholeSelection("fixTags"), true);
});
