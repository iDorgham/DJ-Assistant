# Main Branch CI Template

**Target:** `.github/workflows/main-ci.yml`  
**Trigger:** push to `main`  
**Purpose:** Full validation after merge; catches integration issues

```yaml
name: Main CI

on:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: main-ci
  cancel-in-progress: true

jobs:
  full-validate:
    name: Full Validate
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
        with:
          components: rustfmt, clippy

      - name: Install JS
        run: pnpm install --frozen-lockfile

      - name: Lint / typecheck / test JS
        run: |
          pnpm lint
          pnpm typecheck
          pnpm test

      - name: Rust checks
        working-directory: apps/desktop/src-tauri
        run: |
          cargo fmt --check
          cargo clippy -- -D warnings
          cargo test

      - name: Install Linux Tauri deps
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Desktop build (release compile)
        run: pnpm --filter desktop build

  # Phase 1+: golden fixtures
  # golden-fixtures:
  #   runs-on: ubuntu-latest
  #   steps:
  #     - uses: actions/checkout@v4
  #     - ... setup ...
  #     - run: pnpm run test:golden
```

## Notes

- Keep parity with PR CI so `main` never diverges from what was tested.
- Add matrix OS builds here if PR CI stays Linux-only for speed.
