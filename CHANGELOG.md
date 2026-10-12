# Changelog

All notable changes to DJ Assistant are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **GitHub repository + green CI** — the workspace is now under version control and pushed to
  `github.com/iDorgham/dj-assistant` (private, `main`). The **first Main CI run (`38219344042`) is
  green on all three jobs**: *Full Validate* on `ubuntu-latest` (lint / typecheck / tests +
  `cargo fmt --check` / `clippy -D warnings` / `cargo test`) and the reusable `desktop-build` matrix
  on both **`windows-latest`** and **`macos-latest`** — which closes the macOS half of Phase 0
  criterion **P0.1**. A `.gitattributes` pins LF for cross-platform checkouts.
- **Dependabot** (`.github/dependabot.yml`) — weekly grouped updates for the pnpm workspace, the
  Cargo workspace and GitHub Actions.
- **Tauri-free core crate** `crates/core` (`dj-assistant-core`) holding the audio discovery
  rules, BLAKE3 fingerprinting, tag metadata extraction, RIFF/AIFF duration parsers and scan
  de-duplication. Keeping this free of Tauri keeps it unit-testable on any toolchain,
  including `stable-x86_64-pc-windows-gnu` where the Tauri-linked test harness cannot load.
  `apps/desktop/src-tauri` is now the thin IPC layer on top.
- **Synthetic audio fixture corpus** — `scripts/make-fixtures.py` generates 14 deterministic,
  byte-stable fixtures plus `fixtures/audio/manifest.json`: tagged WAV/FLAC/AIFF/MP3 and a tagged
  M4A (uncompressed PCM in an MPEG-4 Part 14 container — no AAC/ALAC encoder exists in this
  toolchain), a no-tag WAV, Unicode and apostrophe filenames, four deliberately corrupt files
  (truncated WAV, garbage MP3, empty FLAC, header-only AIFF), an unsupported `.txt`, and a
  byte-identical duplicate pair. No licensed audio is required and regeneration is
  idempotent.
- **Manifest-driven fixture tests** — `crates/core/tests/fixture_manifest.rs` and
  `crates/core/tests/scan_corpus.rs` (15 integration tests) assert exact tags, durations,
  formats and duplicate relationships against the manifest, and drive the full scan pipeline
  over the corpus. A new assertion pins the manifest's `supported_extensions` to
  `dj_assistant_core::SUPPORTED_EXTENSIONS`, and the M4A fixture closes the last advertised but
  untested extension.
- **RIFF/WAVE duration parser** — `crates/core/src/riff.rs`, reading the `fmt `/`data` chunks.
- **AIFF duration parser** — `crates/core/src/aiff.rs`, reading `numSampleFrames` and the
  80-bit extended `sampleRate` from the `COMM` chunk.
- **Scan de-duplication** — `crates/core/src/dedup.rs` (`ScanDeduplicator`, `DuplicateKind`)
  with 8 unit tests.
- **Schema/query contract tests** — `tests/schema` (`dj-assistant-schema-tests`) with 8 tests
  covering migration application, the `tracks`/`cue_points`/`workspaces` schema, the exact
  SELECT column lists used by `list_tracks` and `get_track`, the unique
  `(workspace_id, file_hash)` dedup constraint, FK cascade behaviour, and nullable `slot` for
  memory cues. Runs on any toolchain because it does not link Tauri.
- **Real JS/TS test suites** (15 tests) replacing scripts that always reported success:
  - `apps/desktop` — 7 tests for library helpers (duration formatting, search matching, scan
    progress, hash shortening)
  - `packages/shared` — 6 tests guarding the Rust↔TypeScript camelCase IPC contract
  - `apps/api` — 2 tests exercising `GET /health` via Fastify `inject`
- **Desktop helpers module** — `apps/desktop/src/lib/library.ts`, extracted from `App.tsx` so
  the library view logic is unit-testable without a DOM or Tauri runtime.
- **App icons** — `apps/desktop/src-tauri/icons/` (32/128/256/512 PNG, `.ico`, `.icns`, plus
  Windows Store, iOS and Android variants), generated from `app-icon.png`.
- **Phase 0 acceptance evidence** — `docs/engineering/PHASE0_ACCEPTANCE_EVIDENCE.md` records how each P0.x
  criterion was verified and what remains outstanding.
- **Tooling config** — `.prettierrc.json`, `.prettierignore`, `.gitignore`, and
  `eslint.config.mjs` (ESLint 10 flat config: `@eslint/js`, `typescript-eslint`,
  `react-hooks`, `eslint-config-prettier`).
- **Scripts** — `scripts/make-fixtures.py`, `scripts/inspect-db.py`,
  `scripts/show-fixture-durations.py`, `scripts/make_icon.py`, `scripts/update-task-docs.py`,
  `scripts/summarize-scan.py`, `scripts/crosscheck-durations.py`.
- **Tag-sourced library slice (tags → store → display)** — embedded cover art, BPM, key, rating
  and comments are read from the file tags at import time (no ONNX analysis) and surfaced in the
  library list:
  - `crates/core/src/metadata.rs` — `EmbeddedArtwork`/`CachedArtwork`, `cache_artwork()`
    (content-addressed by the BLAKE3 of the image bytes) and `camelot_from_key()`. Extras that
    `audiotags` does not expose are read via `id3` on ID3-bearing containers and `metaflac` on
    FLAC.
  - **Migration `002_track_tags.sql`** — `comments`, `artwork_hash`, `artwork_path`,
    `artwork_mime` plus an `artwork_hash` index; `bpm`/`key_camelot`/`key_classical`/
    `user_rating` are reused from migration 001. Only the artwork *reference* is stored, never
    the image bytes.
  - **`get_artwork` IPC command** — resolves to a `data:` URL, or `null` for tracks with no
    cached art, so a missing thumbnail is never an error.
  - `TrackSummary` gains `keyClassical`, `comments` and `artworkHash` across the Rust model,
    `packages/shared` and the IPC contract tests.
- **MP3 duration parser** — `crates/core/src/mp3.rs`. `audiotags` exposes no MP3 duration, so
  every imported MP3 sat at `0 ms` — the bulk of a real DJ library. Duration is read from the
  Xing/Info header (exact frame count), then VBRI, then a CBR byte-rate estimate; the payload is
  never decoded and malformed input degrades to `None` instead of panicking.
- **Headless `dj-scan` binary** — `crates/core/src/bin/scan.rs` (gated behind the `cli` feature)
  runs the same discover → fingerprint → dedup → metadata → SQLite pipeline against a real
  folder, so a full library can be verified and cross-checked without driving the native GUI
  file picker.
- **Reusable desktop build matrix** — `.github/workflows/desktop-build.yml` builds the frontend
  and `cargo build -p dj-assistant-desktop` on `windows-latest` **and** `macos-latest`, and is
  called as a job from both `pr-ci.yml` and `main-ci.yml`.
- **Dependency audit gating** — `.github/workflows/nightly-audit.yml` now **gates** weekly
  (Mondays 09:00 UTC): `pnpm audit --prod --audit-level=high` fails on high/critical JS
  advisories, and `cargo audit` (installed from a prebuilt binary via `taiki-e/install-action`,
  run against the workspace `Cargo.lock`) fails on any RustSec vulnerability. Non-vulnerability
  RustSec warnings (`unmaintained`/`unsound`) are reported but do not fail the job. The workflow
  is also manually runnable via `workflow_dispatch` (task T0.1.15).
- **GUI acceptance evidence** — `docs/evidence/phase0/*.png` (94-track library,
  search-filtered list, post-relaunch list) backing the P0.2/P0.6/P0.8 claims.

### Changed

- **TypeScript 6.0** — bumped `typescript` to `^6.0.3` across the workspace (supersedes Dependabot
  PR #13). TS 6 turns two previously-accepted `apps/desktop` patterns into errors: `TS2882`
  (side-effect `import './index.css'` now needs an ambient module declaration) and `TS2591`
  (`node:test` / `node:assert/strict` need `@types/node`). Fixed by adding
  `"types": ["node", "vite/client"]` to `apps/desktop/tsconfig.json` and `@types/node` to the
  desktop dev dependencies; the desktop `tsc && vite build` passes.
- **`rusqlite` 0.31 → 0.40** across the workspace (still `bundled`; supersedes Dependabot PR #7).
  rusqlite 0.40 removed the `usize` `FromSql` impl, so `list_tracks` now reads `COUNT(*)` as `i64`
  and narrows it (`apps/desktop/src-tauri/src/commands.rs`). Verified with a full portable pass
  (`cargo clippy -D warnings`, `cargo fmt`, and the core + schema test suites).
- **GitHub Actions bumped off the deprecated Node 20 runtime** — `actions/checkout` v4→v7,
  `actions/setup-node` v4→v7, `actions/cache` v4→v6 and `pnpm/action-setup` v4→v6 across the four
  live workflows (`pr-ci`, `main-ci`, `desktop-build`, `nightly-audit`) and the
  `docs/devops/github-workflows/*.md` templates. Clears the runner's
  *"Node.js 20 is deprecated"* warning (all four now target Node 24) and supersedes the four
  Dependabot `github_actions` PRs.
- **Tailwind CSS v3 → v4** (`^4.3.3`; supersedes Dependabot PR #9). Swapped the PostCSS
  (`tailwindcss` + `autoprefixer`) pipeline for the official `@tailwindcss/vite` plugin, so
  `postcss.config.js`, `tailwind.config.js` and the `autoprefixer`/`postcss` dev deps are gone —
  content detection is automatic. `src/index.css` now starts with `@import "tailwindcss"` and the
  custom `dj` palette moved from `theme.extend.colors` into `@theme`. Classes renamed to their v4
  equivalents in `App.tsx` to keep the exact v3 look: `bg-gradient-to-tr`→`bg-linear-to-tr`,
  `placeholder-slate-500`→`placeholder:text-slate-500`, `focus:outline-none`→`focus:outline-hidden`,
  and the scale renames bare `rounded`→`rounded-sm` / bare `shadow`→`shadow-sm`.
- **Vite 6 → 8 (Rolldown) + `@vitejs/plugin-react` 4 → 6** (`vite ^8.3.4`, supersedes Dependabot
  PR #11, which previously failed with `ERR_PACKAGE_PATH_NOT_EXPORTED` on the Vite 6 `./internal`
  export). `@tailwindcss/vite` supports Vite 8, and React 18 stays put — plugin-react 6 declares no
  `react` peer. Verified with `tsc && vite build`; the generated CSS contains the expected v4
  utilities (`bg-linear-to-tr`, `placeholder:text-slate-500`, `focus:outline-hidden`).
- **CI workflows** — removed the duplicate pnpm version (`version: 10`) so `pnpm/action-setup` reads
  the version from `package.json` `packageManager` (single source of truth); Ubuntu jobs now install
  the canonical `libayatana-appindicator3-dev` (plus `libxdo-dev`/`libssl-dev`) instead of the
  deprecated `libappindicator3-dev`; the Linux *Full Validate* job caches cargo.

- **`extract_metadata` moved to `dj-assistant-core`** and hardened: AIFF support via an `id3`
  fallback, `TDRC` year handling, container duration fallbacks, and blank-tag trimming.
  `blake3`/`audiotags`/`walkdir` are no longer direct desktop dependencies.
- **Cue point column reconciled to `slot`.** The migration defined `hot_cue_index` while
  `commands.rs` selected `slot` and `docs/architecture/API_CONTRACTS.md` documented `slot`. Any `get_track`
  call would have failed at runtime. The schema, the canonical documentation and
  `docs/architecture/DATA_MODEL.md` now consistently use `slot` (1–8, nullable for memory cues), matching
  `models.rs`, `packages/shared` and `API_CONTRACTS.md`.
- **Foreign-key enforcement enabled** — SQLite defaults `PRAGMA foreign_keys` to OFF, so the
  `ON DELETE CASCADE` clauses on `tracks.workspace_id` and `cue_points.track_id` were silently
  doing nothing and orphaned cue rows were possible. `Database::apply_pragmas` now turns on
  foreign keys and sets `journal_mode = WAL` / `synchronous = NORMAL`.
- **`crate-type` reduced to `["rlib"]`** (was `["staticlib", "cdylib", "rlib"]`). The
  staticlib/cdylib types are only needed for Tauri mobile targets and MinGW's `ld` rejects them
  with `export ordinal too large: 102402`. A comment documents how to restore them.
- **Duration tolerance tightened** in the fixture tests from 1100 ms to 200 ms. The old value
  was loose enough that a completely broken 0 ms duration still passed, which is how the
  WAV/AIFF duration bugs below went unnoticed.
- **`scanner.rs`** now uses `discover_audio_files` (sorted, deterministic order) and
  `ScanDeduplicator`, and releases a fingerprint claim when an import fails.
- **CI/local scripts** — `pnpm lint` now runs Prettier **and `eslint .`** (new `lint:eslint`
  script) instead of echoing success; package `test` scripts no longer mask failures with
  `|| echo` and no longer use the Windows-only `2>nul` redirect (invalid on the Linux CI
  runner). `pnpm ci:local` now matches CI by including `cargo fmt`,
  `cargo clippy -D warnings` and `cargo test`.
- **Scripts** — added `lint:root`, `format`, `rust:test:portable` and `ci:local:portable`. The
  portable variants cover `dj-assistant-core` too, so the full pipeline can run on the GNU
  toolchain.
- **CI workflows** — Linux WebKitGTK system dependencies for the Tauri jobs, workspace-wide
  `cargo fmt --all` / `cargo clippy --all-targets` / `cargo test`, and corrected cache paths
  (`target` instead of the crate-local directory). Both `pr-ci.yml` and `main-ci.yml` now fan
  out to the reusable `desktop-build.yml` macOS/Windows matrix.
- **Documentation reorganised into category folders.** The flat `docs/` directory is now grouped
  into `product/`, `architecture/`, `engineering/` and `devops/` (joining the existing `sdd/`,
  `ADR/`, `diagrams/` and `evidence/`); `github-workflows/` moved under `devops/` and the root
  `DJ-Assistant-Canonical-Documentation.md` became `docs/product/CANONICAL_DOCUMENTATION.md`.
  A new `docs/README.md` acts as the documentation index, and every cross-document link, README
  and helper script (`scripts/update-task-docs.py`, `scripts/download-models.sh`) was updated to
  match.
- **`docs/devops/github-workflows/*.md`** — corrected stale `apps/desktop/src-tauri/target` paths and
  the README now states which workflows are live (`pr-ci.yml`, `main-ci.yml`,
  `desktop-build.yml`, `nightly-audit.yml`) versus reference-only
  (`release.yml`, `codeql.yml`).
- **`docs/engineering/WINDOWS_NATIVE_BUILD_RUNBOOK.md`** — documents the MSVC requirement, the
  space-in-path `windres` failure and the `CARGO_TARGET_DIR` workaround, corrects the build
  output path for the workspace layout, and adds five troubleshooting rows.
- **`README.md`** — project status updated from "Pre-development" to "Phase 0 in progress".
- **Task lists reconciled** — Phase 0 items in `docs/sdd/04-TASKS.md` and
  `docs/engineering/DEVELOPMENT_TASK_LIST.md` checked off against verified evidence.
- **Rust sources reformatted** with `cargo fmt` and Clippy lints fixed
  (`manual_flatten` ×2, `unnecessary_cast` ×1, `repeat().take()` ×2) so
  `clippy -D warnings` passes.
- **Leftover build artifacts removed** — orphaned crate-local `target/` (3.11 GB) and stale
  `dist/` output that Prettier was scanning.

### Fixed

- **`tauri-build` failed with `icons/icon.ico not found`** — the bundle icons referenced by
  `tauri.conf.json` did not exist, so no build ever completed.
- **`windres: preprocessing failed`** when the repository path contains a space (the
  `DJ Assistant` folder name).
- **AIFF tags were never read.** `audiotags` 0.5 has no AIFF backend and returns
  `Unsupported format: aiff`, so every `.aif`/`.aiff` import silently fell back to a
  filename-derived title and "Unknown Artist", despite AIFF being an advertised supported
  format.
- **WAV and AIFF durations were always `0 ms`**, so the library UI showed `--:--` for every
  such track. Both are now parsed from the file header.
- **MP3 durations were always `0 ms`.** `audiotags` reports none for MP3 either, so `--:--`
  showed for the bulk of a DJ library. Now parsed from MPEG frame headers (`mp3.rs`) and
  confirmed against ffprobe 7.0 over the real 94-track library — **worst delta 0 ms**.
- **ID3v2.4 `TDRC` years were lost** on MP3 and AIFF (`audiotags` does not map the frame).
- **Intra-scan duplicates were mis-reported as import errors.** The scanner checked only the
  database; because rows insert *after* the check, two copies of a file in one scan both
  passed it and the second insert violated `UNIQUE(workspace_id, file_hash)`.
- **WAL was silently not applied** — `execute_batch` discards `PRAGMA journal_mode`'s result,
  so the failure was invisible. Verified via the database file header.
- `pnpm test` failed the whole recursive run because `@dj-assistant/desktop` had no `test`
  script.

### Known issues

- **Full `cargo test` requires the MSVC toolchain on Windows.** With
  `stable-x86_64-pc-windows-gnu`, the Tauri-linked test harness aborts at load with
  `STATUS_ENTRYPOINT_NOT_FOUND (0xC0000139)` while resolving WebView2 imports. The app binary
  itself builds and runs on GNU; only the test harness is affected. Use
  `pnpm rust:test:portable` on GNU, or install MSVC.
- **MSVC toolchain not installed on the current development machine** — the
  `Microsoft Visual Studio` directories and Windows SDK are absent. See runbook §1.1.
- **No macOS *workstation*** — macOS boot/build is now covered by CI (`macos-latest` in
  `desktop-build.yml`), but there is no physical macOS machine for hands-on GUI verification.
- **No `.m4a` fixture** — `m4a` is an advertised supported extension but no M4A/AAC encoder is
  available in this environment, so it is untested.
- `fixtures/audio/mp3/tagged-mp3-125.mp3` has silent, hand-built audio (no MP3 encoder exists
  in this toolchain). It is valid for **tag-parsing tests only** and must never be used for
  duration/BPM/key assertions.

<!-- Link reference for the Unreleased section -->
[Unreleased]: https://example.invalid/dj-assistant/commits/main
