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
[`docs/enhancements/mcb-plugin-enhancement-plan.md`](../../enhancements/mcb-plugin-enhancement-plan.md).
**Reverses if:** OpenCode gains a first-class bundle primitive, or the
tool-disable guarantee proves unenforceable in a shipped build.

## D-010 · Rekordbox is the library source of truth; the agent reads it read-only (2026-10-21)

The DJ runs **Rekordbox** on Pioneer CDJs (Little Buddha, Arena Beach Club), so
Rekordbox — not Serato — is the authoritative library. Serato tooling and the
Playwright MCP are dropped (the latter: `playwright-cli` + `ui-verification`
already cover UI checks inside the Tauri/React stack). The primary agent path
into the **app's imported library** is the Rust **`dj-query`** binary
(`crates/core/src/bin/query.rs`), which reuses the app's own `library_query`
builder, opens the DB with `SQLITE_OPEN_READ_ONLY`, and adapts to a schema
older than the code; the read-only SQLite MCP stays an ad-hoc fallback over a
**snapshot**. The **Rekordbox path is separate**: Rekordbox's `master.db` is
encrypted, so the authoritative library is read through the **exported
`rekordbox.xml`** — by our own Rust reader, **staged, not built yet**. Agent
access to the music library is **strictly read-only**: never write an audio
file, edit a tag, or write to the primary database.
**Reverses if:** the DJ switches to Serato, or Rekordbox ships a readable
`master.db` (or an adoptable MCP) that changes the parsing path.

## D-011 · Skill routing is domain-gated, and a name hit needs a specific word (2026-10-22)

A skill is offered only when it clears three gates, in order of confidence: a
**curated trigger** in `skills.policy.json` wins outright; otherwise the
prompt must contain the skill's **own name in a word that is not
domain-neutral**; otherwise it needs **two independent hits**. A skill outside
the prompt's **active domains** is scored down, not dropped. The domains come
from three signals, in precedence order: the **files in play**, then the
**prompt vocabulary**, then the **routed subagent** — so a vague "fix this"
over `crates/core/**` lands in Rust and API. The domain map, the neutral-word
list, and the penalty live in `skills.policy.json`; the rules live in
`scripts/skills/lib.mjs`.
**Why:** one shared adjective was enough to select a skill, and BM25's inverse
document frequency then *rewarded* the rarest such word. "speed" picked
`performance-and-perceived-speed` and "memory" picked `memory-safety-patterns`
on a task about the agent layer — three wrong skills injected on every such
prompt, in every tool. **Reverses if:** the domain map drifts far enough from
the work that a real task is routed to an empty domain; the domain defaults
(`defaultSkills` per domain) are the safety net, and they fill an *empty*
match set only — a prompt with a real signal is never diluted by them.

Two rules keep the gate honest. **The strongest domain wins**: a task naming
two areas ("make the library table prettier") must not activate the audio area
just because "library" is one of its keywords — the domain with the most
distinct prompt *words* wins, and a tie keeps them all. Distinct words, not
matched keyword entries: "waveform" and "waveforms" are two entries in the
audio domain but one word in the prompt, and counting both let one alias
out-vote a second, real signal. The files in play are a *stronger* signal
still — they say where the work is, so when a file matches, the prompt does
not get to add a second opinion. And the fill order is
**domain match → domain default → off-domain match**: an off-domain match is a
guess, a domain default is a considered one.

## D-012 · The skill library is pruned, not hidden (2026-10-22)

A skill hidden with `metadata.opencode/autoinvoke: false` is **not loadable**
here (D-003), so hiding a skill neither saves the context nor keeps the
capability. The only way to stop paying for a skill is to remove it. The
project therefore keeps an explicit **`prune` list** in
`skills.policy.json` — one entry per skill, with the reason it is not used
here — and a **`pnpm skills:prune`** tool that *moves* the listed skills into
timestamped backups instead of deleting them.

A skill is often installed in more than one place: the project mirror
(`.opencode/skills`) and the machine-global library
(`~/.config/opencode/skills`) both hold it, and `listSkills()` reports only the
copy that shadows the other. Removing one copy therefore leaves the skill
advertised, so the tool moves **every** copy and records each copy's own
original path in the backup's `manifest.json`; `--restore <dir>` puts every
copy back where it came from. The tool's own bundled library
(`~/.agents/skills`) is never a copy the tool may move.

The tool refuses the whole operation when the policy puts a hot skill on the
prune list — the check happens *before* anything moves, so the hot set is
never damaged rather than merely reported afterwards — and a move that fails
leaves a non-zero exit code, so a partial prune cannot pass for a complete
one. The manifest is written before the first move, so an interrupted run
still leaves a record of where every skill went.

Two different scopes meet here, and they are not the same thing. The **prune
list** is project-scoped: it names the skills *this* project does not use.
The **library it operates on** is machine-global: the copies live beside
other projects' work, which is exactly why the tool moves them into a backup
it can put back, and why it refuses to run at all when a hot skill is caught
in the list. The list itself lives in the policy file — a tracked, per-project
file — rather than in the shared memory, because the memory store is re-sent
to every tool on every session and the list is machine state.
**Why:** the whole library is advertised to the model on every step in every
tool, whether or not a skill is ever loaded — that advertising cost, not the
routing, was the dominant latency and spend. **Reverses if:** hiding a skill
becomes loadable here (D-003), or the tool gains a way to exclude a skill
from the advertised list without removing it from disk.

## D-013 · The user comment overwrites `tracks.comments`; tags live in their own table (2026-10-22)

Slice 3A edits the free-text comment in the metadata editor and writes it
through the reversible `update_track_metadata` path. The write **overwrites**
`tracks.comments`: the import-sourced comment of the file is replaced by the
first edit, and the previous value survives only as the undo snapshot.
`tracks.notes` stays unused — it is a separate column, not an alias.

Custom tags live in their own **`track_tags` table** (one row per tag, a
`(track_id, tag)` primary key, an index on the tag) rather than in a
delimited string on `tracks`. That keeps the filter a plain `EXISTS`, keeps
the row shape one row per track, and gives the Tag Surgeon (T2.2) its base.

Slice 3 was cut in two: **3A = tags + comments (T2.1.7, T2.1.13)** and
**3B = key pills (T2.1.8)**. 3B waits because the key-format preference
needs a Settings surface the app does not have yet.

**Why:** the spec names an “Edit tags…” action that never existed, so the
slice had to build its own entry point (a right-click row context menu) and
its own editor; the tag set is the first **non-scalar** undo snapshot, which
forces the restore to be transactional.
**Reverses if:** the DJ wants the file's original comment kept next to the
own note — that is a second column and a second editor field, not a change of
this decision.
