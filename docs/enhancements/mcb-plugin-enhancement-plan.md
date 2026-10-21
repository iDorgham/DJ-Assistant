# MCB / MCP / Plugin Enhancement Plan — DJ Assistant

**Document type:** Proposal / implementation plan (AI tooling)
**Status:** **Approved in part** — 2026-10-21
**Scope:** How to give the DJ Assistant agent layer a small, safe, local-only
set of MCP servers ("MCBs"), without breaking the local-first or Rust-first
rules.
**Companion:** [`mcb-plugin-audit.md`](./mcb-plugin-audit.md) (the evidence) ·
[`mcp.recommended.jsonc`](./mcp.recommended.jsonc) (the ready-to-copy config)

> **Status of this document.** The maintainer answered the four open questions
> in the audit on 2026-10-21: **Rekordbox** is the source of truth, **Serato is
> dropped**, the **Playwright MCP is skipped**, and the **Rust `dj-query` CLI is
> approved as the primary** library-query path.
>
> - **MCB-0 (`dj-query`) is built and working** (§2.2).
> - **MCB-DB (`dj-db`) stays the ad-hoc fallback**, behind a DB snapshot.
> - **MCB-DJ is now a Rust Rekordbox XML reader**, not an MCP — and it is
>   **staged** until the DJ produces an export (§2.4).
> - **MCB-UI (Playwright MCP) is removed.**
>
> The MCP config still ships **disabled**; the project has no `opencode.json`
> today and this plan does not create one without review. See §3.4 and §9.

---

## 1. Summary

### 1.1 Goal

Let the agent answer questions the project currently cannot answer, using
**local-only** servers, **without** creating a second source of truth, a second
memory store, or an always-on service — and without adding context cost to
every session.

Concretely, close the gaps found in the audit:

| Gap | Question the DJ/agent wants answered | Answered by | State |
| --- | --- | --- | --- |
| G-1 | "How many of my tracks have a key but no BPM? Which are `needs_review`? Which are duplicates?" | **MCB-0** (Rust `dj-query`) → **MCB-DB** (read-only SQLite MCP, fallback) | **built** |
| G-2/G-4 | "What does my real **Rekordbox** library look like versus what DJ Assistant imported?" | **MCB-DJ** (Rust `dj-rekordbox`, reads the exported XML) | **staged** — needs the DJ's export |
| G-3 | "Does the Library view actually render correctly — focus order, overflow, empty states?" | `playwright-cli` + the `ui-verification` skill — **no MCP** | **closed by decision** |

### 1.2 In scope

- A reviewed, **tracked** `opencode.json` template for this repo (all servers
  defined, all **disabled**, all write-capable tools **hard-disabled**).
- A **Rust-first** read-only query CLI (`dj-query`) in `crates/core`, modelled on
  the existing `dj-scan` binary.
- A **Rust-first** read-only Rekordbox XML reader (`dj-rekordbox`) — the
  replacement for the dropped Serato bridge.
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
- **Not** a browser-driving MCP. The Playwright MCP was skipped (audit §3.1).
- **Not** anything Serato. The DJ runs Rekordbox.
- **Not** a write path. No tool in this plan may write to an audio file, to the
  music library, or to the primary database (D-010).

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
| **MCB-0** · Rust core (no MCP) | — | **local** (`crates/core`, `dj-assistant-core` crate) | `dj-query` CLI over the app's own SQLite using the existing `library_query` builder — read-only by construction, app-identical semantics | **Low** | **Yes** | **Yes** (it is just a binary) — **built 2026-10-21** |
| **MCB-DB** · Library inspector | `dj-db` | **uvx** (PyPI `mcp-server-sqlite==2025.4.25`) | Ad-hoc SQL over a **snapshot copy** of the app DB when `dj-query` does not model the question | **Low** (writes hard-disabled) | **Yes** | **No** |
| **MCB-DJ** · Rekordbox reader | — | **local** (`crates/core`, `dj-assistant-core` crate) | `dj-rekordbox` CLI over the DJ's exported `rekordbox.xml` — the authoritative BPM/key/rating/playlist source to reconcile against the app's import | **Low** (read-only file parse) | **Yes** | **Yes** (it is just a binary) — **staged, needs the export** |

**MCB-UI is gone.** The Playwright MCP was skipped by maintainer decision
(audit §3.1, F-8): `playwright-cli` and the hot `ui-verification` skill already
run the same checks inside the Tauri/React stack.

Rejected or deferred (full matrix in the audit): `filesystem` (write-capable,
duplicates built-ins), `git` (duplicates shell + skill), `shell` (already a
tool), `ffmpeg` (exposes `execute_ffmpeg_command` — arbitrary execution),
`sequential-thinking` (no new capability), `server-memory` (would fork the
memory store — D-001), `context7` (network), `musicbrainz-mcp` (the app already
owns MusicBrainz enrichment), `mcp-dj` / `dj-setbox` (unofficial, write
capability), `mcp-everything` (a test fixture), `serato-dj-mcp` (the DJ does not
run Serato), `@playwright/mcp` (skipped by decision).

### 2.2 MCB-0 — Rust-first, no MCP *(approved, built 2026-10-21)*

**Why.** G-1 is a *library-query* problem, and the repo already owns the answer:

- `crates/core/src/library_query.rs` — `TrackQuery` → `TrackFilters` →
  `BuiltQuery`. Parameterised values, allow-listed columns and sort keys, no
  SQL interpolation. Tauri-free and unit-tested.
- `crates/core/src/bin/scan.rs` — the precedent: a headless binary
  (`dj-scan`) behind the `cli` feature, `--json` output, no GUI, no Tauri.
- The DB is one file: `%APPDATA%\com.djassistant.desktop\dj_assistant.db`.

**Shape.** A sibling binary `crates/core/src/bin/query.rs` → `dj-query`:

```
dj-query --stats --json                 # total, analysed, by status, missing bpm/key, duplicates
dj-query --bpm-min 122 --bpm-max 126 --key 8A --status needs_review --json
dj-query --check-files                  # tracks whose audio file is gone
dj-query --db <path> --sort energy --dir desc --limit 20
```

Read-only by construction (open with `SQLITE_OPEN_READ_ONLY`), zero new
dependencies (`rusqlite` is already an optional dep behind the `cli` feature),
zero MCP context cost, and the answers come from **the same builder the UI
uses**, so the agent and the app never disagree.

**Why this beats the SQLite MCP.** The MCP would run raw SQL against the live
schema; the binary speaks the app's contract. The MCP's only advantage is
ad-hoc SQL for questions `dj-query` does not model — which is why it stays as
the fallback, not the primary.

**Status: built and verified 2026-10-21.** `crates/core/src/bin/query.rs`
(`[[bin]] name = "dj-query"`, `required-features = ["cli"]`), plus
`crates/core/src/library_stats.rs` for the summary statements (plain SQL, no
database dependency in `core`, so they are unit-tested there and executed
against a real migrated schema in `tests/schema`). Two properties were
non-obvious and are covered by tests:

- **WAL-safe** — the app DB is in WAL mode, so a plain read-only open can fail
  when the app is closed. The CLI falls back to SQLite's `immutable=1` **only**
  when the `-wal` is empty, and refuses with an actionable message when the
  `-wal` still holds content — reading a stale main file would silently
  under-report.
- **Schema-tolerant** — the library DB can predate the newest migration.
  `dj-query` reads `PRAGMA table_info(tracks)` first: a missing optional column
  becomes `NULL AS <col>`, and a filter or sort that needs a missing column
  fails with a message saying how to fix it.

**Effort.** Spent: one file, one `[[bin]]` entry, reuses `rusqlite` and the
query builder, plus tests in `crates/core` and `tests/schema`.

### 2.3 MCB-DB — read-only SQLite fallback

**What.** `uvx mcp-server-sqlite==2025.4.25 --db-path <snapshot>`.

**Safety.** Three independent guards:

1. **Snapshot, not the live DB.** Point it at a copy produced from the live DB
   (SQLite online backup / file copy while the app is closed). The agent can
   never corrupt the library the DJ depends on, and no write reaches the app's
   DB even if every guard failed.
2. **Write tools disabled in the config**, not by convention:
   ```jsonc
   "tools": {
     "dj-db_write_query": false,
     "dj-db_create_table": false,
     "dj-db_append_insight": false
   }
   ```
3. **`read_query` only** in practice — `write_query` / `create_table` /
   `append_insight` are the server's mutating surface and all three are off.

**Risk.** Low. **Local.** Yes. **Rollback:** delete the `dj-db` block.

### 2.4 MCB-DJ — Rekordbox read-only reader (Rust, staged)

**What.** A sibling binary `crates/core/src/bin/rekordbox.rs` → `dj-rekordbox`,
parsing the DJ's exported `rekordbox.xml`:

```
dj-rekordbox --xml <path> --stats          # track count, by BPM/key coverage, by genre
dj-rekordbox --xml <path> --playlists      # playlists and their track counts
dj-rekordbox --xml <path> --missing-bpm    # tracks Rekordbox knows but the app has no BPM for
dj-rekordbox --xml <path> --json
```

**Why a binary and not an MCP.** Three verified facts (audit §3.3):

1. **No adoptable Rekordbox MCP exists.** npm has only *libraries*
   (`rekordbox-parser`, `rekordbox-connect`, `rbox-js`, `rekordbox-js`,
   `rekordxml`, `onelibrary-connect`). `mcp-dj` edits other tools' global
   config; `dj-setbox` writes cues.
2. **Rekordbox's `master.db` is encrypted** (header `77 82 f1 a3 …`, not
   `SQLite format 3`), so `rusqlite` cannot read the DJ's library directly.
3. **The XML export is the readable interchange format** — a documented, stable
   document with every track's metadata and the playlists.

A Rust reader also keeps the project dependency-free (no `pyrekordbox` Python
side-car) and matches the Rust-first rule.

**Safety.** Read-only file parse. The reader opens the XML **read-only** and
never writes to the library, the export, or the app's database. It resolves
track locations against the music library **read-only** (it may stat a file to
confirm it still exists; it never opens it for writing, never edits tags).

**Staged — the blocking dependency.** The XML schema mapping cannot be written
or tested without a real export, and the stated library path
`D:\Music\DJ_Library` does not exist on this workstation (the library here is
`D:\Music\Music Library`, sets in `D:\Music\My Sets` — audit F-13). Guessing the
mapping would be untestable speculation. **The work starts when the DJ produces
`rekordbox.xml`** (Rekordbox: *File → Export → XML*). The path is configurable
via `--xml` or `$DJ_ASSISTANT_REKORDBOX_XML`, never hard-coded.

**Risk.** Low. **Local.** Yes. **Fallback.** The hot `rekordbox` skill
(pyrekordbox) remains the right tool for questions that need the *encrypted*
database or a USB export — it is advisory technique, not a source of truth.

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
| `dj-docs` (deferred) | `DJ_ASSISTANT_MCP_TOKEN` | Optional Context7 API key | — |

> The DB snapshot should be produced with SQLite's **online backup** (or by
> copying while the app is closed), never by copying a live WAL database
> mid-write. Until `scripts/snapshot-db.py` exists (mirroring
> `scripts/inspect-db.py`), do it by hand.

**Environment variables for the Rust binaries** (not MCP servers, so they are
not part of the template — but the same convention):

| Variable | Used by | Meaning | Default |
| -------- | ------- | ------- | ------- |
| `DJ_ASSISTANT_DB` | `dj-query` | The app's SQLite file | `%APPDATA%\com.djassistant.desktop\dj_assistant.db` |
| `DJ_ASSISTANT_REKORDBOX_XML` | `dj-rekordbox` | The DJ's exported `rekordbox.xml` | — (required) |
| `DJ_ASSISTANT_MUSIC_LIBRARY` | `dj-rekordbox` | The music library root, for existence checks | — (optional) |

> The library path is **configurable on purpose**. `D:\Music\DJ_Library` is the
> maintainer's stated path, but it does not exist on this workstation (the
> library present here is `D:\Music\Music Library`, with sets in
> `D:\Music\My Sets`) — so hard-coding it would break on the first run.

### 3.4 Why everything ships disabled

| Reason | Detail |
| ------ | ------ |
| Review | A tracked `opencode.json` activates code for every collaborator on their next session. It should land after the maintainer has read it. |
| Portability | The DB snapshot path is per-machine. `{env:…}` placeholders are empty on a fresh clone, so an enabled-but-unconfigured server would fail to start. |
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
| **Skills** (already installed, already hot) | Technique the model should apply | None needed — the DJ domain, Tauri and Rust skills are all hot already |
| **Subagents** (`.opencode/agents/`) | A specialist that owns a domain | `audio-dj-expert` already owns `crates/core/**` and `crates/analysis/**` and already allows `cargo *` — it owns `dj-query` and, later, `dj-rekordbox` |
| **Commands** (`.opencode/commands/`) | A repeatable operator action | Optional: a `/dj-query` command that wraps the binary for humans |
| **Registry** (`agents.registry.json`) | Routing data — keywords, owned paths, verify groups | **Done (2026-10-21):** `dj-query`, `library query`, `library stats` added to `audio-dj-expert`'s keywords, so a "query the library" prompt routes to the agent that owns the code |
| **Memory** (`docs/ai/memory/*`) | Durable decisions and facts | **Done (2026-10-21):** `D-010` in `decisions.md` |
| **MCP** | A capability that genuinely does not exist yet | The one remaining server, `dj-db` (§2.3) |

### 4.3 If a plugin ever becomes necessary

The ban is scoped to `.opencode/plugins/` **in this workspace**. If a future
OpenCode release fixes the skill-drop regression, D-002 says so explicitly —
revisit then, and only then. Until then: instructions, commands, subagents.

---

## 5. Skill policy

### 5.1 No change to `hot` — recommended

`skills.policy.json` needs **no change to the `hot` set** to support this plan:

| Need | Already covered? |
| ---- | ---------------- |
| DJ domain technique | ✅ 9 hot skills: `music-analyzer`, `beets-music-library-manager-tagger`, `music-library-organizer`, `dj-library-curator`, `dj-library-organizer`, `dj-set-architect`, `dj-mix-documentarian`, `rekordbox`, `ffmpeg-waveforms-visualization` |
| Rust work in `crates/core` | ✅ `rust-best-practices` (hot), `sql-optimization-patterns` (hot) |
| Tauri shell | ✅ 10 hot Tauri skills |
| UI verification | ✅ `playwright`, `ui-verification`, `playwright-cli` (installed) — **no MCP needed** |
| Python tooling for `uvx` servers | ✅ `uv-package-manager` (hot), `python-code-style` (hot) |

The `triggers` map already routes `beatgrid`, `bpm`, `serato`, `rekordbox`,
`beets`, `id3`, `usb export`, `set sheet`, `harmonic mixing`, `sqlite`,
`rusqlite`, `pragma`, `sql`, `waveform`, `spectrum` to the right skills.

**No new skill is installed by this plan, so `docs/ai/SKILLS.md` does not
change either.**

### 5.2 Trigger additions — applied

`dj-query` has landed, so the conditional in the original plan is met. Added to
`skills.policy.json` → `triggers`:

```jsonc
"library query": ["sql-optimization-patterns", "rust-best-practices"],
"library stats": ["sql-optimization-patterns", "rust-best-practices"],
"query the library": ["sql-optimization-patterns", "rust-best-practices"],
"dj-query": ["sql-optimization-patterns", "rust-best-practices"],
```

*Justification.* Without them, the phrase "query the library" matches no curated
trigger and falls to the lexical pass, which is weaker than the hand-mapped
ones. Both wordings are listed because a trigger is a **literal phrase match**
(`scripts/skills/lib.mjs` → `triggerHits` does a substring test on the
normalised prompt), so "library query" does not match "query the library".

*Why it is safe.* `triggers` are read at **match time** from
`skills.policy.json` (`scripts/skills/lib.mjs` → `match.mjs`); the generated
manifest (`keywords`) comes from each skill's frontmatter, and
`SKILL_ROUTING.md` does not render triggers. So this edit changes **no
generated artefact** — no regeneration required.

*Verified.* `pnpm skills:match "query the library for tracks that still need
analysis"` returns `sql-optimization-patterns` and `rust-best-practices` via
**trigger** (not lexical); `pnpm skills:match "run dj-query --stats"` does the
same.

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
4. Scope layer    dj-rekordbox opens the XML read-only; the music library is read-only
5. App layer      no tool in this plan may write to the app's DB, the music library, or the crates
6. Prompt layer   AGENTS.md + the agent prose state the local-first rules (weakest; belt, not braces)
```

### 6.2 Filesystem scopes

| Path | Agent access | Rationale |
| ---- | ------------ | --------- |
| Repo tree | The built-in `read`/`edit`/`grep`/`glob` tools, already scoped by the per-agent permission blocks | No filesystem MCP. See audit §3.1 |
| App DB (`%APPDATA%\com.djassistant.desktop\`) | **Read-only via `dj-query`** (`SQLITE_OPEN_READ_ONLY`) or via a **snapshot copy** for the `dj-db` MCP | The live DB belongs to the running app |
| Music library folder | **Read-only, and only to confirm a file still exists** | The agent may stat a path; it may **never** write an audio file, edit a tag, or move a track (D-010) |
| Rekordbox export (`rekordbox.xml`) | **Read-only file parse** | The export is the DJ's data; the reader never rewrites it |
| Rekordbox `master.db` | **Never opened** | It is encrypted (F-11); the `rekordbox` skill's `pyrekordbox` path is the only way in, and it is read-only too |

If a filesystem MCP is ever added, the allow-list is **directories as CLI
arguments** (the only method that works on every protocol version), and **never**
`C:\` or `%USERPROFILE%`.

### 6.3 Shell allow-lists

The agent permission blocks state the **declared intent** for shell access, and
they already exist in `.opencode/agents/*.md`:

| Agent | Allowed shell | Denied |
| ----- | -------------- | ------ |
| `audio-dj-expert` | `cargo *`, `pnpm *`, `beets *`, `ffmpeg *`, `node scripts/agent/*` | everything else (catch-all deny first) |
| `tauri-expert` | `cargo *`, `pnpm *` | everything else |

**Adding an MCP must not widen these.** No server in this plan grants `ffmpeg`,
`beets` or `python` shell rights that the agent does not already have. Per
D-008, permission blocks currently record intent rather than gate — so the
**config-level** guards in §6.1 layers 1–2 are the ones that actually bind.
Read the table above as the contract an agent is asked to keep, not as a
boundary the current binary enforces.

### 6.4 Read-only, enforced where it matters

| Surface | Enforcement |
| ------- | ----------- |
| `dj-db` | Snapshot copy + `tools` map disabling `write_query` / `create_table` / `append_insight` |
| `dj-query` (Rust) | Open the SQLite file with `SQLITE_OPEN_READ_ONLY` — read-only by construction; every statement is a `SELECT` |
| `dj-rekordbox` (Rust) | Opens the XML read-only and only ever **stats** library files — it never opens an audio file for writing, never edits a tag, never writes to the app's DB |
| The live app DB | Not reachable by any MCP in this plan; `dj-query` opens it read-only |

### 6.5 No auto-exec of network calls

- No server in this plan requires a hosted service.
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
| Paths | Use `\` or forward slashes consistently in JSON; quote them. |
| Library path | `D:\Music\DJ_Library` is the maintainer's stated path but does **not** exist on this workstation — the library here is `D:\Music\Music Library`, sets in `D:\Music\My Sets`. Keep it configurable (F-13). |
| WAL databases | The app DB is in WAL mode. A read-only open can fail once the app is closed (SQLite removes `-wal`/`-shm`) — `dj-query` handles both the empty-`-wal` and stale-`-wal` cases explicitly. |
| Node | `@modelcontextprotocol/server-filesystem` needs Node ≥ 24 (this machine: 24.3.0) — relevant only if that server is ever added. |
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

Root-level Markdown is covered by `pnpm lint:root` (`prettier --check` over
root `*.md` and `*.json`). Nested Markdown — including this file — is **not**
checked by that gate, so a docs-only change here is verified by reading it,
not by the formatter.

### 7.2 Smoke tests (per component, before relying on it)

| Component | Test | Pass criterion |
| --------- | ---- | -------------- |
| `dj-query` | `dj-query --stats --json` against the live app DB | Counts match `scripts/inspect-db.py`; exit code 0; **the DB's mtime and size are unchanged** afterwards |
| `dj-query` | `dj-query --bpm-min 122 --bpm-max 126 --key 8A --json` | Rows match the Library view for the same filters |
| `dj-query` | `dj-query --check-files` | Reports the tracks whose audio file is gone (0 is a valid answer) |
| `dj-query` | `dj-query --sort energy` against a DB **without** the `energy` column | A clear, actionable error — not a raw SQLite "no such column" |
| `dj-query` | Point it at a missing DB, and at a DB whose `-wal` still holds content | Actionable errors, exit code ≠ 0, no silent zero-count result |
| `dj-db` | `opencode mcp list` → server connected; ask it to `read_query` `SELECT count(*) FROM tracks` | Count matches `dj-query --stats`; the write tools are **absent** from the tool list |
| `dj-rekordbox` *(staged)* | `dj-rekordbox --xml <export> --stats` | Track count matches the export; the export's mtime is unchanged afterwards |
| any MCP | Ask the agent to run a write tool | The tool is not offered (disabled in the `tools` map) |

### 7.3 Regression checks

- `pnpm agent:doctor` — the agent layer must stay clean.
- `git diff --stat` — the docs, the `dj-query` implementation and the registry
  update should appear; nothing under `.opencode/` should change.
- Verify the merge behaviour: with the project `opencode.json` present, the
  user's global `mcp.pencil` must still be listed by `opencode mcp list`.

---

## 8. Rollback

Each addition is independently reversible, in increasing order of effort.

| # | Change | Rollback | Time |
| - | ------ | -------- | ---- |
| R-1 | `opencode.json` added at the repo root | `git rm opencode.json` (or delete the file) | seconds |
| R-2 | One MCP server enabled | Set `"enabled": false` for it — no file deletion, no restart of the app | seconds |
| R-3 | `dj-db` write tools disabled | Remove the three `tools` entries — **do not** do this; it is the safety net | seconds |
| R-4 | A server's tools disabled globally | Remove the `"dj-db_*": false` style entry | seconds |
| R-5 | Environment variables set | Delete them from the shell profile | seconds |
| R-6 | `dj-query` Rust binary added | `git rm crates/core/src/bin/query.rs` + drop the `[[bin]]` entry from `crates/core/Cargo.toml` | minutes |
| R-7 | `skills.policy.json` triggers added | Delete the four trigger lines | seconds |
| R-8 | `docs/ai/memory/decisions.md` entry | **Append a superseding entry** — never edit an old one (the ledger's rule) | seconds |
| R-9 | `agents.registry.json` keywords | Remove the three keywords from `audio-dj-expert` | seconds |
| R-10 | Everything | `git revert` the commit | minutes |

**Blast radius.** The MCP is opt-in and local; the Rust binaries are read-only
by construction. The worst case of enabling `dj-db` is an extra Python process
reading a snapshot copy of the app DB — it never writes to the app, the
library, or the crates.

---

## 9. Sequencing

| Phase | Work | Gate |
| ----- | ---- | ---- |
| **1** *(this plan)* | Audit + plan + `mcp.recommended.jsonc` (trimmed to `dj-db` + deferred `dj-docs`) | Maintainer review — **done 2026-10-21** |
| **2** | `dj-query` Rust binary + `library_stats` + tests + `agents.registry.json` keywords + `skills.policy.json` triggers + `D-010` | `pnpm rust:fmt`, `rust:clippy`, `rust:test:portable`, `pnpm lint` — **done 2026-10-21** |
| **3** | Create the tracked `opencode.json` **with every server disabled** | `opencode mcp list` shows the servers defined but off; `pnpm lint` |
| **4** | Enable `dj-db` on one machine, with a snapshot | §7.2 smoke test |
| **5** | **DJ produces the Rekordbox XML export** → then build `dj-rekordbox` | §7.2 smoke test; the export's mtime unchanged |
| **6** | Optional: `dj-docs` (Context7) if the maintainer accepts a network doc service | §6.5 |

---

*Evidence for every claim in this plan is in
[`mcb-plugin-audit.md`](./mcb-plugin-audit.md). Package versions were resolved
against the npm registry and PyPI on 2026-10-21.*
