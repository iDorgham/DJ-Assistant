import { useEffect, useRef, useState, useMemo, useReducer, useCallback } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  FormEvent,
  UIEvent as ReactUIEvent,
} from "react";
import type {
  TrackSummary,
  ScanProgressEvent,
  ScanCompletedEvent,
  AnalysisProgressEvent,
  AnalysisCompletedEvent,
  TagHealthResponse,
  ProviderStatusResponse,
  EnrichmentPreviewResponse,
  EnrichmentProgressEvent,
  EnrichmentProviderKind,
  ChartListResponse,
  GenreCount,
  ListTracksFilters,
  ListTracksSortBy,
  SortDirection,
} from "@dj-assistant/shared";
import {
  openFolderDialog,
  scanFolder,
  listTracks,
  listGenres,
  analyzeLibrary,
  listenToAnalysisProgress,
  listenToAnalysisCompleted,
  trackTagHealth,
  providerStatus,
  enrichmentPreview,
  enrichmentApply,
  enrichmentUndo,
  listenToEnrichmentProgress,
  chartImportSnapshot,
  chartList,
  listenToScanProgress,
  listenToScanCompleted,
  setTrackRating,
  undoTrackMetadata,
  updateTrackMetadata,
} from "./services/api";
import {
  FolderOpen,
  Music,
  Search,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  Disc3,
  CheckCircle2,
  Check,
  Sparkles,
  Columns3,
  Activity,
  PlugZap,
  Globe,
  Undo2,
  BarChart3,
  X,
  SlidersHorizontal,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clock,
  FolderTree,
  Library,
  ListMusic,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Sun,
  Usb,
  Volume2,
  XCircle,
  Compass,
  Inbox,
  Settings,
  type LucideIcon,
} from "lucide-react";
import {
  ANALYSIS_STATUS_OPTIONS,
  CAMELOT_KEYS,
  activeFilterCount,
  clearFilterGroup,
  defaultSortDirection,
  describeFilterParts,
  describeMetadataUndo,
  describeMetadataWrite,
  filterTracks,
  formatBpm,
  formatKey,
  formatScore,
  formatMissingField,
  hasFilterValue,
  normalizeFilters,
  scanPercent,
  toggleFilterValue,
  truncateComment,
} from "./lib/library";
import {
  analysisStatusLabel,
  autoFitWidth,
  clampColumnWidth,
  columnDefinition,
  loadLibraryColumns,
  moveColumn,
  resetLibraryColumns,
  saveLibraryColumns,
  setColumnWidth,
  toggleColumnVisible,
  totalColumnWidth,
  trackColumnText,
  trackColumnTooltip,
  visibleColumns,
  type ColumnId,
  type ColumnState,
} from "./lib/library-columns";
import {
  DEFAULT_UI_STATE,
  initUiState,
  persistUiState,
  reduceUiState,
  shortcutToAction,
  type AppView,
  type PrimaryView,
} from "./lib/ui-state";
import { rowHeightForColumns, shouldLoadMore, virtualWindow } from "./lib/virtual-window";
import { nextTheme, resolveTheme, THEME_LABELS } from "./lib/theme";
import { PreviewPlayer } from "./components/preview-player";
import { ModalShell } from "./components/ModalShell";
import { ArtworkThumb } from "./components/ArtworkThumb";
import { TrackPanel } from "./components/track-panel/TrackPanel";
import { ColumnPicker } from "./components/ColumnPicker";
import { EnergyBars } from "./components/EnergyBars";
import { StarRating } from "./components/StarRating";
import { TagChips } from "./components/TagChips";
import { RowContextMenu } from "./components/RowContextMenu";
import { MetadataEditor } from "./components/MetadataEditor";
import { SettingsView } from "./components/SettingsView";
import { buildMetadataUpdatePayload, type MetadataEditorValues } from "./lib/tags";
import { previewEngine } from "./lib/audio-engine";

const NAV_ITEMS: { label: string; icon: LucideIcon; view: PrimaryView; shortcut: string }[] = [
  { label: "Library", icon: Library, view: "library", shortcut: "1" },
  { label: "Playlists", icon: ListMusic, view: "playlists", shortcut: "2" },
  { label: "Discover", icon: Compass, view: "discover", shortcut: "3" },
  { label: "Statistics", icon: BarChart3, view: "statistics", shortcut: "4" },
  { label: "Publish", icon: Usb, view: "publish", shortcut: "5" },
  { label: "Settings", icon: Settings, view: "settings", shortcut: "6" },
];

/** User-facing failure detail — never surface raw serialized errors. */
const errorDetail = (err: unknown): string =>
  err instanceof Error && err.message ? err.message : "unexpected error";

/**
 * Idle time before the undo toast retires on its own. The timer is paused
 * while the toast has focus, so a focused toast stays until the user acts on
 * it or dismisses it.
 */
const UNDO_TOAST_IDLE_MS = 10_000;
const ROW_DOUBLE_CLICK_MS = 350;

// Library paging (Stage 2): the first page covers the initial viewport, then
// scrolling near the loaded end appends 500-row pages. A reload (rating edit,
// scan finish) re-fetches the rows already on screen in `list_tracks`' max
// page size, so the user keeps their scroll position.
const FIRST_LIBRARY_PAGE = 200;
const NEXT_LIBRARY_PAGE = 500;
const MAX_LIBRARY_PAGE = 1000;

const THEME_ICONS = { dark: Moon, light: Sun, system: Monitor } as const;

/** Real analysis state per track — never render a hardcoded success badge. */
const ANALYSIS_STATUS_CHIP: Record<
  TrackSummary["analysisStatus"],
  { icon: LucideIcon; className: string }
> = {
  complete: {
    icon: CheckCircle2,
    className: "bg-dj-success/10 text-dj-success border border-dj-success/20",
  },
  pending: {
    icon: Clock,
    className: "bg-dj-accent/10 text-dj-accent border border-dj-accent/20",
  },
  failed: {
    icon: XCircle,
    className: "bg-dj-danger/10 text-dj-danger border border-dj-danger/20",
  },
  needs_review: {
    icon: AlertTriangle,
    className: "bg-dj-warning/10 text-dj-warning border border-dj-warning/20",
  },
};

/**
 * Lazily loads one track's cached cover art and falls back to a placeholder
 * icon while loading, for missing art, or when the cache read fails.
 */
/**
 * Header row for the Library table (T2.1.5): one `<col>` and one `<th>` per
 * configured column, in the configured order. Sort stays server-side (T2.1.2);
 * the additions here are width, order and the entry point to the picker.
 *
 * A dragged width is previewed in local state and committed on release, so
 * resizing does not write a preference to storage on every pointer move.
 *
 * Row height stays constant. Turning Artwork on makes every row 48px — the
 * 36px thumb plus its padding exceeds the 28–32px density rule in docs/ui/01,
 * which is exactly the spec's "taller when Artwork column is on".
 */
function TrackTableHeader({
  columns,
  sortBy,
  sortDir,
  onSort,
  onResize,
  onAutoFit,
  onReorder,
  onManageColumns,
}: {
  columns: ColumnState[];
  sortBy?: ListTracksSortBy;
  sortDir: SortDirection;
  onSort: (key: ListTracksSortBy) => void;
  onResize: (id: ColumnId, width: number) => void;
  onAutoFit: (id: ColumnId) => void;
  onReorder: (draggedId: ColumnId, targetId: ColumnId) => void;
  onManageColumns: () => void;
}) {
  const [preview, setPreview] = useState<{ id: ColumnId; width: number } | null>(null);
  const [draggedId, setDraggedId] = useState<ColumnId | null>(null);
  const resize = useRef<{
    id: ColumnId;
    startX: number;
    startWidth: number;
    width: number;
  } | null>(null);

  const beginResize = (event: ReactPointerEvent<HTMLSpanElement>, column: ColumnState) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resize.current = {
      id: column.id,
      startX: event.clientX,
      startWidth: column.width,
      width: column.width,
    };
  };

  const dragResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const active = resize.current;
    if (!active) return;
    active.width = clampColumnWidth(active.startWidth + (event.clientX - active.startX));
    setPreview({ id: active.id, width: active.width });
    // Move the table edge with the drag. Re-rendering every row per pointer move
    // just to change the table width is unnecessary, and leaving the edge behind
    // makes the fixed layout spread the leftover pixels across the other columns.
    const table = event.currentTarget.closest("table");
    if (table) {
      table.style.width = `${totalColumnWidth(columns, { id: active.id, width: active.width })}px`;
    }
  };

  const endResize = () => {
    const active = resize.current;
    if (!active) return;
    resize.current = null;
    setPreview(null);
    onResize(active.id, active.width);
  };

  return (
    <>
      <colgroup>
        {columns.map((column) => (
          <col
            key={column.id}
            style={{
              width: preview?.id === column.id ? preview.width : column.width,
            }}
          />
        ))}
      </colgroup>
      <thead
        onContextMenu={(event) => {
          // docs/ui/03 §3.2: the column checklist opens from the header too.
          event.preventDefault();
          onManageColumns();
        }}
      >
        <tr
          aria-rowindex={1}
          className="border-b border-dj-border bg-dj-panel text-dj-text-secondary uppercase tracking-wider text-[11px] font-semibold sticky top-0 z-10"
        >
          {columns.map((column) => {
            const definition = columnDefinition(column.id);
            const sortKey = definition.sortable;
            const active = sortKey !== null && sortBy === sortKey;
            const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
            const centered = definition.align === "center";
            return (
              <th
                key={column.id}
                scope="col"
                aria-sort={
                  sortKey === null
                    ? undefined
                    : active
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                }
                draggable
                onDragStart={(event) => {
                  // A drag that starts on the resize grip is a resize, not a reorder.
                  if (resize.current) {
                    event.preventDefault();
                    return;
                  }
                  setDraggedId(column.id);
                }}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => {
                  if (draggedId && draggedId !== column.id) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedId) onReorder(draggedId, column.id);
                  setDraggedId(null);
                }}
                title="Drag to reorder · right-click for columns"
                className={`relative py-2.5 px-4 ${draggedId === column.id ? "bg-dj-active" : ""}`}
              >
                {sortKey === null ? (
                  <span
                    className={centered ? "flex w-full items-center justify-center" : undefined}
                  >
                    {definition.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSort(sortKey)}
                    title={`Sort by ${definition.label.toLowerCase()}`}
                    className={`inline-flex items-center gap-1 uppercase tracking-wider text-[11px] font-semibold transition ${
                      active ? "text-dj-accent" : "text-dj-text-secondary hover:text-dj-text"
                    } ${centered ? "justify-center w-full" : ""}`}
                  >
                    <span>{definition.label}</span>
                    <Icon
                      className={`w-3 h-3 ${active ? "text-dj-accent" : "text-dj-text-muted"}`}
                    />
                  </button>
                )}
                <span
                  role="separator"
                  aria-orientation="vertical"
                  title="Drag to resize · double-click to fit"
                  onPointerDown={(event) => beginResize(event, column)}
                  onPointerMove={dragResize}
                  onPointerUp={endResize}
                  onPointerCancel={endResize}
                  onDoubleClick={() => onAutoFit(column.id)}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize border-r-2 border-transparent hover:border-dj-accent"
                />
              </th>
            );
          })}
        </tr>
      </thead>
    </>
  );
}

/**
 * Columns whose cells are numbers or fixed-width codes: tabular figures, per
 * docs/ui/01. Everything else uses the UI font.
 */
const MONO_COLUMNS: readonly ColumnId[] = [
  "index",
  "bpm",
  "key",
  "time",
  "rating",
  "year",
  "lufs",
  "cues",
  "size",
  "fingerprint",
  "format",
];

/**
 * One cell of a Library row.
 *
 * Most cells are plain text. Rating (T2.1.4) and Energy (T2.1.6) carry their
 * own widgets — the stars and the meter — and report the change upwards; the
 * cell never writes to the database itself. Columns with no field on
 * `TrackSummary` yet show the placeholder rather than an invented value.
 */
function TrackCell({
  id,
  track,
  rowNumber,
  onRate,
  onSetEnergy,
  onSelectTag,
}: {
  id: ColumnId;
  track: TrackSummary;
  rowNumber: number;
  /** Applies a star rating (1–5) or clears it when `null`. */
  onRate?: (track: TrackSummary, rating: number | null) => void;
  /** Applies an energy level (1–10) or clears it when `null`. */
  onSetEnergy?: (track: TrackSummary, energy: number | null) => void;
  /** Filters the library by the clicked tag (T2.1.7). */
  onSelectTag?: (tag: string) => void;
}) {
  const definition = columnDefinition(id);
  const base = `py-2.5 px-4 overflow-hidden whitespace-nowrap text-ellipsis ${
    definition.align === "center" ? "text-center" : "text-left"
  } ${MONO_COLUMNS.includes(id) ? "font-mono" : ""}`;
  const text = trackColumnText(track, id);

  if (id === "artwork") {
    return (
      <td className="py-1.5 px-2 text-center">
        <div className="mx-auto w-fit">
          <ArtworkThumb trackId={track.id} hasArtwork={!!track.artworkHash} />
        </div>
      </td>
    );
  }

  if (id === "index") {
    return (
      <td className={`${base} text-dj-text-muted text-[11px]`} title={`Row ${rowNumber}`}>
        {rowNumber}
      </td>
    );
  }

  if (id === "rating") {
    return (
      <td className="py-2.5 px-4 text-center">
        <StarRating
          value={track.userRating}
          label={`Rating for ${track.title || "Untitled"}`}
          onChange={(rating) => onRate?.(track, rating)}
        />
      </td>
    );
  }

  if (id === "energy") {
    return (
      <td className="py-2.5 px-4 text-center">
        <EnergyBars
          value={track.energy}
          label={`Energy for ${track.title || "Untitled"}`}
          onChange={(energy) => onSetEnergy?.(track, energy)}
        />
      </td>
    );
  }

  if (id === "tags") {
    return (
      <td className="py-2.5 px-4">
        <TagChips
          tags={track.tags}
          label={`Tags for ${track.title || "Untitled"}`}
          onSelect={onSelectTag}
        />
      </td>
    );
  }

  if (id === "status") {
    const chip = ANALYSIS_STATUS_CHIP[track.analysisStatus] ?? ANALYSIS_STATUS_CHIP.pending;
    const StatusIcon = chip.icon;
    return (
      <td className={base}>
        <span
          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[11px] font-medium border ${chip.className}`}
          title={`Analysis status: ${analysisStatusLabel(track.analysisStatus)}`}
        >
          <StatusIcon className="w-3 h-3" />
          <span>{analysisStatusLabel(track.analysisStatus)}</span>
        </span>
      </td>
    );
  }

  if (id === "format") {
    return (
      <td className={base}>
        <span className="px-1.5 py-0.5 rounded-sm text-[11px] uppercase font-mono bg-dj-overlay text-dj-text-secondary border border-dj-border">
          {text}
        </span>
      </td>
    );
  }

  const isTitle = id === "title";
  return (
    <td
      title={trackColumnTooltip(track, id)}
      className={`${base} ${
        isTitle
          ? "font-medium text-dj-text group-hover:text-dj-accent transition"
          : "text-dj-text-secondary"
      }`}
    >
      {text}
    </td>
  );
}

/**
 * Dropdown filter panel (T2.1.2). Edits a draft that only reaches the library
 * query when Apply is clicked, so users can set several filters without a
 * refetch per keystroke. Every filter is applied server-side in SQL.
 */
function LibraryFilterPanel({
  draft,
  genres,
  error,
  onChange,
  onApply,
  onReset,
  onClose,
}: {
  draft: ListTracksFilters;
  genres: GenreCount[];
  error: string | null;
  onChange: (next: ListTracksFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const numberOrUndefined = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));

  return (
    <div
      role="dialog"
      aria-label="Library filters"
      className="absolute right-5 top-11 z-40 flex max-h-[calc(100%-3.5rem)] w-[430px] flex-col overflow-hidden rounded-lg border border-dj-border bg-dj-panel shadow-2xl shadow-black/60"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-dj-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-dj-text">
          <SlidersHorizontal className="h-3.5 w-3.5 text-dj-accent" />
          <span>Library filters</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm p-1 text-dj-text-muted transition hover:bg-dj-elevated hover:text-dj-text"
          title="Close filters"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {/* BPM range */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
            Tempo (BPM)
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={400}
              step={1}
              value={draft.bpmMin ?? ""}
              onChange={(e) => onChange({ ...draft, bpmMin: numberOrUndefined(e.target.value) })}
              placeholder="Min"
              className="w-full rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1.5 text-xs text-dj-text placeholder:text-dj-text-muted focus:border-dj-accent focus:outline-hidden"
            />
            <span className="text-xs text-dj-text-muted">to</span>
            <input
              type="number"
              min={0}
              max={400}
              step={1}
              value={draft.bpmMax ?? ""}
              onChange={(e) => onChange({ ...draft, bpmMax: numberOrUndefined(e.target.value) })}
              placeholder="Max"
              className="w-full rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1.5 text-xs text-dj-text placeholder:text-dj-text-muted focus:border-dj-accent focus:outline-hidden"
            />
          </div>
        </div>

        {/* Camelot keys */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
            Key (Camelot)
          </p>
          <div className="grid grid-cols-6 gap-1">
            {CAMELOT_KEYS.map((key) => {
              const selected = hasFilterValue(draft.keyCamelot, key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      keyCamelot: toggleFilterValue(draft.keyCamelot, key),
                    })
                  }
                  className={`rounded-sm border px-1 py-1 font-mono text-[11px] transition ${
                    selected
                      ? "border-dj-accent bg-dj-accent/15 text-dj-accent"
                      : "border-dj-border bg-dj-elevated text-dj-text-secondary hover:border-dj-border-strong hover:text-dj-text"
                  }`}
                  title={
                    key.endsWith("A")
                      ? `${key} — minor / inner ring`
                      : `${key} — major / outer ring`
                  }
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>

        {/* Analysis status */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
            Analysis status
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {ANALYSIS_STATUS_OPTIONS.map((option) => {
              const checked = hasFilterValue(draft.analysisStatus, option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-dj-border bg-dj-elevated px-2 py-1.5 text-[11px] text-dj-text-secondary transition hover:border-dj-border-strong"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange({
                        ...draft,
                        analysisStatus: toggleFilterValue(
                          draft.analysisStatus,
                          option.value
                        ) as ListTracksFilters["analysisStatus"],
                      })
                    }
                    className="accent-dj-accent"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* Genre */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
            Genre
          </p>
          {genres.length === 0 ? (
            <p className="text-[11px] text-dj-text-muted">
              No genre tags in the library yet — scan a folder or clean tags first.
            </p>
          ) : (
            <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {genres.map((entry) => {
                const checked = hasFilterValue(draft.genre, entry.genre);
                return (
                  <label
                    key={entry.genre}
                    className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-dj-border bg-dj-elevated px-2 py-1.5 text-[11px] text-dj-text-secondary transition hover:border-dj-border-strong"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange({ ...draft, genre: toggleFilterValue(draft.genre, entry.genre) })
                      }
                      className="accent-dj-accent"
                    />
                    <span className="min-w-0 flex-1 truncate" title={entry.genre}>
                      {entry.genre}
                    </span>
                    <span className="font-mono text-[11px] text-dj-text-muted">{entry.count}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Rating */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
            Minimum rating
          </p>
          <select
            value={draft.ratingMin ?? ""}
            onChange={(e) =>
              onChange({
                ...draft,
                ratingMin: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            className="w-full rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1.5 text-xs text-dj-text focus:border-dj-accent focus:outline-hidden"
          >
            <option value="">Any rating</option>
            {[1, 2, 3, 4, 5].map((rating) => (
              <option key={rating} value={rating}>
                {rating}★ and up
              </option>
            ))}
          </select>
        </div>

        {/* Energy (T2.1.6) */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
            Energy (1–10)
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={draft.energyMin ?? ""}
              onChange={(e) => onChange({ ...draft, energyMin: numberOrUndefined(e.target.value) })}
              placeholder="Min"
              className="w-full rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1.5 text-xs text-dj-text placeholder:text-dj-text-muted focus:border-dj-accent focus:outline-hidden"
            />
            <span className="text-xs text-dj-text-muted">to</span>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={draft.energyMax ?? ""}
              onChange={(e) => onChange({ ...draft, energyMax: numberOrUndefined(e.target.value) })}
              placeholder="Max"
              className="w-full rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1.5 text-xs text-dj-text placeholder:text-dj-text-muted focus:border-dj-accent focus:outline-hidden"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-sm border border-dj-danger/30 bg-dj-danger/10 px-2 py-1.5 text-[11px] text-dj-danger">
            {error}
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-dj-text-muted">
          Filters run locally against SQLite. Source files are never modified.
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-dj-border px-4 py-2.5">
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-dj-border bg-dj-elevated px-2.5 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover"
        >
          Reset all
        </button>
        <button
          type="button"
          onClick={onApply}
          className="flex items-center gap-1.5 rounded-md bg-dj-accent px-3 py-1.5 text-xs font-medium text-dj-on-accent shadow-sm shadow-dj-accent/25 transition hover:bg-dj-accent-strong"
        >
          <Check className="h-3.5 w-3.5" />
          Apply filters
        </button>
      </div>
    </div>
  );
}

function ViewPlaceholder({
  icon: Icon = FolderTree,
  title,
  body,
  description,
  options = [],
  actions = [],
  onGoToLibrary,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  description?: string;
  options?: string[];
  actions?: { label: string; title?: string }[];
  onGoToLibrary?: () => void;
}) {
  const displayBody = body ?? description ?? "";
  const allBadges = [
    ...options.map((opt) => ({ label: opt, title: `${opt} — planned for this view` })),
    ...actions.map((act) => ({ label: act.label, title: act.title ?? `${act.label} — planned` })),
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-dj-border bg-dj-panel px-3">
        {allBadges.map((b) => (
          <span
            key={b.label}
            title={b.title}
            className="rounded-sm border border-dashed border-dj-border bg-dj-elevated px-2 py-0.5 text-[11px] text-dj-text-secondary opacity-80"
          >
            {b.label}
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dj-border bg-dj-elevated">
          <Icon className="h-7 w-7 text-dj-text-muted" />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-dj-text">{title}</p>
          <span className="rounded border border-dj-warning/40 bg-dj-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-dj-warning">
            Planned view
          </span>
        </div>
        {displayBody && (
          <p className="max-w-md text-xs leading-relaxed text-dj-text-secondary">{displayBody}</p>
        )}
        {onGoToLibrary && (
          <button
            type="button"
            onClick={onGoToLibrary}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dj-border bg-dj-panel px-3 py-1.5 text-xs font-medium text-dj-text hover:bg-dj-hover transition"
          >
            <Library className="h-3.5 w-3.5 text-dj-accent" />
            <span>Go to Library</span>
          </button>
        )}
      </div>
    </div>
  );
}

function InboxEmptyState({ onGoToLibrary }: { onGoToLibrary: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-dj-border bg-dj-panel px-3">
        <span className="rounded-sm border border-dj-border bg-dj-elevated px-2 py-0.5 text-[11px] text-dj-text-secondary">
          Needs Attention
        </span>
        <span className="rounded-sm border border-dj-border bg-dj-elevated px-2 py-0.5 text-[11px] text-dj-text-secondary">
          Updates
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dj-border bg-dj-elevated">
          <Inbox className="h-7 w-7 text-dj-text-muted" aria-hidden="true" />
        </div>
        <p className="text-lg font-semibold text-dj-text">Inbox is clear</p>
        <p className="max-w-md text-xs leading-relaxed text-dj-text-secondary">
          Import warnings, analysis failures and update notices will appear here. Nothing is waiting
          for you right now.
        </p>
        <button
          type="button"
          onClick={onGoToLibrary}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dj-border bg-dj-panel px-3 py-1.5 text-xs font-medium text-dj-text transition hover:bg-dj-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dj-accent"
        >
          <Library className="h-3.5 w-3.5 text-dj-accent" aria-hidden="true" />
          <span>Go to Library</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [ui, dispatch] = useReducer(reduceUiState, DEFAULT_UI_STATE, () => initUiState());
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true
  );

  const [headerVolume, setHeaderVolume] = useState(() => previewEngine.getState().volume);
  const [headerMuted, setHeaderMuted] = useState(() => previewEngine.getState().isMuted);

  useEffect(() => {
    return previewEngine.subscribe((state) => {
      setHeaderVolume(state.volume);
      setHeaderMuted(state.isMuted);
    });
  }, []);

  const handleViewChange = (newView: AppView) => {
    dispatch({ type: "setView", view: newView });
    if (ui.playerMode !== "hidden") {
      if (newView === "studio" && ui.playerMode === "mini") {
        dispatch({ type: "setPlayerMode", mode: "full" });
      } else if (newView === "library" && ui.playerMode === "full") {
        dispatch({ type: "setPlayerMode", mode: "mini" });
      }
    }
  };

  useEffect(() => {
    persistUiState(ui);
  }, [ui]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(ui.theme, systemPrefersDark);
  }, [ui.theme, systemPrefersDark]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // True while a dialog (Tag Health / Charts) is open — view shortcuts must
  // not unmount a dialog out from under the user (critique 2026-10-19).
  const dialogsOpenRef = useRef(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Never steal shortcuts while the user is typing in a field
      // (docs/ui/10: view shortcuts are suppressed inside inputs/dialogs).
      if (dialogsOpenRef.current) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          // Unmodified keys belong to the panel; Ctrl/Cmd view shortcuts
          // still reach the shell when a panel control has focus.
          (!event.ctrlKey && !event.metaKey && target.closest("[data-track-panel]")))
      ) {
        return;
      }
      const action = shortcutToAction({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      });
      if (!action) return;
      event.preventDefault();
      dispatch(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [libraryTotal, setLibraryTotal] = useState(0);
  // Virtualized table (Stage 2): the scroller is measured rather than assumed,
  // so the window survives window resizes and dock/player layout changes.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollFrameRef = useRef<number | null>(null);
  // Every query starts an epoch; a page that resolves after the query changed
  // is discarded instead of appending stale rows.
  const requestEpochRef = useRef(0);
  const tracksRef = useRef<TrackSummary[]>([]);
  tracksRef.current = tracks;
  const loadingRef = useRef(false);
  const appendInFlightRef = useRef(false);
  const queryKeyRef = useRef("");

  const submitGlobalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(globalSearch.trim());
    handleViewChange("library");
  };

  const clearGlobalSearch = () => {
    setGlobalSearch("");
    setSearchQuery("");
  };

  // Library filters + sorting (T2.1.2). Applied server-side in SQL so the view
  // stays correct past the 200-row page instead of filtering a partial window.
  const [filters, setFilters] = useState<ListTracksFilters>({});
  const [draftFilters, setDraftFilters] = useState<ListTracksFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [genres, setGenres] = useState<GenreCount[]>([]);
  const [sortBy, setSortBy] = useState<ListTracksSortBy | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  // Column arrangement (T2.1.5) is a UI preference, not app state: it is read
  // back from storage on first render and written after every change, exactly
  // like `persistUiState`. Nothing trusts it for anything but display.
  const [columns, setColumns] = useState<ColumnState[]>(() => loadLibraryColumns("library"));
  const [columnsOpen, setColumnsOpen] = useState(false);
  useEffect(() => {
    saveLibraryColumns("library", columns);
  }, [columns]);
  const [reloadToken, setReloadToken] = useState(0);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressEvent | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");
  // Tone drives the header status dot — never show a green dot during a
  // failure or a scan in progress (docs/ui/08: status reflects real state).
  const [statusTone, setStatusTone] = useState<"ok" | "busy" | "error">("ok");
  const pushStatus = (message: string, tone: "ok" | "busy" | "error" = "ok") => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  // Analysis queue (T1.2.2): version-aware run with per-track progress events.
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgressEvent | null>(null);

  // Discovery / enrichment / provider state (local-first; online lookup is planned).
  // The panel inspects a track without interrupting playback. The dock owns
  // `playingTrack`; a row click opens the panel, a double-click (or the panel
  // footer) loads the player.
  const [inspectedTrack, setInspectedTrack] = useState<TrackSummary | null>(null);
  const [playingTrack, setPlayingTrack] = useState<TrackSummary | null>(null);
  // The control that opened the panel, so closing it can hand the focus back.
  const panelTriggerRef = useRef<HTMLElement | null>(null);
  // Mirrors the open state for the stable close handler; a window-level Escape
  // when the panel is already closed must not pull the focus to an old row.
  const panelOpenRef = useRef(false);
  panelOpenRef.current = inspectedTrack !== null;
  // Multi-select for the library table (T2.1.4/T2.1.6). Ctrl/Cmd-click toggles
  // a track, Shift-click takes the range from the anchor. A rating or energy
  // edit applies to the whole selection when the edited track is part of it.
  const [selection, setSelection] = useState<string[]>([]);
  // The anchor is a track id, not a row number: sorting, searching and
  // metadata reloads reorder the table, so a stored index would point at a
  // different track by the time the user Shift-clicks.
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  // The pending *panel open* of a plain row click. The selection applies
  // immediately; only the open waits out the double-click window, so a quick
  // edit after selecting a row cannot still target the previous selection.
  const pendingRowClickRef = useRef<{ timer: number; trackId: string } | null>(null);
  const cancelPendingRowClick = useCallback(() => {
    if (pendingRowClickRef.current) {
      window.clearTimeout(pendingRowClickRef.current.timer);
      pendingRowClickRef.current = null;
    }
  }, []);
  useEffect(() => cancelPendingRowClick, [cancelPendingRowClick, ui.view]);
  // Undo for the newest metadata write (T2.1.4/T2.1.6). The backend keeps the
  // pre-write values, so the toast restores real data instead of guessing it.
  const [pendingUndo, setPendingUndo] = useState<{ undoId: string; message: string } | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  // True while the undo toast holds the focus; the idle timer is paused then.
  const undoFocusedRef = useRef(false);
  // The row context menu (T2.1.7) and the metadata editor it opens. The menu
  // is anchored to the cursor; the editor is anchored to the focused track.
  const [contextMenu, setContextMenu] = useState<{
    track: TrackSummary;
    x: number;
    y: number;
  } | null>(null);
  const [editorTrack, setEditorTrack] = useState<TrackSummary | null>(null);
  // The row the context menu was opened from, so the focus can go back to it
  // when the menu closes.
  const contextRowRef = useRef<HTMLTableRowElement | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [health, setHealth] = useState<TagHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderStatusResponse | null>(null);

  // Online enrichment review (TE.3): explicit lookup → diff review → apply → undo.
  const [enrichProvider, setEnrichProvider] = useState<EnrichmentProviderKind>("musicbrainz");
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<EnrichmentProgressEvent | null>(null);
  const [preview, setPreview] = useState<EnrichmentPreviewResponse | null>(null);
  const [checkedProposals, setCheckedProposals] = useState<string[]>([]);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  // Chart snapshots Tier 1 (TD.3): versioned data with local taste filtering.
  const [chartsOpen, setChartsOpen] = useState(false);
  dialogsOpenRef.current = healthOpen || chartsOpen || editorTrack !== null;
  const [chartGenre, setChartGenre] = useState("techno");
  const [chartKind, setChartKind] = useState("top100");
  const [chartData, setChartData] = useState<ChartListResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [matchToInspected, setMatchToInspected] = useState(true);

  // Filters and sort are part of the query key; `reloadToken` is not, so a
  // rating edit refreshes the loaded rows without looking like a new query.
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);
  const queryKey = useMemo(
    () => `${JSON.stringify(normalizedFilters ?? {})}|${sortBy ?? ""}|${sortBy ? sortDir : ""}`,
    [normalizedFilters, sortBy, sortDir]
  );

  // Load tracks — a new query resets to the first page; a reload re-fetches as
  // many rows as are already loaded (in max-size chunks) so the view does not
  // collapse under the user. Search stays client-side over the loaded pages.
  useEffect(() => {
    const reset = queryKeyRef.current !== queryKey;
    queryKeyRef.current = queryKey;

    const epoch = ++requestEpochRef.current;
    appendInFlightRef.current = false;
    loadingRef.current = true;
    setLoadingMore(false);
    setLoading(true);

    const target = reset
      ? FIRST_LIBRARY_PAGE
      : Math.max(tracksRef.current.length, FIRST_LIBRARY_PAGE);

    const load = async () => {
      const collected: TrackSummary[] = [];
      let total = 0;
      while (collected.length < target) {
        const limit = Math.min(MAX_LIBRARY_PAGE, target - collected.length);
        const res = await listTracks({
          filters: normalizedFilters,
          sortBy,
          sortDir: sortBy ? sortDir : undefined,
          limit,
          offset: collected.length,
        });
        total = res.total;
        collected.push(...res.tracks);
        if (res.tracks.length < limit) break;
      }
      return { tracks: collected, total };
    };

    load()
      .then((res) => {
        if (epoch !== requestEpochRef.current) return;
        setTracks(res.tracks);
        setLibraryTotal(res.total);
        pushStatus(`Library loaded: ${res.total} track${res.total === 1 ? "" : "s"}`);
      })
      .catch((err) => {
        if (epoch !== requestEpochRef.current) return;
        console.error("Failed to load library tracks:", err);
        pushStatus("Couldn't load tracks — check the backend, then reload", "error");
      })
      .finally(() => {
        if (epoch !== requestEpochRef.current) return;
        loadingRef.current = false;
        setLoading(false);
      });
    // Only the applied query and reloads drive the fetch; loader helpers are pure.
  }, [queryKey, normalizedFilters, sortBy, sortDir, reloadToken]);

  // Appends the next page when the window nears the loaded end. The epoch guard
  // drops a page that resolves after a filter/sort reset.
  const loadMoreLibrary = useCallback(() => {
    if (appendInFlightRef.current || loadingRef.current) return;
    const loaded = tracksRef.current.length;
    if (loaded >= libraryTotal) return;
    const epoch = requestEpochRef.current;
    appendInFlightRef.current = true;
    setLoadingMore(true);
    listTracks({
      filters: normalizedFilters,
      sortBy,
      sortDir: sortBy ? sortDir : undefined,
      limit: NEXT_LIBRARY_PAGE,
      offset: loaded,
    })
      .then((res) => {
        if (epoch !== requestEpochRef.current) return;
        setTracks((current) => {
          const known = new Set(current.map((track) => track.id));
          return [...current, ...res.tracks.filter((track) => !known.has(track.id))];
        });
        setLibraryTotal(res.total);
      })
      .catch((err) => {
        if (epoch !== requestEpochRef.current) return;
        console.error("Failed to load more library tracks:", err);
        pushStatus("Couldn't load more tracks", "error");
      })
      .finally(() => {
        if (epoch !== requestEpochRef.current) return;
        appendInFlightRef.current = false;
        setLoadingMore(false);
      });
  }, [normalizedFilters, sortBy, sortDir, libraryTotal]);

  // Measure the scroll viewport; a window resize or a dock/player layout change
  // changes how many rows are visible, never the row height.
  useEffect(() => {
    if (!scrollElement) return;
    const measure = () => setViewportHeight(scrollElement.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scrollElement);
    return () => observer.disconnect();
  }, [scrollElement]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    },
    []
  );

  const handleTableScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    const nextTop = event.currentTarget.scrollTop;
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      setScrollTop(nextTop);
    });
  };

  // A new filter, sort or search starts a new list at the top. Selection is
  // keyed by track id and deliberately survives the reset.
  useEffect(() => {
    setScrollTop(0);
    scrollElement?.scrollTo({ top: 0 });
  }, [queryKey, searchQuery, scrollElement]);

  // Genre options for the filter panel, reloaded with the library so a scan
  // that introduced new genres surfaces them immediately.
  useEffect(() => {
    let cancelled = false;
    listGenres()
      .then((res) => {
        if (!cancelled) setGenres(res.genres);
      })
      .catch((err) => console.error("Failed to load genres:", err));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const refreshLibrary = () => setReloadToken((token) => token + 1);

  // --- Shared track panel (Stage 2) ----------------------------------------
  // One panel everywhere: a row click, Enter, or the player's info control
  // opens the same inspector. Inspecting never touches playback — `playingTrack`
  // belongs to the dock and only the panel footer or a row double-click sets it.
  /**
   * Inspects a track without changing playback. A supplied trigger replaces the focus-return
   * target; omitting it preserves the previous target when navigating between related tracks.
   */
  const openTrackPanel = (track: TrackSummary, trigger?: HTMLElement | null) => {
    if (trigger) panelTriggerRef.current = trigger;
    setInspectedTrack(track);
  };

  // Closing hands the focus back to the control that opened the panel, so the
  // keyboard user lands where they left off instead of at the top of the page.
  /** Closes an open panel and focuses its remembered trigger; does nothing if already closed. */
  const closeTrackPanel = useCallback(() => {
    // Dropping the panel must also drop a click that is still waiting out the
    // double-click window; otherwise it reopens the panel right after Escape.
    cancelPendingRowClick();
    if (!panelOpenRef.current) return;
    setInspectedTrack(null);
    panelTriggerRef.current?.focus();
  }, [cancelPendingRowClick]);

  /** Sets the player track, revealing the Mini dock if the player is hidden. */
  const handlePlayTrack = (track: TrackSummary) => {
    setPlayingTrack(track);
    if (ui.playerMode === "hidden") {
      dispatch({ type: "setPlayerMode", mode: "mini" });
    }
  };

  const openFilters = () => {
    setDraftFilters(filters);
    setFilterError(null);
    setColumnsOpen(false);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    const normalized = normalizeFilters(draftFilters);
    if (
      (normalized?.bpmMin != null && normalized.bpmMin < 0) ||
      (normalized?.bpmMax != null && normalized.bpmMax < 0) ||
      (normalized?.bpmMin != null &&
        normalized.bpmMax != null &&
        normalized.bpmMin > normalized.bpmMax)
    ) {
      setFilterError("BPM bounds must be non-negative and minimum must not exceed maximum.");
      return;
    }
    // Energy is a 1–10 scale, so an out-of-range bound is a typo, not a value
    // the backend could answer with. The backend validates the same bounds and
    // expects whole numbers, so a fractional bound is rejected here too.
    const { energyMin, energyMax } = draftFilters;
    if (
      (energyMin != null && (!Number.isInteger(energyMin) || energyMin < 1 || energyMin > 10)) ||
      (energyMax != null && (!Number.isInteger(energyMax) || energyMax < 1 || energyMax > 10)) ||
      (energyMin != null && energyMax != null && energyMin > energyMax)
    ) {
      setFilterError(
        "Energy bounds must be whole numbers between 1 and 10, and minimum must not exceed maximum."
      );
      return;
    }
    setFilterError(null);
    setFilters(normalized ?? {});
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setDraftFilters({});
    setFilters({});
    setFilterError(null);
    setFiltersOpen(false);
    // Sort is a separate control — resetting filters must not reset sort.
  };

  const toggleSort = (key: ListTracksSortBy) => {
    if (sortBy === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(defaultSortDirection(key));
    }
  };

  // Provider registry: supported streaming targets + buy-link stores, and any
  // connected accounts. Empty `connected` until the first OAuth flow lands.
  useEffect(() => {
    providerStatus()
      .then(setProviders)
      .catch((err) => console.error("Failed to load provider status:", err));
  }, []);

  const openTagHealth = async () => {
    setHealthOpen(true);
    setHealthLoading(true);
    setPreview(null);
    setCheckedProposals([]);
    setApplyMessage(null);
    setEnrichProgress(null);
    try {
      setHealth(await trackTagHealth({}));
    } catch (err) {
      console.error("Failed to load tag health:", err);
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const runEnrichmentPreview = async () => {
    setEnrichLoading(true);
    setApplyMessage(null);
    setPreview(null);
    setCheckedProposals([]);
    try {
      const res = await enrichmentPreview({ provider: enrichProvider, limit: 25 });
      setPreview(res);
      setCheckedProposals(res.proposals.map((p) => p.trackId));
      // Refresh gap data underneath the review (titles may already match).
      setHealth(await trackTagHealth({}));
    } catch (err) {
      console.error("Enrichment lookup failed:", err);
      setApplyMessage(`Lookup failed — ${errorDetail(err)}. Try the lookup again.`);
    } finally {
      setEnrichLoading(false);
      setEnrichProgress(null);
    }
  };

  const toggleProposal = (trackId: string) => {
    setCheckedProposals((current) =>
      current.includes(trackId) ? current.filter((id) => id !== trackId) : [...current, trackId]
    );
  };

  const runEnrichmentApply = async () => {
    if (!preview || checkedProposals.length === 0) return;
    setEnrichLoading(true);
    try {
      const res = await enrichmentApply({ runId: preview.runId, trackIds: checkedProposals });
      setApplyMessage(
        `Applied ${res.applied} field${res.applied === 1 ? "" : "s"}${res.skipped > 0 ? `, skipped ${res.skipped}` : ""}. Undo is available for this run.`
      );
      setPreview({
        ...preview,
        proposals: preview.proposals.filter((p) => !checkedProposals.includes(p.trackId)),
      });
      setCheckedProposals([]);
      refreshLibrary();
      setHealth(await trackTagHealth({}));
    } catch (err) {
      console.error("Enrichment apply failed:", err);
      setApplyMessage(`Apply failed — ${errorDetail(err)}. Review the proposals and try again.`);
    } finally {
      setEnrichLoading(false);
    }
  };

  const runEnrichmentUndo = async () => {
    if (!preview) return;
    setEnrichLoading(true);
    try {
      const res = await enrichmentUndo({ runId: preview.runId });
      setApplyMessage(`Undone — restored ${res.restored} track${res.restored === 1 ? "" : "s"}.`);
      setPreview(null);
      setCheckedProposals([]);
      refreshLibrary();
      setHealth(await trackTagHealth({}));
    } catch (err) {
      console.error("Enrichment undo failed:", err);
      setApplyMessage(`Undo failed — ${errorDetail(err)}. Try the undo again.`);
    } finally {
      setEnrichLoading(false);
    }
  };

  /**
   * Loads Beatport chart entries using the current genre, chart, and matching preference by default.
   * When useInspected is true and a panel track exists, uses it as the taste-matching seed.
   * Caught request failures clear the entries and show a chart error.
   */
  const loadCharts = async (
    genre: string = chartGenre,
    chart: string = chartKind,
    useInspected: boolean = matchToInspected
  ) => {
    setChartLoading(true);
    setChartError(null);
    try {
      setChartData(
        await chartList({
          provider: "beatport",
          chart,
          genre,
          seedTrackId: useInspected ? (inspectedTrack?.id ?? undefined) : undefined,
        })
      );
    } catch (err) {
      console.error("Chart list failed:", err);
      setChartData(null);
      setChartError(`Couldn't load charts — ${errorDetail(err)}. Try again.`);
    } finally {
      setChartLoading(false);
    }
  };

  const openCharts = () => {
    setChartsOpen(true);
    loadCharts();
  };

  const loadSampleSnapshot = async () => {
    setChartLoading(true);
    setChartError(null);
    try {
      // Mirrors fixtures/charts/beatport-top100-techno.SAMPLE.json (synthetic demo data).
      const res = await chartImportSnapshot({
        provider: "beatport",
        chart: chartKind,
        genre: chartGenre,
        snapshotDate: new Date().toISOString().slice(0, 10),
        entries: [
          {
            position: 1,
            title: "Sample Peak A",
            artist: "Sample Artist",
            label: "Sample Records",
            isrc: "XXAAA2600001",
            bpm: 132.0,
            keyCamelot: "11A",
            sourceUrl: "https://www.beatport.com/search?q=Sample+Artist+Sample+Peak+A",
          },
          {
            position: 2,
            title: "Sample Peak B",
            artist: "Sample Artist",
            label: "Sample Records",
            isrc: "XXAAA2600002",
            bpm: 130.0,
            keyCamelot: "11A",
            sourceUrl: "https://www.beatport.com/search?q=Sample+Artist+Sample+Peak+B",
          },
          {
            position: 3,
            title: "Sample Groove",
            artist: "Other Artist",
            label: "Other Label",
            bpm: 126.0,
            keyCamelot: "8A",
            sourceUrl: "https://www.beatport.com/search?q=Other+Artist+Sample+Groove",
          },
        ],
      });
      pushStatus(`Chart snapshot imported: ${res.imported} entries, skipped ${res.skipped}`);
      await loadCharts();
    } catch (err) {
      console.error("Sample snapshot import failed:", err);
      setChartError(`Import failed — ${errorDetail(err)}. Try again.`);
    } finally {
      setChartLoading(false);
    }
  };

  // Listen to Tauri scan + analysis events
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenCompleted: (() => void) | undefined;
    let unlistenEnrichment: (() => void) | undefined;
    let unlistenAnalysisProgress: (() => void) | undefined;
    let unlistenAnalysisCompleted: (() => void) | undefined;

    listenToScanProgress((payload) => {
      setProgress(payload);
      if (payload.importedTrack) {
        setTracks((prev) => {
          if (prev.some((t) => t.id === payload.importedTrack!.id)) return prev;
          return [payload.importedTrack!, ...prev];
        });
      }
    }).then((fn) => {
      unlistenProgress = fn;
    });

    listenToScanCompleted((summary: ScanCompletedEvent) => {
      setScanning(false);
      setProgress(null);
      pushStatus(
        `Scan complete! Imported: ${summary.totalImported}, Duplicates: ${summary.totalDuplicates}, Errors: ${summary.totalErrors}`
      );
      refreshLibrary();
    }).then((fn) => {
      unlistenCompleted = fn;
    });

    listenToEnrichmentProgress((payload) => {
      setEnrichProgress(payload);
    }).then((fn) => {
      unlistenEnrichment = fn;
    });

    listenToAnalysisProgress((payload) => {
      setAnalysisProgress(payload);
      if (payload.analysisStatus === "failed") {
        console.error(`Analysis failed for ${payload.filePath}: ${payload.error}`);
      }
    }).then((fn) => {
      unlistenAnalysisProgress = fn;
    });

    listenToAnalysisCompleted((summary: AnalysisCompletedEvent) => {
      setAnalyzing(false);
      setAnalysisProgress(null);
      pushStatus(
        `Analysis complete! ${summary.succeeded} succeeded, ${summary.failed} failed in ${(summary.durationMs / 1000).toFixed(1)}s`
      );
      refreshLibrary();
    }).then((fn) => {
      unlistenAnalysisCompleted = fn;
    });

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenCompleted) unlistenCompleted();
      if (unlistenEnrichment) unlistenEnrichment();
      if (unlistenAnalysisProgress) unlistenAnalysisProgress();
      if (unlistenAnalysisCompleted) unlistenAnalysisCompleted();
    };
    // Listeners are registered once; completion handlers bump `reloadToken`
    // through `refreshLibrary`, which reloads with the *current* view state.
  }, []);

  // Esc closes the track panel, the Tag Health/Charts modals, the
  // filter/columns dropdowns, the row context menu and the metadata editor.
  // The panel handles Escape itself while the focus is inside it; this window
  // handler is the fallback for when the focus sits outside the panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTrackPanel();
        setHealthOpen(false);
        setChartsOpen(false);
        setFiltersOpen(false);
        setColumnsOpen(false);
        setContextMenu(null);
        setEditorTrack(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTrackPanel]);

  const handleSelectFolder = async () => {
    const selected = await openFolderDialog();
    if (!selected) return;

    setCurrentFolder(selected);
    setScanning(true);
    pushStatus(`Scanning folder: ${selected}...`, "busy");

    try {
      await scanFolder({ path: selected, recursive: true });
    } catch (err) {
      console.error("Error starting scan:", err);
      setScanning(false);
      const scanReason = err instanceof Error && err.message ? err.message : "unexpected error";
      pushStatus(`Scan failed — ${scanReason}. Pick the folder to retry.`, "error");
    }
  };

  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisProgress(null);
    pushStatus("Starting analysis...", "busy");
    try {
      const res = await analyzeLibrary({});
      if (res.total === 0) {
        setAnalyzing(false);
        pushStatus("No tracks need analysis (all up to date).");
      } else {
        pushStatus(`Analyzing ${res.total} track${res.total === 1 ? "" : "s"}...`);
      }
    } catch (err) {
      console.error("Error starting analysis:", err);
      setAnalyzing(false);
      setAnalysisProgress(null);
      const analysisReason = err instanceof Error && err.message ? err.message : "unexpected error";
      pushStatus(`Analysis failed — ${analysisReason}. Press Analyze to retry.`, "error");
    }
  };

  const filteredTracks = useMemo(() => filterTracks(tracks, searchQuery), [tracks, searchQuery]);

  // --- Rating / energy writes (T2.1.4 rating, T2.1.6 energy) --------------------
  // The undo affordance is offered for the newest write only. Older snapshots
  // stay in the database, but a single toast can only point at one of them.
  //
  // The toast holds until the user acts on it: the idle timer is paused while
  // the toast has focus (the Undo button must never disappear under the
  // pointer) and the toast can be dismissed explicitly.
  const clearUndoTimer = () => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const startUndoTimer = () => {
    clearUndoTimer();
    // A focused toast stays until the user acts on it or blurs away.
    if (undoFocusedRef.current) return;
    undoTimerRef.current = window.setTimeout(() => {
      setPendingUndo(null);
      undoTimerRef.current = null;
    }, UNDO_TOAST_IDLE_MS);
  };

  const dismissUndo = () => {
    clearUndoTimer();
    undoFocusedRef.current = false;
    setPendingUndo(null);
  };

  const offerUndo = (undoId: string, message: string) => {
    clearUndoTimer();
    setPendingUndo({ undoId, message });
    startUndoTimer();
  };

  useEffect(
    () => () => {
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    },
    []
  );

  // A rating or energy edit applies to the whole selection when the edited
  // track is part of it; otherwise it applies to that track alone.
  const editTargets = (track: TrackSummary): string[] =>
    selection.includes(track.id) ? selection : [track.id];

  const handleSetRating = async (track: TrackSummary, rating: number | null) => {
    const trackIds = editTargets(track);
    try {
      // `0` is the backend's "clear the rating" value (docs/ui/03 §3.4).
      const res = await setTrackRating({ trackIds, rating: rating ?? 0 });
      refreshLibrary();
      // The backend skips tracks that already hold the requested value, so
      // `updated` can be smaller than the selection — and zero when nothing
      // changed. Announce what actually changed and offer Undo only when
      // there is something to undo.
      pushStatus(describeMetadataWrite("rating", res.updated));
      const undoMessage = describeMetadataUndo("rating", res.updated, trackIds.length, track.title);
      if (undoMessage) offerUndo(res.undoId, undoMessage);
    } catch (err) {
      console.error("Failed to set rating:", err);
      pushStatus("Couldn't save the rating", "error");
    }
  };

  const handleSetEnergy = async (track: TrackSummary, energy: number | null) => {
    const trackIds = editTargets(track);
    try {
      // `0` is the backend's "clear the energy" value — 0 is outside 1–10.
      const res = await updateTrackMetadata({ trackIds, energy: energy ?? 0 });
      refreshLibrary();
      // Same contract as the rating: `updated` counts only the tracks that
      // really changed, so the message must not claim the whole selection.
      pushStatus(describeMetadataWrite("energy", res.updated));
      const undoMessage = describeMetadataUndo("energy", res.updated, trackIds.length, track.title);
      if (undoMessage) offerUndo(res.undoId, undoMessage);
    } catch (err) {
      console.error("Failed to set energy:", err);
      pushStatus("Couldn't save the energy level", "error");
    }
  };

  const handleUndoMetadata = async () => {
    if (!pendingUndo) return;
    const undoId = pendingUndo.undoId;
    dismissUndo();
    try {
      const res = await undoTrackMetadata({ undoId });
      refreshLibrary();
      pushStatus(
        res.skipped > 0
          ? `Undone — ${res.restored} track${res.restored === 1 ? "" : "s"} restored, ${res.skipped} skipped (changed since)`
          : `Undone — ${res.restored} track${res.restored === 1 ? "" : "s"} restored`
      );
    } catch (err) {
      console.error("Failed to undo track metadata:", err);
      pushStatus("Couldn't undo that change", "error");
    }
  };

  // --- Tags and the metadata editor (T2.1.7 / T2.1.13) ----------------------
  // A tag chip filters the library by that tag. The filter is a normal filter
  // group, so it shows up in the summary strip and can be removed from there.
  const handleFilterByTag = (tag: string) => {
    setFilters((current) => {
      const existing = current.tag ?? [];
      if (existing.some((entry) => entry.toLowerCase() === tag.toLowerCase())) return current;
      return { ...current, tag: [...existing, tag] };
    });
  };

  // Right-click a row: open the context menu at the cursor. The menu closes
  // on Escape, on an outside click and after an action, and hands the focus
  // back to the row it came from.
  const handleRowContextMenu = (
    event: ReactMouseEvent<HTMLTableRowElement>,
    track: TrackSummary
  ) => {
    cancelPendingRowClick();
    event.preventDefault();
    contextRowRef.current = event.currentTarget;
    setContextMenu({ track, x: event.clientX, y: event.clientY });
  };

  /** Opens the editor with a track snapshot, including tracks outside the current library page. */
  const openMetadataEditor = (track: TrackSummary) => {
    setEditorTrack(track);
  };

  // The editor saves through the same write path as the rating and the energy
  // level, so it inherits the same "nothing changed" rule and the same Undo
  // toast — including the undo of a whole tag set.
  /**
   * Saves editor values to the selection if it contains the editor track, or to that track alone.
   * Does nothing without an editor track; otherwise closes the editor before saving, refreshes
   * the library on success, and offers Undo for changed values. Caught failures show an error status.
   */
  const handleSaveMetadata = async (values: MetadataEditorValues) => {
    // The editor holds its own snapshot: the panel can open a track that is not
    // on the current page (a player track, a related track), so resolving the id
    // against `tracks` would silently drop the save.
    if (!editorTrack) return;
    const track = editorTrack;
    // A multi-selection applies to the whole selection; a single row applies
    // to that row alone. Same rule as the rating and the energy level.
    const trackIds = selection.includes(track.id) ? selection : [track.id];
    setEditorTrack(null);
    try {
      const res = await updateTrackMetadata(buildMetadataUpdatePayload(trackIds, values));
      refreshLibrary();
      pushStatus(describeMetadataWrite("metadata", res.updated));
      const undoMessage = describeMetadataUndo(
        "metadata",
        res.updated,
        trackIds.length,
        track.title
      );
      if (undoMessage) offerUndo(res.undoId, undoMessage);
    } catch (err) {
      console.error("Failed to save track metadata:", err);
      pushStatus("Couldn't save the metadata", "error");
    }
  };

  // Row selection: a plain click inspects a track (and replaces the selection),
  // Ctrl/Cmd-click toggles one track, Shift-click takes the range from the
  // anchor. Inspecting and multi-selecting stay separate on purpose — the panel
  // must never depend on how the row was selected. A double-click loads the
  // player without inspecting first; an already open panel stays open.
  /**
   * Updates the selection for a row click: Ctrl/Cmd toggles, Shift selects an inclusive range, and
   * a plain click replaces it. index is the row position in filteredTracks; a missing Shift anchor
   * falls back to selecting only this track.
   */
  const applyRowSelection = (
    event: Pick<ReactMouseEvent<HTMLTableRowElement>, "ctrlKey" | "metaKey" | "shiftKey">,
    track: TrackSummary,
    index: number,
    anchor = selectionAnchor
  ) => {
    if (event.ctrlKey || event.metaKey) {
      setSelection((current) =>
        current.includes(track.id)
          ? current.filter((id) => id !== track.id)
          : [...current, track.id]
      );
      setSelectionAnchor(track.id);
      return;
    }
    if (event.shiftKey && anchor !== null) {
      // The anchor is resolved against the *current* list, so a re-sort or a
      // reload between the two clicks cannot shift the range onto other rows.
      const anchorIndex = filteredTracks.findIndex((entry) => entry.id === anchor);
      if (anchorIndex === -1) {
        // The anchor is no longer in the visible list: fall back to a plain
        // selection instead of a range built from a stale position.
        setSelection([track.id]);
        setSelectionAnchor(track.id);
        return;
      }
      const [from, to] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
      setSelection(filteredTracks.slice(from, to + 1).map((entry) => entry.id));
      return;
    }
    setSelection([track.id]);
    setSelectionAnchor(track.id);
  };

  /** Selects the clicked row and inspects it, remembering the row for focus return. */
  const handleRowClick = (
    event: Pick<
      ReactMouseEvent<HTMLTableRowElement>,
      "ctrlKey" | "metaKey" | "shiftKey" | "currentTarget"
    >,
    track: TrackSummary,
    index: number,
    anchor = selectionAnchor
  ) => {
    applyRowSelection(event, track, index, anchor);
    openTrackPanel(track, event.currentTarget);
  };

  const arbitrateRowClick = (
    event: ReactMouseEvent<HTMLTableRowElement>,
    track: TrackSummary,
    index: number
  ) => {
    const pending = pendingRowClickRef.current;
    cancelPendingRowClick();
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      event.preventDefault();
      // The previous plain click has already applied its selection; its anchor
      // has not reached this render yet, so pass that track explicitly.
      handleRowClick(event, track, index, pending?.trackId ?? selectionAnchor);
      return;
    }
    if (event.detail > 1) return;
    // Selection follows the click at once; only the panel open waits for the
    // double-click window. React clears currentTarget after dispatch, so retain
    // the row for the deferred open and the focus return.
    applyRowSelection({ ctrlKey: false, metaKey: false, shiftKey: false }, track, index);
    const { currentTarget } = event;
    const timer = window.setTimeout(() => {
      pendingRowClickRef.current = null;
      openTrackPanel(track, currentTarget);
    }, ROW_DOUBLE_CLICK_MS);
    pendingRowClickRef.current = { timer, trackId: track.id };
  };

  // T2.1.5: the table renders exactly this list, in storage order. Resizing is
  // committed on pointer-up, so a drag writes one preference, not one per move.
  const shownColumns = visibleColumns(columns);

  // Virtualized rows (Stage 2): only the slice around the viewport is mounted;
  // spacer rows keep the scrollbar proportional to the whole result set.
  const rowHeight = rowHeightForColumns(shownColumns);
  const rowWindow = useMemo(
    () =>
      virtualWindow({
        scrollTop,
        viewportHeight,
        rowHeight,
        rowCount: filteredTracks.length,
      }),
    [scrollTop, viewportHeight, rowHeight, filteredTracks.length]
  );
  const renderedTracks = filteredTracks.slice(rowWindow.start, rowWindow.end);

  // Append the next page before the window runs out of loaded rows. The footer
  // button stays as the keyboard-reachable path for the same action.
  useEffect(() => {
    if (shouldLoadMore(rowWindow.end, tracks.length, libraryTotal)) {
      loadMoreLibrary();
    }
  }, [rowWindow.end, tracks.length, libraryTotal, loadMoreLibrary]);

  const handleToggleColumn = (id: ColumnId) => {
    setColumns((current) => toggleColumnVisible(current, id));
  };
  const handleMoveColumn = (draggedId: ColumnId, targetId: ColumnId) => {
    setColumns((current) => moveColumn(current, draggedId, targetId));
  };
  const handleResizeColumn = (id: ColumnId, width: number) => {
    setColumns((current) => setColumnWidth(current, id, width));
  };
  const handleAutoFitColumn = (id: ColumnId) => {
    const definition = columnDefinition(id);
    const longest = filteredTracks.reduce((text, track) => {
      const cell = trackColumnText(track, id);
      return cell.length > text.length ? cell : text;
    }, "");
    setColumns((current) => setColumnWidth(current, id, autoFitWidth(longest, definition)));
  };
  const filterCount = activeFilterCount(filters);
  const filterSummary = describeFilterParts(filters);
  // True when the (server-side) page behind `filteredTracks` is narrowed either by
  // the filter panel or by the live search box; used to tell "no tracks" apart
  // from "no matches for the current query".
  const pageIsFiltered = filterCount > 0 || searchQuery.trim().length > 0;

  const ThemeIcon = THEME_ICONS[ui.theme];

  return (
    <div className="relative flex h-screen flex-col bg-dj-bg font-sans text-dj-text">
      <a
        href="#main-workspace"
        className="sr-only z-50 rounded-sm bg-dj-accent px-3 py-2 text-xs font-medium text-dj-on-accent focus:not-sr-only focus:absolute focus:left-2 focus:top-2"
      >
        Skip to main content
      </a>
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-dj-border bg-dj-panel px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-linear-to-tr from-dj-accent-strong to-dj-accent shadow-sm shadow-dj-accent/20">
            <Disc3 className="h-3.5 w-3.5 text-dj-on-accent" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-dj-text">
            DJ Assistant
          </span>
        </div>

        <div className="ml-2 flex min-w-0 items-center gap-1.5">
          <form
            role="search"
            onSubmit={submitGlobalSearch}
            className="relative w-44 min-w-0 sm:w-56 xl:w-72"
          >
            <Search
              className="pointer-events-none absolute left-2 top-1.5 h-3 w-3 text-dj-text-muted"
              aria-hidden="true"
            />
            <input
              id="global-search"
              name="global-search"
              type="search"
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Search library..."
              aria-label="Search library"
              title="Search the library. Playlist and tag-wide search arrives with Stage 2."
              className="h-6 w-full rounded-sm border border-dj-border bg-dj-bg pl-7 pr-7 text-[11px] text-dj-text placeholder:text-dj-text-muted transition focus:border-dj-accent focus:outline-hidden"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={clearGlobalSearch}
                aria-label="Clear library search"
                title="Clear search"
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-sm text-dj-text-muted transition hover:bg-dj-hover hover:text-dj-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dj-accent"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={() => handleViewChange("import")}
            aria-pressed={ui.view === "import"}
            aria-label="Import Center"
            title="Import Center — import folders, watch folders and the analysis queue"
            className={`flex h-6 items-center gap-1 rounded-sm border px-2 text-[11px] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dj-accent ${
              ui.view === "import"
                ? "border-dj-accent/40 bg-dj-accent/10 text-dj-accent"
                : "border-dj-border bg-dj-elevated text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">Import Center</span>
          </button>

          <button
            type="button"
            onClick={() => handleViewChange("inbox")}
            aria-pressed={ui.view === "inbox"}
            aria-label="Inbox"
            title="Inbox — Needs Attention and Updates"
            className={`flex h-6 items-center gap-1 rounded-sm border px-2 text-[11px] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dj-accent ${
              ui.view === "inbox"
                ? "border-dj-accent/40 bg-dj-accent/10 text-dj-accent"
                : "border-dj-border bg-dj-elevated text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text"
            }`}
          >
            <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Inbox</span>
          </button>

          <button
            type="button"
            onClick={() => handleViewChange("backup")}
            aria-pressed={ui.view === "backup"}
            aria-label="Open backup settings. Backup is not configured yet."
            title="Backup is not configured yet — open backup settings"
            className={`flex h-6 items-center gap-1 rounded-sm border px-2 text-[11px] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dj-accent ${
              ui.view === "backup"
                ? "border-dj-warning/40 bg-dj-warning/10 text-dj-warning"
                : "border-dj-border bg-dj-elevated text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Backup not set up</span>
          </button>
        </div>

        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2"
          role="status"
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              statusTone === "error"
                ? "bg-dj-danger"
                : statusTone === "busy"
                  ? "bg-dj-accent animate-pulse"
                  : "bg-dj-success"
            }`}
          />
          <span className="truncate text-[11px] text-dj-text-muted" title={statusMessage}>
            {statusMessage}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => dispatch({ type: "setTheme", theme: nextTheme(ui.theme) })}
            title={`Theme: ${THEME_LABELS[ui.theme]} — click to cycle`}
            aria-label={`Theme: ${THEME_LABELS[ui.theme]}`}
            className="rounded-sm p-1.5 text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
          >
            <ThemeIcon className="h-4 w-4" />
          </button>

          <div className="group flex items-center">
            <button
              type="button"
              onClick={() => previewEngine.setMuted(!headerMuted)}
              title={headerMuted ? "Unmute preview" : "Mute preview"}
              aria-label={headerMuted ? "Unmute preview" : "Mute preview"}
              className="rounded-sm p-1.5 text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
            >
              <Volume2 className={`h-4 w-4 ${headerMuted ? "text-dj-danger" : ""}`} />
            </button>
            <input
              id="preview-volume"
              name="preview-volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={headerMuted ? 0 : headerVolume}
              onChange={(e) => {
                const val = Number(e.target.value);
                setHeaderVolume(val);
                previewEngine.setVolume(val);
              }}
              aria-label="Preview volume"
              title={`Preview volume: ${Math.round(headerVolume * 100)}%`}
              className="w-0 opacity-0 transition-all duration-150 group-hover:w-16 group-hover:opacity-100 accent-dj-accent cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => dispatch({ type: "togglePlayer" })}
            aria-pressed={ui.playerMode !== "hidden"}
            title={ui.playerMode === "hidden" ? "Show player" : "Hide player"}
            aria-label={ui.playerMode === "hidden" ? "Show player" : "Hide player"}
            className={`rounded-sm p-1.5 transition hover:bg-dj-hover ${
              ui.playerMode === "hidden"
                ? "text-dj-text-secondary hover:text-dj-text"
                : "bg-dj-active text-dj-accent"
            }`}
          >
            <Disc3 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`flex shrink-0 flex-col border-r border-dj-border bg-dj-panel transition-[width] duration-200 ${
            ui.navCollapsed ? "w-12" : "w-[220px]"
          }`}
        >
          <nav aria-label="Primary views" className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = ui.view === item.view;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleViewChange(item.view)}
                  aria-current={active ? "page" : undefined}
                  aria-label={`${item.label} (Ctrl/Cmd+${item.shortcut})`}
                  title={`${item.label} (Ctrl/Cmd+${item.shortcut})`}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-dj-accent ${
                    active
                      ? "bg-dj-active font-medium text-dj-text"
                      : "text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {!ui.navCollapsed && (
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-dj-border p-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "toggleNav" })}
              title={ui.navCollapsed ? "Expand navigation" : "Collapse navigation"}
              aria-label={ui.navCollapsed ? "Expand navigation" : "Collapse navigation"}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text"
            >
              {ui.navCollapsed ? (
                <PanelLeftOpen className="h-4 w-4 shrink-0" />
              ) : (
                <PanelLeftClose className="h-4 w-4 shrink-0" />
              )}
              {!ui.navCollapsed && <span>Collapse nav</span>}
            </button>
          </div>
        </aside>

        <main
          id="main-workspace"
          tabIndex={-1}
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden focus:outline-hidden"
        >
          {ui.view === "import" ? (
            <ViewPlaceholder
              icon={FolderOpen}
              title="Import Center"
              description="Ingest new downloaded tracks, validate tags, assess quality, rate, comment, and tag before importing them into your library. The import workflow arrives in Stage 3."
              options={["Folder scan", "Watch folders", "Duplicate detection"]}
            />
          ) : ui.view === "library" ? (
            <>
              {/* Main Content Area */}
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Options bar — view-context actions (docs/ui/02) */}
                <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-dj-border bg-dj-panel px-3">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-dj-text-muted" />
                    <input
                      id="library-search"
                      name="library-search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search title, artist, album, path..."
                      className="h-6 w-full rounded-sm border border-dj-border bg-dj-elevated pl-8 pr-2 text-[11px] text-dj-text placeholder:text-dj-text-muted transition focus:border-dj-accent focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={filtersOpen ? () => setFiltersOpen(false) : openFilters}
                    className={`flex h-6 items-center gap-1 rounded-sm border px-2 text-[11px] transition ${
                      filterCount > 0
                        ? "border-dj-accent/40 bg-dj-accent/10 text-dj-accent hover:bg-dj-accent/15"
                        : "border-dj-border bg-dj-elevated text-dj-text-secondary hover:bg-dj-hover"
                    }`}
                    title="Filter by tempo, key, genre, rating and analysis status"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Filters{filterCount > 0 ? ` (${filterCount})` : ""}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltersOpen(false);
                      setColumnsOpen((open) => !open);
                    }}
                    className={`flex h-6 items-center gap-1 rounded-sm border px-2 text-[11px] transition ${
                      columnsOpen
                        ? "border-dj-accent/40 bg-dj-accent/10 text-dj-accent hover:bg-dj-accent/15"
                        : "border-dj-border bg-dj-elevated text-dj-text-secondary hover:bg-dj-hover"
                    }`}
                    title="Show, hide, reorder and resize columns"
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    <span>Columns</span>
                  </button>
                  <span className="mx-1 h-4 w-px bg-dj-border" />
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    disabled={scanning}
                    className="flex h-6 items-center gap-1 rounded-sm border border-dj-accent bg-dj-accent px-2 text-[11px] font-medium text-dj-on-accent transition hover:bg-dj-accent-strong disabled:border-dj-active disabled:bg-dj-active disabled:text-dj-text-muted"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>{scanning ? "Scanning…" : "Scan folder"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={analyzing || scanning}
                    className="flex h-6 items-center gap-1 rounded-sm border border-dj-accent/40 bg-dj-accent/10 px-2 text-[11px] font-medium text-dj-accent transition hover:bg-dj-accent/15 disabled:opacity-50"
                    title="Analyze all tracks that need it (version-aware; BPM, key, phrases, vocals, loudness)"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${analyzing ? "animate-pulse" : ""}`} />
                    <span>{analyzing ? "Analyzing…" : "Analyze"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={refreshLibrary}
                    disabled={loading || scanning}
                    className="flex h-6 w-6 items-center justify-center rounded-sm border border-dj-border bg-dj-elevated text-dj-text-secondary transition hover:bg-dj-hover disabled:opacity-50"
                    title="Refresh library"
                    aria-label="Refresh library"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  </button>
                  <span className="mx-1 h-4 w-px bg-dj-border" />
                  <button
                    type="button"
                    onClick={openTagHealth}
                    className="flex h-6 items-center gap-1 rounded-sm border border-dj-border bg-dj-elevated px-2 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover"
                    title="Show missing tags and artwork across the library (local gap detection; online lookup planned)"
                  >
                    <Activity className="h-3.5 w-3.5 text-dj-warning" />
                    <span>Tag Health</span>
                  </button>
                  <button
                    type="button"
                    onClick={openCharts}
                    className="flex h-6 items-center gap-1 rounded-sm border border-dj-border bg-dj-elevated px-2 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover"
                    title="Beatport Top 100 / Hype snapshots with taste filtering (versioned data — no catalog API)"
                  >
                    <BarChart3 className="h-3.5 w-3.5 text-dj-accent" />
                    <span>Charts</span>
                  </button>

                  <div className="ml-auto flex items-center gap-3 text-[11px] text-dj-text-muted">
                    {providers && (
                      <span
                        className="hidden items-center gap-1 xl:flex"
                        title={`Streaming: ${providers.supportedStreaming.join(", ")} · Stores: ${providers.supportedStores.join(", ")}`}
                      >
                        <PlugZap className="h-3.5 w-3.5" />
                        <span>{providers.connected.length} connected</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>
                        {filteredTracks.length}
                        {libraryTotal !== filteredTracks.length ? ` of ${libraryTotal}` : ""} tracks
                      </span>
                    </span>
                    <span className="hidden items-center gap-1 lg:flex">
                      <ShieldCheck className="h-3.5 w-3.5 text-dj-success" />
                      <span>Local-first</span>
                    </span>
                  </div>

                  {filtersOpen && (
                    <LibraryFilterPanel
                      draft={draftFilters}
                      genres={genres}
                      error={filterError}
                      onChange={setDraftFilters}
                      onApply={applyFilters}
                      onReset={resetFilters}
                      onClose={() => setFiltersOpen(false)}
                    />
                  )}
                  {columnsOpen && (
                    <ColumnPicker
                      columns={columns}
                      onToggle={handleToggleColumn}
                      onMove={handleMoveColumn}
                      onReset={() => setColumns(resetLibraryColumns())}
                      onClose={() => setColumnsOpen(false)}
                    />
                  )}
                </div>

                {/* Sub-header / Scan Status */}
                {scanning && progress && (
                  <div className="bg-dj-elevated border-b border-dj-accent/30 px-5 py-2.5 flex flex-col space-y-1.5 transition-all">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-dj-accent font-medium flex items-center space-x-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Scanning: {progress.currentPath}</span>
                      </span>
                      <span className="text-dj-text-secondary font-mono">
                        {progress.scannedFiles} / {progress.totalFiles || "?"} files
                      </span>
                    </div>
                    <div className="w-full bg-dj-bg rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-dj-accent h-1.5 rounded-full transition-all duration-200"
                        style={{
                          width: `${scanPercent(progress.scannedFiles, progress.totalFiles)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Analysis progress (T1.2.2) */}
                {analyzing && analysisProgress && (
                  <div className="bg-dj-elevated border-b border-dj-accent/30 px-5 py-2.5 flex flex-col space-y-1.5 transition-all">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-dj-accent font-medium flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        <span>
                          Analyzing:{" "}
                          {analysisProgress.filePath.split(/[\\/]/).pop() ??
                            analysisProgress.filePath}
                        </span>
                      </span>
                      <span className="text-dj-text-secondary font-mono">
                        {analysisProgress.processed} / {analysisProgress.total} tracks
                      </span>
                    </div>
                    <div className="w-full bg-dj-bg rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-dj-accent h-1.5 rounded-full transition-all duration-200"
                        style={{
                          width: `${scanPercent(analysisProgress.processed, analysisProgress.total)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Active filter summary — one chip per filter group, with a clear action. */}
                {filterSummary.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-dj-border bg-dj-panel px-5 py-1.5 text-[11px] text-dj-text-secondary">
                    <SlidersHorizontal className="w-3 h-3 text-dj-accent" />
                    {filterSummary.map((part) => (
                      <span
                        key={part.group}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-dj-accent/10 text-dj-accent border border-dj-accent/20 font-mono"
                      >
                        {part.label}
                        <button
                          type="button"
                          onClick={() =>
                            setFilters((current) => clearFilterGroup(current, part.group))
                          }
                          title={`Remove the ${part.group} filter`}
                          aria-label={`Remove the ${part.group} filter`}
                          className="rounded-sm p-px text-dj-accent/70 transition hover:text-dj-accent"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={resetFilters}
                      className="ml-1 text-dj-text-muted hover:text-dj-text-secondary underline decoration-dotted"
                      title="Clear every filter (sort order is kept)"
                    >
                      clear all
                    </button>
                  </div>
                )}

                {/* Multi-select indicator (T2.1.4/T2.1.6): a rating or energy
                    edit applies to every selected track. */}
                {selection.length > 1 && (
                  <div className="flex items-center gap-2 border-b border-dj-border bg-dj-panel px-5 py-1.5 text-[11px] text-dj-text-secondary">
                    <span className="font-mono text-dj-accent">{selection.length} selected</span>
                    <span className="text-dj-text-muted">
                      Rating and energy edits apply to all of them.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // The anchor goes with the selection: a Shift-click must
                        // not build a range from a dropped selection.
                        setSelection([]);
                        setSelectionAnchor(null);
                      }}
                      className="ml-auto text-dj-text-muted hover:text-dj-text-secondary underline decoration-dotted"
                      title="Drop the multi-selection"
                    >
                      clear selection
                    </button>
                  </div>
                )}

                {/* Track List Table */}
                <div
                  ref={setScrollElement}
                  onScroll={handleTableScroll}
                  className="flex-1 overflow-auto"
                >
                  {filteredTracks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-dj-text-muted space-y-3 p-8">
                      <div className="h-16 w-16 rounded-2xl bg-dj-elevated border border-dj-border flex items-center justify-center">
                        {pageIsFiltered ? (
                          <Search className="w-8 h-8 text-dj-text-muted" />
                        ) : (
                          <Music className="w-8 h-8 text-dj-text-muted" />
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-dj-text-secondary">
                          {pageIsFiltered ? "No tracks match" : "No tracks in library"}
                        </p>
                        <p className="text-xs text-dj-text-muted mt-1 max-w-sm">
                          {pageIsFiltered
                            ? "Nothing matches the current search and filters. Clear them to see the whole library."
                            : "Use Scan folder in the options bar to import your local audio files (.mp3, .flac, .wav, .aiff)."}
                        </p>
                      </div>
                      {pageIsFiltered ? (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            resetFilters();
                          }}
                          className="text-xs px-3 py-1.5 rounded-md bg-dj-elevated border border-dj-border text-dj-text-secondary hover:bg-dj-hover transition"
                        >
                          Clear search &amp; filters
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectFolder}
                            disabled={scanning}
                            className="flex items-center gap-1.5 rounded-md border border-dj-accent bg-dj-accent px-3 py-1.5 text-xs font-medium text-dj-on-accent transition hover:bg-dj-accent-strong disabled:border-dj-active disabled:bg-dj-active disabled:text-dj-text-muted"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            {scanning ? "Scanning…" : "Scan folder"}
                          </button>
                          {currentFolder && (
                            <div
                              className="max-w-sm truncate rounded-sm border border-dj-border bg-dj-elevated px-3 py-1 font-mono text-xs text-dj-text-secondary"
                              title={currentFolder}
                            >
                              Current folder: {currentFolder}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <table
                      aria-rowcount={filteredTracks.length + 1}
                      className="table-fixed text-left border-collapse text-xs"
                      style={{ width: totalColumnWidth(shownColumns) }}
                    >
                      <TrackTableHeader
                        columns={shownColumns}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={toggleSort}
                        onResize={handleResizeColumn}
                        onAutoFit={handleAutoFitColumn}
                        onReorder={handleMoveColumn}
                        onManageColumns={() => setColumnsOpen(true)}
                      />
                      {rowWindow.topPadding > 0 && (
                        <tbody aria-hidden="true">
                          <tr>
                            <td
                              colSpan={shownColumns.length}
                              style={{ height: rowWindow.topPadding, padding: 0, border: 0 }}
                            />
                          </tr>
                        </tbody>
                      )}
                      <tbody>
                        {renderedTracks.map((track, offset) => {
                          const idx = rowWindow.start + offset;
                          return (
                            <tr
                              key={track.id}
                              tabIndex={0}
                              aria-rowindex={idx + 2}
                              aria-label={`Inspect ${track.title || "Untitled"} by ${track.artist || "Unknown Artist"}`}
                              aria-selected={selection.includes(track.id)}
                              onClick={(event) => arbitrateRowClick(event, track, idx)}
                              onDoubleClick={(event) => {
                                cancelPendingRowClick();
                                // The rating stars and energy meter live inside the
                                // row; double-clicking them must not load the player.
                                if (
                                  (event.target as HTMLElement).closest(
                                    "button, a, input, select, textarea"
                                  )
                                ) {
                                  return;
                                }
                                handlePlayTrack(track);
                              }}
                              onContextMenu={(event) => handleRowContextMenu(event, track)}
                              onKeyDown={(e) => {
                                // Only the row itself handles Enter/Space. A child
                                // control (the rating stars, the energy meter) owns
                                // its own keyboard interaction, and the row must
                                // not swallow the activation key.
                                if (e.target !== e.currentTarget) return;
                                if (e.key === "Enter" || e.key === " ") {
                                  cancelPendingRowClick();
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelection([track.id]);
                                  setSelectionAnchor(track.id);
                                  openTrackPanel(track, e.currentTarget);
                                }
                              }}
                              title="Click or press Enter to inspect · Double-click to load the player · Ctrl/Cmd-click to multi-select, Shift-click for a range"
                              style={{ height: rowHeight }}
                              className={`hover:bg-dj-hover transition duration-150 group cursor-pointer focus-visible:outline-2 focus-visible:outline-dj-accent focus-visible:-outline-offset-2 [&>td]:shadow-[inset_0_-1px_0_var(--color-dj-border)] ${
                                // Selected rows are highlighted: a rating or energy
                                // edit applies to every one of them, so the user
                                // must be able to see which.
                                selection.includes(track.id) ? "bg-dj-active" : ""
                              } ${
                                // The inspected row keeps its own marker, so the
                                // panel and the selection stay distinguishable.
                                // It rides on the first cell: a `tr` cannot carry a
                                // box-shadow, and a border would shift the layout.
                                // Row separators are inset cell shadows for the
                                // same reason — a 1px border per row would drift
                                // the spacer math by 30,000px at library scale.
                                inspectedTrack?.id === track.id
                                  ? "[&>td:first-child]:bg-dj-accent/25"
                                  : ""
                              }`}
                            >
                              {shownColumns.map((column) => (
                                <TrackCell
                                  key={column.id}
                                  id={column.id}
                                  track={track}
                                  rowNumber={idx + 1}
                                  onRate={handleSetRating}
                                  onSetEnergy={handleSetEnergy}
                                  onSelectTag={handleFilterByTag}
                                />
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                      {rowWindow.bottomPadding > 0 && (
                        <tbody aria-hidden="true">
                          <tr>
                            <td
                              colSpan={shownColumns.length}
                              style={{ height: rowWindow.bottomPadding, padding: 0, border: 0 }}
                            />
                          </tr>
                        </tbody>
                      )}
                    </table>
                  )}
                </div>

                {/* Incremental paging: scrolling appends the next page; the
                    button is the keyboard-reachable path to the same action. */}
                {tracks.length > 0 && tracks.length < libraryTotal && (
                  <div className="flex shrink-0 items-center justify-center gap-2 border-t border-dj-border bg-dj-panel px-3 py-1.5 text-[11px] text-dj-text-muted">
                    <span>
                      Showing {tracks.length.toLocaleString("en-US")} of{" "}
                      {libraryTotal.toLocaleString("en-US")}
                    </span>
                    <button
                      type="button"
                      onClick={loadMoreLibrary}
                      disabled={loadingMore || loading}
                      className="inline-flex items-center gap-1 rounded-sm border border-dj-border bg-dj-elevated px-2 py-0.5 text-[11px] text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text disabled:opacity-50"
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}

                {/* Undo toast (T2.1.4/T2.1.6): the backend kept the pre-write
                    values, so this restores real data instead of guessing it.
                    It holds until the user acts on it: the idle timer is paused
                    while it has focus, and it can be dismissed outright. */}
                {pendingUndo && (
                  <div
                    role="status"
                    aria-live="polite"
                    onFocus={() => {
                      undoFocusedRef.current = true;
                      clearUndoTimer();
                    }}
                    onBlur={(event) => {
                      // Focus moved to another control inside the toast: keep
                      // holding it open.
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        return;
                      }
                      undoFocusedRef.current = false;
                      if (pendingUndo) startUndoTimer();
                    }}
                    className="absolute bottom-4 left-5 z-30 flex items-center gap-3 rounded-lg border border-dj-border bg-dj-panel px-3 py-2 text-[11px] text-dj-text-secondary shadow-2xl shadow-black/60"
                  >
                    <span>{pendingUndo.message}</span>
                    <button
                      type="button"
                      onClick={handleUndoMetadata}
                      className="inline-flex items-center gap-1 rounded-sm border border-dj-border bg-dj-elevated px-2 py-1 text-[11px] text-dj-text transition hover:bg-dj-hover hover:text-dj-accent"
                      title="Restore the previous rating / energy"
                    >
                      <Undo2 className="h-3 w-3" />
                      Undo
                    </button>
                    <button
                      type="button"
                      onClick={dismissUndo}
                      aria-label="Dismiss the undo notification"
                      title="Dismiss"
                      className="inline-flex items-center justify-center rounded-sm p-1 text-dj-text-muted transition hover:bg-dj-hover hover:text-dj-text"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Tag Health modal: library-wide missing tags/artwork */}
              {healthOpen && (
                <ModalShell
                  onClose={() => setHealthOpen(false)}
                  ariaLabel="Tag Health — missing tags and artwork"
                  panelClassName="w-[560px] max-w-full max-h-full overflow-y-auto bg-dj-panel border border-dj-border rounded-lg shadow-2xl"
                >
                  <div className="p-4 border-b border-dj-border flex items-center justify-between">
                    <p className="text-sm font-semibold text-dj-text flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-dj-warning" />
                      <span>Tag Health — missing tags &amp; artwork</span>
                    </p>
                    <button
                      onClick={() => setHealthOpen(false)}
                      className="p-1.5 rounded-md hover:bg-dj-hover text-dj-text-secondary transition"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4">
                    {healthLoading ? (
                      <p className="text-xs text-dj-text-muted">Scanning library gaps…</p>
                    ) : !health ? (
                      <p className="text-xs text-dj-text-muted">Could not load tag health.</p>
                    ) : (
                      <>
                        <p className="text-xs text-dj-text-secondary">
                          {health.withGaps} of {health.checked} tracks have gaps.
                          {health.averageScore != null && (
                            <>
                              {" "}
                              Library score:{" "}
                              <span className="font-mono text-dj-text">
                                {Math.round(health.averageScore)}
                              </span>
                              /100
                            </>
                          )}{" "}
                          Online lookup is explicit and opt-in per provider — only metadata and
                          search queries leave this device, never audio.
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <label
                            htmlFor="enrich-provider"
                            className="text-xs text-dj-text-secondary"
                          >
                            Source
                          </label>
                          <select
                            id="enrich-provider"
                            value={enrichProvider}
                            onChange={(e) =>
                              setEnrichProvider(e.target.value as EnrichmentProviderKind)
                            }
                            className="bg-dj-elevated border border-dj-border rounded-md px-2 py-1.5 text-xs text-dj-text"
                            disabled={enrichLoading}
                            title="Discogs / Last.fm need exported API keys (see .env.example)"
                          >
                            <option value="musicbrainz">MusicBrainz (no key)</option>
                            <option value="itunes">iTunes Search (no key)</option>
                            <option value="deezer">Deezer (no key)</option>
                            <option value="discogs">Discogs (needs DISCOGS_TOKEN)</option>
                            <option value="lastfm">Last.fm (needs LASTFM_API_KEY)</option>
                            <option value="acoustid" disabled>
                              AcoustID (fingerprinting pending)
                            </option>
                          </select>
                          <button
                            onClick={runEnrichmentPreview}
                            disabled={enrichLoading || health.withGaps === 0}
                            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-dj-accent hover:bg-dj-accent-strong disabled:bg-dj-active text-dj-on-accent text-xs font-medium transition"
                            title="Look up to 25 gap tracks on the selected source. Nothing is applied yet."
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>
                              {enrichLoading && !preview ? "Looking up…" : "Look up online"}
                            </span>
                          </button>
                        </div>
                        {enrichProgress && (
                          <p className="text-[11px] text-dj-text-muted font-mono mt-2">
                            {enrichProgress.processed} / {enrichProgress.total} ·{" "}
                            {enrichProgress.status}
                          </p>
                        )}
                        {applyMessage && (
                          <p className="text-xs text-dj-text-secondary mt-2">{applyMessage}</p>
                        )}
                        {preview && preview.proposals.length > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] uppercase tracking-wider font-semibold text-dj-text-muted">
                                Proposals from {preview.provider} ({preview.proposedTracks} tracks,{" "}
                                {preview.proposedChanges} changes
                                {preview.skipped > 0 ? `, ${preview.skipped} skipped` : ""})
                              </p>
                            </div>
                            <ul className="mt-2 space-y-2 max-h-72 overflow-y-auto">
                              {preview.proposals.map((proposal) => (
                                <li
                                  key={proposal.trackId}
                                  className="p-2 rounded-md bg-dj-elevated border border-dj-border text-xs"
                                >
                                  <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={checkedProposals.includes(proposal.trackId)}
                                      onChange={() => toggleProposal(proposal.trackId)}
                                      className="mt-1 accent-dj-accent"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center gap-2">
                                        <span className="text-dj-text truncate">
                                          {proposal.title} — {proposal.artist}
                                        </span>
                                        <span
                                          className={`shrink-0 px-1.5 py-0.5 rounded-sm text-[11px] font-medium border ${
                                            proposal.tier === "high"
                                              ? "bg-dj-success/10 text-dj-success border-dj-success/20"
                                              : proposal.tier === "review"
                                                ? "bg-dj-warning/10 text-dj-warning border-dj-warning/20"
                                                : "bg-dj-active text-dj-text-secondary border-dj-border"
                                          }`}
                                          title={`Match confidence ${formatScore(proposal.confidence)}`}
                                        >
                                          {proposal.tier} · {formatScore(proposal.confidence)}
                                        </span>
                                      </span>
                                      <span className="block mt-1 space-y-0.5">
                                        {proposal.changes.map((change) => (
                                          <span key={change.field} className="block text-[11px]">
                                            <span className="text-dj-text-muted">
                                              {formatMissingField(change.field)}:{" "}
                                            </span>
                                            <span className="text-dj-text-muted line-through">
                                              {change.field === "artwork"
                                                ? "none"
                                                : (change.current ?? "—")}
                                            </span>
                                            <span className="text-dj-text-muted"> → </span>
                                            <span className="text-dj-success">
                                              {change.field === "artwork"
                                                ? "cover art"
                                                : truncateComment(change.proposed, 60)}
                                            </span>
                                          </span>
                                        ))}
                                      </span>
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={runEnrichmentApply}
                                disabled={enrichLoading || checkedProposals.length === 0}
                                className="px-3 py-1.5 rounded-md bg-dj-success hover:bg-dj-success/80 disabled:bg-dj-success/40 text-dj-on-accent text-xs font-medium transition"
                                title="Write checked proposals to DB canonical fields (never source files). Artwork fills empty slots only."
                              >
                                {enrichLoading
                                  ? "Applying…"
                                  : `Apply checked (${checkedProposals.length})`}
                              </button>
                              <button
                                onClick={runEnrichmentUndo}
                                disabled={enrichLoading}
                                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-dj-elevated hover:bg-dj-hover text-dj-text-secondary border border-dj-border text-xs transition"
                                title="Restore this run's before-state snapshot"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                <span>Undo run</span>
                              </button>
                            </div>
                          </div>
                        )}
                        {preview && preview.proposals.length === 0 && (
                          <p className="text-xs text-dj-text-muted mt-3">
                            No new proposals from {preview.provider}
                            {preview.skipped > 0 ? ` (${preview.skipped} skipped)` : ""}.
                          </p>
                        )}
                        {health.totals.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {health.totals.map((total) => (
                              <div key={total.field} className="flex items-center gap-2 text-xs">
                                <span className="w-24 shrink-0 text-dj-text-secondary">
                                  {formatMissingField(total.field)}
                                </span>
                                <div className="flex-1 h-1.5 rounded-full bg-dj-elevated overflow-hidden">
                                  <div
                                    className="h-1.5 rounded-full bg-dj-warning"
                                    style={{
                                      width: `${health.checked ? Math.round((total.missingCount / health.checked) * 100) : 0}%`,
                                    }}
                                  />
                                </div>
                                <span className="w-10 text-right font-mono text-dj-text-secondary">
                                  {total.missingCount}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {health.gaps.length > 0 && (
                          <div className="mt-4">
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-dj-text-muted">
                              Tracks with gaps (first {health.gaps.length})
                            </p>
                            <ul className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                              {health.gaps.map((gap) => (
                                <li
                                  key={gap.trackId}
                                  className="p-2 rounded-md bg-dj-elevated border border-dj-border text-xs"
                                >
                                  <p className="text-dj-text truncate">
                                    {gap.title || "Untitled"} — {gap.artist || "Unknown Artist"}
                                    <span
                                      className="ml-2 font-mono text-[11px] text-dj-text-secondary"
                                      title="Tag Health Score 0–100"
                                    >
                                      {Math.round(gap.score)}
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-dj-warning/90 mt-0.5">
                                    {gap.missing.map(formatMissingField).join(", ")}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </ModalShell>
              )}

              {/* Charts modal: versioned snapshots with taste filtering (TD.3) */}
              {chartsOpen && (
                <ModalShell
                  onClose={() => setChartsOpen(false)}
                  ariaLabel="Charts — snapshots, filtered by taste"
                  panelClassName="w-[620px] max-w-full max-h-full overflow-y-auto bg-dj-panel border border-dj-border rounded-lg shadow-2xl"
                >
                  <div className="p-4 border-b border-dj-border flex items-center justify-between">
                    <p className="text-sm font-semibold text-dj-text flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-dj-accent" />
                      <span>Charts — snapshots, filtered by taste</span>
                    </p>
                    <button
                      onClick={() => setChartsOpen(false)}
                      className="p-1.5 rounded-md hover:bg-dj-hover text-dj-text-secondary transition"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <select
                        value={chartKind}
                        onChange={(e) => {
                          setChartKind(e.target.value);
                          loadCharts(chartGenre, e.target.value, matchToInspected);
                        }}
                        className="bg-dj-elevated border border-dj-border rounded-md px-2 py-1.5 text-dj-text"
                        title="Beatport chart"
                      >
                        <option value="top100">Top 100</option>
                        <option value="hype">Hype Top 100</option>
                      </select>
                      <select
                        value={chartGenre}
                        onChange={(e) => {
                          setChartGenre(e.target.value);
                          loadCharts(e.target.value, chartKind, matchToInspected);
                        }}
                        className="bg-dj-elevated border border-dj-border rounded-md px-2 py-1.5 text-dj-text"
                        title="Genre"
                      >
                        {[
                          "techno",
                          "house",
                          "tech-house",
                          "melodic-house-techno",
                          "deep-house",
                          "minimal-deep-tech",
                          "progressive-house",
                          "trance",
                          "drum-and-bass",
                        ].map((genre) => (
                          <option key={genre} value={genre}>
                            {genre}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 text-dj-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={matchToInspected}
                          onChange={(e) => {
                            setMatchToInspected(e.target.checked);
                            loadCharts(chartGenre, chartKind, e.target.checked);
                          }}
                          className="accent-dj-accent"
                        />
                        Taste-match to the inspected track
                      </label>
                      <button
                        onClick={() => loadCharts()}
                        disabled={chartLoading}
                        className="px-2.5 py-1.5 rounded-md bg-dj-elevated hover:bg-dj-hover text-dj-text-secondary border border-dj-border transition"
                      >
                        Refresh
                      </button>
                    </div>
                    <p className="text-[11px] text-dj-text-muted mt-2">
                      Versioned snapshot data — Beatport exposes no public catalog API. Ownership is
                      ISRC-exact; taste is 60% tempo / 40% key vs the inspected track.
                    </p>
                    {chartLoading ? (
                      <p className="text-xs text-dj-text-muted mt-3">Loading snapshot…</p>
                    ) : chartError ? (
                      <div className="mt-3">
                        <p className="text-xs text-dj-text-secondary">{chartError}</p>
                        <button
                          onClick={loadSampleSnapshot}
                          disabled={chartLoading}
                          className="mt-2 px-2.5 py-1.5 rounded-md bg-dj-accent hover:bg-dj-accent-strong disabled:bg-dj-active text-dj-on-accent text-xs font-medium transition"
                          title="Imports 3 clearly-marked synthetic entries (demo format reference)"
                        >
                          Load sample snapshot
                        </button>
                        <p className="text-[11px] text-dj-text-muted mt-2">
                          Import format reference:{" "}
                          <span className="font-mono">fixtures/charts/*.SAMPLE.json</span>
                        </p>
                      </div>
                    ) : (
                      chartData && (
                        <div className="mt-3">
                          <p className="text-[11px] uppercase tracking-wider font-semibold text-dj-text-muted">
                            {chartData.provider} {chartData.chart} · {chartData.genre} ·{" "}
                            {chartData.snapshotDate} ({chartData.total})
                          </p>
                          <ul className="mt-2 space-y-1.5 max-h-80 overflow-y-auto">
                            {chartData.entries.map((entry) => (
                              <li
                                key={entry.position}
                                className="p-2 rounded-md bg-dj-elevated border border-dj-border text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-7 shrink-0 font-mono text-dj-text-muted">
                                    {entry.position}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-dj-text">
                                    {entry.title} — {entry.artist}
                                  </span>
                                  {entry.owned && (
                                    <span
                                      className="shrink-0 px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-dj-success/10 text-dj-success border border-dj-success/20"
                                      title="ISRC matches a library track"
                                    >
                                      owned
                                    </span>
                                  )}
                                  {entry.tasteScore != null && (
                                    <span
                                      className="shrink-0 font-mono text-[11px] text-dj-accent"
                                      title="Taste match vs the inspected track"
                                    >
                                      {formatScore(entry.tasteScore)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-dj-text-muted mt-0.5 ml-9">
                                  {entry.label ?? "Unknown label"} · {formatBpm(entry.bpm)} ·{" "}
                                  {formatKey(entry.keyCamelot, null)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    )}
                  </div>
                </ModalShell>
              )}
            </>
          ) : ui.view === "playlists" ? (
            <ViewPlaceholder
              icon={ListMusic}
              title="Playlists"
              description="Build and save sets, then score them with Set Score. Playlist editing, save recovery and Set Score arrive in Stage 5."
              options={["Playlist Tracks", "Set Score", "Set Check"]}
              onGoToLibrary={() => handleViewChange("library")}
            />
          ) : ui.view === "discover" ? (
            <ViewPlaceholder
              icon={Compass}
              title="Discover"
              description="Local-first recommendations and free downloads from Bandcamp, SoundCloud and label promos. Discover arrives in Stage 7; downloads land in the Inbox for review."
              options={["Recommendations", "Free downloads", "Watchlist"]}
              onGoToLibrary={() => handleViewChange("library")}
            />
          ) : ui.view === "statistics" ? (
            <ViewPlaceholder
              icon={BarChart3}
              title="Statistics"
              description="Whole-library statistics with drill-down. Date ranges apply only to Play History and Additions. Statistics arrives in Stage 8."
              options={["Overview", "Play History", "Additions"]}
              onGoToLibrary={() => handleViewChange("library")}
            />
          ) : ui.view === "publish" ? (
            <ViewPlaceholder
              icon={Usb}
              title="Publish"
              description="Export to USB and DJ applications. rekordbox sync arrives in Stage 9; playlist-only USB export in Stage 11. OneLibrary stays experimental until certified."
              options={["rekordbox", "Traktor", "USB export"]}
              onGoToLibrary={() => handleViewChange("library")}
            />
          ) : ui.view === "inbox" ? (
            <InboxEmptyState onGoToLibrary={() => handleViewChange("library")} />
          ) : ui.view === "settings" ? (
            <SettingsView
              theme={ui.theme}
              navCollapsed={ui.navCollapsed}
              playerVisible={ui.playerMode !== "hidden"}
              onCycleTheme={() => dispatch({ type: "setTheme", theme: nextTheme(ui.theme) })}
              onToggleNav={() => dispatch({ type: "toggleNav" })}
              onTogglePlayer={() => dispatch({ type: "togglePlayer" })}
              onOpenImport={() => handleViewChange("import")}
              onOpenAnalysis={() => handleViewChange("analysis")}
              onOpenBackup={() => handleViewChange("backup")}
              onOpenSync={() => handleViewChange("sync")}
              onOpenStudio={() => handleViewChange("studio")}
            />
          ) : ui.view === "analysis" ? (
            <ViewPlaceholder
              icon={Activity}
              title="Analysis queue"
              description="Pending, running and failed analysis jobs. This queue is part of the import pipeline and moves into Import Center in Stage 3."
              onGoToLibrary={() => handleViewChange("library")}
            />
          ) : ui.view === "studio" ? (
            <ViewPlaceholder
              icon={Play}
              title="Studio"
              body="Two or four channel mix with timeline and grid. Automation for BPM, Filter, Hi, Mid, Low, Volume and Gain."
              actions={[
                { label: "New mix", title: "New mix project — planned" },
                { label: "Timeline", title: "Timeline with grid — planned" },
                { label: "Automation", title: "BPM, Filter, Hi/Mid/Low, Volume/Gain — planned" },
              ]}
              onGoToLibrary={() => dispatch({ type: "setView", view: "library" })}
            />
          ) : ui.view === "backup" ? (
            <ViewPlaceholder
              title="Backup"
              description="Back up your library to cloud storage or backup USB storage."
              onGoToLibrary={() => dispatch({ type: "setView", view: "library" })}
            />
          ) : ui.view === "sync" ? (
            <ViewPlaceholder
              title="Sync"
              description="Sync your library with Traktor, rekordbox, Serato, Virtual DJ, and other DJ applications."
              onGoToLibrary={() => dispatch({ type: "setView", view: "library" })}
            />
          ) : (
            <ViewPlaceholder
              title="View not found"
              description="This view is not implemented yet."
            />
          )}

          {/* The shared Track panel overlays whichever view is current — a
              player track can be inspected without leaving Studio, and the
              panel always describes the inspected track, never the playing one. */}
          {inspectedTrack && (
            <TrackPanel
              track={inspectedTrack}
              targetCount={editTargets(inspectedTrack).length}
              refreshToken={reloadToken}
              onClose={closeTrackPanel}
              onPlay={handlePlayTrack}
              onRate={handleSetRating}
              onSetEnergy={handleSetEnergy}
              onEditMetadata={openMetadataEditor}
              onSelectTrack={(track) => openTrackPanel(track)}
              onSelectTag={handleFilterByTag}
            />
          )}
        </main>
      </div>

      {contextMenu && (
        <RowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          trackTitle={contextMenu.track.title || "Untitled"}
          onEditTags={() => openMetadataEditor(contextMenu.track)}
          onClose={() => setContextMenu(null)}
          restoreFocus={() => contextRowRef.current?.focus()}
        />
      )}

      {editorTrack && (
        <MetadataEditor
          track={editorTrack}
          targetCount={selection.includes(editorTrack.id) ? selection.length : 1}
          onSave={handleSaveMetadata}
          onClose={() => setEditorTrack(null)}
        />
      )}

      {ui.playerMode !== "hidden" && (
        <PreviewPlayer
          mode={ui.playerMode}
          track={playingTrack}
          onModeChange={(mode) => dispatch({ type: "setPlayerMode", mode })}
          onHide={() => dispatch({ type: "setPlayerMode", mode: "hidden" })}
          onInspectTrack={openTrackPanel}
          activeView={ui.view}
          isDarkTheme={resolveTheme(ui.theme, systemPrefersDark) === "dark"}
        />
      )}
    </div>
  );
}
