import { camelotColor } from "../lib/camelot";
import { RELATION_LABELS, type HarmonicMatch } from "../lib/harmonic";
import { formatKeyForNotation, type KeyNotation } from "../lib/key-format";

/**
 * Coloured key pill (T2.1.8, `docs/ui/01-DESIGN-SYSTEM.md` §4).
 *
 * The hue comes from the Camelot wheel, and the fill strength comes from the
 * relation to the reference track: same key is strongest, then ±1, then the
 * relative major/minor, then the optional ±2 wide tint. Incompatible keys keep
 * the hue out of the fill and mute the text. With no reference (nothing
 * playing and nothing selected) the pill falls back to its plain wheel colour.
 *
 * Key pills use the Carbon component radius (`radius.md` = 0), not the chip
 * radius, and a fixed min-width so a column of keys does not jitter.
 */
export interface KeyPillProps {
  keyCamelot?: string | null;
  keyClassical?: string | null;
  notation?: KeyNotation;
  /** Relation to the playing or selected track; `null` when there is none. */
  relation?: HarmonicMatch | null;
  theme?: "dark" | "light";
}

interface RelationTone {
  /** Alpha suffix appended to the Camelot hex for the fill. */
  background: string;
  /** Alpha suffix for the border. */
  border: string;
  muted: boolean;
}

const RELATION_TONE: Record<HarmonicMatch, RelationTone> = {
  same: { background: "47", border: "E6", muted: false },
  adjacent: { background: "33", border: "B3", muted: false },
  relative: { background: "29", border: "80", muted: false },
  wide: { background: "1A", border: "66", muted: false },
  incompatible: { background: "00", border: "00", muted: true },
  unknown: { background: "00", border: "00", muted: true },
};

const PILL_BASE =
  "inline-flex min-w-[2.75rem] max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-none border px-1.5 py-0.5 font-mono text-[11px]";

export function KeyPill({
  keyCamelot,
  keyClassical,
  notation = "camelot",
  relation = null,
  theme = "dark",
}: KeyPillProps) {
  const text = formatKeyForNotation(keyCamelot, keyClassical, notation);
  if (text === "—") {
    return <span className="text-dj-text-muted">—</span>;
  }

  const palette = camelotColor(keyCamelot, theme);
  const tone = relation ? RELATION_TONE[relation] : null;
  const muted = tone?.muted ?? false;

  const style =
    palette && !muted
      ? tone
        ? {
            color: palette.hex,
            backgroundColor: `${palette.hex}${tone.background}`,
            borderColor: `${palette.hex}${tone.border}`,
          }
        : {
            color: palette.hex,
            backgroundColor: palette.background,
            borderColor: palette.border,
          }
      : undefined;

  const neutral = !palette || muted;
  const fullText = formatKeyForNotation(keyCamelot, keyClassical, "both");
  const title = relation ? `${fullText} — ${RELATION_LABELS[relation]}` : fullText;

  return (
    <span
      className={`${PILL_BASE} ${
        neutral ? "border-dj-border bg-transparent text-dj-text-muted" : "border-transparent"
      }`}
      style={style}
      title={title}
    >
      {text}
    </span>
  );
}
