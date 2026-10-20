# Agents & Skill Automation

**Document type:** Reference for AI agents (and humans) working on DJ Assistant
**Status:** Living — last updated 2026-10-20
**Scope:** The workspace agents, commands, and scripts that decide which skills load, and the shared memory every AI tool reads

> [`docs/ai/`](./) is the home for AI-related documentation:
> [`SKILLS.md`](./SKILLS.md) inventories what is **installed**, this file explains
> **what runs**, [`SKILL_ROUTING.md`](./SKILL_ROUTING.md) is the generated
> priority table, and [`MEMORY.md`](./MEMORY.md) describes the shared memory
> layers.

---

## 1. What exists

### Subagents — `.opencode/agents/`

| Subagent | Use it when | What it returns |
| --- | --- | --- |
| `skill-router` | You need the right skills for a task, but not the task performed | Ranked list of installed skill IDs, each with a one-line reason |
| `skill-maintainer` | Periodic library health, curation, or policy-drift review | Inventory + audit report: hard problems, findings, recommendations |
| `memory-keeper` | A session produced something worth keeping, or the memory needs pruning | Report of files changed, lines added vs removed, total memory size |

`skill-router` and `skill-maintainer` are deliberately **read-only**: `edit` is
denied for `*`, and their only allowed `shell` is scoped to
`node scripts/skills/*`. Neither ever writes to `~/.config/opencode/skills`, nor
to the vendored copies under `.opencode/skills/`.

`memory-keeper` is the single exception — its `edit` is allowed **only** for
`docs/ai/memory/*` and `docs/ai/MEMORY.md`, and denied for everything else. It
never touches `AGENTS.md`, `CLAUDE.md`, `kilo.jsonc`, or the vendor rule files.

### Commands — `.opencode/commands/`

| Command | Does |
| --- | --- |
| `/skills <task>` | Match this task to installed skills, load the winners with the `skill` tool, then do the task |
| `/skills-audit` | Run the `skill-maintainer` subagent and summarise the changes worth making |
| `/remember <what to keep>` | Record something durable in the shared memory — or say so if it is not worth the context cost |

### Scripts — `scripts/skills/` (also `pnpm skills:*`)

| Script | Purpose |
| --- | --- |
| `match.mjs` | Prompt → ranked skills. `--top N`, `--json`, `--min S`, `--cold-only`, `--fail-on-match` |
| `inventory.mjs` | Rebuilds `.opencode/skill-manifest.json` and `SKILL_ROUTING.md` from what is installed |
| `audit.mjs` | Integrity and curation report: missing descriptions, duplicate IDs, near-duplicates, oversize, policy drift (`--json`) |
| `policy.mjs` | Dry-run report of the priority split; `--restore` clears managed `autoinvoke` flags |
| `../memory/search.mjs` | Prompt → relevant shared-memory lines across the five `docs/ai/memory/` layers. `--json`, `--limit N`. Exposed as `pnpm memory:search`; it is what `context-loader` and the `/audio`, `/tauri` commands call before working |

Shared logic (discovery, frontmatter parsing, scoring) lives in `lib.mjs`; the
curated policy lives in [`skills.policy.json`](../../skills.policy.json).

---

## 2. How routing works — normal prompts, no special syntax

There is no command the model must remember to use. `AGENTS.md` carries the rule
that every session sees:

1. **Before a non-trivial task, match it.** Run
   `node scripts/skills/match.mjs --top 3 "<short task summary>"`.
2. **The matcher scores the prompt** against every installed skill description
   with a BM25-flavoured lexical score, plus hand-curated `triggers` in
   `skills.policy.json` that map project vocabulary onto skill IDs (for example
   `tauri global shortcut ipc` → `tauri-app-global-shortcut`).
3. **Load the winners** with the `skill` tool, then do the task.
4. **If nothing matches, continue normally** — routing never blocks work.

`skill-router` reads `docs/ai/memory/facts.md` and `conventions.md` first, so
its query uses this project's real vocabulary rather than generic terms — that is
what makes the matcher hit the right skills.

The `hot` list in `skills.policy.json` (72 skills) is the project's **priority**
ranking: it biases selection toward the skills that actually matter here. It is a
ranking, not a visibility filter — see §3.

---

## 3. Standing rules — why the wiring looks like this

- **No project-local plugin.** Adding a file under `.opencode/plugins/` currently
  causes OpenCode to drop the discovered skills from the model list entirely, so
  routing runs through instructions, commands, and subagents instead.
- **Never hide a skill.** A skill removed from the advertised list with
  `metadata.opencode/autoinvoke: false` is **not loadable** in this environment —
  hiding only removes capability. `policy.mjs --apply` is guarded and refuses
  without `--force`; `skills:policy:apply` is deliberately not a package script.
- **Skills are advisory, not authority.** For anything UI-facing,
  [`docs/ui/01-DESIGN-SYSTEM.md`](../ui/01-DESIGN-SYSTEM.md) and the rest of
  [`docs/ui/`](../ui/README.md) win over any generic design skill.
- **Everything stays advertised.** The full library costs ~15.4k tokens/step; the
  only way to reduce that is pruning installed skills, not hiding them.
- **One memory store, never one per tool.** Adapters (`CLAUDE.md`,
  `.qoder/rules/`, `.kilo/rules/`, `kilo.jsonc`) point at the shared store; they
  do not restate it. See [`MEMORY.md`](./MEMORY.md).

---

## 4. Maintenance workflow

| Task | Command |
| --- | --- |
| Rebuild the manifest + routing doc | `pnpm skills:inventory` |
| Library health report | `pnpm skills:audit` |
| See what a prompt would route to | `pnpm skills:match "<task>"` |
| Audit via subagent | `/skills-audit` |
| Dry-run the policy split | `pnpm skills:policy` |
| Record something durable | `/remember <what>` |
| Prune / rotate the memory layers | `/remember` (asks `memory-keeper`) |

After editing `skills.policy.json`, run `pnpm skills:inventory` so the manifest
and [`SKILL_ROUTING.md`](./SKILL_ROUTING.md) stay in sync. After a session that
produced something worth keeping, run `/remember` so `state.md` does not rot.

---

## 5. Related

- [`MEMORY.md`](./MEMORY.md) — the shared memory layers and per-tool adapters
- [`SKILLS.md`](./SKILLS.md) — installed-skill inventory by family and source
- [`SKILL_ROUTING.md`](./SKILL_ROUTING.md) — generated priority tables
- [`AGENTS.md`](../../AGENTS.md) — workspace instructions every session sees
- [`docs/README.md`](../README.md) — documentation index
