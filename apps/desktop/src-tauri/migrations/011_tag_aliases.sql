-- Migration 011: tag spelling aliases (Tag Surgeon T2.2.5).
--
-- An alias maps one tag spelling to the canonical spelling it should be saved
-- as. It is applied when tags are written (the metadata editor and bulk edits),
-- never to tracks already in the library. alias_key is the fold key of the
-- alias (see normalize_tag), so "Melodic H." and "melodic h" are one alias.
-- alias keeps the spelling the user typed, for display.
CREATE TABLE IF NOT EXISTS tag_aliases (
    alias_key TEXT PRIMARY KEY,
    alias TEXT NOT NULL,
    canonical TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
