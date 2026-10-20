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

## Agent skills — routing workflow

This machine has a large global OpenCode skill library (see
[`docs/context/AGENT_SKILLS.md`](docs/context/AGENT_SKILLS.md)); every skill is
advertised to the model. `skills.policy.json` records a curated **hot** priority
set and the project's prompt triggers;
[`docs/context/SKILL_ROUTING.md`](docs/context/SKILL_ROUTING.md) is the generated
summary.

**Before starting a non-trivial task, match it to skills and load the winners:**

```bash
node scripts/skills/match.mjs --top 3 "<short task summary>"
```

- `/skills <task>` does the match-and-load step for you.
- `/skills-audit` reviews the library (duplicates, dead weight, policy drift).
- The `skill-router` subagent maps a task to skills and returns the IDs to load;
  the `skill-maintainer` subagent runs the inventory/audit and reports.
- Skills are **advisory technique, not project authority** — for anything
  UI-facing, `docs/ui/` wins over any generic design skill.
- After editing `skills.policy.json`, run `pnpm skills:inventory` to regenerate
  the manifest and routing doc.

> Do **not** hide skills with `metadata.opencode/autoinvoke: false` (or run
> `pnpm skills:policy --apply`): a hidden skill is not loadable in this
> environment, so hiding only removes capability. `--apply` is guarded and
> refuses without `--force`.

> Do **not** add files under `.opencode/plugins/` in this workspace: a
> project-local plugin currently causes OpenCode to drop the discovered skills
> from the model list. Skill routing is done through instructions, commands, and
> subagents instead.

Agent and command definitions live in [`.opencode/agents/`](.opencode/agents) and
[`.opencode/commands/`](.opencode/commands).
