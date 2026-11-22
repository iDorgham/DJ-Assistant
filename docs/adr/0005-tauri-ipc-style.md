# ADR-0005: Tauri IPC Command Style

**Status:** Accepted  
**Date:** 2026-10-09

## Context

The desktop app has a React/TypeScript UI and a Rust core. Communication must be typed, auditable, and safe. We need a clear convention for commands vs events before Phase 0 scaffolding hardens patterns.

## Decision

- **Commands** (request/response): Imperative actions initiated by the UI — `scan_folder`, `analyze_track`, `list_tracks`, `run_skill`, `export_set`, etc. Implemented as Tauri `invoke` commands with typed request/response payloads (see [API Contracts](../architecture/API_CONTRACTS.md)).
- **Events** (Rust → UI): Progress, status, and push updates — analysis progress, scan progress, skill run completed, file watcher notifications. Emitted via Tauri events; UI subscribes.
- Payloads are JSON-serializable. Shared TypeScript types live in `packages/shared` and are mirrored/validated on the Rust side.
- Prefer coarse-grained commands that map to user-level operations over fine-grained internal RPCs.

## Consequences

**Positive**
- Clear mental model for frontend and backend engineers.
- Easy to log, test, and document contracts.
- Aligns with Tauri’s security model (capability allowlists per command).

**Negative**
- Some chatty UI interactions may need careful batching.
- Type duplication risk between TS and Rust if shared package discipline slips.

**Neutral**
- Exact command list evolves; living contract is `docs/architecture/API_CONTRACTS.md`.

## Alternatives Considered

- **gRPC / custom socket protocol** — Unnecessary complexity inside a single process.
- **Unstructured string events only** — Weak typing and hard to evolve safely.
- **Deep object graph shared memory** — Not idiomatic for Tauri; harder to reason about and secure.
