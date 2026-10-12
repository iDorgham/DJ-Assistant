# DJ Assistant

**The fastest way to turn a music library into a performance-ready DJ set.**

DJ Assistant is a desktop-first preparation accelerator for professional DJs. It analyzes music **locally** (privacy-first, no audio uploads), generates intelligent cue points, cleans messy tags, builds harmonic + energy-aware sets, supports true B2B collaboration, and exports directly to rekordbox / Serato.

**Core Promise:** Analyze → Clean → Cue → Sequence → Export in under 15 minutes for 40+ tracks.

---

## Documentation Map

All documentation lives under [`docs/`](./docs/README.md) — start at the
**[Documentation Index](./docs/README.md)** or jump to a category below.

### Product
- [Canonical Documentation](./docs/product/CANONICAL_DOCUMENTATION.md) — single source of truth (product + technical)
- [Product Brief](./docs/product/PRODUCT_BRIEF.md) — vision, target user, scope
- [PO Milestone Checklist](./docs/product/PO_MILESTONE_CHECKLIST.md) — sign-off gates
- [Glossary](./docs/product/GLOSSARY.md) — product & technical term definitions

### Architecture
- [Architecture](./docs/architecture/ARCHITECTURE.md) — system design, components, data flows
- [Data Model](./docs/architecture/DATA_MODEL.md) — local SQLite + cloud PostgreSQL schemas
- [API Contracts](./docs/architecture/API_CONTRACTS.md) — Tauri IPC + cloud HTTP contracts
- [Models](./docs/architecture/MODELS.md) — ONNX analysis models, packaging, versioning
- [Skills System](./docs/architecture/SKILLS_SYSTEM.md) — scoped automation skills design

### Engineering
- [Development Guide](./docs/engineering/DEVELOPMENT.md) — local setup, tooling, workflows
- [Coding Standards](./docs/engineering/CODING_STANDARDS.md) — style, conventions, PR rules
- [Testing & Security Plan](./docs/engineering/TESTING_AND_SECURITY.md) — test pyramid, security gates, PR checklist
- [Security & Privacy](./docs/engineering/SECURITY_AND_PRIVACY.md) — threat model, local-first guarantees
- [Windows Build Runbook](./docs/engineering/WINDOWS_NATIVE_BUILD_RUNBOOK.md) — MSVC/GNU build troubleshooting
- [Development Task List](./docs/engineering/DEVELOPMENT_TASK_LIST.md) — phased actionable engineering checklist
- [Phase 0 Acceptance Evidence](./docs/engineering/PHASE0_ACCEPTANCE_EVIDENCE.md) — how each P0.x criterion was verified

### DevOps & Process
- [AI Development Automation Plan](./docs/devops/AI_DEVELOPMENT_AUTOMATION_PLAN.md) — branches, PRs, review, fix, merge + gates
- [DevOps & CI/CD Plan](./docs/devops/DEVOPS_CICD_PLAN.md) — pipelines, environments, release, caching
- [CI/CD Pipeline Security](./docs/devops/CI_CD_PIPELINE_SECURITY.md) — Actions pinning, secrets, fork safety, supply chain
- [GitHub Workflow Templates](./docs/devops/github-workflows/README.md) — PR/main/release/audit/CodeQL workflows

### Spec-Driven Development (SDD)
- [00 — SDD Overview](./docs/sdd/README.md)
- [01 — Specification](./docs/sdd/01-SPECIFICATION.md)
- [02 — System Design](./docs/sdd/02-SYSTEM-DESIGN.md)
- [03 — Phases & Plan](./docs/sdd/03-PHASES-AND-PLAN.md)
- [04 — Task Breakdown](./docs/sdd/04-TASKS.md)
- [05 — Acceptance Criteria](./docs/sdd/05-ACCEPTANCE.md)

### Diagrams
- [**Entire Project Overview**](./docs/diagrams/00-ENTIRE-PROJECT-OVERVIEW.md)
- [System Architecture](./docs/diagrams/01-system-architecture.md)
- [Analysis Pipeline](./docs/diagrams/02-analysis-pipeline.md)
- [Set Builder Pipeline](./docs/diagrams/03-set-builder-pipeline.md)
- [Skills System](./docs/diagrams/04-skills-system.md)
- [Phases Roadmap](./docs/diagrams/05-phases-roadmap.md)
- [Data Model](./docs/diagrams/06-data-model.md)
- [Workstreams](./docs/diagrams/07-workstreams.md)
- [Gig Ready Workflow](./docs/diagrams/08-gig-ready-workflow.md)
- [Cue Generation](./docs/diagrams/09-cue-generation.md)
- [Export Flow](./docs/diagrams/10-export-flow.md)
- [Component & IPC](./docs/diagrams/11-component-ipc.md)
- [SDD Method](./docs/diagrams/12-sdd-method.md)
- [AI Dev Automation Workflow](./docs/diagrams/13-ai-dev-automation.md)
- [Testing & Security Gates](./docs/diagrams/14-testing-security-gates.md)
- [CI/CD Pipeline](./docs/diagrams/15-cicd-pipeline.md)

### Decisions & Contribution
- [Architecture Decision Records](./docs/ADR/README.md) — significant technical decisions (why)
- [Contributing](./CONTRIBUTING.md) — how to contribute

> Source product artefacts (PRD, AI-native build plan, detailed build plan, build-plan
> diagrams, formal specification) are maintained externally and are **not** committed to
> this repository.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TAURI v2 DESKTOP APP                     │
│  React/TypeScript UI  ←──IPC──→  Rust Core Backend         │
│  (Waveforms, Energy Canvas, Skills Panel)                   │
│                              │                              │
│                              ▼                              │
│               Native Audio Engine (ONNX + Symphonia)        │
│               Local SQLite + Rule Engine + Watch Folders    │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS / WSS (optional sync)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   CLOUD CONTROL PLANE                       │
│  Fastify + PostgreSQL 16 + pgvector + Redis/BullMQ          │
│  LLM Constraint Parser • Collaboration • Set Indexing       │
└─────────────────────────────────────────────────────────────┘
```

**Key Principles:**
- **Local-first**: Audio never leaves the machine. Analysis runs via ONNX Runtime.
- **Hybrid intelligence**: LLM for constraint understanding + deterministic Beam Search for set sequencing.
- **Reversible by design**: Every Skill and bulk action is logged and undoable.
- **Non-destructive**: Source audio files are never modified.

---

## Tech Stack (Target)

| Layer | Technology |
|-------|------------|
| Desktop Shell | Tauri v2 |
| Frontend | React + TypeScript + Tailwind + Zustand/Jotai |
| Backend (Local) | Rust (notify, audiotags, Symphonia, ONNX Runtime, quick-xml, SQLite) |
| Cloud API | Fastify (Node.js/TypeScript) |
| Cloud DB | PostgreSQL 16 + pgvector |
| Queue | Redis + BullMQ |
| Auth | (TBD – likely Clerk / Auth0 / custom JWT) |
| Models | Local ONNX (madmom-style beat/key, structural segmentation) + Cloud LLM (constraint parsing only) |

---

## Project Status

- **Phase**: Phase 0 — Foundation (acceptance criteria verified; PO sign-off pending)
- **Canonical Spec**: v1.1 (Approved)
- **CI**: green on GitHub — `windows-latest` + `macos-latest` desktop builds and the Ubuntu
  lint/typecheck/test/Rust job all pass (`Main CI`)
- **Working today**: native folder picker → recursive scan → BLAKE3 fingerprinting →
  hash deduplication → tag metadata extraction → local SQLite storage → searchable
  library table with live scan progress. The desktop app builds and launches; audio is
  never uploaded.
- **Next Milestone**: Phase 1 — local ONNX analysis pipeline (BPM, key, beat grid,
  structural segmentation)

### Building it locally

```powershell
pnpm install                       # JS/TS workspace
pnpm --filter @dj-assistant/desktop tauri dev    # run the desktop app
pnpm ci:local                      # lint + typecheck + tests + rust fmt/clippy/test
```

> **Windows:** read [the Windows build runbook](./docs/engineering/WINDOWS_NATIVE_BUILD_RUNBOOK.md) §1.1
> before your first build. The MSVC toolchain is required, and a repository path
> containing spaces breaks `windres` on the GNU toolchain.

---

## Quick Links for New Engineers

1. Read the [Canonical Documentation](./docs/product/CANONICAL_DOCUMENTATION.md) (especially §3 Modules and §4 Architecture).
2. Read [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md).
3. Follow [docs/engineering/DEVELOPMENT.md](./docs/engineering/DEVELOPMENT.md) to set up the environment.
4. Review [docs/engineering/CODING_STANDARDS.md](./docs/engineering/CODING_STANDARDS.md) before writing code.
5. Understand the [Skills System](./docs/architecture/SKILLS_SYSTEM.md) — it is a core product differentiator.

---

*This repository is the engineering home for DJ Assistant. Product decisions live in the Canonical Documentation.*
