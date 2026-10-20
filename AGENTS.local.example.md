# AGENTS.local.example.md — template for local overrides

> This **template** is tracked; the copy you make of it is not. Copy it to
> `AGENTS.local.md` (and optionally `CLAUDE.local.md`), both of which
> `.gitignore` keeps off the machine's shared history, for notes that should
> never be shared.

Machine-specific, non-durable notes — never put secrets, credentials, or
team-shared facts here. Anything the whole team should know goes in
[`AGENTS.md`](./AGENTS.md) or [`docs/ai/memory/`](./docs/ai/memory/README.md).

## Examples

- Local dev quirks: proxy, ports, firewall, etc.
- Toolchain differences: e.g. `pnpm rust:test:portable` when ONNX runtime unavailable
- Personal paths to model weights, caches, fixtures
- FreeBuff/other tools that read `AGENTS.local.md` on this machine
