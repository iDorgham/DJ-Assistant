import type {
  ScanFolderRequest,
  ScanFolderResponse,
  ListTracksRequest,
  ListTracksResponse,
  GetTrackRequest,
  GetTrackResponse,
  GetArtworkRequest,
  GetArtworkResponse,
  ScanProgressEvent,
  ScanCompletedEvent,
  FindSimilarTracksRequest,
  FindSimilarTracksResponse,
  TagHealthRequest,
  TagHealthResponse,
  StoreLinksRequest,
  StoreLinksResponse,
  ProviderStatusResponse,
  EnrichmentPreviewRequest,
  EnrichmentPreviewResponse,
  EnrichmentProgressEvent,
  EnrichmentApplyRequest,
  EnrichmentApplyResponse,
  EnrichmentUndoRequest,
  EnrichmentUndoResponse,
  ProviderMatchTracksRequest,
  ProviderMatchTracksResponse,
  ProviderMatchSetRequest,
  ProviderExportPlaylistRequest,
  ChartImportRequest,
  ChartImportResponse,
  ChartListRequest,
  ChartListResponse,
} from "@dj-assistant/shared";

// Safe Tauri invocation wrapper with mock fallback for web development
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function scanFolder(req: ScanFolderRequest): Promise<ScanFolderResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, running mock scan");
    return { jobId: "mock-job-" + Date.now(), estimatedFiles: 42 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ScanFolderResponse>("scan_folder", { request: req });
}

export async function listTracks(req: ListTracksRequest = {}): Promise<ListTracksResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, returning empty or stored tracks");
    return { tracks: [], total: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ListTracksResponse>("list_tracks", { request: req });
}

export async function getTrack(req: GetTrackRequest): Promise<GetTrackResponse> {
  if (!isTauri) {
    throw new Error("Tauri not detected in mock mode");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<GetTrackResponse>("get_track", { request: req });
}

/**
 * Loads cached cover art as a `data:` URL. Returns `null` when the track has no
 * artwork — the caller renders a placeholder in that case.
 */
export async function getArtwork(req: GetArtworkRequest): Promise<GetArtworkResponse> {
  if (!isTauri) {
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<GetArtworkResponse>("get_artwork", { request: req });
}

/**
 * Ranks library tracks by mix-compatibility with a seed track (local only:
 * BPM / Camelot key / genre / duration — no network).
 */
export async function findSimilarTracks(
  req: FindSimilarTracksRequest
): Promise<FindSimilarTracksResponse> {
  if (!isTauri) {
    return { seedTrackId: req.trackId, results: [] };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FindSimilarTracksResponse>("find_similar_tracks", { request: req });
}

/**
 * Reports missing/placeholder tag and artwork fields per track — the read
 * half of enrichment. Online lookup consumes this output in a later step.
 */
export async function trackTagHealth(req: TagHealthRequest = {}): Promise<TagHealthResponse> {
  if (!isTauri) {
    return { checked: 0, withGaps: 0, gaps: [], totals: [] };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<TagHealthResponse>("track_tag_health", { request: req });
}

/**
 * Builds per-store buy-link search URLs for a track (Beatport, Traxsource,
 * Juno Download, Bandcamp, Discogs). Pure URL construction — no API, no audio.
 */
export async function storeLinksForTrack(req: StoreLinksRequest): Promise<StoreLinksResponse> {
  if (!isTauri) {
    return { trackId: req.trackId, artist: "", title: "", links: [] };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<StoreLinksResponse>("store_links_for_track", { request: req });
}

/**
 * Lists connected streaming accounts plus the supported provider enums.
 * Empty `connected` until the first OAuth flow lands.
 */
export async function providerStatus(): Promise<ProviderStatusResponse> {
  if (!isTauri) {
    // Mock mirrors the backend enums in commands.rs::provider_status so the
    // badges report the advertised targets even outside Tauri.
    return {
      connected: [],
      supportedStreaming: [
        "spotify",
        "deezer",
        "apple_music",
        "youtube_music",
        "soundcloud",
        "tidal",
      ],
      supportedStores: ["beatport", "traxsource", "juno_download", "bandcamp", "discogs"],
      capabilities: [],
    };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ProviderStatusResponse>("provider_status");
}

/**
 * Looks up gap tracks on one enrichment provider and records reviewable
 * proposals. Nothing is applied — `enrichmentApply` does that from the
 * recorded candidates. One provider per run; network access is explicit.
 */
export async function enrichmentPreview(
  req: EnrichmentPreviewRequest
): Promise<EnrichmentPreviewResponse> {
  if (!isTauri) {
    return {
      runId: "mock-run",
      provider: req.provider ?? "musicbrainz",
      proposedTracks: 0,
      proposedChanges: 0,
      skipped: 0,
      proposals: [],
    };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<EnrichmentPreviewResponse>("enrichment_preview", { request: req });
}

/**
 * Applies recorded preview proposals to DB canonical fields (never source
 * files). Artwork downloads only into empty slots.
 */
export async function enrichmentApply(
  req: EnrichmentApplyRequest
): Promise<EnrichmentApplyResponse> {
  if (!isTauri) {
    return { runId: req.runId, applied: 0, skipped: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<EnrichmentApplyResponse>("enrichment_apply", { request: req });
}

/**
 * Restores a run's before-state snapshot: exact values back, run marked undone.
 */
export async function enrichmentUndo(req: EnrichmentUndoRequest): Promise<EnrichmentUndoResponse> {
  if (!isTauri) {
    return { runId: req.runId, restored: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<EnrichmentUndoResponse>("enrichment_undo", { request: req });
}

export async function listenToEnrichmentProgress(
  callback: (event: EnrichmentProgressEvent) => void
): Promise<() => void> {
  if (!isTauri) {
    return () => {};
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<EnrichmentProgressEvent>("enrichment:progress", (e) => {
    callback(e.payload);
  });
  return unlisten;
}

/**
 * Matches explicit local tracks against one provider catalog (Deezer today:
 * ISRC-exact first, then fuzzy). Live reads, no writes, no key required.
 */
export async function providerMatchTracks(
  req: ProviderMatchTracksRequest
): Promise<ProviderMatchTracksResponse> {
  if (!isTauri) {
    return { provider: req.provider, matches: [] };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ProviderMatchTracksResponse>("provider_match_tracks", { request: req });
}

/**
 * Generic set match (TX.1): same matcher behind the provider contract.
 * `setId` waits on Phase 3 sets — pass `trackIds` today.
 */
export async function providerMatchSet(
  req: ProviderMatchSetRequest
): Promise<ProviderMatchTracksResponse> {
  if (!isTauri) {
    return { provider: req.provider, matches: [] };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ProviderMatchTracksResponse>("provider_match_set", { request: req });
}

/**
 * Playlist publishing (TX.2b / TP): not wired yet — the backend returns
 * `not_configured` naming the missing credential. Surfaced so the UI can
 * explain instead of guessing.
 */
export async function providerExportPlaylist(
  req: ProviderExportPlaylistRequest
): Promise<ProviderMatchTracksResponse> {
  if (!isTauri) {
    throw new Error(`not_configured: ${req.provider} playlist export is not wired yet`);
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ProviderMatchTracksResponse>("provider_export_playlist", { request: req });
}

export async function chartImportSnapshot(req: ChartImportRequest): Promise<ChartImportResponse> {
  if (!isTauri) {
    return {
      provider: req.provider,
      chart: req.chart,
      genre: req.genre,
      snapshotDate: req.snapshotDate,
      imported: 0,
      skipped: req.entries.length,
    };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ChartImportResponse>("chart_import_snapshot", { request: req });
}

export async function chartList(req: ChartListRequest = {}): Promise<ChartListResponse> {
  if (!isTauri) {
    return {
      provider: req.provider ?? "beatport",
      chart: req.chart ?? "top100",
      genre: req.genre ?? "techno",
      snapshotDate: "",
      entries: [],
      total: 0,
    };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ChartListResponse>("chart_list", { request: req });
}

export async function openFolderDialog(): Promise<string | null> {
  if (!isTauri) {
    const mockPath = window.prompt("Enter folder path for mock scan:", "D:/Music/TestSet");
    return mockPath || null;
  }
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Music Library Folder",
    });
    if (Array.isArray(selected)) {
      return selected[0] ?? null;
    }
    return selected;
  } catch (err) {
    console.error("Failed to open native folder dialog:", err);
    return null;
  }
}

export async function listenToScanProgress(
  callback: (event: ScanProgressEvent) => void
): Promise<() => void> {
  if (!isTauri) {
    return () => {};
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<ScanProgressEvent>("scan:progress", (e) => {
    callback(e.payload);
  });
  return unlisten;
}

export async function listenToScanCompleted(
  callback: (event: ScanCompletedEvent) => void
): Promise<() => void> {
  if (!isTauri) {
    return () => {};
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<ScanCompletedEvent>("scan:completed", (e) => {
    callback(e.payload);
  });
  return unlisten;
}
