# GitHub Actions Workflow Templates

Copy these templates into `.github/workflows/` when the monorepo is scaffolded (Phase 0).

| Template | Target path | Purpose |
|----------|-------------|---------|
| [pr-ci.yml.md](./pr-ci.yml.md) | `.github/workflows/pr-ci.yml` | Required PR checks |
| [main-ci.yml.md](./main-ci.yml.md) | `.github/workflows/main-ci.yml` | Validation on `main` |
| — | `.github/workflows/desktop-build.yml` | Reusable macOS + Windows desktop build (called by both CIs) |
| [release.yml.md](./release.yml.md) | `.github/workflows/release.yml` | Tagged desktop releases |
| [nightly-audit.yml.md](./nightly-audit.yml.md) | `.github/workflows/nightly-audit.yml` | Scheduled security audits |
| [codeql.yml.md](./codeql.yml.md) | `.github/workflows/codeql.yml` | CodeQL SAST |

**Before production use:**
1. Pin Actions to full commit SHAs ([Pipeline Security](../CI_CD_PIPELINE_SECURITY.md)).
2. Adjust package-filter names to match the real monorepo layout.
3. Enable branch protection + required checks in GitHub settings.
4. Create Environment `release` with required reviewers for publish jobs.

YAML inside each `.md` file is the workflow body — strip the markdown fences when copying.

> **Live: `pr-ci.yml`, `main-ci.yml`, `desktop-build.yml`, `nightly-audit.yml`.** They exist
> in `.github/workflows/` and have been updated for the current workspace layout, the Linux
> WebKitGTK system dependencies Tauri needs, and the real `pnpm lint/typecheck/test` scripts.
> `pr-ci` and `main-ci` fan out to the reusable `desktop-build.yml` macOS/Windows matrix;
> `nightly-audit.yml` runs weekly and is non-blocking pending Phase 1 triage. The
> `release.yml` and `codeql.yml` templates here are **reference only** — they have not been
> activated, and `release.yml` additionally needs code-signing secrets and an Environment
> with required reviewers before it can be used. Treat the reference templates as design
> intent, not as a description of running CI.
