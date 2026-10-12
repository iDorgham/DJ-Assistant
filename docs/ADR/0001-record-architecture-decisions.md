# ADR-0001: Record Architecture Decisions

**Status:** Accepted  
**Date:** 2026-10-09

## Context

DJ Assistant has a large, multi-document specification set (Canonical, SDD, Architecture, Skills, Security, CI/CD). As engineering begins, irreversible technical choices will be made quickly (repo structure, model packaging, IPC contracts, migration strategy). Without a lightweight decision log, the *why* behind those choices is lost or buried in chat history and PR comments.

## Decision

We will maintain Architecture Decision Records (ADRs) under `docs/ADR/` using sequential numbered markdown files. ADRs are required for significant, hard-to-reverse technical decisions. Product decisions remain in the Canonical Documentation and SDD set.

## Consequences

**Positive**
- New contributors can understand historical trade-offs without archaeology.
- Reviewers have a place to point when questioning a foundational choice.
- Prevents silent drift from the intended architecture.

**Negative**
- Small process overhead for authors of significant changes.
- Requires discipline to keep status fields (Accepted / Superseded) current.

**Neutral**
- ADRs do not replace code comments, design docs, or the Canonical Spec.

## Alternatives Considered

- **Only PR descriptions / commit messages** — Too ephemeral and hard to discover.
- **Single living “Decisions” wiki page** — Harder to version and supersede cleanly.
- **Full design docs for every decision** — Too heavy for many engineering choices.
