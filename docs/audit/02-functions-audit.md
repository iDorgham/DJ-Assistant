# 02 — Functions Audit

**Sources:** `docs/architecture/API_CONTRACTS.md`, `docs/architecture/SKILLS_SYSTEM.md`, `docs/architecture/DATA_MODEL.md`, `apps/desktop/src-tauri/src/`, `crates/analysis`, `crates/core`

## Shipped (verified)

- Library: `scan_folder`, `list_tracks`, `get_track`, `get_artwork` (`API_CONTRACTS.md:23-88`). BLAKE3 (first 1MB+duration) dedup, `audiotags`+`id3`+`metaflac`, SQLite WAL+FK.
- Analysis: decoder (Symphonia MP3/WAV/FLAC/AIFF/M4A), normalizer, ONNX `ort` dynamic, BPM OnsetAutocorr, key STFT→chroma→Krumhansl-Kessler→Camelot, phrase novelty, vocal mid/side, LUFS `ebur128`, `run_full_analysis` graceful degradation.
- Discovery foundations (TF): `find_similar_tracks` (BPM 45%/key 35%/genre 10%/duration 10%), `track_tag_health`, `store_links_for_track` (Beatport/Traxsource/Juno/Bandcamp/Discogs search URLs), `provider_status` (`API_CONTRACTS.md:380-465`).
- UI: library list + inspector drawer + Tag Health + provider status. Phase 1 T1.1.1–T1.1.8 done per `04-TASKS.md`.

## Spec'd, not built

- Cues: 8 hot + memory, genre templates, 8-bar snap, waveform editor (`05-ACCEPTANCE.md:149-154`).
- Set Builder: `build_set` Beam Search W=10, Lock & Fill, templates, risk low/med/high, explanations (`API_CONTRACTS.md:169-208`).
- Export: `export_set` rekordbox XML + Serato `.crate`, `usb_list_drives` (removable-only), `usb_format_drive` FAT32 default / exFAT gated (`API_CONTRACTS.md:210-265`).
- Skills v1 (8): Cue Master, Tag Surgeon, Set Architect, Energy Cartographer, Harmonic Scout, Missing Track Hunter, Prep Auditor, Library Doctor (`SKILLS_SYSTEM.md:23-33`). Post-MVP: Playlist Publisher, Metadata Enricher.
- Cloud: `/api/v1/*` parse-query, generate/build, collab, skills (`API_CONTRACTS.md:530-552`).

## Pros

1. Coarse IPC + events (not micro-RPC), Rust-side path validation (`API_CONTRACTS.md:11-18`).
2. Skills lifecycle with Snapshot + Record + undo (`SKILLS_SYSTEM.md:63-80`). Right trust model.
3. Non-destructive + offline core enforced as global gates (`05-ACCEPTANCE.md:11-20`).
4. Spotify reference correct: PKCE, keychain, ISRC→fuzzy ±3s, chunk ≤100, 429/401 handling.

## Cons

1. **Energy hole:** Set Builder needs energy curve, but Canonical says energy/mood not auto-scored. Blocker for P3.2-P3.4.
2. **No undo infra yet:** spec requires preview+undo for all bulk/AI mutations, no `skill_runs` before/after implementation verified in `db.rs`.
3. **No watcher/bulk edit:** watch folders (`notify`), bulk apply, aliases (`P2.3-P2.4`) spec'd but not in commands list.
4. **Waveform/cue editor missing:** blocks Cue Master acceptance (editable, snap-to-grid, provenance).
5. **USB format risk:** destructive + irreversible in MVP without dry-run, rescan, type-to-confirm.
6. **Cloud surface too wide for MVP:** 12 endpoints before local Set Builder works. Defer.
7. **Artwork cache unbounded:** `artwork/{hash}` with no LRU/size cap (`DATA_MODEL.md:62-63`).

## Verdict

Foundations solid. Biggest gap: promise (Builder/Cues/Export/USB) >> shipped (scan/list/analyze/similarity). Close energy + undo + cue editor before expanding providers.
