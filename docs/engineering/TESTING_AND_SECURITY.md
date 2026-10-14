# DJ Assistant — Testing & Security Plan

**Status:** Binding for development and AI automation  
**Version:** 1.0  
**Date:** 2026-10-08  
**Applies to:** All phases, all PRs, all AI-assisted work

This document defines the full testing strategy and security improvement program. It is referenced by the AI Development Automation Plan, SDD acceptance criteria, and Coding Standards.

---

## 1. Testing Strategy Overview

### 1.1 Test Pyramid

```
                    ┌─────────────────┐
                    │   E2E / Manual  │  Critical journeys only
                    │  Hardware gate  │  CDJ validation
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  Integration    │  IPC, DB, export, Skills
                    │  + Fixtures     │  Golden audio, XML snapshots
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │         Unit Tests          │  Pure functions, scoring,
              │   Rust + TypeScript         │  hashing, parsing, undo
              └─────────────────────────────┘
```

### 1.2 Mandatory Test Types

| Type | Scope | Required When |
|------|-------|---------------|
| **Unit** | Pure functions, scoring, hashing, cue snapping, tag clustering, Beam Search helpers | Every PR that touches logic |
| **Golden fixtures** | Known audio → expected BPM/key/phrases/cues | Any analysis or cue change |
| **Integration** | IPC commands, SQLite migrations, export writers, Skill run/undo | Feature PRs in those areas |
| **Property / fuzz** | Parsers, path handling, metadata edge cases | Phase 0–1 foundations; ongoing for parsers |
| **Snapshot** | rekordbox XML structure, crate headers (non-audio) | Export PRs |
| **Hash integrity** | Source file BLAKE3 before/after any operation | Every mutating workflow test |
| **Manual / E2E** | Scan → analyze → cue → set → export | Phase exits + release candidates |
| **Hardware** | Load export on Pioneer CDJ-2000NXS2 / CDJ-3000 | Phase 3 exit + MVP |

### 1.3 Coverage Expectations (MVP Direction)

| Area | Target |
|------|--------|
| Rust pure logic (hash, score, snap, beam helpers) | High unit coverage; no uncovered critical paths |
| Analysis pipeline | Golden fixtures for ≥ 20 representative tracks across genres/formats |
| Tag Surgeon | Fixture library of messy artist-name clusters with expected canonical forms |
| Export | Snapshot tests + at least one full round-trip load test per format |
| Skills undo | Unit + integration test per mutating Skill |
| UI | Component tests for critical panels; Playwright (or equivalent) for 3–5 core journeys by Phase 4 |

Exact % gates can be tightened later; **missing tests for new logic is a blocking review finding**.

---

## 2. Test Infrastructure Requirements

### 2.1 Phase 0 Must Establish

- [ ] `cargo test` works in `apps/desktop/src-tauri`
- [ ] JS/TS test runner (Vitest recommended) for frontend + shared packages
- [ ] Fixture directory structure: `fixtures/audio/`, `fixtures/charts/`, `fixtures/models/` (see `fixtures/README.md`)
- [ ] CI runs unit tests on every PR
- [ ] Test helpers for temp directories and sample track records

### 2.2 Phase 1+ Additions

- [ ] Golden audio fixture runner (analyze → compare within tolerance)
- [ ] Benchmark harness (Criterion) for analysis p50 timing
- [ ] Corrupt / malformed file corpus for crash resistance
- [ ] Export snapshot comparer

### 2.3 Phase 3+ Additions

- [ ] Hardware validation checklist (documented, executed on real CDJs)
- [ ] Source-audio hash audit script (before/after full prepare pipeline)
- [ ] Optional Playwright (or Tauri driver) smoke suite for closed beta

### 2.4 Fixture Rules

- Do **not** commit large copyrighted audio files.
- Prefer short synthetic or licensed clips; document provenance.
- Store expected analysis outputs as JSON alongside fixtures.
- Tolerances: BPM ±0.5 (or documented), key exact, phrase boundaries within N ms.

---

## 3. Security Improvement Program

### 3.1 Security Principles (Non-Negotiable)

1. Raw audio never leaves the device by default.
2. Source audio files are never modified (enforce via hash checks in tests).
3. Filesystem access limited to user-selected roots; path canonicalization required.
4. LLM output is untrusted input — schema-validate; never let it mutate the library directly.
5. Every bulk/AI mutation is logged, previewable, and undoable.
6. Secrets never in repo, logs, or client bundles.
7. Dependencies pinned; supply-chain review for audio/ONNX crates.

### 3.2 Threat Model → Test / Control Mapping

| Threat | Control | How Verified |
|--------|---------|--------------|
| Malformed audio crashes process | Robust decode + skip | Fuzz/corrupt corpus in CI |
| Path traversal | Canonicalize + root jail | Unit tests with `../` paths |
| Source file mutation | Read-only open; hash audit | Integration test before/after |
| Destructive USB format hits wrong drive | Removable-only list, system-drive block, no default, double-confirm, audit log | Unit tests for block-list; manual checklist |
| LLM prompt injection | JSON schema validation of constraints | Unit tests with adversarial prompts |
| Skill bulk damage | Preview + undo + kill-switch | Integration tests per Skill |
| Dependency compromise | Pin + audit + lockfiles | CI dependency review / Dependabot |
| Token leakage | OS keychain; no log of secrets | Code review checklist |
| XSS in UI | Tauri CSP + React escaping | CSP config review; no `dangerouslySetInnerHTML` without review |
| Over-broad FS allowlist | Tauri capabilities least privilege | PR checklist + architecture review |
| OAuth redirect / deep-link interception | Registered/allow-listed redirect; PKCE; per-flow `state` | Unit tests: mismatched/absent `state` rejected; redirect allow-list enforced |
| Over-broad integration scopes | Minimal scopes; public/read scopes opt-in only | Scope assertion tests (Spotify export, post-MVP) |

### 3.3 Security Gates in the PR Loop

Every PR must pass:

| Gate | Blocking? |
|------|-----------|
| No source-audio write APIs introduced without explicit design review | Yes |
| Path handling uses shared canonicalization helper | Yes for FS PRs |
| New Skill mutations include undo test | Yes |
| No secrets in diff | Yes |
| `cargo audit` / `npm audit` (or equivalent) clean of critical issues | Yes for dependency PRs |
| Security checklist completed in PR body for high-risk areas | Yes |

### 3.4 High-Risk Area Definition

Treat as high-risk (extra review + tests required):

- Filesystem scanning / watching
- Audio decode and ONNX inference
- Export file writers
- Skills that mutate tags, cues, or sets
- Cloud auth, sync, and LLM gateway
- Any network send of library-derived data
- Capability / permission changes in Tauri config

---

## 4. Security Improvements by Phase

### Phase 0 — Foundation
- [ ] Tauri CSP and capability allowlists locked down (no ambient FS)
- [ ] Path canonicalization utility + tests
- [ ] Scan only within user-picked directory tree
- [ ] Hash integrity helper used from first import
- [ ] CI: `cargo clippy -D warnings`, `cargo audit` (or scheduled)
- [ ] No plaintext secrets in examples

### Phase 1 — Analysis
- [ ] Analysis workers handle panics/errors without killing UI process
- [ ] Corrupt file corpus passes (skip + log)
- [ ] Model files checksum-verified on load
- [ ] Analysis results versioned (reproducibility / rollback)

### Phase 2 — Library & Tags
- [ ] Tag Surgeon preview mandatory before bulk apply
- [ ] Undo records written in same transaction as mutation where possible
- [ ] Alias table cannot be used to escape path or inject scripts (plain data only)

### Phase 3 — Set Builder & Export
- [ ] Export writers never open source audio for write
- [ ] XML/crate generation uses safe builders (no string-concat XSS into DJ software)
- [ ] Source hash audit in export integration test
- [ ] Constraint parser rejects non-schema LLM output
- [ ] USB format is high-risk: removable-only enumeration, system-drive block, no default selection, double-confirm, allow-listed OS format commands only, audit-logged; unit tests for block-list + label sanitization

### Phase 4 — Skills & Cloud
- [ ] Kill-switch stops in-flight Skills and disables new runs
- [ ] Skill permissions model documented and enforced
- [ ] Cloud: short-lived tokens, workspace scoping, rate limits
- [ ] LLM gateway: schema validation, output size limits, no tool-calling into local FS
- [ ] Opt-in telemetry cannot include audio or full path lists

---

## 5. Testing Improvements by Phase

### Phase 0
- Unit tests for hashing, dedup, metadata parse
- Corrupt file scan test
- Migration up/down smoke test
- CI matrix: macOS + Windows unit tests

### Phase 1
- [ ] Golden fixture suite v1 (≥ 10 tracks)
- [x] Analysis timing benchmark (p50 < 3s assertion in golden test)
- [x] Confidence flag unit tests (T1.2.4)

### Phase 2
- Tag cluster fixtures (messy names → canonical)
- Undo integration test for bulk tag apply
- Cue edit persistence test
- Library filter/search unit tests

### Phase 3
- Beam Search unit tests (constraints respected, no duplicates, duration bounds)
- Transition score monotonicity / sanity tests
- Export snapshots + load validation
- Full pipeline hash-unchanged test
- USB format verify/certify tests (FAT32 + MBR asserted post-format; exFAT warning gate; system-drive rejection)
- Hardware checklist executed and signed off (formatted sticks mount on NXS2 + 3000)

### Phase 4
- Skill registry enable/disable tests
- Kill-switch test
- Gig Ready dry-run test
- Optional E2E smoke (import → export)
- Closed beta feedback → regression fixtures

### Post-MVP — Spotify Playlist Export (Streaming Export)

- **Matching engine:** unit tests for ISRC exact match, fuzzy fallback (normalized title/artist/album + ±3 s duration), and confidence-tier classification (high → auto-add; medium/low → review queue; unmatched → reported).
- **No audio invariant:** export tests assert no audio is read, streamed, stored, or uploaded; source-file BLAKE3 hash is unchanged before/after the export pipeline (extends the existing hash-integrity rule).
- **Rate limits:** `429` + `Retry-After` triggers exponential backoff with bounded retries; unit tests use a mocked clock/transport.
- **Token refresh:** `401` triggers a refresh via the keychain-held refresh token; refresh failure surfaces a re-connect prompt; tokens never appear in logs or test snapshots.
- **OAuth flow:** per-flow `state` parameter (CSRF) rejected if mismatched/absent; PKCE code-verifier/challenge round-trip; redirect URI validated against the allow-list; malicious/deep-link redirects rejected.
- **Scopes:** tests assert only the minimal default scopes are requested and that public/read scopes require explicit opt-in.
- **Revocation:** disconnect clears keychain tokens and revokes access, covered by an integration test.

### Post-MVP — Discovery, Enrichment & Multi-Provider (TD / TE / TX)

Shipped foundations (`TF`) are covered by existing suites: `similarity` (8 tests) and `providers` (4 tests) in `dj-assistant-core`; IPC contract tests for `find_similar_tracks` / `track_tag_health` / `store_links_for_track` / `provider_status`; migration 003 applies cleanly over 001/002.

Shipped live scope (`TE.1–TE.4`, `TM.2a`): `enrichment` parsers/confidence (11 tests against verified live API shapes); contract tests for preview/apply/undo + `enrichment:progress` + provider-match payloads; migration 004 verified (applies in order; preview/apply/undo SQL round-trip) with a desktop migration test run by `cargo test` on Ubuntu CI (on a local Windows-GNU toolchain the Tauri-linked harness cannot load — use MSVC for full `cargo test` or `pnpm rust:test:portable`).

- **Discovery:** snapshot determinism + taste-filter tests; feed-parser fixtures; external similarity returns carry a `source`; no auto-modification of sets (assertion).
- **Enrichment:** adapter fixtures from recorded responses; confidence-tier tests; undo round-trips per run; quota/backoff with mocked transport; source-hash-unchanged audit after apply.
- **Multi-provider:** per-provider matcher fixtures; chunked-add/backoff per API; undo (delete/unfollow) per provider; the no-audio invariant extended to every provider transport.

---

## 6. AI Automation Integration

### 6.1 Extended Development Loop

```
1. SELECT task
2. CONTEXT (+ this document + SECURITY_AND_PRIVACY.md)
3. BRANCH
4. PROMPT (must demand tests + security constraints)
5. IMPLEMENT (code + tests together)
6. VERIFY
     - unit / fixture tests
     - lint / types / clippy
     - security checklist for high-risk
     - source-hash check if mutating pipeline
7. COMMIT
8. PR (security + test plan sections required)
9. REVIEW (AI security pass + human)
10. FIX
11. MERGE
12. CLOSE
```

### 6.2 Implementation Prompt Additions (Mandatory Block)

Every implementation prompt to Claude/GPT must include:

```markdown
# Testing Requirements
- Add/update unit tests for new logic
- If analysis/cues: update or add golden fixtures
- If mutation (tags/cues/sets/skills): add undo test
- If FS paths: add traversal/negative tests
- If export: add snapshot or round-trip assertion
- Do not merge-quality code without tests for the happy path and one failure path

# Security Requirements
- Do not modify source audio files
- Canonicalize and jail all filesystem paths
- Treat any LLM output as untrusted; validate schema
- No secrets in code or logs
- Follow docs/engineering/SECURITY_AND_PRIVACY.md and docs/engineering/TESTING_AND_SECURITY.md
- List any new capability or network surface in the PR body
```

### 6.3 Review Prompt Additions

```markdown
# Security & Testing Review
- [ ] Tests added for new behavior?
- [ ] Failure paths covered?
- [ ] Source audio mutation impossible?
- [ ] Path handling safe?
- [ ] LLM output validated if applicable?
- [ ] Undo/preview present for mutations?
- [ ] High-risk area extra scrutiny done?
- [ ] CI tests pass?
```

### 6.4 CI Required Checks (Target)

| Check | Phase introduced |
|-------|------------------|
| Lint + typecheck + unit tests | 0 |
| `cargo clippy -D warnings` | 0 |
| Fixture/golden tests | 1 |
| `cargo audit` / dependency audit (scheduled or PR) | 0–1 |
| Export snapshot tests | 3 |
| Hash integrity pipeline test | 3 |
| E2E smoke (optional gate) | 4 |

PRs cannot merge with failing required checks.

---

## 7. Security Checklist (PR Template Fragment)

Copy into every high-risk PR:

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

---

## 8. Ongoing Security Improvements (Post-MVP Ready)

- Formal threat-model review before public 1.0
- Dependency update cadence (monthly) with changelog review
- Optional sandboxed analysis process isolation (OS-level) if warranted
- Bug bounty / responsible disclosure channel at public launch
- Periodic re-audit of Tauri capabilities and CSP
- Red-team exercise on Skill automation and LLM constraint path

---

## 9. Definition of Done — Testing & Security Extensions

A task is not done unless:

1. Existing Definition of Done from SDD is met, **and**
2. New logic has automated tests, **and**
3. Security checklist is satisfied for the change type, **and**
4. No reduction in golden fixture pass rate, **and**
5. For pipeline features: source-audio hash unchanged demonstration exists

---

## 10. Related Documents

- [Security & Privacy](./SECURITY_AND_PRIVACY.md)
- [AI Development Automation Plan](../devops/AI_DEVELOPMENT_AUTOMATION_PLAN.md)
- [Coding Standards](./CODING_STANDARDS.md)
- [SDD Acceptance Criteria](../sdd/05-ACCEPTANCE.md)
- [SDD Tasks](../sdd/04-TASKS.md)
- [Development Guide](./DEVELOPMENT.md)
