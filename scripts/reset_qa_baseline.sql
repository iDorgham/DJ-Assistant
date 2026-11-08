-- WARNING: DO NOT RUN THIS ON THE PRODUCTION DATABASE
-- This script is intended ONLY for copies of the live DB used during QA testing.
-- Running this on %APPDATA%\com.djassistant.desktop\dj_assistant.db will permanently
-- reset user ratings and energy values.

BEGIN TRANSACTION;

-- Reset user-assigned ratings and energy to pristine state (0 rated, 0 energy)
UPDATE tracks SET user_rating = NULL WHERE user_rating IS NOT NULL;
UPDATE tracks SET energy = NULL WHERE energy IS NOT NULL;

COMMIT;

-- Verification queries (run against the COPY only):
-- SELECT COUNT(*) FROM tracks WHERE user_rating IS NOT NULL;  -- should be 0
-- SELECT COUNT(*) FROM tracks WHERE energy IS NOT NULL;        -- should be 0
