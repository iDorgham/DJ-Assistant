# MCB / MCP / Plugin Audit — DJ Assistant

**Document type:** Audit + recommendation (AI tooling)
**Status:** Living — last updated 2026-10-21 (Rekordbox pivot)
**Scope:** What MCP servers ("MCBs"), OpenCode plugins and skills already exist in
and around this repo, which gaps remain, and which additions are worth their
risk.
**Companion:** [`mcb-plugin-enhancement-plan.md`](./mcb-plugin-enhancement-plan.md) ·
[`mcp.recommended.jsonc`](./mcp.recommended.jsonc)

> **Pivot (2026-10-21).** The maintainer answered the four open questions in §7:
> **Rekordbox** is the source of truth (Pioneer CDJs at Little Buddha / Arena
> Beach Club), **Serato is dropped entirely**, the **Playwright MCP is skipped**
> (`playwright-cli` + `ui-verification` are sufficient), and the **Rust `dj-query`
> CLI is approved as the primary** library-query path with the raw SQLite MCP
> kept only as an ad-hoc fallback. This document has been updated to match.


---

## 0. Method and terminology

### What "MCB" means here

This repo has no prior use of the term. For this document:

| Term | Meaning |
| ---- | ------- |
| **MCP** | Model Context Protocol server — a process (stdio) or endpoint (HTTP) that exposes tools to the agent. The protocol OpenCode speaks. |
| **MCB** | **MCP Bundle** — a *named group* of MCP servers configured together for one job (e.g. "DJ library bridge" = read-only SQLite over a DB snapshot). A bundle is a **config grouping and a naming convention, not a new runtime**. OpenCode has no MCB primitive; we get it for free by naming servers with a shared prefix and documenting the set in one file. |
| **Plugin** | An OpenCode plugin — JS loaded from `.opencode/plugins/` or the global plugins dir, able to hook the runtime. **Forbidden in this workspace** (see §1.5). |
| **Skill** | An `SKILL.md` capability folder (advisory technique the model loads). Already covered by `docs/ai/SKILLS.md`. |

### What was read, and what was verified

Read (full): `AGENTS.md`, `docs/ai/MEMORY.md`, `docs/ai/SKILLS.md`,
`docs/ai/SKILL_ROUTING.md`, `docs/ai/AGENTS.md`, `docs/ai/memory/*`,
`agents.registry.json`, `skills.policy.json`, `package.json`,
`pnpm-workspace.yaml`, `.opencode/agents/*`, `.opencode/commands/*`,
`crates/core/src/lib.rs`, `crates/core/src/library_query.rs`,
`crates/core/src/library_stats.rs`, `crates/core/src/bin/scan.rs`,
`crates/core/src/bin/query.rs`, `crates/core/Cargo.toml`,
`apps/desktop/src-tauri/src/commands.rs`, `apps/desktop/src-tauri/src/db.rs`,
`apps/desktop/src-tauri/migrations/*.sql`,
`apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src/services/api.ts`,
`scripts/inspect-db.py`, `docs/architecture/SKILLS_SYSTEM.md`, `docs/README.md`.

Verified live on this workstation (2026-10-21):

| Check | Command / source | Result |
| ----- | ---------------- | ------ |
| Project MCP config | `opencode.json` / `opencode.jsonc` / `mcp.json` / `.mcp.json` / `.opencode/mcp*` | **none exist** |
| Global MCP config | `~/.config/opencode/opencode.json` | one server: `pencil` (local exe) |
| MCP resources in session | `tools.opencode.list_mcp_resources()` | empty (no MCP tool resources exposed) |
| Global plugins | `~/.config/opencode/plugins/` | `paseo-terminal-activity.js` (outside the repo) |
| Project plugins | `.opencode/plugins/` | **absent — and must stay absent** |
| Skill library | `skills.policy.json` + `.opencode/skill-manifest.json` | 240 installed, 72 hot, all advertised |
| Toolchain | `node -v`, `pnpm -v`, `uv`, `uvx`, `ffmpeg`, `python`, `npx playwright --version` | node 24.3.0, pnpm 10.14.0, uv/uvx on PATH, ffmpeg on PATH, Python 3.x, Playwright 1.64.1 |
| Package facts | npm registry + PyPI JSON API + upstream READMEs | see §3 — every version below was resolved, not recalled |
| **DJ software installed** | `%APPDATA%\Pioneer\Rekordbox\` | **Rekordbox 6/7 present**: `master.db` (379 MB) + `master.db-wal` + `master.db-shm`, `masterPlaylists6.xml` (94 KB), `datafile.edb`, `ExtData.edb`, `product.db`, `networkAnalyze6.db`, `PIONEER\` |
| **Rekordbox DB format** | first 32 bytes of `master.db` | `77 82 f1 a3 f1 52 9b a0 …` — **not** `SQLite format 3`: the file is **encrypted** (see §3.3) |
| **Rekordbox MCP on npm** | `registry.npmjs.org` search for `rekordbox` / `rekordbox mcp` | `rekordbox-parser`, `rekordbox-connect`, `rbox-js`, `rekordbox-js`, `rekordxml`, `onelibrary-connect` — **libraries, not MCP servers**. No read-only Rekordbox MCP exists (see §3.3) |
| **`pyrekordbox`** | PyPI JSON API | 0.5.0, `requires_python >=3.11`, **not installed** on this box; `uvx` 0.7.21 is available |
| **Music library path** | `Test-Path D:\Music\DJ_Library` | **does not exist here.** Present instead: `D:\Music\Music Library` (genre folders incl. `Buddha`, `Dj Tools`) and `D:\Music\My Sets` (incl. `Buddha April`, `Buddha Feb`, `Buddha June`) |
| **App library DB** | `%APPDATA%\com.djassistant.desktop\dj_assistant.db` | 258 KB, **WAL mode** (`journal_mode=wal`), live `-wal` (576 KB) + `-shm` |

### The "image's intent"

No image was attached to this session. The intent is therefore read from the
project's own canonical statement of purpose — `AGENTS.md` ("import a library,
analyse tracks locally, review them with waveforms and cue points, and organise
sets") and `docs/product/CANONICAL_DOCUMENTATION.md`. **Everything in this
audit is judged against that loop**: *import → analyse → review → organise*.

---

## 1. Current state

### 1.1 MCP servers

| Location | Entry | Type | Status |
| -------- | ----- | ---- | ------ |
| Repo root | — | — | **no MCP config in the project at all** |
| `~/.config/opencode/opencode.json` | `mcp.pencil` | local (`highagency.pencildev` exe) | enabled; unrelated to DJ Assistant; Cursor extension, not our stack |
| `.opencode/` | — | — | `agents/`, `commands/`, `skills/` (gitignored mirror), `skill-manifest.json` — **no `mcp` block** |

The session confirms it: `list_mcp_resources()` returns `[]`.

### 1.2 How OpenCode resolves config here

From the upstream config docs (verified 2026-10-21): configs are **merged, not
replaced**; later sources override earlier ones only for conflicting keys.

```
remote (.well-known/opencode)
  → global (~/.config/opencode/opencode.json)
    → custom (OPENCODE_CONFIG)
      → PROJECT (opencode.json at the repo root)   ← highest useful precedence
        → .opencode/ directories (agents, commands, plugins)
          → inline (OPENCODE_CONFIG_CONTENT)
```

Two consequences that shape this plan:

1. A **project-level `opencode.json` merges with the global one** — the global
   `mcp.pencil` survives, and the project's `mcp` block adds to it. This is the
   only correct place to put a *reviewable, tracked* MCP definition for this repo.
2. The `tools` map can **disable MCP tools by name** (`"sqlite_write_query": false`)
   and can be scoped **per agent**. That is the enforcement mechanism this plan
   leans on for read-only guarantees — better than asking a model politely.

Variable syntax is `{env:VAR}` (empty string if unset) and `{file:path}` — *not*
`${VAR}`. Anything that looks like `${…}` in a config file is literal text.

### 1.3 Skills and policy

- 240 skills installed machine-globally (`C:\Users\User\.config\opencode\skills`),
  mirrored gitignored under `.opencode/skills/`.
- `skills.policy.json` curates a 72-skill **hot** set across 11 groups.
- The **Music & DJ domain group is already hot**: `music-analyzer`,
  `beets-music-library-manager-tagger`, `music-library-organizer`,
  `dj-library-curator`, `dj-library-organizer`, `dj-set-architect`,
  `dj-mix-documentarian`, `rekordbox`, `ffmpeg-waveforms-visualization`.
- 40+ hand-curated `triggers` map DJ vocabulary (`beatgrid`, `bpm`, `serato`,
  `rekordbox`, `beets`, `usb export`, `harmonic mixing`, …) onto those skills.
- **Nothing in the skill layer needs to change for this work** — see §4.

> ⚠️ Machine-local trap: `.opencode/skill-manifest.json` is a **tracked** file
> that records each skill's *source*. With the local `.opencode/skills/` mirror
> present, `pnpm skills:inventory` rewrites every entry to `project` /
> `overridden: global` — machine-local state in a tracked file (recorded in
> `docs/ai/memory/facts.md`). The manifest is currently in the clean
> `source: "global"` state. **Do not run `pnpm skills:inventory` on this
> workstation.** Edit the policy only from a clean checkout, or accept the
> manifest churn deliberately.

### 1.4 Agents and commands

Six subagents and six commands in `.opencode/` (canonical), mirrored to 18 tool
directories by `pnpm agent:sync --write`. Routing is automatic:
`pnpm agent:preflight '<prompt>'` returns memory + skills + owner + checks.

- `audio-dj-expert` already carries `music-analyzer`, `ffmpeg-waveforms-visualization`,
  `dj-library-organizer`, `dj-set-architect`, `beets-music-library-manager-tagger`,
  `rekordbox`, `sql-optimization-patterns` — and its `shell` permissions already
  allow `beets *`, `ffmpeg *`, `cargo *`, `pnpm *`.
- `tauri-expert` carries the Tauri/IPC skills.

**Implication:** the agent layer already has the domain skills and the shell
rights for the work an MCP would be bolted onto. That is the single most
important fact in this audit.

### 1.5 Plugins

`docs/ai/memory/decisions.md` → **D-002**: a file under `.opencode/plugins/`
makes OpenCode drop the discovered skills from the model list. The directory is
forbidden; `AGENTS.md` repeats the ban. The global `~/.config/opencode/plugins/`
holds one unrelated plugin and is **out of scope** (never edit user-global config
from a repo task).

### 1.6 Repo-wide references to "mcp" / "plugin"

| Location | What it is | Action |
| -------- | ---------- | ------ |
| `.opencode/skill-manifest.json` | Skill *descriptions* that mention MCP (`aws-mcp-setup`, `docker-docs`, `supabase`) | none |
| `docs/ai/SKILL_ROUTING.md`, `docs/ai/SKILLS.md` | same descriptions | none |
| `.kiro/skills/ci-score/tests/fixtures/**` | vendored third-party test fixtures mentioning `mcp-docs-server` | none (vendored) |
| `agents.registry.json` → `tauri-expert` keywords | the word `plugin` = **Tauri** plugins (Rust side) | none — do not confuse with OpenCode plugins |

**There is no "MCB", "mcp-bridge", or OpenCode-plugin concept anywhere in the
product or the agent layer today.** The name is new here.

### 1.7 The two "skills" in this project

Do not conflate them:

| | Product Skills | OpenCode Skills |
| - | --------------- | --------------- |
| What | `docs/architecture/SKILLS_SYSTEM.md` — scoped, reversible, undo-able in-app automation (`cue_master`, `tag_surgeon`, `set_architect`, …) | `SKILL.md` capability folders the model loads for technique |
| Where | `crates/` + `apps/desktop` | machine-global dir, mirrored into `.opencode/skills/` |
| MCP's role | **none — an MCP is not a product Skill** | n/a |

An MCP server can *help an agent build or debug* product Skills; it is never a
substitute for one, and it must not become a source of truth for the app.

---

## 2. Gaps against the import → analyse → review → organise loop

| # | Gap | Evidence | Covered today? |
| - | --- | -------- | -------------- |
| G-1 | The agent cannot ask the app's **own database** a question ("how many tracks have a key but no BPM?", "which are `needs_review`?") | DB lives at `%APPDATA%\com.djassistant.desktop\dj_assistant.db`; `scripts/inspect-db.py` is a hand-rolled Python inspector | **Closed** — `crates/core/src/bin/query.rs` (`dj-query`) landed 2026-10-21, reusing the app's own `library_query` builder |
| G-2 | The agent cannot see the **DJ's real Rekordbox library** to cross-check the app's import (BPM/key coverage, playlists, tracks the app never saw) | Rekordbox 6/7 is installed; `master.db` is **encrypted**; the only readable export is the XML the DJ produces by hand | **No** — and **no MCP can fix it** (§3.3). The gap is closed by a **Rust XML reader**, staged behind the DJ producing the export |
| G-3 | The agent cannot **verify the UI in a running browser** | `apps/desktop/src/services/api.ts` has a mock-IPC fallback, and `tauri.conf.json` sets `devUrl: http://localhost:1420` — the React app *does* run in a plain browser | **Yes, by decision** — the Playwright MCP was **skipped**: `playwright-cli` + the `ui-verification` skill are sufficient inside the Tauri/React stack, and the MCP's per-step tool cost and timeout risk are not worth it |
| G-4 | Nothing verifies the **live Rekordbox library** against the app's SQLite import (missing files, duplicates, BPM/key gaps) | `dj-library-organizer` skill reads ID3 tags only; `dj-query --check-files` now finds tracks whose file is gone | **Partly** — file-level drift is covered by `dj-query --check-files`; metadata-level drift needs G-2 |
| G-5 | Up-to-date **Tauri v2 / rusqlite / symphonia** docs are fetched by ad-hoc web search | `websearch`/`webfetch` built-ins exist; `docker-docs` skill shows the docs-pulling pattern | **No** structured docs tool (Context7 deferred — §3.1) |
| G-6 | Reading the DJ's **export/crate folders** outside the repo | agent has file tools, but they are repo-scoped in practice | **No** — and `filesystem` MCP is a poor answer (§3) |

---

## 3. Candidate evaluation

Every row was **resolved against the registry on 2026-10-21** (npm registry /
PyPI JSON API) and the upstream README was read where a version existed. "Local
only?" means: does the server talk to the network to do its job?

### 3.1 Candidates from the brief

| Candidate | Source & verified version | What it really exposes | Local only? | Risk | Fit | Verdict |
| --------- | ------------------------- | ------------------------ | ----------- | ---- | --- | ------- |
| `filesystem` (scoped) | `@modelcontextprotocol/server-filesystem@2.0.0` (official, Node ≥ 24 ✅) | Full **read *and write*** (create/move/delete dirs, write files) inside an allow-list given as **CLI args**. No `--read-only` flag; read-only exists only as MCP *hints* per tool, and as a Docker `ro` mount (Docker is not in this repo and is not preferred on Windows) | Yes | **Med-High** | Low | **Reject for the repo** — duplicates the built-in file tools. Its only real use is the DJ's music folder — which is the **Rust app's** job. If ever: scope to the *export* dir only, never `C:\` |
| `git` | **Not on npm** (`@modelcontextprotocol/server-git` → 404). The real one is Python: `mcp-server-git@2026.10.19` (PyPI, `uvx`) | `git_status`, `git_diff*`, `git_log`, **plus `git_add`, `git_commit`, `git_reset`** (writes) | Yes | **Med** | Low | **Defer** — the agent already has `git` via the shell plus the `git-advanced-workflows` skill. An MCP wrapper adds context, not capability. If added later, it is *write*-capable, so it must be disabled per-agent |
| `shell` / `command` | — | — | — | — | — | **Reject as an MCP** — OpenCode's `shell` tool already does this, and the agent permission blocks (`audio-dj-expert`: `cargo *`, `pnpm *`, `beets *`, `ffmpeg *`) are the right place to allow it |
| `browser` (Playwright) | `@playwright/mcp@0.0.83` (official, Microsoft) | Drives a real Chromium: navigate, click, snapshot, **and** `browser_*` request interception only when `--caps=network` is opted into. Scoping flags: `--allowed-origins`, `--blocked-origins`, `--isolated`, `--headless`, `--caps` | Yes (page requests may reach the network — the app is `localhost`) | **Low-Med** | **Med** | **Reject — skipped by maintainer decision (2026-10-21).** `playwright-cli` and the hot `ui-verification` skill already run the same checks inside the Tauri/React stack; the MCP adds per-step tool cost and timeout risk without new capability |
| `beets`-aware MCP | **No beets MCP exists** on PyPI or npm (`beets-mcp`, `mcp-server-beets` → 404). `beets-music-library-manager-tagger` is a **skill** | The skill already drives `beets` (a CLI) | Partly (MusicBrainz lookup is a network call) | Low | Med-High | **Reject the MCP, keep the skill** — an MCP would only wrap the same `beets` CLI the skill already invokes. The Rust side already parses tags (`id3`, `metaflac`, `audiotags`) |
| `ffmpeg` MCP | `mcp-ffmpeg@1.0.5` (bitscorp), `ffmpeg-mcp-server@1.0.4` | `mcp-ffmpeg` exposes **`execute_ffmpeg_command`** — arbitrary ffmpeg, i.e. arbitrary file writes and arbitrary filters. The other is video-oriented and bundles `ffmpeg-static` | Yes | **High** (arbitrary command execution) | Med | **Reject.** The `ffmpeg-waveforms-visualization` skill + `audio-dj-expert`'s `ffmpeg *` shell permission already cover it, and `crates/analysis` owns the real pipeline. An MCP wrapper adds an arbitrary-execution surface for zero gain |
| `sequential-thinking` | `@modelcontextprotocol/server-sequential-thinking@2.0.0` | A structured thinking tool | Yes | Low | Low | **Reject** — adds context (every MCP tool is advertised on every step) and no capability the model lacks. `brainstorming` + `using-superpowers` (both hot) already cover deliberate planning |
| `memory` / `context7` | `@modelcontextprotocol/server-memory@2.0.0` (PyPI + npm) · `@upstash/context7-mcp@4.4.4` / remote `https://mcp.context7.com/mcp` | `server-memory` persists a **JSONL knowledge graph to disk** — a *second* memory store. Context7 pulls **current library docs** over the network | `server-memory`: yes · Context7: **no** (network) | Memory: **Med** (forks the memory store, contradicts D-001) · Context7: Low | Context7: Med-High | **Reject `server-memory`** (D-001: one store, many readers). **Defer Context7** to opt-in, off by default — `websearch`/`webfetch` already exist, and a third-party doc service is a network dependency for a local-first repo |
| Serato / Rekordbox readers | `serato-dj-mcp@0.1.1` (npm, MIT) · `MCP-Serato` (justinmaldonado, TS, read-only, claims Windows+macOS) · `dj-setbox` (Python, MIT, rekordbox 7, Windows venv) · `mcp-dj` (darav-t, ★6, pyrekordbox, Windows installer) | Crate/playlist browsing, BPM+Camelot harmonic search, duplicate/missing-file audits; `serato-dj-mcp` is **read-only by default** and reads a **snapshot copy**; writes are behind `--allow-writes` and staged | Yes | **Med** (Windows untested for `serato-dj-mcp`; the alternatives are 0–6★) | **n/a** | **Dropped.** The DJ runs **Rekordbox** on Pioneer CDJs, not Serato — `serato-dj-mcp` reads a library that does not exist here. See §3.3 for the Rekordbox finding |

### 3.2 Candidates found during the audit (not in the brief)

| Candidate | Source & verified version | What it exposes | Local only? | Risk | Fit | Verdict |
| --------- | ------------------------- | ---------------- | ----------- | ---- | --- | ------- |
| **SQLite (read-only)** | `mcp-server-sqlite@2025.4.25` (PyPI, `uvx`) | `read_query`, **`write_query`**, **`create_table`**, `list_tables`, `describe-table`, `append_insight` + a `memo://insights` resource | Yes | **Med** (write tools exist) | **High** (closes G-1) | **Adopt, read-only** — point it at a **snapshot copy** of the DB and disable `write_query` / `create_table` through OpenCode's `tools` map. See §5 for the Rust-first alternative, which is preferred |
| `musicbrainz-mcp` | `musicbrainz-mcp@1.2.7`, `@mrfentmen/musicbrainz-mcp@1.0.2` | MusicBrainz artist/release/recording lookup | **No** (network) | Med (rate limits; User-Agent policy) | Low | **Reject for now** — `crates/core/src/enrichment.rs` already owns MusicBrainz enrichment, with the app's own rate-limit handling. A second client would double the traffic against a 1 req/s API |
| `dnb-crate` | `arildgrimstveit/dnb-crate` | Local-first DnB library cataloguing + set rendering | Yes | Low | Genres-specific | **Reject** — genre-locked; the app is genre-neutral |
| `mcp-everything` | `@modelcontextprotocol/server-everything@2.0.0` | Test server | Yes | — | — | **Reject** — it is a protocol test fixture |
| `dj-setbox` | `tgf-between-your-legs/dj-setbox` (MIT) | rekordbox 7 set planning + cue writing | Yes | **Med-High** (writes cues; unofficial) | Med | **Defer** — the app has its own set builder (`dj-set-architect` skill, `set_architect` product Skill) |
| `mcp-dj` | `darav-t/mcp-dj` (★6, no license assertion) | Rekordbox 6 via pyrekordbox + a web UI on `:8888` | Yes | Med-High (installer scripts that edit Claude Desktop config) | Med | **Reject** — the installer edits *other tools' global config*; out of bounds for this repo |
| **Rekordbox XML reader (ours)** | **planned** — `crates/core/src/bin/rekordbox.rs` → `dj-rekordbox` (not built yet) | Parses the DJ's exported `rekordbox.xml` read-only: tracks, BPM, Camelot key, rating, playlists — for reconciliation against the app's import | Yes | **Low** (a `SELECT`-only reader over a file the DJ exports) | **High** (closes G-2/G-4) | **Planned — build it** — see §3.3. No MCP can do this, and the Rust route keeps the project dependency-free |

### 3.3 The Rekordbox finding (material)

Rekordbox is the DJ's source of truth — the venues run Pioneer CDJs — so this
is the one gap where the tool choice was forced. Three facts, each verified on
this workstation:

**1. There is no adoptable Rekordbox MCP.** The npm registry returns only
*libraries* for `rekordbox` — `rekordbox-parser`, `rekordbox-connect`,
`rbox-js`, `rekordbox-js`, `rekordxml`, `onelibrary-connect` — none of which
is an MCP server. The two candidates that did exist are unsuitable:
`mcp-dj` (darav-t, ★6) ships an installer that edits *other tools'* global
config, and `dj-setbox` writes cues. `serato-dj-mcp` reads Serato, which this
DJ does not use. **Conclusion: the Rekordbox gap cannot be closed by adopting
an MCP.** It has to be closed by our own code — which is the Rust-first
answer anyway.

**2. The local `master.db` is encrypted.** Rekordbox 6/7 stores its library in
`%APPDATA%\Pioneer\Rekordbox\master.db` (379 MB here, with `-wal`/`-shm`
sidecars). The first bytes are `77 82 f1 a3 f1 52 9b a0 …`, **not**
`SQLite format 3` — the file is encrypted, so `rusqlite` cannot open it and no
amount of SQL will read it. `pyrekordbox` (0.5.0 on PyPI, Python ≥ 3.11, **not
installed here**) decrypts it, but that is a Python dependency with its own
format-coupling risk, and it is not how a Rust-first project should read the
DJ's library.

**3. The readable interchange format is the XML export.** Rekordbox's
`File → Export → XML` writes `rekordbox.xml` — a plain, documented, stable
document containing every track (`<TRACK>` with `Name`, `Artist`, `Album`,
`Genre`, `AverageBpm`, `Tonality`, `Rating`, `Location`, `TotalTime`,
`DateAdded`, `Label`, `Comments`) plus its playlists. It is the format
`pyrekordbox.RekordboxXml` reads, so it is the *de facto* standard. Rekordbox
also writes `masterPlaylists6.xml` (94 KB here) on every save — but that file
is **playlists only**; it references track IDs without carrying their
metadata, so it cannot answer "which tracks have no BPM?".

**What this means for the plan.** The Rekordbox reader is a **Rust binary that
parses the exported XML**, not an MCP server. Two consequences:

- It cannot be written blind. Without an export on this machine, the schema
  mapping would be untestable speculation — so it is **staged** (plan §2.4)
  behind the DJ producing `rekordbox.xml`.
- The `rekordbox` skill (hot, `pyrekordbox`-based) remains the right tool for
  the questions that need the *encrypted* database or a USB export — it is
  advisory technique, not a source of truth.

---

## 4. What the skill layer already covers (do not double up)

| Brief's candidate | Already covered by | Verdict |
| ----------------- | ------------------ | ------- |
| `filesystem` | OpenCode's built-in `read` / `write` / `edit` / `grep` / `glob` tools, scoped by the agent permission blocks | skill/tool wins |
| `shell` | OpenCode's `shell` tool + `audio-dj-expert`'s `cargo *` / `pnpm *` / `beets *` / `ffmpeg *` allows | tool wins |
| `git` | `git-advanced-workflows` skill (hot) + `shell` | skill wins |
| `beets` | `beets-music-library-manager-tagger` skill (hot) + `music-library-organizer` (hot) | skill wins |
| `ffmpeg` | `ffmpeg-waveforms-visualization` skill (hot) + `crates/analysis` (the real pipeline) | skill + Rust win |
| `sequential-thinking` | `brainstorming` + `using-superpowers` (both hot) | skill wins |
| `memory` | the shared store `docs/ai/memory/*` + `memory-keeper` (D-001) | **project store wins** |
| browser | `playwright` (hot) + `ui-verification` (hot) + `playwright-cli` (installed) | **covered — Playwright MCP skipped by decision** |
| Serato | nothing (the DJ does not run Serato) | **dropped** |
| Rekordbox | `rekordbox` + `dj-library-organizer` skills (hot), but no *server* | **gap → Rust XML reader** (§3.3) |
| SQLite | nothing | **gap → closed by `dj-query`** (Rust-first, landed) |

**Most of the brief's ten candidates are already covered.** The table below
lists eleven rows because Serato and Rekordbox are scored separately now that
the DJ's software is known. That is the core finding of this audit — and after
the 2026-10-21 pivot, one of the two remaining gaps (the app's own database)
has been closed in Rust, and the other (Rekordbox) cannot be closed by any MCP
at all.

---

## 5. Findings

| ID | Finding | Severity | Where |
| -- | ------- | -------- | ----- |
| **F-1** | The project has **zero MCP configuration**. Everything MCP-related lives in the user's global `opencode.json`, which is untracked, unreviewed and invisible to the team. | Med | §1.1 |
| **F-2** | OpenCode merges a project `opencode.json` **into** the global one and supports a `tools` map that **disables individual MCP tools** — this is the correct enforcement point for "read-only", better than prompt-level politeness. | Info | §1.2 |
| **F-3** | Most of the candidates in the brief are **already covered** by skills, built-in tools, or the Rust crates. Adding them would add context and attack surface for no new capability. | High | §3.1, §4 |
| **F-4** | The **real** gaps were (a) querying the app's own SQLite DB, (b) reading the DJ's real DJ-software library, (c) driving the UI in a browser. (a) is now closed in Rust; (b) cannot be closed by an MCP; (c) was closed by decision. | High | §2 |
| **F-5** | The Rust-first path for gap (a) already had a template: `crates/core/src/bin/scan.rs` (`dj-scan`, `--json`, `cli` feature) and `crates/core/src/library_query.rs` (a parameterised, injection-safe query builder). A `dj-query` binary is a small, read-only, zero-new-dependency win — **and it beats an MCP**, because the answers come from the app's own semantics. | High | §5.1 |
| **F-6** | `pnpm skills:inventory` must **not** be run on a workstation with the `.opencode/skills/` mirror present: it rewrites a tracked file (`skill-manifest.json`) with machine-local `source: "project"` values. | Med | §1.3 |
| **F-7** | `server-memory` would create a **second** memory store, contradicting D-001. `mcp-ffmpeg` exposes `execute_ffmpeg_command` — arbitrary command execution. Both rejected. | High | §3.1 |
| **F-8** | The Playwright MCP was **skipped by maintainer decision**: `playwright-cli` + the `ui-verification` skill already run the same checks inside the Tauri/React stack, and the MCP's per-step tool cost and timeout risk buy no new capability. | Info | §3.1 |
| **F-9** | Every MCP tool is advertised on **every step**. The 240-skill library already costs ~15.4k tokens/step; each added server adds more. Another reason to keep the set to one or two. | Med | §1.3 |
| **F-10** | `docs/enhancements/` already existed (empty) — the two documents in this folder have a home, and `docs/README.md` should index them. | Low | §6 |
| **F-11** | **Rekordbox's `master.db` is encrypted** (header `77 82 f1 a3 …`, not `SQLite format 3`). `rusqlite` cannot read it; only `pyrekordbox` can. Any plan that assumes a direct SQL read of the DJ's library is wrong. | High | §3.3 |
| **F-12** | **No read-only Rekordbox MCP exists.** The npm registry has only libraries (`rekordbox-parser`, `rekordbox-connect`, `rbox-js`, `rekordbox-js`, `rekordxml`, `onelibrary-connect`); the two MCP candidates are unsuitable (`mcp-dj` edits other tools' global config, `dj-setbox` writes cues). The gap must be closed by our own Rust code. | High | §3.3 |
| **F-13** | The stated library path `D:\Music\DJ_Library` **does not exist** on this workstation; the real library is `D:\Music\Music Library` with sets in `D:\Music\My Sets`. Any hard-coded path would break on the first run, so the path stays configurable. | Med | §0 |
| **F-14** | The app DB is **WAL mode**, so a read-only connection can fail when the app is closed (SQLite removed `-wal`/`-shm`). `dj-query` handles this: it falls back to SQLite's `immutable=1` only when the `-wal` is empty, and refuses with an actionable message when the `-wal` still holds content — because then the main file is stale and reading it would silently under-report. | Med | §5.1 |
| **F-15** | The live app DB can be **older than the code** querying it (the library was last opened before the `energy` migration). `dj-query` reads `PRAGMA table_info(tracks)` first and adapts: missing optional columns become `NULL AS <col>`, and a filter or sort that needs a missing column fails with a message that says how to fix it. | Med | §5.1 |

### 5.1 The Rust-first recommendation (the important one)

The brief's own principle — *"if it is heavy audio work, prefer extending
`crates/core` or `crates/analysis` over doing it purely via MCP"* — extends
cleanly to **database inspection**:

- `crates/core/src/library_query.rs` already owns the list-query contract:
  `TrackQuery` → `TrackFilters` → `BuiltQuery` (bound parameters only,
  allow-listed columns/sorts — no SQL interpolation of user input).
- `crates/core/src/bin/scan.rs` already establishes the pattern of a headless,
  Tauri-free CLI binary behind the `cli` feature, with `--json` output.
- The app's DB is a single SQLite file at `%APPDATA%\com.djassistant.desktop\dj_assistant.db`.

A `dj-query` binary reusing that builder gives the agent the app's *own*
semantics for "tracks needing analysis", "tracks in 8A between 122–126 BPM",
"duplicates" — read-only by construction, zero MCP context cost, zero new
dependencies, and unit-testable in `crates/core`.

**Status: landed 2026-10-21.** `crates/core/src/bin/query.rs` → `dj-query`,
behind the existing `cli` feature:

```
dj-query --stats --json
dj-query --bpm-min 122 --bpm-max 126 --key 8A --status needs_review --json
dj-query --check-files            # tracks whose audio file is gone
```

Three properties it had to get right, all verified against the live library on
this workstation:

| Property | How | Why |
| -------- | --- | --- |
| **Read-only** | `SQLITE_OPEN_READ_ONLY`; every statement is a `SELECT` | The agent must never write to the primary DB (D-010) |
| **WAL-safe** | Plain open first; `immutable=1` fallback **only** when the `-wal` is empty; an actionable error when the `-wal` still holds content | A stale main file would silently under-report (F-14) |
| **Schema-tolerant** | `PRAGMA table_info(tracks)` first; missing optional columns become `NULL AS <col>`; a filter/sort needing a missing column fails with a fix-it message | The library DB may predate the newest migration (F-15) |

The summary counts live in `crates/core/src/library_stats.rs` as plain SQL with
no database dependency in `core`, so the statements are unit-tested there and
executed against a real migrated schema in `tests/schema` — the same place the
list-query contract is verified. `library_query::sort_column()` was added so
the CLI can check a column exists *before* building a query, instead of letting
SQLite fail with "no such column".

The read-only SQLite MCP stays the **fallback**, useful only for ad-hoc SQL the
builder does not model yet — and it points at a **snapshot**, never the live DB.

---

## 6. Where the output lives

| Document | Path |
| -------- | ---- |
| This audit | [`docs/enhancements/mcb-plugin-audit.md`](./mcb-plugin-audit.md) |
| The plan | [`docs/enhancements/mcb-plugin-enhancement-plan.md`](./mcb-plugin-enhancement-plan.md) |
| Ready-to-copy config | [`docs/enhancements/mcp.recommended.jsonc`](./mcp.recommended.jsonc) |

`docs/enhancements/` existed but was empty; `docs/README.md` now indexes it and
all three documents.

---

## 7. Open questions — answered 2026-10-21

**Q1. Serato or Rekordbox?** → **Rekordbox.** The setups at Little Buddha and
Arena Beach Club run on Pioneer CDJs, so Rekordbox is the source of truth.
Serato is dropped from the plan entirely; `serato-dj-mcp` reads a library that
does not exist here.

**Q2. Where does the music library live?** → **`D:\Music\DJ_Library`** as
stated by the maintainer. *Verified caveat:* that path does not exist on this
workstation — the library present here is `D:\Music\Music Library` with sets in
`D:\Music\My Sets` (F-13). The path therefore stays **configurable**
(`$DJ_ASSISTANT_MUSIC_LIBRARY`) rather than hard-coded, and the agent's access
is **strictly read-only**: never a write to an audio file, never a write to the
primary database.

**Q3. Is the Playwright MCP worth it?** → **No — skipped.** `playwright-cli`
and the `ui-verification` skill are sufficient inside the Tauri/React stack; the
MCP adds memory overhead and timeout risk without enough added value.

**Q4. Accept the Rust-first `dj-query` binary as the primary answer?** → **Yes
— approved and built.** It shares the exact `library_query` builder with the
UI, eliminates the token bloat of an ad-hoc SQLite MCP, and is read-only by
design. The raw SQLite MCP remains a strictly ad-hoc fallback behind
`DJ_ASSISTANT_DB_SNAPSHOT`.

### 7.1 The one question still open

**Produce the Rekordbox XML export.** The `dj-rekordbox` reader (plan §2.4)
cannot be written or tested without one: Rekordbox's `master.db` is encrypted
(F-11), so the export is the only readable interchange format. In Rekordbox:
**File → Export → XML**, then point the reader at the resulting
`rekordbox.xml`. Until that file exists, the XML schema mapping would be
untestable speculation, so the work stays staged rather than guessed.

---

*Sources resolved on 2026-10-21: npm registry (`registry.npmjs.org`), PyPI JSON
API (`pypi.org/pypi/<pkg>/json`), `modelcontextprotocol/servers` (filesystem
README), `modelcontextprotocol/servers-python` (`mcp-server-git`,
`mcp-server-sqlite` PyPI descriptions), `Venut-Technologies/serato-dj-mcp`
README + compatibility table, `microsoft/playwright-mcp` README, the
`%APPDATA%\Pioneer\Rekordbox\` installation on this machine, and
`opencode.ai/docs/mcp-servers` + `opencode.ai/docs/config`.*
