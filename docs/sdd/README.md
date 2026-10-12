# DJ Assistant — Specification-Driven Development (SDD)

**Method:** Specification-Driven Development  
**Version:** 1.0  
**Date:** 2026-10-08  
**Status:** Approved for Engineering Execution

---

## What is SDD in this project?

Specification-Driven Development means:

1. **Specification first** — Product and technical requirements are locked before major implementation.
2. **Design second** — Architecture, data model, interfaces, and AI boundaries are designed against the specification.
3. **Plan third** — Work is sequenced into clear phases with exit criteria.
4. **Tasks fourth** — Phases are broken into concrete, checkable engineering tasks.
5. **Acceptance last** — Every phase and major feature has explicit, testable acceptance criteria.

No significant feature is built without a corresponding entry in Spec → Design → Plan → Tasks → Acceptance.

---

## Document Index

| # | Document | Purpose |
|---|----------|---------|
| 00 | [This README](./README.md) | Method overview & navigation |
| 01 | [Specification](./01-SPECIFICATION.md) | What we are building (product + technical boundaries) |
| 02 | [System Design](./02-SYSTEM-DESIGN.md) | How it is structured (architecture, components, AI boundaries, data) |
| 03 | [Phases & Plan](./03-PHASES-AND-PLAN.md) | When and in what order we build it (90-day plan) |
| 04 | [Task Breakdown](./04-TASKS.md) | Concrete engineering tasks with owners and dependencies |
| 05 | [Acceptance Criteria](./05-ACCEPTANCE.md) | How we know each phase and feature is done |

---

## Relationship to Existing Documents

| Existing Document | Role in SDD |
|-------------------|-------------|
| [`docs/product/CANONICAL_DOCUMENTATION.md`](../product/CANONICAL_DOCUMENTATION.md) | Master Product + Technical Specification (source of truth) |
| `DJ-Assistant-PRD.docx` *(external, not committed)* | Product Requirements (feeds Spec) |
| `DJ-Assistant-AI-Native-Build-Plan.docx` *(external, not committed)* | AI design principles & intelligence architecture |
| `DJ-Assistant-Detailed-Build-Plan.docx` *(external, not committed)* | Original phase plan & workstreams |
| `docs/architecture/ARCHITECTURE.md` | Living architecture reference |
| `docs/engineering/DEVELOPMENT_TASK_LIST.md` | Earlier task checklist (superseded in detail by `04-TASKS.md`) |
| `docs/architecture/SKILLS_SYSTEM.md` | Skills design detail |
| `docs/architecture/DATA_MODEL.md` | Data design detail |
| `docs/engineering/SECURITY_AND_PRIVACY.md` | Security & privacy constraints |

The SDD set does **not** replace the Canonical Documentation. It organizes the path from specification to executable work.

---

## Core Non-Negotiables (from Spec)

- Local-first audio analysis (ONNX). Raw audio never leaves the device by default.
- Hybrid intelligence: LLM for constraint understanding & explanation only; Beam Search for sequencing.
- Scoped Skills with enable/disable, logging, and full reversibility. No open-ended agents.
- Non-destructive: source audio files are never modified.
- Offline-capable core workflow (import → analyze → cue → set → export).

---

## How to Use This Set

1. **Product / Founders** → Read `01-SPECIFICATION.md` and `05-ACCEPTANCE.md`.
2. **Tech Leads** → Own `02-SYSTEM-DESIGN.md` and `03-PHASES-AND-PLAN.md`.
3. **Engineers** → Work from `04-TASKS.md` daily; check acceptance in `05-ACCEPTANCE.md`.
4. **Everyone** → When a decision conflicts with Canonical Spec or these SDD docs, stop and resolve the conflict before coding.

---

*SDD keeps the team aligned: we build only what is specified, design only what is needed, and accept only what meets the criteria.*
