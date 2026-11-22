/**
 * Pure helpers for the library row context menu (T2.1.10).
 *
 * Kept free of React and Tauri so the menu contract is testable with
 * `node --test` — the component itself is `.tsx` and the desktop harness runs
 * `.test.ts` only, so anything decided here is decided where it can be proven.
 *
 * `docs/ui-ux/03-LIBRARY-VIEW.md` §3.5 is the source for both lists below: which
 * items exist, which of them are not built yet, and which ones act on the whole
 * selection rather than the row under the pointer.
 */

/** Smallest gap the menu keeps from a viewport edge once it has flipped. */
export const MENU_VIEWPORT_MARGIN = 8;

/**
 * One axis of `clampMenuPosition`.
 *
 * A menu that fits where the cursor is stays there. One that would run off the
 * edge opens *towards* the cursor instead — and that flipped position is bounded
 * too: flipping alone can still leave the panel flush against the far edge
 * (`x - width` with the cursor near the start) or, with the cursor on the edge
 * itself, hanging a full margin past the viewport.
 *
 * When the panel is larger than the viewport the upper bound falls below the
 * margin; the margin then wins, so the panel starts at the edge with its
 * breathing room intact rather than at zero.
 */
function clampAxis(position: number, size: number, viewport: number, margin: number): number {
  if (position + size + margin <= viewport) return position;
  const limit = Math.max(margin, viewport - size - margin);
  return Math.min(Math.max(position - size, margin), limit);
}

/**
 * Where the menu's top-left corner lands.
 *
 * The menu opens at the cursor; near the right or bottom edge it would run off
 * the window, so it opens *towards* the cursor instead. The margin is kept even
 * when the panel is larger than the viewport — clamping to zero would pin it to
 * the edge with no breathing room.
 */
export function clampMenuPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = MENU_VIEWPORT_MARGIN
): { left: number; top: number } {
  return {
    left: clampAxis(x, width, viewportWidth, margin),
    top: clampAxis(y, height, viewportHeight, margin),
  };
}

/** The 0–5 rating the menu renders: `null` reads as unrated, and out-of-range values clamp. */
export function menuRating(current: number | null | undefined): number {
  if (current == null) return 0;
  return Math.min(5, Math.max(0, Math.round(current)));
}

/**
 * What clicking a star commits.
 *
 * Clicking the star that is already the rating clears it (0); any other star
 * sets it. This is the same click-to-set / click-again-to-clear rule the
 * `StarRating` cell follows, so the two surfaces cannot disagree.
 */
export function starClickRating(
  current: number | null | undefined,
  star: 1 | 2 | 3 | 4 | 5
): 0 | 1 | 2 | 3 | 4 | 5 {
  return menuRating(current) === star ? 0 : star;
}

export interface BlockedAction {
  /** Stable id the menu component and `appliesToWholeSelection` both use. */
  id: string;
  /** What the row says, copied from the spec so the two cannot drift. */
  label: string;
  /**
   * Why it is disabled, shown as the tooltip. A disabled item with no
   * explanation reads as a bug, so every blocked action has one.
   */
  tooltip: string;
}

/**
 * The §3.5 items whose features are not built. Phase and slice references are
 * the plan's own: Slice 6 (T2.1.11) builds the Mix Suggestions dock, and the
 * playlist / set features land with Phase 3.
 */
export const BLOCKED_ACTIONS: readonly BlockedAction[] = [
  {
    id: "analyze",
    label: "Analyze",
    tooltip: "Selection-scoped analysis coming soon",
  },
  {
    id: "addToPlaylist",
    label: "Add to playlist…",
    tooltip: "Coming in Phase 3",
  },
  { id: "addToSet", label: "Add to set…", tooltip: "Coming in Phase 3" },
  { id: "findInPlaylists", label: "Find in playlists…", tooltip: "Coming in Phase 3" },
  {
    id: "mixSuggestions",
    label: "Mix suggestions…",
    tooltip: "Coming in Slice 6",
  },
  {
    id: "findSmallerOnline",
    label: "Find smaller / similar tracks online…",
    tooltip: "Coming in Phase 3",
  },
  {
    id: "findNewOnline",
    label: "Find new tracks online…",
    tooltip: "Coming in Phase 3",
  },
];

const BLOCKED = new Map(BLOCKED_ACTIONS.map((action) => [action.id, action]));

/** True when the menu must render this id disabled, with a reason. */
export function isBlocked(id: string): boolean {
  return BLOCKED.has(id);
}

/** One entry of the row context menu: an action, or the line the spec draws. */
export type MenuEntry =
  { kind: "divider" } | { kind: "item"; id: string; label: string; tooltip?: string };

const item = (id: string, label: string, tooltip?: string): MenuEntry => ({
  kind: "item",
  id,
  label,
  ...(tooltip === undefined ? {} : { tooltip }),
});
const divider: MenuEntry = { kind: "divider" };

/**
 * The menu, in `docs/ui-ux/03-LIBRARY-VIEW.md` §3.5 order.
 *
 * The order lives here rather than in the component because the component is
 * `.tsx` and the desktop harness runs `.test.ts` — a row moved in the JSX could
 * not fail anything, while the spec says these seven groups appear in this
 * sequence with Remove last.
 */
export const MENU_LAYOUT: readonly MenuEntry[] = [
  item("play", "Play"),
  item("analyze", "Analyze"),
  divider,
  item("editTags", "Edit tags…"),
  item("fixTags", "Fix tags"),
  item("rate", "Rate"),
  divider,
  item("addToPlaylist", "Add to playlist…"),
  item("addToSet", "Add to set…"),
  item("findInPlaylists", "Find in playlists…"),
  item("mixSuggestions", "Mix suggestions…"),
  divider,
  item("findSmallerOnline", "Find smaller / similar tracks online…"),
  item("findNewOnline", "Find new tracks online…"),
  divider,
  item("viewColumns", "View columns"),
  divider,
  item("reveal", "Reveal in Finder / Explorer"),
  item("copyPath", "Copy path"),
  divider,
  item("remove", "Remove from library…"),
];

/**
 * Whether the menu renders this id greyed out.
 *
 * The blocked stubs are the only disabled items; `fixTags` went live with the
 * Tag Surgeon's read-only scan (T2.2.1).
 */
export function isDisabled(id: string): boolean {
  return isBlocked(id);
}

/**
 * The explanation a disabled item shows.
 *
 * Blocked stubs come from `BLOCKED_ACTIONS`. Everything else is live and has
 * no reason to explain.
 */
export function itemTooltip(entry: MenuEntry): string | undefined {
  if (entry.kind !== "item") return undefined;
  return BLOCKED.get(entry.id)?.tooltip ?? entry.tooltip;
}

const SELECTION_ACTIONS = new Set([
  "analyze",
  "fixTags",
  "addToPlaylist",
  "addToSet",
  "remove",
  // §3.4: a multi-select rating change applies to every selected track.
  "rate",
]);

/**
 * Whether the action takes the whole selection or the primary row alone.
 *
 * An id that is neither in the selection list nor known to the menu is treated
 * as single-row — the safe default, because acting on a selection the user did
 * not mean is the destructive mistake.
 */
export function appliesToWholeSelection(id: string): boolean {
  return SELECTION_ACTIONS.has(id);
}

/**
 * The Remove toast. `count` is what the backend actually stamped, not the size
 * of the selection: a selection that was already out of the library removes
 * nothing, and the toast must not claim otherwise — or offer an Undo for a
 * write that never happened.
 */
export function describeRemove(count: number): string {
  if (count === 0) {
    return "Nothing to remove — those tracks are already out of the library";
  }
  return `Removed ${count} track${count === 1 ? "" : "s"} from library`;
}

/**
 * The Undo-remove toast. A track removed *again* after this snapshot is
 * skipped rather than resurrected, so the two counts are reported apart — the
 * same contract the metadata undo follows.
 */
export function describeUndoRemove(restored: number, skipped: number): string {
  if (restored === 0) {
    return `Nothing restored — ${skipped} track${skipped === 1 ? "" : "s"} removed again since`;
  }
  const head = `Undone — ${restored} track${restored === 1 ? "" : "s"} back in the library`;
  return skipped > 0 ? `${head}, ${skipped} skipped (removed again since)` : head;
}

/**
 * The Restore toast (issue #62). `count` is what the backend actually cleared,
 * not the size of the selection: a track removed again after this command read
 * it is skipped rather than overwritten, so the two counts are reported apart.
 */
export function describeRestore(count: number, skipped: number): string {
  if (count === 0) {
    return `Nothing restored — ${skipped} track${skipped === 1 ? "" : "s"} removed again since`;
  }
  const head = `Restored ${count} track${count === 1 ? "" : "s"} to library`;
  return skipped > 0 ? `${head}, ${skipped} skipped (removed again since)` : head;
}

/**
 * The Undo toast for a restore. Undoing a restore removes the tracks again, so
 * the wording runs the opposite way from the removal's own undo — the same
 * snapshot table, two different directions.
 */
export function describeUndoRestore(restored: number, skipped: number): string {
  if (restored === 0) {
    return `Nothing undone — ${skipped} track${skipped === 1 ? "" : "s"} changed since`;
  }
  const head = `Undone — ${restored} track${restored === 1 ? "" : "s"} removed again`;
  return skipped > 0 ? `${head}, ${skipped} skipped (changed since)` : head;
}

/**
 * How many tracks the removed view holds, phrased for a toolbar button. Zero
 * must read as an ordinary part of the library, not as something to fix.
 */
export function describeRemovedCount(count: number): string {
  return count === 0 ? "Removed" : `Removed (${count})`;
}
