import { useEffect, useState, useMemo } from "react";
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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
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
            ? "h-20 w-20 rounded-md bg-[#1a1e2b] border border-[#2a2f42] flex items-center justify-center"
            : "h-9 w-9 rounded-sm bg-[#1a1e2b] border border-[#2a2f42] flex items-center justify-center"
        }
        title={hasArtwork ? "Loading artwork..." : "No embedded artwork"}
      >
        <Music className={large ? "w-8 h-8 text-slate-600" : "w-4 h-4 text-slate-600"} />
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
          ? "h-20 w-20 rounded-md object-cover border border-[#2a2f42]"
          : "h-9 w-9 rounded-sm object-cover border border-[#2a2f42]"
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
        className={`inline-flex items-center gap-1 uppercase tracking-wider text-[10px] font-semibold transition ${
          active ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
        } ${align === "text-center" ? "justify-center w-full" : ""}`}
      >
        <span>{label}</span>
        <Icon className={`w-3 h-3 ${active ? "text-blue-400" : "text-slate-600"}`} />
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
      className="absolute right-5 top-11 z-40 w-[430px] rounded-lg border border-[#2a2f42] bg-[#141721] shadow-2xl shadow-black/60"
    >
      <div className="flex items-center justify-between border-b border-[#222738] px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          <SlidersHorizontal className="h-3.5 w-3.5 text-blue-400" />
          <span>Library filters</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm p-1 text-slate-500 transition hover:bg-[#1e2230] hover:text-slate-200"
          title="Close filters"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[62vh] space-y-4 overflow-y-auto px-4 py-3">
        {/* BPM range */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
              className="w-full rounded-md border border-[#2a2f42] bg-[#1a1e2b] px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-hidden"
            />
            <span className="text-xs text-slate-600">to</span>
            <input
              type="number"
              min={0}
              max={400}
              step={1}
              value={draft.bpmMax ?? ""}
              onChange={(e) => onChange({ ...draft, bpmMax: numberOrUndefined(e.target.value) })}
              placeholder="Max"
              className="w-full rounded-md border border-[#2a2f42] bg-[#1a1e2b] px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Camelot keys */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                      ? "border-blue-500 bg-blue-500/15 text-blue-300"
                      : "border-[#2a2f42] bg-[#1a1e2b] text-slate-400 hover:border-[#3a4054] hover:text-slate-200"
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
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Analysis status
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {ANALYSIS_STATUS_OPTIONS.map((option) => {
              const checked = hasFilterValue(draft.analysisStatus, option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-[#2a2f42] bg-[#1a1e2b] px-2 py-1.5 text-[11px] text-slate-300 transition hover:border-[#3a4054]"
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
                    className="accent-blue-500"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* Genre */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Genre
          </p>
          {genres.length === 0 ? (
            <p className="text-[11px] text-slate-600">
              No genre tags in the library yet — scan a folder or clean tags first.
            </p>
          ) : (
            <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
              {genres.map((entry) => {
                const checked = hasFilterValue(draft.genre, entry.genre);
                return (
                  <label
                    key={entry.genre}
                    className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-[#2a2f42] bg-[#1a1e2b] px-2 py-1.5 text-[11px] text-slate-300 transition hover:border-[#3a4054]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange({ ...draft, genre: toggleFilterValue(draft.genre, entry.genre) })
                      }
                      className="accent-blue-500"
                    />
                    <span className="min-w-0 flex-1 truncate" title={entry.genre}>
                      {entry.genre}
                    </span>
                    <span className="font-mono text-[10px] text-slate-600">{entry.count}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Rating */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
            className="w-full rounded-md border border-[#2a2f42] bg-[#1a1e2b] px-2.5 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-hidden"
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
          <p className="rounded-sm border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300">
            {error}
          </p>
        )}

        <p className="text-[10px] leading-relaxed text-slate-600">
          Filters run locally against SQLite. Source files are never modified.
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-[#222738] px-4 py-2.5">
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-[#2a2f42] bg-[#1e2230] px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-[#252b3d]"
        >
          Reset all
        </button>
        <button
          type="button"
          onClick={onApply}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-blue-600/30 transition hover:bg-blue-500"
        >
          <Check className="h-3.5 w-3.5" />
          Apply filters
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
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

  // Analysis queue (T1.2.2): version-aware run with per-track progress events.
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgressEvent | null>(null);

  // Discovery / enrichment / provider state (local-first; online lookup is planned).
  const [selectedTrack, setSelectedTrack] = useState<TrackSummary | null>(null);
  const [similar, setSimilar] = useState<SimilarTrackResult[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [storeLinks, setStoreLinks] = useState<StoreLinksResponse | null>(null);
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
      limit: 200,
    })
      .then((res) => {
        if (cancelled) return;
        setTracks(res.tracks);
        setLibraryTotal(res.total);
        setStatusMessage(`Library loaded: ${res.total} track${res.total === 1 ? "" : "s"}`);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load library tracks:", err);
        setStatusMessage("Error loading tracks");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only the applied view state drives the fetch; the loader helpers are pure.
  }, [filters, sortBy, sortDir, reloadToken]);

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
    setSortBy(undefined);
    setSortDir("asc");
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
    setDeezerMatch(null);
    findSimilarTracks({ trackId, limit: 8 })
      .then((res) => {
        if (!cancelled) setSimilar(res.results);
      })
      .catch((err) => {
        console.error("Failed to load similar tracks:", err);
        if (!cancelled) setSimilar([]);
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
        if (!cancelled) setStoreLinks(null);
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
  }, [selectedTrack]);

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
      setApplyMessage(`Lookup failed: ${err}`);
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
      setApplyMessage(`Apply failed: ${err}`);
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
      setApplyMessage(`Undo failed: ${err}`);
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
      setChartError(`${err}`);
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
      setStatusMessage(`Chart snapshot imported: ${res.imported} entries, skipped ${res.skipped}`);
      await loadCharts();
    } catch (err) {
      console.error("Sample snapshot import failed:", err);
      setChartError(`${err}`);
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
      setStatusMessage(
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
      setStatusMessage(
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
    setStatusMessage(`Scanning folder: ${selected}...`);

    try {
      await scanFolder({ path: selected, recursive: true });
    } catch (err) {
      console.error("Error starting scan:", err);
      setScanning(false);
      setStatusMessage(`Scan failed: ${err}`);
    }
  };

  const handleAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisProgress(null);
    setStatusMessage("Starting analysis...");
    try {
      const res = await analyzeLibrary({});
      if (res.total === 0) {
        setAnalyzing(false);
        setStatusMessage("No tracks need analysis (all up to date).");
      } else {
        setStatusMessage(`Analyzing ${res.total} track${res.total === 1 ? "" : "s"}...`);
      }
    } catch (err) {
      console.error("Error starting analysis:", err);
      setAnalyzing(false);
      setAnalysisProgress(null);
      setStatusMessage(`Analysis failed: ${err}`);
    }
  };

  const filteredTracks = useMemo(() => filterTracks(tracks, searchQuery), [tracks, searchQuery]);
  const filterCount = activeFilterCount(filters);
  const filterSummary = describeFilters(filters);

  return (
    <div className="relative flex flex-col h-screen bg-[#0f1117] text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#2a2f42] bg-[#141721] px-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-linear-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Disc3 className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-base text-white">DJ Assistant</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-sm bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Phase 0 Foundation
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSelectFolder}
            disabled={scanning}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-medium px-3.5 py-1.5 rounded-md transition shadow-sm shadow-blue-600/30"
          >
            <FolderOpen className="w-4 h-4" />
            <span>{scanning ? "Scanning..." : "Scan Music Folder"}</span>
          </button>

          <button
            onClick={handleAnalyze}
            disabled={analyzing || scanning}
            className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 text-white text-xs font-medium px-3.5 py-1.5 rounded-md transition shadow-sm shadow-cyan-600/30"
            title="Analyze all tracks that need it (version-aware; BPM, key, phrases, vocals, loudness)"
          >
            <Sparkles className={`w-4 h-4 ${analyzing ? "animate-pulse" : ""}`} />
            <span>{analyzing ? "Analyzing..." : "Analyze"}</span>
          </button>

          <button
            onClick={refreshLibrary}
            disabled={loading || scanning}
            className="p-1.5 rounded-md bg-[#1e2230] hover:bg-[#252b3d] text-slate-300 border border-[#2a2f42] transition"
            title="Refresh library"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sub-header / Scan Status */}
        {scanning && progress && (
          <div className="bg-[#181d2c] border-b border-blue-500/30 px-5 py-2.5 flex flex-col space-y-1.5 transition-all">
            <div className="flex justify-between items-center text-xs">
              <span className="text-blue-400 font-medium flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Scanning: {progress.currentPath}</span>
              </span>
              <span className="text-slate-400 font-mono">
                {progress.scannedFiles} / {progress.totalFiles || "?"} files
              </span>
            </div>
            <div className="w-full bg-[#10131d] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: `${scanPercent(progress.scannedFiles, progress.totalFiles)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Analysis progress (T1.2.2) */}
        {analyzing && analysisProgress && (
          <div className="bg-[#141d28] border-b border-cyan-500/30 px-5 py-2.5 flex flex-col space-y-1.5 transition-all">
            <div className="flex justify-between items-center text-xs">
              <span className="text-cyan-400 font-medium flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>
                  Analyzing:{" "}
                  {analysisProgress.filePath.split(/[\\/]/).pop() ?? analysisProgress.filePath}
                </span>
              </span>
              <span className="text-slate-400 font-mono">
                {analysisProgress.processed} / {analysisProgress.total} tracks
              </span>
            </div>
            <div className="w-full bg-[#10131d] rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: `${scanPercent(analysisProgress.processed, analysisProgress.total)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="relative h-12 border-b border-[#222738] bg-[#12151e] px-5 flex items-center justify-between">
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, artist, album, path..."
              className="w-full bg-[#1a1e2b] border border-[#2a2f42] rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 transition"
            />
          </div>

          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <button
              onClick={filtersOpen ? () => setFiltersOpen(false) : openFilters}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md border transition ${
                filterCount > 0
                  ? "bg-blue-500/10 border-blue-500/40 text-blue-300 hover:bg-blue-500/15"
                  : "bg-[#1e2230] border-[#2a2f42] text-slate-300 hover:bg-[#252b3d]"
              }`}
              title="Filter by tempo, key, genre, rating and analysis status"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters{filterCount > 0 ? ` (${filterCount})` : ""}</span>
            </button>
            <button
              onClick={openTagHealth}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-[#1e2230] hover:bg-[#252b3d] text-slate-300 border border-[#2a2f42] transition"
              title="Show missing tags and artwork across the library (local gap detection; online lookup planned)"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Tag Health</span>
            </button>
            <button
              onClick={openCharts}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-[#1e2230] hover:bg-[#252b3d] text-slate-300 border border-[#2a2f42] transition"
              title="Beatport Top 100 / Hype snapshots with taste filtering (versioned data — no catalog API)"
            >
              <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
              <span>Charts</span>
            </button>
            {providers && (
              <span
                className="hidden lg:flex items-center space-x-1"
                title={`Streaming: ${providers.supportedStreaming.join(", ")} · Stores: ${providers.supportedStores.join(", ")}`}
              >
                <PlugZap className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {providers.supportedStreaming.length} streaming ·{" "}
                  {providers.supportedStores.length} stores · {providers.connected.length} connected
                </span>
              </span>
            )}
            <span className="flex items-center space-x-1">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {filteredTracks.length}
                {libraryTotal !== filteredTracks.length ? ` of ${libraryTotal}` : ""} tracks
              </span>
            </span>
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Local-first & Non-destructive</span>
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

        {/* Active filter summary — one chip per filter group, with a clear action. */}
        {filterSummary.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#222738] bg-[#12151e] px-5 py-1.5 text-[11px] text-slate-400">
            <SlidersHorizontal className="w-3 h-3 text-blue-400" />
            {filterSummary.map((part) => (
              <span
                key={part}
                className="px-2 py-0.5 rounded-sm bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono"
              >
                {part}
              </span>
            ))}
            <button
              onClick={resetFilters}
              className="ml-1 text-slate-500 hover:text-slate-300 underline decoration-dotted"
              title="Clear every filter and restore the newest-first order"
            >
              clear all
            </button>
          </div>
        )}

        {/* Track List Table */}
        <div className="flex-1 overflow-auto">
          {filteredTracks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 p-8">
              <div className="h-16 w-16 rounded-2xl bg-[#181b26] border border-[#262c3e] flex items-center justify-center">
                <Music className="w-8 h-8 text-slate-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-300">No tracks in library</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Click "Scan Music Folder" above to import your local audio files (.mp3, .flac,
                  .wav, .aiff).
                </p>
              </div>
              {currentFolder && (
                <div className="text-xs bg-[#161924] border border-[#262a3a] px-3 py-1 rounded-sm text-slate-400 font-mono">
                  Current folder: {currentFolder}
                </div>
              )}
            </div>
          ) : (
            <table className="w-full min-w-[1200px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#222738] bg-[#141722] text-slate-400 uppercase tracking-wider text-[10px] font-semibold sticky top-0 z-10">
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
              <tbody className="divide-y divide-[#1b1f2d]">
                {filteredTracks.map((track, idx) => (
                  <tr
                    key={track.id}
                    onClick={() =>
                      setSelectedTrack((current) => (current?.id === track.id ? null : track))
                    }
                    title="Click to inspect: similar tracks, tag gaps, buy-links"
                    className={`hover:bg-[#181c28] transition duration-150 group cursor-pointer ${
                      selectedTrack?.id === track.id ? "bg-[#1a2133]" : ""
                    }`}
                  >
                    {" "}
                    <td className="py-2.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-2">
                      <ArtworkThumb trackId={track.id} hasArtwork={!!track.artworkHash} />
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-100 group-hover:text-blue-400 transition">
                      {track.title || "Untitled"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {track.artist || "Unknown Artist"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">{track.album || "—"}</td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-300">
                      {formatBpm(track.bpm)}
                    </td>
                    <td
                      className="py-2.5 px-4 text-center font-mono text-slate-300"
                      title={
                        track.keyClassical && track.keyCamelot
                          ? `Camelot ${track.keyCamelot} • ${track.keyClassical}`
                          : undefined
                      }
                    >
                      {formatKey(track.keyCamelot, track.keyClassical)}
                    </td>
                    <td
                      className="py-2.5 px-4 text-center text-amber-400 tracking-tight"
                      title={track.userRating != null ? `${track.userRating} / 5` : "Unrated"}
                    >
                      {formatRating(track.userRating)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                      {formatDuration(track.durationMs)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-1.5 py-0.5 rounded-sm text-[10px] uppercase font-mono bg-[#212637] text-slate-300 border border-[#2e344a]">
                        {track.format || "AUDIO"}
                      </span>
                    </td>
                    <td
                      className="py-2.5 px-4 text-slate-400 italic"
                      title={track.comments ?? undefined}
                    >
                      {truncateComment(track.comments, 48)}
                    </td>
                    <td
                      className="py-2.5 px-4 text-center font-mono text-[10px] text-slate-400"
                      title={track.fileHash}
                    >
                      {shortHash(track.fileHash)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Indexed</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Track inspector drawer: similar tracks, tag gaps, buy-links */}
      {selectedTrack && (
        <aside className="absolute right-0 top-14 bottom-7 w-[380px] max-w-[92vw] bg-[#12151e] border-l border-[#2a2f42] overflow-y-auto shadow-2xl z-20">
          <div className="p-4 border-b border-[#222738]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start space-x-3 min-w-0">
                <ArtworkThumb
                  trackId={selectedTrack.id}
                  hasArtwork={!!selectedTrack.artworkHash}
                  large
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {selectedTrack.title || "Untitled"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedTrack.artist || "Unknown Artist"}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    {formatBpm(selectedTrack.bpm)} ·{" "}
                    {formatKey(selectedTrack.keyCamelot, selectedTrack.keyClassical)} ·{" "}
                    {formatDuration(selectedTrack.durationMs)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTrack(null)}
                className="p-1.5 rounded-md hover:bg-[#252b3d] text-slate-400 transition"
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
                    className="px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    title="Missing locally — online lookup (MusicBrainz / iTunes / Deezer) is planned and opt-in"
                  >
                    missing: {formatMissingField(field)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-b border-[#222738]">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Similar tracks (local mix-compatibility)</span>
            </p>
            {similarLoading ? (
              <p className="text-xs text-slate-500 mt-2">Scoring library…</p>
            ) : similar.length === 0 ? (
              <p className="text-xs text-slate-500 mt-2">
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
                      className="w-full text-left p-2 rounded-md bg-[#1a1e2b] hover:bg-[#222738] border border-[#2a2f42] transition"
                      title={result.reasons.join(" · ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {result.title || "Untitled"}
                        </span>
                        <span className="text-[11px] font-mono text-blue-400 shrink-0">
                          {formatScore(result.score)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 truncate">
                          {result.artist || "Unknown Artist"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {formatBpm(result.bpm)} ·{" "}
                          {formatKey(result.keyCamelot, result.keyClassical)}
                        </span>
                      </div>
                      {result.reasons.length > 0 && (
                        <p className="text-[10px] text-slate-500 mt-1 truncate">
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
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center space-x-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Find to buy (metadata links only)</span>
            </p>
            {!storeLinks || storeLinks.links.length === 0 ? (
              <p className="text-xs text-slate-500 mt-2">No store links for this track.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {storeLinks.links.map((link) => (
                  <li
                    key={link.provider}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-[#1a1e2b] border border-[#2a2f42]"
                  >
                    <span className="text-xs text-slate-300">{link.label}</span>
                    <button
                      onClick={() => copyStoreUrl(link.url)}
                      className="flex items-center space-x-1 px-2 py-1 rounded-sm text-[11px] bg-[#212637] hover:bg-[#2a3049] text-slate-300 border border-[#2e344a] transition"
                      title={link.url}
                    >
                      {copiedUrl === link.url ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedUrl === link.url ? "Copied" : "Copy link"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-slate-600 mt-2">
              Links open the store's own search page. No audio is fetched; Beatport charts and
              release radar arrive as data integrations next.
            </p>
          </div>

          <div className="p-4 border-t border-[#222738]">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center space-x-1.5">
              <PlugZap className="w-3.5 h-3.5 text-violet-400" />
              <span>Match on Deezer (live read, no key)</span>
            </p>
            {!deezerMatch && !deezerLoading && (
              <button
                onClick={runDeezerMatch}
                className="mt-2 px-2.5 py-1.5 rounded-md bg-[#1e2230] hover:bg-[#252b3d] text-slate-300 border border-[#2a2f42] text-xs transition"
                title="ISRC-exact first, then fuzzy search. Writes nothing."
              >
                Match this track
              </button>
            )}
            {deezerLoading && <p className="text-xs text-slate-500 mt-2">Matching…</p>}
            {deezerMatch && (
              <div className="mt-2 p-2 rounded-md bg-[#1a1e2b] border border-[#2a2f42] text-xs">
                {deezerMatch.providerId ? (
                  <>
                    <p className="text-slate-200 truncate">
                      {deezerMatch.title} — {deezerMatch.artist}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {deezerMatch.album ?? "Unknown release"} · {deezerMatch.status} ·{" "}
                      {formatScore(deezerMatch.confidence)}
                    </p>
                    {deezerMatch.sourceUrl && (
                      <button
                        onClick={() => copyStoreUrl(deezerMatch.sourceUrl!)}
                        className="mt-1.5 flex items-center space-x-1 px-2 py-1 rounded-sm text-[11px] bg-[#212637] hover:bg-[#2a3049] text-slate-300 border border-[#2e344a] transition"
                        title={deezerMatch.sourceUrl}
                      >
                        {copiedUrl === deezerMatch.sourceUrl ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>
                          {copiedUrl === deezerMatch.sourceUrl ? "Copied" : "Copy Deezer link"}
                        </span>
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500">No Deezer match for this track.</p>
                )}
                <p
                  className="text-[10px] text-slate-600 mt-1.5"
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
        <div className="absolute inset-0 bg-black/60 z-30 flex items-center justify-center p-6">
          <div className="w-[560px] max-w-full max-h-full overflow-y-auto bg-[#12151e] border border-[#2a2f42] rounded-lg shadow-2xl">
            <div className="p-4 border-b border-[#222738] flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>Tag Health — missing tags &amp; artwork</span>
              </p>
              <button
                onClick={() => setHealthOpen(false)}
                className="p-1.5 rounded-md hover:bg-[#252b3d] text-slate-400 transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {healthLoading ? (
                <p className="text-xs text-slate-500">Scanning library gaps…</p>
              ) : !health ? (
                <p className="text-xs text-slate-500">Could not load tag health.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-400">
                    {health.withGaps} of {health.checked} tracks have gaps.
                    {health.averageScore != null && (
                      <>
                        {" "}
                        Library score:{" "}
                        <span className="font-mono text-slate-200">
                          {Math.round(health.averageScore)}
                        </span>
                        /100
                      </>
                    )}{" "}
                    Online lookup is explicit and opt-in per provider — only metadata and search
                    queries leave this device, never audio.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <label htmlFor="enrich-provider" className="text-xs text-slate-400">
                      Source
                    </label>
                    <select
                      id="enrich-provider"
                      value={enrichProvider}
                      onChange={(e) => setEnrichProvider(e.target.value as EnrichmentProviderKind)}
                      className="bg-[#1a1e2b] border border-[#2a2f42] rounded-md px-2 py-1.5 text-xs text-slate-200"
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
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-medium transition"
                      title="Look up to 25 gap tracks on the selected source. Nothing is applied yet."
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{enrichLoading && !preview ? "Looking up…" : "Look up online"}</span>
                    </button>
                  </div>
                  {enrichProgress && (
                    <p className="text-[11px] text-slate-500 font-mono mt-2">
                      {enrichProgress.processed} / {enrichProgress.total} · {enrichProgress.status}
                    </p>
                  )}
                  {applyMessage && <p className="text-xs text-slate-300 mt-2">{applyMessage}</p>}
                  {preview && preview.proposals.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                          Proposals from {preview.provider} ({preview.proposedTracks} tracks,{" "}
                          {preview.proposedChanges} changes
                          {preview.skipped > 0 ? `, ${preview.skipped} skipped` : ""})
                        </p>
                      </div>
                      <ul className="mt-2 space-y-2 max-h-72 overflow-y-auto">
                        {preview.proposals.map((proposal) => (
                          <li
                            key={proposal.trackId}
                            className="p-2 rounded-md bg-[#1a1e2b] border border-[#2a2f42] text-xs"
                          >
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checkedProposals.includes(proposal.trackId)}
                                onChange={() => toggleProposal(proposal.trackId)}
                                className="mt-1 accent-blue-500"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className="text-slate-200 truncate">
                                    {proposal.title} — {proposal.artist}
                                  </span>
                                  <span
                                    className={`shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] font-medium border ${
                                      proposal.tier === "high"
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : proposal.tier === "review"
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                    }`}
                                    title={`Match confidence ${formatScore(proposal.confidence)}`}
                                  >
                                    {proposal.tier} · {formatScore(proposal.confidence)}
                                  </span>
                                </span>
                                <span className="block mt-1 space-y-0.5">
                                  {proposal.changes.map((change) => (
                                    <span key={change.field} className="block text-[11px]">
                                      <span className="text-slate-500">
                                        {formatMissingField(change.field)}:{" "}
                                      </span>
                                      <span className="text-slate-500 line-through">
                                        {change.field === "artwork"
                                          ? "none"
                                          : (change.current ?? "—")}
                                      </span>
                                      <span className="text-slate-500"> → </span>
                                      <span className="text-emerald-400">
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
                          className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-medium transition"
                          title="Write checked proposals to DB canonical fields (never source files). Artwork fills empty slots only."
                        >
                          {enrichLoading
                            ? "Applying…"
                            : `Apply checked (${checkedProposals.length})`}
                        </button>
                        <button
                          onClick={runEnrichmentUndo}
                          disabled={enrichLoading}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#1e2230] hover:bg-[#252b3d] text-slate-300 border border-[#2a2f42] text-xs transition"
                          title="Restore this run's before-state snapshot"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Undo run</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {preview && preview.proposals.length === 0 && (
                    <p className="text-xs text-slate-500 mt-3">
                      No new proposals from {preview.provider}
                      {preview.skipped > 0 ? ` (${preview.skipped} skipped)` : ""}.
                    </p>
                  )}
                  {health.totals.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {health.totals.map((total) => (
                        <div key={total.field} className="flex items-center gap-2 text-xs">
                          <span className="w-24 shrink-0 text-slate-400">
                            {formatMissingField(total.field)}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-[#1a1e2b] overflow-hidden">
                            <div
                              className="h-1.5 rounded-full bg-amber-500"
                              style={{
                                width: `${health.checked ? Math.round((total.missingCount / health.checked) * 100) : 0}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono text-slate-400">
                            {total.missingCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {health.gaps.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                        Tracks with gaps (first {health.gaps.length})
                      </p>
                      <ul className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                        {health.gaps.map((gap) => (
                          <li
                            key={gap.trackId}
                            className="p-2 rounded-md bg-[#1a1e2b] border border-[#2a2f42] text-xs"
                          >
                            <p className="text-slate-200 truncate">
                              {gap.title || "Untitled"} — {gap.artist || "Unknown Artist"}
                              <span
                                className="ml-2 font-mono text-[11px] text-slate-400"
                                title="Tag Health Score 0–100"
                              >
                                {Math.round(gap.score)}
                              </span>
                            </p>
                            <p className="text-[11px] text-amber-400/90 mt-0.5">
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
          </div>
        </div>
      )}

      {/* Charts modal: versioned snapshots with taste filtering (TD.3) */}
      {chartsOpen && (
        <div className="absolute inset-0 bg-black/60 z-30 flex items-center justify-center p-6">
          <div className="w-[620px] max-w-full max-h-full overflow-y-auto bg-[#12151e] border border-[#2a2f42] rounded-lg shadow-2xl">
            <div className="p-4 border-b border-[#222738] flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                <span>Charts — snapshots, filtered by taste</span>
              </p>
              <button
                onClick={() => setChartsOpen(false)}
                className="p-1.5 rounded-md hover:bg-[#252b3d] text-slate-400 transition"
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
                  className="bg-[#1a1e2b] border border-[#2a2f42] rounded-md px-2 py-1.5 text-slate-200"
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
                  className="bg-[#1a1e2b] border border-[#2a2f42] rounded-md px-2 py-1.5 text-slate-200"
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
                <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matchToSelected}
                    onChange={(e) => {
                      setMatchToSelected(e.target.checked);
                      loadCharts(chartGenre, chartKind, e.target.checked);
                    }}
                    className="accent-blue-500"
                  />
                  Taste-match to selected track
                </label>
                <button
                  onClick={() => loadCharts()}
                  disabled={chartLoading}
                  className="px-2.5 py-1.5 rounded-md bg-[#1e2230] hover:bg-[#252b3d] text-slate-300 border border-[#2a2f42] transition"
                >
                  Refresh
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Versioned snapshot data — Beatport exposes no public catalog API. Ownership is
                ISRC-exact; taste is 60% tempo / 40% key vs the selected track.
              </p>
              {chartLoading ? (
                <p className="text-xs text-slate-500 mt-3">Loading snapshot…</p>
              ) : chartError ? (
                <div className="mt-3">
                  <p className="text-xs text-slate-400">{chartError}</p>
                  <button
                    onClick={loadSampleSnapshot}
                    disabled={chartLoading}
                    className="mt-2 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-medium transition"
                    title="Imports 3 clearly-marked synthetic entries (demo format reference)"
                  >
                    Load sample snapshot
                  </button>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Import format reference:{" "}
                    <span className="font-mono">fixtures/charts/*.SAMPLE.json</span>
                  </p>
                </div>
              ) : (
                chartData && (
                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                      {chartData.provider} {chartData.chart} · {chartData.genre} ·{" "}
                      {chartData.snapshotDate} ({chartData.total})
                    </p>
                    <ul className="mt-2 space-y-1.5 max-h-80 overflow-y-auto">
                      {chartData.entries.map((entry) => (
                        <li
                          key={entry.position}
                          className="p-2 rounded-md bg-[#1a1e2b] border border-[#2a2f42] text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-7 shrink-0 font-mono text-slate-500">
                              {entry.position}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-slate-200">
                              {entry.title} — {entry.artist}
                            </span>
                            {entry.owned && (
                              <span
                                className="shrink-0 px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                title="ISRC matches a library track"
                              >
                                owned
                              </span>
                            )}
                            {entry.tasteScore != null && (
                              <span
                                className="shrink-0 font-mono text-[11px] text-blue-400"
                                title="Taste match vs the selected track"
                              >
                                {formatScore(entry.tasteScore)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 ml-9">
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
          </div>
        </div>
      )}

      {/* Footer / Status Bar */}
      <footer className="h-7 border-t border-[#222738] bg-[#11131c] px-4 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>{statusMessage}</span>
        </div>
        {providers && (
          <div
            className="font-mono text-[10px] text-slate-500 hidden md:block"
            title={`Streaming export targets: ${providers.supportedStreaming.join(", ")} — Buy-link stores: ${providers.supportedStores.join(", ")}`}
          >
            {providers.connected.length} connected · {providers.supportedStreaming.length} streaming
            · {providers.supportedStores.length} stores
          </div>
        )}
        <div className="font-mono text-[10px] text-slate-400">
          BLAKE3 Fingerprint • SQLite Core • Offline
        </div>
      </footer>
    </div>
  );
}
