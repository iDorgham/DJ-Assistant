# DJ Assistant — Mermaid Diagrams

All architecture, pipeline, phase, and workflow diagrams for the project.

Render these in any Mermaid-compatible viewer (GitHub, VS Code Mermaid extension, mermaid.live, Notion, etc.).

---

## Diagram Index

| File | Description |
|------|-------------|
| [00-ENTIRE-PROJECT-OVERVIEW.md](./00-ENTIRE-PROJECT-OVERVIEW.md) | **Full project map** — system, pipeline, intelligence, phases, workstreams, boundaries |
| [01-system-architecture.md](./01-system-architecture.md) | High-level desktop + cloud system architecture |
| [02-analysis-pipeline.md](./02-analysis-pipeline.md) | Track import & local ONNX analysis flow |
| [03-set-builder-pipeline.md](./03-set-builder-pipeline.md) | Hybrid constraint → Beam Search set generation |
| [04-skills-system.md](./04-skills-system.md) | Skills lifecycle, catalog, and control surfaces |
| [05-phases-roadmap.md](./05-phases-roadmap.md) | 90-day phase timeline and workstream overlap |
| [06-data-model.md](./06-data-model.md) | Local SQLite + Cloud PostgreSQL conceptual model |
| [07-workstreams.md](./07-workstreams.md) | Five parallel engineering workstreams |
| [08-gig-ready-workflow.md](./08-gig-ready-workflow.md) | Gig Ready one-click automation sequence |
| [09-cue-generation.md](./09-cue-generation.md) | Genre-aware cue point generation flow |
| [10-export-flow.md](./10-export-flow.md) | Set → rekordbox / Serato export path |
| [11-component-ipc.md](./11-component-ipc.md) | React ↔ Rust IPC and major components |
| [12-sdd-method.md](./12-sdd-method.md) | Specification-Driven Development flow |
| [13-ai-dev-automation.md](./13-ai-dev-automation.md) | AI development loop: branch → PR → review → fix → merge |
| [14-testing-security-gates.md](./14-testing-security-gates.md) | Testing pyramid + security gates in the PR/phase loop |
| [15-cicd-pipeline.md](./15-cicd-pipeline.md) | PR CI → main → release flow + pipeline security controls |

---

*Diagrams are derived from Canonical Documentation v1.1, SDD set, and Architecture docs.*
