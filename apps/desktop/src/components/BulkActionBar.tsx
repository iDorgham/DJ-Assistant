import { Download, ListChecks, ListMusic, Pencil, Tag, Waves, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  BULK_ACTIONS,
  bulkActionTooltip,
  describeSelection,
  isBulkActionBlocked,
  type BulkAction,
  type BulkActionId,
} from "../lib/bulk-actions";
import { StarRating } from "./StarRating";

/**
 * Bulk action bar (T2.1.3, `docs/ui/03-LIBRARY-VIEW.md` §6).
 *
 * Appears above the table for a real multi-selection. The scope is announced
 * first, then the actions — the live ones are wired, and the rest are shown
 * `aria-disabled` with the reason they are missing, exactly like the row
 * context menu. They are not made `disabled`: a disabled button takes no
 * pointer events and Chromium never shows its `title`, so the reason would
 * never render.
 *
 * The bar owns no write: every action is a callback into the library view,
 * which already owns the reversible write path and the Undo toast.
 */
interface BulkActionBarProps {
  /** How many tracks the write will land on. */
  count: number;
  /** Opens the metadata editor on the selection. */
  onEditMetadata: () => void;
  /** Sets (or clears, with `null`) the rating on every selected track. */
  onRate: (rating: number | null) => void;
  /** Drops the selection. */
  onClear: () => void;
}

const ACTION_ICONS: Record<BulkActionId, LucideIcon | null> = {
  editMetadata: Pencil,
  // The stars are the control, not an icon in front of a label.
  rate: null,
  analyze: Waves,
  fixTags: Tag,
  addToPlaylist: ListMusic,
  addToSet: ListChecks,
  exportSelection: Download,
  clearSelection: X,
};

const BUTTON_CLASS =
  "inline-flex h-6 items-center gap-1 rounded-sm border border-dj-border bg-dj-elevated px-2 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dj-accent";

const BLOCKED_CLASS =
  "inline-flex h-6 cursor-not-allowed items-center gap-1 rounded-sm border border-dj-border bg-dj-elevated px-2 text-[11px] text-dj-text-muted opacity-60";

function BulkButton({ action, onActivate }: { action: BulkAction; onActivate: () => void }) {
  const blocked = isBulkActionBlocked(action.id);
  const Icon = ACTION_ICONS[action.id];
  return (
    <button
      type="button"
      aria-disabled={blocked || undefined}
      title={bulkActionTooltip(action) ?? action.label}
      onClick={() => {
        if (blocked) return;
        onActivate();
      }}
      className={blocked ? BLOCKED_CLASS : BUTTON_CLASS}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      <span>{action.label}</span>
    </button>
  );
}

export function BulkActionBar({ count, onEditMetadata, onRate, onClear }: BulkActionBarProps) {
  if (count < 2) return null;

  const handlers: Partial<Record<BulkActionId, () => void>> = {
    editMetadata: onEditMetadata,
    clearSelection: onClear,
  };

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-1.5 border-b border-dj-border bg-dj-panel px-5 py-1.5 text-[11px] text-dj-text-secondary"
    >
      <span aria-live="polite" className="mr-1 font-mono font-medium text-dj-accent">
        {describeSelection(count)}
      </span>
      <span className="mr-1 text-dj-text-muted">· edits apply to all</span>

      {BULK_ACTIONS.map((action) => {
        if (action.id === "rate") {
          return (
            <div
              key={action.id}
              className="inline-flex h-6 items-center gap-1 rounded-sm border border-dj-border bg-dj-elevated px-2"
            >
              <span className="text-[11px] text-dj-text-muted">Rate</span>
              {/* Mixed ratings seed empty: the stars show what the write will
                  set, not one track's value carried onto the others. */}
              <StarRating value={null} onChange={onRate} label={`Rate ${count} selected tracks`} />
              <button
                type="button"
                onClick={() => onRate(null)}
                title="Clear the rating on every selected track"
                className="ml-0.5 rounded-sm px-1 text-[10px] text-dj-text-muted transition hover:bg-dj-hover hover:text-dj-text focus:outline-hidden focus-visible:ring-1 focus-visible:ring-dj-accent"
              >
                Clear
              </button>
            </div>
          );
        }

        if (action.id === "clearSelection") {
          return (
            <button
              key={action.id}
              type="button"
              onClick={onClear}
              title="Drop the multi-selection"
              className="ml-auto inline-flex h-6 items-center gap-1 rounded-sm px-2 text-[11px] text-dj-text-muted underline decoration-dotted transition hover:text-dj-text-secondary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dj-accent"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              <span>{action.label}</span>
            </button>
          );
        }

        return (
          <BulkButton
            key={action.id}
            action={action}
            onActivate={handlers[action.id] ?? (() => undefined)}
          />
        );
      })}
    </div>
  );
}
