# Working state

Ephemeral. Newest first. **Rotate aggressively** — if a line would still be true
in two weeks, it belongs in [`decisions.md`](./decisions.md); if it is just a
fact, it belongs in [`facts.md`](./facts.md). Delete anything stale.

## 2026-11-23 · Snapshot (supersedes every entry below where they differ)

- `origin/main` = `11f87333`. Merged since 11-19: PR #91 (library table pass, migration 010,
  `refresh_artwork`), #92 (state audit correction), #96 (issue #89 `beatgrid_confidence`
  backfill; issue closed), #98 (T2.3.1–T2.3.3 Maintain dialog: duplicates, versions, Library
  Health Score; migration 012) and #99 (T2.3.4 Prep Auditor). **No PRs open.**
- **Code-shipped, waiting on running-window QA + the human tick (F-012):** T2.1.x boxes still
  open, Tag Surgeon T2.2.1–T2.2.6 (T2.2.1 QA recorded, tick only), T2.3.1–T2.3.4, #89 backfill.
- **Unbuilt in Phase 2:** T2.3.5–T2.3.6 Cue Master, T2.4.4 gain/limiter + temp loop, T2.4.5
  high-res art path, T2.4.6 remap/beat-jump/output settings, T2.4.7 guardrails, T2.5
  visualizer. **Phase 3** (set builder, export, USB) not started.
- **`chore/phase2-qa-closeout`** (local, unpushed): Phase 2 QA close-out evidence
  `docs/qa/evidence/2026-11-19-PHASE2-QA-CLOSEOUT.md` — B4, Stage 1 C3, T2.1.10 View columns
  re-run PASS; Slice 4–8 risk rows PASS; artwork rows BLOCKED (all 94 rows NULL
  `artwork_path`). Its feedback entries were renumbered past main's F-021 on 11-23; still
  needs a PR.
- Library table pass leftovers (proposal `docs/ui-ux/14-LIBRARY-TABLE-UPGRADES.md`, v0.2 not
  approved): label backfill + label search; density, waveform column, track colour, column
  filters, Table/List/Grid views, Tag Manager.

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
  statuses, `docs/product/PROJECT_CONTEXT.md` (baseline §0, IPC tables, UI surface,
  §17.3–17.5, §24), the Phase 2 plan, CHANGELOG catch-up, and this ledger.
- **Nothing ticked.** The B4 PASS re-run and any running-window QA for Slices 4–8
  and the audio/peaks paths have not been executed; the human ticks on `main`.

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

- Pass 3 of [`../../qa/evidence/2026-11-09-RUNNING-WINDOW-QA.md`](../../qa/evidence/2026-11-09-RUNNING-WINDOW-QA.md)
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

## Still open

- Rekordbox XML export (audit §7.1, T3.2.1) — a `dj-rekordbox` reader from another session
  sits in a local stash on this box (see `AGENTS.local.md`); review it before starting.
- `sqlite-best-practices` / `rust-skills` install question — candidates in
  `skills.policy.json` → `candidates`.
- **Artwork on the live library:** `refresh_artwork` shipped in PR #91, but the 94 live rows
  were all NULL `artwork_path` at the 11-19 sweep; until it has run, T2.1.9 with-art/no-bleed
  and T2.4.5 with-art rows stay BLOCKED.
- Stale QA checklist wording: Pass 4 K9 (A7/F6 reconciled on `chore/phase2-qa-closeout`).
- T2.1.12 collapsed-rail source icons; T2.1.3 select-all (`Ctrl/Cmd+A`) and the blocked
  shared bulk actions; `text-dj-text-muted` contrast on hovered/selected rows (D-017 follow-up).
- PR #53/#54 review nits (2026-10-24, unverified since): logging redactor misses bare
  `token` / JSON-quoted keys; waveform cache unbounded; `effectiveBpm` not clamped to
  40–240; `OverviewMap` offset unclamped; shortcut test skips Meta.
- Full-window Player view and cue/waveform editor unbuilt.
