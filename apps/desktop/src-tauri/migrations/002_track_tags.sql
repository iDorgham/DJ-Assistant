-- Migration 002: tag-sourced library fields (thin vertical slice).
--
-- Adds the columns needed to surface what is already inside the file tags, without
-- full ONNX analysis: user comments and a content-addressed reference to embedded
-- cover art. BPM / key / rating reuse the existing `bpm`, `key_camelot`,
-- `key_classical` and `user_rating` columns from migration 001.
--
-- Artwork is cached to disk under a BLAKE3 content hash; only the reference is
-- stored, never the image bytes, so the database stays small.

ALTER TABLE tracks ADD COLUMN comments TEXT;
ALTER TABLE tracks ADD COLUMN artwork_hash TEXT;
ALTER TABLE tracks ADD COLUMN artwork_path TEXT;
ALTER TABLE tracks ADD COLUMN artwork_mime TEXT;

CREATE INDEX IF NOT EXISTS idx_tracks_artwork_hash ON tracks(artwork_hash);
