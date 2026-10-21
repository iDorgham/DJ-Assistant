use serde::{Deserialize, Serialize};

use dj_assistant_core::library_query::TrackFilters;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackSummary {
    pub id: String,
    pub file_path: String,
    pub file_hash: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub bpm: Option<f64>,
    pub key_camelot: Option<String>,
    pub key_classical: Option<String>,
    pub duration_ms: i64,
    pub format: Option<String>,
    pub analysis_status: String,
    pub user_rating: Option<i64>,
    pub energy: Option<i64>,
    pub comments: Option<String>,
    pub artwork_hash: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CuePoint {
    pub id: String,
    pub track_id: String,
    pub slot: Option<i64>,
    pub position_ms: i64,
    pub label: String,
    pub cue_type: String,
    pub color_hex: Option<String>,
    pub source: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackDetail {
    #[serde(flatten)]
    pub summary: TrackSummary,
    pub file_size: i64,
    pub sample_rate: Option<i64>,
    pub channels: Option<i64>,
    pub bit_depth: Option<i64>,
    pub loudness_lufs: Option<f64>,
    pub vocal_presence: Option<bool>,
    pub phrase_confidence: Option<f64>,
    pub analysis_version: Option<String>,
    pub cues: Vec<CuePoint>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFolderRequest {
    pub path: String,
    pub recursive: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFolderResponse {
    pub job_id: String,
    pub estimated_files: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressEvent {
    pub job_id: String,
    pub scanned_files: usize,
    pub total_files: usize,
    pub current_path: String,
    pub imported_track: Option<TrackSummary>,
    pub is_duplicate: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCompletedEvent {
    pub job_id: String,
    pub total_scanned: usize,
    pub total_imported: usize,
    pub total_duplicates: usize,
    pub total_errors: usize,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTracksRequest {
    pub workspace_id: Option<String>,
    pub query: Option<String>,
    /// Structured narrowing (BPM range, keys, statuses, genres, rating,
    /// energy). `None` and an all-empty filter set are equivalent (no
    /// narrowing).
    #[serde(default)]
    pub filters: Option<TrackFilters>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
}

impl ListTracksRequest {
    /// Converts the IPC payload into the Tauri-free query description used by
    /// [`dj_assistant_core::library_query::TrackQuery::build`].
    pub fn into_query(self) -> dj_assistant_core::library_query::TrackQuery {
        dj_assistant_core::library_query::TrackQuery {
            query: self.query,
            filters: self.filters.unwrap_or_default(),
            sort_by: self.sort_by,
            sort_dir: self.sort_dir,
        }
    }
}

/// One distinct genre in the library plus how many tracks carry it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenreCount {
    pub genre: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListGenresResponse {
    pub genres: Vec<GenreCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTracksResponse {
    pub tracks: Vec<TrackSummary>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetTrackRequest {
    pub track_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetArtworkRequest {
    pub track_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetTrackResponse {
    pub track: TrackDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeLibraryRequest {
    /// Track IDs to analyze. `None` analyzes all tracks that need analysis.
    pub track_ids: Option<Vec<String>>,
    /// Re-analyze even when `analysis_version` already matches (API_CONTRACTS.md).
    pub force: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeLibraryResponse {
    pub job_id: String,
    pub total: usize,
}

/// Emitted per track as it finishes analysis, so the UI can update a
/// per-track row and an overall progress bar.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisProgressEvent {
    pub job_id: String,
    pub processed: usize,
    pub total: usize,
    pub track_id: String,
    pub file_path: String,
    pub analysis_status: String,
    pub error: Option<String>,
}

/// Emitted once the queue drains.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisCompletedEvent {
    pub job_id: String,
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub duration_ms: u128,
}

// --- Similar tracks (A): local scoring, no network ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FindSimilarTracksRequest {
    pub track_id: String,
    /// Max results; clamped to 1–50 server-side. Defaults to 10.
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimilarTrackResult {
    #[serde(flatten)]
    pub track: TrackSummary,
    /// Blended similarity in `0.0..=1.0` (BPM 45% / key 35% / genre 10% /
    /// duration 10%, renormalised over available signals).
    pub score: f64,
    /// UI chips, e.g. `"same key 8A"`, `"+1.2% BPM apart"`.
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FindSimilarTracksResponse {
    pub seed_track_id: String,
    pub results: Vec<SimilarTrackResult>,
}

// --- Tag health / enrichment gaps (B): local detection, no network ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagHealthRequest {
    /// Restrict to these tracks; omit to scan the whole library.
    pub track_ids: Option<Vec<String>>,
    /// Max gap rows returned. Defaults to 200.
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackGaps {
    pub track_id: String,
    pub title: String,
    pub artist: String,
    /// Field names missing or placeholder, e.g. `"album"`, `"bpm"`,
    /// `"artwork"`, `"isrc"`. `"artist"` means "Unknown Artist".
    pub missing: Vec<String>,
    /// Tag Health Score 0–100 (TE.4): identity fields weigh most.
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagHealthTotals {
    pub field: String,
    pub missing_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagHealthResponse {
    pub checked: usize,
    pub with_gaps: usize,
    pub gaps: Vec<TrackGaps>,
    pub totals: Vec<TagHealthTotals>,
    /// Mean Tag Health Score over all checked tracks (100 = complete).
    pub average_score: Option<f64>,
}

// --- Store links + provider status (C): links are pure URLs, no API ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreLinksRequest {
    pub track_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreLink {
    pub provider: String,
    pub label: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreLinksResponse {
    pub track_id: String,
    pub artist: String,
    pub title: String,
    pub links: Vec<StoreLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderAccount {
    pub id: String,
    pub provider: String,
    pub account_label: String,
    pub scopes: Vec<String>,
    pub expires_at: Option<String>,
    pub revoked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCapability {
    pub provider: String,
    pub live_match: bool,
    pub isrc_search: bool,
    pub playlist_write: bool,
    pub needs_app_id: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatusResponse {
    /// Connected, non-revoked accounts from `streaming_accounts`.
    pub connected: Vec<ProviderAccount>,
    /// Streaming-export targets the matcher will support (`spotify` first).
    pub supported_streaming: Vec<String>,
    /// Buy-link stores available per track via `store_links_for_track`.
    pub supported_stores: Vec<String>,
    /// What works today per streaming target (TX.1).
    pub capabilities: Vec<ProviderCapability>,
}

// --- Online enrichment: preview → apply → undo (TE.1 / TE.3) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentPreviewRequest {
    /// One provider per run: "musicbrainz" (default), "itunes", "deezer", "discogs", "lastfm", or "acoustid" (pending local fingerprinting).
    pub provider: Option<String>,
    /// Restrict to these tracks; omit to scan gap tracks library-wide.
    pub track_ids: Option<Vec<String>>,
    /// Max tracks looked up; default 25, clamped 1–50 (free APIs are shared).
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposedChange {
    pub field: String,
    pub current: Option<String>,
    pub proposed: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackProposal {
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub provider: String,
    pub provider_id: String,
    pub confidence: f64,
    /// "high" | "review" | "low".
    pub tier: String,
    pub source_url: Option<String>,
    pub changes: Vec<ProposedChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentPreviewResponse {
    pub run_id: String,
    pub provider: String,
    pub proposed_tracks: usize,
    pub proposed_changes: usize,
    pub skipped: usize,
    pub proposals: Vec<TrackProposal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentProgressEvent {
    pub run_id: String,
    pub processed: usize,
    pub total: usize,
    pub track_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentApplyRequest {
    pub run_id: String,
    /// Subset to apply; omit to apply the whole run.
    pub track_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentApplyResponse {
    pub run_id: String,
    pub applied: usize,
    pub skipped: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentUndoRequest {
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichmentUndoResponse {
    pub run_id: String,
    pub restored: usize,
}

// --- Multi-provider matching (TX.2): live reads, no writes ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderMatchTracksRequest {
    /// Only "deezer" today; anything else is `unsupported_provider`.
    pub provider: String,
    pub track_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderTrackMatch {
    pub track_id: String,
    pub provider: String,
    pub provider_id: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub artwork_url: Option<String>,
    pub source_url: Option<String>,
    pub confidence: f64,
    /// "high" | "review" | "low".
    pub tier: String,
    /// "matched" | "review" | "unmatched".
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderMatchTracksResponse {
    pub provider: String,
    pub matches: Vec<ProviderTrackMatch>,
}

/// Generic set match (TX.1): same matcher behind the provider contract.
/// `set_id` waits on Phase 3 sets — pass `track_ids` today.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderMatchSetRequest {
    pub provider: String,
    pub track_ids: Option<Vec<String>>,
    pub set_id: Option<String>,
}

/// Playlist publishing (TX.2b / TP): not wired yet — the command returns
/// `not_configured` naming the missing credential.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderExportPlaylistRequest {
    pub provider: String,
    pub playlist_name: Option<String>,
    pub track_ids: Option<Vec<String>>,
}

// --- Chart snapshots Tier 1 (TD.3): versioned data, local taste filter ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartEntryInput {
    pub position: i64,
    pub title: String,
    pub artist: String,
    pub label: Option<String>,
    pub isrc: Option<String>,
    pub bpm: Option<f64>,
    pub key_camelot: Option<String>,
    pub artwork_url: Option<String>,
    pub source_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartImportRequest {
    pub provider: String,
    pub chart: String,
    pub genre: String,
    pub snapshot_date: String,
    pub entries: Vec<ChartEntryInput>,
    /// Replace the same (provider, chart, genre, date). Defaults to true.
    pub replace_existing: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartImportResponse {
    pub provider: String,
    pub chart: String,
    pub genre: String,
    pub snapshot_date: String,
    pub imported: usize,
    pub skipped: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartListRequest {
    pub provider: Option<String>,
    pub chart: Option<String>,
    pub genre: Option<String>,
    /// Defaults to the latest imported date.
    pub snapshot_date: Option<String>,
    /// Seed for the taste score (60% tempo / 40% key).
    pub seed_track_id: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartEntry {
    pub position: i64,
    pub title: String,
    pub artist: String,
    pub label: Option<String>,
    pub isrc: Option<String>,
    pub bpm: Option<f64>,
    pub key_camelot: Option<String>,
    pub artwork_url: Option<String>,
    pub source_url: Option<String>,
    /// ISRC-exact join against the library.
    pub owned: bool,
    /// 0–1 vs the seed track; `None` without seed/entry data.
    pub taste_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartListResponse {
    pub provider: String,
    pub chart: String,
    pub genre: String,
    pub snapshot_date: String,
    pub entries: Vec<ChartEntry>,
    pub total: usize,
}

// --- Track metadata write path: rating + energy (T2.1.4 / T2.1.6) ---

/// Patch applied to one or more tracks. An absent field is left untouched;
/// `0` clears the value (the column is stored as NULL).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTrackMetadataRequest {
    /// Tracks to patch. Unknown ids are ignored.
    pub track_ids: Vec<String>,
    /// Star rating 0–5. `0` clears the rating.
    pub rating: Option<i64>,
    /// Energy level 1–10. `0` clears the energy (0 is outside the valid range).
    pub energy: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTrackMetadataResponse {
    /// Id of the `skill_runs` row holding the undo snapshot.
    pub undo_id: String,
    /// Number of tracks actually changed.
    pub updated: usize,
}

/// Rating-only variant of [`UpdateTrackMetadataRequest`].
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTrackRatingRequest {
    pub track_ids: Vec<String>,
    /// Star rating 0–5. `0` clears the rating.
    pub rating: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTrackRatingResponse {
    pub undo_id: String,
    pub updated: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoTrackMetadataRequest {
    /// The `undoId` returned by the write command.
    pub undo_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoTrackMetadataResponse {
    /// Number of tracks restored to their previous values.
    pub restored: usize,
    /// Number of tracks skipped because they were edited again after the
    /// snapshot was taken, so restoring would overwrite the newer edit.
    pub skipped: usize,
}
