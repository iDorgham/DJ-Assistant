-- Migration 004: enrichment run history + per-field proposals.
--
-- `enrichment_runs` gains the Skill undo pattern (`before_state` /
-- `after_state` JSON snapshots) so `enrichment_undo` restores exact values.
-- `enrichment_candidates` persists preview proposals between the preview and
-- apply steps (and across restarts) so apply never re-fetches.
--
-- Still metadata only: provider IDs, field diffs and image URLs. Audio
-- preview/stream URLs from provider responses are never fetched and never
-- stored here.

ALTER TABLE enrichment_runs ADD COLUMN before_state TEXT;
ALTER TABLE enrichment_runs ADD COLUMN after_state TEXT;

CREATE TABLE IF NOT EXISTS enrichment_candidates (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES enrichment_runs(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'review',
    field TEXT NOT NULL,
    current_value TEXT,
    proposed_value TEXT NOT NULL,
    artwork_url TEXT,
    source_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enrichment_candidates_run ON enrichment_candidates(run_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_candidates_track ON enrichment_candidates(track_id);
