# 06 — Strategic Enhancement Report: assessment against the code

**Date:** 2026-11-08
**Scope:** the externally supplied "DJ Assistant Strategic Enhancement Report" (Priority Analysis Queue + Instant Results, Gig Ready Wizard, Tag Surgeon v2, Smart Gig-Type Presets, Transition Confidence Layer; its 80/20 table, kill list, technical-debt list and Month 1/2–3/4–6 roadmap)
**Method:** read the shipped code, not the specs — `apps/desktop/src-tauri/src/*.rs`, `apps/desktop/src/**`, `crates/core/src/*.rs`, `crates/analysis/src/*.rs`, `docs/ai/memory/state.md`, `docs/plan/06-delivery/implementation-slices.md`. Every claim below carries a `file:line`.
**Status:** corrections accepted for the roadmap; no task in `docs/sdd/04-TASKS.md` was ticked or re-scoped by this document.

---

## 1. Verdict

The report's **direction is right**: prep speed and DJ trust before AI-theatre. Its **diagnosis is wrong in three places**, its **sequencing rests on a feature that does not exist**, and it **omits the constraint that actually gates delivery**. It reads as written against `docs/product/CANONICAL_DOCUMENTATION.md` and `README.md`, not against the repo.

| Report claim | Reality in code |
| --- | --- |
| Enhancement #1 — the DJ waits with "nothing to work on" | Results already stream per track; the UI throws them away until the queue drains. Frontend bug, not a missing queue. |
| Enhancement #1 — priority ordering buys time-to-first-result | The queue is one sequential thread. Concurrency is the 4–8× lever; ordering is second-order. |
| Enhancement #2 — Wizard: Import → … → Export | Export does not exist. Publish is a placeholder naming Stage 9 and Stage 11. |
| Enhancement #3 — Tag Surgeon v2 needs preview + snapshot + undo | Preview, snapshot, undo are shipped and transactional. Only clustering is missing. Cheaper than priced. |
| Enhancement #5 — "we have similarity scoring ready" | True for **pairs** only. No set exists to score transitions across — Beam Search is docs-only. |
| Part 7 — "median Import → USB/Export ready ≤ 12 min" | Unmeasurable today; the last mile is the farthest thing in the repo. |
| Part 5 — "300k tracks will kill the in-memory queue" | This library is 94 tracks, 24 analysed (`state.md`). Speculative at three orders of magnitude. |
| Part 5 — too many tabs "All / Categories / Playlists / Browser / Flash" | That nav does not exist. Real nav below; the actual problem is placeholder views. |

---

## 2. Corrections

### C-1 · Instant results are blocked by the renderer, not the queue — the highest-leverage line in the document

The pipeline already emits per track: `analysis.rs:155-166` fires `analysis:progress` after **every** track. `api.ts:487` receives it. `App.tsx:1774-1781` stores it. And `refreshLibrary()` runs **only** on `analysis:completed` (`App.tsx:1789`).

So for the entire run the DJ sees a progress bar and one filename (`App.tsx:2764-2783`) over a table that never changes — while the rows it wants are already written in SQLite. The complaint is real; its cause is self-inflicted in the renderer.

The precise delta, because it is smaller than the report implies: `AnalysisProgressEvent` (`models.rs:193-201`) carries `job_id, processed, total, track_id, file_path, analysis_status, error` — **no result columns**. Live patching therefore needs either the payload widened with `bpm`/`key_camelot`/`loudness_lufs`, or a per-event single-track refetch. Both are frontend-plus-IPC-shape work, no queue architecture.

### C-2 · The throughput bottleneck is concurrency, which the report never mentions

`run_analysis_queue` (`analysis.rs:101`) is one `thread::spawn` draining a `Vec` sequentially, and the full pass decodes the whole file up front (`pipeline.rs:94`) before five DSP passes. Decode dominates and is embarrassingly parallel. If "4–8 minutes for 40–80 tracks" is real, N workers are what changes it — ordering only decides *which* track you see first.

Adjacent defect worth fixing in the same change: `analysis_candidates` (`library_reads.rs:140-158`) builds the work list with **no `ORDER BY` at all**, so the queue runs in whatever order SQLite returns. `library_writes.rs:244` pins `ORDER BY id` precisely because an unordered snapshot makes undo order-dependent. The read path should hold to the same rule.

### C-3 · There is no ML analysis pipeline to scale

The only model asset is the 61-byte `y = Relu(x)` smoke graph (`registry.rs:31-40`, `fixtures/models/smoke_test.onnx`); all five detectors are deterministic DSP. So "CLAP embeddings on 50k tracks need cloud" is not a future scaling question — it is an architecture that does not exist yet, and nothing about the current per-track cost supports the 4–8 minute figure except decode bandwidth.

### C-4 · The Wizard ends at a step that is not built

`App.tsx:3619` states it verbatim: *"rekordbox sync arrives in Stage 9; playlist-only USB export in Stage 11."* Publish, Sync and Studio are placeholder panels. `state.md` records `dj-rekordbox` as **staged, not started**, blocked on the DJ's own `rekordbox.xml` because Pioneer's `master.db` is encrypted — the XML export is the only readable interchange, and it is the whole promise.

A linear Wizard over an unfinished last mile demos well and delivers nothing. `docs/plan/06-delivery/implementation-slices.md` puts USB export at Stage 11 of 12.

### C-5 · Tag Surgeon is ~60% built; clustering is the only new part

Shipped: bulk edit with a live diff preview (`metadata-bulk.ts:197-208`, T2.1.3); a reversible write where the updates and the `skill_runs` before/after snapshot share **one transaction**, with an undo that refuses to overwrite a newer edit (`library_writes.rs:11-24`, `423-471`); tag sets as the first non-scalar snapshot (D-013); `track_tags` built explicitly as the Surgeon's base (`migrations/007_track_tags_table.sql:5`). Present and **deliberately disabled**: "Fix tags" (`library-menu.ts:92`, `bulk-actions.ts:60`) — "Tag cleaning arrives with the Tag Surgeon (T2.2)".

Missing: all of it new — no Levenshtein, no phonetic/metaphone, no clustering anywhere in the product (the `fuzzy` hits in `enrichment.rs`, `streaming.rs`, `charts.rs` are remote-provider metadata matching, not local cleaning).

### C-6 · Transition Confidence has no set to attach to, but its explanation primitive already exists

`similarity.rs:1-18` scores **one seed against one candidate** — BPM .45 / key .35 / genre .10 / duration .10, renormalised over the signals both sides have. Beam Search appears across `docs/` and appears **zero times** in `crates/`, `apps/`, `packages/`. A per-transition confidence over a generated order therefore depends on Stage 5, not Month 2.

Useful find for the report's own argument: `ScoredTrack.reasons` already emits `"same key 8A"`, `"+1.2% BPM"` (`similarity.rs:38-40`). The "short explanation" the report wants is an extension of a shipped type, not a new subsystem.

### C-7 · The nav the report critiques is not the nav that exists

Real primary tabs (`App.tsx:180-187`): Library, Playlists, Discover, Statistics, Publish, Settings, plus utility views Import, Inbox, Backup, Analysis, Studio, Sync (`App.tsx:2398-3670`). "All / Categories / Playlists / Browser / Flash" is not in the codebase. The cognitive-load risk is genuine but its cause is several placeholder views, which a Wizard does not fix — deleting or filling them does.

---

## 3. Confirmed correct — keep these from the report

- **Risk #1 (AI-theatre before the core loop).** The code agrees: pair-similarity shipped while the sequencer didn't; Publish/Sync/Studio stand as placeholders.
- **Reversibility surface area.** The sharpest line in the report and already load-bearing. `crates/core/tests/wip/metadata_undo.rs` is six `todo!()` cases for undo paths not yet covered — that is the real debt, not the design.
- **Confidence honesty.** Already computed and already ignored: `classify_analysis_status` (`pipeline.rs:48-63`) returns `needs_review` on any degraded signal, and this library reads **68 of 94 tracks as `needs_review`** (`state.md` live check: `complete 24 / failed 2 / needs_review 68`). The app collects the truth and gives the DJ no way to work through it. That loop is the prep loop.
- **Local-first as default, heavy features opt-in.** Nothing in code contradicts it.
- **Presets are cheap.** Caveat: their only customer is the constraint-driven builder, which does not exist. `ui-state.ts:87-170` persists exactly one constraint today — `compatibilityMode` — and no saved-filter or preset concept exists.
- **"15 min for 40 tracks" is not currently achievable.** Correct, but for the reasons in C-1 and C-2, not primarily context switches.

---

## 4. The omission that gates everything

The report plans four months of new surface and never mentions **acceptance debt**. Per `docs/ai/memory/state.md`: Stage 1 shell, Slice 2, Slice 3A and T2.1.8 are all code-complete and **not one task box is ticked**, because the DoD gate is manual QA in the native Tauri window and no agent can click it (F-012). There is no React component test harness — logic lives in pure `lib/*.ts` under `node --test` (219 tests). On this machine `cargo test -p dj-assistant-desktop` cannot even start (`STATUS_ENTRYPOINT_NOT_FOUND`; `pnpm rust:test:portable` is the workaround).

Every Month-1 item in the report adds unaccepted surface to a pile that currently cannot be signed off. Scale mismatch compounds it: the plan is written for 50k–300k libraries; the working library is 94 tracks.

---

## 5. Reordered plan (value per hour, gated on acceptance)

| # | Work | Replaces | Gate note |
| --- | --- | --- | --- |
| 1 | Stream `analysis:progress` into the row — widen the event payload (`models.rs:193`) or refetch one track per event; keep the bar | Report #1's "Instant Results" | Frontend + IPC shape. Hours. Kills the headline complaint with no new architecture. |
| 2 | Parallelise the queue: bounded worker pool over decode+DSP, keep the per-track emit; add `ORDER BY id` in `analysis_candidates` while there | Report #1's premise | The real 4–8 min → 1–2 min. Determinism also protects the undo path. |
| 3 | **Close the open QA gate** (Stage 1, Slice 2, Slice 3A, T2.1.8) | — in the report at all | Everything below inherits this blocker. Human clicks; agent verifies read-only with `dj-query`. |
| 4 | Rekordbox XML export, pulled forward from Stage 9/11 | Report #2's missing last mile | Without it the 15-minute promise cannot be measured or felt. Needs the DJ's `rekordbox.xml`. |
| 5 | `needs_review` triage flow — a queue of the tracks the pipeline already flagged, with the confidence shown honestly | Report #5's stated goal, without the AI layer | 68/94 tracks are already waiting. Highest daily-use value per hour in the app. |
| 6 | Priority in `analysis_candidates` (rating DESC, then active-playlist/"Tonight" tag, then unanalysed) | Report #1 | Only after 1–2, and only once throughput is fixed. Keep a stable id tiebreak. |
| 7 | Tag Surgeon clustering (Levenshtein + phonetic) onto the existing preview → apply → undo path | Report #3 | Mostly new algorithm, almost no new plumbing. Stage 6. |
| 8 | Beam Search sequencer → then per-transition confidence on `ScoredTrack.reasons` → then Gig-Type presets | Reports #5 and #4 | Stage 5. Presets last: nothing consumes them before the builder exists. |
| 9 | Gig Ready Wizard | Report #2 | An orchestration layer earns its keep once the stages it orchestrates work end-to-end. |
| 10 | Transition Heatmap, embeddings, B2B, marketplace | Report Part 4 | Unanimous with the report's own kill list. |

### Metric corrections

- Replace the primary metric with **time-to-first-usable-row** (measurable today, and it fails immediately if #1 regresses). Keep Import→USB-ready as the north-star, but it is unmeasurable until #4 lands.
- Drop "Wizard completion ≥ 40%": it measures adoption of a feature, not speed delivered. Prefer "median tracks reviewed per session".
- Keep the undo-rate quality gate (<8%) — it is the right instrument for #7 and is measurable against `skill_runs` from day one.

---

## 6. Follow-ups this document creates

1. Decide #1's shape: widen `AnalysisProgressEvent` vs. per-event single-track refetch. Widening touches the contract; check `API_CONTRACTS.md` and `packages/shared` for drift before choosing.
2. Record C-2's missing `ORDER BY` as a defect, not a feature — it is the same class of non-determinism `library_writes.rs:244` already guards against.
3. Note in `docs/sdd/04-TASKS.md` that T2.2 (Tag Surgeon) is blocked on clustering only, since the reversible path is delivered.
4. `README.md` and `index.html` still promise exports "for rekordbox, Serato, or CDJ" in present tense. Either soften them or file the gap against Stage 9/11.
5. The three Nov-8 documents in this directory (`PROFESSIONAL_DJ_SYSTEM_AUDIT.md`, `DJ_ASSISTANT_PRO_REQUIREMENTS.md`, `FACTORY_AI_FOR_DJ_ECOSYSTEM.md`) are external inputs, unindexed and unverified against code. `DJ_ASSISTANT_PRO_REQUIREMENTS.md` claims compilation errors in `commands.rs`/`scanner.rs` — verify before anyone acts on it.

## Docs to edit

`docs/plan/06-delivery/implementation-slices.md` (stage order for #4), `docs/sdd/04-TASKS.md`, `docs/sdd/05-ACCEPTANCE.md` (replace `Manual` for the QA gate), `docs/architecture/API_CONTRACTS.md` (analysis event payload), `README.md`, `apps/desktop/index.html` (present-tense export promise).
