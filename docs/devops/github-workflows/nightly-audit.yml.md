# Nightly / Scheduled Audit Template

**Target:** `.github/workflows/nightly-audit.yml`  
**Trigger:** schedule (weekly, Mondays 09:00 UTC) + `workflow_dispatch`  
**Purpose:** dependency CVEs — **gating** since task T0.1.15 (2026-10-12)

```yaml
name: Nightly Audit

on:
  schedule:
    - cron: '0 9 * * 1'   # 09:00 UTC Mondays (weekly)
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: nightly-audit-${{ github.workflow }}
  cancel-in-progress: true

jobs:
  audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # pnpm version comes from package.json "packageManager" (single source of truth).
      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: pnpm audit (production dependencies, high/critical)
        run: pnpm audit --prod --audit-level=high

      - name: Install cargo-audit
        # Prebuilt binary; avoids compiling cargo-audit on every run.
        uses: taiki-e/install-action@v2
        with:
          tool: cargo-audit

      - name: cargo audit (workspace lockfile)
        # Cargo.lock lives at the workspace root. Advisory severity has no
        # high/critical split, so this fails on any vulnerability.
        run: cargo audit
```

## Notes

- **Gating.** `pnpm audit --audit-level=high` fails on high/critical advisories in production
  (non-dev) JS dependencies. `cargo audit` fails on any RustSec **vulnerability**; the RustSec
  advisory format carries no CVSS severity, so "any vulnerability" is the strictest available
  gate. RustSec warnings (`unmaintained`, `unsound`) are printed but do not fail the job —
  triage them via Dependabot PRs.
- **Scope.** Audits the **workspace** `Cargo.lock`, not `apps/desktop/src-tauri` (there is only
  one lockfile, at the repo root). The desktop crate's dependencies are included as workspace
  members.
- Pair with Dependabot/Renovate for automated bump PRs (`.github/dependabot.yml`).
- Run it on demand from the Actions tab ("Run workflow") after a dependency bump.
