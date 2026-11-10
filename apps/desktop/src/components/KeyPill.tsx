import { camelotColor } from "../lib/camelot";
import { EMPTY_KEY_PAINT, pillPaint, RELATION_TONE, type PillInk } from "../lib/key-pill-surface";
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
 * The paint rule itself — ground, hue layer, border and ink token — lives in
 * `lib/key-pill-surface.ts`, where `key-pill-contrast.test.ts` can hold it to
 * WCAG AA without a browser.
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

const PILL_BASE =
  "inline-flex min-w-[2.75rem] max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-none border px-1.5 py-0.5 font-mono text-[11px]";

const INK_CLASS: Record<PillInk, string> = {
  primary: "text-dj-text",
  secondary: "text-dj-text-secondary",
  muted: "text-dj-text-muted",
};

export function KeyPill({
  keyCamelot,
  keyClassical,
  notation = "camelot",
  relation = null,
  theme = "dark",
}: KeyPillProps) {
  const text = formatKeyForNotation(keyCamelot, keyClassical, notation);
  if (text === "—") {
    return <span className={INK_CLASS[EMPTY_KEY_PAINT.ink]}>—</span>;
  }

  const tone = relation ? RELATION_TONE[relation] : null;
  const paint = pillPaint(camelotColor(keyCamelot, theme), tone);
  const fullText = formatKeyForNotation(keyCamelot, keyClassical, "both");
  const title = relation ? `${fullText} — ${RELATION_LABELS[relation]}` : fullText;

  return (
    <span
      className={`${PILL_BASE} ${paint.borderColor ? "border-transparent" : "border-dj-border"} ${
        paint.groundToken ? "" : "bg-transparent"
      } ${INK_CLASS[paint.ink]}`}
      style={{
        backgroundColor: paint.groundToken,
        backgroundImage: paint.hueLayer,
        borderColor: paint.borderColor,
      }}
      title={title}
    >
      {text}
    </span>
  );
}
