import type { AnalysisStatus, ListTracksSortBy, TrackSummary } from "@dj-assistant/shared";

import {
  formatBpm,
  formatDuration,
  formatEnergy,
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
 * The rich cells the spec describes for later slices (tag chips, cue counts,
 * file size, …) have no field on `TrackSummary` yet, so those columns exist
 * here as plain-text placeholders and default to hidden exactly as the table
 * says. Rating (T2.1.4) and Energy (T2.1.6) now have fields and widgets, but
 * still default to hidden so the default view stays the documented one.
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

// The narrowest a column may be dragged. It is intentionally below every
// default width so the defaults survive validation unchanged.
export const MIN_COLUMN_WIDTH = 40;
export const MAX_COLUMN_WIDTH = 640;

/** Empty cell in this table is always an em dash, never a blank or a fake zero. */
export const PLACEHOLDER = "—";
const UNTITLED = "Untitled";
const UNKNOWN_ARTIST = "Unknown Artist";
const COMMENT_CELL_LENGTH = 48;

const CHARACTER_PX = 7;
/** Horizontal cell padding: `px-4` on both header and body cells. */
const CELL_PADDING_PX = 32;
/** Sortable headers put a `w-3` icon and a `gap-1` next to the label. */
const HEADER_SORT_PX = 16;
/** Extra width the cell's own widget adds around its text. */
const CELL_CHROME_PX: Partial<Record<ColumnId, number>> = {
  // Chip `px-2` + status icon `w-3` + `space-x-1`.
  status: 16 + 12 + 4,
  // Pill `px-1.5` plus its border on each side.
  format: 12 + 2,
};
/** The 36px (`h-9`) artwork thumb inside a `px-2` cell. */
export const ARTWORK_MIN_WIDTH = 36 + 16;

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
    sortable: "energy",
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
    sortable: "rating",
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
 * the header (label plus sort icon) keeps the column from shrinking below what
 * the header itself needs. Cells with decorations reserve their chrome too, and
 * the artwork column reserves its thumb, which has no text to measure.
 */
export function autoFitWidth(text: string, definition: ColumnDefinition): number {
  const header =
    definition.label.length * CHARACTER_PX +
    CELL_PADDING_PX +
    (definition.sortable ? HEADER_SORT_PX : 0);
  const body = text.length * CHARACTER_PX + CELL_PADDING_PX + (CELL_CHROME_PX[definition.id] ?? 0);
  const floor = definition.id === "artwork" ? ARTWORK_MIN_WIDTH : MIN_COLUMN_WIDTH;
  return clampWidth(Math.max(header, body, floor), definition.id);
}

/**
 * Rendered width of the whole table: the sum of the columns, with an in-flight
 * resize substituted. The table must be exactly this wide — with `table-fixed`
 * a wider container spreads the leftover pixels across the columns, so their
 * rendered widths would stop matching the saved ones, and a drag would move
 * every column.
 */
export function totalColumnWidth(
  columns: readonly ColumnState[],
  preview?: { id: ColumnId; width: number } | null
): number {
  return columns.reduce(
    (sum, column) =>
      sum + (preview && preview.id === column.id ? clampColumnWidth(preview.width) : column.width),
    0
  );
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
 * columns whose widgets the spec describes for later slices (tag chips, cue
 * counts, file size, …) have no field on `TrackSummary` yet, so they report
 * the placeholder rather than inventing a value.
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
      return formatEnergy(track.energy);
    case "tags":
      return track.tags?.length ? track.tags.join(", ") : PLACEHOLDER;
    case "label":
      return track.label?.trim() || PLACEHOLDER;
    case "year":
      return track.year != null ? String(track.year) : PLACEHOLDER;
    case "lufs":
    case "color":
    case "cues":
    case "size":
      return PLACEHOLDER;
  }
}

/**
 * Hover text for a cell that shows only part of its value. The table shortens
 * comments and hashes and prefers one key notation, so the tooltip carries the
 * full comment, the full hash and both notations. Columns whose cell already
 * shows everything return `undefined` rather than repeating themselves.
 */
export function trackColumnTooltip(track: TrackSummary, id: ColumnId): string | undefined {
  switch (id) {
    case "comment":
      return track.comments?.trim() || undefined;
    case "fingerprint":
      return track.fileHash?.trim() || undefined;
    case "key": {
      const camelot = track.keyCamelot?.trim();
      const classical = track.keyClassical?.trim();
      return camelot && classical ? `Camelot ${camelot} • ${classical}` : undefined;
    }
    case "rating":
      return track.userRating != null ? `${track.userRating} / 5` : "Unrated";
    case "energy":
      return track.energy != null ? `Energy ${track.energy} / 10` : "No energy set";
    case "tags":
      // The cell shows a couple of chips and a `+N` overflow, so the tooltip
      // carries the whole list.
      return track.tags?.length ? track.tags.join(", ") : undefined;
    default:
      return undefined;
  }
}
