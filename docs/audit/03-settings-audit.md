# 03 — Settings Audit

**Sources:** `.env.example`, `package.json`, `pnpm-workspace.yaml`, `Cargo.toml`, `apps/desktop/package.json`, `apps/desktop/vite.config.ts`, `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/capabilities/default.json`, `crates/*/Cargo.toml`, `eslint.config.mjs`, `.prettierrc.json`

## What exists

- `.env.example:1-36`: `PORT/HOST/NODE_ENV`, commented `DATABASE_URL/REDIS_URL`, `VITE_API_BASE_URL`, `DJ_ASSISTANT_MODELS_DIR` (resolution `./models → exe/models → None`), `SPOTIFY_CLIENT_ID` (no secret, PKCE), `LASTFM_API_KEY/DISCOGS_TOKEN/ACOUSTID_API_KEY/DEEZER_APP_ID` all opt-in.
- Root `package.json:7-24`: `dev:desktop/dev:api`, `lint/typecheck/test`, `rust:fmt/clippy/test`, `ci:local` full gate. `pnpm@10.14.0`.
- Tauri: `com.djassistant.desktop@0.1.0`, `devUrl localhost:1420`, window 1280x800 min 900x600, CSP `self+wasm-unsafe-eval+asset:`, bundle all targets.
- Rust: workspace `apps/desktop/src-tauri + crates/analysis + crates/core + tests/schema`, `rusqlite 0.40 bundled`, `ort 2.0.0-rc.13 load-dynamic`, `symphonia 0.6.1`, `ebur128`, `sha2/rustfft`.
- Frontend: React 18, Tauri API 2.0, Tailwind 4.3.3, Vite 8.3.4, TS 6.0.3. ESLint flat + Prettier + strict TS.

## Pros

1. Secrets posture good: no secret in repo, Spotify public client only, provider keys commented/opt-in.
2. Model security: registry order + traversal guard + SHA256 verify + 61-byte smoke model via `scripts/make-smoke-model.py`.
3. Least-privilege capabilities + CSP. Good default.
4. `ci:local` mirrors CI (lint+typecheck+test+fmt+clippy). Portable variant `ci:local:portable` for MinGW.

## Cons

1. **No unified settings store:** env vs `tauri.conf.json` vs SQLite `preferences/watch_folders` disconnected. No schema validation (Zod/schemars), no UI editor, no dev/staging/prod overlay.
2. **Missing knobs:** `RUST_LOG`, SQLite path, analysis threads/concurrency, model checksum pin, feature flags, telemetry opt-out, USB allowlist/policy, OAuth loopback port range, artwork cache size.
3. **Bleeding-edge toolchain:** Vite 8, Tailwind 4, TS 6, pnpm 10, `ort 2.0-rc`. Stability + plugin compat risk on Windows MSVC/GNU.
4. **Window size:** 1280x800 cramped for 3-pane (library + waveform + set). Recommend 1440x900 default, min 1100x700.
5. **CI gaps:** branch protection exception T0117 (private repo needs Pro), no secrets-scan live (only template `release/codeql`), no nightly model-perf regression.
6. **OAuth loopback unspecified:** port pick, firewall prompt, custom-scheme fallback on Windows not in `tauri.conf.json`/docs.
7. **No log retention:** size/rotation/PII redaction for `scan:`/`analysis:` logs undefined.

## Verdict

Secure defaults, modern toolchain. Needs a validated settings schema + missing operational knobs + toolchain pinning before beta distribution.
