---
description: Match this task to installed agent skills and load the best ones
---

Match this task to installed agent skills, load the winners, then do the task.

1. Run `node scripts/skills/match.mjs --top 3 "<short task summary>"`.
2. Load each returned skill ID with the `skill` tool.
3. If nothing matches, continue as normal — do not block on routing.

Task: $ARGUMENTS
