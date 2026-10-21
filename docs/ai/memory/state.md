# Working state

Ephemeral. Newest first. **Rotate aggressively** — if a line would still be true
in two weeks, it belongs in [`decisions.md`](./decisions.md); if it is just a
fact, it belongs in [`facts.md`](./facts.md). Delete anything stale.

## 2026-10-21 · Phase 2 Slice 2 — rating + energy (T2.1.4 + T2.1.6)

- Branch `feat/T2.1.4-T2.1.6-rating-energy` (off `docs/T2.1.5-tick-phase2-expansion-T0.1.21`).
  **Nothing committed yet** — Slice 2 and the previous session's doc
  reconciliation are both uncommitted. `README.md` and `kilo.jsonc` are
  unrelated local edits; keep them out of the slice commit.
- New `tracks.energy INTEGER` column (migration `006_track_energy.sql`).
  `db.rs::without_applied_alters` only parses **single-line**
  `ALTER TABLE … ADD COLUMN`, so the migration must stay one physical line.
  `user_rating` already existed (nullable INTEGER).
- Reversible write path: `update_track_metadata({trackIds, rating?, energy?})`,
  `set_track_rating({trackIds, rating})`, `undo_track_metadata({undoId})`.
  `0` clears (stores NULL), an omitted field is untouched. The undo snapshot is
  a `skill_runs` row (`before_state`/`after_state` JSON, only the touched
  columns) written **in the same transaction** as the track UPDATE — hence
  `Database::conn_mut()` and `MutexGuard`'s `DerefMut` (`db_guard.conn_mut()`;
  `MutexGuard::get_mut()` does not exist on this toolchain).
- Sort: `rating`/`energy` are nullable → `ORDER BY <col> IS NULL, <col> DESC,
  id ASC`, default direction descending, `SORT_KEYS` is now 8 entries.
  `energyMin`/`energyMax` count as **one** filter group (1–10, inverted bounds
  rejected on both sides).
- Front end: `StarRating.tsx` + `EnergyBars.tsx` (new), the `energy`/`rating`
  column model entries, energy bounds in the filter panel, table multi-select
  (Ctrl/Cmd-click toggles, Shift-click takes a range) and an Undo toast inside
  the library view's `relative` container (6 s). Logic lives in pure
  `lib/*.ts` helpers tested with `node --test` — **there is no React component
  test harness in this repo** and the three Tauri commands have no handler
  test.
- **Open gap:** the full bulk-metadata flow (BulkActionBar, select-all) is
  still **T2.1.3**; Slice 2 ships only the table multi-select subset.
- Checks: `pnpm ci:local:portable` green (lint, typecheck, 83 desktop + 34
  agent tests, `cargo fmt`, `cargo clippy -D warnings`, 113+9+7+9+12 Rust
  tests). `cargo test -p dj-assistant-desktop` **cannot run here** —
  `STATUS_ENTRYPOINT_NOT_FOUND (0xC0000139)` from the Tauri-linked harness on
  the `x86_64-pc-windows-gnu` host (documented in `CHANGELOG.md`); use
  `pnpm rust:test:portable`.

## 2026-10-21 · Phase 2 roadmap reconciliation (docs only)

- `docs/sdd/04-TASKS.md` + the Library+Player plan were reconciled: T2.1.4 =
  rating only, T2.1.6 = all energy work, **T2.1.13 = comment editing** (it
  was dropped when T2.1.4 was rewritten; the `Edit tags…` editor now lists a
  Comment field in `docs/ui/03-LIBRARY-VIEW.md` §3.5).
- Row virtualization **does not exist** — `App.tsx` maps every row and no
  virtualizer is in `apps/desktop`. The plan’s Slice 0 no longer claims it,
  Slice 9 owns implementing it, and the T2.1.5 entry carries the caveat.

## 2026-10-21 · T2.1.5 column framework — PR #49

- PR #49 (`feat/T2.1.5-column-framework` → `main`) carries the Phase 2 plan
  (docs) and the slice. Commit `2ca8f6e3` closed the first greptile round:
  the table width follows the resize preview (`totalColumnWidth`) instead of
  stretching in `w-full`; auto-fit counts sort icons, chip/pill chrome and the
  artwork thumb; cells use `trackColumnTooltip` for the full comment, hash,
  both key notations and rating. The three threads are replied and resolved;
  the remaining review threads on the plan/diagram/picker are still open.
- The column model and persistence are in
  `apps/desktop/src/lib/library-columns.ts`; its 29 tests are in
  `apps/desktop/src/lib/library-columns.test.ts`; the checklist is
  `components/ColumnPicker.tsx`; the table header/cells in `App.tsx`
  render from the configured list.
- Verified in the dev-server browser with mock tracks: toggle, resize,
  reorder, double-click auto-fit, reset, reload persistence and wide-window
  widths all hold; the last identity column stays pinned. 77 desktop tests,
  workspace typecheck and lint pass.
- T2.1.5 is now a ticked row in `docs/sdd/04-TASKS.md`; the tracker runs
  T2.1.0–T2.1.13.

## 2026-10-20 · Automatic agent routing and communication

- `pnpm agent:preflight '<prompt>'` is now the entry point for every prompt:
  it returns memory lines, skills, the agent to delegate to, and the checks.
- `agents.registry.json` holds the routing data (agents, commands, verification
  groups, mirror map); `scripts/agent/` holds the tooling — `preflight.mjs`,
  `doctor.mjs`, `sync.mjs`, `lib.mjs`, plus `preflight.test.mjs`, run by
  `pnpm test:agent` (read the count from that command, not from here).
- The agent/command files are canonical in `.opencode/` and mirrored into every
  other tool directory by `pnpm agent:sync --write`; `pnpm agent:doctor` reports
  drift. The `/preflight` command was added to the same set.
- `docs/ai/COMMUNICATION.md` documents the delegation contract, the `RESULT`
  handoff, the board protocol, and file ownership.
- The memory reader now skips each file's intro paragraph, and generic verbs
  are dropped from memory queries — both were matching almost every prompt.

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
