-- Duplicate review state (T2.3.1).
--
-- duplicate_files: byte-identical copies the scanner skipped because their
-- fingerprint already belongs to a library row at a different path. They can
-- never be rows themselves (UNIQUE(workspace_id, file_hash)), so this is the
-- only record that the copy exists. Forgetting one deletes this row only —
-- never the file.
CREATE TABLE IF NOT EXISTS duplicate_files (
    file_path TEXT PRIMARY KEY,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    file_hash TEXT NOT NULL,
    detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_duplicate_files_track ON duplicate_files(track_id);

-- duplicate_dismissals: groups the user chose to keep ("Keep both"). The key
-- hashes the group's membership, so a dismissal lapses on its own when a track
-- joins or leaves the group.
CREATE TABLE IF NOT EXISTS duplicate_dismissals (
    group_key TEXT PRIMARY KEY,
    dismissed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
