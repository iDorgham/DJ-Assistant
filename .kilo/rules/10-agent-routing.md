# Agent routing and communication (Kilo Code)

`AGENTS.md` at the repo root is Kilo's primary instruction file and is loaded
automatically. This rule adds only what is Kilo-specific.

## Routing is automatic

`AGENTS.md` tells every session to run, on every prompt:

```bash
pnpm agent:preflight '<the task, in plain words>'
```

It returns the memory lines, the skills to load, the subagent that should own
the work, and the checks. Load the skills with the `skill` tool, delegate when
the brief names an agent, and run the listed checks before reporting done. If
nothing matched, continue normally — routing never blocks.

`/preflight <task>` does the same step from a command.

## Kilo's copies of the agent layer

Kilo reads agents from `.kilo/agents/` and commands from `.kilo/commands/`.
Those are **mirrors** of the canonical files in `.opencode/agents/` and
`.opencode/commands/` — edit the canonical ones, then run:

```bash
pnpm agent:sync --write   # copy the canonical files to every tool directory
pnpm agent:doctor         # registry vs. disk, mirror drift, memory weight
```

Never hand-edit a mirror; the next sync will overwrite it.

## Communication

The delegation contract, the `RESULT` handoff block, the board semantics, and
the file-ownership rules are in `docs/ai/COMMUNICATION.md`. Subagents in this
workspace return that block — read it before integrating their work.

Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.
