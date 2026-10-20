---
description: Automatic brief for any task — memory, skills, agents, and checks
---

Run the automatic routing brief for this task, then act on it.

1. Run `node scripts/agent/preflight.mjs --json '<task>'`. Keep the task in
   single quotes — the shell expands `$(…)` and backticks inside double quotes —
   or pipe it: `node scripts/agent/preflight.mjs --json --stdin`.
2. Load each returned skill ID with the `skill` tool.
3. If the brief names an agent, delegate to it — pass the goal, the scope, the
   skills, the checks, and the handoff contract from `docs/ai/COMMUNICATION.md`
   (§4 and §5).
4. Apply the memory lines from the brief before deciding anything.
5. Run the checks the brief lists before reporting the work as done.
6. If nothing matched, continue normally — routing never blocks the work.

Task: $ARGUMENTS
