---
description: Load Audio/DJ expert + skills (waveform, beatgrid, rekordbox, beets, analysis)
---

Load the `audio-dj-expert` subagent and skills: `music-analyzer`,
`ffmpeg-waveforms-visualization`, `dj-library-organizer`, `dj-set-architect`,
`beets-music-library-manager-tagger`, `rekordbox`, `sql-optimization-patterns`.

Run `node scripts/agent/preflight.mjs --json "<task>"` first, then hand the agent
the goal, the scope (`crates/analysis/**`, `crates/core/**`, `fixtures/**`), the
skills above, the checks (`cargo clippy --all-targets -- -D warnings`,
`pnpm rust:test:portable` when the ONNX runtime is missing), and the `RESULT`
handoff contract from `docs/ai/COMMUNICATION.md` §5.

Task: $ARGUMENTS
