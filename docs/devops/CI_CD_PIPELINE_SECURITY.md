# DJ Assistant — CI/CD Pipeline Security

**Version:** 1.0  
**Date:** 2026-10-08  
**Status:** Binding for all GitHub Actions and release processes  
**Companions:** [DevOps & CI/CD Plan](./DEVOPS_CICD_PLAN.md) · [Testing & Security](../engineering/TESTING_AND_SECURITY.md) · [Security & Privacy](../engineering/SECURITY_AND_PRIVACY.md)

---

## 1. Objectives

1. Prevent secret leakage via CI logs, artifacts, or fork PRs.
2. Reduce supply-chain risk from Actions, dependencies, and build tools.
3. Ensure only trusted code paths can produce release artifacts.
4. Make pipeline security reviewable and testable (not tribal knowledge).
5. Align CI/CD controls with product guarantees (no audio in CI clouds, no credential sprawl).

---

## 2. Threat Model (Pipeline-Specific)

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Secret exfiltration via malicious PR | Critical | No secrets on `pull_request` from forks; use `pull_request_target` only with extreme care (prefer avoid) |
| Compromised GitHub Action | High | Pin actions to full SHA; prefer official actions; review third-party |
| Dependency confusion / malicious package | High | Lockfiles committed; audit CI; private registry not required for MVP |
| Poisoned cache | Medium | Scope caches by lockfile hash + branch; never cache secrets |
| Unsigned / tampered release artifacts | High | Checksums; later signing; release only from tags on `main` |
| Log injection / secret echo | Medium | Mask secrets; never `echo` credentials; review scripts |
| Self-hosted runner compromise | High | Use GitHub-hosted runners for MVP; if self-hosted later, isolate + ephemeral |
| OIDC / cloud credential misuse | Medium | Least-privilege roles; environment gates; short-lived tokens |
| Artifact containing sample user audio | Medium | CI fixtures only; no real user libraries in runners |

---

## 3. Hard Rules

1. **Pin Actions to commit SHA** (not floating `@v4` alone in production workflows long-term; tag + SHA pin is ideal).
2. **Least privilege `permissions:`** on every workflow (`contents: read` default; write only where required).
3. **No secrets in PR CI from forks.** Public fork PRs run with read-only token.
4. **Release publishing requires GitHub Environment protection** (required reviewers).
5. **Never upload real user audio or production databases to CI.**
6. **Lockfiles are source of truth** (`pnpm-lock.yaml`, `Cargo.lock` committed).
7. **Fail on critical vulnerabilities** once Phase 1 audit gate is enabled.
8. **CODEOWNERS** for `.github/workflows/**` and security-sensitive paths.

---

## 4. Workflow Permissions Baseline

```yaml
# Default for PR CI — minimal
permissions:
  contents: read
  pull-requests: read  # only if needed for comments

# Release workflow — explicit writes
permissions:
  contents: write   # for release assets
  id-token: write   # only if OIDC to cloud
```

Avoid `permissions: write-all`. Prefer job-level permissions over workflow-wide when possible.

---

## 5. Action Pinning Policy

```yaml
# Good — SHA pinned (example pattern)
- uses: actions/checkout@<full-git-sha>

# Acceptable during early Phase 0 with tracking issue to pin
- uses: actions/checkout@v4

# Bad
- uses: some-user/random-action@main
```

Maintain a short allowlist of Actions:

| Action | Purpose |
|--------|---------|
| `actions/checkout` | Clone |
| `actions/setup-node` | Node toolchain |
| `dtolnay/rust-toolchain` or `actions-rs` successors | Rust toolchain |
| `pnpm/action-setup` | pnpm |
| `actions/cache` | Build caches |
| `actions/upload-artifact` | CI artifacts |
| `softprops/action-gh-release` | Releases (pin SHA) |
| `github/codeql-action/*` | CodeQL |

New Actions require tech-lead approval and SHA pin before use on `main`.

---

## 6. Secrets Management

| Secret type | Storage | CI access |
|-------------|---------|-----------|
| Code signing certs/passwords | GitHub Environment `release` | Release job only |
| Notarization credentials | Environment `release` | macOS release job only |
| Notification webhooks | Repository or environment secrets | Optional notify job |
| Cloud API keys (LLM, etc.) | **Not in desktop CI** | Separate API deploy pipelines only |
| Personal access tokens | Avoid; prefer `GITHUB_TOKEN` | — |

**Practices:**
- Rotate signing credentials on schedule and on staff change
- Mask all secrets in GitHub UI
- Prohibit secrets in `GITHUB_OUTPUT` or world-readable files
- Use OIDC + cloud roles instead of long-lived cloud keys when cloud CD exists

---

## 7. Fork and `pull_request_target` Policy

- Prefer `pull_request` for CI (safe defaults).
- **Do not use `pull_request_target`** for build/test with secrets.
- If untrusted contributor PRs need labeling bots, isolate to a workflow with `contents: read` only and no checkout of untrusted build scripts with elevated perms.

---

## 8. Dependency & Supply-Chain Controls

| Control | Implementation |
|---------|----------------|
| Lockfiles | Commit `pnpm-lock.yaml` + `Cargo.lock` |
| Audit (Rust) | `cargo audit` in nightly + PR on lock change |
| Audit (JS) | `pnpm audit --prod` (tune severity gate) |
| Dependabot / Renovate | Enable for Actions + cargo + npm |
| SBOM | Generate on release (CycloneDX/syft) |
| Binary provenance | GitHub Artifact Attestations (optional Phase 4+) |

---

## 9. Artifact Security

1. CI build artifacts (unsigned) expire quickly (e.g. 7–14 days).
2. Release artifacts include **SHA-256 checksums** file.
3. Prefer immutable releases (do not overwrite assets on same tag).
4. Sample/fixture audio only — licensed or synthetic — in repo or test data store.
5. Never attach `.env`, keystores, or user library dumps to releases.

---

## 10. Static Analysis & SAST

| Tool | When |
|------|------|
| ESLint security-ish rules | Every PR |
| Clippy | Every PR |
| CodeQL (JS/TS + Rust if supported) | Scheduled + PR (recommended) |
| `cargo audit` | Scheduled + lockfile PRs |
| Secret scanning (GitHub Advanced Security or push protection) | Enable on repo |

---

## 11. Pipeline Security Checklist (Workflow PR)

Any change under `.github/workflows/` must complete:

```markdown
## Pipeline Security Checklist
- [ ] `permissions:` is least privilege
- [ ] Actions pinned (SHA or approved tag with tracking)
- [ ] No secrets used on fork PR paths
- [ ] No `pull_request_target` unless justified and reviewed
- [ ] Caches do not include secrets or credentials
- [ ] Release jobs use Environment protection
- [ ] Scripts do not echo secrets
- [ ] CODEOWNERS notified / approved
```

---

## 12. Incident Response (CI/CD)

| Event | Response |
|-------|----------|
| Secret leaked in logs | Revoke/rotate immediately; purge logs if possible; postmortem |
| Malicious dependency detected | Pin/revert; audit lockfile; rotate any exposed tokens |
| Compromised Action | Pin away from bad SHA; audit recent runs; revoke secrets used in window |
| Tampered release | Yank/unpublish if possible; re-cut tag from clean `main`; notify users |

---

## 13. Alignment with Product Security

| Product rule | Pipeline implication |
|--------------|----------------------|
| Raw audio never leaves device | CI must not upload user audio; fixtures only |
| Local-first analysis | Desktop CI builds ONNX path locally on runner; no cloud analysis API required for core tests |
| No secrets in client | Desktop build env must not bake API keys into binaries |
| Reversible Skills | Not directly a CI concern; enforced by unit/integration tests in PR CI |

---

## 14. Related Documents

- [DevOps & CI/CD Plan](./DEVOPS_CICD_PLAN.md)
- [Testing & Security Plan](../engineering/TESTING_AND_SECURITY.md)
- [Security & Privacy](../engineering/SECURITY_AND_PRIVACY.md)
- [GitHub workflow templates](./github-workflows/)
