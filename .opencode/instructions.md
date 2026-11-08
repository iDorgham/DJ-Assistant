# AGENTS.md — DJ Assistant (System Instructions)

> **This file is the system prompt for all AI coding agents working in this repository.**  
> For deeper context, the docs under `docs/` remain authoritative. This file is a map and a set of hard guardrails.

**Canonical sources:**
- Product/tech truth: [`docs/product/CANONICAL_DOCUMENTATION.md`](docs/product/CANONICAL_DOCUMENTATION.md)
- Approved v1 plan (locked decisions): [`docs/plan/README.md`](docs/plan/README.md) — `D-001–D-052` scoped to that tree
- UI source of truth: [`docs/ui/01-DESIGN-SYSTEM.md`](docs/ui/01-DESIGN-SYSTEM.md)
- Information architecture (locked): [`docs/plan/01-product/information-architecture.md`](docs/plan/01-product/information-architecture.md)
- Tasks/acceptance: [`docs/sdd/04-TASKS.md`](docs/sdd/04-TASKS.md), [`docs/sdd/05-ACCEPTANCE.md`](docs/sdd/05-ACCEPTANCE.md)
- Project context: [`docs/context/PROJECT_CONTEXT.md`](docs/context/PROJECT_CONTEXT.md), [`README.md`](README.md)

---

## 1) Project Context & Status

**You MUST read these first at the start of any session:**
1. [`README.md`](README.md) — current phase, local-first/non-destructive philosophy, and tech stack
2. [`docs/context/PROJECT_CONTEXT.md`](docs/context/PROJECT_CONTEXT.md) — consolidated state, shipped slices, and known blockers

**Current state (as of this repo):**
- **Phase:** **Stage 2 (Library Intelligence) in progress**. Phase 0 complete; Phase 1 implemented (verification pending); Phase 2 actively shipping (shell, shared Track panel, virtualized library). See [`README.md`](README.md#status).
- **Philosophy:** **Local-first · non-destructive · you stay in control · transparent sequencing.** Raw audio files are **never modified**. All mutations are previewable, reversible where possible, and explicitly confirmed.
- **Tech stack:** **Tauri v2 (Rust) + React 19 + TypeScript 6 + Vite 8 + Tailwind CSS 4**. Rust crates in `crates/core` and `crates/analysis` (Symphonia, ONNX Runtime via `ort`, `rusqlite`). Optional API in `apps/api` (Fastify 5). Shared types in `packages/shared`. pnpm 10 workspace.

---

## 2) Locked UI Architecture (NON-NEGOTIABLE)

The navigation is **locked** by [`docs/plan/01-product/information-architecture.md`](docs/plan/01-product/information-architecture.md). **NEVER invent new top-level tabs.**

### Primary tabs (exactly 6)
1. **Library**
2. **Playlists**
3. **Discover**
4. **Statistics**
5. **Publish**
6. **Settings**

### Hard placement rules
- **"Maintain" is INSIDE Library.** It is a sub-view of Library (routes under `/library/maintain/*`), not a top-level tab.
- **"Set Score" is INSIDE Playlists.** It is a sub-view of a specific playlist (`/playlists/:id/set-score`), not a top-level tab.
- **"Import" is a TOP-BAR ACTION.** It lives in the **Import Center** (opened from the top bar). It is **not** a permanent tab.

### Persistent chrome
- Global search (Ctrl/Cmd+K), Import Center, Inbox (Needs Attention + Updates), Backup status, Player dock (Mini/Full/Player view). See IA §3.

**If a task would require adding a new top-level tab or moving these items, STOP and consult the IA and plan docs first.**

---

## 3) Specification-Driven Development (SDD) Loop

Follow the SDD workflow strictly. **No speculative features.**

### Order of operations (MANDATORY)
1. **Check tasks first:** Before writing any code, read [`docs/sdd/04-TASKS.md`](docs/sdd/04-TASKS.md) for the relevant phase/task. Understand acceptance criteria in [`docs/sdd/05-ACCEPTANCE.md`](docs/sdd/05-ACCEPTANCE.md).
2. **Update contracts first:** If IPC/types/contracts change, update shared contracts first (in `packages/shared/` or `contracts/` as applicable). Ensure Rust and TS stay in sync.
3. **Rust core:** Implement/modify in `crates/core` or `crates/analysis` as appropriate.
4. **IPC:** Wire Tauri commands/events in `apps/desktop/src-tauri/` with typed contracts.
5. **React UI:** Update `apps/desktop/src/` last, consuming the typed IPC/contracts. Follow `docs/ui/` for styling/components.

### Principles
- **Vertical slices:** Ship usable workflows end-to-end.
- **Reversibility:** Any mutating operation must be previewable and undoable where feasible (see `skill_runs` pattern).
- **No audio modification:** Source files are never written/modified. Only sidecars, DB records, and exports.
- **Deterministic first:** LLMs may parse intent/explain; **Beam Search** decides ordering. Never let an LLM emit the final ordered tracklist.

---

## 4) Technical Guardrails

### Rust (Backend/Core/Analysis)
- **SQLite:** Must use **WAL mode**. Foreign keys enabled. Proper migrations in `apps/desktop/src-tauri/migrations/`.
- **Audio decoding:** Use **Symphonia** for multi-format decoding.
- **Analysis:** Use **ONNX Runtime** (`ort`) with model discovery/verification. Graceful degradation per analyzer.
- **Error handling:** All IPC-exposed operations must return **`Result<T, AppError>`** (strict). Errors must be structured and user-safe.
- **Safety:** Path canonicalization and traversal protection. No shelling out unsafely. Least-privilege Tauri capabilities.
- **Quality:** `cargo fmt --all --check` and `cargo clippy --all-targets -- -D warnings` must pass.

### React/TypeScript (Frontend)
- **Strict types:** **No `any`**. Use `unknown` + type guards. Leverage shared types from `packages/shared`.
- **States:** Every data view must have explicit **loading**, **empty**, and **error** states.
- **Performance:** For large lists (10k+), use **windowed/virtualized tables** (e.g., only visible window + overscan). Follow patterns from shipped virtualized library.
- **UI consistency:** Follow [`docs/ui/01-DESIGN-SYSTEM.md`](docs/ui/01-DESIGN-SYSTEM.md). Use semantic tokens; no second palette/spacing scale.
- **Accessibility:** Keyboard reachable, focus management, ARIA where appropriate, reduced motion respected.

### General
- **Offline-capable:** Core workflows must work offline. Network is opt-in/optional.
- **Contracts:** Keep `packages/shared` and Rust structs in sync. Watch for contract drift.

---

## 5) Testing & Acceptance

### Required coverage
- **Golden fixtures for audio analysis:** Use fixtures under `fixtures/audio/analysis/`. Analysis must be validated against golden expectations where applicable.
- **Undo tests for bulk actions:** Any bulk mutating action (tag cleanup, bulk metadata edits) must have **undo tests** verifying reversible behavior.
- **Source hash audits:** For any change touching import/analyze/export pipelines, **verify source audio hashes remain unchanged**. Use hash audit utilities when relevant.

### Commands
| Task | Command |
|------|---------|
| Lint everything | `pnpm lint` |
| Type-check | `pnpm typecheck` |
| Front-end tests | `pnpm test` (Vitest) |
| Rust format/lint | `pnpm rust:fmt` · `pnpm rust:clippy` |
| Rust tests | `pnpm rust:test` (use `pnpm rust:test:portable` if ONNX runtime unavailable) |
| Full local gate | `pnpm ci:local` |

**Definition of Done:** Tests pass, no lint/type/clippy errors, manual verification on happy path, docs updated if behavior/schema changed, source hashes unchanged for import/analyze/export changes.

---

## 6) Repo Hygiene (CRITICAL)

- **FORBID `git add .`** — Never stage everything. This repo has many tool directories and generated artifacts.
- **Stage files explicitly.** Add only the files you intentionally changed (e.g., `git add path/to/file1 path/to/file2`).
- **Watch for foreign files:** Be especially careful not to commit tool-specific files like `kilo.jsonc`, `.qoder/`, `.kilo/`, etc. These are often thin adapters or local artifacts.
- **Don't commit generated artifacts:** `target/`, `dist/`, model binaries, local DB files, or build outputs.
- **Follow conventions:** Prettier 100 cols, double quotes, semicolons, `trailingComma: es5`. Run `pnpm format` before committing.

---

## 7) Quick Reference

| Area | Path |
|------|------|
| Desktop app | `apps/desktop/` (React + Tauri Rust) |
| Rust crates | `crates/core/`, `crates/analysis/` |
| API (optional) | `apps/api/` |
| Shared types | `packages/shared/` |
| UI design system | `docs/ui/01-DESIGN-SYSTEM.md` |
| Navigation rules | `docs/plan/01-product/information-architecture.md` |
| Tasks | `docs/sdd/04-TASKS.md` |
| Project context | `docs/context/PROJECT_CONTEXT.md` |

**When in doubt:** Check the locked IA, read the relevant task in `docs/sdd/04-TASKS.md`, follow the SDD order (contracts → Rust → IPC → React), and respect local-first/non-destructive principles.