import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { Star } from "lucide-react";

/**
 * Editable 5-star rating (T2.1.4, `docs/ui/03-LIBRARY-VIEW.md` §3.4).
 *
 * The widget is deliberately dumb: it reports the star that was clicked and
 * nothing else. Clearing, persistence and Undo belong to the caller, so the
 * same component works for a single track and for a multi-track selection.
 *
 * Interaction contract (from the spec):
 * - click a star → set that rating (1–5);
 * - click the star that is already set → clear it;
 * - `1`–`5` set a rating, `0` clears it, when the cell has focus.
 */
interface StarRatingProps {
  /** Current rating, or `null`/`undefined` when the track is unrated. */
  value: number | null | undefined;
  /** Called with the new rating, or `null` when the rating is cleared. */
  onChange?: (rating: number | null) => void;
  /** Renders the stars as plain output and ignores pointer/keyboard input. */
  readOnly?: boolean;
  /** Accessible name of the group. */
  label?: string;
  /** Icon size classes; the table uses the compact default. */
  className?: string;
}

const STAR_COUNT = 5;

/** Clamps an arbitrary value into the 0–5 range the stars can show. */
function normalize(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(STAR_COUNT, Math.max(0, Math.round(value)));
}

export function StarRating({
  value,
  onChange,
  readOnly = false,
  label = "Rating",
  className = "h-3.5 w-3.5",
}: StarRatingProps) {
  const current = value == null ? 0 : normalize(value);
  // Hover preview: the stars light up to the hovered one so the target of the
  // click is visible before it happens.
  const [hovered, setHovered] = useState<number | null>(null);
  const preview = hovered ?? current;

  // The committed value wins over a stale hover target: once a rating is
  // written, the preview drops the hovered star so the widget shows what was
  // actually stored (e.g. after a keyboard write, where the pointer never
  // moved and no new hover event arrives).
  useEffect(() => {
    setHovered(null);
  }, [current]);

  const commit = (star: number) => {
    if (readOnly || !onChange) return;
    // Clicking the star that is already set clears the rating (spec §3.4).
    onChange(star === current ? null : star);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || !onChange) return;
    const key = event.key;
    // Ctrl/Cmd/Alt + digit belongs to the app's global shortcuts (Ctrl/Cmd+1-4
    // switch views) and to the player's hot cues — never to the rating.
    const modified = event.ctrlKey || event.metaKey || event.altKey;
    if (modified) return;

    if (key >= "1" && key <= String(STAR_COUNT)) {
      event.preventDefault();
      // The digits belong to this widget: stop them here so they never reach
      // the preview player's window listener, where 1-8 trigger hot cues.
      event.stopPropagation();
      // The keyboard contract sets a rating; only a click toggles it.
      onChange(Number(key));
      return;
    }
    if (key === "0") {
      event.preventDefault();
      event.stopPropagation();
      onChange(null);
      return;
    }
    // Enter and Space are the row keys: the widget handles them on the
    // button, so they must not reach the row handler behind it. Every other
    // key — Escape, Tab, … — keeps bubbling, so the app-level actions
    // (Escape closes the inspector) still work from this control.
    if (key === "Enter" || key === " ") {
      event.stopPropagation();
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-0.5"
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: STAR_COUNT }, (_, index) => {
        const star = index + 1;
        const filled = star <= preview;
        const isCurrent = star === current;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            aria-label={
              readOnly
                ? `Rating ${current} of ${STAR_COUNT}`
                : isCurrent
                  ? `Clear rating (currently ${current} of ${STAR_COUNT})`
                  : `Rate ${star} of ${STAR_COUNT}`
            }
            aria-pressed={isCurrent}
            title={
              readOnly
                ? `Rating ${current} of ${STAR_COUNT}`
                : isCurrent
                  ? `Clear rating (currently ${current})`
                  : `Rate ${star} of ${STAR_COUNT}`
            }
            onClick={(event) => {
              // The row underneath owns the click for selection; a star click
              // must not also toggle the selection.
              event.stopPropagation();
              commit(star);
            }}
            onMouseEnter={() => {
              if (!readOnly) setHovered(star);
            }}
            onFocus={() => {
              if (!readOnly) setHovered(star);
            }}
            onBlur={() => setHovered(null)}
            className={`rounded-sm p-px transition focus:outline-hidden focus-visible:ring-1 focus-visible:ring-dj-accent ${
              filled
                ? "text-dj-accent"
                : readOnly
                  ? "text-dj-text-muted"
                  : "text-dj-text-muted hover:text-dj-accent"
            }`}
          >
            <Star className={className} fill={filled ? "currentColor" : "none"} />
          </button>
        );
      })}
    </div>
  );
}
