# Release Workflow Template

**Target:** `.github/workflows/release.yml`  
**Trigger:** tag `v*.*.*` or workflow_dispatch  
**Security:** Environment `release` with required reviewers; minimal write permissions

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Tag to build (e.g. v0.1.0)'
        required: true

permissions:
  contents: write

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build-macos:
    name: Build macOS
    runs-on: macos-latest
    environment: release
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'workflow_dispatch' && github.event.inputs.tag || github.ref }}

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: dtolnay/rust-toolchain@stable

      - run: pnpm install --frozen-lockfile

      - name: Build Tauri (macOS)
        run: pnpm --filter desktop tauri build
        # env:
        #   APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
        #   APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        #   APPLE_ID: ${{ secrets.APPLE_ID }}
        #   ... only when signing enabled

      - name: Checksums
        run: |
          cd target/release/bundle || true
          find . -type f \( -name '*.dmg' -o -name '*.app' -o -name '*.tar.gz' \) -print0 | xargs -0 shasum -a 256 > checksums-macos.txt || true

      - uses: actions/upload-artifact@v4
        with:
          name: macos-release
          path: |
            target/release/bundle/**/*.dmg
            target/release/bundle/**/*.app
            checksums-macos.txt
          if-no-files-found: warn
          retention-days: 14

  build-windows:
    name: Build Windows
    runs-on: windows-latest
    environment: release
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'workflow_dispatch' && github.event.inputs.tag || github.ref }}

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: dtolnay/rust-toolchain@stable

      - run: pnpm install --frozen-lockfile

      - name: Build Tauri (Windows)
        run: pnpm --filter desktop tauri build

      - name: Checksums
        shell: pwsh
        run: |
          Get-ChildItem -Recurse -Include *.msi,*.exe |
            Get-FileHash -Algorithm SHA256 |
            ForEach-Object { "$($_.Hash)  $($_.Path)" } |
            Out-File -FilePath checksums-windows.txt

      - uses: actions/upload-artifact@v4
        with:
          name: windows-release
          path: |
            target/release/bundle/**/*.msi
            target/release/bundle/**/*.exe
            checksums-windows.txt
          if-no-files-found: warn
          retention-days: 14

  publish-github-release:
    name: Publish GitHub Release
    needs: [build-macos, build-windows]
    runs-on: ubuntu-latest
    environment: release
    steps:
      - uses: actions/checkout@v4

      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          path: release-assets

      - name: Create / update release
        uses: softprops/action-gh-release@v2
        with:
          draft: true
          generate_release_notes: true
          files: |
            release-assets/**/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Security Notes

- `environment: release` must require manual approval in GitHub settings.
- Signing secrets only referenced in release jobs, never in PR CI.
- Keep `draft: true` until a human verifies artifacts and publishes.
- Pin `softprops/action-gh-release` to SHA before public use.
