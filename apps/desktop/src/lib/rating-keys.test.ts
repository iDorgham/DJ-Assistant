import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RATING_WIDGET_ATTRIBUTE,
  handleRatingKey,
  isRatingKey,
  playerHotCueSlot,
  ratingKeyAction,
  ratingTabStop,
} from "./rating-keys.ts";

/** A fake event that records the two cancellation calls the widget makes. */
function fakeKeyEvent(
  key: string,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {}
) {
  const calls = { preventDefault: 0, stopPropagation: 0 };
  return {
    key,
    ...modifiers,
    calls,
    preventDefault: () => {
      calls.preventDefault += 1;
    },
    stopPropagation: () => {
      calls.stopPropagation += 1;
    },
  };
}

test("isRatingKey owns 1–5 and 0 only", () => {
  for (const key of ["1", "2", "3", "4", "5", "0"]) {
    assert.equal(isRatingKey(key), true, `${key} is a rating key`);
  }
  for (const key of ["6", "7", "8", "9", "a", "Enter", " "]) {
    assert.equal(isRatingKey(key), false, `${key} is not a rating key`);
  }
});

test("ratingKeyAction maps digits to the rating the widget commits", () => {
  assert.equal(ratingKeyAction("4"), 4);
  assert.equal(ratingKeyAction("1"), 1);
  assert.equal(ratingKeyAction("5"), 5);
  assert.equal(ratingKeyAction("0"), null, "0 clears the rating");
  assert.ok(ratingKeyAction("6") === undefined, "6 belongs to the player");
  assert.ok(ratingKeyAction("Enter") === undefined, "Enter is not a rating key");
});

test("ratingKeyAction leaves modified digits to the app view shortcuts", () => {
  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
    assert.ok(ratingKeyAction("1", modifiers) === undefined, "modified 1 is not a rating key");
    assert.ok(ratingKeyAction("0", modifiers) === undefined, "modified 0 is not a rating key");
  }
});

test("handleRatingKey claims 1–5 and 0 and cancels the event", () => {
  for (const [key, expected] of [
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["4", 4],
    ["5", 5],
    ["0", null],
  ] as const) {
    const event = fakeKeyEvent(key);
    const action = handleRatingKey(event);
    assert.equal(action, expected, `${key} commits ${String(expected)}`);
    assert.equal(event.calls.preventDefault, 1, `${key} cancels the default action`);
    assert.equal(
      event.calls.stopPropagation,
      1,
      `${key} stops propagation so the player's window listener never sees it`
    );
  }
});

test("handleRatingKey does not touch keys it does not own", () => {
  const unowned = [fakeKeyEvent("6"), fakeKeyEvent("9"), fakeKeyEvent("a"), fakeKeyEvent("Enter")];
  unowned.push(fakeKeyEvent("4", { ctrlKey: true }), fakeKeyEvent("0", { metaKey: true }));
  for (const event of unowned) {
    assert.equal(handleRatingKey(event), undefined, `${event.key} is not the widget's`);
    assert.equal(event.calls.preventDefault, 0);
    assert.equal(event.calls.stopPropagation, 0);
  }
});

test("playerHotCueSlot keeps 1–8 outside the rating widget", () => {
  for (let slot = 1; slot <= 8; slot += 1) {
    assert.equal(playerHotCueSlot(String(slot)), slot, `hot cue ${slot}`);
  }
  assert.equal(playerHotCueSlot("0"), null, "0 is never a hot cue");
  assert.equal(playerHotCueSlot("9"), null);
  assert.equal(playerHotCueSlot("a"), null);
  assert.equal(playerHotCueSlot("Enter"), null);
});

test("playerHotCueSlot refuses the widget's digits while it has focus", () => {
  for (const key of ["0", "1", "2", "3", "4", "5"]) {
    assert.equal(
      playerHotCueSlot(key, { insideRatingWidget: true }),
      null,
      `${key} belongs to the rating cell`
    );
  }
  // 6–8 are not rating keys, so the player still owns them inside the cell.
  for (let slot = 6; slot <= 8; slot += 1) {
    assert.equal(playerHotCueSlot(String(slot), { insideRatingWidget: true }), slot);
  }
});

test("playerHotCueSlot ignores modified digits everywhere", () => {
  for (const key of ["1", "5", "8"]) {
    assert.equal(playerHotCueSlot(key, { modified: true }), null);
    assert.equal(playerHotCueSlot(key, { modified: true, insideRatingWidget: true }), null);
  }
});

test("the rating widget and the player never both claim a digit", () => {
  // The marker the component writes and the player reads must be the same one.
  assert.equal(RATING_WIDGET_ATTRIBUTE, "data-rating-widget");
  for (const key of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
    const widgetOwns = handleRatingKey(fakeKeyEvent(key)) !== undefined;
    const playerOwns = playerHotCueSlot(key, { insideRatingWidget: true }) !== null;
    assert.equal(
      widgetOwns && playerOwns,
      false,
      `${key} must not be claimed by both the rating widget and the player`
    );
  }
});

test("a simulated player listener stays quiet for the focused rating cell", () => {
  // Shape of the guard in PreviewPlayer: the event target sits inside the
  // marker the widget writes.
  const targetInsideWidget = {
    closest: (selector: string) => (selector === `[${RATING_WIDGET_ATTRIBUTE}]` ? {} : null),
  };
  const targetOutsideWidget = { closest: () => null };

  const firePlayerKey = (
    key: string,
    target: { closest: (selector: string) => unknown } | null
  ) => {
    const triggered: number[] = [];
    const slot = playerHotCueSlot(key, {
      insideRatingWidget: Boolean(target?.closest(`[${RATING_WIDGET_ATTRIBUTE}]`)),
    });
    if (slot !== null) triggered.push(slot);
    return triggered;
  };

  for (const key of ["0", "1", "2", "3", "4", "5"]) {
    assert.deepEqual(
      firePlayerKey(key, targetInsideWidget),
      [],
      `hot cue must not fire for ${key} inside the rating cell`
    );
  }
  // Outside the widget every unmodified 1–8 still reaches the player.
  for (let slot = 1; slot <= 8; slot += 1) {
    assert.deepEqual(firePlayerKey(String(slot), targetOutsideWidget), [slot]);
  }
  // Inside the widget the player still owns 6–8.
  assert.deepEqual(firePlayerKey("6", targetInsideWidget), [6]);
});

test("ratingTabStop follows the focused star, then the committed rating", () => {
  // Nothing has taken focus yet: the value carries the stop, else the first star.
  assert.equal(ratingTabStop(null, 4), 4);
  assert.equal(ratingTabStop(null, 0), 1);
  // A mixed multi-track selection keeps the value empty while a star is
  // focused, so the stop has to move to that star — otherwise Shift+Tab
  // revisits star 1 instead of leaving the control.
  assert.equal(ratingTabStop(4, 0), 4);
  assert.equal(ratingTabStop(1, 3), 1);
});
