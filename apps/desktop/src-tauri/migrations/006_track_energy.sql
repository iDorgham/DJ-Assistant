-- User-assigned energy level (1-10) shown as charging bars in the library table.
-- NULL means "not set"; 0 is stored as NULL by the write path, so the column
-- only ever holds 1-10. The CHECK keeps direct SQL and future writers inside
-- that range. Keep this ALTER on one line: the migration filter parses
-- single-line `ADD COLUMN` statements.
ALTER TABLE tracks ADD COLUMN energy INTEGER CHECK (energy IS NULL OR (energy >= 1 AND energy <= 10));
