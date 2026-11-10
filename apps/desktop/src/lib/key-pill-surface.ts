import type { CamelotColor } from "./camelot.ts";
import type { HarmonicMatch } from "./harmonic.ts";

/**
 * The paint rule behind `KeyPill` (`docs/ui/01-DESIGN-SYSTEM.md` §4).
 *
 * A pill is described as the ground it owns plus a translucent hue layer
 * painted over that ground. Splitting the two is what keeps the text legible:
 * a pill that paints only a translucent fill inherits whatever row it happens
 * to sit on, and a row changes colour on hover and on selection — which moved
 * the same text colour from AA to failing between those states (running-window
 * Pass 4, K10). `key-pill-contrast.test.ts` holds every combination here to
 * WCAG AA 4.5:1, on every ground a row can present.
 */

/** Alpha suffixes per harmonic relation, strongest first. */
export interface RelationTone {
  /** Alpha appended to the Camelot hue for the fill. */
  fill: string;
  /** Alpha appended to the Camelot hue for the border. */
  border: string;
  /** Incompatible and unknown keys keep the hue out of the fill entirely. */
  quiet: boolean;
}

export const RELATION_TONE: Record<HarmonicMatch, RelationTone> = {
  same: { fill: "47", border: "E6", quiet: false },
  adjacent: { fill: "33", border: "B3", quiet: false },
  relative: { fill: "29", border: "80", quiet: false },
  wide: { fill: "1A", border: "66", quiet: false },
  incompatible: { fill: "00", border: "00", quiet: true },
  unknown: { fill: "00", border: "00", quiet: true },
};

/** The opaque ground a tinted pill paints before its hue layer. */
const PILL_GROUND = "var(--color-dj-bg)";

/**
 * Which theme text token the pill asks for. `secondary` is the quietest token
 * that still clears 4.5:1 on the row hover *and* the selected-row surface;
 * `muted` is specified against the base surface only, so it cannot be used on
 * a row whose colour the pill does not paint.
 */
export type PillInk = "primary" | "secondary" | "muted";

export interface PillPaint {
  /** Opaque ground the pill owns, as a CSS custom property reference. */
  groundToken?: string;
  /** Translucent colour painted over the ground as a solid gradient layer. */
  hueLayer?: string;
  /** Hue-tinted border; undefined keeps the neutral hairline. */
  borderColor?: string;
  ink: PillInk;
}

/**
 * The quiet paint: no hue, no fill, secondary ink. Incompatible and unknown
 * relations use it, and so does a track with no key at all.
 */
const QUIET_PAINT: PillPaint = { ink: "secondary" };
export const EMPTY_KEY_PAINT: PillPaint = QUIET_PAINT;

export function pillPaint(palette: CamelotColor | null, tone: RelationTone | null): PillPaint {
  if (!palette || tone?.quiet) return QUIET_PAINT;
  if (!tone) {
    return {
      groundToken: PILL_GROUND,
      hueLayer: asLayer(palette.background),
      borderColor: palette.border,
      ink: "primary",
    };
  }
  return {
    groundToken: PILL_GROUND,
    hueLayer: asLayer(`${palette.hex}${tone.fill}`),
    borderColor: `${palette.hex}${tone.border}`,
    ink: "primary",
  };
}

/** A translucent colour as a solid gradient layer, so a ground can sit under it. */
function asLayer(color: string): string {
  return `linear-gradient(${color}, ${color})`;
}
