import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { Star } from "lucide-react";

import { RATING_WIDGET_ATTRIBUTE, handleRatingKey, ratingTabStop } from "../lib/rating-keys";

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
const isButtonActivationKey = (key: string) => key === "Enter" || key === " ";

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
  // Which star the keyboard last landed on. The committed value cannot answer
  // that for a mixed multi-track selection, where it stays empty.
  const [focusedStar, setFocusedStar] = useState<number | null>(null);
  const preview = hovered ?? current;
  const descriptionId = useId();

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

  // Roving tab stop: exactly one star is reachable with Tab. It starts on the
  // set rating (or the first star when unrated) and then follows the focused
  // star. The stars stay native buttons, so Enter/Space keep their standard
  // activation behaviour.
  const tabStop = ratingTabStop(focusedStar, current);
  // The digits are the cell’s contract, not each star’s own shortcut: `5` on
  // star 2 sets rating 5. So they are described once for the group instead of
  // advertised on every button.
  const describesRatingKeys = !readOnly && Boolean(onChange);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || !onChange) return;
    // Ctrl/Cmd/Alt + digit belongs to the app's global shortcuts (Ctrl/Cmd+1-6
    // switch views) — never to the rating.
    const action = handleRatingKey(event);
    if (action !== undefined) {
      // The keyboard contract sets a rating; only a click toggles it.
      onChange(action);
      // The keyboard path never moves the pointer, so the preview has to follow
      // the write: the star just set, or nothing at all once cleared.
      setHovered(action);
      // Keep the tab stop on the star the user just committed, so Tab leaves
      // from the control that shows the value. A clear leaves focus where it
      // is — no star carries the value any more.
      if (action !== null) {
        event.currentTarget.querySelectorAll("button")[action - 1]?.focus();
      }
      return;
    }
    // Enter and Space are the row keys: the widget handles them on the
    // button, so they must not reach the row handler behind it. The default
    // action is deliberately NOT cancelled — the focused button's native
    // activation is what calls `commit` (Enter on key-down, Space on
    // key-up), and cancelling it would leave the keyboard path dead. Every
    // other key — Escape, Tab, … — keeps bubbling, so the app-level
    // actions (Escape closes the inspector) still work from this control.
    if (isButtonActivationKey(event.key)) {
      event.stopPropagation();
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describesRatingKeys ? descriptionId : undefined}
      {...{ [RATING_WIDGET_ATTRIBUTE]: "true" }}
      className="inline-flex items-center gap-0.5"
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHovered(null)}
    >
      {describesRatingKeys ? (
        <span id={descriptionId} className="sr-only">
          Press 1 through 5 to set the rating, 0 to clear it.
        </span>
      ) : null}
      {Array.from({ length: STAR_COUNT }, (_, index) => {
        const star = index + 1;
        const filled = star <= preview;
        const isCurrent = star === current;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            // One tab stop for the whole cell: the star the keyboard is on,
            // or the one carrying the value before it has moved. The others
            // stay clickable but are skipped by Tab.
            tabIndex={star === tabStop ? 0 : -1}
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
              setFocusedStar(star);
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
