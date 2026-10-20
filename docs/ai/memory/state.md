# Working state

Ephemeral. Newest first. **Rotate aggressively** — if a line would still be true
in two weeks, it belongs in [`decisions.md`](./decisions.md); if it is just a
fact, it belongs in [`facts.md`](./facts.md). Delete anything stale.

## 2026-10-20 · AI memory layers added

- Created `docs/ai/` (agents, skills, routing, memory) and consolidated the
  existing AI docs into it.
- Built the shared memory store: `AGENTS.md` + `docs/ai/memory/*`, with thin
  adapters for Qoder, Kilo Code, DeepSeek/Claude-style readers. FreeBuff and
  OpenCode read `AGENTS.md` directly.
- Enhanced the `skill-router` and `skill-maintainer` subagents for memory
  awareness; added `memory-keeper` and the `/remember` command.
- Implemented `scripts/memory/search.mjs` (`pnpm memory:search`), the contract
  `context-loader` and the `/audio`, `/tauri` commands already called — it did
  not exist before, so those calls silently failed.
- Skill library at **240 installed / 72 priority**, all advertised, ~15.4k
  tokens/step; audit clean (0 hard problems).

**Open questions from the library review — still unanswered:**

1. Install `sqlite-best-practices` and/or `rust-skills`? (SQLite/`rusqlite` has
   no coverage today.)
2. Prune the library to cut the ~15.4k tokens/step advertised cost? Candidates:
   Electron/Next.js/AWS/CI/Docker/desktop frameworks this repo does not use.
3. Clean overlaps? Remove exact-duplicate aliases (e.g.
   `prisma-database-setup`), merge design/E2E overlaps
   (`e2e-testing-patterns`/`end-to-end-testing` vs `playwright`;
   `better-interface` vs the six `better-*`; the taste-skill style variants).

**Status:** the skill-routing docs and review evidence landed in PR #47 (squash
`859b18c6`, 2026-10-20). The memory store described above was authored after
that merge and is tracked separately — do not record commit state here, since
this file ships in the very commits it would be describing.
