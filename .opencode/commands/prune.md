---
description: Prune the machine-global skill library down to the skills this project uses
---

Prune the machine-global agent skill library using the project's audited prune
list, then report what changed.

1. Run `node scripts/skills/prune.mjs` first. It is a **dry run**: it reports
   the skills the list would remove, the reason for each, and the advertised
   token cost that goes with them. Show me that report before touching
   anything.
2. Only after I say go, run `node scripts/skills/prune.mjs --apply`. It
   **moves** the listed skills into a timestamped backup next to the library —
   it never deletes — and prints the restore command.
3. Run `node scripts/skills/audit.mjs` afterwards to confirm the remaining
   library is intact, and `node scripts/agent/doctor.mjs` to confirm the
   routing configuration still resolves.

To put skills back: `node scripts/skills/prune.mjs --restore <backup-dir>`.

$ARGUMENTS
