/**
 * Bulk action bar model (T2.1.3, `docs/ui/03-LIBRARY-VIEW.md` §6).
 *
 * Kept free of React so the bar's contract is testable with `node --test` — the
 * desktop harness runs `.test.ts` only, so anything decided here is decided
 * where it can be proven.
 *
 * Two rules the component must not re-decide:
 *
 * * **Every blocked action carries the reason it is blocked.** A greyed-out
 *   button with no explanation reads as a bug; the reasons are the same strings
 *   the row context menu uses where the feature is the same, so the two
 *   surfaces cannot drift.
 * * **The scope is stated before the actions.** A bulk write lands on every
 *   selected track, so the bar names the count in words ("3 tracks selected"),
 *   not only in a number.
 *
 * Visibility: §6 says "when selection > 0", but this table's plain click always
 * leaves one row selected (inspection and selection share the same state). The
 * bar therefore appears for a real multi-selection (`count >= 2`); a single row
 * keeps the context menu and the inline rating/energy cells, and a permanent
 * band under the toolbar would cost the density the Library is designed for.
 */
import { BLOCKED_ACTIONS } from "./library-menu.ts";

export type BulkActionId =
  | "editMetadata"
  | "rate"
  | "analyze"
  | "fixTags"
  | "addToPlaylist"
  | "addToSet"
  | "exportSelection"
  | "clearSelection";

export interface BulkAction {
  id: BulkActionId;
  /** What the button says. */
  label: string;
  /** Why it is blocked — required for every blocked action. */
  tooltip?: string;
}

/** The context menu's wording for the same missing feature. */
function menuReason(id: string): string | undefined {
  return BLOCKED_ACTIONS.find((action) => action.id === id)?.tooltip;
}

/**
 * The bar, in §6 order. `editMetadata` leads because it is the T2.1.3 bulk
 * write that actually exists; the §6 list follows it.
 */
export const BULK_ACTIONS: readonly BulkAction[] = [
  { id: "editMetadata", label: "Edit metadata…" },
  { id: "rate", label: "Rate" },
  { id: "analyze", label: "Analyze", tooltip: menuReason("analyze") },
  {
    id: "fixTags",
    label: "Smart Tag Cleanup",
    tooltip: "Tag cleaning arrives with the Tag Surgeon (T2.2)",
  },
  { id: "addToPlaylist", label: "Add to playlist…", tooltip: menuReason("addToPlaylist") },
  { id: "addToSet", label: "Add to set…", tooltip: menuReason("addToSet") },
  {
    id: "exportSelection",
    label: "Export selection",
    tooltip: "Export arrives with Phase 3 (rekordbox XML / M3U)",
  },
  { id: "clearSelection", label: "Clear selection" },
];

/** The actions that are wired today. Everything else renders blocked. */
const LIVE_ACTIONS: ReadonlySet<BulkActionId> = new Set<BulkActionId>([
  "editMetadata",
  "rate",
  "clearSelection",
]);

/** True when the bar must render this action greyed out, with its reason. */
export function isBulkActionBlocked(id: BulkActionId): boolean {
  return !LIVE_ACTIONS.has(id);
}

/** The explanation a blocked action shows; live actions have none. */
export function bulkActionTooltip(action: BulkAction): string | undefined {
  return isBulkActionBlocked(action.id) ? action.tooltip : undefined;
}

/**
 * The scope line. Zero is not a state the bar renders, but it is defined so a
 * caller cannot print "0 tracks selected" by accident.
 */
export function describeSelection(count: number): string {
  if (count <= 0) return "No tracks selected";
  return `${count} track${count === 1 ? "" : "s"} selected`;
}
