# Nightly / Scheduled Audit Template

**Target:** `.github/workflows/nightly-audit.yml`  
**Trigger:** schedule (e.g. daily) + workflow_dispatch  
**Purpose:** Dependency CVEs, outdated Actions heads, soft failure visibility

```yaml
name: Nightly Audit

on:
  schedule:
    - cron: '0 6 * * *'   # 06:00 UTC daily
  workflow_dispatch:

permissions:
  contents: read
  issues: write   # optional: open issue on critical findings

jobs:
  audit:
    name: Dependency & Toolchain Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: dtolnay/rust-toolchain@stable

      - run: pnpm install --frozen-lockfile

      - name: pnpm audit
        run: pnpm audit --prod

      - name: cargo audit
        working-directory: apps/desktop/src-tauri
        run: |
          cargo install cargo-audit --locked
          cargo audit

      # Optional: fail job and open issue via gh cli / action on critical
```

## Notes

- Start with notifications; move to hard-fail for critical CVEs after baseline cleanup.
- Pair with Dependabot/Renovate for automated bump PRs.
