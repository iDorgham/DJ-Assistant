# Architecture Decision Records (ADRs)

**Purpose:** Capture significant technical decisions so future contributors understand *why* the system is structured the way it is.

**Status:** Active from Phase 0 onward  
**Last Updated:** 2026-10-14

---

## When to Write an ADR

Write an ADR when the decision is:

- Hard to reverse (repo layout, IPC style, model packaging, primary data store)
- Cross-cutting (affects multiple workstreams or packages)
- Controversial or non-obvious (why Beam Search instead of LLM sequencing, why Tauri, etc.)
- A deliberate deviation from common industry practice

Do **not** write ADRs for routine implementation details, temporary experiments, or pure product decisions (those belong in Canonical / SDD).

---

## Format

Each ADR is a markdown file named `NNNN-short-title.md` (zero-padded sequential number).

```markdown
# ADR-NNNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXXX  
**Date:** YYYY-MM-DD  
**Deciders:** (optional)

## Context
What is the problem or force driving the decision?

## Decision
What did we choose?

## Consequences
Positive, negative, and neutral follow-on effects.

## Alternatives Considered
What else was evaluated and why it was rejected.
```

---

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](./0002-monorepo-layout.md) | Monorepo layout (pnpm + Cargo workspace) | Accepted |
| [0003](./0003-local-first-onnx-analysis.md) | Local-first ONNX analysis | Accepted |
| [0004](./0004-hybrid-set-builder.md) | Hybrid set builder (LLM constraints + Beam Search) | Accepted |
| [0005](./0005-tauri-ipc-style.md) | Tauri IPC command style | Accepted |
| [0006](./0006-spotify-playlist-export.md) | Spotify Playlist Export (desktop PKCE, metadata only) | Accepted (design) / Planned (build, post-MVP) |
| [0007](./0007-similar-tracks-enrichment-multiprovider.md) | Similar tracks, tag/artwork enrichment & multi-provider strategy | Accepted-partial (TF.1–TF.6, TE.1–TE.3, TD.3, TX.2a shipped; remainder Proposed) |

---

## Related Documents

- [Architecture](../architecture/ARCHITECTURE.md)
- [Canonical Documentation](../product/CANONICAL_DOCUMENTATION.md)
- [SDD System Design](../sdd/02-SYSTEM-DESIGN.md)
- [Models](../architecture/MODELS.md)
- [API Contracts](../architecture/API_CONTRACTS.md)
