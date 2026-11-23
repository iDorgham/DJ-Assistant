# Progress Audit — 2026-11-19

**Source of truth:** [`../../sdd/04-TASKS.md`](../../sdd/04-TASKS.md) (197 task checkboxes), read at `main` = `7036f833` (2026-11-17, PR #88).
**Method:** every checkbox counted mechanically; each finding verified against the code or an evidence file, not against prose.
**Scope:** measurement + ledger-honesty audit only. No code was changed.

---

## 1. Headline

| Measure | Done | Total | % |
| --- | --- | --- | --- |
| All boxes in the ledger | 66 | 197 | **33.5%** |
| MVP path only (Phases 0–4) | 49 | 127 | **38.6%** |
| Post-MVP + audit + cross-cutting (non-gating) | 17 | 70 | 24.3% |

The 33.5% figure is diluted: 70 of the 197 boxes (36%) are `TA.x`, `TP/TD/TE/TM/TF` and `TC.x` work that does not gate an MVP exit. **Report the MVP-path number, not the grand total.**

## 2. Per phase

| Phase | Ticked | % |
| --- | --- | --- |
| 0 — Foundation | 32/33 | 97.0% |
| 1 — Analysis Engine | 15/15 | 100.0% |
| 2 — Library Intelligence & Tag Cleanup | 2/34 | **5.9%** |
| 3 — Set Builder & Export | 0/23 | 0.0% |
| 4 — Polish, Automation, Beta | 0/22 | 0.0% |
| Audit-driven TA | 2/14 | 14.3% |
| Post-MVP (TF/TP/TD/TE/TM) | 13/29 | 44.8% |
| Cross-cutting TC | 2/27 | 7.4% |

## 3. The headline understates Phase 2

Phase 2 reads 5.9% but is not 6% built. Classified from each task's own note and checked against the tree:

| State | Tasks | Count |
| --- | --- | --- |
| Ticked | T2.1.5, T2.1.10 | 2 |
| Code-complete — **only** the native QA gate open | T2.1.0, T2.1.1, T2.1.2, T2.1.4, T2.1.6, T2.1.7, T2.1.8, T2.1.9, T2.1.13 | 9 |
| Partially implemented (real code gaps + QA) | T2.1.3, T2.1.11, T2.1.12, T2.4.1, T2.4.2, T2.4.3, T2.4.4, T2.4.5, T2.4.6 | 9 |
| Not started | T2.2.1–6, T2.3.1–6, T2.4.7, T2.5 | 14 |

At 1.0 / 0.9 / 0.5 / 0 credit: Phase 2 ≈ **42.9%** built (vs 5.9% ticked); MVP path ≈ **48.5%** (vs 38.6%). Slices 1–8 of the [Phase 2 plan](../../plans/phase2-library-player.md) are all merged.

**Read this as:** 26.5% of Phase 2 (9 boxes) is QA debt convertible with zero new code, not development debt.

---

## 4. Findings

**F-1 · T2.1.10 was ticked by a merge, not by evidence — the note under it is false, the tick turns out to be mostly earned.**
[`04-TASKS.md:121`](../../sdd/04-TASKS.md#L121) carried "**QA status 2026-10-27: not executed in the native app** — Play, Rate and the column toggles are code-verified only" *beneath an `[x]`*, and the tick's own origin is `c03a5618` (2026-10-27, "docs: mark T2.1.10 as complete post-PR-60 merge") — struck from the merge, three days after [`T2.1.10-BATCH-A-PARTIAL.md:14`](./T2.1.10-BATCH-A-PARTIAL.md#L14) said "**It is not a sign-off. T2.1.10 must not be ticked.**" Re-checked before acting: later passes *do* cover most of the menu in the live window — Pass 3 **A1** inventories it at the cursor and re-confirms it after the F1 restart, Pass 3 **F2** rates through it, Pass 4 **K3** shows the menu's Play loading the deck. **The gap is one action group: the menu's View columns toggles have no running-window evidence anywhere**, and the `canHideColumn` guard around them is unexecuted. **Resolution applied 2026-11-19:** keep the tick, replace the false note with the citations above, and record View columns as outstanding. *(Lesson taken: a box ticked "because the PR merged" is not honest, but re-auditing it before deleting it may find evidence the note never learned about.)*

**F-1b · The ledger cites drifted line numbers.**
The same note family cites `App.tsx:2101-2109` and `App.tsx:1878-1896`; on `7036f833` those handlers live at `App.tsx:2175-2189` and `App.tsx:1952-1970`. **Fix:** cite symbols, not line numbers — done for the A7/F6 rows.

**F-2 · T2.1.5's tick rests partly on a mock environment.**
[`04-TASKS.md:116`](../../sdd/04-TASKS.md#L116) cites "verified in the dev-server browser (toggle, resize, reorder, auto-fit, reset, reload)". A `pnpm dev:desktop` tab serves **mock** rows without the Tauri IPC (F-009; `AGENTS.local.md`), so that is not acceptance evidence. Only the virtualization half carries native numbers (179 ms / 16.9 ms p95). **Fix:** re-run the five column interactions in the Tauri window and replace the citation.

**F-3 · The Phase 2 exit criterion tests behavior that no longer exists.**
[`05-ACCEPTANCE.md:75`](../../sdd/05-ACCEPTANCE.md#L75) (P2.13) still requires "routes Library/Preparation/Auto Performance via the header and `Ctrl/Cmd+1–3`" and dock "Hidden/Mini/Full". Shipped behavior is the six-tab shell with `Ctrl/Cmd+1–6` and three presentations ([`04-TASKS.md:111`](../../sdd/04-TASKS.md#L111)). The 2026-10-24 entry in [`../../ai/memory/state.md`](../../ai/memory/state.md) claims P2.13 was already updated to the six-tab shell — it wasn't. Phase 2 cannot be accepted against this text.

**F-4 · Two ledgers, two denominators, one of them stale.**
[`DEVELOPMENT_TASK_LIST.md`](../../tasks/archive/DEVELOPMENT_TASK_LIST.md) measures **53/163 = 32.5%** against the **66/197 = 33.5%** here. Its last write was `16734eb4` on **2026-10-21**, so it knows nothing of PRs #60, #65, #70–#72, #78, #80–#81, #86, #88. Two near-identical percentages from unrelated denominators invite exactly the wrong comparison. **Fix:** treat this file as the sole progress ledger and reduce the other to a pointer, or refresh it on the same commit that changes a box.

**F-5 · Real code gaps are hidden behind "stays unticked until native QA".** Verified in the tree, not inferable from the headline:

| Task | Gap that QA cannot close | Evidence |
| --- | --- | --- |
| T2.1.11 | **Add to set** missing (dock only grows the library selection) | `addToSet` reason is `Coming in Phase 3` — [`bulk-actions.test.ts:63`](../../../apps/desktop/src/lib/bulk-actions.test.ts#L63); needs the Phase 3 set model |
| T2.1.12 | collapsed-rail source icons/tooltips missing | rail maps `NAV_ITEMS` only — [`App.tsx:188`](../../../apps/desktop/src/App.tsx#L188), [`App.tsx:2674`](../../../apps/desktop/src/App.tsx#L2674) |
| T2.4.3 | F-3 editor hookup (F-3 unbuilt), halve/double re-anchoring, **backfill**, low-tier warning styling unverified | open issue **#89** |
| T2.4.4 | seek <100 ms unmeasured, gain/limiter and temp loop absent, beat jump not grid-quantized from the native cursor | `04-TASKS.md:146` |
| T2.4.6 | key remapping, full beat-jump map, output device/samplerate settings absent | `04-TASKS.md:148` |
| T2.4.7 | no evidence recorded at all | `04-TASKS.md:149` |

**F-6 · Phase 2 exit is not reachable by QA alone — and the ledger's own ordering hides this.**
P2.2–P2.8 (7 of 13 Phase 2 criteria) need Tag Surgeon, duplicate/version grouping, Library Health Score, Cue Master and Prep Auditor. Absent from the code (grep across `crates/` and `apps/desktop/src/` finds no alias clustering, no `library_health`, no cue-master path, no `build_set`). 12 of the 14 "not started" Phase 2 tasks are this block, so it — not the QA debt — is the long pole.

**F-7 · Open tracked gaps not represented by any box.**
Issues **#74** (rating cell arrow-key navigation between stars) and **#73** (a query load can overwrite a write outcome in the status line) sit outside the ledger; **#89** is named in the T2.4.3 note. Mix-dock finding **F-1** (TrackPanel paints over the dock when both are open, [`2026-11-17-T2111-MIX-DOCK-QA.md:65`](./2026-11-17-T2111-MIX-DOCK-QA.md#L65)) is logged in evidence with no task line.

**What held up.** No duplicate task IDs (197 unique); Phase 0/1 ticked items match the code and CI evidence; the 2026-11-09/11-17 running-window records are consistent with the annotations that cite them; the `2025-10-25` date in `STAGE1-QA-SIGNOFF.md` is already flagged as a typo at its line 105.

---

## 5. Next task

**In strict ledger order** the first unticked box is **T0.1.17** (branch protection on `main`) — externally blocked on GitHub Pro pricing with a documented exception; not actionable.

**Recommended next action — the Phase 2 QA close-out sweep** (converts 9 merged tasks into ticks at zero build cost):

> **Executed 2026-11-19** — [`2026-11-19-PHASE2-QA-CLOSEOUT.md`](2026-11-19-PHASE2-QA-CLOSEOUT.md).
> Items 1–2 re-ran **PASS**; item 3's risk rows were driven in the native window (T2.4.1/T2.4.2/T2.4.4
> and T2.1.12 PASS, T2.1.9 placeholder + hover-play PASS, its with-art/no-bleed rows and T2.4.5's
> with-art row **BLOCKED** — `artwork_path` is NULL for all 94 rows and nothing backfills it); item 4
> was done before the passes; item 5 stays superseded. No box was ticked — that is the human's step on
> `main`.

1. Re-run **B4** (unchanged-metadata save) on a post-PR-#78 build — currently a FAIL turned "fixed, re-run pending" in T2.1.7 and T2.1.13.
2. Re-run Stage 1 **C3** (Try again / Reload app) — the only partial in an otherwise PASS Pass 1, and the reason T2.1.0 stays open.
3. Run the Slices 4–8 QA never executed: T2.1.9 (hover-play + no art bleed), T2.1.12 (source tabs), T2.4.1/T2.4.2/T2.4.4 (real peaks, dual-wave, native audio). **Plan gap found while starting:** no runnable checklist exists for any of these — `docs/qa/checklists/` carries only Stage 1, Slice 2 and Slice 3A checklists, and T2.1.11/T2.4.3 got ad-hoc passes on 2026-11-17 instead. Agreed 2026-11-19: **targeted passes over the risk rows, recorded as a dated evidence file, no new checklist prose.**
4. Reconcile the stale checklist rows **A7, F6** (Slice 3A) and **K9** (key pills) — deliberate shipped behavior contradicting checklist text. **Done 2026-11-19:** both rows rewritten in `SLICE3A_MANUAL_QA_CHECKLIST.md` (with the Slice 3A header status also corrected — it still claimed "NOT EXECUTED" after Pass 3 ran), the two-case Compatible-only rule written into [`docs/ui-ux/03-LIBRARY-VIEW.md`](../../ui-ux/03-LIBRARY-VIEW.md) §3.3, and the drifted line-number citations replaced with symbol names.
5. ~~Untick **T2.1.10** per F-1~~ — superseded by F-1's resolution: keep the tick, fix the note.

**Next new-build task:** **T2.2.1 — Tag Surgeon fuzzy clustering** (first in phase order among the not-started; it unblocks T2.2.2–T2.2.6 and acceptance criteria P2.2–P2.4, and reuses the `track_tags` table from T2.1.7). Small unblocking items that can land alongside: T2.1.12 rail icons, #89 backfill, F-1 dock overlay.

**Do not** start Phase 3: Phase 2's exit gate (P2.1–P2.13) is unsatisfied and T2.1.11's Add-to-set is the only Phase 2 item that actually waits on it.
