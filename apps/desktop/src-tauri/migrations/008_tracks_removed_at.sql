-- Soft-removal marker for "Remove from library". A NULL column means the track
-- is present; a timestamp means it has been removed from the library while the
-- row, its cue points and its tags stay on disk and in the database. A hard
-- DELETE would cascade away the analysis the user paid CPU for and could never
-- be undone. Keep this ALTER on one line: the migration filter parses
-- single-line `ADD COLUMN` statements.
ALTER TABLE tracks ADD COLUMN removed_at TEXT;
