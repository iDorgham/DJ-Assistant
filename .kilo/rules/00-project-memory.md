# Shared project memory (Kilo Code)

`AGENTS.md` at the repo root is Kilo's primary instruction file for this project
and is loaded automatically — this rule only adds what is Kilo-specific.

## The memory store is shared, not per-Kilo

Canonical project memory is `AGENTS.md` + `docs/ai/memory/` (architecture and
write rules: `docs/ai/MEMORY.md`). Every AI tool in this workspace reads the same
store, so:

- **The deprecated Memory Bank is retired here.** Do not recreate
  `.kilo/rules/memory-bank/` or `.kilocode/rules/memory-bank/`. Anything that
  would have gone there belongs in `docs/ai/memory/`.
- **Append, don't fork.** Corrections → `docs/ai/memory/feedback.md`;
  choices that must not be reversed → `docs/ai/memory/decisions.md`;
  durable structural facts → `docs/ai/memory/facts.md`;
  session-only hand-off → `docs/ai/memory/state.md` (rotates, ~2 weeks).
- **Never store secrets** in these files — they are re-sent as context every
  session by every tool.

## Kilo-specific notes

- `AGENTS.md` and `AGENT.md` are write-protected in Kilo Code; ask the human
  before changing them. The memory files under `docs/ai/memory/` are not.
- `kilo.jsonc` (project) deep-merges with the global `~/.config/kilo/kilo.jsonc`;
  the `instructions` array here adds `.kilo/rules/*.md` on top of `AGENTS.md`.
