-- WARNING: DO NOT RUN THIS ON THE PRODUCTION DATABASE
-- This script is intended ONLY for copies of the live DB used during QA testing.
-- Running this on %APPDATA%\com.djassistant.desktop\dj_assistant.db will permanently
-- reset user ratings and energy values.
--
-- The reset is a single UPDATE so SQLite prepares the whole statement before
-- changing either field: a two-statement script where the energy UPDATE fails
-- would still leave the rating UPDATE committed under the outer transaction,
-- producing a misleading partial baseline. One statement is atomic here.
--
-- There is no path guard in this file: plain SQL cannot inspect the name of the
-- database it is run against, so the only thing standing between this script and
-- the live library is the operator pointing the CLI at a copy. Be explicit:
--   sqlite3 "path/to/dj_assistant_qa_copy.db" < scripts/reset_qa_baseline.sql
-- Never run it with no argument, and never against %APPDATA%.

BEGIN TRANSACTION;

-- Reset user-assigned ratings and energy to pristine state (0 rated, 0 energy).
-- Both columns clear in one statement, so either both reset or neither does.
UPDATE tracks
   SET user_rating = NULL,
       energy = NULL
 WHERE user_rating IS NOT NULL
    OR energy IS NOT NULL;

COMMIT;

-- Verification queries (run against the COPY only):
-- SELECT COUNT(*) FROM tracks WHERE user_rating IS NOT NULL;  -- should be 0
-- SELECT COUNT(*) FROM tracks WHERE energy IS NOT NULL;        -- should be 0
