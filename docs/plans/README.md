# Plans

Delivery plans: **what gets built, in what order, and how we know it is done.**
Behaviour lives in [`specs/`](../specs/README.md), UI in [`ui-ux/`](../ui-ux/README.md),
tasks in [`sdd/04-TASKS.md`](../sdd/04-TASKS.md).

## Which plan governs

| Level | Plan | Status |
|-------|------|--------|
| **Product delivery order** | [v1 plan](v1/README.md) → [implementation slices (Stages 0–12)](v1/implementation-slices.md) | Approved; Stage 2 in progress |
| Acceptance | [v1 acceptance tests](v1/acceptance-tests.md) · [SDD acceptance](../sdd/05-ACCEPTANCE.md) | Proposed · Living |
| Open decisions | [open questions](v1/open-questions.md) · [discussion log](v1/discussions.md) | Living |
| Feature plan | [Phase 2 Library + Player](phase2-library-player.md) (T2.1.5–T2.4) | Living |
| Feature plan | [UI simplification 2026-11](ui-simplification-2026-11.md) (TU.1–TU.16) | Proposed |
| Topic plans | [DevOps / CI-CD](../devops/DEVOPS_CICD_PLAN.md) · [AI dev automation](../devops/AI_DEVELOPMENT_AUTOMATION_PLAN.md) · [MCP / plugins](../ai/mcp/mcb-plugin-enhancement-plan.md) | Topic-owned |
| History | [`archive/`](archive/) — [Slice 3A](archive/slice-3a-tags-comments.md) | Implemented |

Rule: when two plans disagree on **order**, the v1 implementation slices win; on
**scope of a feature**, the feature plan wins; on **UI**, the
[UI guidelines](../ui-ux/guidelines/ui-ux-guidelines.md) win.

## Stages ↔ SDD phases (approximate)

The v1 plan orders work by **Stage**; tasks keep their **SDD phase** IDs.

| v1 Stage | Covers | SDD task IDs |
|----------|--------|--------------|
| 0 Baseline | backup, repo safety | T0.x |
| 1 Foundation and shell | six-tab shell, Inbox, player dock | T0.x, T2.1.0–T2.1.2 |
| 2 Library and Track panel | table, filters, rating, tags, key pills, Track panel; **UI simplification** | T2.1.x, TU.x |
| 3 Import Center | scan, watch folders, duplicates | T0.2.x, T1.2.x + new import work |
| 4 Player | waveform, cues, grid, beat jump | T2.4.x, T2.3.5 |
| 5 Playlists and Set Score | sets, scoring, suggestions | T3.1.x, TA.2 |
| 6 Maintain and tags | Tag Surgeon, Tag Health, duplicates | T2.2.x |
| 7 Discover · 8 Statistics | discovery, charts, insight | TD.x, TE.x, TF.x |
| 9 Sync · 10 Backup | DJ-app sync, backup/restore | T3.2.x (export), TM.x |
| 11 USB export | USB safety and export | T3.2.6–T3.2.9, TA.8 |
| 12 Polish | performance, a11y, beta | T4.x, TA.x, TU.16 |

## Adding a plan

- Name it `<topic>-<yyyy-mm>.md` or `<feature>.md`, put a status line at the top,
  and link it from the table above and from the tasks it schedules.
- When it is done, move it to `archive/` with a one-line banner.
