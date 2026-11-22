-- Migration 010: import-time metadata fields (Traktor / Rekordbox / Serato parity).
--
-- Every column here has a real file-tag source; the scanner fills it on import
-- and the library table exposes it as an opt-in column. NULL means the file
-- carried no such tag and the table renders a dash, never a fake value.
--
-- label (migration 007) becomes importable too, so the extractor now writes it.
-- label_user_set records that the user typed or cleared a label themselves,
-- which lets a future re-import refresh the file-derived value without
-- resurrecting a label the user deliberately cleared.
--
-- bitrate_kbps is derived from file size and duration at scan time: the track
-- summary has no file-size column (it is detail-only), so this is the one value
-- the table cannot compute from what it already receives.
--
-- NOTE: each ALTER must stay on ONE physical line. db.rs::without_applied_alters
-- parses single-line ALTER TABLE ... ADD COLUMN statements only, so a wrapped
-- statement would not be filtered out on a retry after a crash between the
-- ALTER and the version stamp.

ALTER TABLE tracks ADD COLUMN comment_2 TEXT;
ALTER TABLE tracks ADD COLUMN composer TEXT;
ALTER TABLE tracks ADD COLUMN album_artist TEXT;
ALTER TABLE tracks ADD COLUMN remixer TEXT;
ALTER TABLE tracks ADD COLUMN producer TEXT;
ALTER TABLE tracks ADD COLUMN grouping TEXT;
ALTER TABLE tracks ADD COLUMN track_number INTEGER;
ALTER TABLE tracks ADD COLUMN disc_number INTEGER;
-- isrc is already added by migration 003 (the chart and enrichment join key).
ALTER TABLE tracks ADD COLUMN catalog_number TEXT;
ALTER TABLE tracks ADD COLUMN release_date TEXT;
ALTER TABLE tracks ADD COLUMN copyright TEXT;
ALTER TABLE tracks ADD COLUMN mood TEXT;
ALTER TABLE tracks ADD COLUMN mix_name TEXT;
ALTER TABLE tracks ADD COLUMN lyrics TEXT;
ALTER TABLE tracks ADD COLUMN bitrate_kbps INTEGER;
ALTER TABLE tracks ADD COLUMN label_user_set INTEGER NOT NULL DEFAULT 0;