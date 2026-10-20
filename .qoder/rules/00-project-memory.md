---
trigger: always_on
description: This workspace has ONE shared project memory, shared by every AI tool. Do not start a competing one.
---

# Shared project memory (Qoder)

The project's canonical instructions are `AGENTS.md` at the repo root, and the
shared memory is `docs/ai/memory/` — see `docs/ai/MEMORY.md` for the layer
definitions and write rules.

## What this means for Qoder

- **Static memory (`AGENTS.md` + rules) is authoritative here.** It is shared
  with OpenCode, Kilo Code, FreeBuff, and DeepSeek Harness.
- **Do not let Auto-Memory fork the truth.** Qoder's local Auto-Memory files are
  supplementary only. Anything worth keeping across sessions should be appended
  to `docs/ai/memory/feedback.md` (corrections and lessons) or
  `docs/ai/memory/decisions.md` (choices that must not be reversed), so every
  tool sees it. Never restate a fact in Auto-Memory that already lives in
  `docs/ai/memory/facts.md`.
- **Rotate `state.md`, never treat it as permanent.** Anything in
  `docs/ai/memory/state.md` older than ~2 weeks is stale until re-verified.

## Where corrections belong

`docs/ai/MEMORY.md` owns the layer table — do not copy it here. The two that
matter for Qoder, because Auto-Memory is tempted to absorb them, are
`docs/ai/memory/feedback.md` (corrections and lessons) and
`docs/ai/memory/decisions.md` (choices that must not be reversed).

Never store credentials or private URLs in any of them — they become
model-visible session context in every tool.
