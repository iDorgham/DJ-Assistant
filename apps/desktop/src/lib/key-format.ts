import { parseCamelot } from "./camelot.ts";

/**
 * Key notation preference (T2.1.8, `docs/ui/03-LIBRARY-VIEW.md` §3.3).
 *
 * Camelot (`8A`) is the default because the key column's colours are built on
 * the Camelot wheel. The classical option uses the compact Open Key style the
 * spec asks for (`1m` / `1d`), not the full note name; the full name stays the
 * fallback for tracks that only carry `keyClassical`.
 */
export type KeyNotation = "camelot" | "classical" | "both";

export const KEY_NOTATIONS: readonly KeyNotation[] = ["camelot", "classical", "both"];

export const KEY_NOTATION_LABELS: Record<KeyNotation, string> = {
  camelot: "Camelot",
  classical: "1m / 1d",
  both: "Both",
};

export const KEY_NOTATION_EXAMPLES: Record<KeyNotation, string> = {
  camelot: "8A",
  classical: "8m",
  both: "8A · 8m",
};

/** `8A` → `8m`, `8B` → `8d`; `null` when the Camelot code cannot be read. */
export function classicalFromCamelot(key: string | null | undefined): string | null {
  const parsed = parseCamelot(key);
  if (!parsed) return null;
  return `${parsed.number}${parsed.letter === "A" ? "m" : "d"}`;
}

/**
 * Render one track's key in the preferred notation.
 *
 * A missing notation falls back to whatever the track does have, then to the
 * table's em dash — a preference must never make an existing key disappear.
 */
export function formatKeyForNotation(
  keyCamelot: string | null | undefined,
  keyClassical: string | null | undefined,
  notation: KeyNotation = "camelot"
): string {
  const camelot = keyCamelot?.trim() || null;
  const classical = keyClassical?.trim() || null;
  const openKey = classicalFromCamelot(camelot);

  switch (notation) {
    case "camelot":
      return camelot ?? classical ?? "—";
    case "classical":
      return openKey ?? classical ?? "—";
    case "both":
      if (camelot && classical && classical !== openKey) return `${camelot} · ${classical}`;
      if (camelot && openKey) return `${camelot} · ${openKey}`;
      return camelot ?? classical ?? "—";
  }
}
