# AGENTS.md — DJ Assistant

Guidance for AI agents working in this repository. It applies to the whole
workspace. The deeper docs under `docs/` stay authoritative — this file is a
map, not a replacement.

Canonical spec: [`docs/product/CANONICAL_DOCUMENTATION.md`](docs/product/CANONICAL_DOCUMENTATION.md).
UI source of truth: [`docs/ui/01-DESIGN-SYSTEM.md`](docs/ui/01-DESIGN-SYSTEM.md).

## What this is

A desktop-first DJ preparation app: import a library, analyse tracks locally,
review them with waveforms and cue points, and organise sets. It is local-first —
analysis and library data live in a local SQLite database; the cloud API is
optional.

| Area        | Stack                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Desktop app | Tauri v2 (Rust) + React 19 + Vite + Tailwind v4 — `apps/desktop`            |
| Rust crates | `crates/core`, `crates/analysis` (symphonia, ort/ONNX, rusqlite)            |
| API         | Fastify 5 — `apps/api`                                                      |
| Shared      | `packages/shared` (types/contracts used by both sides)                      |
| Tooling     | pnpm workspace (`pnpm@10`), Prettier, ESLint, Vitest, `cargo`               |

## Commands

| Task              | Command                                        |
| ----------------- | ---------------------------------------------- |
| Desktop dev       | `pnpm dev:desktop`                             |
| API dev           | `pnpm dev:api`                                 |
| Lint everything   | `pnpm lint`                                    |
| Type-check        | `pnpm typecheck`                               |
| Front-end tests   | `pnpm test` (Vitest)                           |
| Rust format/lint  | `pnpm rust:fmt` · `pnpm rust:clippy`           |
| Rust tests        | `pnpm rust:test` (use `rust:test:portable` when the ONNX runtime is unavailable) |
| Full local gate   | `pnpm ci:local`                                |

## Conventions

- Prettier: 100 columns, double quotes, semicolons, `trailingComma: es5`.
  Run `pnpm format` before committing; `pnpm lint` must pass.
- Keep UI tokens and components aligned with `docs/ui/` — never invent a second
  palette or spacing scale.
- Rust: prefer the workspace crates; `clippy -D warnings` is enforced.
- Don't commit generated artifacts (`target/`, `dist/`, model binaries) or the
  local database.

## Project memory — one store, every AI tool

**Qoder, Kilo Code, OpenCode, FreeBuff, and DeepSeek Harness all read
`AGENTS.md`**, so this project keeps a single canonical memory rather than one
copy per tool: `AGENTS.md` + [`docs/ai/memory/`](docs/ai/memory/README.md).
Architecture and write rules: [`docs/ai/MEMORY.md`](docs/ai/MEMORY.md).

| Layer | File | Use for |
| ----- | ---- | ------- |
| L1 | [`facts.md`](docs/ai/memory/facts.md) | Structural/tooling facts not inferable from code |
| L1 | [`conventions.md`](docs/ai/memory/conventions.md) | Standing rules every session follows |
| L2 | [`decisions.md`](docs/ai/memory/decisions.md) | Append-only choices that must not be silently reversed |
| L2 | [`feedback.md`](docs/ai/memory/feedback.md) | Append-only corrections and lessons learned |
| L3 | [`state.md`](docs/ai/memory/state.md) | Hand-off between sessions; rotates (~2 weeks) |

- Keep entries terse — every line is re-sent as context to every tool, every
  session. Never duplicate what the repo already records, and **never store
  secrets** in them.
- **Never fork memory per tool.** `CLAUDE.md`, `.qoder/rules/`, `.kilo/rules/`,
  and `kilo.jsonc` are thin adapters only — do not restate instructions in them.
- Machine-specific notes go in `AGENTS.local.md` / `CLAUDE.local.md` (both
  gitignored; template: [`AGENTS.local.example.md`](AGENTS.local.example.md)).
- `/remember <what to keep>` writes to the right layer; the `memory-keeper`
  subagent de-duplicates and rotates `state.md`.
- Memory is a hint, not gospel: anything contradicting the code must be
  re-verified before it is acted on.

## Agent routing — automatic, on every prompt

This machine has a large global OpenCode skill library (see
[`docs/ai/SKILLS.md`](docs/ai/SKILLS.md)); every skill is advertised to the model.
`skills.policy.json` records a curated **hot** priority set and the project's
prompt triggers; [`docs/ai/SKILL_ROUTING.md`](docs/ai/SKILL_ROUTING.md) is the
generated summary, and [`docs/ai/AGENTS.md`](docs/ai/AGENTS.md) documents the
agents, commands, and scripts behind it.

**On every prompt, run the preflight before you start work:**

```bash
pnpm agent:preflight "<the prompt, in the user's words>"
```

One command returns the memory lines that apply, the skills worth loading, the
subagent that should own the work, and the checks the change implies. It is
read-only, takes about a second, and **never blocks** — if nothing matches,
continue normally.

Then:

- Load the returned skills with the `skill` tool.
- Delegate when the brief names an agent — the contract is in
  [`docs/ai/COMMUNICATION.md`](docs/ai/COMMUNICATION.md) (§4 delegation,
  §5 handoff).
- Run the checks the brief lists before reporting the work as done.
- `/preflight <task>` does the same step for you, `/skills <task>` matches
  skills only, `/skills-audit` reviews the library (duplicates, dead weight,
  policy drift).
- The `skill-router` subagent maps a task to skills and returns the IDs to load;
  the `skill-maintainer` subagent runs the inventory/audit and reports.
- Skills are **advisory technique, not project authority** — for anything
  UI-facing, `docs/ui/` wins over any generic design skill.
- After editing `skills.policy.json`, run `pnpm skills:inventory` to regenerate
  the manifest and routing doc. After editing an agent or command file, run
  `pnpm agent:sync --write` to update every tool's copy, and `pnpm agent:doctor`
  to check the agent layer.

> Do **not** hide skills with `metadata.opencode/autoinvoke: false` (or run
> `pnpm skills:policy --apply`): a hidden skill is not loadable in this
> environment, so hiding only removes capability. `--apply` is guarded and
> refuses without `--force`.

> Do **not** add files under `.opencode/plugins/` in this workspace: a
> project-local plugin currently causes OpenCode to drop the discovered skills
> from the model list. Skill routing is done through instructions, commands, and
> subagents instead.

Agent and command definitions live in [`.opencode/agents/`](.opencode/agents) and
[`.opencode/commands/`](.opencode/commands); they are mirrored into every other
tool directory by `pnpm agent:sync`.

## Agent communication

Work directly when the task is one file or one command; delegate when it spans
layers, sits in a specialist domain, or splits into independent parts. The
protocol — delegation contract, `RESULT` handoff, board semantics, file
ownership, escalation — is
[`docs/ai/COMMUNICATION.md`](docs/ai/COMMUNICATION.md).
