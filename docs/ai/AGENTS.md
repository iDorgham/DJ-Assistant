# Agents & Skill Automation

**Document type:** Reference for AI agents (and humans) working on DJ Assistant
**Status:** Living — last updated 2026-10-20
**Scope:** The workspace agents, commands, and scripts that decide which skills load and keep the library healthy

> [`docs/ai/`](./) is the home for AI-related documentation:
> [`SKILLS.md`](./SKILLS.md) inventories what is **installed**, this file explains
> **what runs**, and [`SKILL_ROUTING.md`](./SKILL_ROUTING.md) is the generated
> priority table.

---

## 1. What exists

### Subagents — `.opencode/agents/`

| Subagent | Use it when | What it returns |
| --- | --- | --- |
| `skill-router` | You need the right skills for a task, but not the task performed | Ranked list of installed skill IDs, each with a one-line reason |
| `skill-maintainer` | Periodic library health, curation, or policy-drift review | Inventory + audit report: hard problems, findings, recommendations |

Both are deliberately **read-only**: `edit` is denied for `*`, and the only allowed
`shell` is scoped to `node scripts/skills/*`. They never write to
`~/.config/opencode/skills`.

### Commands — `.opencode/commands/`

| Command | Does |
| --- | --- |
| `/skills <task>` | Match this task to installed skills, load the winners with the `skill` tool, then do the task |
| `/skills-audit` | Run the `skill-maintainer` subagent and summarise the changes worth making |

### Scripts — `scripts/skills/` (also `pnpm skills:*`)

| Script | Purpose |
| --- | --- |
| `match.mjs` | Prompt → ranked skills. `--top N`, `--json`, `--min S`, `--cold-only`, `--fail-on-match` |
| `inventory.mjs` | Rebuilds `.opencode/skill-manifest.json` and `SKILL_ROUTING.md` from what is installed |
| `audit.mjs` | Integrity and curation report: missing descriptions, duplicate IDs, near-duplicates, oversize, policy drift (`--json`) |
| `policy.mjs` | Dry-run report of the priority split; `--restore` clears managed `autoinvoke` flags |

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

---

## 4. Maintenance workflow

| Task | Command |
| --- | --- |
| Rebuild the manifest + routing doc | `pnpm skills:inventory` |
| Library health report | `pnpm skills:audit` |
| See what a prompt would route to | `pnpm skills:match "<task>"` |
| Audit via subagent | `/skills-audit` |
| Dry-run the policy split | `pnpm skills:policy` |

After editing `skills.policy.json`, run `pnpm skills:inventory` so the manifest
and [`SKILL_ROUTING.md`](./SKILL_ROUTING.md) stay in sync.

---

## 5. Related

- [`SKILLS.md`](./SKILLS.md) — installed-skill inventory by family and source
- [`SKILL_ROUTING.md`](./SKILL_ROUTING.md) — generated priority tables
- [`AGENTS.md`](../../AGENTS.md) — workspace instructions every session sees
- [`docs/README.md`](../README.md) — documentation index
