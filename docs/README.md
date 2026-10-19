# DJ Assistant — Documentation

Central index for all project documentation. Documents are grouped by category;
each folder below is self-contained and cross-links to its neighbours.

> New here? Read the [repository README](../README.md) first, then the
> [Canonical Documentation](./product/CANONICAL_DOCUMENTATION.md) (source of truth),
> and set up your environment with the [Development Guide](./engineering/DEVELOPMENT.md).

---

## Categories

| Folder | What lives here | Start with |
|--------|-----------------|------------|
| [`product/`](./product/) | Vision, canonical spec, glossary, milestone sign-off | [Canonical Documentation](./product/CANONICAL_DOCUMENTATION.md) |
| [`architecture/`](./architecture/) | System design, data model, contracts, models, skills | [Architecture](./architecture/ARCHITECTURE.md) |
| [`engineering/`](./engineering/) | Setup, standards, testing, security, build, task list | [Development Guide](./engineering/DEVELOPMENT.md) |
| [`devops/`](./devops/) | CI/CD plans, pipeline security, AI automation, workflow templates | [DevOps & CI/CD Plan](./devops/DEVOPS_CICD_PLAN.md) |
| [`sdd/`](./sdd/) | Specification-Driven Development set (spec → design → plan → tasks → acceptance) | [SDD Overview](./sdd/README.md) |
| [`diagrams/`](./diagrams/) | Mermaid diagrams for architecture, pipelines, phases, skills, data | [Entire Project Overview](./diagrams/00-ENTIRE-PROJECT-OVERVIEW.md) |
| [`ui/`](./ui/) | Current UI specification: design system, shell, views, player, settings, dialogs, accessibility | [UI Specification](./ui/README.md) |
| [`ui-ux/`](./ui-ux/) | Earlier UI docs: principles, Phase 0 design system, screens & flows, wireframes (tokens superseded by `ui/`) | [UI/UX Index](./ui-ux/README.md) |
| [`ADR/`](./ADR/) | Architecture Decision Records (the "why") | [ADR Index](./ADR/README.md) |
| [`audit/`](./audit/) | Spec/function/settings audits + TA.1–TA.14 tracking | [Audit summary](./audit/AUDIT-SUMMARY.md) |
| [`context/`](./context/) | Single-file project digest for humans + AI agents | [Project Context](./context/PROJECT_CONTEXT.md) |
| [`evidence/`](./evidence/) | Acceptance evidence (screenshots, captured runs) | [Phase 0 evidence](./engineering/PHASE0_ACCEPTANCE_EVIDENCE.md) |

---

## Product — [`product/`](./product/)

| Document | Purpose |
|----------|---------|
| [CANONICAL_DOCUMENTATION.md](./product/CANONICAL_DOCUMENTATION.md) | Master product + technical specification (single source of truth) |
| [PRODUCT_BRIEF.md](./product/PRODUCT_BRIEF.md) | Vision, target user, scope, non-goals |
| [PO_MILESTONE_CHECKLIST.md](./product/PO_MILESTONE_CHECKLIST.md) | Product-owner milestone sign-off gates |
| [GLOSSARY.md](./product/GLOSSARY.md) | Product & technical terminology |

## Architecture — [`architecture/`](./architecture/)

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) | Components, data flows, boundaries |
| [DATA_MODEL.md](./architecture/DATA_MODEL.md) | Local SQLite + cloud PostgreSQL schemas |
| [API_CONTRACTS.md](./architecture/API_CONTRACTS.md) | Tauri IPC + cloud HTTP contracts |
| [MODELS.md](./architecture/MODELS.md) | ONNX analysis models, packaging, versioning |
| [SKILLS_SYSTEM.md](./architecture/SKILLS_SYSTEM.md) | Scoped automation skills design |

## Engineering — [`engineering/`](./engineering/)

| Document | Purpose |
|----------|---------|
| [DEVELOPMENT.md](./engineering/DEVELOPMENT.md) | Local setup, tooling, workflows |
| [CODING_STANDARDS.md](./engineering/CODING_STANDARDS.md) | Style, conventions, PR rules |
| [TESTING_AND_SECURITY.md](./engineering/TESTING_AND_SECURITY.md) | Test pyramid, security gates, PR checklist |
| [SECURITY_AND_PRIVACY.md](./engineering/SECURITY_AND_PRIVACY.md) | Threat model, data handling, local-first guarantees |
| [WINDOWS_NATIVE_BUILD_RUNBOOK.md](./engineering/WINDOWS_NATIVE_BUILD_RUNBOOK.md) | Windows MSVC/GNU build troubleshooting |
| [DEVELOPMENT_TASK_LIST.md](./engineering/DEVELOPMENT_TASK_LIST.md) | Phased actionable engineering checklist |
| [PHASE0_ACCEPTANCE_EVIDENCE.md](./engineering/PHASE0_ACCEPTANCE_EVIDENCE.md) | How each Phase 0 criterion was verified |

## DevOps & Process — [`devops/`](./devops/)

| Document | Purpose |
|----------|---------|
| [AI_DEVELOPMENT_AUTOMATION_PLAN.md](./devops/AI_DEVELOPMENT_AUTOMATION_PLAN.md) | AI-driven branch → PR → review → fix → merge loop |
| [DEVOPS_CICD_PLAN.md](./devops/DEVOPS_CICD_PLAN.md) | Pipelines, environments, release, caching, rollout |
| [CI_CD_PIPELINE_SECURITY.md](./devops/CI_CD_PIPELINE_SECURITY.md) | Actions pinning, secrets, fork safety, supply chain |
| [github-workflows/](./devops/github-workflows/README.md) | Workflow templates (PR CI, main CI, release, audit, CodeQL) |

## Spec-Driven Development — [`sdd/`](./sdd/)

| # | Document | Purpose |
|---|----------|---------|
| 00 | [Overview](./sdd/README.md) | Method overview & navigation |
| 01 | [Specification](./sdd/01-SPECIFICATION.md) | What we are building (slim MVP; P1 = USB/B2B/Skills + S/F) |
| 02 | [System Design](./sdd/02-SYSTEM-DESIGN.md) | How it is structured |
| 03 | [Phases & Plan](./sdd/03-PHASES-AND-PLAN.md) | When and in what order |
| 04 | [Task Breakdown](./sdd/04-TASKS.md) | Concrete engineering tasks (incl. audit-driven `TA.1–TA.14`) |
| 05 | [Acceptance Criteria](./sdd/05-ACCEPTANCE.md) | How we know it is done (golden fixtures, contract/settings gates) |

## Audit — [`audit/`](./audit/)

| Document | Purpose |
|----------|---------|
| [AUDIT-SUMMARY.md](./audit/AUDIT-SUMMARY.md) | Combined pros/cons/fixes/proposals |
| [01-specs-audit.md](./audit/01-specs-audit.md) | Plan specs review |
| [02-functions-audit.md](./audit/02-functions-audit.md) | Functions/features review |
| [03-settings-audit.md](./audit/03-settings-audit.md) | Settings/config review |
| [04-improvements.md](./audit/04-improvements.md) | Prioritized fixes (TA.1–TA.14) |
| [05-proposed-specs-functions.md](./audit/05-proposed-specs-functions.md) | New settings S-1–S-7, functions F-1–F-10 / X-1–X-6 |

## Diagrams — [`diagrams/`](./diagrams/)

See the [diagram index](./diagrams/README.md) for the full set (00–17).

## UI/UX — [`ui/`](./ui/) and [`ui-ux/`](./ui-ux/)

The 2026-10-19 specification in [`ui/`](./ui/README.md) is the current source for design tokens, the shell, views, and the player. The [`ui-ux/`](./ui-ux/) set is the earlier Phase 0 design documentation; its design system is superseded by [`ui/01-DESIGN-SYSTEM.md`](./ui/01-DESIGN-SYSTEM.md).

| Document | Purpose |
|----------|---------|
| [ui/README.md](./ui/README.md) | Current UI spec index and document map |
| [ui/01-DESIGN-SYSTEM.md](./ui/01-DESIGN-SYSTEM.md) | Design tokens (current) |
| [ui/02-SHELL-AND-NAVIGATION.md](./ui/02-SHELL-AND-NAVIGATION.md) | Shell, navigation, workspaces |
| [ui/06-PLAYER.md](./ui/06-PLAYER.md) | Player modes, waveform, cues, grid |
| [ui/11-IMPLEMENTATION-CHECKLIST.md](./ui/11-IMPLEMENTATION-CHECKLIST.md) | Build order and acceptance gate |

Earlier set — [`ui-ux/`](./ui-ux/):

| Document | Purpose |
|----------|---------|
| [README.md](./ui-ux/README.md) | UI/UX index, current status, and the five things to remember |
| [UX_PRINCIPLES.md](./ui-ux/UX_PRINCIPLES.md) | Personas, the prep loop, design principles, IA, interaction patterns, voice |
| [DESIGN_SYSTEM.md](./ui-ux/DESIGN_SYSTEM.md) | Colour, typography, spacing, motion, and the component inventory |
| [SCREENS_AND_FLOWS.md](./ui-ux/SCREENS_AND_FLOWS.md) | Screen inventory, wireframes, and end-to-end flows per phase |
| [wireframes/](./ui-ux/wireframes/README.md) | Low-fidelity structural wireframes for every screen (00–12) |
| [ACCESSIBILITY.md](./ui-ux/ACCESSIBILITY.md) | WCAG targets, contrast findings, keyboard model, motion, test checklist |
| [PLAYER_AND_LAYOUT_SPEC_2026-10-19.md](./ui-ux/PLAYER_AND_LAYOUT_SPEC_2026-10-19.md) | Historical v1.7 app shell / player / layout proposal |

## Decisions — [`ADR/`](./ADR/)

Architecture Decision Records. See the [ADR index](./ADR/README.md).

## Evidence — [`evidence/`](./evidence/)

Captured acceptance evidence, grouped by phase (e.g. [`evidence/phase0/`](./evidence/phase0/)).

---

*Product requirements live in the [Canonical Documentation](./product/CANONICAL_DOCUMENTATION.md); this folder is the engineering home for how we build them.*
