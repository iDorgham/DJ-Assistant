# Facts

Permanent, verifiable facts about this project. Add a line only when the fact is
not inferable by reading the code.

- Desktop-first **DJ preparation app**: import a library, analyse tracks locally
  with waveforms/cues, organise sets.
- **Local-first**: analysis and library data live in a local **SQLite** database;
  the cloud API is optional.
- Stack: **Tauri v2** (Rust) + **React 19** + **Vite** + **Tailwind v4** for the
  desktop app (`apps/desktop`); Rust crates at `crates/core`, `crates/analysis`
  (symphonia, ort/ONNX, rusqlite); **Fastify 5** API (`apps/api`); shared types
  in `packages/shared`; **pnpm@10** monorepo.
- Dev machine is **Windows**; the Rust toolchain may lack the ONNX runtime, so
  use `pnpm rust:test:portable` when `pnpm rust:test` cannot run.
- The repo contains **no** Docker, Kubernetes, or AWS/terraform artefacts.
- `docs/ui/01-DESIGN-SYSTEM.md` is the **authoritative** UI spec — it outranks
  every generic design skill and every design opinion.
- ~240 machine-global OpenCode skills are installed (outside the repo, at
  `C:\Users\User\.config\opencode\skills`); nothing in build/test/CI depends on
  them, and collaborators do not receive them.
- `.freebuff/`, `.qodo/`, `.kombai/`, `.superpowers/`, `.opencode-notes/` are
  **gitignored** local AI-tooling state. `.opencode/` and `.kiro/` are tracked.
- A project-local OpenCode plugin under `.opencode/plugins/` makes OpenCode drop
  the discovered skills from the model list — that directory is forbidden.
- A skill hidden with `metadata.opencode/autoinvoke: false` is **not loadable**
  here, so the whole skill library stays advertised (~15.4k tokens/step).
- `agents.registry.json` is the routing data of the agent layer: subagents
  (keywords, owned files, skills), commands, verification groups, and the map of
  tool directories that mirror the agent files.
- The agent and command files are canonical in `.opencode/agents` and
  `.opencode/commands` (tracked); every other tool directory (`.kilo`,
  `.qoder`, `.claude`, `.cursor`, `.codex`, …) is a local mirror.
- `pnpm agent:preflight "<prompt>"` turns any prompt into the brief every
  session reads: memory lines, skills, the agent to delegate to, and the checks.
- `.opencode/skill-manifest.json` records each skill's **source**, so with a local
  `.opencode/skills/` mirror present `pnpm skills:inventory` rewrites all 240
  entries to `project`/`overridden: global`. That is machine-local state in a
  tracked file — regenerate only from a clean checkout, or commit the global-source
  version.
