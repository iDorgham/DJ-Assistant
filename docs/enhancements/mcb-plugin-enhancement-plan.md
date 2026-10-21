# MCB / MCP / Plugin Enhancement Plan — DJ Assistant

**Document type:** Proposal / implementation plan (AI tooling)
**Status:** Proposed — awaiting maintainer review (2026-10-21)
**Scope:** How to give the DJ Assistant agent layer a small, safe, local-only
set of MCP servers ("MCBs"), without breaking the local-first or Rust-first
rules.
**Companion:** [`mcb-plugin-audit.md`](./mcb-plugin-audit.md) (the evidence) ·
[`mcp.recommended.jsonc`](./mcp.recommended.jsonc) (the ready-to-copy config)

> **Status of this document.** Nothing in it is active yet. The config ships
> **disabled**; the project has no `opencode.json` today and this plan does not
> create one without review. See §3.4 and §9.

---

## 1. Summary

### 1.1 Goal

Let the agent answer questions the project currently cannot answer, using
**local-only** servers, **without** creating a second source of truth, a second
memory store, or an always-on service — and without adding context cost to
every session.

Concretely, close three gaps found in the audit:

| Gap | Question the DJ/agent wants answered | Answered by |
| --- | --- | --- |
| G-1 | "How many of my tracks have a key but no BPM? Which are `needs_review`? Which are duplicates?" | **MCB-0** (Rust `dj-query`, preferred) → **MCB-DB** (read-only SQLite MCP, fallback) |
| G-3 | "Does the Library view actually render correctly — focus order, overflow, empty states?" | **MCB-UI** (Playwright MCP, scoped to the app's dev origin) |
| G-2/G-4 | "What does my real Serato library look like versus what DJ Assistant imported?" | **MCB-DJ** (Serato read-only MCP) |

### 1.2 In scope

- A reviewed, **tracked** `opencode.json` template for this repo (all servers
  defined, all **disabled**, all write-capable tools **hard-disabled**).
- A **Rust-first** read-only query CLI (`dj-query`) in `crates/core`, modelled on
  the existing `dj-scan` binary.
- The safety envelope: scopes, allow-lists, read-only enforcement, secrets
  handling, Windows paths.
- The routing story: which skills/subagents own this work.

### 1.3 Non-goals

- **Not** a plugin. `.opencode/plugins/` stays empty (D-002).
- **Not** a cloud dependency. No server in this plan needs a hosted service to
  function; the one network-capable candidate (Context7) is deferred.
- **Not** a replacement for the product Skills in
  `docs/architecture/SKILLS_SYSTEM.md`. An MCP is a *tool surface for the
  agent*, never an app feature.
- **Not** new analysis capability. BPM/key/waveform work stays in
  `crates/analysis` (Rust-first). No MCP in this plan analyses audio.
- **Not** a second memory store. `docs/ai/memory/*` remains the only one (D-001).
- **Not** editing the user's global `~/.config/opencode/opencode.json`, and not
  editing any other tool's global config.

### 1.4 Strategy in one line

> **Prefer the existing skills and the Rust crates; add an MCP only where it
> closes a real gap; ship it disabled, scoped, and read-only.**

---

## 2. Recommended MCBs

An **MCB** here is a named bundle of MCP servers configured together for one
job. OpenCode has no MCB primitive — the bundle is a shared prefix in the
server names plus one section of `opencode.json`, so it can be switched as a
unit.

### 2.1 Decision table

| MCB | Server key | Source | Purpose | Risk | Local only? | Enabled by default? |
| --- | ----------- | ------ | ------- | ---- | ----------- | ------------------- |
| **MCB-0** · Rust core (no MCP) | — | **local** (`crates/core`, `dj-assistant-core` crate) | `dj-query` CLI over the app's own SQLite using the existing `library_query` builder — read-only by construction, app-identical semantics | **Low** | **Yes** | **Yes** (it is just a binary) |
| **MCB-DB** · Library inspector | `dj-db` | **uvx** (PyPI `mcp-server-sqlite==2025.4.25`) | Ad-hoc SQL over a **snapshot copy** of the app DB when `dj-query` does not model the question | **Low** (writes hard-disabled) | **Yes** | **No** |
| **MCB-UI** · UI probe | `dj-ui` | **npm** (`@playwright/mcp@0.0.83`, pinned) | Drive the app's own UI at `http://localhost:1420` in browser mode (the app has a mock-IPC fallback) to verify focus, overflow, empty states | **Low** | **Yes** | **No** |
| **MCB-DJ** · Serato bridge | `dj-serato` | **npm** (`serato-dj-mcp@0.1.1`, pinned) | Read the DJ's real Serato library: crates, BPM + Camelot harmonic search, duplicate/missing-file audit — to cross-check the app's import | **Medium** (Windows untested upstream) | **Yes** | **No** |

Rejected or deferred (full matrix in the audit): `filesystem` (write-capable,
duplicates built-ins), `git` (duplicates shell + skill), `shell` (already a
tool), `ffmpeg` (exposes `execute_ffmpeg_command` — arbitrary execution),
`sequential-thinking` (no new capability), `server-memory` (would fork the
memory store — D-001), `context7` (network), `musicbrainz-mcp` (the app already
owns MusicBrainz enrichment), `mcp-dj` / `dj-setbox` (unofficial, write
capability), `mcp-everything` (a test fixture).

### 2.2 MCB-0 — Rust-first, no MCP *(recommended primary)*

**Why.** G-1 is a *library-query* problem, and the repo already owns the answer:

- `crates/core/src/library_query.rs` — `TrackQuery` → `TrackFilters` →
  `BuiltQuery`. Parameterised values, allow-listed columns and sort keys, no
  SQL interpolation. Tauri-free and unit-tested.
- `crates/core/src/bin/scan.rs` — the precedent: a headless binary
  (`dj-scan`) behind the `cli` feature, `--json` output, no GUI, no Tauri.
- The DB is one file: `%APPDATA%\com.djassistant.desktop\dj_assistant.db`.

**Shape.** A sibling binary `crates/core/src/bin/query.rs` → `dj-query`:

```
dj-query --db <path> --bpm-min 122 --bpm-max 126 --key 8A --status pending --json
dj-query --db <path> --stats            # counts: total, by analysis_status, missing bpm/key, duplicates
```

Read-only by construction (open with `SQLITE_OPEN_READ_ONLY`), zero new
dependencies (`rusqlite` is already an optional dep behind the `cli` feature),
zero MCP context cost, and the answers come from **the same builder the UI
uses**, so the agent and the app never disagree.

**Why this beats the SQLite MCP.** The MCP would run raw SQL against the live
schema; the binary speaks the app's contract. The MCP's only advantage is
ad-hoc SQL for questions `dj-query` does not model — which is why it stays as
the fallback, not the primary.

**Effort.** Small: one file, one `[[bin]]` entry, reuses `rusqlite` and the
query builder, plus tests in `crates/core`.

### 2.3 MCB-DB — read-only SQLite fallback

**What.** `uvx mcp-server-sqlite==2025.4.25 --db-path <snapshot>`.

**Safety.** Three independent guards:

1. **Snapshot, not the live DB.** Point it at a copy produced from the live DB
   (SQLite online backup / file copy while the app is closed). The agent can
   never corrupt the library the DJ depends on, and no write reaches the app's
   DB even if every guard failed.
2. **Write tools disabled in the config**, not by convention:
   ```jsonc
   "tools": { "dj-db_write_query": false, "dj-db_create_table": false }
   ```
3. **`read_query` only** in practice — `write_query` / `create_table` /
   `append_insight` are the server's mutating surface and all three are off.

**Risk.** Low. **Local.** Yes. **Rollback:** delete the `dj-db` block.

### 2.4 MCB-UI — Playwright MCP, scoped to the app

**What.** `npx -y @playwright/mcp@0.0.83 --allowed-origins http://localhost:1420 --isolated --headless`.

**Why it fits this repo specifically.** `apps/desktop/src-tauri/tauri.conf.json`
sets `devUrl: http://localhost:1420`, and
`apps/desktop/src/services/api.ts` falls back to **mock IPC** when
`__TAURI_INTERNALS__` is absent. So the real React UI *does* run in a plain
browser — meaning browser-driven checks of focus order, overflow, empty states
and the design system are possible without a Tauri build.

**Safety.** `--allowed-origins` restricts the browser to the app's own origin
(`--allowed-origins` is a trusted-origin list, **not** a hard sandbox — treat
it as scoping, not containment). `--isolated` keeps the profile in memory, so
no cookies or storage land on disk. The page still reaches the network for
whatever the app calls, so this is not a network-isolated environment.

**Risk.** Low. **Local.** Yes. **Cost.** The browser tool adds to every step's
tool list — enable it only when a UI task is actually in play, and disable it
globally with `"tools": { "dj-ui_*": false }` otherwise.

**Alternative that needs no MCP:** the `playwright` and `ui-verification`
skills are already hot, and `playwright-cli` is installed. The MCP's only
advantage is that the *model* gets the browser, not a human running a CLI.

### 2.5 MCB-DJ — Serato read-only bridge

**What.** `npx -y serato-dj-mcp@0.1.1 --library "<serato folder>" --cache-dir <cache> --state-dir <state>`.
**No** `--allow-writes`, **no** `--allow-raw-sql`.

**Why.** Closes G-2 and G-4: it reads the DJ's *actual* Serato library (crates,
BPM, Camelot key) so the agent can reconcile it against DJ Assistant's own
import — missing files, tracks with no BPM/key, crates that reference tracks the
app never saw.

**Safety.** The server is **read-only by default**: every read goes through a
**snapshot copy** in `--cache-dir`, so a question cannot change the library.
Writes require `--allow-writes`, which this plan never enables.

**Windows caveat (material).** Upstream states Windows is **untested**: there
is no Windows-specific path discovery (pass `--library` explicitly), the cache
and state directories default to macOS-style paths (pass Windows ones
explicitly), and the "is Serato running" check uses `ps`, which Windows lacks —
so `apply_changes` would refuse to write anyway. With writes off, the read path
is expected to work, but **this must be smoke-tested on this workstation before
anyone relies on it** (see §7.2).

**Risk.** Medium. **Local.** Yes. **Note.** The Rekordbox equivalent is
deliberately deferred: the `rekordbox` skill (pyrekordbox) already covers
USB-export and analysis-coverage audits, and the available Rekordbox MCPs are
0–6★ with write capability.

---

## 3. Proposed config

### 3.1 Where it goes

| File | Tracked? | Purpose |
| ---- | -------- | ------- |
| `docs/enhancements/mcp.recommended.jsonc` | ✅ | The reviewed template, commented, with `{env:…}` placeholders. **This is the artefact.** |
| `opencode.json` (repo root) | ✅ | The **live** config — created only after review, as a copy of the template with the servers you choose to enable |
| `~/.config/opencode/opencode.json` | ❌ (user-global) | **Untouched.** The user's `mcp.pencil` entry stays as it is; the project config *merges* with it |

OpenCode merges configs rather than replacing them
(`remote → global → custom → project → .opencode → inline`), so a project
`opencode.json` **adds** to the global one and never removes the user's
`pencil` server.

### 3.2 The template

[`docs/enhancements/mcp.recommended.jsonc`](./mcp.recommended.jsonc) — copy it
verbatim to `opencode.json` at the repo root, then follow §3.3.

**On secret syntax.** OpenCode resolves environment variables with
`{env:VARIABLE_NAME}` (and file contents with `{file:path/to/file}`); an unset
variable becomes an empty string. Shell-style `${VAR}` is **not** substituted
by OpenCode — it would be passed through literally. The template therefore uses
`{env:…}` for everything, which is also what keeps the file free of secrets.

### 3.3 Activation checklist

1. Copy `mcp.recommended.jsonc` → `opencode.json` at the repo root.
2. Set the environment variables the servers you want need (below).
3. Flip `"enabled": false` → `true` for that server. **One server at a time.**
4. Verify: `opencode mcp list`, then ask the server a read-only question.

| Server | Environment variable | Meaning | Example (Windows) |
| ------ | -------------------- | ------- | ------------------ |
| `dj-db` | `DJ_ASSISTANT_DB_SNAPSHOT` | Path to a **copy** of the app DB | `%APPDATA%\com.djassistant.desktop\dj_assistant.db` copied to `%TEMP%\dj-assistant-snapshot.db` |
| `dj-serato` | `DJ_ASSISTANT_SERATO_LIBRARY`, `DJ_ASSISTANT_SERATO_CACHE`, `DJ_ASSISTANT_SERATO_STATE` | Serato folder, cache dir, state dir | `D:\Music\_Serato_`, `%LOCALAPPDATA%\dj-assistant\serato-cache`, `%LOCALAPPDATA%\dj-assistant\serato-state` |
| `dj-ui` | *(none)* | — | — |
| `dj-docs` (deferred) | `DJ_ASSISTANT_MCP_TOKEN` | Optional Context7 API key | — |

> The DB snapshot should be produced with SQLite's **online backup** (or by
> copying while the app is closed), never by copying a live WAL database
> mid-write. Until `scripts/snapshot-db.py` exists (mirroring
> `scripts/inspect-db.py`), do it by hand.

### 3.4 Why everything ships disabled

| Reason | Detail |
| ------ | ------ |
| Review | A tracked `opencode.json` activates code for every collaborator on their next session. It should land after the maintainer has read it. |
| Portability | The DB snapshot path and the Serato library path are per-machine. `{env:…}` placeholders are empty on a fresh clone, so an enabled-but-unconfigured server would fail to start. |
| Context | Every MCP tool is advertised on **every step**. The skill library already costs ~15.4k tokens/step; a fleet of servers is a tax paid for a feature you may not use today. |
| Precedent | The project has **no** MCP config today. The first one should be opt-in. |

Disabling is a one-word edit; enabling is the same edit in reverse. That
symmetry is the whole rollback story.

---

## 4. Plugin strategy

### 4.1 The rule

**No plugin. Not now, not later, not globally.**

`docs/ai/memory/decisions.md` → **D-002**: a file under `.opencode/plugins/`
makes OpenCode drop the discovered skills from the model list. `AGENTS.md`
repeats the ban. The global `~/.config/opencode/plugins/` holds one unrelated
plugin and is outside this repo's remit — **never edited from a repo task**.

### 4.2 What we do instead, in order of preference

| Mechanism | Use it for | Concrete action |
| --------- | ---------- | --------------- |
| **Skills** (already installed, already hot) | Technique the model should apply | None needed — the DJ domain, Tauri, Rust and Playwright skills are all hot already |
| **Subagents** (`.opencode/agents/`) | A specialist that owns a domain | Extend `audio-dj-expert`'s remit if `dj-query` lands: it already owns `crates/core/**` and `crates/analysis/**` and already allows `cargo *` |
| **Commands** (`.opencode/commands/`) | A repeatable operator action | Optional: a `/dj-query` command that wraps the binary for humans |
| **Registry** (`agents.registry.json`) | Routing data — keywords, owned paths, verify groups | Add `dj-query`, `library query`, `library stats` to `audio-dj-expert`'s keywords **if** the binary lands |
| **Memory** (`docs/ai/memory/*`) | Durable decisions and facts | One new line in `decisions.md` (this plan) |
| **MCP** | A capability that genuinely does not exist yet | The three servers in §2 |

### 4.3 If a plugin ever becomes necessary

The ban is scoped to `.opencode/plugins/` **in this workspace**. If a future
OpenCode release fixes the skill-drop regression, D-002 says so explicitly —
revisit then, and only then. Until then: instructions, commands, subagents.

---

## 5. Skill policy

### 5.1 No change to `hot` — recommended

`skills.policy.json` needs **no edit** to support this plan:

| Need | Already covered? |
| ---- | ---------------- |
| DJ domain technique | ✅ 9 hot skills: `music-analyzer`, `beets-music-library-manager-tagger`, `music-library-organizer`, `dj-library-curator`, `dj-library-organizer`, `dj-set-architect`, `dj-mix-documentarian`, `rekordbox`, `ffmpeg-waveforms-visualization` |
| Rust work in `crates/core` | ✅ `rust-best-practices` (hot), `sql-optimization-patterns` (hot) |
| Tauri shell | ✅ 10 hot Tauri skills |
| UI verification | ✅ `playwright`, `ui-verification`, `playwright-cli` (installed) |
| Python tooling for `uvx` servers | ✅ `uv-package-manager` (hot), `python-code-style` (hot) |

The `triggers` map already routes `beatgrid`, `bpm`, `serato`, `rekordbox`,
`beets`, `id3`, `usb export`, `set sheet`, `harmonic mixing`, `sqlite`,
`rusqlite`, `pragma`, `sql`, `waveform`, `spectrum` to the right skills.

**No new skill is installed by this plan, so `docs/ai/SKILLS.md` does not
change either.**

### 5.2 One optional trigger addition — deferred, and free

Only if `dj-query` lands, add to `skills.policy.json` → `triggers`:

```jsonc
"library query": ["sql-optimization-patterns", "rust-best-practices"],
"library stats": ["sql-optimization-patterns", "rust-best-practices"],
```

*Justification.* Without it, the phrase "query the library" matches no curated
trigger and falls to the lexical pass, which is weaker than the hand-mapped
ones.
*Why it is safe.* `triggers` are read at **match time** from
`skills.policy.json` (`scripts/skills/lib.mjs` → `match.mjs`); the generated
manifest (`keywords`) comes from each skill's frontmatter, and
`SKILL_ROUTING.md` does not render triggers. So this edit changes **no
generated artefact** — no regeneration required.

### 5.3 Do not run `pnpm skills:inventory` on this workstation

With the gitignored `.opencode/skills/` mirror present, `pnpm skills:inventory`
rewrites every manifest entry to `source: "project"` / `overridden: "global"` —
machine-local state inside a **tracked** file (recorded in
`docs/ai/memory/facts.md`). The manifest is currently in the clean
`source: "global"` state. If a policy edit is ever made, regenerate **from a
clean checkout**, or commit the manifest churn deliberately.

---

## 6. Safety model

### 6.1 Layers (defence in depth)

```
1. Config layer   enabled: false by default; write-capable tools disabled via "tools"
2. Tool layer     OpenCode's tools map — dj-db_write_query, dj-db_create_table, dj-db_append_insight = false
3. Data layer     dj-db sees a SNAPSHOT, never the live DB
4. Scope layer    dj-ui limited to --allowed-origins http://localhost:1420; --isolated profile
5. App layer      no MCP may write to the app's DB, the music library, or the crates
6. Prompt layer   AGENTS.md + the agent prose state the local-first rules (weakest; belt, not braces)
```

### 6.2 Filesystem scopes

| Path | Agent access | Rationale |
| ---- | ------------ | --------- |
| Repo tree | The built-in `read`/`edit`/`grep`/`glob` tools, already scoped by the per-agent permission blocks | No filesystem MCP. See audit §3.1 |
| App DB (`%APPDATA%\com.djassistant.desktop\`) | **Read-only via a snapshot copy only** | The live DB belongs to the running app |
| Music library folder | **No MCP access at all** | Scanning is the Rust app's job (`crates/core` → `discover_audio_files`) |
| Serato library | Read-only, via `serato-dj-mcp`'s own snapshot in `--cache-dir` | The server never writes without `--allow-writes` |
| Serato cache/state dirs | Writable by the server (they are its scratch space) | Point them at `%LOCALAPPDATA%\dj-assistant\…`, never at the library |

If a filesystem MCP is ever added, the allow-list is **directories as CLI
arguments** (the only method that works on every protocol version), and **never**
`C:\` or `%USERPROFILE%`.

### 6.3 Shell allow-lists

The agent permission blocks are the enforcement point for shell access, and they
already exist in `.opencode/agents/*.md`:

| Agent | Allowed shell | Denied |
| ----- | -------------- | ------ |
| `audio-dj-expert` | `cargo *`, `pnpm *`, `beets *`, `ffmpeg *`, `node scripts/agent/*` | everything else (catch-all deny first) |
| `tauri-expert` | `cargo *`, `pnpm *` | everything else |

**Adding an MCP must not widen these.** In particular, the `dj-ui` MCP does not
grant the agent arbitrary browser navigation beyond the app origin, and no MCP
in this plan grants `ffmpeg`, `beets` or `python` shell rights that the agent
does not already have. Per D-008, permission blocks currently record intent
rather than gate — so the **config-level** guards in §6.1 layers 1–2 are the
ones that actually bind.

### 6.4 Read-only, enforced where it matters

| Surface | Enforcement |
| ------- | ----------- |
| `dj-db` | Snapshot copy + `tools` map disabling `write_query` / `create_table` / `append_insight` |
| `dj-serato` | Upstream default: read-only; `--allow-writes` and `--allow-raw-sql` omitted |
| `dj-ui` | No write surface; `--isolated` keeps no state on disk |
| `dj-query` (Rust) | Open the SQLite file with `SQLITE_OPEN_READ_ONLY` — read-only by construction |
| The live app DB | Not reachable by any MCP in this plan |

### 6.5 No auto-exec of network calls

- No MCP in this plan requires a hosted service.
- `dj-ui` may load remote assets the app itself requests — that is the app's
  behaviour, not the MCP's.
- Context7 (`dj-docs`) is **deferred**: it is a third-party network service, and
  the repo's local-first posture does not extend to a mandatory doc fetch. It
  stays out of the default template's enabled set.
- MusicBrainz enrichment stays inside the app (`crates/core/src/enrichment.rs`),
  which already owns the rate-limit handling. A second client would double the
  traffic against a 1 req/s API.

### 6.6 Secrets

- The tracked config contains **no secret** — only `{env:…}` placeholders.
- No token is needed by any recommended server. `DJ_ASSISTANT_MCP_TOKEN` appears
  only for the **deferred** Context7 server.
- `docs/ai/memory/*` must never receive a key (they are re-sent to every tool,
  every session).

### 6.7 Windows notes

| Item | Note |
| ---- | ---- |
| `uvx` | On PATH here (`C:\Python\Scripts\uvx.exe`). `uvx` resolves `.exe` fine for a stdio spawn. |
| `npx` | `npx -y <pkg>@<pinned>` avoids the interactive install prompt. Pin the version — it is a supply-chain control, and this repo's CI doc pins dependencies for the same reason. |
| Paths | Use `\` or forward slashes consistently in JSON; quote them. Serato's own README shows doubled backslashes in JSON (`D:\\Music\\_Serato_`). |
| `ps` | `serato-dj-mcp` uses `ps` for its "is Serato running" check — absent on Windows. Read-only mode is unaffected; `--allow-writes` is off. |
| Node | `@modelcontextprotocol/server-filesystem` needs Node ≥ 24 (this machine: 24.3.0) — relevant only if that server is ever added. |
| Playwright | The Playwright MCP downloads its own browser build; Playwright 1.64.1 is already present via `npx`. |
| Long paths | Windows `MAX_PATH` can bite on deep music folders — the Rust scanner is unaffected, an MCP directory walk is not. |

---

## 7. Testing plan

### 7.1 Repository gates (unchanged by this plan)

```bash
pnpm agent:preflight '<task>'     # routing brief
pnpm lint                         # eslint + prettier(root) + per-package lint
pnpm typecheck
pnpm test                         # vitest + agent tests
pnpm rust:fmt                     # cargo fmt --all --check
pnpm rust:clippy                  # cargo clippy --all-targets -- -D warnings
pnpm rust:test:portable           # ONNX runtime may be unavailable on this box
```

Docs-only changes in this plan are covered by `pnpm lint:root`
(`prettier --check` over root `*.md` and `*.json`).

### 7.2 MCP smoke tests (per server, before enabling it)

| Server | Test | Pass criterion |
| ------ | ---- | -------------- |
| `dj-db` | `opencode mcp list` → server connected; ask it to `read_query` `SELECT count(*) FROM tracks` | Count matches `scripts/inspect-db.py`; the write tools are **absent** from the tool list |
| `dj-ui` | Start `pnpm dev:desktop`, then ask it to open `http://localhost:1420` and read the Library heading | The app renders (mock IPC path); the browser stays on the allowed origin; no profile written to disk |
| `dj-serato` | `opencode mcp list` → connected; ask it to `list_libraries` / `list_crates` | It returns the DJ's real crates; **the live library file's mtime is unchanged** afterwards |
| any | Ask the agent to run a write tool | The tool is not offered (disabled in the `tools` map) |

### 7.3 Regression checks

- `pnpm agent:doctor` — the agent layer is unchanged by this plan; it must stay
  clean.
- `git diff --stat` — only `docs/enhancements/*` (and, if approved,
  `opencode.json`) should appear. Nothing under `.opencode/`, `crates/`, or
  `apps/` changes in Phase 1.
- Verify the merge behaviour: with the project `opencode.json` present, the
  user's global `mcp.pencil` must still be listed by `opencode mcp list`.

---

## 8. Rollback

Each addition is independently reversible, in increasing order of effort.

| # | Change | Rollback | Time |
| - | ------ | -------- | ---- |
| R-1 | `opencode.json` added at the repo root | `git rm opencode.json` (or delete the file) | seconds |
| R-2 | One MCP server enabled | Set `"enabled": false` for it — no file deletion, no restart of the app | seconds |
| R-3 | `dj-db` write tools disabled | Remove the two `tools` entries — **do not** do this; it is the safety net | seconds |
| R-4 | A server's tools disabled globally | Remove the `"dj-ui_*": false` style entry | seconds |
| R-5 | Environment variables set | Delete them from the shell profile | seconds |
| R-6 | `dj-query` Rust binary added | `git rm crates/core/src/bin/query.rs` + drop the `[[bin]]` entry from `crates/core/Cargo.toml` | minutes |
| R-7 | `skills.policy.json` trigger added | Delete the two trigger lines | seconds |
| R-8 | `docs/ai/memory/decisions.md` entry | **Append a superseding entry** — never edit an old one (the ledger's rule) | seconds |
| R-9 | Everything | `git revert` the commit | minutes |

**Blast radius.** Every server here is opt-in and local. The worst case of
enabling all three: an extra Python process, an extra Node process, and a
browser instance — all reading local data, none writing to the app, the
library, or the crates.

---

## 9. Sequencing

| Phase | Work | Gate |
| ----- | ---- | ---- |
| **1** *(this plan)* | Audit + plan + `mcp.recommended.jsonc` + one `decisions.md` line | Maintainer review |
| **2** | `dj-query` Rust binary + tests + `audio-dj-expert` keyword/registry update | `pnpm rust:fmt`, `rust:clippy`, `rust:test:portable`, `pnpm lint` |
| **3** | Create the tracked `opencode.json` **with every server disabled** | `opencode mcp list` shows the servers defined but off; `pnpm lint` |
| **4** | Enable `dj-db` on one machine, with a snapshot | §7.2 smoke test |
| **5** | Enable `dj-ui` | §7.2 smoke test |
| **6** | Enable `dj-serato` — **only after the Windows read-path smoke test passes** | §7.2 smoke test; revert if the live library's mtime changes |
| **7** | Optional: `dj-docs` (Context7) if the maintainer accepts a network doc service | §6.5 |

---

*Evidence for every claim in this plan is in
[`mcb-plugin-audit.md`](./mcb-plugin-audit.md). Package versions were resolved
against the npm registry and PyPI on 2026-10-21.*
