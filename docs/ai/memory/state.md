# Working state

Ephemeral. Newest first. **Rotate aggressively** — if a line would still be true
in two weeks, it belongs in [`decisions.md`](./decisions.md); if it is just a
fact, it belongs in [`facts.md`](./facts.md). Delete anything stale.

## 2026-10-22 · Slice 3A implemented — tags + comments (T2.1.7, T2.1.13)

- **The slice is code-complete; the QA gate is still open.** Migration 007
  (`track_tags` + `tracks.label`), the read path (`TrackSummary.tags`), the
  `tag` filter, the `comments`/tag search, the generalised write path, the
  `tags` column, `TagChips`, the row context menu and the metadata editor are
  all in the tree. The running-window QA is **not executed**, so T2.1.7 and
  T2.1.13 stay **unticked**; the checklist is
  [`docs/engineering/SLICE3A_MANUAL_QA_CHECKLIST.md`](../../engineering/SLICE3A_MANUAL_QA_CHECKLIST.md).
- **The write path now snapshots a whole tag set** — the first non-scalar
  snapshot in the reversible path. The delete and the re-insert share one
  transaction with the scalar restore, and an undo skips a track whose set
  changed since the snapshot (a set is not a scalar).
- **The desktop crate’s test harness links but cannot load on this Windows
  toolchain** (`STATUS_ENTRYPOINT_NOT_FOUND`), so its unit tests are only
  type-checked here (`cargo clippy --all-targets`) and run in CI. The pure
  write rules therefore live in **`crates/core/src/patch.rs`** (the closed
  column allow-list, the text/number clearing rules, the tag-set comparison)
  — where they actually run — and the desktop crate calls them.
  `crates/core` and `tests/schema` run fine locally.
- **The D: drive was at 100%** while the slice was being verified: the Rust
  build failed with “No space left on device”. The cargo caches
  (`D:\cargo-target\debug\incremental`, the scratch `D:\cargo-target-3a`) were
  cleared to make room; a full workspace `cargo test` still needs several GB,
  and the `dj-assistant-analysis` golden corpus test is a multi-minute ONNX
  run — test the crates you touched, not the world.
- **`dj-query` learned `--tag`** — the QA cross-check needs it. The free-text
  search and the tag filter both read `track_tags`, so the CLI refuses a tag
  search against a library that predates migration 007 instead of failing
  inside SQLite.
- **The next session should run the QA, not write more code:** open the app
  once (migration 007), walk the checklist, then record the results in
  `docs/sdd/04-TASKS.md`.

## 2026-10-22 · Slice 3A planned — tags + comments (T2.1.7, T2.1.13)

- **Slice 3 is cut in two:** 3A = tags + comments, 3B = key pills (T2.1.8).
  3B waits because the key-format preference needs a Settings surface the app
  does not have (the router knows only import/library/analysis/studio/backup/
  sync).
- **Three decisions locked by the human:** the user comment **overwrites**
  `tracks.comments` (the imported comment is lost, Undo keeps it recoverable);
  tags live in a new **`track_tags` table** (plain-SQL filtering, the base for
  the Tag Surgeon); 3A = T2.1.7 + T2.1.13.
- **Two assumptions in the slice text were false:** there is **no** “Edit tags…”
  editor stub and **no** row context menu (only the column-header one). The
  editor and its entry point are 3A work, and the `label` / `year` fields the
  editor names are not in the schema or in `TrackSummary`.
- **The two open 3A choices are settled:** the editor is reached through a
  **right-click row context menu** (shipping only “Edit tags…”, so the other
  spec items can be added later), and the editor covers **label and year** as
  well — `year` is already in the schema and populated for 90 of 94 tracks
  (a `TrackSummary` change only), while `label` needs a one-line `ALTER` and
  has **no import source**, so it is a user-typed field with an empty state.
- **The `comments` overwrite costs nothing in this library:** 0 of 94 tracks
  carry an import-sourced comment, and `notes` is confirmed unused (0 rows).
- **Tags are the first non-scalar undo snapshot** — a set restore has to be
  transactional, and the snapshot records the previous tag set per track.
- The plan is [`docs/engineering/SLICE3A_PLAN.md`](../../engineering/SLICE3A_PLAN.md):
  migration 007, the read/query/write paths, `TagChips`, the editor, the tests
  and the DoD. The QA gate stays the Slice 2 discipline — the human clicks in
  the `tauri dev` window, the agent verifies the database read-only.

## 2026-10-22 · Slice 2 QA session — baseline established, blocked on human clicks

- **The app runs; the QA did not happen.** The real Tauri app was launched
  (`tauri dev`, real database, 94 tracks / 24 analysed) and the baseline was
  verified, but **Sections A, B and C of the running-window checklist were not
  executed** — no PASS/FAIL exists in either direction, so T2.1.2 / T2.1.4 /
  T2.1.6 stay **unticked**.
- **One exploratory write landed during the session and was cleared again:**
  *Just Just (Extended Mix)* (`756d2d12…`) was set to **energy 8** and then
  cleared back to `NULL` — the library is back to 0 rated / 0 energy, a
  pristine baseline. It is a database fact, not a QA result: no human
  observation exists, so it cannot close B2.
- **The blocker is structural, not a bug:** the DoD gate needs a human in the
  native window, and the agent cannot click it. The split that works is
  *human clicks, agent verifies the database read-only* with `dj-query`
  (`--rating-min`, `--energy-min/--energy-max`, `--sort rating|energy`).
- **A browser session would have been a false pass** — `pnpm dev:desktop` is
  Vite only and `api.ts` serves **mock** rows without the Tauri IPC. The QA
  must run in the `tauri dev` window; see F-009.
- The runnable checklist now lives in
  [`docs/engineering/SLICE2_MANUAL_QA_CHECKLIST.md`](../../engineering/SLICE2_MANUAL_QA_CHECKLIST.md)
  with the exact shipped strings (`Rated 3 tracks`, `Set energy on 3 tracks`,
  `Undone — 3 tracks restored, 1 skipped (changed since)`,
  `Rating unchanged — nothing to save`, `Energy 7 / 10`, `No energy set`).
- **Recommendation:** move to Slice 3 (T2.1.7 tags + T2.1.13 comments) rather
  than stall — both are per-track inline metadata edits on the same reversible
  write path, the same Undo UX and the same column framework, and doing them
  before the QA means the QA session later exercises the final table shape.

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
- T2.1.2 / T2.1.4 / T2.1.6 manual running-window QA (PR #51 merged 2026-10-21) —
  **not executed**; baseline done, checklist in
  [`docs/engineering/SLICE2_MANUAL_QA_CHECKLIST.md`](../../engineering/SLICE2_MANUAL_QA_CHECKLIST.md),
  needs a human in the Tauri window.
