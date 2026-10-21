# Working state

Ephemeral. Newest first. **Rotate aggressively** — if a line would still be true
in two weeks, it belongs in [`decisions.md`](./decisions.md); if it is just a
fact, it belongs in [`facts.md`](./facts.md). Delete anything stale.

## 2026-10-21 · Rekordbox pivot — `dj-query` built, MCP plan trimmed

- **The pivot:** the DJ runs **Rekordbox** (Pioneer CDJs), so Serato tooling
  and the Playwright MCP are **dropped**; `playwright-cli` + `ui-verification`
  cover UI checks. Recorded as **D-010**.
- **`dj-query` is built and verified** — `crates/core/src/bin/query.rs`,
  `[[bin]]` behind the existing `cli` feature. Read-only
  (`SQLITE_OPEN_READ_ONLY`), shares the app's `library_query` builder, and
  **adapts to an older schema** (`PRAGMA table_info` → `NULL AS <col>` for a
  missing optional column; a sort/filter needing a missing column fails with a
  fix-it message). WAL-safe: `immutable=1` fallback only when the `-wal` is
  empty. Summary SQL lives in `crates/core/src/library_stats.rs` (no
  rusqlite dependency in `core`), proven against a migrated schema in
  `tests/schema/tests/library_stats.rs`. `library_query::sort_column()` was
  added so the CLI can check a column exists before building a query.
- **Verified live** against `%APPDATA%\com.djassistant.desktop\dj_assistant.db`:
  94 tracks, 24 analysed, `complete 24 / failed 2 / needs_review 68`, 2 missing
  BPM, 2 missing key, 0 missing files. Checks: `cargo test -p
  dj-assistant-core --features cli` (120), `cargo test -p
  dj-assistant-schema-tests` (9+7+12), `cargo clippy -D warnings`, `cargo fmt
  --check`.
- **Docs rewritten** for the pivot: `docs/enhancements/mcb-plugin-audit.md`
  (new §3.3 "The Rekordbox finding", F-11…F-15, §7 answered + the one open
  question), `mcb-plugin-enhancement-plan.md` (§2.4 is now the Rust
  `dj-rekordbox` reader, not the Playwright MCP), and
  `mcp.recommended.jsonc` (trimmed to `dj-db` + deferred `dj-docs`; `dj-ui` and
  `dj-serato` removed).
- **`dj-rekordbox` is staged, not started** — it needs the DJ's exported
  `rekordbox.xml`; `master.db` is encrypted, so the export is the only readable
  interchange format and guessing the mapping would be untestable speculation.
- **Open:** produce the Rekordbox XML export (audit §7.1). Until then the
  Rekordbox gap stays open. `dj-docs` (Context7) stays deferred.

## 2026-10-21 · Phase 2 Slice 2 — rating + energy (T2.1.4 + T2.1.6)

- **PR #51** (`feat/T2.1.4-T2.1.6-rating-energy` → `main`), one commit
  `eca26ad4` on top of `origin/main`. The pending roadmap reconciliation and
  the MCP/plugin docs (`docs/enhancements/`) are folded into the same commit.
  `README.md` and `kilo.jsonc` were left out — they are unrelated local
  edits from another session.
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
