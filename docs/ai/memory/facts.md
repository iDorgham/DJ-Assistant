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
- The skill library this routing layer scores against is **machine-global**: it
  lives outside the repo, a fresh clone has none of it, and nothing in
  build/test/CI depends on it. Its size and location are workstation facts —
  they belong in `AGENTS.local.md`, not here.
- `.freebuff/`, `.qodo/`, `.kombai/`, `.superpowers/`, `.opencode-notes/` are
  **gitignored** local AI-tooling state. `.opencode/` and `.kiro/` are tracked.
- A project-local OpenCode plugin under `.opencode/plugins/` makes OpenCode drop
  the discovered skills from the model list — that directory is forbidden.
- A skill hidden with `metadata.opencode/autoinvoke: false` is **not loadable**
  here, so the whole skill library stays advertised.
- OpenCode's documented `permissions:` rules are **last-match-wins**, so a
  catch-all `"*"` deny goes *before* the allows in every agent `permissions:`
  block. The installed build parses a different singular key and enforces none of
  these rules — see [D-008](./decisions.md).
- `agents.registry.json` is the routing data of the agent layer: subagents
  (keywords, owned files, skills), commands, verification groups, and the map of
  tool directories that mirror the agent files.
- The agent and command files are canonical in `.opencode/agents` and
  `.opencode/commands` (tracked); every other tool directory (`.kilo`,
  `.qoder`, `.claude`, `.cursor`, `.codex`, …) is a local mirror.
- `pnpm agent:preflight '<prompt>'` turns any prompt into the brief every
  session reads: memory lines, skills, the agent to delegate to, and the checks.
- `.opencode/skill-manifest.json` records each skill's **source**, so with a local
  `.opencode/skills/` mirror present `pnpm skills:inventory` rewrites every
  entry to `project`/`overridden: global`. That is machine-local state in a
  tracked file — regenerate only from a clean checkout, or commit the global-source
  version.
- The DJ's DJ software is **Rekordbox 6/7** (Pioneer CDJs). Its
  `%APPDATA%\Pioneer\Rekordbox\master.db` is **encrypted** (header
  `77 82 f1 a3 …`, not `SQLite format 3`), so `rusqlite` cannot read it. The
  readable interchange format is the manual export
  (*File → Export → XML* → `rekordbox.xml`); `masterPlaylists6.xml` is
  **playlists only**. No adoptable Rekordbox MCP exists on npm — only
  libraries.
- The music library path is **configurable**
  (`$DJ_ASSISTANT_MUSIC_LIBRARY`); the concrete folders differ per workstation,
  so no absolute path belongs in this shared memory.
- The app's library DB (`%APPDATA%\com.djassistant.desktop\dj_assistant.db`) is
  in **WAL mode**, so a read-only open can fail once the app is closed —
  `dj-query` falls back to `immutable=1` only when the `-wal` is empty and
  refuses when it still holds content. It may also be **older than the code**
  (a library last opened before the newest migration), so the CLI reads
  `PRAGMA table_info(tracks)` and adapts.
