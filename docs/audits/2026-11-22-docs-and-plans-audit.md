# Documentation structure and plans audit — 2026-11-22

**Scope:** every Markdown and asset file under `docs/` (195 tracked + 5 untracked
images), the root-level docs, and every plan or task file in the repository.
**Outcome:** `docs/` was reorganised into 15 category folders (139 moves), all
references were rewritten (114 files, including agent definitions, policy files
and source comments), and the plans were consolidated under
[`docs/plans/`](../plans/README.md) with one task tracker.
**Tooling:** [`scripts/docs-reorg-2026-11.cjs`](../../scripts/docs-reorg-2026-11.cjs)
holds the old → new path map and did the rewrite + `git mv`. A link check before
and after found the same single broken link (see §5), so the move broke nothing.

---

## 1. What was there

```text
docs/
  README.md
  PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md   ← plan, loose at the top
  UI_UX_PLAYER_AND_LAYOUT_SPEC.md                ← 1,021-line UI narrative, loose at the top
  ADR/  ai/  approvals/  architecture/  audit/  context/  devops/  diagrams/
  engineering/   ← guides + 2 plans + a task list + 3 QA checklists + evidence
  enhancements/  evidence/
  plan/          ← approved v1 plan: product + UX specs + design rules + delivery + diagrams
  product/  sdd/  superpowers/specs/
  ui/            ← current UI spec (+ 5 untracked icon PNGs)
  ui-ux/         ← superseded Phase 0 UI spec, same topic as ui/
capmap_phase0.md ← audit document at the repository root
```

### Problems found

| # | Problem | Example |
|---|---------|---------|
| D-1 | **Two UI folders with near-identical names**, one current and one superseded, plus a third UI spec loose at the top and a fourth set of UI rules inside `plan/`. | `docs/ui/`, `docs/ui-ux/`, `docs/UI_UX_PLAYER_AND_LAYOUT_SPEC.md`, `docs/plan/05-design-system/` |
| D-2 | **Plans scattered over four folders** with no index saying which one is live. | `docs/plan/06-delivery/`, `docs/PHASE2_…PLAN.md`, `docs/engineering/SLICE3A_PLAN.md`, `docs/sdd/03-PHASES-AND-PLAN.md` |
| D-3 | **Two task trackers** for the same phases. `engineering/DEVELOPMENT_TASK_LIST.md` was last reconciled 2026-10-19; `sdd/04-TASKS.md` on 2026-11-17 — and only the second is read by the memory snapshot. | both list Phase 0–4 with different tick states |
| D-4 | **`engineering/` was a catch-all**: guides, plans, a task list, QA checklists and acceptance evidence. | 11 files, 5 kinds |
| D-5 | **Evidence in three places.** | `docs/evidence/`, `docs/approvals/`, `docs/engineering/PHASE0_ACCEPTANCE_EVIDENCE.md` |
| D-6 | **Specs had no home.** Feature behaviour lived in `plan/02–04`, a design spec under a tool-named folder, and an API guide at the `plan/` root. | `docs/superpowers/specs/`, `docs/plan/api-access-guide.md` |
| D-7 | **One-off locations:** a single-file `context/` folder, an `enhancements/` folder holding AI-tooling (MCP) docs outside `ai/` (contrary to memory decision D-004), and an audit at the repo root. | `docs/context/`, `docs/enhancements/`, `capmap_phase0.md` |
| D-8 | **Mixed folder casing** (`ADR/` next to lowercase folders). | `docs/ADR/` |
| D-9 | **Untracked, unnamed images** in the spec folder. | `docs/ui/library (1).png` |

---

## 2. What it is now

```text
docs/
  README.md        how the docs are organised, where to start, where new docs go
  product/         what and why: canonical spec, brief, glossary, vision, IA, onboarding, project context
  specs/           how each feature behaves: experience/, player/, data-and-sync/, integrations/, features/
  ui-ux/           the UI spec (one folder): numbered set, guidelines/, wireframes/, reference/, archive/
  architecture/    system design, data model, contracts, models, skills
  adr/             architecture decision records
  sdd/             specification-driven development set (spec → design → phases → TASKS → acceptance)
  plans/           delivery plans: v1/ (approved plan), feature plans, archive/
  tasks/           how tasks are tracked; archive/ for the retired task list
  audits/          dated audits (this file), the 2026-10-14 spec audit, screenshot assets
  qa/              checklists/, evidence/, approvals/
  diagrams/        Mermaid diagrams 00–18
  engineering/     setup, standards, testing, security, Windows build
  devops/          CI/CD, pipeline security, workflow templates
  ai/              agents, memory, skills, mcp/
  prompts/         reusable prompts for recurring AI-driven reviews
```

Decisions made (and why):

1. **`ui-ux/` is the single UI home.** The current numbered spec moved from
   `docs/ui/` into it; the superseded Phase 0 set moved to
   `ui-ux/archive/phase0/`; the v1 rules became `ui-ux/guidelines/`; the v1.9
   narrative became `ui-ux/reference/`. Every reference to `docs/ui/` in
   AGENTS.md, `skills.policy.json`, `agents.registry.json`, the agent
   definitions and source comments now points at `docs/ui-ux/`.
2. **The v1 plan was split by kind, not kept as one tree.** Its product docs
   went to `product/`, its feature specs to `specs/`, its design rules to
   `ui-ux/guidelines/`, its delivery docs to `plans/v1/`. The plan README
   (decisions D-001–D-052) stays the head of `plans/v1/`.
3. **`sdd/` was left intact.** It is a numbered method set and the memory
   snapshot and `scripts/update-task-docs.py` read `sdd/04-TASKS.md`. It stays
   the one task tracker (§4).
4. **`ai/` was left intact** (memory decision D-004) and absorbed `enhancements/`
   as `ai/mcp/`.
5. **`engineering/` keeps only engineering guides.** It was not listed in the
   suggested shape, but setup, standards and the build runbook have no better
   home and are linked from CONTRIBUTING and AGENTS.md.
6. **`prompts/` was created** for the reusable audit prompt; there were no prompt
   files before.

The full old → new map is the `RULES` table in
[`scripts/docs-reorg-2026-11.cjs`](../../scripts/docs-reorg-2026-11.cjs).

---

## 3. Plans review

| Plan | Before | Verdict | Now |
|------|--------|---------|-----|
| Approved v1 plan (Stages 0–12, D-001–D-052) | `plan/README.md` + `plan/06-delivery/` | **Live — the delivery order.** Keep. | [`plans/v1/`](../plans/v1/README.md) |
| SDD phase plan (Phase 0–4, 90 days) | `sdd/03-PHASES-AND-PLAN.md` | **Superseded for ordering** by the v1 stages, still the source of the task IDs (T0–T4). Keep in place with a banner and a Stage ↔ Phase map in [`plans/README.md`](../plans/README.md). | unchanged path |
| Phase 2 Library + Player plan | `docs/PHASE2_…PLAN.md` | **Live** (T2.1.5–T2.4, reconciled 2026-11-17). | [`plans/phase2-library-player.md`](../plans/phase2-library-player.md) |
| Slice 3A tags + comments plan | `engineering/SLICE3A_PLAN.md` | **Implemented** (PR #53, QA pending). Archive. | [`plans/archive/`](../plans/archive/slice-3a-tags-comments.md) |
| Library table upgrades | `ui/14-…` | A **design proposal**, not a plan. Stays a UI doc; its density section is scheduled by the UI plan. | [`ui-ux/14-…`](../ui-ux/14-LIBRARY-TABLE-UPGRADES.md) |
| UI implementation checklist | `ui/11-…` | **Live UI gate.** Gets a Simplification phase. | [`ui-ux/11-…`](../ui-ux/11-IMPLEMENTATION-CHECKLIST.md) |
| CI/CD and AI automation plans | `devops/` | Topic-owned, current. Linked from the plans index. | unchanged |
| MCP / plugin enhancement plan | `enhancements/` | AI tooling. | [`ai/mcp/`](../ai/mcp/mcb-plugin-enhancement-plan.md) |
| UI simplification plan | — | **New**, from the UI audit. | [`plans/ui-simplification-2026-11.md`](../plans/ui-simplification-2026-11.md) |

Nothing needed to be recreated from scratch: the plans are detailed and mostly
current. What was missing was **an index that says which one governs**, and a
single task list.

## 4. Tasks review

- **One tracker:** [`sdd/04-TASKS.md`](../sdd/04-TASKS.md). The UI audit's work is
  added there as **TU.1–TU.16** (new `TU.x` prefix in the legend).
- `engineering/DEVELOPMENT_TASK_LIST.md` is **retired** to
  [`tasks/archive/`](../tasks/archive/DEVELOPMENT_TASK_LIST.md) with a banner: it
  duplicated 04-TASKS and had drifted a month behind it.
- [`tasks/README.md`](../tasks/README.md) explains the ID scheme and where each
  kind of task lives.

## 5. Verification

- Relative-link check over all 198 Markdown files: **1 broken link before, the
  same 1 after** — `specs/features/2026-11-19-tag-surgeon-fuzzy-clustering-design.md`
  points at `apps/desktop/src/lib/library-menu.ts` with `../../`, which resolves to
  `docs/apps/...`; the file exists, so the link needed `../../../`. It pre-dates
  this pass and is now fixed.
- `pnpm agent:sync --write` regenerated the 33 mirrored agent files;
  `pnpm skills:inventory` regenerated the routing summary; `pnpm agent:doctor`
  reports 0 hard problems.
- Source files touched by the rewrite (33) changed only comments, one test name
  and one Settings string that printed a docs path (that string is itself a
  copy finding, U-12).

## 6. Left as is (flag for the owner)

- Root clutter that is not documentation and may be someone's work in progress:
  `nul`, `NVIDIA Corporation`, `b5bf2e54cb654f7b`, `pnpm-install.log`,
  `dj_assistant_qa_copy.db`, `.pr72.json`, `check_schema.py`. Not touched.
- `CHANGELOG.md` was excluded from the path rewrite on purpose: it records
  history, so its old paths describe what was true at the time.
- The OpenCode/Qoder **skill mirrors** (`*/skills/brainstorming`) still tell the
  brainstorming skill to write designs to `docs/superpowers/specs/`. They are
  generated, ignored copies; new design specs belong in `docs/specs/features/`
  (stated in [`docs/README.md`](../README.md)).
