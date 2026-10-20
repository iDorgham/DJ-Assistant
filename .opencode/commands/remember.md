---
description: Capture something worth keeping in the shared project memory (read by every AI tool)
---

Use the `memory-keeper` subagent to record this in the shared project memory at
`docs/ai/memory/`, which every AI tool in this workspace reads (Qoder, Kilo
Code, OpenCode, FreeBuff, DeepSeek Harness — see `docs/ai/MEMORY.md`).

Pick the layer:

- **correction or lesson learned** → `feedback.md`
- **a choice that must not be silently reversed** → `decisions.md`
- **durable structural or tooling fact** → `facts.md`
- **a standing rule for every session** → `conventions.md`
- **hand-off for the next session** → `state.md`

Have it de-duplicate and prune while it is there. If nothing here is durable
enough to keep, say so and write nothing rather than adding noise — these lines
cost context in every tool forever.

To remember: $ARGUMENTS
