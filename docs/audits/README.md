# Audits

Dated reviews of the product, the code and the docs. An audit records what was
true on its date; it is **not** a spec. Work an audit finds goes to a plan in
[`plans/`](../plans/README.md) and to tasks in [`sdd/04-TASKS.md`](../sdd/04-TASKS.md).

| Date | Audit | Led to |
|------|-------|--------|
| 2026-11-22 | [UI/UX and UI-spec audit](2026-11-22-ui-ux-audit.md) — 29 findings from the running app | [UI simplification plan](../plans/ui-simplification-2026-11.md), TU.1–TU.16 |
| 2026-11-22 | [Docs structure and plans audit](2026-11-22-docs-and-plans-audit.md) | This folder layout; one task tracker |
| 2026-11-08 | [Phase 0 capability map](2026-11-08-phase0-capability-map.md) (T2.1.10) | T2.1.10 |
| 2026-10-19 | [UI remediation status](2026-10-19-ui-remediation-status.md) | Bucket 1 fixes (applied) |
| 2026-10-14 | [Spec / functions / settings audit](2026-10-14-spec-audit/README.md) | TA.1–TA.14 |

## Conventions

- File name: `YYYY-MM-DD-<topic>.md`; a multi-file audit gets a folder of the same name.
- Screenshots and other evidence: `assets/YYYY-MM-DD-<topic>/`.
- State the build, the data used, the method, and what was **not** covered.
- Every finding gets an ID (`U-01`, `D-1`, …) and a severity, and maps to a task.
- Reusable prompt for the next UI/docs audit: [`prompts/ui-and-docs-audit.md`](../prompts/ui-and-docs-audit.md).
