# Decision ledger

Append-only. Newest last. Each entry records **what** was chosen, **why**, and
what would reverse it. Never edit an old entry — add a new one that supersedes
it.

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
