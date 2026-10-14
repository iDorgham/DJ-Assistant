# Contributing to DJ Assistant

Thank you for your interest in contributing.

This project is in **Phase 1 (Analysis Engine) — Phase 0 accepted 2026-10-12**. The Canonical Documentation is the product and technical source of truth; the SDD plan (`docs/sdd/`) defines execution, with audit findings (`docs/audit/`) tracked as `TA.1–TA.14`.

---

## Before You Start

1. Read the [README](./README.md).
2. Read the [Canonical Documentation](./docs/product/CANONICAL_DOCUMENTATION.md) (at least the vision, modules, architecture, and non-goals).
3. Read [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) and [docs/engineering/DEVELOPMENT.md](./docs/engineering/DEVELOPMENT.md).
4. Familiarize yourself with the [Skills System](./docs/architecture/SKILLS_SYSTEM.md) and [Security & Privacy](./docs/engineering/SECURITY_AND_PRIVACY.md) principles.

---

## How to Contribute

### Reporting Issues

- Use clear titles and describe the expected vs actual behavior.
- For analysis / cue / set-builder issues, include sample metadata or (when possible) a short anonymized fixture description.
- Security issues should be reported privately if a responsible disclosure channel is published.

### Proposing Changes

- For significant product or architectural changes, open a discussion or issue first. Do not surprise the team with large PRs that contradict the Canonical Spec.
- Small fixes, documentation improvements, and test coverage increases are always welcome.

### Pull Request Process

1. Fork / branch from the current development branch.
2. Follow [Coding Standards](./docs/engineering/CODING_STANDARDS.md).
3. Write or update tests for the change.
4. Update documentation when behavior or public interfaces change.
5. Ensure CI passes (lint, typecheck, unit tests).
6. Request review.

### Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(analysis): improve phrase boundary confidence scoring
fix(desktop): prevent double-import on folder watcher race
docs: clarify Beam Search non-goals in architecture
```

---

## Code of Conduct

Be respectful, constructive, and focused on the best outcome for professional DJs who will use this tool. Harassment or bad-faith contributions will not be tolerated.

---

## Questions?

Open an issue with the `question` label or reach out via the project’s designated communication channel (to be published).
