import { parseCamelot } from "./camelot.ts";

/**
 * Harmonic mixing rules on the Camelot wheel (T2.1.8,
 * `docs/ui/01-DESIGN-SYSTEM.md` §4 and `docs/ui/03-LIBRARY-VIEW.md` §3.3).
 *
 * Strict mode is the classic compatible set: the same key, its relative
 * major/minor (same number, other letter), and the two neighbours on the same
 * ring (±1). Wide mode adds ±2 on the same ring — the "soft tint" row in the
 * design system. Everything else is incompatible.
 *
 * The wheel wraps, so 12A is adjacent to 1A and 11A is two steps from 1A.
 */
export type CompatibilityMode = "strict" | "wide";

export type HarmonicRelation = "same" | "relative" | "adjacent" | "wide" | "incompatible";

/** A relation plus the "we cannot read one of the keys" case. */
export type HarmonicMatch = HarmonicRelation | "unknown";

export const COMPATIBILITY_MODES: readonly CompatibilityMode[] = ["strict", "wide"];

export const COMPATIBILITY_MODE_LABELS: Record<CompatibilityMode, string> = {
  strict: "Strict",
  wide: "Wide",
};

export const RELATION_LABELS: Record<HarmonicMatch, string> = {
  same: "Same key",
  relative: "Relative major/minor",
  adjacent: "±1 adjacent",
  wide: "±2 wide",
  incompatible: "Incompatible",
  unknown: "Unknown key",
};

const LETTERS = ["A", "B"] as const;

/** Wrap a Camelot number into 1–12. */
function wrapNumber(value: number): number {
  return ((value - 1 + 12) % 12) + 1;
}

/**
 * Classify `candidate` against `reference`. The direction does not matter:
 * ±1 and ±2 are symmetric, and "relative" only asks whether the number
 * matches while the letter differs.
 */
export function camelotRelation(
  reference: string | null | undefined,
  candidate: string | null | undefined
): HarmonicMatch {
  const from = parseCamelot(reference);
  const to = parseCamelot(candidate);
  if (!from || !to) return "unknown";

  if (from.number === to.number) {
    return from.letter === to.letter ? "same" : "relative";
  }

  // A diagonal move (number and letter both change) is not in the spec's
  // compatible set, even when the numbers are one apart.
  if (from.letter !== to.letter) return "incompatible";

  const distance = Math.min(
    Math.abs(from.number - to.number),
    12 - Math.abs(from.number - to.number)
  );
  if (distance === 1) return "adjacent";
  if (distance === 2) return "wide";
  return "incompatible";
}

/** True when a relation is mixable in the chosen mode. */
export function isCompatible(relation: HarmonicMatch, mode: CompatibilityMode = "strict"): boolean {
  switch (relation) {
    case "same":
    case "relative":
    case "adjacent":
      return true;
    case "wide":
      return mode === "wide";
    default:
      return false;
  }
}

/**
 * The Camelot keys a reference track is compatible with, including the
 * reference itself. The list is sorted in wheel order so the filter chips and
 * tests are deterministic.
 */
export function compatibleCamelotKeys(
  reference: string | null | undefined,
  mode: CompatibilityMode = "strict"
): string[] {
  const parsed = parseCamelot(reference);
  if (!parsed) return [];

  const offsets = mode === "wide" ? [-2, -1, 1, 2] : [-1, 1];
  const keys = new Set<string>();
  // Same number, both letters: the same key and its relative major/minor.
  for (const letter of LETTERS) keys.add(`${parsed.number}${letter}`);
  // Neighbours on the reference's own ring.
  for (const offset of offsets) {
    keys.add(`${wrapNumber(parsed.number + offset)}${parsed.letter}`);
  }

  return [...keys].sort((left, right) => {
    const a = parseCamelot(left);
    const b = parseCamelot(right);
    if (!a || !b) return left.localeCompare(right);
    return a.number - b.number || a.letter.localeCompare(b.letter);
  });
}
