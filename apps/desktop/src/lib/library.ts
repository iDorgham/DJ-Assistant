/**
 * Pure, testable helpers for the desktop library view.
 *
 * Kept free of React and Tauri imports so they can be unit-tested with
 * `node --test` without a DOM or a Tauri runtime.
 */

import type { TrackSummary } from "@dj-assistant/shared";

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
