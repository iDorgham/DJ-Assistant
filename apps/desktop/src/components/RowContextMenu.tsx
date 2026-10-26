import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Check,
  Columns3,
  Copy,
  FileMinus,
  FolderOpen,
  Globe,
  HardDrive,
  ListChecks,
  ListMusic,
  Pencil,
  Play,
  Search,
  Sparkles,
  Star,
  Tag,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ColumnId, ColumnState } from "../lib/library-columns";
import { isDisabled, itemTooltip, MENU_LAYOUT } from "../lib/library-menu";
import type { MenuEntry } from "../lib/library-menu";

/**
 * Row context menu (T2.1.7 / T2.1.10, `docs/ui/03-LIBRARY-VIEW.md` §3.5).
 *
 * A right-click on a library row opens this menu at the cursor. It closes on
 * Escape, on a click outside it, and after an action — and it hands the focus
 * back to the row it came from, so a keyboard user is never stranded.
 *
 * The rows and their order come from `MENU_LAYOUT`, which is tested against the
 * spec. This component only renders that list: a plain row, or one of the two
 * widgets the list names by id (`rate`, `viewColumns`). Items whose feature is
 * not built are rendered disabled with the reason they are disabled, so the
 * menu shows the shape of the feature instead of hiding it.
 *
 * Which track an action lands on — the whole selection or the row under the
 * pointer — is the caller's decision, and `library-menu.appliesToWholeSelection`
 * says which is which; this component only reports the action.
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
  /** Show the track's file in the OS file manager. */
  onReveal?: () => void;
  /** Put the track's file path on the clipboard. */
  onCopyPath?: () => void;
  /** Ask to remove the track(s) from the library — the caller confirms first. */
  onRemove?: () => void;
}

const MENU_MARGIN = 8;

/** The row icon per menu id. Widgets (`rate`, `viewColumns`) draw their own. */
const MENU_ICONS: Record<string, LucideIcon> = {
  play: Play,
  analyze: Waves,
  editTags: Pencil,
  fixTags: Tag,
  addToPlaylist: ListMusic,
  addToSet: ListChecks,
  findInPlaylists: Search,
  mixSuggestions: Sparkles,
  findSmallerOnline: HardDrive,
  findNewOnline: Globe,
  reveal: FolderOpen,
  copyPath: Copy,
  remove: FileMinus,
};

/** The focusable rows, in DOM order — every item but the disabled ones. */
function menuItems(panel: HTMLElement | null): HTMLButtonElement[] {
  return Array.from(
    panel?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []
  );
}

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  disabled?: boolean;
  /** Marks the destructive row, so it does not read like the actions above it. */
  danger?: boolean;
  onActivate: () => void;
}

function MenuItem({ icon: Icon, label, tooltip, disabled, danger, onActivate }: MenuItemProps) {
  const tone = disabled
    ? "text-dj-text-muted opacity-60"
    : danger
      ? "text-dj-danger hover:bg-dj-hover focus:bg-dj-hover focus:outline-hidden"
      : "text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text focus:bg-dj-hover focus:text-dj-text focus:outline-hidden";
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={tooltip ?? label}
      onClick={onActivate}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition ${tone}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

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
  onReveal,
  onCopyPath,
  onRemove,
}: RowContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  // Set when an action was chosen: the editor takes the focus from there, so
  // the row must not steal it back.
  const actionTakenRef = useRef(false);

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
    menuItems(panelRef.current)[0]?.focus();
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
      const items = menuItems(panelRef.current);
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current === -1 ? 0 : (current + step + items.length) % items.length;
      items[next]?.focus();
    }
  };

  const rating = currentRating == null ? 0 : Math.min(5, Math.max(0, Math.round(currentRating)));
  const columnList = columns ?? [];

  // An action closes the menu and keeps the focus away from the row: the thing
  // it opens (editor, dialog, player) owns the focus from here.
  const run = (action?: () => void) => () => {
    if (!action) return;
    actionTakenRef.current = true;
    action();
    onClose();
  };

  const actions: Record<string, (() => void) | undefined> = {
    play: onPlay,
    editTags: onEditTags,
    reveal: onReveal,
    copyPath: onCopyPath,
    remove: onRemove,
  };

  const renderEntry = (entry: MenuEntry, index: number) => {
    if (entry.kind === "divider") {
      return <div key={`divider-${index}`} className="my-1 h-px bg-dj-border" />;
    }
    const { id, label } = entry;

    if (id === "rate") {
      return (
        <div key={id}>
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-dj-text-muted">
            Rate
          </div>
          <div className="flex items-center gap-1 px-3 py-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="menuitem"
                title={rating === star ? `Clear rating (currently ${rating})` : `Rate ${star} of 5`}
                aria-label={
                  rating === star ? `Clear rating (currently ${rating})` : `Rate ${star} of 5`
                }
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
        </div>
      );
    }

    if (id === "viewColumns") {
      // The caller supplies the column state; without it there is nothing to
      // toggle, so the group is absent rather than shown empty.
      if (!columns || !onToggleColumn) return null;
      return (
        <div key={id}>
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-dj-text-muted">
            View columns
          </div>
          {columnList.map((col) => {
            const canHide = canHideColumnFn ? canHideColumnFn(columnList, col.id) : true;
            const colDisabled = col.visible && !canHide;
            const colLabel =
              col.id === "index"
                ? "#"
                : col.id === "artwork"
                  ? "Art"
                  : col.id.charAt(0).toUpperCase() + col.id.slice(1);
            return (
              <button
                key={col.id}
                type="button"
                role="menuitem"
                disabled={colDisabled}
                title={
                  colDisabled
                    ? "The last identity column cannot be hidden."
                    : col.visible
                      ? "Hide column"
                      : "Show column"
                }
                onClick={() => {
                  if (colDisabled) return;
                  actionTakenRef.current = true;
                  onToggleColumn(col.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition ${
                  colDisabled
                    ? "text-dj-text-muted opacity-60"
                    : "text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text focus:bg-dj-hover focus:text-dj-text focus:outline-hidden"
                }`}
              >
                <span className="w-3.5">
                  {col.visible ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <Columns3 className="h-3.5 w-3.5 shrink-0 text-dj-text-muted" />
                <span>{colLabel}</span>
              </button>
            );
          })}
        </div>
      );
    }

    const Icon = MENU_ICONS[id];
    if (!Icon) return null;
    // Play is the one live item that can be unavailable for reasons the layout
    // cannot know — a track with no readable file.
    const disabled = id === "play" ? playDisabled : isDisabled(id);
    const tooltip = id === "play" && playDisabled ? playDisabledReason : itemTooltip(entry);
    return (
      <MenuItem
        key={id}
        icon={Icon}
        label={label}
        tooltip={tooltip}
        disabled={disabled}
        danger={id === "remove"}
        onActivate={run(actions[id])}
      />
    );
  };

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={`Actions for ${trackTitle}`}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      // The §3.5 list plus the column toggles can stand taller than the
      // window, so the panel scrolls instead of losing its last rows.
      className="fixed z-50 max-h-[calc(100vh-1rem)] min-w-[12rem] overflow-y-auto rounded-md border border-dj-border-strong bg-dj-panel py-1 shadow-2xl shadow-black/60"
    >
      {MENU_LAYOUT.map(renderEntry)}
    </div>
  );
}
