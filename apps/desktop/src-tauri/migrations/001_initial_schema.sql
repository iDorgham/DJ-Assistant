-- Initial schema migration for DJ Assistant
-- Matches docs/DATA_MODEL.md & docs/sdd/04-TASKS.md T0.2.8

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default local workspace
INSERT OR IGNORE INTO workspaces (id, name, created_at)
VALUES ('default', 'Primary Library', datetime('now'));

CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    sample_rate INTEGER,
    channels INTEGER,
    bit_depth INTEGER,
    format TEXT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    genre TEXT,
    year INTEGER,
    bpm REAL,
    key_camelot TEXT,
    key_classical TEXT,
    loudness_lufs REAL,
    spectral_brightness REAL,
    vocal_presence INTEGER DEFAULT 0,
    phrase_confidence REAL,
    analysis_status TEXT NOT NULL DEFAULT 'pending',
    analysis_version TEXT,
    user_rating INTEGER,
    play_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT unique_hash_per_workspace UNIQUE(workspace_id, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_tracks_file_hash ON tracks(file_hash);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_title ON tracks(artist, title);
CREATE INDEX IF NOT EXISTS idx_tracks_analysis_status ON tracks(analysis_status);

CREATE TABLE IF NOT EXISTS cue_points (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position_ms INTEGER NOT NULL,
    cue_type TEXT NOT NULL, -- 'hot_cue', 'memory_cue', 'loop'
    slot INTEGER,           -- hot cue slot 1-8 (A-H); NULL for memory cues / loops
    label TEXT NOT NULL,
    color_hex TEXT DEFAULT '#3b82f6',
    source TEXT NOT NULL, -- 'ai_generated', 'user_custom', 'imported'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS skill_runs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'started', 'success', 'failed', 'undone'
    input_summary TEXT,
    before_state TEXT,
    after_state TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
