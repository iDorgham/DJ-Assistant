-- Migration 005: versioned chart snapshots (TD.3 Tier 1).
--
-- Beatport/Traxsource/Juno expose no stable public catalog API, so charts
-- enter as versioned snapshot data (imported JSON/CSV) filtered locally by
-- taste — never as live calls. One row per chart position; re-importing the
-- same (provider, chart, genre, snapshot_date) replaces it.
--
-- Still metadata only: positions, names, ISRCs, tempo/key, image and page
-- links. No audio, no prices, no purchase actions.

CREATE TABLE IF NOT EXISTS chart_snapshots (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    chart TEXT NOT NULL,
    genre TEXT NOT NULL,
    snapshot_date TEXT NOT NULL,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    label TEXT,
    isrc TEXT,
    bpm REAL,
    key_camelot TEXT,
    artwork_url TEXT,
    source_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (provider, chart, genre, snapshot_date, position)
);

CREATE INDEX IF NOT EXISTS idx_chart_snapshots_chart
    ON chart_snapshots(provider, chart, genre, snapshot_date, position);
CREATE INDEX IF NOT EXISTS idx_chart_snapshots_isrc ON chart_snapshots(isrc);
