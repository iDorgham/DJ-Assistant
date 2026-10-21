/**
 * DJ Assistant - Shared Types & Contracts
 * Based on docs/architecture/API_CONTRACTS.md and docs/architecture/DATA_MODEL.md
 */

export type AnalysisStatus = "pending" | "complete" | "failed" | "needs_review";

export interface TrackSummary {
  id: string;
  filePath: string;
  fileHash: string;
  title: string;
  artist: string;
  album?: string | null;
  genre?: string | null;
  bpm?: number | null;
  keyCamelot?: string | null;
  keyClassical?: string | null;
  durationMs: number;
  format?: string | null;
  analysisStatus: AnalysisStatus;
  userRating?: number | null;
  /** Energy level 1–10 (migration 006); `null` when the user never set one. */
  energy?: number | null;
  comments?: string | null;
  artworkHash?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CuePoint {
  id: string;
  trackId: string;
  slot?: number | null;
  positionMs: number;
  label: string;
  cueType: "hot_cue" | "memory_cue" | "loop";
  colorHex?: string | null;
  source: "ai_generated" | "user_custom" | "imported";
  createdAt: string;
}

export interface TrackDetail extends TrackSummary {
  fileSize: number;
  sampleRate?: number | null;
  channels?: number | null;
  bitDepth?: number | null;
  loudnessLufs?: number | null;
  vocalPresence?: boolean | null;
  phraseConfidence?: number | null;
  analysisVersion?: string | null;
  cues: CuePoint[];
  notes?: string | null;
}

export interface ScanFolderRequest {
  path: string;
  recursive?: boolean;
}

export interface ScanFolderResponse {
  jobId: string;
  estimatedFiles?: number;
}

export interface ScanProgressEvent {
  jobId: string;
  scannedFiles: number;
  totalFiles: number;
  currentPath: string;
  importedTrack?: TrackSummary | null;
  isDuplicate?: boolean;
  error?: string | null;
}

export interface ScanCompletedEvent {
  jobId: string;
  totalScanned: number;
  totalImported: number;
  totalDuplicates: number;
  totalErrors: number;
  durationMs: number;
}

/**
 * Structured library filters (T2.1.2). All fields are optional and combine
 * with AND; list values match case-insensitively. An empty filter object is
 * the same as omitting `filters` entirely.
 */
export interface ListTracksFilters {
  /** Inclusive lower BPM bound. */
  bpmMin?: number;
  /** Inclusive upper BPM bound. */
  bpmMax?: number;
  /** Camelot codes, e.g. `["8A", "9A"]`. */
  keyCamelot?: string[];
  analysisStatus?: AnalysisStatus[];
  genre?: string[];
  /** Inclusive minimum star rating (0–5). */
  ratingMin?: number;
  /** Inclusive minimum energy level (1–10). */
  energyMin?: number;
  /** Inclusive maximum energy level (1–10). */
  energyMax?: number;
}

/** Sort keys accepted by `list_tracks` (mirrors `SORT_KEYS` in Rust). */
export type ListTracksSortBy =
  "title" | "artist" | "bpm" | "key" | "duration" | "imported_at" | "rating" | "energy";

export type SortDirection = "asc" | "desc";

export interface ListTracksRequest {
  workspaceId?: string;
  query?: string;
  filters?: ListTracksFilters;
  limit?: number;
  offset?: number;
  sortBy?: ListTracksSortBy;
  sortDir?: SortDirection;
}

export interface ListTracksResponse {
  tracks: TrackSummary[];
  total: number;
}

/** One distinct genre in the library plus how many tracks carry it. */
export interface GenreCount {
  genre: string;
  count: number;
}

export interface ListGenresResponse {
  genres: GenreCount[];
}

export interface GetTrackRequest {
  trackId: string;
}

export interface GetTrackResponse {
  track: TrackDetail;
}

export interface GetArtworkRequest {
  trackId: string;
}

/**
 * `get_artwork` resolves to a `data:` URL, or `null` when the track has no
 * cached cover art.
 */
export type GetArtworkResponse = string | null;

// --- Track metadata writes (T2.1.4 rating, T2.1.6 energy) ---
// Every write is logged as a `skill_runs` row that holds the pre-write values,
// so the UI can offer a real Undo instead of a hopeful re-read.

/**
 * Patch applied to one or more tracks. An omitted field is left untouched;
 * `0` clears the value (the column is stored as NULL).
 */
export interface UpdateTrackMetadataRequest {
  /** Tracks to patch. Unknown ids are ignored. */
  trackIds: string[];
  /** Star rating 0–5. `0` clears the rating. */
  rating?: number;
  /** Energy level 1–10. `0` clears the energy (0 is outside the valid range). */
  energy?: number;
}

export interface UpdateTrackMetadataResponse {
  /** Id of the `skill_runs` row holding the undo snapshot. */
  undoId: string;
  /** Number of tracks actually changed. */
  updated: number;
}

/** Rating-only variant of `UpdateTrackMetadataRequest`. */
export interface SetTrackRatingRequest {
  trackIds: string[];
  /** Star rating 0–5. `0` clears the rating. */
  rating: number;
}

export interface SetTrackRatingResponse {
  undoId: string;
  updated: number;
}

export interface UndoTrackMetadataRequest {
  /** The `undoId` returned by the write command. */
  undoId: string;
}

export interface UndoTrackMetadataResponse {
  /** Number of tracks restored to their previous values. */
  restored: number;
}

// --- Analysis queue (T1.2.1 / T1.2.2): analyze_library + progress events ---
// Mirrors apps/desktop/src-tauri/src/models.rs (serde camelCase). The backend
// selects tracks needing analysis (version-aware unless force:true), runs the
// deterministic suite per track, and emits one `analysis:progress` per track
// plus a single `analysis:completed` when the queue drains.

export interface AnalyzeLibraryRequest {
  /** Track IDs to analyze; omit to analyze everything needing analysis. */
  trackIds?: string[];
  /** Re-analyze even when analysisVersion already matches. */
  force?: boolean;
}

export interface AnalyzeLibraryResponse {
  jobId: string;
  total: number;
}

export interface AnalysisProgressEvent {
  jobId: string;
  processed: number;
  total: number;
  trackId: string;
  filePath: string;
  analysisStatus: AnalysisStatus;
  error?: string | null;
}

export interface AnalysisCompletedEvent {
  jobId: string;
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}

// --- Similar tracks (A): local scoring, mirrors models.rs ---

export interface FindSimilarTracksRequest {
  trackId: string;
  /** Max results; clamped to 1–50 server-side. Defaults to 10. */
  limit?: number;
}

export interface SimilarTrackResult extends TrackSummary {
  /** Blended similarity in 0–1 (BPM 45% / key 35% / genre 10% / duration 10%). */
  score: number;
  /** UI chips, e.g. "same key 8A", "+1.2% BPM apart". */
  reasons: string[];
}

export interface FindSimilarTracksResponse {
  seedTrackId: string;
  results: SimilarTrackResult[];
}

// --- Tag health / enrichment gaps (B) ---

export interface TagHealthRequest {
  /** Restrict to these tracks; omit to scan the whole library. */
  trackIds?: string[];
  /** Max gap rows returned. Defaults to 200. */
  limit?: number;
}

export interface TrackGaps {
  trackId: string;
  title: string;
  artist: string;
  /** Field names missing or placeholder, e.g. "album", "bpm", "artwork", "isrc". */
  missing: string[];
  /** Tag Health Score 0–100 (identity fields weigh most). */
  score: number;
}

export interface TagHealthTotals {
  field: string;
  missingCount: number;
}

export interface TagHealthResponse {
  checked: number;
  withGaps: number;
  gaps: TrackGaps[];
  totals: TagHealthTotals[];
  /** Mean Tag Health Score over all checked tracks (100 = complete). */
  averageScore?: number | null;
}

// --- Store links + provider status (C) ---

export interface StoreLinksRequest {
  trackId: string;
}

export interface StoreLink {
  provider: string;
  label: string;
  url: string;
}

export interface StoreLinksResponse {
  trackId: string;
  artist: string;
  title: string;
  links: StoreLink[];
}

export interface ProviderAccount {
  id: string;
  provider: string;
  accountLabel: string;
  scopes: string[];
  expiresAt?: string | null;
  revokedAt?: string | null;
}

export type StreamingProviderKind =
  "spotify" | "deezer" | "apple_music" | "youtube_music" | "soundcloud" | "tidal";

export type StoreProviderKind =
  "beatport" | "traxsource" | "juno_download" | "bandcamp" | "discogs";

export interface ProviderStatusResponse {
  /** Connected, non-revoked accounts from `streaming_accounts`. */
  connected: ProviderAccount[];
  /** Streaming-export targets the matcher will support (`spotify` first). */
  supportedStreaming: StreamingProviderKind[];
  /** Buy-link stores available per track via `store_links_for_track`. */
  supportedStores: StoreProviderKind[];
  /** What works today per streaming target (TX.1). */
  capabilities: ProviderCapability[];
}

export interface ProviderCapability {
  provider: string;
  liveMatch: boolean;
  isrcSearch: boolean;
  playlistWrite: boolean;
  needsAppId: boolean;
}

// --- Online enrichment: preview → apply → undo (TE.1 / TE.3) ---

/** Confidence tier for a proposal or provider match. */
export type ConfidenceTier = "high" | "review" | "low";

/** Lifecycle status of a provider catalog match. */
export type ProviderMatchStatus = "matched" | "review" | "unmatched";

export type EnrichmentProviderKind =
  "musicbrainz" | "itunes" | "deezer" | "discogs" | "lastfm" | "acoustid";

export interface EnrichmentPreviewRequest {
  /** One provider per run. Defaults to "musicbrainz". */
  provider?: EnrichmentProviderKind;
  /** Restrict to these tracks; omit to scan gap tracks library-wide. */
  trackIds?: string[];
  /** Max tracks looked up. Defaults to 25. */
  limit?: number;
}

export interface ProposedChange {
  field: string;
  current?: string | null;
  proposed: string;
}

export interface TrackProposal {
  trackId: string;
  title: string;
  artist: string;
  provider: string;
  providerId: string;
  confidence: number;
  tier: ConfidenceTier;
  sourceUrl?: string | null;
  changes: ProposedChange[];
}

export interface EnrichmentPreviewResponse {
  runId: string;
  provider: string;
  proposedTracks: number;
  proposedChanges: number;
  skipped: number;
  proposals: TrackProposal[];
}

export interface EnrichmentProgressEvent {
  runId: string;
  processed: number;
  total: number;
  trackId: string;
  status: string;
}

export interface EnrichmentApplyRequest {
  runId: string;
  /** Subset to apply; omit to apply the whole run. */
  trackIds?: string[];
}

export interface EnrichmentApplyResponse {
  runId: string;
  applied: number;
  skipped: number;
}

export interface EnrichmentUndoRequest {
  runId: string;
}

export interface EnrichmentUndoResponse {
  runId: string;
  restored: number;
}

// --- Multi-provider matching (TX.2): live reads, no writes ---

export interface ProviderMatchTracksRequest {
  /** Only "deezer" today; anything else is `unsupported_provider`. */
  provider: string;
  trackIds: string[];
}

export interface ProviderTrackMatch {
  trackId: string;
  provider: string;
  providerId?: string | null;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  artworkUrl?: string | null;
  sourceUrl?: string | null;
  confidence: number;
  tier: ConfidenceTier;
  status: ProviderMatchStatus;
}

export interface ProviderMatchTracksResponse {
  provider: string;
  matches: ProviderTrackMatch[];
}

// --- Generic provider contract (TX.1): same matcher, set-scoped later ---

export interface ProviderMatchSetRequest {
  provider: string;
  trackIds?: string[];
  /** Waits on Phase 3 sets — pass trackIds today. */
  setId?: string;
}

export interface ProviderExportPlaylistRequest {
  provider: string;
  playlistName?: string;
  trackIds?: string[];
}

// --- Chart snapshots Tier 1 (TD.3): versioned data, local taste filter ---

export interface ChartEntryInput {
  position: number;
  title: string;
  artist: string;
  label?: string | null;
  isrc?: string | null;
  bpm?: number | null;
  keyCamelot?: string | null;
  artworkUrl?: string | null;
  sourceUrl?: string | null;
}

export interface ChartImportRequest {
  provider: string;
  chart: string;
  genre: string;
  snapshotDate: string;
  entries: ChartEntryInput[];
  replaceExisting?: boolean;
}

export interface ChartImportResponse {
  provider: string;
  chart: string;
  genre: string;
  snapshotDate: string;
  imported: number;
  skipped: number;
}

export interface ChartListRequest {
  provider?: string;
  chart?: string;
  genre?: string;
  /** Defaults to the latest imported date. */
  snapshotDate?: string;
  /** Seed for the taste score (60% tempo / 40% key). */
  seedTrackId?: string;
  limit?: number;
}

export interface ChartEntry {
  position: number;
  title: string;
  artist: string;
  label?: string | null;
  isrc?: string | null;
  bpm?: number | null;
  keyCamelot?: string | null;
  artworkUrl?: string | null;
  sourceUrl?: string | null;
  /** ISRC-exact join against the library. */
  owned: boolean;
  /** 0–1 vs the seed track; absent without seed/entry data. */
  tasteScore?: number | null;
}

export interface ChartListResponse {
  provider: string;
  chart: string;
  genre: string;
  snapshotDate: string;
  entries: ChartEntry[];
  total: number;
}
