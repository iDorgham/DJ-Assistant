import { useState } from "react";

/**
 * Energy meter (T2.1.6, `docs/ui/03-LIBRARY-VIEW.md` §3.6).
 *
 * Ten segments stand for the 1–10 energy scale; the filled ones carry the
 * accent colour. A track without an energy value renders as a depleted meter
 * (all segments empty) rather than as text, so the cell still offers the
 * click target that sets a value. The plain-text form of the same cell is
 * `—` (see `formatEnergy` in `lib/library.ts`), which is what the column
 * reports for copy-to-clipboard and width auto-fit.
 *
 * Interaction contract:
 * - click a segment → set that energy level;
 * - click the segment that is already set → clear the energy;
 * - the caller owns persistence and Undo, so the same component works for a
 *   single track and for a multi-track selection.
 */
interface EnergyBarsProps {
  /** Energy level 1–10, or `null`/`undefined` when none is set. */
  value: number | null | undefined;
  /** Called with the new level, or `null` when the energy is cleared. */
  onChange?: (energy: number | null) => void;
  /** Renders the meter as plain output and ignores pointer input. */
  readOnly?: boolean;
  /** Accessible name of the group. */
  label?: string;
  className?: string;
}

export const ENERGY_MAX = 10;

/** Clamps an arbitrary value into the 1–10 range the meter can show. */
function normalize(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(ENERGY_MAX, Math.max(0, Math.round(value)));
}

export function EnergyBars({
  value,
  onChange,
  readOnly = false,
  label = "Energy",
  className = "",
}: EnergyBarsProps) {
  const current = value == null ? 0 : normalize(value);
  const [hovered, setHovered] = useState<number | null>(null);
  const preview = hovered ?? current;

  const commit = (level: number) => {
    if (readOnly || !onChange) return;
    onChange(level === current ? null : level);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-end gap-px ${className}`}
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: ENERGY_MAX }, (_, index) => {
        const level = index + 1;
        const filled = level <= preview;
        const isCurrent = level === current;
        return (
          <button
            key={level}
            type="button"
            disabled={readOnly}
            aria-label={`Set energy ${level} of ${ENERGY_MAX}`}
            aria-pressed={isCurrent}
            title={
              readOnly
                ? current > 0
                  ? `Energy ${current} / ${ENERGY_MAX}`
                  : "No energy set"
                : isCurrent
                  ? `Clear energy (currently ${current})`
                  : `Set energy ${level} / ${ENERGY_MAX}`
            }
            onClick={(event) => {
              // The row underneath owns the click for selection; a segment
              // click must not also toggle the selection.
              event.stopPropagation();
              commit(level);
            }}
            onMouseEnter={() => {
              if (!readOnly) setHovered(level);
            }}
            className={`h-3.5 w-1.5 rounded-[1px] transition focus:outline-hidden ${
              filled
                ? "bg-dj-accent"
                : readOnly
                  ? "bg-dj-elevated"
                  : "bg-dj-elevated hover:bg-dj-border-strong focus-visible:ring-1 focus-visible:ring-dj-accent"
            }`}
          />
        );
      })}
    </div>
  );
}
