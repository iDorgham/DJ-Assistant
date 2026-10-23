import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Pencil, Tag } from "lucide-react";

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
}

const MENU_MARGIN = 8;

export function RowContextMenu({
  x,
  y,
  trackTitle,
  onEditTags,
  onClose,
  restoreFocus,
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
      const items = itemRefs.current.filter((item): item is HTMLButtonElement => item !== null);
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current === -1 ? 0 : (current + step + items.length) % items.length;
      items[next]?.focus();
    }
  };

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={`Actions for ${trackTitle}`}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      className="fixed z-50 min-w-[11rem] overflow-hidden rounded-md border border-dj-border-strong bg-dj-panel py-1 shadow-2xl shadow-black/60"
    >
      <button
        ref={(element) => {
          itemRefs.current[0] = element;
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
          itemRefs.current[1] = element;
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
    </div>
  );
}
