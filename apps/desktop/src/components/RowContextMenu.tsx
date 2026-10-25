import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, Columns3, Pencil, Play, Star, Tag } from "lucide-react";
import type { ColumnId, ColumnState } from "../lib/library-columns";

/**
 * Row context menu (T2.1.7, `docs/ui/03-LIBRARY-VIEW.md` §3.5).
 *
 * A right-click on a library row opens this menu at the cursor. It closes on
 * Escape, on a click outside it, and after an action — and it hands the focus
 * back to the row it came from, so a keyboard user is never stranded.
 *
 * The menu ships **only** the actions that exist today. The other items the
 * spec lists (Fix tags, Add to playlist, Find in playlists, Mix suggestions,
 * online find, Remove from library) act on features that do not exist yet;
 * they are added when they do, rather than shipped as disabled clutter.
 *
 * The spec's selection semantics carry over: an action either applies to the
 * whole selection or acts on the focused row. Which is which is the caller's
 * decision — this component only reports the action.
 */
interface RowContextMenuProps {
  /** Where the menu opens — the cursor position, in viewport pixels. */
  x: number;
  y: number;
  /** The track the menu was opened on; names the menu for screen readers. */
  trackTitle: string;
  /** Opens the metadata editor for the track. */
  onEditTags: () => void;
  /** Closes the menu. */
  onClose: () => void;
  /**
   * Returns the focus to the row the menu was opened from.
   *
   * Called when the menu unmounts, so every closing path — Escape, an outside
   * click, an action — gives the focus back. Skipped when an action was
   * chosen, because the editor takes the focus from there.
   */
  restoreFocus?: () => void;
  /** Set rating for the selection/context track. */
  onRate?: (rating: 0 | 1 | 2 | 3 | 4 | 5) => void;
  /** Current rating for visual state. */
  currentRating?: number | null;
  /** Trigger playback for the resolved selection. */
  onPlay?: () => void;
  /** If true, Play action is disabled with explanation in title. */
  playDisabled?: boolean;
  /** Explanation for disabled Play action. */
  playDisabledReason?: string;
  /** Current column configuration for toggles. */
  columns?: readonly ColumnState[];
  /** Toggle column visibility. */
  onToggleColumn?: (id: ColumnId) => void;
  /** Check if a column can be hidden (respects identity guard). */
  canHideColumnFn?: (columns: readonly ColumnState[], id: ColumnId) => boolean;
}

const MENU_MARGIN = 8;

export function RowContextMenu({
  x,
  y,
  trackTitle,
  onEditTags,
  onClose,
  restoreFocus,
  onRate,
  currentRating,
  onPlay,
  playDisabled = false,
  playDisabledReason = "Playback unavailable for this track",
  columns,
  onToggleColumn,
  canHideColumnFn,
}: RowContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Set when an action was chosen: the editor takes the focus from there, so
  // the row must not steal it back.
  const actionTakenRef = useRef(false);
  const [position, setPosition] = useState({ left: x, top: y });

  // Keep the menu inside the viewport: near an edge it opens towards the
  // cursor instead of away from it.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width + MENU_MARGIN > window.innerWidth) {
      left = Math.max(MENU_MARGIN, x - rect.width);
    }
    if (top + rect.height + MENU_MARGIN > window.innerHeight) {
      top = Math.max(MENU_MARGIN, y - rect.height);
    }
    setPosition({ left, top });
  }, [x, y]);

  // The focus goes to the first item on open, and back to the row on close.
  // The callback is read from a ref, so a caller that passes a new function on
  // every render does not re-run this effect and steal the focus back from
  // the item the user moved to with the arrow keys.
  const restoreFocusRef = useRef(restoreFocus);
  restoreFocusRef.current = restoreFocus;

  useEffect(() => {
    itemRefs.current[0]?.focus();
    return () => {
      if (!actionTakenRef.current) restoreFocusRef.current?.();
    };
  }, []);

  // A click outside the menu closes it. The listener is on the document, so
  // the click that opened the menu cannot close it again.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointerDown, true);
    return () => document.removeEventListener("mousedown", onPointerDown, true);
  }, [onClose]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      // The menu owns Escape while it is open — the app-level handler must
      // not also close the inspector behind it.
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null && !item.disabled);
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current === -1 ? 0 : (current + step + items.length) % items.length;
      items[next]?.focus();
    }
  };

  const rating = currentRating == null ? 0 : Math.min(5, Math.max(0, Math.round(currentRating)));
  const columnList = columns ?? [];

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={`Actions for ${trackTitle}`}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      className="fixed z-50 min-w-[12rem] overflow-hidden rounded-md border border-dj-border-strong bg-dj-panel py-1 shadow-2xl shadow-black/60"
    >
      <button
        ref={(element) => {
          itemRefs.current[0] = element;
        }}
        type="button"
        role="menuitem"
        disabled={playDisabled}
        title={playDisabled ? playDisabledReason : "Play track"}
        onClick={() => {
          if (playDisabled) return;
          actionTakenRef.current = true;
          // Play behavior:
          // - If the context menu was opened on an unselected row, that row is selected first (see handleRowContextMenu in App.tsx)
          // - If the context menu was opened on a multi-selection, play the context-track (the one right-clicked)
          // - This matches the existing multi-select contract
          onPlay?.();
          onClose();
        }}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition ${
          playDisabled
            ? "text-dj-text-muted opacity-60"
            : "text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text focus:bg-dj-hover focus:text-dj-text focus:outline-hidden"
        }`}
      >
        <Play className="h-3.5 w-3.5 shrink-0" />
        <span>Play</span>
      </button>
      <div className="my-1 h-px bg-dj-border" />
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-dj-text-muted">Rate</div>
      <div className="flex items-center gap-1 px-3 py-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="menuitem"
            title={rating === star ? `Clear rating (currently ${rating})` : `Rate ${star} of 5`}
            aria-label={rating === star ? `Clear rating (currently ${rating})` : `Rate ${star} of 5`}
            onClick={() => {
              if (!onRate) return;
              actionTakenRef.current = true;
              onRate(rating === star ? 0 : (star as 0 | 1 | 2 | 3 | 4 | 5));
              onClose();
            }}
            className={`rounded-sm p-0.5 transition focus:outline-hidden focus-visible:ring-1 focus-visible:ring-dj-accent ${
              star <= rating ? "text-dj-accent" : "text-dj-text-muted hover:text-dj-accent"
            }`}
          >
            <Star className="h-3.5 w-3.5" fill={star <= rating ? "currentColor" : "none"} />
          </button>
        ))}
        <button
          type="button"
          role="menuitem"
          title="Clear rating"
          aria-label="Clear rating"
          onClick={() => {
            if (!onRate) return;
            actionTakenRef.current = true;
            onRate(0);
            onClose();
          }}
          className="ml-1 rounded-sm px-1.5 py-0.5 text-[10px] text-dj-text-muted transition hover:bg-dj-hover hover:text-dj-text focus:outline-hidden focus-visible:ring-1 focus-visible:ring-dj-accent"
        >
          Clear
        </button>
      </div>
      <div className="my-1 h-px bg-dj-border" />
      <button
        ref={(element) => {
          itemRefs.current[1] = element;
        }}
        type="button"
        role="menuitem"
        onClick={() => {
          actionTakenRef.current = true;
          onEditTags();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text focus:bg-dj-hover focus:text-dj-text focus:outline-hidden"
      >
        <Pencil className="h-3.5 w-3.5 shrink-0 text-dj-text-muted" />
        <span>Edit tags…</span>
      </button>
      <button
        ref={(element) => {
          itemRefs.current[2] = element;
        }}
        type="button"
        role="menuitem"
        disabled
        title="Tag cleaning arrives with the Tag Surgeon (T2.2)"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-dj-text-muted opacity-60"
      >
        <Tag className="h-3.5 w-3.5 shrink-0" />
        <span>Fix tags</span>
      </button>
      {columns && onToggleColumn && (
        <>
          <div className="my-1 h-px bg-dj-border" />
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-dj-text-muted">View columns</div>
          {columnList.map((col) => {
            const def = { label: col.id } as any; // will look up properly via canHideColumn
            const canHide = canHideColumnFn ? canHideColumnFn(columnList, col.id) : true;
            const disabled = col.visible && !canHide;
            const label = col.id === "index" ? "#" : col.id === "artwork" ? "Art" : col.id.charAt(0).toUpperCase() + col.id.slice(1);
            return (
              <button
                key={col.id}
                type="button"
                role="menuitem"
                disabled={disabled}
                title={disabled ? "The last identity column cannot be hidden." : col.visible ? "Hide column" : "Show column"}
                onClick={() => {
                  if (disabled) return;
                  actionTakenRef.current = true;
                  onToggleColumn(col.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition ${
                  disabled
                    ? "text-dj-text-muted opacity-60"
                    : "text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text focus:bg-dj-hover focus:text-dj-text focus:outline-hidden"
                }`}
              >
                <span className="w-3.5">{col.visible ? <Check className="h-3.5 w-3.5" /> : null}</span>
                <Columns3 className="h-3.5 w-3.5 shrink-0 text-dj-text-muted" />
                <span>{label}</span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
