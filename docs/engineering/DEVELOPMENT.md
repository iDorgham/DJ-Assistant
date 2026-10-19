# DJ Assistant — Development Guide

**Audience:** Engineers setting up and working on the codebase  
**Status:** Pre-development scaffold guide  
**Last Updated:** 2026-10-08

---

## 1. Prerequisites

### Required

| Tool | Version | Notes |
|------|---------|-------|
| Rust | 1.80+ (stable) | `rustup` recommended |
| Node.js | 20 LTS or 22 LTS | Use `fnm` or `nvm` |
| pnpm | 9+ | Preferred package manager |
| Git | 2.40+ | — |

### Recommended

- **VS Code / Cursor** with extensions: rust-analyzer, Tauri, Tailwind CSS, ESLint, Prettier
- **Docker** (for local Postgres + Redis when working on cloud components)
- **ONNX Runtime** system libraries (platform-specific — see below)

### Platform Notes

- **macOS**: Xcode Command Line Tools required for Tauri.
- **Windows**: WebView2, Visual Studio Build Tools (C++), and long path support enabled.
- **Linux**: `webkit2gtk`, `libssl-dev`, and related packages (see Tauri docs).

---

## 2. Repository Structure (Target)

```
dj-assistant/
├── apps/
│   ├── desktop/                 # Tauri v2 app (Rust + React)
│   │   ├── src-tauri/           # Rust backend
│   │   └── src/                 # React frontend
│   └── api/                     # Fastify cloud control plane
├── packages/
│   ├── shared/                  # Shared TypeScript types & utilities
│   ├── ui/                      # Shared React components (if needed)
│   └── analysis/                # (Future) shared analysis helpers
├── models/                      # ONNX model files (git-lfs or download script)
├── docs/                        # Documentation (see docs/README.md)
│   ├── product/                 #   vision, canonical spec, glossary, sign-off
│   ├── architecture/            #   system design, data model, contracts, models
│   ├── engineering/             #   setup, standards, testing, security, tasks
│   ├── devops/                  #   CI/CD plans + workflow templates
│   ├── sdd/                     #   spec → design → plan → tasks → acceptance
│   ├── diagrams/                #   Mermaid diagrams
│   ├── ui/                      #   current UI/UX spec (design system, shell, screens)
│   ├── ui-ux/                   #   historical UI/UX set (superseded by ui/)
│   ├── ADR/                     #   architecture decision records
│   └── evidence/                #   acceptance evidence
├── scripts/                     # Dev scripts (setup, model download, etc.)
├── .github/                     # CI workflows
├── pnpm-workspace.yaml
├── package.json
├── Cargo.toml                   # Workspace Cargo.toml (if monorepo)
└── README.md
```

> Exact layout may evolve during Phase 0 scaffolding. Prefer a monorepo for shared types between desktop and API.

---

## 3. Local Development Setup (Once Scaffolded)

```bash
# Clone
git clone <repo-url> dj-assistant
cd dj-assistant

# Install JS dependencies
pnpm install

# Install Rust dependencies (from apps/desktop/src-tauri)
cd apps/desktop/src-tauri
cargo build
cd ../../..

# Download / place ONNX models
./scripts/download-models.sh

# Start desktop app in dev mode
pnpm --filter desktop dev

# (Optional) Start cloud API + dependencies
docker compose up -d          # Postgres + Redis
pnpm --filter api dev
```

### Environment Variables

Create `.env.local` files as needed. Never commit secrets.

**Desktop (example):**
```
# Optional cloud features
VITE_API_BASE_URL=http://localhost:3001
```

**API (example):**
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
LLM_API_KEY=...
JWT_SECRET=...
```

---

## 4. Common Commands (Target)

| Command | Description |
|---------|-------------|
| `pnpm --filter desktop dev` | Start Tauri + React in development |
| `pnpm --filter desktop build` | Production desktop build |
| `pnpm --filter api dev` | Start Fastify API |
| `pnpm --filter api test` | Run API tests |
| `cargo test` (in src-tauri) | Run Rust unit tests |
| `pnpm lint` | Lint JS/TS across workspace |
| `pnpm format` | Format with Prettier |
| `cargo fmt` + `cargo clippy` | Rust formatting & lints |

---

## 5. Development Workflow

### Branching

- `main` — Production-ready
- `develop` — Integration branch (if used)
- Feature branches: `feat/<short-description>`
- Bugfixes: `fix/<short-description>`
- Chores: `chore/<short-description>`

### Commit Messages

Follow Conventional Commits:

```
feat(desktop): add BLAKE3 hashing for deduplication
fix(analysis): correct phrase boundary snapping for 3/4 tracks
docs: update architecture with Skills kill-switch
```

### Pull Requests

- Open against `main` (or `develop`).
- Include a clear description of the change and linked issue/spec section.
- All CI checks (lint, typecheck, unit tests) must pass.
- For UI changes, include screenshots or short video when helpful.
- For analysis or set-builder changes, include test fixtures and expected outputs.

---

## 6. Working with Analysis Models

- Models live under `models/` (or a configurable path).
- Prefer quantized ONNX models for performance and smaller size.
- Never commit large model binaries without Git LFS or a download script.
- Analysis must remain fully functional offline.

When adding a new model:
1. Document input/output tensor shapes.
2. Add a versioned entry in the model registry (local SQLite or config).
3. Provide a fallback or graceful degradation path if the model fails to load.

---

## 7. Testing Strategy (High Level)

| Layer | Approach |
|-------|----------|
| Rust unit tests | Pure functions (hashing, scoring, Beam Search, cue snapping) |
| Analysis fixtures | Golden audio files + expected BPM/key/phrase outputs |
| Frontend | Component tests (Vitest + Testing Library) + Playwright for critical flows |
| API | Integration tests against local Postgres (Testcontainers or docker) |
| End-to-end | Manual + scripted “import → analyze → build set → export” journeys |

**Golden Rule:** Any change that affects BPM, key, cue placement, or set ordering must include or update fixture-based tests.

---

## 8. Debugging Tips

- **Tauri IPC**: Use the browser DevTools (opened via Tauri) + Rust `log` / `tracing` crate.
- **ONNX issues**: Verify model path, input shapes, and runtime version. Start with a single-track test harness.
- **Performance**: Profile analysis with `criterion` (Rust) and React DevTools Profiler.
- **SQLite**: Use `sqlite3` CLI or a GUI (DB Browser for SQLite) against the local DB file.

---

## 9. Phase 0 Checklist (Before Feature Work)

Before writing product features, the following should exist:

- [ ] Monorepo scaffolded (apps/desktop + apps/api + packages/shared)
- [ ] Tauri v2 + React + TypeScript + Tailwind running
- [ ] Basic Rust ↔ React IPC hello-world
- [ ] Local SQLite schema migration system
- [ ] Folder watcher skeleton
- [ ] BLAKE3 hashing + basic metadata extraction
- [x] ONNX Runtime linked and a smoke-test model runnable — *`crates/analysis` loads `ort` dynamically, verifies the model SHA-256, and executes `fixtures/models/smoke_test.onnx` (`y = Relu(x)`); the inference test skips where no runtime is installed*
- [ ] CI pipeline (lint + typecheck + unit tests)
- [ ] This DEVELOPMENT.md kept up to date

---

## 10. Related Documents

- [Architecture](../architecture/ARCHITECTURE.md)
- [Coding Standards](./CODING_STANDARDS.md)
- [Data Model](../architecture/DATA_MODEL.md)
- [Skills System](../architecture/SKILLS_SYSTEM.md)
- [Canonical Documentation](../product/CANONICAL_DOCUMENTATION.md)
