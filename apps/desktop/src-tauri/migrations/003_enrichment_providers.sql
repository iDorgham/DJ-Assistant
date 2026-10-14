-- Migration 003: enrichment + multi-provider foundations.
--
-- Unblocks three tracks without any network access yet:
--
-- A. Similar tracks: no schema needed (scores computed from existing columns).
-- B. Missing tags / artwork enrichment: `isrc` is the join key every online
--    provider matches on; `external_ids` caches per-provider IDs with a
--    confidence so re-runs never re-query; `enrichment_runs` records
--    preview → apply → undo history per the Tag Surgeon pattern.
-- C. Multi-provider export: `streaming_accounts` / `streaming_exports` /
--    `streaming_matches` are the desktop-local tables from the data model
--    (DATA_MODEL.md §2). `provider` is a free TEXT enum (`spotify`,
--    `deezer`, `apple_music`, ...) so new targets extend rows, not schema.
--    Tokens always live in the OS keychain — `token_ref` is a keychain key,
--    never a token.
--
-- Only metadata and search queries ever leave the device; audio is never
-- downloaded, streamed, stored, or uploaded (ADR-0006, ADR-0007).

ALTER TABLE tracks ADD COLUMN isrc TEXT;

CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc);

-- Cached provider-side IDs for one local track (MusicBrainz MBID, Discogs
-- release, Deezer/Spotify track id, ...). Written by enrichment runs only.
CREATE TABLE IF NOT EXISTS external_ids (
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (track_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_external_ids_provider ON external_ids(provider, provider_id);

-- One enrichment pass over N tracks: what was proposed, applied, or undone.
CREATE TABLE IF NOT EXISTS enrichment_runs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'preview',
    proposed_count INTEGER NOT NULL DEFAULT 0,
    applied_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The DJ's connected streaming accounts (one row per provider account).
CREATE TABLE IF NOT EXISTS streaming_accounts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    account_label TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '[]',
    token_ref TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_streaming_accounts_provider ON streaming_accounts(provider);

-- Each run that published a local set to a provider playlist (for undo).
CREATE TABLE IF NOT EXISTS streaming_exports (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    set_id TEXT,
    provider_playlist_id TEXT NOT NULL,
    playlist_name TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    status TEXT NOT NULL DEFAULT 'created',
    matched_count INTEGER NOT NULL DEFAULT 0,
    unmatched_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-track match result for an export (matched / review / unmatched).
CREATE TABLE IF NOT EXISTS streaming_matches (
    id TEXT PRIMARY KEY,
    export_id TEXT NOT NULL REFERENCES streaming_exports(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    provider_track_uri TEXT,
    method TEXT,
    confidence REAL,
    status TEXT NOT NULL DEFAULT 'unmatched',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_streaming_matches_export ON streaming_matches(export_id);
