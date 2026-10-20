# AI Memory Layers

**Document type:** Reference for AI agents (and humans) working on DJ Assistant
**Status:** Living — last updated 2026-10-20
**Scope:** One shared project memory, read and written by every AI tool in this workspace

---

## 1. Principle: one store, many readers

Every tool here — **Qoder, Kilo Code, OpenCode, FreeBuff, and DeepSeek
Harness** — reads the open-standard `AGENTS.md` at the repo root. Rather than
let each invent its own memory, this project keeps a **single canonical store**
and gives each tool a thin adapter:

| Layer | Location | Who reads it |
| --- | --- | --- |
| **Entry point** | [`AGENTS.md`](../../AGENTS.md) | All five tools (Open standard) |
| **Shared memory** | [`memory/`](./memory/README.md) | All five, via `AGENTS.md` pointers |
| **Local overlay** | `AGENTS.local.md` / `CLAUDE.local.md` (gitignored) | DeepSeek Harness, Claude-style readers |
| **Vendor adapters** | `.qoder/rules/`, `.kilo/rules/`, `kilo.jsonc`, `CLAUDE.md` | Tool-specific |

`CLAUDE.md` is a one-line pointer to `AGENTS.md` — it covers DeepSeek Harness's
`dsh-agent-instructions` fallback chain and any Claude-compatible reader.

---

## 2. The memory layers

Defined in [`memory/README.md`](./memory/README.md) with their write rules:

| Layer | File | Lifecycle |
| --- | --- | --- |
| L1 · Facts | [`memory/facts.md`](./memory/facts.md) | Permanent |
| L1 · Conventions | [`memory/conventions.md`](./memory/conventions.md) | Stable |
| L2 · Decisions | [`memory/decisions.md`](./memory/decisions.md) | Append-only |
| L2 · Feedback | [`memory/feedback.md`](./memory/feedback.md) | Append-only |
| L3 · State | [`memory/state.md`](./memory/state.md) | Rotates (~2 weeks) |

**Cost discipline:** every file here is re-sent as context on every session of
every tool. Keep them terse, never duplicate what the repo already records, and
prune `state.md` aggressively.

---

## 3. What each tool does

| Tool | Memory file | Adapter |
| --- | --- | --- |
| **OpenCode** | `AGENTS.md` + `.opencode/` agents & commands | `/remember`, `memory-keeper` |
| **Qoder** | `AGENTS.md` + `.qoder/rules/**/*.md` | `.qoder/rules/00-project-memory.md` |
| **Kilo Code** | `AGENTS.md` (+ deprecated memory bank) | `.kilo/rules/00-project-memory.md` + `kilo.jsonc` |
| **DeepSeek Harness** | `AGENTS.md` + `CLAUDE.md` + `AGENTS.local.md` | `CLAUDE.md` pointer |
| **FreeBuff** | `AGENTS.md` (terminal agent) | none needed |

---

## 4. Keeping it honest

- Corrections and lessons go to [`memory/feedback.md`](./memory/feedback.md);
  choices that must not be silently reversed go to
  [`memory/decisions.md`](./memory/decisions.md).
- `memory-keeper` (subagent) / `/remember` (command) reviews the layers,
  de-duplicates, and rotates `state.md`. Run it at the end of a session that
  produced something worth keeping.
- Related: [`AGENTS.md`](./AGENTS.md) (the automation) ·
  [`COMMUNICATION.md`](./COMMUNICATION.md) (delegation and handoff) ·
  [`SKILLS.md`](./SKILLS.md) (the skill library) ·
  [`SKILL_ROUTING.md`](./SKILL_ROUTING.md) (generated priorities).
