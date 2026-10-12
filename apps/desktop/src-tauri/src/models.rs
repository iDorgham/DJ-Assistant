use serde::{Deserialize, Serialize};

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
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_dir: Option<String>,
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
