# Audit — Index

**Date:** 2026-10-14
**Scope:** application plan specs, functions, settings
**Source of truth:** `docs/product/CANONICAL_DOCUMENTATION.md` v1.1, `docs/sdd/01-SPECIFICATION.md`, `docs/sdd/05-ACCEPTANCE.md`, `docs/architecture/API_CONTRACTS.md`, `docs/architecture/SKILLS_SYSTEM.md`, `docs/architecture/DATA_MODEL.md`, `.env.example`, `package.json`, `apps/desktop/src-tauri/`

## Files

- `AUDIT-SUMMARY.md` — full combined audit (pros/cons/improvements/proposals)
- `01-specs-audit.md` — plan specs audit
- `02-functions-audit.md` — functions/features audit
- `03-settings-audit.md` — settings/config audit
- `04-improvements.md` — how to improve (prioritized actions)
- `05-proposed-specs-functions.md` — suggested new specs and functions

## Method

1. Read canonical + SDD + architecture + contracts + env + workspace configs.
2. Compared spec promise vs shipped code (`apps/desktop/src-tauri/src/*.rs`, `apps/desktop/src/App.tsx`, `crates/*`).
3. Flagged drift, gaps, risks. Proposed fixes ordered by leverage.

## Status

Phase 0 accepted 2026-10-12. Phase 1 in progress (T1.1.1–T1.1.8 done per `docs/sdd/04-TASKS.md`).
