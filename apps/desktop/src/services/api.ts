import type {
  ScanFolderRequest,
  ScanFolderResponse,
  ListTracksRequest,
  ListTracksResponse,
  ListFoldersResponse,
  ListGenresResponse,
  GetTrackRequest,
  GetTrackResponse,
  GetArtworkRequest,
  GetArtworkResponse,
  UpdateTrackMetadataRequest,
  UpdateTrackMetadataResponse,
  SetTrackRatingRequest,
  SetTrackRatingResponse,
  UndoTrackMetadataRequest,
  UndoTrackMetadataResponse,
  RemoveTracksRequest,
  RemoveTracksResponse,
  UndoRemoveTracksRequest,
  UndoRemoveTracksResponse,
  ListRemovedTracksResponse,
  RestoreTracksRequest,
  RestoreTracksResponse,
  RevealInFileManagerRequest,
  ScanProgressEvent,
  ScanCompletedEvent,
  AnalyzeLibraryRequest,
  AnalyzeLibraryResponse,
  AnalysisProgressEvent,
  AnalysisCompletedEvent,
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
    return { jobId: `mock-job-${Date.now()}`, estimatedFiles: 42 };
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

/**
 * Distinct non-empty genres with track counts, for the library filter UI.
 * Local read only — no network access.
 */
export async function listGenres(): Promise<ListGenresResponse> {
  if (!isTauri) {
    return { genres: [] };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ListGenresResponse>("list_genres");
}

/**
 * Distinct parent folders of the present tracks with counts, for the Browser
 * source's folder options. Read library-wide, not from the loaded page.
 */
export async function listFolders(): Promise<ListFoldersResponse> {
  if (!isTauri) {
    return { folders: [] };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ListFoldersResponse>("list_folders");
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

export interface GetWaveformPeaksRequest {
  trackId: string;
}

export interface GetWaveformPeaksResponse {
  peaks: number[];
  durationMs: number;
  sampleRate: number;
  isReal: boolean;
}

export async function getWaveformPeaks(
  req: GetWaveformPeaksRequest
): Promise<GetWaveformPeaksResponse> {
  if (!isTauri) {
    return { peaks: [], durationMs: 0, sampleRate: 0, isReal: false };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<GetWaveformPeaksResponse>("get_waveform_peaks", { request: req });
}

/** Peak layers of a decoded `get_waveform_peaks` response, shaped for `WaveformData`. */
export interface DecodedPeakLayers {
  peaks: Float32Array;
  lowPeaks: Float32Array;
  midPeaks: Float32Array;
  highPeaks: Float32Array;
  isEstimated: false;
}

/**
 * Turns a decoded peak list into the peak layers the waveform renderers read.
 *
 * The response carries ~4000 points while the synthesized waveform carries
 * 16000 in `peaks` *and* in every band, and `DetailedWaveform` indexes the
 * bands with `peaks.length`. Copying the response straight into `peaks` leaves
 * the bands four times too long: the render loop reads the first quarter of the
 * synthetic bands and stretches it over the whole canvas — fabricated energy
 * wherever the decoded peaks are silent.
 *
 * Upsampling the decoded peaks to 16000 would fix the indexing but keep those
 * synthetic bands, and this patch clears `isEstimated`, which tells the UI the
 * waveform was decoded (docs/ui/06 forbids passing invented analysis off as
 * decoded). The bands are dropped instead: zero-filled at the decoded length.
 * The waveform still renders — `DetailedWaveform` always draws the body layer
 * and simply has no mid/low height left to draw.
 */
export function decodedPeakLayers(peaks: number[]): DecodedPeakLayers {
  const body = new Float32Array(peaks.length);
  peaks.forEach((value, i) => {
    body[i] = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
  });
  return {
    peaks: body,
    lowPeaks: new Float32Array(body.length),
    midPeaks: new Float32Array(body.length),
    highPeaks: new Float32Array(body.length),
    isEstimated: false,
  };
}

/**
 * Patches user-assigned metadata (rating, energy) on one or more tracks.
 *
 * The backend answers with the id of the undo snapshot it stored, so the UI
 * can offer a real Undo instead of guessing the previous values.
 */
export async function updateTrackMetadata(
  req: UpdateTrackMetadataRequest
): Promise<UpdateTrackMetadataResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, ignoring track metadata update");
    return { undoId: "mock-undo", updated: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<UpdateTrackMetadataResponse>("update_track_metadata", { request: req });
}

/** Rating-only variant of {@link updateTrackMetadata}. */
export async function setTrackRating(req: SetTrackRatingRequest): Promise<SetTrackRatingResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, ignoring rating update");
    return { undoId: "mock-undo", updated: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SetTrackRatingResponse>("set_track_rating", { request: req });
}

/** Reverts a metadata write using the `undoId` the write returned. */
export async function undoTrackMetadata(
  req: UndoTrackMetadataRequest
): Promise<UndoTrackMetadataResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, ignoring undo");
    return { restored: 0, skipped: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<UndoTrackMetadataResponse>("undo_track_metadata", { request: req });
}

// --- Soft-remove, reveal and copy path (T2.1.10 Batch B/C) ---

/**
 * Takes tracks out of the library index. Nothing on disk is touched: the
 * backend stamps `removed_at`, keeps the row with its cues and tags, and writes
 * the snapshot that `undoRemoveTracks` needs.
 */
export async function removeTracks(req: RemoveTracksRequest): Promise<RemoveTracksResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, ignoring remove");
    return { undoId: null, removed: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<RemoveTracksResponse>("remove_tracks", { request: req });
}

/** Puts the tracks a remove took out of the library back in. */
export async function undoRemoveTracks(
  req: UndoRemoveTracksRequest
): Promise<UndoRemoveTracksResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, ignoring undo");
    return { restored: 0, skipped: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<UndoRemoveTracksResponse>("undo_remove_tracks", { request: req });
}

/**
 * The removed view: every track a soft remove took out of the library.
 *
 * This is the one surface that shows those rows — everywhere else they are
 * filtered out. Opened deliberately, because the Undo toast that normally
 * offers the way back is transient.
 */
export async function listRemovedTracks(): Promise<ListRemovedTracksResponse> {
  if (!isTauri) {
    return { tracks: [], total: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ListRemovedTracksResponse>("list_removed_tracks");
}

/**
 * Puts tracks back into the library from the removed view.
 *
 * A write of its own, with its own snapshot: it does not need the removal's
 * `undoId`, which is gone with the toast. Undoing what this returns takes the
 * tracks out again — with the stamp the original removal carried.
 */
export async function restoreTracks(req: RestoreTracksRequest): Promise<RestoreTracksResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, ignoring restore");
    return { undoId: null, restored: 0, skipped: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<RestoreTracksResponse>("restore_tracks", { request: req });
}

/**
 * Opens the OS file manager at the track's location. The path is passed to the
 * shell, never read or written by the app.
 */
export async function revealInFileManager(req: RevealInFileManagerRequest): Promise<boolean> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, ignoring reveal");
    return false;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("reveal_in_file_manager", { request: req });
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
    return () => undefined;
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

// --- Native audio engine (T2.4) ---
// The Rust AudioEngine decodes the track file via Symphonia and plays it back
// through cpal. These wrappers are the only IPC surface the frontend audio
// engine needs; position polling goes through `audioState`.

export interface NativeAudioState {
  playing: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
}

export async function audioLoad(trackId: string): Promise<number> {
  if (!isTauri) {
    return 0;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("audio_load", { trackId });
}

export async function audioPlay(): Promise<void> {
  if (!isTauri) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("audio_play");
}

export async function audioPause(): Promise<void> {
  if (!isTauri) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("audio_pause");
}

/**
 * Rounds and clamps a seek target to the `ms: u64` the Rust command declares.
 *
 * serde rejects a fractional number for a u64 parameter, and NaN / Infinity do
 * not serialize at all, so a target that survives the UI's own double clamp
 * would fail the call instead of seeking. `null` means the value cannot be
 * represented: the caller drops the seek rather than silently jumping to 0.
 */
export function normalizeSeekMs(ms: number): number | null {
  if (!Number.isFinite(ms)) return null;
  return Math.round(Math.min(Math.max(ms, 0), Number.MAX_SAFE_INTEGER));
}

export async function audioSeek(ms: number): Promise<void> {
  if (!isTauri) return;
  const target = normalizeSeekMs(ms);
  if (target === null) {
    console.warn("Native audio_seek ignored a non-finite position:", ms);
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("audio_seek", { ms: target });
}

export async function audioSetVolume(volume: number): Promise<void> {
  if (!isTauri) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("audio_set_volume", { volume });
}

export async function audioState(): Promise<NativeAudioState> {
  if (!isTauri) {
    return { playing: false, positionMs: 0, durationMs: 0, volume: 0.8 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<NativeAudioState>("audio_state");
}

export async function openFolderDialog(): Promise<string | null> {
  if (!isTauri) {
    const promptText = "Enter folder path for mock scan:";
    const mockPath = window.prompt(promptText, "D:/Music/TestSet"); /* skipcq: JS-0052 */
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
    return () => undefined;
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
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<ScanCompletedEvent>("scan:completed", (e) => {
    callback(e.payload);
  });
  return unlisten;
}

/**
 * Starts a local analysis run over tracks needing analysis (version-aware
 * unless force:true). Progress arrives via `analysis:progress` per track and
 * a single `analysis:completed` when the queue drains.
 */
export async function analyzeLibrary(
  req: AnalyzeLibraryRequest = {}
): Promise<AnalyzeLibraryResponse> {
  if (!isTauri) {
    console.warn("[Mock API] Tauri not detected, returning empty analysis job");
    return { jobId: `mock-analysis-${Date.now()}`, total: 0 };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<AnalyzeLibraryResponse>("analyze_library", { request: req });
}

export async function listenToAnalysisProgress(
  callback: (event: AnalysisProgressEvent) => void
): Promise<() => void> {
  if (!isTauri) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<AnalysisProgressEvent>("analysis:progress", (e) => {
    callback(e.payload);
  });
  return unlisten;
}

export async function listenToAnalysisCompleted(
  callback: (event: AnalysisCompletedEvent) => void
): Promise<() => void> {
  if (!isTauri) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<AnalysisCompletedEvent>("analysis:completed", (e) => {
    callback(e.payload);
  });
  return unlisten;
}
