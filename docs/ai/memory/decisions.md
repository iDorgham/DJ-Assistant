# Decision ledger

Append-only, in the order the choices were **recorded**: the `D-00N` sequence is
the ledger, and the date in each heading is when the decision was made, which is
not necessarily when it was written down (D-002 and D-005 predate D-001). Each
entry records **what** was chosen, **why**, and what would reverse it. Never edit
an old entry — add a new one that supersedes it, and never renumber or reorder,
because the IDs are cited from other files.

## D-001 · Canonical AI memory is shared, not per-tool (2026-10-20)

`AGENTS.md` + `docs/ai/memory/*` is the single memory store. Qoder, Kilo Code,
OpenCode, FreeBuff, and DeepSeek Harness all read `AGENTS.md` (the open
standard), so each tool gets a thin adapter instead of a private copy.
**Reverses if:** a tool proves incapable of reading the shared store.

## D-002 · No project-local OpenCode plugin (2026-10-19)

A file under `.opencode/plugins/` makes OpenCode drop the discovered skills from
the model list. Routing therefore runs through instructions, commands, and
subagents instead of plugin event hooks.
**Reverses if:** an OpenCode release fixes the skill-drop regression.

## D-003 · Never hide skills (2026-10-20)

A skill removed from the advertised list (`metadata.opencode/autoinvoke: false`)
cannot be loaded with the `skill` tool in this environment, so hiding only
removes capability. The `hot` list in `skills.policy.json` is a **priority
ranking for the matcher**, not a visibility filter; `policy.mjs --apply` is
guarded behind `--force` and `skills:policy:apply` is not a package script.
**Reverses if:** hidden skills become loadable here (verified by loading one by
ID after hiding).

## D-004 · AI docs are consolidated under `docs/ai/` (2026-10-20)

`AGENTS.md`, `SKILLS.md`, `SKILL_ROUTING.md`, and `MEMORY.md` live in one folder
so there is exactly one home for AI documentation.
**Reverses if:** the team prefers AI docs spread by consumer.

## D-005 · Skills are advisory; `docs/ui/` is authoritative (2026-10-19)

Generic design skills inform technique but never override the project's own
tokens, components, or layout spec.
**Reverses if:** the team decides a skill should govern.

## D-006 · Routing is automatic, one command per prompt (2026-10-20)

Every prompt starts with `pnpm agent:preflight '<prompt>'`, which returns the
memory lines, the skills, the agent that should own the work, and the checks.
Routing is no longer a step an agent has to remember, and it never blocks.
**Reverses if:** the brief costs more context than the routing it replaces.

## D-007 · The agent layer has one source, mirrored per tool (2026-10-20)

The agent and command files are canonical in `.opencode/agents` and
`.opencode/commands`; every other tool directory holds a mirror kept in step by
`pnpm agent:sync --write`, and `pnpm agent:doctor` reports drift. Editing one
copy by hand was the failure mode this removes.
**Reverses if:** a tool can only read an agent file from its own directory and
cannot be synced.

## D-008 · Agent permission blocks are declarative, not enforced (2026-10-21)

`.opencode/agents/*.md` keep the `permissions: [{action, resource, effect}]`
front matter — current OpenCode's documented shape — ordered the way that shape
requires. The build installed here parses only the singular `permission:` object
and ignores this one silently, so the blocks record intent rather than gating.
Switching to the enforced shape was declined: it would apply rules that were
never exercised, across six tools with six schemas.
**Reverses if:** the workspace pins a v2-config OpenCode and every agent runs
once under enforcement. Until then, never report that a permission block allowed
or blocked something without checking the rules the binary resolved.

## D-009 · MCP integration is opt-in, config-only, and never owns app truth (2026-10-21)

Any MCP server this project uses lives in a tracked `opencode.json` at the repo
root, ships **disabled**, and has its write-capable tools hard-disabled through
OpenCode's `tools` map. No project plugin is ever added (D-002), no MCP owns
analysis or library truth, and the agent reads the app's database through a
read-only Rust binary rather than a server that could write to it. Template,
safety envelope and rollback:
[`docs/enhancements/mcb-plugin-enhancement-plan.md`](../../../enhancements/mcb-plugin-enhancement-plan.md).
**Reverses if:** OpenCode gains a first-class bundle primitive, or the
tool-disable guarantee proves unenforceable in a shipped build.

## D-010 · Rekordbox is the library source of truth; the agent reads it read-only (2026-10-21)

The DJ runs **Rekordbox** on Pioneer CDJs (Little Buddha, Arena Beach Club), so
Rekordbox — not Serato — is the authoritative library. Serato tooling and the
Playwright MCP are dropped (the latter: `playwright-cli` + `ui-verification`
already cover UI checks inside the Tauri/React stack). The primary agent path
into the library is the Rust **`dj-query`** binary
(`crates/core/src/bin/query.rs`), which reuses the app's own `library_query`
builder, opens the DB with `SQLITE_OPEN_READ_ONLY`, and adapts to a schema
older than the code; the read-only SQLite MCP stays an ad-hoc fallback over a
**snapshot**. Rekordbox's `master.db` is encrypted, so the DJ's library is read
through the **exported `rekordbox.xml`** — by our own Rust reader, staged until
an export exists. Agent access to the music library is **strictly read-only**:
never write an audio file, edit a tag, or write to the primary database.
**Reverses if:** the DJ switches to Serato, or Rekordbox ships a readable
`master.db` (or an adoptable MCP) that changes the parsing path.
