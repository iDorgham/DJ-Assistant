# DJ Assistant — Coding Standards

**Status:** Pre-development  
**Last Updated:** 2026-10-08

These standards apply to all code in the monorepo. Consistency > personal preference.

---

## 1. General Principles

1. **Clarity over cleverness** — Code is read far more often than written.
2. **Local-first mindset** — Prefer solutions that work offline and do not assume network.
3. **Reversibility** — Any mutation of user data (tags, cues, sets) must be loggable and undoable.
4. **Explicit over implicit** — Prefer typed interfaces, named constants, and clear error types.
5. **Fail safely** — Analysis failures should degrade gracefully; never corrupt the library.

---

## 2. TypeScript / React

### Style

- Use **TypeScript strict mode**.
- Prefer `interface` for object shapes that may be extended; `type` for unions and mapped types.
- No `any`. Use `unknown` + narrowing when necessary.
- Prefer named exports.
- Functional components only. Hooks for state and side effects.

### Naming

| Kind | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `WaveformCanvas` |
| Hooks | camelCase, `use` prefix | `useTrackAnalysis` |
| Utilities | camelCase | `calculateTransitionScore` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_BEAM_WIDTH` |
| Types / Interfaces | PascalCase | `TrackFeatures`, `SetConstraints` |

### State Management

- Prefer lightweight solutions (Zustand or Jotai) over heavy global stores.
- Keep analysis results and large binary data out of React state when possible (use Rust + IPC references).

### Styling

- Tailwind CSS utility-first.
- Extract repeated patterns into small components or `@apply` sparingly.
- Support light/dark themes from day one (CSS variables or Tailwind dark mode).

### Error Handling

- Surface user-facing errors with clear messages and recovery actions.
- Log detailed errors (with context) for debugging; never show stack traces to end users.

---

## 3. Rust

### Style

- Follow standard Rust formatting (`cargo fmt`) and Clippy (`cargo clippy -- -D warnings`).
- Prefer `Result<T, E>` with custom error enums (thiserror) over panics in library code.
- Use `tracing` for structured logging.
- Avoid `unwrap()` / `expect()` outside of tests and truly unreachable cases.

### Naming

| Kind | Convention |
|------|------------|
| Functions / methods | snake_case |
| Types / Traits / Enums | PascalCase |
| Constants | SCREAMING_SNAKE_CASE |
| Modules | snake_case |

### Error Types

Define domain-specific error enums:

```rust
#[derive(Debug, thiserror::Error)]
pub enum AnalysisError {
    #[error("unsupported audio format: {0}")]
    UnsupportedFormat(String),
    #[error("onnx inference failed: {0}")]
    Inference(String),
    // ...
}
```

### Performance

- Prefer borrowing over cloning large data.
- Use `rayon` for parallel analysis of multiple tracks when safe.
- Benchmark critical paths (BPM detection, Beam Search, cue snapping) with `criterion`.

### Safety

- Audio decoding and file I/O must handle malformed input without crashing the whole process.
- Never assume file paths or metadata are well-formed.

---

## 4. IPC (Rust ↔ React)

- All messages must be versioned or at least have a clear schema.
- Prefer strongly typed request/response pairs.
- Document every command in Canonical Documentation §6.1 and keep this in sync.
- Large binary data (waveforms, audio) should use efficient transfer (file paths, shared memory, or chunked streams) rather than JSON blobs when possible.

---

## 5. Database

### Local (SQLite)

- Use migrations (e.g. `refinery` or `sqlx` migrate).
- Every schema change is a migration.
- Prefer explicit column lists over `SELECT *`.

### Cloud (PostgreSQL)

- Same migration discipline.
- Use `pgvector` carefully; index appropriately.
- Never store raw audio or full waveforms in the cloud database.

---

## 6. Testing Expectations

- Pure functions (scoring, snapping, Beam Search helpers) → unit tests required.
- Analysis changes → update or add golden fixture tests.
- New Skills → must have tests for enable/disable, logging, and undo.
- UI critical paths → component + a few end-to-end tests.

---

## 7. Git & PR Hygiene

- Small, focused PRs preferred.
- Conventional Commits.
- Update relevant docs when behavior or public interfaces change.
- Do not commit:
  - Secrets / `.env` files
  - Large model binaries (use LFS or download scripts)
  - Generated build artifacts
  - Personal IDE settings (unless shared via `.vscode/recommended`)

---

## 8. Security & Privacy Checklist (Code Level)

- [ ] No audio file contents sent over the network unless explicitly designed and consented.
- [ ] User tokens and secrets never logged.
- [ ] Path handling resists directory traversal.
- [ ] Deserialization of external data is bounded and validated.
- [ ] Skills that mutate data always write an undo record first.

---

## 9. Related Documents

- [Development Guide](./DEVELOPMENT.md)
- [Architecture](../architecture/ARCHITECTURE.md)
- [Security & Privacy](./SECURITY_AND_PRIVACY.md)
