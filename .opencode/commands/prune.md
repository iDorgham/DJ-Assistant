---
description: Prune the installed skill library down to the skills this project uses
---

Prune the agent skill library using the project's audited prune list, then
report what changed.

1. Run `node scripts/skills/prune.mjs` first. It is a **dry run**: it reports
   the skills the list would remove, the reason for each, and the advertised
   token cost that goes with them. Show me that report before touching
   anything.
2. Only after I say go, run `node scripts/skills/prune.mjs --apply`. It
   **moves** the listed skills into timestamped backups — it never deletes —
   and prints a restore command for each backup. A skill installed in more
   than one place is moved from **every** place, because a copy left behind
   would still be advertised; the backup records each copy's own path so the
   restore puts them all back. The tool refuses to run at all if the policy
   puts a hot (priority) skill on the prune list.
3. Run `node scripts/skills/audit.mjs` afterwards to confirm the remaining
   library is intact, and `node scripts/agent/doctor.mjs` to confirm the
   routing configuration still resolves.

To put skills back: `node scripts/skills/prune.mjs --restore <backup-dir>`.

$ARGUMENTS
