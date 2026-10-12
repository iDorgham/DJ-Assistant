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
> `nightly-audit.yml` runs weekly and **gates** on high/critical JS advisories and any RustSec
> vulnerability (task T0.1.15). The
> `release.yml` and `codeql.yml` templates here are **reference only** — they have not been
> activated, and `release.yml` additionally needs code-signing secrets and an Environment
> with required reviewers before it can be used. Treat the reference templates as design
> intent, not as a description of running CI.

---

## Branch protection — pending plan (Phase 0 exception, task T0.1.17)

`main` has **no protected branch** yet. Branch protection on a **private** repository requires
**GitHub Pro or above**; on the Free plan the API rejects the request with
`403 Upgrade to GitHub Pro or make this repository public to enable this feature`. The repository
is deliberately private, so this is recorded as a **documented Phase 0 exception** rather than a
silent gap.

Once the plan allows it (or the repo is made public), set these exact **required status checks**
(the check-run names produced on `main`) and enable *Require a pull request before merging*:

| Required check |
|---|
| `Full Validate` |
| `Desktop Build (macOS + Windows) / windows-latest` |
| `Desktop Build (macOS + Windows) / macos-latest` |

```bash
# protection.json — see the workflow templates above for the full body
gh api -X PUT repos/<owner>/<repo>/branches/main/protection --input protection.json
```

`require_code_owner_reviews` must stay **false** until the `@dj-assistant-*` teams referenced by
[`.github/CODEOWNERS`](../../../.github/CODEOWNERS) actually exist, otherwise PRs cannot be merged.
