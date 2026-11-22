# Working state

Ephemeral. Newest first. **Rotate aggressively** — if a line would still be true
in two weeks, it belongs in [`decisions.md`](./decisions.md); if it is just a
fact, it belongs in [`facts.md`](./facts.md). Delete anything stale.

## 2026-11-22 · Audit correction (supersedes the 11-19 snapshot below where they differ)

- **Update (same day):** the branch was merged as **PR #91** (merge commit `8f5d2253`, 2026-11-22 10:23 UTC, merging all 13 branch commits). `origin/main` = `8f5d2253`. The local `main` checkout is behind and needs a fast-forward. No PR is needed for that branch.
- The library table pass is **committed** on that branch (`e44fa716`), not uncommitted on main. It also adds `refresh_artwork` (wired in `App.tsx`).
- **Do not split the branch by commit.** `e44fa716` depends on the tag-preview types from `2ccbd279` (test cherry-pick onto main conflicts in `commands.rs`). Ship it as one PR, or as a stack in commit order.
- Artwork backfill (NULL `artwork_path` rows) has a committed `refresh_artwork` path on that branch. Issue #89 is a **different** backfill: `beatgrid_confidence` (see its body).

## 2026-11-19 · Progress snapshot (scan of `docs/sdd/04-TASKS.md`, git, worktrees)

- `main` = `6e0869cd`, level with `origin/main`. Task ledger: **67 ticked / 131 open**.
- **Phase 0** done (1 open) · **Phase 1** done · **Phase 2** mostly code-shipped but only
  T2.1.5 and T2.1.10 ticked — the rest wait on running-window QA the human ticks (F-012).
  Since 11-17: #86 beat-grid confidence (T2.4.3, migration 009), #88 mix dock Replace
  (T2.1.11), #90 Tag Surgeon read-only clustering (T2.2.1); brand D-019 → D-020.
  Unbuilt in Phase 2: T2.2.2–T2.2.6 (Tag Surgeon apply/alias/undo), T2.3.x (duplicate UI,
  version grouping, health score, Cue Master), gain/limiter + temp loop (T2.4.4), T2.4.6–7.
- **Phase 3** (set builder, export, USB) **not started**. Phase 4 + audit TA tasks: 17 / 92.
- **Unmerged, unpushed: `chore/phase2-qa-closeout`** (2 docs commits, 2026-11-19): B4,
  Stage 1 C3 and T2.1.10 View columns re-run **PASS**; Slice 4–8 risk rows PASS; artwork
  rows **BLOCKED** (all 94 rows have NULL `artwork_path`). Evidence
  `docs/evidence/2026-11-19-PHASE2-QA-CLOSEOUT.md`. **Its `feedback.md` adds F-018–F-020,
  which collide with main's F-018–F-021** — renumber them (to F-022+) before it merges.
- Other worktrees: `dj-artwork-backfill` (`feature/artwork-backfill`, 0 commits ahead —
  backfill not started), `dj-pr65-fixes` (`pr65-fixes`, 7 ahead / 68 behind, stale),
  detached `D:/Temp/opencode/pr51-verify`.

## 2026-11-19 · Library table upgrades pass (uncommitted on `main`)

- 24 modified files + migration `010_track_extra_metadata.sql` implement part of the
  **proposal** `docs/ui/14-LIBRARY-TABLE-UPGRADES.md` (v0.2, not approved; its §0.1 lists
  what shipped): 17 import-time tag columns (comment_2, composer, album_artist, remixer,
  producer, grouping, track/disc number, isrc, catalog_number, release_date, copyright,
  mood, mix_name, lyrics, bitrate_kbps) + `label_user_set`; label now read on import
  (`TPUB`/`LABEL`/`PUBLISHER`/`ORGANIZATION`); `status` is column 2, icon-only; header and
  picker drag-reorder fixed by `dragDropEnabled: false`; Comment 2 editable in
  MetadataEditor + Tags tab. Rule followed: a real tag source, or no column.
- Not done: label backfill + label search; density, waveform column, track color, column
  filters, Table/List/Grid views, Tag Manager.
- **No checks recorded for this pass**, and its owner is unknown — do not stage, reformat
  or revert it from another task (F-005, F-010). Also untracked: `docs/ui/*.png` reference
  images, `.pr72.json`, `.agents/`.

## 2026-11-19 · The Stack brand redesign + README restructure (shipped to `main` as `aa0ada8e`)

- User approved ("build") a full brand redesign from five inspiration PNGs: the
  mark is now **The Stack** (D-020 supersedes D-019). All `assets/*.svg` rewritten
  (logo dark/light, marks, mono, brand-disc, tray pair, favicon, three wordmarks,
  banner, social-preview, brand-lineup); `scripts/make_icon.py` rewritten to the
  same geometry; app-icon.png + four tray PNGs regenerated and the platform icon
  set re-expanded via `tauri icon`; `social-preview.png` re-rasterised via headless
  Chrome; favicon copied to `apps/desktop/public/`. `tray.rs` untouched (same
  filenames). Geometry tables + new palette tones documented in `assets/README.md`.
- README.md restructured top-repo style: banner → pitch → two badge rows (status /
  stack) → anchor nav → expanded Overview → screenshots → Quick start (requirements,
  build, first launch, data locations) → Features → How it works (mermaid restyled
  with app-palette `%%{init}%%` themeVariables, shipped green / planned dashed /
  snapshot-undo loop) → Brand and icons → Development → Roadmap → Docs →
  Contributing/License.
- Verified then shipped: lint, typecheck, 394 JS tests (1 skipped), root lint and
  Prettier clean; one batched headless-Chrome visual round of all ten brand SVGs
  plus `social-preview.png` passed with no defects. Committed and pushed to
  `origin/main` as `aa0ada8e` on the user's explicit request (push bypassed the
  required-status-checks rule; CI runs on the commit).

## 2026-11-17 · Docs reconciliation on main (PR #78–#85)

- `main` is at `07bccb5c` (rusqlite 0.42). Merged since the last ledger entry:
  PR #78 (`fad2d5eb`, B4 unchanged-save no-op fix), PR #80 (`65ca59ad`, Slices 4–8:
  T2.1.9 hover-play, T2.1.11 mix dock, T2.1.12 source tabs, T2.4.1 peaks cache,
  native cpal/Symphonia audio + review hardening), PR #81 (`5a9fced7`, dual peak
  resolutions, cache v3), and Dependabot #75/#82–#85.
- Docs brought in line: `docs/sdd/04-TASKS.md`, the Phase 2 plan slice table and
  statuses, `docs/context/PROJECT_CONTEXT.md` (baseline §0, IPC tables, UI surface,
  §17.3–17.5, §24), the Phase 2 plan, CHANGELOG catch-up, and this ledger.
- **Nothing ticked.** The B4 PASS re-run and any running-window QA for Slices 4–8
  and the audio/peaks paths have not been executed; the human ticks on `main`.

## 2026-11-16 · PR #80 DeepSource JavaScript flipped green (head a9c829c2)

- JS-0067 (iife) and JS-R1005 (complexity) are now Ignored in the dashboard,
  as agreed 2026-11-08; the Documentation Coverage metric is unenforced
  (threshold 0), so no gate action was needed.
- The 26 findings introduced on the T2.4 files were fixed in code except the
  adjudicated-intentional loud-crash `!` assertions and the dev-only mock
  `window.prompt`, which keep `/* skipcq */` markers (F-017). JavaScript and
  Secrets pass on this head; no review threads remain unresolved.

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
  ran over CDP on the live 94-track library: **43 PASS, 1 PARTIAL, 1 FAIL, 2 DEVIATION,
  1 BLOCKED** (corrected 2026-11-17 — F1 is the partial after its process restart).
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
- The Slice 4–8 targets listed here were since merged (PR #80/#81, 2026-11-16).
- **QA status / DoD gates:** No task box was ticked — native running-window QA
  (5A colours, live preference switch, compatible filter against real library,
  multi-select modifier clicks, Stage 1 shell) requires the native running app
  (F-012) and remains the exit gate for T2.1.0, T2.1.2, T2.1.4, T2.1.6, T2.1.7,
  T2.1.13, T2.1.3 and T2.1.8.

## Still open

- Rekordbox XML export (audit §7.1) — the `dj-rekordbox` reader is staged behind it.
- `sqlite-best-practices` / `rust-skills` install question — candidates in
  `skills.policy.json` → `candidates`.
- **Artwork backfill** for libraries imported before Slice 4 (all 94 live rows NULL);
  blocks T2.1.9 with-art/no-bleed and T2.4.5 with-art rows. Same shape as issue #89.
- Stale QA checklist wording: Pass 4 K9 (A7/F6 reconciled on `chore/phase2-qa-closeout`).
- T2.1.12 collapsed-rail source icons; T2.1.3 select-all (`Ctrl/Cmd+A`) and the blocked
  shared bulk actions; `text-dj-text-muted` contrast on hovered/selected rows (D-017 follow-up).
- PR #53/#54 review nits (2026-10-24, unverified since): logging redactor misses bare
  `token` / JSON-quoted keys; waveform cache unbounded; `effectiveBpm` not clamped to
  40–240; `OverviewMap` offset unclamped; shortcut test skips Meta.
- Full-window Player view, cue/waveform editor and Tag Surgeon apply (T2.2.2+) unbuilt.
