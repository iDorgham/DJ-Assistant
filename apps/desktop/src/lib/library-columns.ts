import type { AnalysisStatus, ListTracksSortBy, TrackSummary } from "@dj-assistant/shared";

import {
  formatBpm,
  formatDuration,
  formatKey,
  formatRating,
  shortHash,
  truncateComment,
} from "./library.ts";
import type { AppView, StorageLike } from "./ui-state.ts";

/**
 * Column model for the Library track table (T2.1.5).
 *
 * The ids and their default visibility follow `docs/ui/03-LIBRARY-VIEW.md` §3.2.
 * The rich cells that spec describes (Energy bars, tag chips, editable stars,
 * artwork hover-play) belong to later slices, so those columns exist here as
 * plain-text placeholders and default to hidden exactly as the table says.
 *
 * Display order is carried by the array position rather than a separate `order`
 * field — a stored index that contradicts its own position is a second source
 * of truth that nothing can repair.
 */

export type ColumnId =
  | "index"
  | "artwork"
  | "title"
  | "artist"
  | "album"
  | "genre"
  | "bpm"
  | "key"
  | "energy"
  | "tags"
  | "rating"
  | "time"
  | "label"
  | "year"
  | "lufs"
  | "color"
  | "status"
  | "cues"
  | "comment"
  | "path"
  | "size"
  | "format"
  | "fingerprint";

export interface ColumnState {
  id: ColumnId;
  visible: boolean;
  width: number;
}

export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  defaultWidth: number;
  align: "left" | "center";
  /** Sort key understood by `list_tracks`, or null when the server cannot sort it. */
  sortable: ListTracksSortBy | null;
  /** Identity columns name the track; the table must always show at least one. */
  identity: boolean;
  defaultVisible: boolean;
}

// The artwork thumb is 36px (`h-9`), so the minimum has to leave the narrowest
// default columns reachable without an immediate clamp.
export const MIN_COLUMN_WIDTH = 40;
export const MAX_COLUMN_WIDTH = 640;

/** Empty cell in this table is always an em dash, never a blank or a fake zero. */
export const PLACEHOLDER = "—";
const UNTITLED = "Untitled";
const UNKNOWN_ARTIST = "Unknown Artist";
const COMMENT_CELL_LENGTH = 48;

const CHARACTER_PX = 7;
const CELL_PADDING_PX = 28;

const DEFINITIONS: Record<ColumnId, ColumnDefinition> = {
  index: {
    id: "index",
    label: "#",
    defaultWidth: 48,
    align: "center",
    sortable: "imported_at",
    identity: false,
    defaultVisible: true,
  },
  artwork: {
    id: "artwork",
    label: "Art",
    defaultWidth: 60,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  title: {
    id: "title",
    label: "Title",
    defaultWidth: 300,
    align: "left",
    sortable: "title",
    identity: true,
    defaultVisible: true,
  },
  artist: {
    id: "artist",
    label: "Artist",
    defaultWidth: 220,
    align: "left",
    sortable: "artist",
    identity: true,
    defaultVisible: true,
  },
  album: {
    id: "album",
    label: "Album",
    defaultWidth: 200,
    align: "left",
    sortable: null,
    identity: false,
    defaultVisible: true,
  },
  genre: {
    id: "genre",
    label: "Genre",
    defaultWidth: 140,
    align: "left",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  bpm: {
    id: "bpm",
    label: "BPM",
    defaultWidth: 80,
    align: "center",
    sortable: "bpm",
    identity: false,
    defaultVisible: true,
  },
  key: {
    id: "key",
    label: "Key",
    defaultWidth: 72,
    align: "center",
    sortable: "key",
    identity: false,
    defaultVisible: true,
  },
  energy: {
    id: "energy",
    label: "Energy",
    defaultWidth: 96,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  tags: {
    id: "tags",
    label: "Tags",
    defaultWidth: 180,
    align: "left",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  rating: {
    id: "rating",
    label: "Rating",
    defaultWidth: 96,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  time: {
    id: "time",
    label: "Time",
    defaultWidth: 80,
    align: "center",
    sortable: "duration",
    identity: false,
    defaultVisible: true,
  },
  label: {
    id: "label",
    label: "Label",
    defaultWidth: 160,
    align: "left",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  year: {
    id: "year",
    label: "Year",
    defaultWidth: 72,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  lufs: {
    id: "lufs",
    label: "LUFS",
    defaultWidth: 72,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  color: {
    id: "color",
    label: "Color",
    defaultWidth: 64,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  status: {
    id: "status",
    label: "Status",
    defaultWidth: 136,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: true,
  },
  cues: {
    id: "cues",
    label: "Cues",
    defaultWidth: 64,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  comment: {
    id: "comment",
    label: "Comments",
    defaultWidth: 200,
    align: "left",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  path: {
    id: "path",
    label: "Path",
    defaultWidth: 260,
    align: "left",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  size: {
    id: "size",
    label: "Size",
    defaultWidth: 88,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  format: {
    id: "format",
    label: "Format",
    defaultWidth: 88,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: false,
  },
  // The fingerprint column ships with the Phase 0 list and is not in the §3.2
  // table; it stays visible by default so this slice does not silently drop a
  // column the library already relies on to spot duplicate imports.
  fingerprint: {
    id: "fingerprint",
    label: "Fingerprint",
    defaultWidth: 120,
    align: "center",
    sortable: null,
    identity: false,
    defaultVisible: true,
  },
};

/** Spec order — also the order untouched defaults and appended columns follow. */
export const COLUMN_IDS: readonly ColumnId[] = [
  "index",
  "artwork",
  "title",
  "artist",
  "album",
  "genre",
  "bpm",
  "key",
  "energy",
  "tags",
  "rating",
  "time",
  "label",
  "year",
  "lufs",
  "color",
  "status",
  "cues",
  "comment",
  "path",
  "size",
  "format",
  "fingerprint",
];

export function columnDefinition(id: ColumnId): ColumnDefinition {
  return DEFINITIONS[id];
}

export function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && (COLUMN_IDS as readonly string[]).includes(value);
}

function copyDefaults(): ColumnState[] {
  return COLUMN_IDS.map((id) => ({
    id,
    visible: DEFINITIONS[id].defaultVisible,
    width: DEFINITIONS[id].defaultWidth,
  }));
}

export const DEFAULT_LIBRARY_COLUMNS: readonly ColumnState[] = copyDefaults();

export function resetLibraryColumns(): ColumnState[] {
  return copyDefaults();
}

/**
 * Parse-with-teeth: `null` means "this is not a column list at all" and the
 * caller falls back to the defaults wholesale. A well-shaped list is returned
 * sanitised — unknown ids and bad numbers dropped, widths clamped — because the
 * payload comes from `localStorage`, which any older build or hand edit can
 * change. It is a UI preference, never trusted input.
 */
export function validateColumnConfig(value: unknown): ColumnState[] | null {
  if (!Array.isArray(value)) return null;
  const entries: ColumnState[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (!isColumnId(record.id)) continue;
    entries.push({
      id: record.id,
      visible: typeof record.visible === "boolean" ? record.visible : true,
      width: clampWidth(record.width, record.id),
    });
  }
  return entries;
}

/**
 * Bound a width the way stored and dragged widths are bounded, so a resize
 * preview can never render outside the range the commit will accept.
 */
export function clampColumnWidth(width: number): number {
  if (!Number.isFinite(width)) return MIN_COLUMN_WIDTH;
  return Math.min(Math.max(Math.round(width), MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH);
}

function clampWidth(raw: unknown, id: ColumnId): number {
  const fallback = DEFINITIONS[id].defaultWidth;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return clampColumnWidth(raw);
}

/**
 * Reconcile stored state with the current column set: kept entries hold their
 * stored order, duplicates collapse to the first, unknown ids are discarded,
 * and columns added since the payload was written are appended in spec order.
 * Guarantees at least one identity column stays visible, or the table would
 * render rows the user cannot name.
 */
export function mergeWithDefaults(value: ColumnState[] | null): ColumnState[] {
  const stored = value ?? [];
  const seen = new Set<ColumnId>();
  const ordered: ColumnState[] = [];
  for (const entry of stored) {
    if (!isColumnId(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    ordered.push({
      id: entry.id,
      visible: entry.visible,
      width: clampWidth(entry.width, entry.id),
    });
  }
  for (const id of COLUMN_IDS) {
    if (seen.has(id)) continue;
    ordered.push({
      id,
      visible: DEFINITIONS[id].defaultVisible,
      width: DEFINITIONS[id].defaultWidth,
    });
  }
  if (!ordered.some((column) => isIdentity(column.id) && column.visible)) {
    const title = ordered.find((column) => column.id === "title");
    if (title) title.visible = true;
  }
  return ordered;
}

export function isIdentity(id: ColumnId): boolean {
  return DEFINITIONS[id].identity;
}

/**
 * Whether the column can be switched off right now. Only an identity column has
 * a limit, and only while it is the last visible one.
 */
export function canHideColumn(columns: readonly ColumnState[], id: ColumnId): boolean {
  const target = columns.find((column) => column.id === id);
  if (!target) return false;
  if (!target.visible) return true;
  return !isIdentity(id) || visibleIdentityCount(columns) > 1;
}

export function visibleColumns(columns: readonly ColumnState[]): ColumnState[] {
  return columns.filter((column) => column.visible).map((column) => ({ ...column }));
}

/**
 * Toggle visibility, refusing to hide the last identity column. The refusal
 * returns the original array untouched so the caller cannot tell a no-op from a
 * change by comparing lengths.
 */
export function toggleColumnVisible(columns: readonly ColumnState[], id: ColumnId): ColumnState[] {
  const target = columns.find((column) => column.id === id);
  if (!target) return columns.map((column) => ({ ...column }));
  if (target.visible && !canHideColumn(columns, id)) {
    return columns.map((column) => ({ ...column }));
  }
  return columns.map((column) =>
    column.id === id ? { ...column, visible: !column.visible } : { ...column }
  );
}

function visibleIdentityCount(columns: readonly ColumnState[]): number {
  return columns.filter((column) => column.visible && isIdentity(column.id)).length;
}

/** Move `draggedId` to sit where `targetId` currently sits. */
export function moveColumn(
  columns: readonly ColumnState[],
  draggedId: ColumnId,
  targetId: ColumnId
): ColumnState[] {
  if (draggedId === targetId) return columns.map((column) => ({ ...column }));
  const from = columns.findIndex((column) => column.id === draggedId);
  const to = columns.findIndex((column) => column.id === targetId);
  if (from === -1 || to === -1) return columns.map((column) => ({ ...column }));
  const next = columns.map((column) => ({ ...column }));
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function setColumnWidth(
  columns: readonly ColumnState[],
  id: ColumnId,
  width: number
): ColumnState[] {
  return columns.map((column) =>
    column.id === id ? { ...column, width: clampWidth(width, id) } : { ...column }
  );
}

/**
 * Width for a double-clicked resize handle. Measuring the DOM is not worth a
 * re-render per row: the longest value in the loaded page is close enough, and
 * the header label keeps the column from shrinking below its own name.
 */
export function autoFitWidth(text: string, definition: ColumnDefinition): number {
  const content = Math.max(text.length, definition.label.length) * CHARACTER_PX + CELL_PADDING_PX;
  return clampWidth(content, definition.id);
}

const STORAGE_PREFIX = "dj-assistant.columns.v1.";

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Column state is stored per view, keyed by the view it belongs to. */
export function columnStorageKey(view: AppView): string {
  return `${STORAGE_PREFIX}${view}`;
}

export function loadLibraryColumns(view: AppView, storage?: StorageLike): ColumnState[] {
  const store = storage ?? defaultStorage();
  if (!store) return resetLibraryColumns();
  let raw: string | null;
  try {
    raw = store.getItem(columnStorageKey(view));
  } catch {
    return resetLibraryColumns();
  }
  if (!raw) return resetLibraryColumns();
  const validated = validateColumnConfig(parseJson(raw));
  if (validated === null) return resetLibraryColumns();
  return mergeWithDefaults(validated);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Write normalised state, so a corrupted in-memory list cannot poison storage. */
export function saveLibraryColumns(
  view: AppView,
  columns: readonly ColumnState[],
  storage?: StorageLike
): void {
  const store = storage ?? defaultStorage();
  if (!store) return;
  try {
    store.setItem(columnStorageKey(view), JSON.stringify(mergeWithDefaults([...columns])));
  } catch {
    // Best-effort, like `persistUiState`: blocked or full storage must not break the table.
  }
}

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  complete: "Analyzed",
  pending: "Pending",
  failed: "Failed",
  needs_review: "Needs review",
};

export function analysisStatusLabel(status: AnalysisStatus): string {
  return STATUS_LABEL[status] ?? STATUS_LABEL.pending;
}

/**
 * The text a column shows for one track — the single source behind both the cell
 * and `autoFitWidth`, so a column can never fit a width it does not render.
 *
 * `index` and `artwork` are row-number and image cells and have no text. The
 * columns whose widgets the spec describes for later slices (Energy bars, tag
 * chips, cue counts, file size, …) have no field on `TrackSummary` yet, so they
 * report the placeholder rather than inventing a value.
 */
export function trackColumnText(track: TrackSummary, id: ColumnId): string {
  switch (id) {
    case "index":
    case "artwork":
      return "";
    case "title":
      return track.title?.trim() || UNTITLED;
    case "artist":
      return track.artist?.trim() || UNKNOWN_ARTIST;
    case "album":
      return track.album?.trim() || PLACEHOLDER;
    case "genre":
      return track.genre?.trim() || PLACEHOLDER;
    case "bpm":
      return formatBpm(track.bpm);
    case "key":
      return formatKey(track.keyCamelot, track.keyClassical);
    case "time":
      return formatDuration(track.durationMs);
    case "rating":
      return formatRating(track.userRating);
    case "comment":
      return truncateComment(track.comments, COMMENT_CELL_LENGTH);
    case "path":
      return track.filePath;
    case "format":
      return track.format?.trim() || "AUDIO";
    case "fingerprint":
      return shortHash(track.fileHash);
    case "status":
      return analysisStatusLabel(track.analysisStatus);
    case "energy":
    case "tags":
    case "label":
    case "year":
    case "lufs":
    case "color":
    case "cues":
    case "size":
      return PLACEHOLDER;
  }
}
