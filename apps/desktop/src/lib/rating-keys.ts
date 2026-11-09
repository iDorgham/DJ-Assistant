/**
 * Pure keyboard-ownership rules for the rating widget (T2.1.4).
 *
 * The widget is a single focusable cell: `1`–`5` set a rating and `0` clears it
 * (`docs/ui/03-LIBRARY-VIEW.md` §3.4). The preview player also listens on
 * `window` for digits 1–8 (hot cues), so two things must be provable:
 *
 * 1. the rating widget claims its digits while it has focus, and
 * 2. the player refuses those digits when the event came from inside the
 *    widget — even if a listener ordering ever lets the event reach `window`.
 *
 * Kept free of React and the DOM so `node --test` can prove both halves. The
 * component reads the `data-rating-widget` marker this module names.
 */

/** The attribute the rating cell carries so the player can recognise it. */
export const RATING_WIDGET_ATTRIBUTE = "data-rating-widget";

export interface KeyModifiers {
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/** Digits the rating widget owns while focused: 1–5 set, 0 clears. */
export function isRatingKey(key: string): boolean {
  return key === "0" || (key.length === 1 && key >= "1" && key <= "5");
}

/**
 * What a key press commits: `1`–`5` for a rating, `null` for `0` (clear), and
 * `undefined` when the key is not the rating widget's.
 *
 * Modified digits are deliberately **not** rating keys: `Ctrl/Cmd+1…6` switch
 * primary views, and that must keep working from anywhere, including a focused
 * rating cell.
 */
export function ratingKeyAction(
  key: string,
  modifiers: KeyModifiers = {}
): number | null | undefined {
  if (modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey) return undefined;
  if (key === "0") return null;
  if (key.length === 1 && key >= "1" && key <= "5") return Number(key);
  return undefined;
}

/**
 * The event shape the widget needs. Kept structural so the tests can pass a
 * plain object and prove the two cancellation calls without a DOM.
 */
export interface RatingKeyEvent extends KeyModifiers {
  key: string;
  preventDefault: () => void;
  stopPropagation: () => void;
}

/**
 * Claims a key for the rating widget: returns the action and cancels the
 * event, or returns `undefined` and leaves the event alone.
 *
 * Cancelling both the default action and propagation is what keeps a digit
 * from reaching the preview player's `window` hot-cue listener. The player
 * *also* refuses these digits by marker, so the guarantee does not depend on
 * listener ordering alone.
 */
export function handleRatingKey(event: RatingKeyEvent): number | null | undefined {
  const action = ratingKeyAction(event.key, event);
  if (action === undefined) return undefined;
  event.preventDefault();
  event.stopPropagation();
  return action;
}

/**
 * The player's hot-cue slot for a key, or `null` when the player must not act.
 *
 * The player keeps hot cues 6–8 inside the rating cell (the widget owns only
 * 1–5 and 0), and keeps every unmodified digit outside it. Modified digits
 * belong to the app's view shortcuts.
 */
export function playerHotCueSlot(
  key: string,
  {
    modified = false,
    insideRatingWidget = false,
  }: { modified?: boolean; insideRatingWidget?: boolean } = {}
): number | null {
  if (modified) return null;
  if (insideRatingWidget && isRatingKey(key)) return null;
  if (key.length !== 1 || key < "1" || key > "8") return null;
  return Number(key);
}
