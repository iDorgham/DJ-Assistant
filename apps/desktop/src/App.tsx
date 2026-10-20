import { useEffect, useRef, useState, useMemo, useReducer } from "react";
import type {
  TrackSummary,
  ScanProgressEvent,
  ScanCompletedEvent,
  AnalysisProgressEvent,
  AnalysisCompletedEvent,
  SimilarTrackResult,
  StoreLinksResponse,
  TagHealthResponse,
  ProviderStatusResponse,
  EnrichmentPreviewResponse,
  EnrichmentProgressEvent,
  EnrichmentProviderKind,
  ProviderTrackMatch,
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
  getArtwork,
  analyzeLibrary,
  listenToAnalysisProgress,
  listenToAnalysisCompleted,
  findSimilarTracks,
  trackTagHealth,
  storeLinksForTrack,
  providerStatus,
  enrichmentPreview,
  enrichmentApply,
  enrichmentUndo,
  listenToEnrichmentProgress,
  providerMatchTracks,
  chartImportSnapshot,
  chartList,
  listenToScanProgress,
  listenToScanCompleted,
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
  Sparkles,
  ExternalLink,
  Copy,
  Check,
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
  type LucideIcon,
} from "lucide-react";
import {
  ANALYSIS_STATUS_OPTIONS,
  CAMELOT_KEYS,
  activeFilterCount,
  defaultSortDirection,
  describeFilters,
  filterTracks,
  formatBpm,
  formatDuration,
  formatKey,
  formatRating,
  formatScore,
  formatMissingField,
  hasFilterValue,
  normalizeFilters,
  scanPercent,
  shortHash,
  toggleFilterValue,
  truncateComment,
} from "./lib/library";
import {
  DEFAULT_UI_STATE,
  initUiState,
  persistUiState,
  reduceUiState,
  shortcutToAction,
  type AppView,
} from "./lib/ui-state";
import { nextTheme, resolveTheme, THEME_LABELS } from "./lib/theme";
import { PreviewPlayer } from "./components/preview-player";
import { ModalShell } from "./components/ModalShell";
import { previewEngine } from "./lib/audio-engine";

const VIEW_ITEMS: { view: AppView; label: string; shortcut: string }[] = [
  { view: "import", label: "Import", shortcut: "1" },
  { view: "library", label: "Library", shortcut: "2" },
  { view: "analysis", label: "Analysis", shortcut: "3" },
  { view: "studio", label: "Studio", shortcut: "4" },
  { view: "backup", label: "Backup", shortcut: "5" },
  { view: "sync", label: "Sync", shortcut: "6" },
];

const NAV_ITEMS: { label: string; icon: LucideIcon; view: AppView }[] = [
  { label: "Library", icon: Library, view: "library" },
  { label: "Studio", icon: Play, view: "studio" },
];

/**
 * Roadmap items are shown as a read-only strip, not disabled buttons — they
 * are planned surfaces, not broken controls (docs/ui/02: no dead ends).
 */
const ROADMAP_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: "Playlists", icon: ListMusic },
  { label: "Browser", icon: FolderTree },
  { label: "Flash / USB", icon: Usb },
  { label: "Skills", icon: Sparkles },
];

/** User-facing failure detail — never surface raw serialized errors. */
const errorDetail = (err: unknown): string =>
  err instanceof Error && err.message ? err.message : "unexpected error";

const THEME_ICONS = { dark: Moon, light: Sun, system: Monitor } as const;

/** Real analysis state per track — never render a hardcoded success badge. */
const ANALYSIS_STATUS_CHIP: Record<
  TrackSummary["analysisStatus"],
  { label: string; icon: LucideIcon; className: string }
> = {
  complete: {
    label: "Analyzed",
    icon: CheckCircle2,
    className: "bg-dj-success/10 text-dj-success border border-dj-success/20",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-dj-accent/10 text-dj-accent border border-dj-accent/20",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-dj-danger/10 text-dj-danger border border-dj-danger/20",
  },
  needs_review: {
    label: "Needs review",
    icon: AlertTriangle,
    className: "bg-dj-warning/10 text-dj-warning border border-dj-warning/20",
  },
};

/**
 * Lazily loads one track's cached cover art and falls back to a placeholder
 * icon while loading, for missing art, or when the cache read fails.
 */
function ArtworkThumb({
  trackId,
  hasArtwork,
  large = false,
}: {
  trackId: string;
  hasArtwork: boolean;
  large?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasArtwork) {
      setSrc(null);
      return;
    }
    getArtwork({ trackId })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch((err) => {
        console.error("Failed to load artwork:", err);
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [trackId, hasArtwork]);

  if (!src) {
    return (
      <div
        className={
          large
            ? "h-20 w-20 rounded-md bg-dj-elevated border border-dj-border flex items-center justify-center"
            : "h-9 w-9 rounded-sm bg-dj-elevated border border-dj-border flex items-center justify-center"
        }
        title={hasArtwork ? "Loading artwork..." : "No embedded artwork"}
      >
        <Music className={large ? "w-8 h-8 text-dj-text-muted" : "w-4 h-4 text-dj-text-muted"} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={
        large
          ? "h-20 w-20 rounded-md object-cover border border-dj-border"
          : "h-9 w-9 rounded-sm object-cover border border-dj-border"
      }
    />
  );
}

/**
 * Column header that sorts the library server-side (T2.1.2). The active column
 * shows an up/down arrow; inactive ones a muted double arrow.
 */
function SortHeader({
  label,
  sortKey,
  sortBy,
  sortDir,
  onSort,
  className = "",
  align = "text-left",
  title,
}: {
  label: string;
  sortKey: ListTracksSortBy;
  sortBy?: ListTracksSortBy;
  sortDir: SortDirection;
  onSort: (key: ListTracksSortBy) => void;
  className?: string;
  align?: string;
  title?: string;
}) {
  const active = sortBy === sortKey;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th className={`py-2.5 px-4 ${className}`} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={title ?? `Sort by ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 uppercase tracking-wider text-[11px] font-semibold transition ${
          active ? "text-dj-accent" : "text-dj-text-secondary hover:text-dj-text"
        } ${align === "text-center" ? "justify-center w-full" : ""}`}
      >
        <span>{label}</span>
        <Icon className={`w-3 h-3 ${active ? "text-dj-accent" : "text-dj-text-muted"}`} />
      </button>
    </th>
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
          target.isContentEditable)
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
  // Paginated fetch: start at 200, extend with Load more (libraryTotal bounds it).
  const [visibleLimit, setVisibleLimit] = useState(200);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryTotal, setLibraryTotal] = useState(0);

  // Library filters + sorting (T2.1.2). Applied server-side in SQL so the view
  // stays correct past the 200-row page instead of filtering a partial window.
  const [filters, setFilters] = useState<ListTracksFilters>({});
  const [draftFilters, setDraftFilters] = useState<ListTracksFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [genres, setGenres] = useState<GenreCount[]>([]);
  const [sortBy, setSortBy] = useState<ListTracksSortBy | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
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
  const [selectedTrack, setSelectedTrack] = useState<TrackSummary | null>(null);
  const [similar, setSimilar] = useState<SimilarTrackResult[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [storeLinks, setStoreLinks] = useState<StoreLinksResponse | null>(null);
  const [similarError, setSimilarError] = useState(false);
  const [storeLinksError, setStoreLinksError] = useState(false);
  const [drawerRetry, setDrawerRetry] = useState(0);
  const [selectedGaps, setSelectedGaps] = useState<string[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
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

  // Deezer catalog match for the inspected track (TX.2: live reads, no writes).
  const [deezerMatch, setDeezerMatch] = useState<ProviderTrackMatch | null>(null);
  const [deezerLoading, setDeezerLoading] = useState(false);

  // Chart snapshots Tier 1 (TD.3): versioned data with local taste filtering.
  const [chartsOpen, setChartsOpen] = useState(false);
  dialogsOpenRef.current = healthOpen || chartsOpen;
  const [chartGenre, setChartGenre] = useState("techno");
  const [chartKind, setChartKind] = useState("top100");
  const [chartData, setChartData] = useState<ChartListResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [matchToSelected, setMatchToSelected] = useState(true);

  // Load tracks — re-runs whenever the applied filters or sort order change, or
  // when something bumps `reloadToken` (refresh button, scan/analysis finish).
  // The search box filters this server-filtered page client-side, so typing
  // stays instant and never adds IPC churn.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTracks({
      filters: normalizeFilters(filters),
      sortBy,
      sortDir: sortBy ? sortDir : undefined,
      limit: visibleLimit,
    })
      .then((res) => {
        if (cancelled) return;
        setTracks(res.tracks);
        setLibraryTotal(res.total);
        pushStatus(`Library loaded: ${res.total} track${res.total === 1 ? "" : "s"}`);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load library tracks:", err);
        pushStatus("Couldn't load tracks — check the backend, then reload", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only the applied view state drives the fetch; the loader helpers are pure.
  }, [filters, sortBy, sortDir, reloadToken, visibleLimit]);

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

  const openFilters = () => {
    setDraftFilters(filters);
    setFilterError(null);
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

  // Selection drawer data: similar tracks, store buy-links, and this track's
  // tag gaps. All local reads; online enrichment is a planned follow-up.
  useEffect(() => {
    if (!selectedTrack) {
      setSimilar([]);
      setStoreLinks(null);
      setSelectedGaps([]);
      setDeezerMatch(null);
      return;
    }
    let cancelled = false;
    const trackId = selectedTrack.id;
    setSimilarLoading(true);
    setSimilarError(false);
    setStoreLinksError(false);
    setDeezerMatch(null);
    findSimilarTracks({ trackId, limit: 8 })
      .then((res) => {
        if (!cancelled) setSimilar(res.results);
      })
      .catch((err) => {
        console.error("Failed to load similar tracks:", err);
        if (!cancelled) {
          setSimilar([]);
          setSimilarError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setSimilarLoading(false);
      });
    storeLinksForTrack({ trackId })
      .then((res) => {
        if (!cancelled) setStoreLinks(res);
      })
      .catch((err) => {
        console.error("Failed to load store links:", err);
        if (!cancelled) {
          setStoreLinks(null);
          setStoreLinksError(true);
        }
      });
    trackTagHealth({ trackIds: [trackId], limit: 1 })
      .then((res) => {
        if (!cancelled) setSelectedGaps(res.gaps[0]?.missing ?? []);
      })
      .catch((err) => {
        console.error("Failed to load tag gaps:", err);
        if (!cancelled) setSelectedGaps([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTrack, drawerRetry]);

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

  const copyStoreUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => {
        setCopiedUrl((current) => (current === url ? null : current));
      }, 1500);
    } catch (err) {
      console.error("Failed to copy store URL:", err);
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

  const runDeezerMatch = async () => {
    if (!selectedTrack) return;
    setDeezerLoading(true);
    setDeezerMatch(null);
    try {
      const res = await providerMatchTracks({ provider: "deezer", trackIds: [selectedTrack.id] });
      setDeezerMatch(res.matches[0] ?? null);
    } catch (err) {
      console.error("Deezer match failed:", err);
    } finally {
      setDeezerLoading(false);
    }
  };

  const loadCharts = async (
    genre: string = chartGenre,
    chart: string = chartKind,
    useSelected: boolean = matchToSelected
  ) => {
    setChartLoading(true);
    setChartError(null);
    try {
      setChartData(
        await chartList({
          provider: "beatport",
          chart,
          genre,
          seedTrackId: useSelected ? (selectedTrack?.id ?? undefined) : undefined,
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

  // Esc closes the inspector drawer, the Tag Health/Charts modals and the
  // filter dropdown.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTrack(null);
        setHealthOpen(false);
        setChartsOpen(false);
        setFiltersOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const filterCount = activeFilterCount(filters);
  const filterSummary = describeFilters(filters);
  // True when the (server-side) page behind `filteredTracks` is narrowed either by
  // the filter panel or by the live search box; used to tell "no tracks" apart
  // from "no matches for the current query".
  const pageIsFiltered = filterCount > 0 || searchQuery.trim().length > 0;

  const ThemeIcon = THEME_ICONS[ui.theme];

  return (
    <div className="relative flex h-screen flex-col bg-dj-bg font-sans text-dj-text">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-dj-border bg-dj-panel px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-linear-to-tr from-dj-accent-strong to-dj-accent shadow-sm shadow-dj-accent/20">
            <Disc3 className="h-3.5 w-3.5 text-dj-on-accent" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight text-dj-text">
            DJ Assistant
          </span>
        </div>

        <nav
          aria-label="Views"
          className="ml-2 flex items-center gap-0.5 rounded-md border border-dj-border bg-dj-bg p-0.5"
        >
          {VIEW_ITEMS.map((item) => (
            <button
              key={item.view}
              type="button"
              onClick={() => handleViewChange(item.view)}
              aria-pressed={ui.view === item.view}
              title={`${item.label} (Ctrl/Cmd+${item.shortcut})`}
              className={`rounded-sm px-2.5 py-1 text-xs font-medium transition ${
                ui.view === item.view
                  ? "bg-dj-active text-dj-text"
                  : "text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

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
                  onClick={() => dispatch({ type: "setView", view: item.view })}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                    active
                      ? "bg-dj-active font-medium text-dj-text"
                      : "text-dj-text-secondary hover:bg-dj-hover hover:text-dj-text"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!ui.navCollapsed && (
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Roadmap strip: planned surfaces, honestly labeled and read-only */}
          <div className="border-t border-dj-border space-y-0.5 p-2">
            {!ui.navCollapsed && (
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-dj-text-muted">
                Roadmap
              </p>
            )}
            {ROADMAP_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  title={`${item.label} — planned, not available yet`}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-dj-text-secondary"
                >
                  <Icon className="h-4 w-4 shrink-0 text-dj-text-muted" />
                  {!ui.navCollapsed && (
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  )}
                </div>
              );
            })}
          </div>
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

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {ui.view === "import" ? (
            <ViewPlaceholder
              title="Import"
              description="Ingest new downloaded tracks, validate tags, assess quality, rate, comment, and tag before importing them into your library."
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
                        key={part}
                        className="px-2 py-0.5 rounded-sm bg-dj-accent/10 text-dj-accent border border-dj-accent/20 font-mono"
                      >
                        {part}
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

                {/* Track List Table */}
                <div className="flex-1 overflow-auto">
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
                    <table className="w-full min-w-[1200px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-dj-border bg-dj-panel text-dj-text-secondary uppercase tracking-wider text-[11px] font-semibold sticky top-0 z-10">
                          <SortHeader
                            label="#"
                            sortKey="imported_at"
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            className="w-12 text-center"
                            align="text-center"
                            title="Sort by import order (newest first by default)"
                          />
                          <th className="py-2.5 px-2 w-14 text-center">Art</th>
                          <SortHeader
                            label="Title"
                            sortKey="title"
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={toggleSort}
                          />
                          <SortHeader
                            label="Artist"
                            sortKey="artist"
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={toggleSort}
                          />
                          <th className="py-2.5 px-4">Album</th>
                          <SortHeader
                            label="BPM"
                            sortKey="bpm"
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            className="w-16 text-center"
                            align="text-center"
                          />
                          <SortHeader
                            label="Key"
                            sortKey="key"
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            className="w-16 text-center"
                            align="text-center"
                          />
                          <th className="py-2.5 px-4 w-24 text-center">Rating</th>
                          <SortHeader
                            label="Time"
                            sortKey="duration"
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            className="w-20 text-center"
                            align="text-center"
                            title="Sort by duration"
                          />
                          <th className="py-2.5 px-4 w-20 text-center">Format</th>
                          <th className="py-2.5 px-4">Comments</th>
                          <th className="py-2.5 px-4 w-28 text-center">Fingerprint</th>
                          <th className="py-2.5 px-4 w-28 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dj-border">
                        {filteredTracks.map((track, idx) => (
                          <tr
                            key={track.id}
                            tabIndex={0}
                            aria-label={`Inspect ${track.title || "Untitled"} by ${track.artist || "Unknown Artist"}`}
                            aria-selected={selectedTrack?.id === track.id}
                            onClick={() =>
                              setSelectedTrack((current) =>
                                current?.id === track.id ? null : track
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedTrack((current) =>
                                  current?.id === track.id ? null : track
                                );
                              }
                            }}
                            title="Click or press Enter to inspect: similar tracks, tag gaps, buy-links"
                            className={`hover:bg-dj-hover transition duration-150 group cursor-pointer focus-visible:outline-2 focus-visible:outline-dj-accent focus-visible:-outline-offset-2 ${
                              selectedTrack?.id === track.id ? "bg-dj-active" : ""
                            }`}
                          >
                            <td className="py-2.5 px-4 text-center text-dj-text-muted font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2">
                              <ArtworkThumb trackId={track.id} hasArtwork={!!track.artworkHash} />
                            </td>
                            <td
                              className="py-2.5 px-4 font-medium text-dj-text group-hover:text-dj-accent transition max-w-[300px] truncate"
                              title={track.title || "Untitled"}
                            >
                              {track.title || "Untitled"}
                            </td>
                            <td
                              className="py-2.5 px-4 text-dj-text-secondary max-w-[220px] truncate"
                              title={track.artist || "Unknown Artist"}
                            >
                              {track.artist || "Unknown Artist"}
                            </td>
                            <td className="py-2.5 px-4 text-dj-text-secondary">
                              {track.album || "—"}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono text-dj-text-secondary">
                              {formatBpm(track.bpm)}
                            </td>
                            <td
                              className="py-2.5 px-4 text-center font-mono text-dj-text-secondary"
                              title={
                                track.keyClassical && track.keyCamelot
                                  ? `Camelot ${track.keyCamelot} • ${track.keyClassical}`
                                  : undefined
                              }
                            >
                              {formatKey(track.keyCamelot, track.keyClassical)}
                            </td>
                            <td
                              className="py-2.5 px-4 text-center text-dj-warning tracking-tight"
                              title={
                                track.userRating != null ? `${track.userRating} / 5` : "Unrated"
                              }
                            >
                              {formatRating(track.userRating)}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono text-dj-text-secondary">
                              {formatDuration(track.durationMs)}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="px-1.5 py-0.5 rounded-sm text-[11px] uppercase font-mono bg-dj-overlay text-dj-text-secondary border border-dj-border">
                                {track.format || "AUDIO"}
                              </span>
                            </td>
                            <td
                              className="py-2.5 px-4 text-dj-text-secondary italic"
                              title={track.comments ?? undefined}
                            >
                              {truncateComment(track.comments, 48)}
                            </td>
                            <td
                              className="py-2.5 px-4 text-center font-mono text-[11px] text-dj-text-secondary"
                              title={track.fileHash}
                            >
                              {shortHash(track.fileHash)}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              {(() => {
                                const chip =
                                  ANALYSIS_STATUS_CHIP[track.analysisStatus] ??
                                  ANALYSIS_STATUS_CHIP.pending;
                                const StatusIcon = chip.icon;
                                return (
                                  <span
                                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[11px] font-medium border ${chip.className}`}
                                    title={`Analysis status: ${chip.label}`}
                                  >
                                    <StatusIcon className="w-3 h-3" />
                                    <span>{chip.label}</span>
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination: honest "there is more" affordance past the first page */}
                {tracks.length > 0 && tracks.length < libraryTotal && (
                  <div className="shrink-0 border-t border-dj-border bg-dj-panel px-3 py-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((n) => n + 200)}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-md border border-dj-border bg-dj-elevated px-3 py-1.5 text-xs text-dj-text-secondary transition hover:bg-dj-hover hover:text-dj-text disabled:opacity-50"
                    >
                      Load more — showing {tracks.length} of {libraryTotal}
                    </button>
                  </div>
                )}
              </div>

              {/* Track inspector drawer: similar tracks, tag gaps, buy-links */}
              {selectedTrack && (
                <aside className="absolute inset-y-0 right-0 w-[380px] max-w-[92vw] bg-dj-panel border-l border-dj-border overflow-y-auto shadow-2xl z-20">
                  <div className="p-4 border-b border-dj-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start space-x-3 min-w-0">
                        <ArtworkThumb
                          trackId={selectedTrack.id}
                          hasArtwork={!!selectedTrack.artworkHash}
                          large
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-dj-text truncate">
                            {selectedTrack.title || "Untitled"}
                          </p>
                          <p className="text-xs text-dj-text-secondary truncate">
                            {selectedTrack.artist || "Unknown Artist"}
                          </p>
                          <p className="text-[11px] text-dj-text-muted font-mono mt-1">
                            {formatBpm(selectedTrack.bpm)} ·{" "}
                            {formatKey(selectedTrack.keyCamelot, selectedTrack.keyClassical)} ·{" "}
                            {formatDuration(selectedTrack.durationMs)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedTrack(null)}
                        className="p-1.5 rounded-md hover:bg-dj-hover text-dj-text-secondary transition"
                        title="Close inspector (Esc)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {selectedGaps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {selectedGaps.map((field) => (
                          <span
                            key={field}
                            className="px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-dj-warning/10 text-dj-warning border border-dj-warning/20"
                            title="Missing locally — online lookup (MusicBrainz / iTunes / Deezer) is planned and opt-in"
                          >
                            missing: {formatMissingField(field)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-b border-dj-border">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-dj-text-secondary flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-dj-accent" />
                      <span>Similar tracks (local mix-compatibility)</span>
                    </p>
                    {similarLoading ? (
                      <p className="text-xs text-dj-text-muted mt-2">Scoring library…</p>
                    ) : similarError ? (
                      <p className="text-xs text-dj-danger mt-2">
                        Couldn't score similar tracks.{" "}
                        <button
                          type="button"
                          onClick={() => setDrawerRetry((n) => n + 1)}
                          className="rounded px-1 text-dj-accent underline underline-offset-2 hover:bg-dj-hover transition"
                        >
                          Retry
                        </button>
                      </p>
                    ) : similar.length === 0 ? (
                      <p className="text-xs text-dj-text-muted mt-2">
                        No comparable tracks yet — import more music with BPM and key tags.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {similar.map((result) => (
                          <li key={result.id}>
                            <button
                              onClick={() => {
                                const next = tracks.find((t) => t.id === result.id);
                                if (next) setSelectedTrack(next);
                              }}
                              className="w-full text-left p-2 rounded-md bg-dj-elevated hover:bg-dj-elevated border border-dj-border transition"
                              title={result.reasons.join(" · ")}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-dj-text truncate">
                                  {result.title || "Untitled"}
                                </span>
                                <span className="text-[11px] font-mono text-dj-accent shrink-0">
                                  {formatScore(result.score)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <span className="text-[11px] text-dj-text-muted truncate">
                                  {result.artist || "Unknown Artist"}
                                </span>
                                <span className="text-[11px] font-mono text-dj-text-muted shrink-0">
                                  {formatBpm(result.bpm)} ·{" "}
                                  {formatKey(result.keyCamelot, result.keyClassical)}
                                </span>
                              </div>
                              {result.reasons.length > 0 && (
                                <p className="text-[11px] text-dj-text-muted mt-1 truncate">
                                  {result.reasons.join(" · ")}
                                </p>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="p-4">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-dj-text-secondary flex items-center space-x-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-dj-success" />
                      <span>Find to buy (metadata links only)</span>
                    </p>
                    {storeLinksError ? (
                      <p className="text-xs text-dj-danger mt-2">
                        Couldn't load store links.{" "}
                        <button
                          type="button"
                          onClick={() => setDrawerRetry((n) => n + 1)}
                          className="rounded px-1 text-dj-accent underline underline-offset-2 hover:bg-dj-hover transition"
                        >
                          Retry
                        </button>
                      </p>
                    ) : !storeLinks || storeLinks.links.length === 0 ? (
                      <p className="text-xs text-dj-text-muted mt-2">
                        No store links for this track.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {storeLinks.links.map((link) => (
                          <li
                            key={link.provider}
                            className="flex items-center justify-between gap-2 p-2 rounded-md bg-dj-elevated border border-dj-border"
                          >
                            <span className="text-xs text-dj-text-secondary">{link.label}</span>
                            <button
                              onClick={() => copyStoreUrl(link.url)}
                              className="flex items-center space-x-1 px-2 py-1 rounded-sm text-[11px] bg-dj-overlay hover:bg-dj-hover text-dj-text-secondary border border-dj-border transition"
                              title={link.url}
                            >
                              {copiedUrl === link.url ? (
                                <Check className="w-3 h-3 text-dj-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>{copiedUrl === link.url ? "Copied" : "Copy link"}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] text-dj-text-muted mt-2">
                      Links open the store's own search page. No audio is fetched; Beatport charts
                      and release radar arrive as data integrations next.
                    </p>
                  </div>

                  <div className="p-4 border-t border-dj-border">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-dj-text-secondary flex items-center space-x-1.5">
                      <PlugZap className="w-3.5 h-3.5 text-dj-accent" />
                      <span>Match on Deezer (live read, no key)</span>
                    </p>
                    {!deezerMatch && !deezerLoading && (
                      <button
                        onClick={runDeezerMatch}
                        className="mt-2 px-2.5 py-1.5 rounded-md bg-dj-elevated hover:bg-dj-hover text-dj-text-secondary border border-dj-border text-xs transition"
                        title="ISRC-exact first, then fuzzy search. Writes nothing."
                      >
                        Match this track
                      </button>
                    )}
                    {deezerLoading && <p className="text-xs text-dj-text-muted mt-2">Matching…</p>}
                    {deezerMatch && (
                      <div className="mt-2 p-2 rounded-md bg-dj-elevated border border-dj-border text-xs">
                        {deezerMatch.providerId ? (
                          <>
                            <p className="text-dj-text truncate">
                              {deezerMatch.title} — {deezerMatch.artist}
                            </p>
                            <p className="text-[11px] text-dj-text-muted mt-0.5">
                              {deezerMatch.album ?? "Unknown release"} · {deezerMatch.status} ·{" "}
                              {formatScore(deezerMatch.confidence)}
                            </p>
                            {deezerMatch.sourceUrl && (
                              <button
                                onClick={() => copyStoreUrl(deezerMatch.sourceUrl!)}
                                className="mt-1.5 flex items-center space-x-1 px-2 py-1 rounded-sm text-[11px] bg-dj-overlay hover:bg-dj-hover text-dj-text-secondary border border-dj-border transition"
                                title={deezerMatch.sourceUrl}
                              >
                                {copiedUrl === deezerMatch.sourceUrl ? (
                                  <Check className="w-3 h-3 text-dj-success" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>
                                  {copiedUrl === deezerMatch.sourceUrl
                                    ? "Copied"
                                    : "Copy Deezer link"}
                                </span>
                              </button>
                            )}
                          </>
                        ) : (
                          <p className="text-dj-text-muted">No Deezer match for this track.</p>
                        )}
                        <p
                          className="text-[11px] text-dj-text-muted mt-1.5"
                          title="Playlist export needs a Deezer application ID (TX follow-up)"
                        >
                          Playlist export: needs a Deezer app ID — matching stays read-only.
                        </p>
                      </div>
                    )}
                  </div>
                </aside>
              )}

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
                          loadCharts(chartGenre, e.target.value, matchToSelected);
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
                          loadCharts(e.target.value, chartKind, matchToSelected);
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
                          checked={matchToSelected}
                          onChange={(e) => {
                            setMatchToSelected(e.target.checked);
                            loadCharts(chartGenre, chartKind, e.target.checked);
                          }}
                          className="accent-dj-accent"
                        />
                        Taste-match to selected track
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
                      ISRC-exact; taste is 60% tempo / 40% key vs the selected track.
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
                                      title="Taste match vs the selected track"
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
        </main>
      </div>

      {ui.playerMode !== "hidden" && (
        <PreviewPlayer
          mode={ui.playerMode}
          track={selectedTrack}
          onModeChange={(mode) => dispatch({ type: "setPlayerMode", mode })}
          onHide={() => dispatch({ type: "setPlayerMode", mode: "hidden" })}
          activeView={ui.view}
          isDarkTheme={resolveTheme(ui.theme, systemPrefersDark) === "dark"}
        />
      )}
    </div>
  );
}
