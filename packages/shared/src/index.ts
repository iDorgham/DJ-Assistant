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

export interface ListTracksRequest {
  workspaceId?: string;
  query?: string;
  filters?: {
    bpmMin?: number;
    bpmMax?: number;
    keyCamelot?: string[];
    analysisStatus?: AnalysisStatus[];
    genre?: string[];
  };
  limit?: number;
  offset?: number;
  sortBy?: "title" | "artist" | "bpm" | "key" | "duration" | "imported_at";
  sortDir?: "asc" | "desc";
}

export interface ListTracksResponse {
  tracks: TrackSummary[];
  total: number;
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
