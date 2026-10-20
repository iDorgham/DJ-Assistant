---
description: Load Tauri v2 expert + skills (ipc, config, security, plugins)
---

Load the `tauri-expert` subagent and skills: `tauri`, `tauri-ipc`, `tauri-config`,
`tauri-security`.

Run `node scripts/agent/preflight.mjs --json '<task>'` first, then hand the agent
the goal, the scope (`apps/desktop/src-tauri/**`, `packages/shared/**`), the
skills above, the checks (`cargo fmt --all --check`, `cargo clippy --all-targets
-- -D warnings`, `pnpm typecheck`), and the `RESULT` handoff contract from
`docs/ai/COMMUNICATION.md` §5.

Task: $ARGUMENTS
