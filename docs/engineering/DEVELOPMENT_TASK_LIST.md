# DJ Assistant — Development Task List

**Status:** Living document (Phase 0 in progress)  
**Source:** Detailed Build Plan v1.0 + Canonical Spec v1.1 + AI-Native Build Plan  
**Last Updated:** 2026-10-12

This is the actionable engineering task list. Check items off as they are completed. Keep this document updated as scope is refined.

> **Phase 0 status (2026-10-12):** the desktop shell, local scan pipeline, BLAKE3
> fingerprinting, metadata extraction and SQLite storage are implemented and verified
> end to end — the app builds with `cargo build`, launches, and creates its local
> database with migrations 001 + 002 applied. A first thin vertical slice surfaces
> tag-sourced cover art, BPM, key, rating and comments in the library list (no ONNX
> analysis yet), backed by an MP3 duration parser and a content-addressed `get_artwork`
> cache. ESLint 10 (flat config) is wired into
> `pnpm lint`, and the macOS/Windows desktop-build matrix
> (`.github/workflows/desktop-build.yml`) is **green on GitHub** as of 2026-10-12
> (Main CI run `38219344042`: ubuntu Full Validate + `windows-latest` + `macos-latest`).
> Remaining Phase 0 gap: branch protection on `main` (blocked by plan — required checks on a
> private repo need GitHub Pro; see the workflows doc). The dependency audit (`nightly-audit.yml`)
> is now gating weekly and the advertised `.m4a` extension has a fixture (both closed 2026-10-12).
> Windows builders: read
> [WINDOWS_NATIVE_BUILD_RUNBOOK.md](./WINDOWS_NATIVE_BUILD_RUNBOOK.md) §1.1 first —
> the GNU toolchain and paths containing spaces both break the build.

> **Phase 1 status (2026-10-12):** the analysis-engine foundation is in place as a
> standalone, Tauri-free crate `crates/analysis` (`dj-assistant-analysis`): multi-format
> decoding via **Symphonia** (MP3/WAV/FLAC/AIFF/M4A), DSP normalization (mono/stereo,
> linear resampling, peak & RMS normalization), **ONNX Runtime** integration (`ort`
> dynamic loading with platform-aware dylib discovery), SHA-256 model verification, and a
> versioned `ModelRegistry`/`ModelSpec`. A committed 61-byte smoke-test ONNX graph is
> loaded and executed by an inference test (skipped gracefully where no ONNX Runtime is
> installed), and the model digest is pinned by a fixture-integrity test that runs
> everywhere. Remaining Phase 1 work: per-track analysis jobs, the real BPM/key/structure
> models, feature persistence, and the analysis progress UI.

**Guiding Principles (do not violate):**
- Desktop-first, local-first — core value must work offline
- Vertical slices over pure horizontal layers
- Hybrid intelligence: LLM for understanding only; deterministic engines for optimization
- Every mutating action is previewable and reversible
- No open-ended agents — only scoped Skills with kill-switches
- Hardware validation (CDJ-2000NXS2 / CDJ-3000) is a first-class gate

---

## Phase 0 — Foundation (Days 1–15)

**Goal:** Runnable desktop shell that can scan a folder, hash files, extract basic metadata, and store tracks locally.

### Scaffolding & Tooling
- [x] Initialize monorepo (`pnpm` workspace + Cargo workspace)
- [x] Create `apps/desktop` (Tauri v2 + React + TypeScript + Tailwind)
- [x] Create `apps/api` skeleton (Fastify + TypeScript) — can be minimal
- [x] Create `packages/shared` for shared types
- [x] Set up ESLint, Prettier, TypeScript strict config (ESLint 10 flat config; `pnpm lint` runs all three)
- [x] Set up `cargo fmt` + Clippy in CI
- [x] Basic GitHub Actions CI: lint + typecheck + build (macOS + Windows) — *first green Main CI run 2026-10-12: Full Validate (ubuntu-latest) + `desktop-build.yml` matrix (`windows-latest`, `macos-latest`)*
- [x] Add `.env.example` files and document required variables
- [x] Create `scripts/download-models.sh` (placeholder)

### Desktop Shell (WS1)
- [x] Tauri v2 project boots and shows a React “Hello DJ Assistant” screen
- [x] Folder picker dialog (native)
- [x] Recursive folder scan (with progress)
- [x] BLAKE3 hashing of files (first 1MB + duration for fingerprint)
- [x] Deduplication by hash
- [x] Metadata extraction via `audiotags` (title, artist, album, duration, existing tags, artwork if easy) — *tag-sourced BPM, key (Camelot + classical), rating, comments and cover art via `id3`/`metaflac`; MP3/WAV/AIFF/FLAC durations parsed from headers*
- [x] Local SQLite database with migration system
- [x] `tracks` table (id, path, blake3_hash, basic metadata, timestamps)
- [x] Workspace / library isolation concept (even if single-library for now)
- [x] Minimal Library list UI (path, title, artist, duration, hash status) — *adds artwork thumbnail, BPM, key, rating and comments columns plus a search box*
- [x] Basic IPC commands: `scan_folder`, `list_tracks`, `get_track` — *plus `get_artwork`*

### Exit Criteria — Phase 0
- [x] Can point at a folder of 50–100 tracks and see them listed with correct basic metadata
- [x] Hashes are stable and duplicates are detected
- [x] App builds on macOS and Windows via CI
- [x] No crashes on malformed / unsupported files (graceful skip + log)

---

## Phase 1 — Analysis Engine (Days 16–35)

**Goal:** Local ONNX-powered analysis producing usable BPM, key, beat grid, and structural markers.

### Audio Analysis Engine (WS2)
- [x] Integrate ONNX Runtime in Rust — *`crates/analysis`: `ort` (dynamic loading) with platform-aware dylib discovery, SHA-256-verified model loading, and an executed smoke-test graph; tested without the runtime via a digest-pinned fixture check*
- [x] Model packaging / loading strategy (path config + versioning) — *`ModelSpec` / `ModelRegistry` (id + version + filename + SHA-256) and `fixtures/models/smoke_test.onnx` regenerated by `scripts/make-smoke-model.py`*
- [x] BPM + beat grid — *deterministic onset path in `crates/analysis/src/bpm.rs` (`OnsetAutocorr`): spectral-flux onset envelope (rectangular-STFT) + autocorrelation + metrical-level (×0.5/×1/×2) scoring + phase search that reconstructs the downbeat at `t₀`; full `bpm` module test suite green incl. synthetic click tracks (90/120/128/140 BPM) and the real FLAC fixture; `cargo fmt`/`clippy` clean, <3 s/track. ONNX activation-curve seam remains for the Phase 1 model integration.*
- [x] Key detection (Camelot + classical notation) — *deterministic chroma path done: Hann-windowed STFT → 12-bin pitch-class profile (8192-sample window for sub-semitone resolution) → Krumhansl-Kessler key-finding → classical name + Camelot code; tests cover C major / A minor / G major drones, the real FLAC fixture, graceful short/silent/empty degradation, and a Camelot-wheel self-check; `cargo fmt`/`clippy` clean. ONNX chroma-activation seam remains for the Phase 1 model integration.*
- [ ] Phrase / structural segmentation (intro, build, drop, breakdown, outro)
- [ ] Vocal presence / density estimation
- [ ] Loudness (EBU R128 LUFS)
- [ ] Spectral brightness (optional but useful)
- [ ] Per-track analysis job queue (local)
- [ ] Analysis progress UI (per-track + overall)
- [ ] Store analysis results in SQLite (`analysis_status`, `analysis_version`, feature columns)
- [ ] Low-confidence flagging / “needs review” state
- [ ] Re-analysis support when models or pipeline version change

### Performance & Quality
- [ ] Target: p50 analysis time < 3s per track on mid-range laptop (CPU)
- [ ] Golden fixture tests for BPM / key / phrase on a small curated set
- [ ] Graceful handling of very short / very long / corrupted files

### Exit Criteria — Phase 1
- [ ] 50-track folder fully analyzed with usable cue points in < 5 minutes wall time + light review
- [ ] All AI-generated cues are marked as such and fully editable; overrides persist
- [ ] Analysis results survive app restart

---

## Phase 2 — Library Intelligence & Tag Cleanup (Days 31–55)

**Goal:** Professional library UX + Smart Tag Cleanup that actually fixes messy DJ libraries.

### Library UX (WS3)
- [ ] Full library browser: search, multi-filter (BPM, key, genre, rating, analysis status)
- [ ] Bulk select + bulk edit
- [ ] User ratings, tags, comments
- [ ] Sort options and saved views (nice-to-have)

### Smart Tag Cleanup — Tag Surgeon
- [ ] Fuzzy artist / producer clustering (case, whitespace, accents, punctuation, common prefixes)
- [ ] Canonical name suggestion UI
- [ ] Preview diff (how many tracks affected)
- [ ] Bulk apply with confirmation
- [ ] Alias system (future imports auto-map)
- [ ] Full undo / history for bulk tag operations
- [ ] Same capability for titles if time permits

### Library Intelligence
- [ ] Duplicate detection (hash-based) + UI
- [ ] Version grouping (Radio Edit / Extended / Club Mix / Instrumental)
- [ ] Library Health Score (unanalyzed %, tag inconsistency, orphans, missing files)
- [ ] Prep Auditor Skill (readiness checklist before a gig)

### Exit Criteria — Phase 2
- [ ] Messy 1,000-track library can be cleaned in a single review pass with high precision
- [ ] Bulk tag changes are fully reversible
- [ ] Health score accurately reflects current state

---

## Phase 3 — Set Builder & Export (Days 41–70)

**Goal:** Constraint-driven set construction with Beam Search + production-quality exports that load on real hardware.

### Set Builder Core (WS4)
- [ ] Constraint model (duration, start/peak/close BPM, energy curve, genre bias, key compatibility, vocal density, excluded/locked tracks)
- [ ] Constraint form UI
- [ ] Optional NL → constraint parser via LLM (with offline structured fallback)
- [ ] Candidate pool filtering (local SQL first)
- [ ] Transition scoring matrix (harmonic distance, BPM compatibility, energy delta, phrase alignment, etc.)
- [ ] Beam Search sequencer (beam width = 10, duration-aware, no repeats)
- [ ] Set object storage (local)
- [ ] Basic set list + track order UI
- [ ] One-click re-optimize / “make safer” / “more adventurous”
- [ ] Transition explanations (template or LLM)
- [ ] Energy Canvas visualization
- [ ] Lock & Fill
- [ ] Set Templates (save / load constraint + structure presets)

### Export
- [ ] rekordbox XML exporter (playlist + cue points)
- [ ] Serato `.crate` binary exporter
- [ ] Standard `.cue` file support (nice-to-have)
- [ ] Export preview / validation
- [ ] Hardware validation protocol on Pioneer CDJ-2000NXS2 / CDJ-3000

### Exit Criteria — Phase 3
- [ ] From constraints, produce a coherent 90–120 min set a working DJ would play with only light edits
- [ ] Exported XML / crate loads cleanly in rekordbox / Serato and on real Pioneer CDJs
- [ ] Zero audio file modification or corruption ever observed

---

## Phase 4 — Polish, Automation, Closed Beta (Days 61–90)

**Goal:** Skills framework, Gig Ready workflow, collaboration foundation, and beta readiness.

### Skills Platform (WS5)
- [ ] Skills framework (register, enable/disable, run, log, undo)
- [ ] Skill run history UI + kill-switch
- [ ] Implement core Skills:
  - [ ] Cue Master
  - [ ] Tag Surgeon
  - [ ] Set Architect
  - [ ] Energy Cartographer
  - [ ] Prep Auditor
  - [ ] Library Doctor
  - [ ] Harmonic Scout (basic)
  - [ ] Missing Track Hunter (basic)
- [ ] Automation rule engine (simple WHEN / IF / THEN)
- [ ] Gig Ready one-click workflow

### Cloud & Collaboration (foundational)
- [ ] Fastify control plane skeleton + auth
- [ ] PostgreSQL + pgvector setup
- [ ] Basic workspace / user model
- [ ] Optional sync of metadata + sets (no audio)
- [ ] B2B shared set collaboration (metadata-only) — minimum viable
- [ ] LLM gateway (constraint parsing + explanations) with rate limits and schema validation

### Polish & Beta
- [ ] Waveform visualization (peaks + cue markers)
- [ ] Performance pass (startup time, large library scrolling, analysis throughput)
- [ ] Error handling & empty states
- [ ] Onboarding / first-run experience
- [ ] Closed beta invite flow + feedback collection
- [ ] Crash reporting / basic telemetry (opt-in, no audio content)
- [ ] Documentation for beta users

### Exit Criteria — Phase 4 / MVP
- [ ] Full analysis + export of a 40-track library in < 15 minutes
- [ ] Cue placement acceptance rate > 90% in closed beta
- [ ] Zero source-file corruption across all testing
- [ ] Tag cleanup clusters near-duplicate artist names with > 95% accuracy in beta libraries
- [ ] Core offline workflow (import → analyze → cue → set → export) is reliable
- [ ] Skills are controllable and reversible

---

## Cross-Cutting / Ongoing Tasks

### Quality & Safety
- [ ] Golden audio fixture suite (BPM, key, structure, cues)
- [ ] Property-based / fuzz tests for parsers and path handling
- [ ] Undo system tested for every mutating Skill
- [ ] Security review of filesystem access and IPC surface
- [ ] Privacy review: confirm no audio leaves the device by default

### Developer Experience
- [ ] Keep `docs/` in sync with code
- [ ] Update this task list weekly
- [ ] Maintain CHANGELOG.md
- [ ] Model version registry and migration notes

### Post-MVP Candidates (P1 / P2 — do not start until MVP is solid)
- [ ] Advanced vector search (CLAP embeddings)
- [ ] Richer B2B presence & conflict resolution
- [ ] Traktor / VirtualDJ export
- [ ] Mini waveform track preview in set builder
- [ ] Mobile companion (out of scope for early post-MVP)
- [ ] Cloud-only advanced features behind clear opt-in

---

## Definition of Done (per task)

A task is done when:
1. Code is merged to the main development branch
2. Tests (unit + relevant fixtures) pass
3. Docs updated if public behavior or schema changed
4. No new lint / type / Clippy errors introduced
5. For user-facing features: basic happy-path verified manually

---

## How to Use This List

- Treat Phase 0–1 as sequential; later phases can overlap once foundations are solid.
- Prefer vertical slices (e.g. “scan → show in UI → analyze one track → show BPM”) over finishing an entire workstream before others.
- When in doubt, re-read the Canonical Documentation and the non-goals.
- Update checkboxes and add new tasks as reality diverges from the plan.

---

*This task list is derived from the Detailed Project Build Plan and is the operational checklist for engineering. Product requirements remain in the Canonical Documentation and PRD.*
