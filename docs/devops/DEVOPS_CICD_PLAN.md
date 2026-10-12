# DJ Assistant — DevOps & CI/CD Plan

**Version:** 1.0  
**Date:** 2026-10-08  
**Status:** Ready for Phase 0 implementation  
**Companions:** [CI/CD Pipeline Security](./CI_CD_PIPELINE_SECURITY.md) · [Testing & Security](../engineering/TESTING_AND_SECURITY.md) · [AI Development Automation](./AI_DEVELOPMENT_AUTOMATION_PLAN.md)

---

## 1. Goals

1. Every PR is automatically linted, typechecked, tested, and (where applicable) audited before merge.
2. `main` / release tags produce signed, reproducible desktop artifacts (macOS + Windows).
3. Secrets never appear in logs, PRs, or artifacts.
4. Supply-chain risk is reduced via lockfiles, pinned actions, and dependency audits.
5. Phase exits and releases are gated by the same automated checks plus human acceptance criteria.

---

## 2. Pipeline Overview

```
Developer / AI Agent
        │
        ▼
   feature branch ── push ──► GitHub
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              PR opened/updated        push to main/tag
                    │                       │
                    ▼                       ▼
            CI — PR Pipeline          CD — Release Pipeline
            • lint / format             • full CI
            • typecheck                 • desktop build matrix
            • unit + fixture tests      • artifact upload
            • clippy                    • sbom / checksums
            • security quick checks     • GitHub Release (manual approve)
            • build compile (no ship)
                    │
                    ▼
              Required checks green
                    │
                    ▼
              Review + merge
```

---

## 3. Environments

| Environment | Purpose | Deploy target |
|-------------|---------|---------------|
| **Local** | Dev machine | Tauri dev + optional local API/Docker |
| **CI** | Ephemeral GitHub-hosted runners | None (validate only) |
| **Staging** (optional post-MVP) | Cloud API + test workspaces | Separate GCP/AWS/Fly project |
| **Production** | Public/beta users | Desktop binaries + production API |

MVP focus: **Local + CI + signed desktop releases**. Cloud staging/production follows when WS5 lands.

---

## 4. Branch → Pipeline Mapping

| Event | Workflow | Required to merge? |
|-------|----------|-------------------|
| PR to `develop` or `main` | `pr-ci.yml` | Yes |
| Push to `main` | `main-ci.yml` (full validation) | N/A |
| Tag `v*` | `release.yml` | Manual approval for publish |
| Schedule (nightly/weekly) | `nightly-audit.yml` | N/A |
| Lockfile change | dependency audit job in PR CI | Yes if critical CVEs |

---

## 5. Required PR Checks (Merge Gates)

| Check | Tooling | Phase introduced |
|-------|---------|------------------|
| Format / lint JS-TS | ESLint + Prettier | 0 |
| Typecheck | `tsc --noEmit` | 0 |
| Unit tests JS-TS | Vitest | 0 |
| Rust fmt | `cargo fmt --check` | 0 |
| Clippy | `cargo clippy -D warnings` | 0 |
| Rust unit tests | `cargo test` | 0 |
| Build desktop (compile) | `tauri build` or `cargo build` | 0–1 |
| Golden fixtures | custom script | 1 |
| Export snapshots | custom script | 3 |
| Dependency audit | `cargo audit`, `pnpm audit --audit-level=high` | 1 (gated; weekly schedule) |

All required checks must be **green** before merge (see AI Automation Plan merge rules).

---

## 6. CD — Release Pipeline

### Triggers
- Git tag matching `v*.*.*` created from `main`
- Optional: workflow_dispatch with version input (release managers only)

### Steps
1. Checkout at tag (immutable)
2. Run full CI suite
3. Build matrix:
   - macOS (universal or arm64+x64 as decided)
   - Windows (x64)
   - Linux (optional for MVP)
4. Generate checksums (SHA-256) for every artifact
5. Generate SBOM (e.g. CycloneDX or syft) — recommended
6. Upload artifacts to GitHub Release (draft by default)
7. **Human approval** to publish release (environment protection)
8. Optional: notify Discord/Slack webhook (no secrets in logs)

### Versioning
Aligned with [AI Development Automation Plan](./AI_DEVELOPMENT_AUTOMATION_PLAN.md) SemVer:
- Phase exits → minor bumps while `0.x`
- Public MVP → `1.0.0`

---

## 7. Caching Strategy

| Cache | Key includes | Purpose |
|-------|--------------|---------|
| pnpm store | lockfile hash | Fast JS installs |
| Rust target / cargo registry | `Cargo.lock` + OS | Fast Rust builds |
| Tauri / GTK deps (Linux) | runner OS image | Avoid rebuild of system libs |

Caches must not store secrets. Invalidate on lockfile change.

---

## 8. Secrets & Variables

| Name | Scope | Usage |
|------|-------|-------|
| `CODE_SIGN_IDENTITY` / certs | Release env only | macOS/Windows code signing (when enabled) |
| `APPLE_ID` / `APP_PASSWORD` | Release env | Notarization (macOS, when enabled) |
| `AZURE_CREDENTIALS` or SSL.com | Release env | Windows signing alternative |
| `SLACK_WEBHOOK` | Optional | Release notifications |
| OpenAI/Anthropic keys | **Never** in desktop CI | Cloud API only; not needed for core desktop CI |

**Rules:**
- Prefer GitHub Environments (`release`) with required reviewers
- Secrets never echoed; mask in logs
- PRs from forks get **read-only** secrets (GitHub default) — do not rely on secrets for PR CI

---

## 9. Code Signing & Notarization (Phased)

| Phase | Policy |
|-------|--------|
| 0–2 | Unsigned internal builds OK for team |
| 3–4 | Introduce signing for beta distribution |
| 1.0 | Signed + notarized (macOS) / signed (Windows) required for public |

Document exact cert storage in team password manager; only release environment has access.

---

## 10. Monorepo Commands (Targets)

```bash
# JS
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter desktop build

# Rust (from apps/desktop/src-tauri)
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cargo build --release

# Combined local pre-push
pnpm ci:local   # script: lint + typecheck + test + cargo test
```

CI should call the same scripts developers run locally to avoid “works on my machine” drift.

---

## 11. Workflow File Map

Templates live in `docs/devops/github-workflows/` (copy into `.github/workflows/` at scaffold time):

| File | Purpose |
|------|---------|
| [pr-ci.yml.md](./github-workflows/pr-ci.yml.md) | PR validation (required checks) |
| [main-ci.yml.md](./github-workflows/main-ci.yml.md) | Post-merge validation on main |
| [release.yml.md](./github-workflows/release.yml.md) | Tagged release builds + artifacts |
| [nightly-audit.yml.md](./github-workflows/nightly-audit.yml.md) | Scheduled dependency & security audit |
| [codeql.yml.md](./github-workflows/codeql.yml.md) | CodeQL / static analysis (optional but recommended) |

---

## 12. Phase Rollout of CI/CD

### Phase 0
- [ ] `.github/workflows/pr-ci.yml` active
- [ ] Required status checks on `main` / `develop`
- [ ] Branch protection: no direct push to `main`
- [ ] `pnpm ci:local` and cargo checks documented

### Phase 1
- [ ] Golden fixture job in CI
- [x] `cargo audit` gated on critical — *landed early in Phase 0 (T0.1.15): `nightly-audit.yml` gates weekly on any RustSec vulnerability and on `pnpm audit --audit-level=high`*
- [ ] Build compile job stable on macOS + Windows runners

### Phase 3
- [ ] Export snapshot tests in CI
- [ ] Hash-audit script job (sample fixtures)
- [ ] Release workflow draft artifacts on tag

### Phase 4 / MVP
- [ ] Code signing integrated for beta
- [ ] SBOM attached to releases
- [ ] Environment protection on publish
- [ ] Nightly audit + CodeQL on default schedule

---

## 13. Ownership

| Area | Owner |
|------|-------|
| Workflow YAML | Desktop/Platform lead |
| Secrets / signing | Founder or designated release manager |
| Required checks policy | Tech lead |
| Failure triage | PR author (AI or human) within 24h |

---

## 14. Related Documents

- [CI/CD Pipeline Security](./CI_CD_PIPELINE_SECURITY.md)
- [Testing & Security Plan](../engineering/TESTING_AND_SECURITY.md)
- [AI Development Automation Plan](./AI_DEVELOPMENT_AUTOMATION_PLAN.md)
- [Development Guide](../engineering/DEVELOPMENT.md)
- [SDD Tasks](../sdd/04-TASKS.md)
