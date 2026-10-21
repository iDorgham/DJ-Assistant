# Working state

Ephemeral. Newest first. **Rotate aggressively** — if a line would still be true
in two weeks, it belongs in [`decisions.md`](./decisions.md); if it is just a
fact, it belongs in [`facts.md`](./facts.md). Delete anything stale.

## 2026-10-22 · Routing is domain-gated; the skill library is pruned, not hidden

- **The problem was measured, not guessed.** One shared adjective was enough to
  select a skill, and BM25's inverse document frequency made the *rarest* such
  word the most valuable. On a task about the agent layer and shared memory
  the preflight offered `performance-and-perceived-speed` ("speed"),
  `memory-safety-patterns` ("memory") and `upstash-redis-js` ("agents",
  "memory", "tools") — three wrong skills injected on every such prompt, in
  every tool. The library already carried the domain grouping the fix needed;
  the matcher never read it. See F-007.
- **Three gates now decide what is offered** (D-011): a curated trigger wins
  outright; otherwise the prompt must name the skill in a word that is not
  domain-neutral; otherwise two independent hits are required. A skill outside
  the prompt's **active domains** is scored down, not dropped, so a
  mis-resolved domain still leaves the right answer reachable.
- **Domains come from three signals, ranked**: the **files in play** say where
  the work *is* and always win; the **prompt vocabulary** is a weak signal and
  the domain with the most distinct prompt *words* wins (a tie keeps them all);
  the **routed subagent** is the last resort, because it owns a whole tree and
  is coarser than the paths. A vague "fix this" over `crates/core/**` resolves
  to Rust + API and offers that domain's defaults. "library" is deliberately
  *not* an audio keyword — it names the whole app, so it would pull every
  library task into the music domain.
- **The policy is the place the judgement lives**: `domains`, `pathDomains`,
  `genericTokens`, `inject.offDomainPenalty` and `prune` (one entry per skill,
  each with its reason) are all in `skills.policy.json` — not in the shared
  memory, because they are machine-global state.
- **Speed.** The whole library is advertised to the model on every step in
  every tool whether or not a skill is loaded; that advertising cost, not the
  routing, was the dominant spend. The `prune` list plus **`pnpm skills:prune`**
  (dry run by default; `--apply` *moves* every installed copy of the listed
  skills into a timestamped backup — a copy left anywhere would still be
  advertised — and `--restore <dir>` puts each copy back from the backup's
  manifest) removes it. A parsed-skill cache under
  `node_modules/.cache/` cut the preflight time noticeably.
- **The policy had been claiming something untrue**: the duplicates were
  marked with a hidden-related reason and `builtinHidden` named
  `playwright-cli` as hidden — but nothing was hidden, the whole library was
  advertised and paid for. See F-008; the duplicates now carry a real prune
  list.
- Checks: `pnpm test:agent` passes; `pnpm agent:doctor` is clean; the audit
  reports no hard problems.

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
  BPM, 2 missing key, 0 missing files.
- **`dj-rekordbox` is staged, not started** — it needs the DJ's exported
  `rekordbox.xml`; `master.db` is encrypted, so the export is the only readable
  interchange format and guessing the mapping would be untestable speculation.
- **Open:** produce the Rekordbox XML export (audit §7.1). Until then the
  Rekordbox gap stays open. `dj-docs` (Context7) stays deferred.

## 2026-10-21 · Phase 2 Slice 2 — rating + energy (T2.1.4 + T2.1.6)

- New `tracks.energy INTEGER` column (migration `006_track_energy.sql`).
  `db.rs::without_applied_alters` only parses **single-line**
  `ALTER TABLE … ADD COLUMN`, so the migration must stay one physical line.
- Reversible write path: `update_track_metadata`, `set_track_rating`,
  `undo_track_metadata` — the undo snapshot is a `skill_runs` row written **in
  the same transaction** as the track UPDATE, hence `Database::conn_mut()`.
- `updated` counts the tracks whose value **actually changed**; the undo
  restores only what its snapshot still describes and **skips** a track edited
  again since (counted in `skipped`).
- Front end: `StarRating.tsx` + `EnergyBars.tsx`, the `energy`/`rating` column
  model entries, energy bounds in the filter panel, table multi-select and an
  Undo toast inside the library view's `relative` container. The widgets own
  their keys; the selection anchor is a **track id**, not a row index. Logic
  lives in pure `lib/*.ts` helpers tested with `node --test` — **there is no
  React component test harness in this repo**.
- **Open gap:** the full bulk-metadata flow (BulkActionBar, select-all) is
  still **T2.1.3**; Slice 2 ships only the table multi-select subset.
- `cargo test -p dj-assistant-desktop` cannot run here — the Tauri-linked test
  binary does not start on this machine; use `pnpm rust:test:portable`.

## Still open

- The library review's question 1 — install `sqlite-best-practices` and/or
  `rust-skills`? SQLite/`rusqlite` still has no dedicated coverage; the two
  candidates are in `skills.policy.json` → `candidates`.
- The Rekordbox XML export (audit §7.1) — the whole `dj-rekordbox` reader is
  staged behind it.
- T2.1.2 / T2.1.4 / T2.1.6 manual running-window QA, and the PR #51 merge.
