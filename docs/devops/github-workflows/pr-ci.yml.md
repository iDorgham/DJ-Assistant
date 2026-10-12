# PR CI Workflow Template

**Target:** `.github/workflows/pr-ci.yml`  
**Trigger:** pull_request to `main` or `develop`  
**Security:** `contents: read` only; no release secrets

```yaml
name: PR CI

on:
  pull_request:
    branches: [main, develop]

permissions:
  contents: read
  pull-requests: read

concurrency:
  group: pr-ci-${{ github.workflow }}-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  js-lint-test:
    name: JS/TS Lint, Typecheck, Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup pnpm
        uses: pnpm/action-setup@v6
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test

  rust-lint-test:
    name: Rust Fmt, Clippy, Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/desktop/src-tauri
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - name: Cache cargo
        uses: actions/cache@v6
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: fmt
        run: cargo fmt --check

      - name: clippy
        run: cargo clippy -- -D warnings

      - name: test
        run: cargo test

  # Desktop build check on both supported platforms (macOS + Windows).
  # Implemented as a reusable workflow shared by PR CI and Main CI:
  # `.github/workflows/desktop-build.yml` (matrix: windows-latest, macos-latest).
  desktop-build:
    uses: ./.github/workflows/desktop-build.yml

  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
        with:
          version: 9
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install --frozen-lockfile
      - name: pnpm audit (prod)
        run: pnpm audit --prod || true
        # Tighten to fail on critical in Phase 1+
      - name: cargo audit
        working-directory: apps/desktop/src-tauri
        run: |
          cargo install cargo-audit --locked || true
          cargo audit || true
        # Gate on critical starting Phase 1
```

## Notes

- Replace `|| true` on audits with hard fail once baselines are clean.
- Add golden fixture job in Phase 1 as a separate job or step.
- Pin Action SHAs before public launch (see CI_CD_PIPELINE_SECURITY.md).
