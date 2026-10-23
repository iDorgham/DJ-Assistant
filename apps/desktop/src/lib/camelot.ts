/**
 * Camelot wheel colours used by the key chip.
 *
 * The palette is derived, not hand-picked: hue advances 30° per Camelot step
 * (1A = 90° green, 5A = 210° blue, 8A = 300° magenta, 10A = 0° red) at 55%
 * saturation. Minor (A) keys sit at 76% lightness and major (B) keys at 86%,
 * matching the pastel ring of the reference wheel. Values are intentionally
 * light so they read as text on Carbon's dark chip surface.
 */

export interface CamelotKey {
  number: number;
  letter: "A" | "B";
}

export interface CamelotColor {
  /** Uppercase `#RRGGBB`. */
  hex: string;
  /** Text/border colour with alpha, ready for inline styles. */
  border: string;
  background: string;
}

const CAMELOT_PATTERN = /^\s*(\d{1,2})\s*([ABab])\s*$/;

export function parseCamelot(key: string | null | undefined): CamelotKey | null {
  if (!key) return null;
  const match = CAMELOT_PATTERN.exec(key);
  if (!match) return null;
  const number = Number.parseInt(match[1]!, 10);
  if (!Number.isInteger(number) || number < 1 || number > 12) return null;
  return { number, letter: match[2]!.toUpperCase() as "A" | "B" };
}

/** HSL (h in degrees, s/l in 0–1) to uppercase hex. */
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hPrime = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const [r1, g1, b1] =
    hPrime < 1
      ? [c, x, 0]
      : hPrime < 2
        ? [x, c, 0]
        : hPrime < 3
          ? [0, c, x]
          : hPrime < 4
            ? [0, x, c]
            : hPrime < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = l - c / 2;
  const channel = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value + m)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r1)}${channel(g1)}${channel(b1)}`.toUpperCase();
}

export function camelotColor(
  key: string | null | undefined,
  theme: "dark" | "light" = "dark"
): CamelotColor | null {
  const parsed = parseCamelot(key);
  if (!parsed) return null;
  const hue = (parsed.number - 10) * 30;
  // Dark surfaces use the pastel ring from the reference wheel. Light surfaces
  // need a much deeper tint to stay readable at 11px (WCAG AA).
  const lightness =
    theme === "light" ? (parsed.letter === "B" ? 0.27 : 0.3) : parsed.letter === "B" ? 0.86 : 0.76;
  const hex = hslToHex(hue, 0.55, lightness);
  return {
    hex,
    border: `${hex}${theme === "light" ? "66" : "99"}`,
    background: `${hex}${theme === "light" ? "14" : "1F"}`,
  };
}
