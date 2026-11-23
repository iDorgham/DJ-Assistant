# ADR-0002: Monorepo Layout (pnpm + Cargo Workspace)

**Status:** Accepted  
**Date:** 2026-10-09

## Context

DJ Assistant consists of a Tauri desktop app (Rust + React/TypeScript), a cloud API (Fastify + TypeScript), shared types, and future packages (UI, analysis helpers). We need a repository structure that supports:

- Shared TypeScript types between desktop and API
- Single CI pipeline with clear caching
- Independent versioning of deployable artifacts later if needed
- Simple local development for a small team

## Decision

Use a **monorepo** with:

- `pnpm` workspaces for JavaScript/TypeScript packages
- Cargo workspace for Rust crates (desktop `src-tauri` and any shared Rust libs)
- Top-level layout:

```
dj-assistant/
├── apps/
│   ├── desktop/          # Tauri v2 (Rust + React)
│   └── api/              # Fastify cloud control plane
├── packages/
│   ├── shared/           # Shared TS types & utilities
│   └── ui/               # Optional shared React components
├── models/               # ONNX models (download script / LFS)
├── docs/                 # Product / architecture / engineering / devops / sdd / ADR / diagrams
├── scripts/
├── fixtures/
├── .github/workflows/
├── pnpm-workspace.yaml
├── package.json
└── Cargo.toml            # Workspace root (if multi-crate)
```

## Consequences

**Positive**
- Shared types stay in sync without publishing private packages early.
- Atomic cross-package refactors are straightforward.
- One clone, one CI definition, one place for docs.

**Negative**
- Slightly more complex root tooling than a single-app repo.
- Must be careful not to create accidental tight coupling between desktop and API.

**Neutral**
- Deployable units (desktop installer vs API container) remain independently buildable.

## Alternatives Considered

- **Polyrepo (separate desktop / API / shared repos)** — Premature complexity for team size and shared-type needs.
- **Single package with everything** — Poor isolation; harder to extract API later.
- **npm / yarn workspaces** — pnpm chosen for disk efficiency and strict dependency isolation.
