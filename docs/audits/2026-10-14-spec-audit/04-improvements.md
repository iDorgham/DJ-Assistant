# 04 — Improvements (prioritized)

## P0 — Do before Phase 2 exit

1. **Slim MVP:** move USB-format + B2B collab + 4/8 Skills to P1. Gate MVP on Import→Analyze→Cue→Export. Edit `01-SPECIFICATION.md §3` + `05-ACCEPTANCE.md §5`.
2. **Lock one scoring formula:** Canonical `S=0.35/0.30/0.20/0.15` vs shipped `M=0.45/0.35/0.10/0.10`. Pick one, version with `analysis_version`, delete other. Add unit test pinning weights.
3. **Define energy source now:** user tag + LUFS proxy + manual slider 0–10. Never block `build_set` on missing ML mood. Document in `DATA_MODEL.md` `tracks.energy`.
4. **Undo infra:** implement `skill_runs(before_state/after_state)` + `undo_skill_run` round-trip test before Tag Surgeon/Cue Master UI.
5. **Contract codegen:** single `contracts/*.json` → `packages/shared` + Rust structs. CI fails on `API_CONTRACTS.md` drift. Covers `TrackSummary/Detail`, `CuePoint`, error envelope.
6. **Golden fixtures:** 50-track corpus (MP3/FLAC/AIFF/WAV + corrupt), hash-before/after script, p50 bench on fixed laptop spec. Replace `Manual` for P1.1-P1.6, M.1, M.3.

## P1 — Before beta

7. **`settings.schema.json`:** theme, threads, model dir+sha, USB policy (default disabled/advanced), telemetry=false, artwork LRU 2GB, OAuth port range. Zod + Rust validation, UI editor, `RUST_LOG` + DB path in `.env.example`.
8. **USB safety:** rescan + no-default-select + type-label-to-confirm + MBR verify + `skill_runs` audit. Dry-run mode.
9. **Error catalog:** `E_SCAN_* / E_ANALYSIS_* / E_EXPORT_* / E_USB_* / E_PROVIDER_*` with `code/message/retry` envelope on `error` event.
10. **Log retention:** 14d rotation, PII redact paths in cloud logs, `analysis_version` on every row.
11. **Window + perf:** default 1440x900, frontend budget (list 10k rows virtualized <100ms, waveform <16ms/frame).
12. **CI hardening:** enable secret scan, Cargo audit nightly, model-perf regression, pin Vite/Tailwind minor until Phase 3 exit.

## Docs to edit

- `docs/sdd/01-SPECIFICATION.md`, `05-ACCEPTANCE.md`, `docs/architecture/API_CONTRACTS.md`, `DATA_MODEL.md`, `.env.example`, `tauri.conf.json`, `docs/engineering/TESTING_AND_SECURITY.md`
