# DJ Assistant — AI Development Automation Plan

**Using Claude / GPT (and compatible coding agents) for systematic development**  
**Version:** 1.1  
**Date:** 2026-10-08  
**Status:** Ready for execution (Testing & Security integrated)

This plan defines how to develop DJ Assistant with AI pair-programmers (Claude, GPT-4o, o-series, Cursor Agent, Claude Code, Aider, etc.) while maintaining strict git hygiene: branches, versioning, PRs, reviews, fixes, and merges — **with mandatory testing and security gates on every change**.

**Companion:** [TESTING_AND_SECURITY.md](../engineering/TESTING_AND_SECURITY.md) is binding for all work under this plan.

---

## 1. Goals of This Plan

1. Turn the SDD task list (`docs/sdd/04-TASKS.md`) into a repeatable AI-driven execution loop.
2. Keep every change small, reviewable, and reversible.
3. Enforce branch → PR → review → fix → merge discipline even when AI writes most of the code.
4. Preserve the product non-negotiables (local-first, reversible Skills, no source audio mutation).
5. Produce an auditable history of what the AI did and why.
6. **Never merge without tests for new logic and a security pass appropriate to the change.**
7. **Treat source-audio integrity, path safety, and Skill undo as continuous regression gates.**

---

## 2. Tooling Assumptions

| Role | Recommended Tooling |
|------|---------------------|
| Primary coding agent | Claude (Sonnet / Opus) or GPT-4o / o3 via Cursor, Claude Code, or equivalent |
| Editor / agent host | Cursor, VS Code + Copilot Chat, or Claude Code CLI |
| Git host | GitHub |
| CI | GitHub Actions (lint, typecheck, build, unit tests) |
| Project board | GitHub Projects or Issues linked to task IDs (`T0.1.1`, etc.) |
| Docs source of truth | `docs/sdd/*` + Canonical Documentation |

You may substitute equivalent tools; the **workflow** is what matters.

---

## 3. Branch Strategy

```
main                    ← production-ready only (protected)
  └── develop           ← integration branch (optional but recommended)
        └── feat/*      ← feature work
        └── fix/*       ← bug fixes
        └── chore/*     ← tooling, CI, deps
        └── docs/*      ← documentation only
        └── ai/*        ← experimental AI spikes (short-lived)
```

### Rules

| Rule | Detail |
|------|--------|
| Branch from | `develop` (or `main` if no develop) |
| Naming | `feat/T0.2.4-blake3-hashing`, `fix/analysis-crash-on-aiff`, `chore/ci-windows-build` |
| Task ID required | Include SDD task ID in branch name when applicable |
| Lifetime | Prefer < 2 days of work per branch |
| Protection | `main` requires PR + CI green + at least one review (human or dual-AI) |
| No direct commits | Never commit straight to `main` |

### Versioning

- **SemVer** for app releases: `MAJOR.MINOR.PATCH`
- Pre-release tags during MVP: `0.1.0-alpha.1`, `0.1.0-beta.1`
- Phase exits can correspond to minor bumps (e.g. Phase 0 complete → `0.1.0`)
- Git tags created only from `main` after merge + CI

Changelog format: [Keep a Changelog](https://keepachangelog.com/) + Conventional Commits.

---

## 4. AI Development Loop (Core Automation)

Every unit of work follows this loop:

```
1. SELECT   → Pick next task from docs/sdd/04-TASKS.md
2. CONTEXT  → Load Spec + Design + Coding Standards + TESTING_AND_SECURITY + relevant code
3. BRANCH   → Create feat/fix branch from develop/main
4. PROMPT   → Structured prompt including Testing & Security blocks (see §6)
5. IMPLEMENT→ Agent writes code + tests together
6. VERIFY   → Lint, types, unit/fixture tests, security checklist, hash audit if needed
7. COMMIT   → Conventional commit(s)
8. PR       → Open PR with test plan + security checklist
9. REVIEW   → AI review (correctness + security + tests) + human review
10. FIX     → Address blocking findings (including missing tests / security gaps)
11. MERGE   → Squash only if CI green AND security/test gates satisfied
12. CLOSE   → Mark task [x] in 04-TASKS.md; note any new fixtures
```

Automate steps 3, 7, 8, 11 with scripts or agent commands where possible; **never skip 6, 9, or 10**. Missing tests or security checklist on high-risk PRs is a hard stop.

---

## 5. Git Workflow Commands (Reference)

```bash
# Start task
git checkout develop
git pull
git checkout -b feat/T0.2.4-blake3-hashing

# During work (agent or human)
git add -A
git commit -m "feat(desktop): add BLAKE3 fingerprint for track dedup

Implements T0.2.4. Hash covers first 1MB + duration.
"

# Open PR (GitHub CLI)
gh pr create --base develop --title "feat(desktop): BLAKE3 hashing (T0.2.4)" --body-file .github/PULL_REQUEST_TEMPLATE.md

# After review + CI green
gh pr merge --squash --delete-branch

# Mark done
# Edit docs/sdd/04-TASKS.md → [x] T0.2.4
```

---

## 6. Structured Prompting Standard

Do **not** give the agent vague instructions. Use this template for every task.

### 6.1 Implementation Prompt Template

```markdown
# Task
ID: T0.2.4
Title: BLAKE3 fingerprint (first 1MB + duration)
Phase: 0 — Foundation

# Context (attach or @-reference)
- docs/sdd/01-SPECIFICATION.md (privacy + non-destructive rules)
- docs/sdd/02-SYSTEM-DESIGN.md
- docs/engineering/CODING_STANDARDS.md
- docs/engineering/SECURITY_AND_PRIVACY.md
- docs/engineering/TESTING_AND_SECURITY.md
- docs/architecture/ARCHITECTURE.md
- Relevant existing code: apps/desktop/src-tauri/...

# Goal
Implement stable BLAKE3 hashing used for deduplication.
Hash input = first 1MB of file bytes + duration.
Store hash on track record; skip re-import of exact duplicates.

# Constraints
- Rust implementation preferred for hashing
- Must not modify source audio files
- Graceful error on unreadable files (log + skip)
- Follow Coding Standards (no unwrap in library paths)
- Canonicalize paths; stay inside user-selected roots

# Testing Requirements (mandatory)
- Add/update unit tests for new logic
- Include at least one failure path (unreadable file, empty file)
- If analysis/cues: golden fixtures
- If mutation (tags/cues/sets/skills): undo test
- If FS paths: traversal/negative tests
- If export: snapshot or round-trip assertion

# Security Requirements (mandatory)
- Do not modify source audio files
- Canonicalize and jail all filesystem paths
- Treat any LLM output as untrusted; validate schema
- No secrets in code or logs
- List any new capability or network surface

# Definition of Done
- [ ] Code compiles
- [ ] Unit/fixture tests pass
- [ ] Security checklist satisfied for this change type
- [ ] IPC or internal API exposes hash result
- [ ] Duplicate detection works on rescans
- [ ] No new Clippy/lint errors
- [ ] Conventional commit message ready

# Out of Scope
- Full audio analysis
- UI polish beyond minimal status display
```

### 6.2 Review Prompt Template

```markdown
# PR Review Request
PR: #<number>
Task IDs: T0.2.4

Review against:
1. docs/sdd/01-SPECIFICATION.md — non-goals and privacy
2. docs/engineering/CODING_STANDARDS.md
3. docs/engineering/SECURITY_AND_PRIVACY.md
4. docs/engineering/TESTING_AND_SECURITY.md
5. Does this mutate source audio? (Must be NO)
6. Path handling safe (canonicalized, rooted)?
7. Is undo/history needed? If yes, is it present + tested?
8. Tests adequate (happy path + failure path)?
9. High-risk area extra scrutiny done?
10. Any scope creep beyond the task?

Security & Testing checklist:
- [ ] Tests added for new behavior
- [ ] Failure paths covered
- [ ] Source audio mutation impossible
- [ ] Path handling safe
- [ ] LLM output validated if applicable
- [ ] Undo/preview present for mutations
- [ ] CI tests pass

Output format:
- Summary (1 paragraph)
- Blocking issues (must fix) — include missing tests/security gaps
- Non-blocking suggestions
- Explicit APPROVE or REQUEST_CHANGES
```

### 6.3 Fix Prompt Template

```markdown
# Fix Loop
PR: #<number>
Reviewer findings:
1. ...
2. ...

For each blocking issue:
- Explain root cause briefly
- Implement the minimal fix
- Add/adjust test if applicable (required if finding was about tests/security)
- Re-run relevant tests locally
- Do not expand scope
```

---

## 7. PR, Review, Fix, Merge Policy

### 7.1 Pull Request Requirements

Every PR must include:

- **Title:** Conventional Commits style + task ID  
  `feat(desktop): add BLAKE3 hashing (T0.2.4)`
- **Body:**
  - What / Why
  - Task ID(s)
  - **Test plan** (commands run + fixtures touched + manual steps)
  - **Security checklist** (required for high-risk; recommended for all)
  - Screenshots if UI
  - Risk notes (data model, security, analysis quality)
- **CI green** (lint, types, unit/fixture tests) before merge
- **No secrets** in diff
- **No merge** if new logic lacks tests or security checklist fails for high-risk areas

**Security checklist fragment (paste into high-risk PRs):**
```markdown
## Security Checklist
- [ ] No source audio write/modify
- [ ] Paths canonicalized and restricted to user roots
- [ ] No secrets committed or logged
- [ ] LLM outputs schema-validated (if any)
- [ ] Mutations have preview + undo (if any)
- [ ] Tauri capabilities reviewed (if config changed)
- [ ] New network endpoints documented (if any)
- [ ] Tests cover abuse/failure cases for this change
```

### 7.2 Review Policy (Human + AI)

| Reviewer | Responsibility |
|----------|----------------|
| AI (Claude/GPT) | First-pass: correctness, standards, **security**, **test adequacy**, scope creep |
| Human | Final authority: product intent, architecture fit, acceptance criteria, residual risk |
| Dual-AI optional | Second model for high-risk PRs (analysis, export, Skills, FS, cloud) |

**High-risk areas requiring extra scrutiny + dual review recommended:**
- Audio analysis / ONNX integration
- Export generators (rekordbox / Serato)
- Skills mutation + undo paths
- Filesystem access / path handling
- Cloud sync boundaries / LLM gateway
- Tauri capability or CSP changes

**Blocking review findings (examples):**
- Missing tests for new logic
- Mutation without undo/preview
- Path handling without canonicalization/jail
- Possible source-audio write
- Unvalidated LLM output applied to library state
- Secrets in diff

### 7.3 Fix Loop

1. Reviewer posts findings as PR comments.
2. Agent (or human) addresses **blocking** items only (including test/security gaps).
3. Push to same branch; CI re-runs (tests must stay green).
4. Re-request review.
5. Max 3 AI fix iterations before human pair-debug session.

### 7.4 Merge Rules

| Condition | Action |
|-----------|--------|
| CI green + approvals met + test/security gates OK | Squash-merge to `develop` (or `main`) |
| Missing tests on new logic | **Do not merge** |
| High-risk PR without security checklist | **Do not merge** |
| Task completes a phase exit | Merge + run full phase acceptance (`05-ACCEPTANCE.md` + testing gates) + tag candidate |
| Hotfix on main | `fix/*` → PR to `main` → cherry-pick to develop |
| Experimental spike | Merge only after promotion to real task; otherwise delete branch |

Prefer **squash merge** during MVP to keep history readable.

---

## 8. Automation Surfaces (What to Script)

Implement these as repo scripts or agent slash-commands over time:

| Automation | Purpose |
|------------|---------|
| `scripts/ai-start-task.sh T0.2.4` | Creates branch, prints context pack (incl. TESTING_AND_SECURITY) |
| `scripts/ai-commit.sh` | Stages, runs lint + unit tests, creates conventional commit |
| `scripts/ai-pr.sh` | Pushes branch + `gh pr create` with template (test plan + security sections) |
| `scripts/ai-review-prompt.sh` | Emits review prompt with PR diff + security/testing checklist |
| `scripts/phase-status.sh` | Parses `04-TASKS.md` checkboxes → progress report |
| `scripts/hash-audit.sh` | Before/after BLAKE3 audit on a sample library (source integrity) |
| `scripts/run-golden.sh` | Runs golden analysis fixtures |
| GitHub Action: unit + fixture tests | Required CI on every PR |
| GitHub Action: clippy -D warnings | Required CI |
| GitHub Action: dependency audit | Scheduled or on lockfile change |
| GitHub Action: AI PR comment | Optional: post security/testing checklist on every PR |
| GitHub Action: task ID check | Fail CI if PR title lacks task ID when required |

Start manual; automate the painful steps first. **CI test failure is a merge blocker.**

---

## 9. Phase-by-Phase AI Execution Guide

### Phase 0 — Foundation
- **AI strength:** Scaffolding, boilerplate, IPC skeletons, CI YAML
- **Human focus:** Confirm Tauri security allowlists, path sandboxing
- **Batch size:** 1–3 tasks per PR
- **Suggested order:** T0.1.* tooling → T0.2.* shell → first vertical slice (scan → list)

### Phase 1 — Analysis Engine
- **AI strength:** Rust FFI/ONNX glue, queue design, tests around pure functions
- **Human focus:** Model selection, golden fixtures, performance benchmarks
- **Rule:** No PR merges without at least one golden fixture test for new analysis outputs

### Phase 2 — Library & Tags
- **AI strength:** Fuzzy matching algorithms, UI tables, undo/history patterns
- **Human focus:** Precision of Tag Surgeon on real messy libraries
- **Rule:** Every bulk mutation PR must demonstrate preview + undo

### Phase 3 — Set Builder & Export
- **AI strength:** Beam Search implementation, scoring functions, XML generation
- **Human focus:** Musical quality of sets, CDJ hardware validation
- **Rule:** Export PRs require hash-unchanged proof for source audio

### Phase 4 — Skills & Beta
- **AI strength:** Skills framework plumbing, rule engine, workflow wiring
- **Human focus:** Kill-switch behavior, beta readiness, UX polish
- **Rule:** Skills without undo do not merge

---

## 10. Context Pack (What to Always Feed the Agent)

Minimum context for any non-trivial task:

1. `docs/sdd/01-SPECIFICATION.md` — scope & non-goals  
2. `docs/sdd/02-SYSTEM-DESIGN.md` — architecture boundaries  
3. `docs/engineering/CODING_STANDARDS.md`  
4. `docs/engineering/SECURITY_AND_PRIVACY.md` (for FS, IPC, network, Skills)  
5. Relevant section of `docs/sdd/04-TASKS.md`  
6. Existing code in the touch area  
7. Acceptance criteria from `docs/sdd/05-ACCEPTANCE.md` for the current phase  

For analysis / set-builder / export work, also attach the matching Mermaid diagram under `docs/diagrams/`.

---

## 11. Versioning & Release Automation

```
0.0.x     — pre-Phase-0 spikes (optional)
0.1.0     — Phase 0 accepted
0.2.0     — Phase 1 accepted
0.3.0     — Phase 2 accepted
0.4.0     — Phase 3 accepted
0.5.0     — Phase 4 / closed beta
1.0.0     — Public MVP after acceptance criteria met
```

### Release checklist (human-gated)

- [ ] All phase acceptance criteria green (`05-ACCEPTANCE.md`)
- [ ] CHANGELOG updated
- [ ] Version bumped in app + package manifests
- [ ] CI green on tag
- [ ] Desktop artifacts built (macOS + Windows)
- [ ] No open critical issues on milestone
- [ ] Tag signed/annotated from `main`

---

## 12. Anti-Patterns (Do Not Do)

| Anti-Pattern | Why |
|--------------|-----|
| Multi-phase mega-PRs | Unreviewable; breaks SDD gating |
| Agent commits to `main` | Bypasses review and CI |
| “Fix everything the linter mentions” scope creep | Inflates PR; hides real issues |
| LLM-generated set ordering | Violates hybrid intelligence rule |
| Silent bulk tag/cue changes without undo | Violates reversibility |
| Uploading audio “for better analysis” | Violates local-first / privacy |
| Ignoring failing fixtures to merge | Corrupts analysis quality bar |

---

## 13. Daily / Weekly Cadence

### Daily (engineer + AI)
1. Pick top 1–3 tasks from current phase.
2. Run AI loop (§4) for each.
3. Keep PRs < ~300 lines when possible.
4. End of day: no open “WIP” PRs older than 48h without note.

### Weekly
1. Merge train to `develop`/`main`.
2. Run phase progress script / update `04-TASKS.md`.
3. Review risk register; adjust task order if blocked.
4. Optional: dual-AI architecture review of the week’s merged work.

### Phase exit
1. Full acceptance run from `05-ACCEPTANCE.md`.
2. Tag version.
3. Short retro: what the AI did well / where human intervention was required.
4. Update this automation plan if process gaps appeared.

---

## 14. Example End-to-End Trace (Task T0.2.4)

```
SELECT   T0.2.4 BLAKE3 hashing
CONTEXT  Spec + Coding Standards + src-tauri file module
BRANCH   feat/T0.2.4-blake3-hashing
PROMPT   Implementation template filled
IMPLEMENT Agent adds hash.rs + tests + IPC field
VERIFY   cargo test && cargo clippy && manual rescan
COMMIT   feat(desktop): add BLAKE3 fingerprint (T0.2.4)
PR       gh pr create ...
REVIEW   AI review → 1 blocking (unwrap on IO) → human agrees
FIX      Replace unwrap with proper error propagation + test
REVIEW   APPROVE
MERGE    squash to develop
CLOSE    [x] T0.2.4 in 04-TASKS.md
```

---

## 15. Success Metrics for the Automation Itself

| Metric | Target |
|--------|--------|
| % of tasks completed via AI-assisted PRs | > 70% after Phase 0 |
| Median PR cycle time (open → merge) | < 24 hours |
| PR rejection rate for standards/security | Decreasing over time |
| Phase acceptance criteria met without major rework | All phases |
| Incidents of source-audio mutation | Zero |

---

## 16. Related Documents

- [SDD Overview](../sdd/README.md)
- [Task Breakdown](../sdd/04-TASKS.md)
- [Acceptance Criteria](../sdd/05-ACCEPTANCE.md)
- [Coding Standards](../engineering/CODING_STANDARDS.md)
- [Development Guide](../engineering/DEVELOPMENT.md)
- [Security & Privacy](../engineering/SECURITY_AND_PRIVACY.md)
- [Entire Project Overview (Mermaid)](../diagrams/00-ENTIRE-PROJECT-OVERVIEW.md)

---

*This plan makes AI a disciplined executor of the SDD — not an unsupervised code generator. Branches, PRs, reviews, fixes, and merges remain mandatory gates.*
