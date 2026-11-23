# Tasks

**There is one task tracker: [`sdd/04-TASKS.md`](../sdd/04-TASKS.md).** Tick a box only
when its Definition of Done is met *and* its running-window QA is recorded in
[`qa/evidence/`](../qa/evidence/).

| Prefix | Meaning | Planned in |
|--------|---------|------------|
| `T0`–`T4` | SDD phase tasks | [`sdd/03-PHASES-AND-PLAN.md`](../sdd/03-PHASES-AND-PLAN.md), ordered by [v1 stages](../plans/v1/implementation-slices.md) |
| `TA.x` | Spec-audit tasks | [2026-10-14 audit](../audits/2026-10-14-spec-audit/04-improvements.md) |
| `TU.x` | UI simplification | [UI simplification plan](../plans/ui-simplification-2026-11.md) |
| `TD/TE/TF/TM/TP.x` | Discovery, enrichment, provider and streaming-export work | 04-TASKS § Post-MVP |
| `TC.x` | Cross-cutting | 04-TASKS § Cross-Cutting |

Where else work is listed — and how it relates:

- **UI build gate:** [`ui-ux/11-IMPLEMENTATION-CHECKLIST.md`](../ui-ux/11-IMPLEMENTATION-CHECKLIST.md) mirrors the UI tasks as acceptance checkboxes; IDs match 04-TASKS.
- **QA checklists:** [`qa/checklists/`](../qa/checklists/) are the manual test scripts a task's QA runs.
- **Retired:** [`archive/DEVELOPMENT_TASK_LIST.md`](archive/DEVELOPMENT_TASK_LIST.md) (duplicated 04-TASKS; frozen 2026-10-19).

New task: add it to 04-TASKS under its phase or prefix, with the source (audit
finding, plan section) in italics, and link it from the plan that schedules it.
