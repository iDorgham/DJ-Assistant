# 05 — Proposed Specs and Functions

## Settings specs (new)

- `S-1 Profiles:` Club / Wedding / Warmup preset (constraints + export defaults + energy profile). Stored in `preferences`, selectable in Set Builder.
- `S-2 Preview:` gain, limiter, split-cue mono, nudge step (1ms / 1beat), keyboard map, all in settings UI.
- `S-3 Library locations:` include dirs + ignore globs + auto-watch toggle + relink-on-move (BLAKE3, not path).
- `S-4 Model manager:` list version/SHA, download, rollback, `DJ_ASSISTANT_MODELS_DIR` override validation.
- `S-5 Privacy center:` per-provider what-leaves-device, revoke-all, export/delete my data (SQLite + artwork + keychain).
- `S-6 USB policy:` allow removable-only (enforced), default FAT32+MBR locked, exFAT behind compat checkbox + warning text.
- `S-7 Telemetry:` default off, opt-in crash + perf only, no paths/audio.

## Functions — P1 first (MVP-adjacent)

- `F-1 Smart playlists + history:` “unplayed 124-126A 2024-26 rating≥4”, overplayed/forgotten counts (DJ Brain v1 read-only).
- `F-2 Relink:` missing-file finder via BLAKE3 + move detection.
- `F-3 Beatgrid editor:` tap-shift, halve/double BPM, correction memory (“remember for similar”).
- `F-4 Cue templates:` Standard EDM / Extended Club + custom `.cuepreset` share; A/B compare; provenance badge.
- `F-5 Harmonic traffic-light:` green/yellow/red per transition + mix-out window + vocal-overlap warning.
- `F-6 Set versioning:` save v1/v2, diff, Lock&Fill with `safer/bolder` alternatives persisted.
- `F-7 USB pack verify:` simulate CDJ load, flag missing/long-path/FLAC24, MBR check, print set sheet PDF/CSV.
- `F-8 Prep Auditor push:` “3 unanalyzed, 2 low-confidence keys, 1 vocal clash at #7” with one-click fix queue.
- `F-9 Waveform + Preview Player:` cached peaks, cue drag, color sections, offline — plus beat grid overlay, grid-quantized beat jump ±1/4/8/16/32, temp loop preview, large-format artwork panel, keyboard map (prep-only single-deck; spec §3A, tasks T2.4.1–T2.4.7; single-deck audition only, never a live mixer).
- `F-10 Bulk tag apply:` preview diff + undo + aliases auto-map future imports (completes P2.3-P2.4).

## Functions — Post-MVP (keep non-gating)

- `X-1 Deezer export` via generic `provider_*` (already specced). Defer Apple/YT.
- `X-2 AcoustID job:` local fingerprint queue + quota meter + cache in `external_ids`.
- `X-3 Chart diff:` versioned snapshot vs library (owned-vs-missing via ISRC, BPM ±3%, Camelot).
- `X-4 Release radar:` followed artists/labels, opt-in, cached, labelled unofficial until partnership.
- `X-5 Mobile read-only set view:` QR from desktop, no audio.
- `X-6 Collaboration presence:` Owner/Co-DJ/Viewer + diff log + dual export (after local Builder stable).

## Non-goals (reaffirm)

No live playback/mixing, no streaming audio download/stream/store/playback in-app, no cloud raw audio, no autonomous irreversible agents. Metadata-only everywhere external.
