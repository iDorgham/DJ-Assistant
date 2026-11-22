# DJ Assistant — Documentation

Every project document lives in one of the folders below. Each folder answers one
question; if a new document fits two folders, it belongs in the one that owns the
**question it answers**.

> **New here?** Read the [repository README](../README.md), then the
> [canonical documentation](product/CANONICAL_DOCUMENTATION.md) (source of truth for
> the product), then set up with the [development guide](engineering/DEVELOPMENT.md).
> AI agents start at [`AGENTS.md`](../AGENTS.md).

---

## Map

```text
docs/
├── product/       WHAT and WHY     canonical spec, brief, vision, IA, glossary, project context
├── specs/         HOW IT BEHAVES   feature specs: experience, player, data & sync, integrations, features
├── ui-ux/         HOW IT LOOKS     design system, shell, views, player, components, a11y, guidelines
├── architecture/  HOW IT'S BUILT   system design, data model, IPC/HTTP contracts, models, skills
├── adr/           WHY IT'S BUILT SO  architecture decision records
├── sdd/           THE METHOD SET   spec → design → phases → TASKS → acceptance
├── plans/         IN WHAT ORDER    v1 plan (Stages 0–12), feature plans, archive
├── tasks/         WHO DOES WHAT    how tasks are tracked (the tracker is sdd/04-TASKS.md)
├── audits/        WHAT WE FOUND    dated audits + screenshot evidence
├── qa/            DID IT WORK      manual checklists, QA evidence, screenshot approvals
├── diagrams/      PICTURES         Mermaid diagrams 00–18
├── engineering/   HOW TO WORK      setup, standards, testing, security, Windows build
├── devops/        HOW IT SHIPS     CI/CD, pipeline security, workflow templates
├── ai/            AI TOOLING       agents, shared memory, skills routing, MCP
└── prompts/       REUSABLE PROMPTS for recurring AI-driven reviews
```

## Sources of truth

When documents disagree, this order decides:

| Question | Authority |
|----------|-----------|
| What the product is | [product/CANONICAL_DOCUMENTATION.md](product/CANONICAL_DOCUMENTATION.md) |
| Navigation and IA (locked) | [product/information-architecture.md](product/information-architecture.md) |
| UI rules | [ui-ux/guidelines/ui-ux-guidelines.md](ui-ux/guidelines/ui-ux-guidelines.md), then [ui-ux/01-DESIGN-SYSTEM.md](ui-ux/01-DESIGN-SYSTEM.md) for tokens and components |
| Delivery order | [plans/v1/implementation-slices.md](plans/v1/implementation-slices.md) |
| Task status | [sdd/04-TASKS.md](sdd/04-TASKS.md) (the only tracker) |
| Done-ness | [sdd/05-ACCEPTANCE.md](sdd/05-ACCEPTANCE.md) + evidence in [qa/evidence/](qa/evidence/) |
| Why a technical choice was made | [adr/](adr/README.md) |
| Current progress snapshot | [ai/memory/state.md](ai/memory/state.md) · [product/PROJECT_CONTEXT.md](product/PROJECT_CONTEXT.md) |

---

## Folders

### [`product/`](product/) — what and why

| Document | Purpose |
|----------|---------|
| [CANONICAL_DOCUMENTATION.md](product/CANONICAL_DOCUMENTATION.md) | Master product + technical specification |
| [PRODUCT_BRIEF.md](product/PRODUCT_BRIEF.md) | Vision, target user, scope, non-goals |
| [vision-and-principles.md](product/vision-and-principles.md) | v1 product vision and principles |
| [information-architecture.md](product/information-architecture.md) | Six-tab IA, persistent chrome, routes (locked) |
| [lifecycle-and-vocabulary.md](product/lifecycle-and-vocabulary.md) · [onboarding.md](product/onboarding.md) | Track lifecycle, vocabulary, first run |
| [GLOSSARY.md](product/GLOSSARY.md) | Terminology |
| [PO_MILESTONE_CHECKLIST.md](product/PO_MILESTONE_CHECKLIST.md) | Product-owner sign-off gates |
| [PROJECT_CONTEXT.md](product/PROJECT_CONTEXT.md) | Single-file digest of the whole project |

### [`specs/`](specs/README.md) — how features behave

[experience/](specs/experience/) (every tab and workspace) ·
[player/](specs/player/) · [data-and-sync/](specs/data-and-sync/) ·
[integrations/](specs/integrations/api-access-guide.md) · [features/](specs/features/) (dated feature designs).

### [`ui-ux/`](ui-ux/README.md) — how it looks

Numbered spec `00`–`14` (design system, shell, library, player, settings, dialogs,
components, accessibility, checklist, wireframes, table upgrades),
[guidelines/](ui-ux/guidelines/), [wireframes/](ui-ux/wireframes/README.md),
[reference/](ui-ux/reference/) and [archive/](ui-ux/archive/). Precedence is in the
[UI README](ui-ux/README.md#folder-layout-and-precedence).

### [`architecture/`](architecture/ARCHITECTURE.md) and [`adr/`](adr/README.md)

[ARCHITECTURE](architecture/ARCHITECTURE.md) · [DATA_MODEL](architecture/DATA_MODEL.md) ·
[API_CONTRACTS](architecture/API_CONTRACTS.md) · [MODELS](architecture/MODELS.md) ·
[SKILLS_SYSTEM](architecture/SKILLS_SYSTEM.md) · ADRs 0001–0007.

### [`sdd/`](sdd/README.md) — specification-driven development

[01 Specification](sdd/01-SPECIFICATION.md) · [02 System design](sdd/02-SYSTEM-DESIGN.md) ·
[03 Phases](sdd/03-PHASES-AND-PLAN.md) (framing; order follows the v1 stages) ·
[04 Tasks](sdd/04-TASKS.md) (**the tracker**) · [05 Acceptance](sdd/05-ACCEPTANCE.md).

### [`plans/`](plans/README.md) — delivery

[v1 plan](plans/v1/README.md) (D-001–D-052, Stages 0–12) ·
[Phase 2 Library + Player](plans/phase2-library-player.md) ·
[UI simplification 2026-11](plans/ui-simplification-2026-11.md) · [archive/](plans/archive/).
The [plans index](plans/README.md) says which plan governs and maps Stages to task IDs.

### [`tasks/`](tasks/README.md), [`audits/`](audits/README.md), [`qa/`](qa/README.md)

- Tasks: ID scheme and where work is listed; tracker is [sdd/04-TASKS.md](sdd/04-TASKS.md).
- Audits: latest are the [UI/UX audit](audits/2026-11-22-ui-ux-audit.md) and the
  [docs and plans audit](audits/2026-11-22-docs-and-plans-audit.md).
- QA: [checklists](qa/checklists/), [evidence](qa/evidence/), [approvals](qa/approvals/).

### [`engineering/`](engineering/DEVELOPMENT.md), [`devops/`](devops/DEVOPS_CICD_PLAN.md), [`diagrams/`](diagrams/README.md)

- Engineering: [DEVELOPMENT](engineering/DEVELOPMENT.md) · [CODING_STANDARDS](engineering/CODING_STANDARDS.md) ·
  [TESTING_AND_SECURITY](engineering/TESTING_AND_SECURITY.md) · [SECURITY_AND_PRIVACY](engineering/SECURITY_AND_PRIVACY.md) ·
  [WINDOWS_NATIVE_BUILD_RUNBOOK](engineering/WINDOWS_NATIVE_BUILD_RUNBOOK.md).
- DevOps: [CI/CD plan](devops/DEVOPS_CICD_PLAN.md) · [pipeline security](devops/CI_CD_PIPELINE_SECURITY.md) ·
  [AI dev automation](devops/AI_DEVELOPMENT_AUTOMATION_PLAN.md) · [workflow templates](devops/github-workflows/README.md).
- Diagrams: [index](diagrams/README.md), starting with the [project overview](diagrams/00-ENTIRE-PROJECT-OVERVIEW.md).

### [`ai/`](ai/AGENTS.md) and [`prompts/`](prompts/README.md)

[Agents & automation](ai/AGENTS.md) · [communication](ai/COMMUNICATION.md) ·
[memory](ai/MEMORY.md) ([layers](ai/memory/README.md)) · [skills](ai/SKILLS.md) ·
[routing](ai/SKILL_ROUTING.md) · [MCP / plugins](ai/mcp/mcb-plugin-enhancement-plan.md) ·
[reusable prompts](prompts/README.md).

---

## Where does a new document go?

| You are writing… | Put it in | Name |
|------------------|-----------|------|
| A feature's behaviour or a design for one feature | `specs/features/` | `YYYY-MM-DD-<feature>-design.md` |
| A screen, component or visual rule | `ui-ux/` (amend the numbered doc) | — |
| An order of work with slices and exit criteria | `plans/` | `<topic>-<yyyy-mm>.md` |
| A task | a line in `sdd/04-TASKS.md` | existing prefix |
| A review of what exists | `audits/` | `YYYY-MM-DD-<topic>.md`, assets in `audits/assets/` |
| Proof a task works | `qa/evidence/` | `YYYY-MM-DD-<task>-QA.md` |
| A technical decision | `adr/` | next `NNNN-<title>.md` |
| A how-to for developers | `engineering/` or `devops/` | — |

Rules: no new top-level files in `docs/`; date-stamp anything that records a point
in time; move finished plans to `plans/archive/` rather than deleting them; and
update this README when a folder is added.

*The 2026-11-22 reorganisation is recorded in the
[docs and plans audit](audits/2026-11-22-docs-and-plans-audit.md); the old → new path
map is in [`scripts/docs-reorg-2026-11.mjs`](../scripts/docs-reorg-2026-11.mjs).*
