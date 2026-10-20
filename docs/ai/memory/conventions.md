# Conventions

Standing rules. Every session, in every tool, follows these.

## Formatting & lint

- Prettier: **100 columns**, double quotes, semicolons, `trailingComma: es5`.
  Run `pnpm format` before committing; `pnpm lint` must pass.
- Rust: prefer the workspace crates; `cargo clippy -D warnings` is enforced and
  `cargo fmt --all --check` must pass.
- Full local gate: `pnpm ci:local` (`ci:local:portable` when ONNX is unavailable).

## Boundaries

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

## Agent layer

- On every prompt, run `pnpm agent:preflight "<the prompt>"` before starting
  work. It never blocks — if nothing matches, continue normally.
- Edit agent and command files in `.opencode/` only, then run
  `pnpm agent:sync --write`; never hand-edit a mirror.
- A subagent ends with the `RESULT` handoff block (files | checks | findings |
  remaining | risks) — see `docs/ai/COMMUNICATION.md`.
