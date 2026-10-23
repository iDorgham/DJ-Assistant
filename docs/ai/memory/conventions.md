# Conventions

Standing rules. Every session, in every tool, follows these.

## Formatting & lint

- Prettier: **100 columns**, double quotes, semicolons, `trailingComma: es5`.
  Run `pnpm format` before committing; `pnpm lint` must pass.
- Rust: prefer the workspace crates; `cargo clippy --all-targets -- -D warnings`
  (`pnpm rust:clippy`) is enforced and `cargo fmt --all --check` must pass.
- Full local gate: `pnpm ci:local` (`ci:local:portable` when ONNX is unavailable).

## Plan and spec hierarchy

- `docs/product/CANONICAL_DOCUMENTATION.md` is the canonical product and
  technical spec; `docs/ui/01-DESIGN-SYSTEM.md` is authoritative for shipped UI
  tokens and components.
- `docs/plan/` is the **approved v1 plan** and delivery order. Its decision IDs
  (`D-001–D-052`) are scoped to that tree and are separate from the repository
  memory ledger. Do not silently mix the two namespaces.
- When the plan and the canonical spec/UI disagree, record the conflict and
  decide it explicitly; do not let one silently override the other.
- `docs/plan/06-delivery/discussions.md` records rationale, rejected
  alternatives and open items. Add an entry when a decision changes.

## Boundaries

- **Put the rules in `crates/core`, not in the desktop crate.** The desktop
  crate's test harness does not load on `stable-x86_64-pc-windows-gnu`
  (`STATUS_ENTRYPOINT_NOT_FOUND`), so a rule that lives only in
  `apps/desktop/src-tauri` is a rule that is never executed. Pure logic —
  the write rules, the query builder, the normalisation — belongs in
  `crates/core` (Tauri-free, as its own crate docstring says); the desktop
  crate stays the thin IPC adapter over it.
- Keep UI tokens and components aligned with `docs/ui/` — never invent a second
  palette or spacing scale.
- Do not commit generated artefacts (`target/`, `dist/`, model binaries) or the
  local database.
- Treat other agents' in-progress work as off-limits: never reformat, move, or
  revert changes you did not make.
- Skills are **advisory technique, not project authority**; `docs/ui/` wins for
  anything UI-facing.

## AI memory

- Canonical project memory is `AGENTS.md` + `docs/ai/memory/*`. Do not create
  competing per-tool memory files.
- Append corrections and durable learnings to
  [`feedback.md`](./feedback.md) / [`decisions.md`](./decisions.md); delete
  rot from [`state.md`](./state.md).
- Never hide OpenCode skills and never add a file under `.opencode/plugins/`.
- No machine-local data in the shared store: a workstation path, an install
  count, or a personal tool setting belongs in the gitignored
  `AGENTS.local.md`, because these files are re-sent to every tool on every
  session. Keep counts out too — they go stale silently.

## Agent layer

- On every prompt, run `pnpm agent:preflight '<the prompt>'` before starting
  work. It never blocks — if nothing matches, continue normally.
- Edit agent and command files in `.opencode/` only, then run
  `pnpm agent:sync --write`; never hand-edit a mirror.
- A subagent ends with the `RESULT` handoff block (files | checks | findings |
  remaining | risks) — see `docs/ai/COMMUNICATION.md`.
