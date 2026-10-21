/**
 * Pure, testable helpers for the desktop library view.
 *
 * Kept free of React and Tauri imports so they can be unit-tested with
 * `node --test` without a DOM or a Tauri runtime.
 */

import type {
  AnalysisStatus,
  ListTracksFilters,
  ListTracksSortBy,
  SortDirection,
  TrackSummary,
} from "@dj-assistant/shared";

/** The 24 Camelot keys, in wheel order (mixed in, then out). */
export const CAMELOT_KEYS = [
  "1A",
  "2A",
  "3A",
  "4A",
  "5A",
  "6A",
  "7A",
  "8A",
  "9A",
  "10A",
  "11A",
  "12A",
  "1B",
  "2B",
  "3B",
  "4B",
  "5B",
  "6B",
  "7B",
  "8B",
  "9B",
  "10B",
  "11B",
  "12B",
] as const;

/** Analysis statuses offered by the filter panel, with display labels. */
export const ANALYSIS_STATUS_OPTIONS: Array<{ value: AnalysisStatus; label: string }> = [
  { value: "complete", label: "Analyzed" },
  { value: "needs_review", label: "Needs review" },
  { value: "pending", label: "Not analyzed" },
  { value: "failed", label: "Failed" },
];

/** Sort options offered by the column headers, with display labels. */
export const SORT_OPTIONS: Array<{ value: ListTracksSortBy; label: string }> = [
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "bpm", label: "BPM" },
  { value: "key", label: "Key" },
  { value: "duration", label: "Duration" },
  { value: "imported_at", label: "Imported" },
  { value: "rating", label: "Rating" },
  { value: "energy", label: "Energy" },
];

/** Trims, drops blanks and de-duplicates case-insensitively, keeping first casing. */
function normalizeStringList(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Cleans a filter draft for the IPC boundary: blank lists become absent, keys
 * are upper-cased (`8a` → `8A`) and genres/statuses keep their casing (the
 * backend compares case-insensitively). Returns `undefined` when no filter is
 * active, so callers can omit the field entirely.
 */
export function normalizeFilters(
  filters: ListTracksFilters | undefined
): ListTracksFilters | undefined {
  if (!filters) return undefined;
  const normalized: ListTracksFilters = {};

  if (filters.bpmMin != null && Number.isFinite(filters.bpmMin)) {
    normalized.bpmMin = filters.bpmMin;
  }
  if (filters.bpmMax != null && Number.isFinite(filters.bpmMax)) {
    normalized.bpmMax = filters.bpmMax;
  }

  const keys = normalizeStringList(filters.keyCamelot).map((key) => key.toUpperCase());
  if (keys.length > 0) normalized.keyCamelot = keys;

  const statuses = normalizeStringList(filters.analysisStatus) as AnalysisStatus[];
  if (statuses.length > 0) normalized.analysisStatus = statuses;

  const genres = normalizeStringList(filters.genre);
  if (genres.length > 0) normalized.genre = genres;

  // The backend reads the rating and energy bounds as integers (`i64`), so a
  // fractional bound would fail to deserialize at the IPC boundary. Only whole
  // numbers are forwarded.
  if (filters.ratingMin != null && Number.isInteger(filters.ratingMin)) {
    normalized.ratingMin = filters.ratingMin;
  }

  if (filters.energyMin != null && Number.isInteger(filters.energyMin)) {
    normalized.energyMin = filters.energyMin;
  }
  if (filters.energyMax != null && Number.isInteger(filters.energyMax)) {
    normalized.energyMax = filters.energyMax;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/** Number of active filter groups (matches `TrackFilters::active_count` in Rust). */
export function activeFilterCount(filters: ListTracksFilters | undefined): number {
  if (!filters) return 0;
  return [
    filters.bpmMin != null || filters.bpmMax != null,
    normalizeStringList(filters.keyCamelot).length > 0,
    normalizeStringList(filters.analysisStatus).length > 0,
    normalizeStringList(filters.genre).length > 0,
    filters.ratingMin != null,
    filters.energyMin != null || filters.energyMax != null,
  ].filter(Boolean).length;
}

/** Human-readable summary lines for the active filters, shown under the toolbar. */
export function describeFilters(filters: ListTracksFilters | undefined): string[] {
  if (!filters) return [];
  const parts: string[] = [];

  const { bpmMin, bpmMax } = filters;
  if (bpmMin != null && bpmMax != null) {
    parts.push(`BPM ${formatBpm(bpmMin)}–${formatBpm(bpmMax)}`);
  } else if (bpmMin != null) {
    parts.push(`BPM ≥ ${formatBpm(bpmMin)}`);
  } else if (bpmMax != null) {
    parts.push(`BPM ≤ ${formatBpm(bpmMax)}`);
  }

  const keys = normalizeStringList(filters.keyCamelot);
  if (keys.length > 0) parts.push(`Key ${keys.join(", ")}`);

  const statuses = normalizeStringList(filters.analysisStatus);
  if (statuses.length > 0) {
    const labels = statuses.map(
      (status) => ANALYSIS_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
    );
    parts.push(`Status ${labels.join(", ")}`);
  }

  const genres = normalizeStringList(filters.genre);
  if (genres.length > 0) parts.push(`Genre ${genres.join(", ")}`);

  if (filters.ratingMin != null) parts.push(`Rating ≥ ${filters.ratingMin}★`);

  const { energyMin, energyMax } = filters;
  if (energyMin != null && energyMax != null) {
    parts.push(`Energy ${energyMin}–${energyMax}`);
  } else if (energyMin != null) {
    parts.push(`Energy ≥ ${energyMin}`);
  } else if (energyMax != null) {
    parts.push(`Energy ≤ ${energyMax}`);
  }

  return parts;
}

/** Adds `value` to a filter list, or removes it when already selected. */
export function toggleFilterValue(values: string[] | undefined, value: string): string[] {
  const current = normalizeStringList(values);
  const without = current.filter((entry) => entry.toLowerCase() !== value.toLowerCase());
  return without.length === current.length ? [...current, value] : without;
}

/** True when `value` is selected in a filter list (case-insensitive). */
export function hasFilterValue(values: string[] | undefined, value: string): boolean {
  return normalizeStringList(values).some((entry) => entry.toLowerCase() === value.toLowerCase());
}

/**
 * Default direction for a freshly selected sort column.
 *
 * Rating and energy read best-first (the highest value on top); every other
 * key starts ascending, except the newest-first import order.
 */
export function defaultSortDirection(sortBy: ListTracksSortBy): SortDirection {
  if (sortBy === "imported_at") return "desc";
  if (sortBy === "rating" || sortBy === "energy") return "desc";
  return "asc";
}

/** Formats a millisecond duration as `m:ss`, or `--:--` when unknown/invalid. */
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Case-insensitive match across title, artist, album and file path. */
export function matchesQuery(track: TrackSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (track.title?.toLowerCase().includes(q) ?? false) ||
    (track.artist?.toLowerCase().includes(q) ?? false) ||
    (track.album?.toLowerCase().includes(q) ?? false) ||
    (track.filePath?.toLowerCase().includes(q) ?? false)
  );
}

/** Filters a track list by a free-text query. */
export function filterTracks(tracks: TrackSummary[], query: string): TrackSummary[] {
  const q = query.trim();
  if (!q) return tracks;
  return tracks.filter((t) => matchesQuery(t, q));
}

/** Shortens a BLAKE3 hash for display, e.g. `a1b2c3d4...`. */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return hash.length > 8 ? `${hash.slice(0, 8)}...` : hash;
}

/** Formats a tag-sourced BPM, keeping one decimal only when it is meaningful. */
export function formatBpm(bpm: number | null | undefined): string {
  if (bpm == null || !Number.isFinite(bpm) || bpm <= 0) return "—";
  const rounded = Math.round(bpm * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

/** Prefers the Camelot code, then the classical key name, else an em dash. */
export function formatKey(
  keyCamelot: string | null | undefined,
  keyClassical: string | null | undefined
): string {
  if (keyCamelot?.trim()) return keyCamelot.trim();
  if (keyClassical?.trim()) return keyClassical.trim();
  return "—";
}

/** Renders a 0–5 rating as filled/empty stars, or an em dash when unrated. */
export function formatRating(rating: number | null | undefined): string {
  if (rating == null || !Number.isFinite(rating)) return "—";
  const stars = Math.min(5, Math.max(0, Math.round(rating)));
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

/**
 * Renders an energy level 1–10 as a plain number, or an em dash when the track
 * has no energy yet. The charging-bar meter is the primary display; this is
 * the text fallback (cell title, copy to clipboard).
 */
export function formatEnergy(energy: number | null | undefined): string {
  if (energy == null || !Number.isFinite(energy)) return "—";
  const level = clampEnergy(energy);
  // 0 is the "cleared" value, not a level — it reads as no energy at all.
  if (level < 1) return "—";
  return String(level);
}

/** Clamps an energy level into 1–10; `0` means "no energy set". */
export function clampEnergy(energy: number): number {
  if (!Number.isFinite(energy)) return 0;
  return Math.min(10, Math.max(0, Math.round(energy)));
}

/** Clamps a star rating into 0–5; `0` means "no rating set". */
export function clampRating(rating: number): number {
  if (!Number.isFinite(rating)) return 0;
  return Math.min(5, Math.max(0, Math.round(rating)));
}

/** Renders a 0–1 similarity score as a whole percent, e.g. `93%`. */
export function formatScore(score: number): string {
  if (!Number.isFinite(score)) return "—";
  return `${Math.round(Math.min(1, Math.max(0, score)) * 100)}%`;
}

/** Human label for a tag-health gap field; unknown fields pass through. */
export function formatMissingField(field: string): string {
  const labels: Record<string, string> = {
    title: "Title",
    artist: "Artist",
    album: "Album",
    genre: "Genre",
    year: "Year",
    bpm: "BPM",
    key: "Key",
    artwork: "Artwork",
    isrc: "ISRC",
    duration: "Duration",
  };
  return labels[field] ?? field;
}

/** Truncates a comment for a table cell; collapses whitespace and never overflows. */
export function truncateComment(comment: string | null | undefined, maxLength = 40): string {
  if (!comment) return "—";
  const normalized = comment.replace(/\s+/g, " ").trim();
  if (!normalized) return "—";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

/** Percentage 0-100 for the scan progress bar; 25 while the total is unknown. */
export function scanPercent(scannedFiles: number, totalFiles: number): number {
  if (!totalFiles || totalFiles <= 0) return 25;
  return Math.min(100, Math.round((scannedFiles / totalFiles) * 100));
}
