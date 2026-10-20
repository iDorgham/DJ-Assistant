# Project memory — index

Durable memory shared by every AI tool in this workspace. **One store, many
readers** — see [`../MEMORY.md`](../MEMORY.md) for the architecture and the
per-tool adapters.

| Layer | File | Lifecycle | Append to it when… |
| --- | --- | --- | --- |
| L1 · Facts | [`facts.md`](./facts.md) | Permanent | A structural or tooling fact is discovered that is not obvious from the code |
| L1 · Conventions | [`conventions.md`](./conventions.md) | Stable | A rule the project enforces in every session (style, UI, safety) |
| L2 · Decisions | [`decisions.md`](./decisions.md) | Append-only | A choice is made that a future session must not silently reverse |
| L2 · Feedback | [`feedback.md`](./feedback.md) | Append-only | The human corrects the agent, or a mistake is found and fixed |
| L3 · State | [`state.md`](./state.md) | Rotates | Handing off between sessions; delete anything older than ~2 weeks |

## Write rules

- **One fact per line.** Terse beats thorough — this is context cost, re-sent to
  every tool on every session.
- **Never duplicate what the repo already records.** Do not store file trees,
  dependency lists, or anything `package.json` / `docs/` already says.
- **A fact naming a file or setting is a hint, not gospel.** Old memory must be
  re-verified against reality before it is acted on.
- **State rots, decisions do not.** If something in `state.md` has been true for
  more than two weeks, either delete it or promote it to `decisions.md`.
- **No secrets.** These files become model-visible session context in every
  tool. Never put credentials, tokens, or private URLs here.

## Maintenance

`/remember` (or the `memory-keeper` subagent) reviews the layers, removes
duplicates and stale state, and promotes corrections that turned into standing
rules. Run it at the end of a session that produced something worth keeping.
