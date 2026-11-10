# Working state

Ephemeral. Newest first. **Rotate aggressively** — if a line would still be true
in two weeks, it belongs in [`decisions.md`](./decisions.md); if it is just a
fact, it belongs in [`facts.md`](./facts.md). Delete anything stale.

## 2026-11-10 · Running-window Passes 4–5 executed — K10 fixed, K9 wording open

- Pass 4 (T2.1.8 key pills, live 94-track library, 7B reference): **K1–K8 and K11 PASS, K9
  DEVIATION, K10 FAIL**. Pass 5 (Stage 1 §D, 30,000-track fixture behind `DJ_ASSISTANT_DB_PATH`):
  **D1–D4 PASS**.
- **K10 was the defect and is fixed (2026-11-10, uncommitted as this rotates).** The tint was
  translucent over the row, so the row state moved the ground under a fixed ink token (2.94 / 2.59
  selected, 4.10 / 3.70 hovered, same-key 4.46 selected dark). `lib/key-pill-surface.ts` now gives
  a tinted pill its own opaque `bg.base` ground with the tint layered above, and the unfilled
  treatment uses `text.secondary`; `lib/key-pill-contrast.test.ts` gates every theme × relation ×
  code. Re-run in the app: 9.56 / 8.08 identical across normal, hovered and selected; quiet 7.10 /
  10.59 normal and 6.38 / 7.18 hovered. See D-017 — the ground must not go back to translucent.
- **Open follow-up, deliberately not fixed here:** `text-dj-text-muted` still misses 4.5:1 on
  hovered and selected rows *outside* the key pill. The pill was the measured defect; a global
  muted-ink audit is its own task.
- **K9 is a stale expectation.** With no reference the Compatible-only box is deliberately
  disabled with help text (`canToggleCompatibleOnly`, tested at
  `apps/desktop/src/lib/library.test.ts:427`), not "stays enabled"; the lost-reference case does stay
  checked, enabled and removable, exactly as `d76573a5` decided.
- The live library holds no 7A and no 5B row, so the relative tint and half the ±2 tints can
  only mount on the fixture — and the generator emits one letter per number
  (`scripts/make-library-fixture.mjs:205`), which is why Pass 5 needed a fixture-only re-key.
  That is fixture tooling, not app behaviour.
- Both passes net-zero: the live `.db`/`.wal` kept their exact sizes and mtimes through the
  whole fixture session, `skill_runs` still 99, `track_tags` 0, localStorage restored byte-identical,
  0 of 94 mp3s touched, no `Runtime.exceptionThrown`.
- **Nothing ticked.** §D is now recorded PASS but the evidence file is still uncommitted, and
  T2.1.8 stays open on K9's stale expectation; the human ticks on `main` post-merge.

## 2026-11-10 · Running-window Pass 3 executed (Slice 3A tags/editor/menu) — B4 open

- Pass 3 of [`../../evidence/2026-11-09-RUNNING-WINDOW-QA.md`](../../evidence/2026-11-09-RUNNING-WINDOW-QA.md)
  ran over CDP on the live 94-track library: **44 PASS, 1 FAIL, 2 DEVIATION, 1 BLOCKED**.
- **B4 is the one real defect**: an unchanged Save takes the backend `nothing to update` error
  path (`crates/core/src/library_writes.rs:189-191`), so the renderer's "Metadata unchanged —
  nothing to save" branch never fires, the dialog closes and the console errors. Fix belongs in
  the write path, not the dialog.
- **A7 and F6 are stale checklist expectations**, not defects: the row menu deliberately replaces
  the selection (`App.tsx:2101-2109`) and window-level Escape deliberately closes the track panel
  (`App.tsx:1878-1896`). Slice 3A's checklist text needs the correction. **E3 is blocked** by the
  single-slot undo token — no UI path undoes the first of two writes.
- **Net-zero proven** against the pre-run copy: 0 diffs over all 94 `tracks` rows, 0 `track_tags`
  both sides, every other table count identical, 0 of 94 mp3s touched, column layout restored and
  identical after the F1 restart. Only `skill_runs` grew — the pass's own undo snapshots, left alone.
- **Passes 4–5 have since run** — see the entry above: §D closed PASS and K10 is the open FAIL.
  T2.1.7 and T2.1.13 stay unticked; the human ticks on `main` post-merge.

## 2026-11-09 · PR #72 merged; ledger, context and plan reconciled on `main`

- **`main` is at `307a13fb`** (PR #72, the T2.1.4 rating-cell keyboard ownership fix)
  after PR #71 (`b8acce5a`, docs-honesty sweep). **PR #70’s squash `682084ff` is not an
  ancestor of `main`** — it merged into `feature/bulk-metadata-edit`, and its code arrived
  inside PR #65’s squash `9551aa41`. `04-TASKS.md` had been calling #65 and #70 “open in
  review, not merged”; that claim, its mirror in `PROJECT_CONTEXT.md`, the slice list and
  the Phase 2 Slice 2 status are now corrected.
- **Nothing was ticked.** The 2026-11-09 running-window record shows **Pass 1 (Stage 1
  shell) PASS** (A1–A12, B1–B5, C1–C3) and **Passes 2–5 NOT RUN** at that point (Passes 2–3 have since run — see the
  2026-11-10 entry, which also notes B4 as the one open FAIL), so T2.1.0 (§D still
  unrun), T2.1.2, T2.1.3, T2.1.4, T2.1.6, T2.1.7, T2.1.8 and T2.1.13 all stay open (F-012).
- **The QA session’s own work is still uncommitted and is not mine to commit:**
  `docs/evidence/2026-11-09-RUNNING-WINDOW-QA.md`, the `RowContextMenu.test.tsx` deletion
  and the `library-menu.ts` / `.test.ts` helper extraction. Those 6 tests are why this tree
  measures **242** desktop tests while merged `main` measures **236** — keep them out of
  docs commits (F-010).
- **Checks on `main` 2026-11-09:** `pnpm lint` (0 errors, the 2 known Player
  `exhaustive-deps` warnings), `pnpm typecheck`, 236 desktop / 70 pass + 1 skipped agent /
  10 tooling / 2 API tests, `pnpm lint:root` — all pass.

## 2026-11-09 · PR #72 review rounds closed (T2.1.4 keyboard ownership)

- Both bot rounds (DeepSource, CodeRabbit) are answered and their threads
  resolved on the PR head. The DeepSource findings all came from the two
  checkers already adjudicated — js/wrapper/iife firing on ES-module exports,
  and the complexity ceiling accepted for small shared guards — so PR #72 keeps
  the JavaScript FAILURE until both are marked Ignored in the DeepSource
  dashboard (the human’s action, agreed 2026-11-08). Nothing is
  branch-protected.
- What was real was fixed, not argued: the activation-key guard and the
  undo-status pluralization became shared helpers, the library loader now
  tracks why a reload ran (a write’s own status, including a partial-undo
  warning, survives it; a manual refresh still reports success), and the
  rating cell’s key claims and roving tab stop are pure helpers in
  rating-keys.ts, proven by node --test — the clear preview and the
  description strings live in StarRating.tsx, which has no component
  test harness here.

## 2026-11-08 · Docs-honesty sweep finished — PR #71

- **Skill-name hardening:** `scripts/skills/sync.mjs` uses the shared
  `assertSkillName` helper to reject empty, non-string, absolute, and traversal
  names; tests verify a traversal name cannot create the mirror.
- **Audit references:** the `TrackSummary` mapping is documented in the
  [professional system audit](../../audit/PROFESSIONAL_DJ_SYSTEM_AUDIT.md), and
  the reversible-write undo guard in the
  [strategic report assessment](../../audit/06-strategic-report-assessment.md).
- **QA-helper corrections:** `reset_qa_baseline.sql` now instructs users to
  target an explicit database copy instead of claiming a nonexistent
  `QA_COPY_PATH` guard; `check_schema.py` no longer claims it cannot open the
  production database.
- **Other verified docs fixes:** corrected the PlayerDock/full-window Player
  checklist status and reconciled the Tag Surgeon status with audit C-5.
- **Checks:** `pnpm lint` (0 errors, the 2 pre-existing Player `exhaustive-deps`
  warnings), `pnpm typecheck`, `cargo fmt --all --check`,
  `cargo clippy -p dj-assistant-desktop --all-targets -- -D warnings`,
  `pnpm agent:doctor` (0 hard problems) all pass. `check_schema.py` compiles
  and the reset SQL was exercised against an in-memory table: 0 non-null
  ratings/energy afterwards, all rows kept.
- **New finding, left for the human:** `apps/desktop/src/components/RowContextMenu.test.tsx`
  is seven `assert.equal(true, true)` placeholders, and the desktop test script
  globs `src/**/*.test.ts`, so the file never runs. It is false confidence, not
  coverage; deleting or implementing it is a decision for the human.
- **Still open:** native running-window QA gates below remain unticked.

## 2026-11-08 · PR #70 review round closed (T2.1.8 key pills)

- **48 review threads on PR #70, all answered and resolved**; the branch head is
  `144292e0`. The round first ran against a stale commit — the fixes were
  local while every review read `dc3ddac6` — so the job was to push, then verify
  each finding at HEAD (F-013).
- **Follow-ups the closed round kept producing:** cubic's P2 on the `facts.md`
  DeepSource wording, narrowed so it no longer dismisses every finding
  (`aef4c88f`), and its P3 on calling the stranded intent "un-checkable" —
  reworded to "enabled and removable" everywhere, docs only (`144292e0`).
  Graphite's P2 on a **stranded Compatible-only intent** — the panel
  reopened checked *and* disabled once the reference was lost, and with no
  derived keys there was no chip to clear either, so Reset was the only escape;
  the box now stays enabled and removable whenever the intent is on, and
  unchecking it without a reference leaves manual key picks alone (`d76573a5`).
  Two `js/wrapper/iife` threads then landed on
  `export function`s that fix added — the documented false positive, answered
  with no code change.
- **What the round changed:** `797e1823` turned Compatible-only into a committed
  **intent** held separately from the derived `keyCamelot` list, widened the key
  column so the `both` notation fits, moved the pill text onto the theme primary
  token so every relation tint clears 4.5:1, and added the full-wheel relation
  and compatible-set matrix tests. `f360b175` fixed the regression that round
  exposed — the Key chip's × cleared only the applied list, so the derived keys
  returned on the next render and the chip was unremovable; the intent now drops
  with the chip (`dropsCompatibleIntent`). `0bf2c593` and `88b64c78` were made on
  GitHub: F-013 trimmed to one line, and Apply no longer clears the intent when
  the harmonic reference is missing.
- **DeepSource JavaScript:** `js/wrapper/iife` fires on ordinary top-level
  functions in ES modules and the complexity rule reports "medium" at 6, so PRs
  #65 and #70 carry the FAILURE while Dependabot PRs pass. Agreed with the human
  on 2026-11-08: mark those checkers Ignored in the DeepSource dashboard instead
  of reshaping code to satisfy them. Nothing is branch-protected, so the check
  blocks nothing.
- **Docs and context sweep complete (2026-11-08):** `docs/context/PROJECT_CONTEXT.md`
  brought up to date with PR #60 (context menu + soft remove migration 008), PR #65
  (bulk metadata edit + BulkActionBar), PR #70 (key pills + harmonic relations),
  migrations 006–008, new IPC commands, and audit report assessment;
  `PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md` and `docs/ui/11-IMPLEMENTATION-CHECKLIST.md`
  reconciled. The full automated test suite passed.
- **Next development targets in Phase 2:**
  1. **Slice 4 — Artwork column (T2.1.9):** cached thumbnail with missing-art
     placeholder, hover-play overlay that loads track, default off, no cross-track
     bleed during rapid scroll.
  2. **Slice 5 — Left-nav library sources (T2.1.12):** All Library · Categories ·
     Playlists · Browser · Flash/Storage driving `list_tracks` source/sourceId.
  3. **Slice 6 — Mix Suggestions dock (T2.1.11):** ranked candidates from
     harmonic distance, BPM delta, energy delta with reason chips, preview / add
     actions, resizable dock with persisted width.
  4. **Slices 7 & 8 — Real audio playback & peaks cache (T2.4.1–T2.4.5):** replace
     synthesized preview wave with real per-track peaks cache and Symphonia audio
     engine playback on dedicated audio thread.
- **QA status / DoD gates:** No task box was ticked — native running-window QA
  (5A colours, live preference switch, compatible filter against real library,
  multi-select modifier clicks, Stage 1 shell) requires the native running app
  (F-012) and remains the exit gate for T2.1.0, T2.1.2, T2.1.4, T2.1.6, T2.1.7,
  T2.1.13, T2.1.3 and T2.1.8.

## 2026-10-29 · T2.1.3 bulk metadata + T2.1.8 key pills (PR #65)

- **T2.1.3 is code-complete on `feature/bulk-metadata-edit` / PR #65.** Beyond
  the committed bulk dialog (`d9b5ba1a`), the missing spec §6 `BulkActionBar`
  now ships: scope line, live Edit metadata… / Rate / Clear selection, and
  Analyze / Smart Tag Cleanup / add-to-playlist-set / Export selection as
  `aria-disabled` with reasons derived from `library-menu.ts`. It shows at
  `count >= 2`, not `> 0`, because a plain row click always leaves one row
  selected and a permanent bar hurts density (documented in `bulk-actions.ts`).
  Desktop `node --test`, typecheck, ESLint and Prettier pass.
- **Docs reconciled:** `docs/sdd/04-TASKS.md` (T2.1.3 annotation),
  `PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md` (Slice 2 known gap + Slice 9
  row) and `docs/ui/11-IMPLEMENTATION-CHECKLIST.md` (BulkActionBar, editor,
  Label/Year, TagChips).
- **T2.1.8 key pills (Slice 3B) implemented 2026-10-29:** pure `harmonic.ts` +
  `key-format.ts` modules with tests, the relation-tinted `KeyPill`, Settings →
  Key display (Camelot / 1m1d / both, Strict/Wide) persisted in `UiState`, and a
  Compatible-only filter that reuses `keyCamelot` (no Rust/SQL change). Desktop
  `node --test`, typecheck, build, ESLint and Prettier pass.
- **Still open:** select-all and keyboard scope (`Ctrl/Cmd+A`), the blocked
  shared bulk actions, the native multi-select QA pass, and the T2.1.8
  running-window QA (5A colours, live preference switch, compatible filter
  against a real library). Modifier clicks and native checks cannot be
  automated (F-012), so both task boxes stay unticked.

## 2026-10-24 · PR #53–#56 merged; main synced; QA still open

- **Four pull requests are merged.** PR #53 (Stage 1 shell, Slice 3A, the v1
  plan mirror) is squash `03991d3c`; PR #54 (player presentations, BPM
  fine-tune, dock heights) is squash `5e7334eb`; PR #55 (shared Track inspect
  panel with player entry points) is squash `83831774`; PR #56 (30k-track
  virtualized Library table plus the `DJ_ASSISTANT_DB_PATH` override) is squash
  `ed8d1046`. Local and remote `main` are at `c118a0f0` (README rewrites
  `5282cfae` and `c118a0f0` on top of docs `a0d9b2e7`). The annotated tag
  `slice-3a-code-complete` still peels to `ec2b191f`.
- **Stage 2 has started.** PR #55 added the shared Track inspect panel with
  player entry points; PR #56 added the virtualized table
  (`apps/desktop/src/lib/virtual-window.ts`: 36/38/41/48 px row pitch, 19–23
  mounted rows for 30,000 tracks, 200 → +500 paging) and the deterministic 30k
  fixture.
- **Reviews (PR #53/#54):** both carry an APPROVE review comment with no
  blocking findings. Non-blocking follow-ups: the logging redactor misses bare `token`
  keys and JSON-quoted keys; `PlayerArtworkRail.tsx` still names Extended in a
  comment; the waveform cache is unbounded; `effectiveBpm` is not clamped to
  the audio engine's 40–240 range; `OverviewMap` does not clamp its offset; the
  shortcut test does not exercise Meta.
- **CI:** every required GitHub Actions check is green. DeepSource JavaScript
  is the only red advisory status — non-required and also failing on `main`.
  DeepSource Rust passed after the rebase (no Rust diff remained).
- **Plan and tasks reconciled:** `docs/plan/06-delivery/implementation-slices.md`
  and `docs/plan/README.md` record the four merges, the Phase 2 plan marks Slice
  3A merged and 3B pending, and `docs/sdd/04-TASKS.md` records the merges
  **without ticking any box** — Stage 1, Slice 3A and Slice 2 QA are still not
  executed. `docs/context/PROJECT_CONTEXT.md` was refreshed post-PR #56 in
  `a0d9b2e7`; `docs/sdd/05-ACCEPTANCE.md` (P2.13) and the Stage 1 / Slice 3A QA
  checklists name the six-tab shell and the three presentations, with the
  checklists pinning the implementation under test at `5e7334eb`.
- **Next:** run the native running-window QA (Stage 1, Slice 3A, Slice 2,
  player heights); Stage 2 is already in progress, with the artwork-grid and
  compact-list views, bulk actions, server-side search, cue/waveform editor,
  tag cleanup, duplicates and the health score still open.

## 2026-10-23 · Player dock rebuilt; Extended retired; Stage 1 + 3A in PR #53

- **Player redesign is committed** as `9247a389` on local
  `feat/player-presentations` (since merged as PR #54 — see the 2026-10-24
  entry). Three presentations:
  Mini / Full / Player view. Full owns the **Hot cues ↔ Grid & beat** segmented
  panel; hot cues are one compact 30px pad style; dock heights are 96–139
  (default 104) and 230–440 (default 246) with the 140–229px gap snapped at
  184.5; BPM fine-tune drives the grid, bar counter and beat jump.
- **New pure helpers are tested:** `resolvePlayerHeight` (`lib/ui-state.ts`),
  `clampZoomLevel` / `getFollowViewOffset` / `snapToGrid`
  (`lib/waveform-generator.ts`) and the Camelot palette (`lib/camelot.ts`).
- **Docs reconciled to three presentations:** `docs/ui/06A` v1.4, `06-PLAYER`
  v1.5, the plan docs, component tables and wireframes. The decision and its
  rejected alternatives are recorded in
  [`docs/plan/06-delivery/discussions.md`](../../plan/06-delivery/discussions.md).
- **The six local commits are pushed as PR #53** on
  `feat/stage1-shell-and-slice3a` (head `8a41e6ac`): Stage 1 shell, Slice 3A,
  the v1 plan mirror, the Slice 3 cut and the Slice 2 QA checklist. The
  annotated tag **`slice-3a-code-complete`** (`ec2b191f`) is pushed.
- **Pruned 20 merge-equivalent local branches.** Kept
  `feat/analysis-decoder-and-golden-corpus` and
  `feat/t2.1.2-library-multi-filter` (unique commits, awaiting review), plus
  `fix/analysis-decode-truncation` and `fix/rustfmt-ci` — their PRs were
  **closed, not merged**, and they still carry unique commits.
- **Checks:** desktop typecheck, Prettier and desktop tests pass; `pnpm lint:eslint`
  is 0 errors / 2 pre-existing Player `exhaustive-deps` warnings;
  `pnpm lint:root` passes.
- **Open:** native running-window QA for Stage 1, Slice 3A and the new player
  heights. (The player branch has since merged as PR #54 — see the 2026-10-24
  entry.)

## 2026-10-23 · Stage 1 shell implemented; native acceptance pending

- **The Stage 1 foundation and shell is now in the working tree.** It has the six
  primary tabs (Library, Playlists, Discover, Statistics, Publish, Settings),
  a typed primary/utility view registry, persisted navigation, the top-bar
  library search / Import Center / Inbox / backup status, the persistent player
  dock, inbox empty state, Settings skeleton, app error boundary and redacted
  renderer logging.
- **The old working surfaces were not deleted.** Import, Analysis, Studio,
  Backup and Sync are now utility views; Import/Inbox/Backup are top-bar actions
  and Analysis/Studio/Sync are linked from Settings. All `AppView` values render
  a route, so there are no dead values.
- **Keyboard shortcuts are now `Ctrl/Cmd+1..6`** for the primary tabs,
  `Ctrl/Cmd+I` for Import Center and `Ctrl/Cmd+,` for Settings. The shell also
  has a skip-to-main-content link and native-button focus order.
- **Top-bar search is honestly labeled “Search library”** and filters the loaded
  library; playlist/tag-wide global search and virtualization belong to Stage 2,
  not this shell.
- **Checks:** `pnpm typecheck`, `pnpm build:desktop`, desktop Prettier, the
  desktop `node --test` suite and `pnpm lint:root` pass.
  `pnpm lint:eslint` has 0 errors and 3 pre-existing Player
  `exhaustive-deps` warnings.
- **Not acceptance-complete yet.** Native Tauri running-window QA is pending:
  six tabs, player persistence, navigation restore, no dead routes and keyboard
  navigation. The **30,000-track fixture** criterion is also unverified; a
  browser mock session is not acceptance evidence. The checklist is
  [`docs/engineering/STAGE1_MANUAL_QA_CHECKLIST.md`](../../engineering/STAGE1_MANUAL_QA_CHECKLIST.md).
- **Working tree:** committed as `8a41e6ac`; pushed with Slice 3A as PR #53.
  No Stage 1 tag exists.
- **Next:** run the native acceptance pass. Stage 2 has since started (PR #55
  Track panel, PR #56 virtualized table — see the 2026-10-24 entry above). Keep
  Slice 3A manual QA open; T2.1.7 and T2.1.13 stay unticked.

## 2026-10-23 · v1 plan mirrored; Slice 3A secured; Stage 1 next

- **The approved v1 plan is now in the repo** at `docs/plan/` (30 files). The
  discussion log is `docs/plan/06-delivery/discussions.md`; it records the
  rationale, rejected alternatives, UI/UX rules and open items. Plan decision
  IDs **D-001–D-052** are scoped to that tree and are separate from this
  memory ledger.
- **Slice 3A is protected:** commit `ec2b191f`, annotated tag
  `slice-3a-code-complete`. The working tree was clean after the commit. The
  manual running-window QA is still **not executed**, so T2.1.7 and T2.1.13
  remain unticked.
- **Checks run before the baseline commit:** `pnpm lint`, `pnpm typecheck`,
  the desktop `node --test` suite, `pnpm rust:fmt`,
  `pnpm rust:clippy`, and
  `cargo test -p dj-assistant-core -p dj-assistant-schema-tests` (all passed).
- **The plan's hierarchy is explicit:** `docs/product` and `docs/ui/` remain
  authoritative for the canonical product spec and shipped UI tokens;
  `docs/plan/` is the approved v1 scope and delivery reference. Resolve a
  conflict as a decision, not by silently mixing both.
- **From that baseline, Stage 1 — Foundation and shell was the next step** in
  `docs/plan/06-delivery/implementation-slices.md`. Stage 0 is complete: the
  current library DB/WAL/SHM was copied to
  `C:\Users\User\AppData\Local\Temp\opencode\dj-assistant-backups\2026-10-23-slice3a`.
  Run the Slice 3A manual QA in the Tauri window before marking its tasks done.

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
