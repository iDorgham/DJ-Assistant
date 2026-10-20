<!-- Claude-compatible readers only. This file is a pointer, deliberately not a copy:
     Claude Code, DeepSeek Harness (dsh-agent-instructions) and Kilo Code discover
     CLAUDE.md as well as AGENTS.md, so they must not receive two conflicting sets. -->

# DJ Assistant — AI instructions

**Canonical project instructions: [`AGENTS.md`](./AGENTS.md).**
**Canonical shared memory: [`docs/ai/memory/`](./docs/ai/memory/README.md).**

Read those first, then follow them. This file exists only so Claude-compatible
readers load the same context as every other tool in this workspace (Qoder,
Kilo Code, OpenCode, FreeBuff, DeepSeek Harness) — it is intentionally not a
duplicate of the instructions.

- Architecture & specs: [`docs/product/CANONICAL_DOCUMENTATION.md`](docs/product/CANONICAL_DOCUMENTATION.md)
- Memory layers (facts, conventions, decisions, feedback, state): [`docs/ai/MEMORY.md`](docs/ai/MEMORY.md)
- UI source of truth: [`docs/ui/01-DESIGN-SYSTEM.md`](docs/ui/01-DESIGN-SYSTEM.md)

Machine-specific notes go in `AGENTS.local.md` / `CLAUDE.local.md` (both
gitignored) — see [`AGENTS.local.example.md`](./AGENTS.local.example.md).
