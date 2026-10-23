/**
 * Pure helpers for the custom-tag surface (Slice 3A — T2.1.7).
 *
 * Kept free of React and Tauri so the rules can be unit tested with
 * `node --test`. `normalizeTags` mirrors the Rust `normalize_tags` in
 * `crates/core/src/tags.rs` — trimmed, blanks dropped, ASCII-lowercased,
 * de-duplicated and sorted — so the editor and the database can never hold
 * two spellings of the same tag.
 */

import type { UpdateTrackMetadataRequest } from "@dj-assistant/shared";

/**
 * ASCII-only lower-casing.
 *
 * `String.prototype.toLowerCase` folds every Unicode letter, while Rust's
 * `to_ascii_lowercase` folds ASCII only — and SQLite's built-in `LOWER()` does
 * the same. Folding the same way on both sides is what keeps a tag the filter
 * can actually find.
 */
function asciiLowerCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Normalises a list of tags: trimmed, blanks dropped, ASCII-lowercased,
 * de-duplicated and sorted.
 *
 * Sorting is deliberate — the tag rows are read back in that order, so the
 * chips of a track have one stable order everywhere they are shown.
 */
export function normalizeTags(values: string[] | undefined): string[] {
  const out: string[] = [];
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const folded = asciiLowerCase(trimmed);
    if (!out.includes(folded)) out.push(folded);
  }
  return out.sort();
}

/** The chips a cell shows, and how many are hidden behind the `+N` overflow. */
export interface TagChipSummary {
  /** The tags the cell shows as chips. */
  visible: string[];
  /** How many tags the `+N` chip stands for. */
  overflow: number;
}

/**
 * Splits a tag list into the chips a cell shows and the overflow count.
 *
 * A cell has room for a couple of chips; the rest collapse into one `+N` chip
 * whose tooltip names them all.
 */
export function summarizeTags(tags: string[] | undefined, maxVisible: number): TagChipSummary {
  const all = tags ?? [];
  if (!Number.isFinite(maxVisible) || maxVisible <= 0) {
    return { visible: [], overflow: all.length };
  }
  const limit = Math.floor(maxVisible);
  return {
    visible: all.slice(0, limit),
    overflow: Math.max(0, all.length - limit),
  };
}

/** The values the metadata editor edits. */
export interface MetadataEditorValues {
  title: string;
  artist: string;
  album: string;
  genre: string;
  label: string;
  /** Kept as text while typing; parsed on submit. */
  year: string;
  tags: string[];
  comments: string;
}

/**
 * The fields the editor reads from a track.
 *
 * A narrow shape on purpose: the editor only needs the editable fields, so
 * it does not depend on the whole `TrackSummary` and can be seeded from any
 * object that carries them.
 */
export interface MetadataSource {
  /** The track's id, when the caller has one — it identifies the track. */
  id?: string;
  title: string;
  artist: string;
  album?: string | null;
  genre?: string | null;
  label?: string | null;
  year?: number | null;
  tags?: string[];
  comments?: string | null;
}

/**
 * The track's current values, in the editor's shape.
 *
 * `tags` is copied, not aliased: the editor edits its own list and must not
 * mutate the row the table is rendering.
 */
export function metadataEditorValues(track: MetadataSource): MetadataEditorValues {
  return {
    title: track.title ?? "",
    artist: track.artist ?? "",
    album: track.album ?? "",
    genre: track.genre ?? "",
    label: track.label ?? "",
    year: track.year != null ? String(track.year) : "",
    tags: [...(track.tags ?? [])],
    comments: track.comments ?? "",
  };
}

/** The first problem with the values, or `null` when they can be saved. */
export function validateMetadataValues(values: MetadataEditorValues): string | null {
  if (!values.title.trim()) return "Title cannot be empty.";
  if (!values.artist.trim()) return "Artist cannot be empty.";
  const year = values.year.trim();
  if (year) {
    if (!/^\d{4}$/.test(year)) return "Year must be four digits.";
    if (Number(year) < 1000 || Number(year) > 9999) return "Year must be between 1000 and 9999.";
  }
  return null;
}

/**
 * The write payload for the metadata editor.
 *
 * Every field the editor owns is sent, and the backend writes only the values
 * that really differ — so an untouched field is never rewritten, and an empty
 * field clears its column. The tag list is the **complete** set: it replaces
 * whatever the track carried.
 */
export function buildMetadataUpdatePayload(
  trackIds: string[],
  values: MetadataEditorValues
): UpdateTrackMetadataRequest {
  const year = values.year.trim();
  return {
    trackIds,
    title: values.title.trim(),
    artist: values.artist.trim(),
    album: values.album.trim(),
    genre: values.genre.trim(),
    label: values.label.trim(),
    // `0` is the backend's "clear the year" value.
    year: year ? Number(year) : 0,
    comments: values.comments,
    tags: normalizeTags(values.tags),
  };
}
