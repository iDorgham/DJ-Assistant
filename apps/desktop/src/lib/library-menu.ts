/**
 * Pure helpers for the library row context menu (T2.1.10).
 *
 * Kept free of React and Tauri so the menu contract is testable with
 * `node --test` — the component itself is `.tsx` and the desktop harness runs
 * `.test.ts` only, so anything decided here is decided where it can be proven.
 *
 * `docs/ui/03-LIBRARY-VIEW.md` §3.5 is the source for both lists below: which
 * items exist, which of them are not built yet, and which ones act on the whole
 * selection rather than the row under the pointer.
 */

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
 * The menu, in `docs/ui/03-LIBRARY-VIEW.md` §3.5 order.
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
  item("fixTags", "Fix tags", "Tag cleaning arrives with the Tag Surgeon (T2.2)"),
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
 * `fixTags` is the one stub that is not in `BLOCKED_ACTIONS`: its feature exists
 * on the roadmap (Tag Surgeon, T2.2) rather than being blocked, so it is
 * disabled with its own line in the layout.
 */
export function isDisabled(id: string): boolean {
  return isBlocked(id) || id === "fixTags";
}

/**
 * The explanation a disabled item shows.
 *
 * Blocked stubs come from `BLOCKED_ACTIONS`; `fixTags` is a stub whose feature
 * is scheduled elsewhere, so it carries its own line in the layout. Everything
 * else is live and has no reason to explain.
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
