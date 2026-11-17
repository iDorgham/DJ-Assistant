-- Beat-grid confidence (T2.4.3): the alignment ratio the BPM detector reported
-- for this track, `0..=1`, written by `persist_analysis_results`. NULL until a
-- track is (re-)analysed — the player hides the confidence chip rather than
-- showing a stale or invented value. Keep this ALTER on one line: the
-- migration filter parses single-line `ADD COLUMN` statements.
ALTER TABLE tracks ADD COLUMN beatgrid_confidence REAL;
