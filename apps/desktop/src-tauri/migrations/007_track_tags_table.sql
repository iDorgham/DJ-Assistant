-- Migration 007: user-assigned tags (Slice 3A — T2.1.7) and the label field.
--
-- Custom tags live in their own table: one row per (track, tag) pair. That
-- makes the tag filter a plain indexed lookup, keeps the tag set a real set
-- (no delimiter escaping, no duplicate rows), and gives the Tag Surgeon
-- (T2.2) a table to clean up later.
--
-- `label` is a record label / publisher. It has no import source — the file
-- tag extractor never reads a publisher tag — so it is a field the user
-- types. The column exists ahead of that data so the enrichment work can
-- fill it later without another migration.
--
-- NOTE: the ALTER below must stay on ONE physical line. `db.rs::without_applied_alters`
-- parses single-line `ALTER TABLE ... ADD COLUMN` statements only, so a
-- wrapped statement would not be filtered out on a retry after a crash
-- between the ALTER and the version stamp.

ALTER TABLE tracks ADD COLUMN label TEXT;

CREATE TABLE IF NOT EXISTS track_tags (
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (track_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_track_tags_tag ON track_tags(tag);
