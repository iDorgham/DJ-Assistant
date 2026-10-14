# Audit Summary — Specs, Functions, Settings

**Date:** 2026-10-14
**Scope:** `docs/product/CANONICAL_DOCUMENTATION.md` v1.1, `docs/sdd/01-SPECIFICATION.md`, `docs/sdd/05-ACCEPTANCE.md`, `docs/architecture/API_CONTRACTS.md`, `SKILLS_SYSTEM.md`, `DATA_MODEL.md`, `.env.example`, workspace configs
**Phase:** Phase 0 accepted 2026-10-12, Phase 1 T1.1.1–T1.1.8 done

## Pros

- **Specs:** single truth declared, explicit out-of-scope, quantitative gates (p50<3s, 40 tracks<15min, cues>90%, tags>95%), Post-MVP non-gating S/D/E/X, Pioneer-correct USB FAT32+MBR default, deterministic Beam Search + local ONNX boundaries.
- **Functions:** coarse IPC + events with Rust path validation, Skills Snapshot/Record/undo lifecycle, BLAKE3 dedup + SQLite WAL, graceful `run_full_analysis`, TF foundations shipped (`find_similar_tracks`, `track_tag_health`, `store_links_for_track`, `provider_status`), Spotify PKCE metadata-only correct (ISRC→fuzzy ±3s, chunk ≤100, 429/401).
- **Settings:** no secrets in repo, opt-in provider keys, model registry + SHA + traversal guard, least-privilege Tauri caps + CSP, `ci:local` mirrors CI.

## Cons

- **Specs:** P0 too broad (import+ONNX+cues+tags+Beam+USB+8 Skills), Canonical/SDD/ARCH/diagrams drift (formula mismatch `0.35/0.30/0.20/0.15` vs `0.45/0.35/0.10/0.10`), ~60% `Manual` acceptance, missing error catalog/log retention/backup/concurrency/model-rollback/LLM-provider decision, hardware validation on critical path.
- **Functions:** shipped (scan/list/analyze/similarity) << promised (cue editor/waveform/builder/export/USB); energy hole (Builder needs energy, Canonical says not auto-scored); no verified `skill_runs` undo; no watcher/bulk-aliases; USB destructive in MVP; cloud 12 endpoints premature; artwork cache unbounded.
- **Settings:** no unified validated store (env vs tauri.conf vs SQLite prefs disconnected); missing `RUST_LOG`, DB path, threads, feature flags, telemetry opt-out, USB policy, OAuth port handling; bleeding-edge pins (Vite 8 / Tailwind 4 / TS 6 / pnpm 10 / ort rc); window 1280x800 cramped; branch protection exception + no Cargo audit live.

## Top fixes

1. Slim MVP to Import→Analyze→Cue→Export; push USB/B2B/half Skills to P1.
2. Lock one scoring formula + `analysis_version`; codegen `packages/shared` ↔ Rust; CI drift check.
3. Define energy (tag + LUFS proxy + slider); implement `skill_runs` undo before bulk UI.
4. Golden 50-track fixtures + hash audit + p50 bench on fixed hardware; replace `Manual`.
5. Add `settings.schema.json` + UI editor + missing knobs; default 1440x900; USB dry-run + type-to-confirm + MBR verify; error catalog; 14d log rotation; CI secret/Cargo audit.

## Proposed additions

Settings: Profiles, Preview gain/keymap, Library locations+ignore+relink, Model manager, Privacy center, USB policy, Telemetry off-default.
Functions P1: smart playlists/history, relink, beatgrid editor, cue templates, harmonic light + mix-out + vocal warning, set versioning/diff, USB verify + set sheet, Prep Auditor queue, waveform, bulk tag preview+undo.
Post-MVP: Deezer playlist export/OAuth via `provider_*` (requires app ID), AcoustID queue, chart diff, release radar, mobile read-only view, collab presence. No live playback/mixing or external audio download/stream/store; local prep-only Preview Player remains in scope.

See split files `01-specs-audit.md`, `02-functions-audit.md`, `03-settings-audit.md`, `04-improvements.md`, `05-proposed-specs-functions.md`.
