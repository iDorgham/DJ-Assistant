# 04 — Task Breakdown

**SDD Artifact:** Concrete Engineering Tasks  
**Status:** Living  
**Last reconciled:** 2026-10-14 (against actual code on disk: T1.1.1–T1.1.8 + TF.1–TF.6, TD.3, TE.1–TE.4, TM.1/TM.2a shipped; T1.2.1/T1.2.3/T1.2.5 backend landed)  
**How to use:** Work top-to-bottom within a phase. Mark tasks `[x]` when Definition of Done is met. Update dependencies as reality changes.

> **Reconciliation note (2026-10-12):** Phase 0 items were checked off against a verified
> build/run of the code, not against intent. Evidence: `cargo build` produces
> `dj-assistant-desktop.exe`; the app launches and creates its SQLite database with
> migrations 001 + 002 applied; `pnpm ci:local:portable`, `cargo fmt --all --check`,
> `cargo clippy --all-targets -- -D warnings`, `eslint .` and the **84-test** portable Rust
> suite all pass. Phase 0 also carries a first thin vertical slice — tag-sourced cover art,
> BPM, key, rating and comments stored via migration 002 and rendered in the library list,
> plus an MP3 duration parser and the `get_artwork` cache command. Items left unchecked are
> genuinely incomplete (see each note).
>
> **Criterion-level evidence lives in [PHASE0_ACCEPTANCE_EVIDENCE.md](../engineering/PHASE0_ACCEPTANCE_EVIDENCE.md).**
> As of 2026-10-12 all P0.1–P0.8 criteria pass — P0.1 (macOS **and** Windows) is closed by the first
> green CI matrix run (`desktop-build.yml` on `windows-latest` + `macos-latest`). The only
> remaining non-criterion gap is branch protection on `main` — the untested `.m4a` extension and
> non-gating audit workflow were both closed on 2026-10-12.

**Definition of Done (every task):**
1. Merged to main development branch
2. Relevant tests / fixtures pass (new logic must have automated tests)
3. Security checklist satisfied for the change type (`docs/engineering/TESTING_AND_SECURITY.md`)
4. Docs updated if behavior or schema changed
5. No new lint / type / Clippy failures
6. User-facing behavior manually verified on happy path
7. Source-audio hash unchanged when the task touches import/analyze/export pipelines

---

## Phase 0 — Foundation (Days 1–15)

### 0.1 Monorepo & Tooling
- [x] **T0.1.1** Initialize pnpm workspace + root package.json
- [x] **T0.1.2** Initialize Cargo workspace
- [x] **T0.1.3** Create `apps/desktop` Tauri v2 + React + TS + Tailwind skeleton
- [x] **T0.1.4** Create `apps/api` Fastify + TS skeleton (minimal)
- [x] **T0.1.5** Create `packages/shared` for shared types
- [x] **T0.1.6** Configure ESLint, Prettier, TypeScript strict — *all three enforced: Prettier (`.prettierrc.json`), TS `strict` in every tsconfig, and **ESLint 10 flat config** (`eslint.config.mjs`: `@eslint/js`, `typescript-eslint`, `react-hooks`, `eslint-config-prettier`) wired into `pnpm lint` / CI*
- [x] **T0.1.7** Configure cargo fmt + Clippy
- [x] **T0.1.8** GitHub Actions: lint, typecheck, unit tests, build (macOS + Windows) — *first green Main CI run on 2026-10-12 (`.github/workflows/main-ci.yml` run `38219344042`): Full Validate on ubuntu-latest + the reusable `desktop-build.yml` matrix (`windows-latest` **and** `macos-latest`) all pass*
- [x] **T0.1.9** Add `.env.example` and document variables
- [x] **T0.1.10** Create placeholder `scripts/download-models.sh`
- [x] **T0.1.11** CI: cargo clippy `-D warnings` + test job
- [x] **T0.1.12** Fixture directory layout (`fixtures/audio`, `fixtures/charts`, `fixtures/models` + `manifest.json`; see `fixtures/README.md`)
- [x] **T0.1.13** Path canonicalization utility + traversal unit tests
- [x] **T0.1.14** Tauri CSP + capability allowlists locked to least privilege
- [x] **T0.1.15** Dependency audit workflow (cargo audit / npm audit schedule) — *`nightly-audit.yml` now **gates** weekly (Mondays 09:00 UTC): `pnpm audit --prod --audit-level=high` fails on high/critical JS advisories, and `cargo audit` (prebuilt via `taiki-e/install-action`, run against the workspace `Cargo.lock`) fails on any RustSec vulnerability; non-vulnerability warnings are reported but do not fail the job*
- [x] **T0.1.16** Copy GitHub workflow templates into `.github/workflows/` (pr-ci, main-ci) — *actual live: `pr-ci.yml`, `main-ci.yml`, `desktop-build.yml`*
- [ ] **T0.1.17** Branch protection on `main`: required PR checks, no direct push — *blocked by plan: required checks on a **private** repo need GitHub Pro (`403 Upgrade to GitHub Pro or make this repository public`). Documented exception with the exact checks + command in [`docs/devops/github-workflows/README.md`](../devops/github-workflows/README.md#branch-protection--pending-plan-phase-0-exception-task-t0117)*
- [x] **T0.1.18** CODEOWNERS for `.github/workflows/**` and security-sensitive paths
- [x] **T0.1.19** `pnpm ci:local` script matching CI steps
- [x] **T0.1.20** Nightly audit workflow + Dependabot/Renovate enabled — *`nightly-audit.yml` live and **gating** (weekly); Dependabot configured (`.github/dependabot.yml`: npm/pnpm, cargo, github-actions, weekly, minor+patch grouped)*

### 0.2 Desktop Shell & Local Data
- [x] **T0.2.1** Tauri window boots with React “Hello DJ Assistant”
- [x] **T0.2.2** Native folder picker
- [x] **T0.2.3** Recursive folder scan with progress events
- [x] **T0.2.4** BLAKE3 fingerprint (first 1MB + duration)
- [x] **T0.2.5** Hash-based deduplication
- [x] **T0.2.6** Metadata extraction (audiotags): title, artist, album, duration, existing tags — *plus tag-sourced BPM, key (Camelot + classical), rating, comments and embedded cover art via `id3`/`metaflac`; durations parsed from headers for MP3/WAV/AIFF/FLAC (`mp3.rs`, `riff.rs`, `aiff.rs`) and from the `mvhd` atom for M4A (`audiotags`/`mp4ameta`)*
- [x] **T0.2.7** SQLite integration + migration runner
- [x] **T0.2.8** `tracks` table schema (id, path, hash, metadata, timestamps, workspace_id) — *migration 002 adds `comments`/`artwork_hash`/`artwork_path`/`artwork_mime`*
- [x] **T0.2.9** Basic IPC: `scan_folder`, `list_tracks`, `get_track` — *plus `get_artwork` (content-addressed cache → `data:` URL)*
- [x] **T0.2.10** Minimal Library list UI (title, artist, duration, path, status) — *adds artwork thumbnail, BPM, key, rating and comments columns and a title/artist/album/path search box*
- [x] **T0.2.11** Graceful skip + log for unsupported / corrupt files

**Phase 0 Exit Check:** See `05-ACCEPTANCE.md` § Phase 0

---

## Phase 1 — Analysis Engine (Days 16–35)

### 1.1 ONNX & Models
- [x] **T1.1.1** Integrate ONNX Runtime in Rust — *`crates/analysis`: `ort` dynamic loading, dylib discovery, SHA-256 verification, executed smoke-test graph*
- [x] **T1.1.2** Model loading + path configuration + version stamp — *configurable model asset path: `resolve_model_path` (traversal-guarded join of spec filename under a base dir), `discover_models_dir` (`DJ_ASSISTANT_MODELS_DIR` → cwd `models/` → exe-adjacent → None), and `load_model_session` (resolve → canonical containment → SHA-256 verify on bytes read → load); documented in `docs/architecture/MODELS.md` §3/§4 and `.env.example`; 17 new tests (discovery precedence pure-function tested without env mutation; link-escape containment); versioned specs were already in place via `ModelSpec`. Merged via #17 with review hardening in #19 and the trust-boundary doc in #20; green Main CI per DoD 1*
- [x] **T1.1.3** BPM + beat grid inference path — *deterministic onset path in `crates/analysis/src/bpm.rs` (`OnsetAutocorr`), with an ONNX-activation seam reusing the same post-processor; full `bpm` test suite (incl. `beats_are_evenly_spaced_and_align_to_clicks`) green; `cargo fmt --check` + `cargo clippy -p dj-assistant-analysis -- -D warnings` clean; runtime budget well under 3 s/track*
- [x] **T1.1.4** Key detection (Camelot + classical) — *deterministic chroma path in `crates/analysis/src/key.rs` (`ChromaKeyfinding`): Hann-windowed STFT → 12-bin pitch-class profile (8192-sample window for sub-semitone resolution) → Krumhansl-Kessler key-finding with an ONNX chroma-activation seam; maps 24 keys to classical names + Camelot codes (reusing the wheel in `crates/core`); full `key` test suite green (C major / A minor / G major drones + real FLAC fixture + graceful degradation + Camelot wheel self-check); `cargo fmt`/`clippy` clean*
- [x] **T1.1.5** Phrase / structure segmentation — *deterministic beat-grid-snapped novelty path in `crates/analysis/src/phrase.rs` (`detect_phrases`): per-bar RMS (dB energy delta), spectral-flux delta, and 12-bin chroma cosine distance combined into a boundary-novelty curve (mean + 0.5σ threshold, 2-bar min spacing), snapped to {4, 8, 16, 32}-bar phrases (±2-bar tolerance) off the T1.1.3 beat grid, with heuristic intro/build/drop/breakdown/outro labels from track-relative energy profile; degrades to an empty map (never an error) without a usable grid; ONNX seam reserved via `PhraseMethod::Onnx`; 8 new tests (synthesized six-section structure track, steady-track single phrase, grid coupling, real-FLAC smoke); full suite 59 green, `cargo fmt`/`clippy -D warnings` clean. Merged via #21.*
- [x] **T1.1.6** Vocal presence / density — *deterministic mid/side STFT heuristic in `crates/analysis/src/vocal.rs` (vocal-band energy ratio over a ≥150 Hz denominator + center-dominance gate + median smoothing), producing a `0..=1` density curve + aggregate with an ONNX seam; full `vocal` test suite (11 tests, incl. wide-panned-pad and transient-rejection cases) green; `cargo fmt --check` + `cargo clippy -p dj-assistant-analysis -- -D warnings` clean. Merged via #22.*
- [x] **T1.1.7** Loudness (EBU R128) — *EBU R128 / BS.1770-4 measurement in `crates/analysis/src/loudness.rs` (`detect_loudness`) on the pure-Rust `ebur128` crate: gated integrated LUFS + true peak (dBTP) + loudness range (Tech 3342); channels fed natively per BS.1770 channel-power sum (mono-downmix would misread correlated stereo ~9 LU; >2ch downmixed to stereo); silence/undefined results floored to -70.0 LUFS (the spec's absolute gate) so the profile is always finite; no options struct or method enum — deterministic spec with no tunables/alternate engine; full `loudness` test suite (11 tests, incl. sine-at-known-LUFS spec anchor, stereo = mono + 3.01 LU, relative-gate exclusion, inter-sample overshoot probe, real-FLAC smoke) green; `cargo fmt --check` + `cargo clippy -p dj-assistant-analysis -- -D warnings` clean. Merged via #23.*
- [x] **T1.1.8** Model registry / analysis_version field — *registry type (`ModelRegistry`/`ModelSpec`, `crates/analysis/src/registry.rs`) in place; `tracks.analysis_version TEXT` column in place (migration 001, read by `get_track`/exposed via `TrackDetail`). Composite `analysis_version()` in `crates/analysis/src/version.rs` (6 tests) aggregates per-analyzer `*_PIPELINE_VERSION` stamps into `name:pipeline[@model];...`. Per-track DB stamping lands via the T1.2 pipeline (`apps/desktop/src-tauri/src/analysis.rs`: `persist_analysis_results`/`persist_analysis_failure`, `analyze_library` version check). Merged via #23 + T1.2 backend.*
- [x] **TA.1-docs** Slim-MVP scope docs (this file, `01-SPECIFICATION.md`, `05-ACCEPTANCE.md`, `03-PHASES-AND-PLAN.md`) — *done 2026-10-14; code deferral stays open via T3.2.x/T4.2.5.*

### 1.2 Pipeline & UI
- [x] **T1.2.1** Local analysis job queue — *shipped backend: `commands::analyze_library` (version-aware selection, `force` flag) + `analysis.rs::run_analysis_job` with per-track `analysis:progress` and final `analysis:completed` events; UI progress surfacing still to verify.*
- [x] **T1.2.2** Per-track + overall progress IPC + UI — *shared contracts (`AnalyzeLibraryRequest/Response`, `AnalysisProgressEvent`, `AnalysisCompletedEvent`) + `analyzeLibrary`/`listenToAnalysis*` wrappers + Analyze button + cyan progress bar + refresh-on-completed in `App.tsx`; contract tests green.*
- [x] **T1.2.3** Persist analysis results to SQLite — *shipped: `analysis.rs::persist_analysis_results` writes BPM/key/grid/phrases/vocals/LUFS + composite `analysis_version`, sets `analysis_status='complete'`; failure path stamps attempted version.*
- [x] **T1.2.4** Low-confidence / needs_review flagging — *`classify_analysis_status` in `analysis.rs` maps results → `complete` or `needs_review` (errors non-empty, bpm/key None, or phrase_confidence < 0.3); persist path writes the classified status; 7 unit tests + schema test green.*
- [x] **T1.2.5** Re-analyze support when version changes — *shipped: `analyze_library` skips rows whose `analysis_version` matches current composite unless `force:true`; failures re-runnable.*
- [ ] **T1.2.6** Golden fixture test harness (small curated set)

**Phase 1 Exit Check:** See `05-ACCEPTANCE.md` § Phase 1

---

## Phase 2 — Library Intelligence & Tag Cleanup (Days 31–55)

### 2.1 Library UX
- [ ] **T2.1.1** Search across title/artist/album/tags — *title/artist/album/path search already shipped in the Phase 0 library slice; tag-field search not yet*
- [ ] **T2.1.2** Multi-filter (BPM, key, genre, rating, analysis status)
- [ ] **T2.1.3** Bulk select + bulk metadata edit
- [ ] **T2.1.4** Ratings, tags, comments UI — *rating + comments are displayed read-only from file tags in the Phase 0 list; editing and tag assignment not yet*

### 2.2 Tag Surgeon
- [ ] **T2.2.1** Fuzzy clustering (case, space, accent, punctuation, prefixes)
- [ ] **T2.2.2** Canonical name suggestion engine
- [ ] **T2.2.3** Preview diff UI (affected count + samples)
- [ ] **T2.2.4** Bulk apply with confirmation
- [ ] **T2.2.5** Alias table + auto-map on future import
- [ ] **T2.2.6** Undo / history for bulk tag operations

### 2.3 Library Intelligence & Cues
- [ ] **T2.3.1** Hash duplicate detection + UI
- [ ] **T2.3.2** Version grouping (Radio / Extended / Club / Instrumental)
- [ ] **T2.3.3** Library Health Score computation + UI
- [ ] **T2.3.4** Prep Auditor Skill (checklist)
- [ ] **T2.3.5** Cue Master v1: generate structural cues from phrases
- [ ] **T2.3.6** Cue review / edit UI; AI vs user provenance

### 2.4 Professional Preview Player (prep-only, single-deck)
- [ ] **T2.4.1** Peaks cache (offline, per-track, content-addressed; overview + detail resolutions)
- [ ] **T2.4.2** Waveform UI (zoom, phrase bands, draggable cue/loop markers, color sections; <16ms/frame)
- [ ] **T2.4.3** Beat grid overlay (downbeat + bar lines from analysis; confidence display; halve/double + nudge hookup to F-3 beatgrid editor)
- [ ] **T2.4.4** Transport + beat jump (play/pause, seek-to-cue, grid-quantized ±1/4/8/16/32, temp loop 4/8/16 bars; seek <100ms; gain + limiter)
- [ ] **T2.4.5** Artwork panel (large-format `get_artwork` cache display; missing-art placeholder; high-res upgrade path)
- [ ] **T2.4.6** Keyboard map S-2 (space, ←/→ ±1, Shift ±4/±16, C cue, Esc stop; remappable) + output device/samplerate settings
- [ ] **T2.4.7** Player guardrails (local files only; single-deck; no crossfade/FX/record/streaming; audit-safe)

**Phase 2 Exit Check:** See `05-ACCEPTANCE.md` § Phase 2

---

## Phase 3 — Set Builder & Export (Days 41–70)

### 3.1 Set Construction
- [ ] **T3.1.1** Constraint data model
- [ ] **T3.1.2** Constraint form UI
- [ ] **T3.1.3** Optional NL → constraint parser (LLM) + structured fallback
- [ ] **T3.1.4** Candidate pool filtering (SQL)
- [ ] **T3.1.5** Transition scoring matrix
- [ ] **T3.1.6** Beam Search sequencer (width 10, duration-aware)
- [ ] **T3.1.7** Set persistence (local)
- [ ] **T3.1.8** Set list + ordered track UI
- [ ] **T3.1.9** Re-optimize / safer / more adventurous actions
- [ ] **T3.1.10** Transition explanation generation
- [ ] **T3.1.11** Energy Canvas visualization
- [ ] **T3.1.12** Lock & Fill
- [ ] **T3.1.13** Set Templates (save/load)

### 3.2 Export & Hardware
- [ ] **T3.2.1** rekordbox XML exporter (playlist + cues)
- [ ] **T3.2.2** Serato .crate binary exporter
- [ ] **T3.2.3** Export validation / dry-run checks
- [ ] **T3.2.4** Hardware validation protocol on CDJ-2000NXS2 / CDJ-3000
- [ ] **T3.2.5** Document supported export features and known limits
- [ ] **T3.2.6** USB drive detection + safety gates — *enumerate removable drives only (OS-native: Windows `GetDriveType`/`IOCTL_STORAGE`, macOS `diskutil`/`DiskArbitration`, Linux `udev`/`lsblk` removable flag); hard-block system/boot/internal drives and non-removable media; require explicit drive selection (never a default); unit tests for block-list logic + traversal-safe device IDs*
- [ ] **T3.2.7** Professional USB format engine (FAT32 + exFAT, Pioneer-tuned) — *OS-native format invocation via allow-listed commands only: Windows `format X: /FS:FAT32 /Q` (CLI supports > 32 GB on Win11; fall back to `fat32format`/`guiformat` where the GUI caps at 32 GB), macOS `diskutil eraseDisk FAT32 <LABEL> MBR /dev/diskN`, Linux `mkfs.vfat -F 32` / `mkfs.exfat`; **defaults: FAT32 + MBR, single primary active partition, 32 KB allocation unit** (16 KB acceptable on small sticks), ASCII uppercase label ≤ 11 chars; **exFAT path (MBR, single partition, 128 KB clusters)** gated behind an explicit "booth is exFAT-capable only" warning; never NTFS/GPT/multi-partition/encrypted; progress via `usb-format:progress` events; full format option for suspect drives*
- [ ] **T3.2.8** Post-format verify + CDJ-compat certification — *re-read filesystem + partition scheme from the OS after format; capacity + writability smoke check; emit a compat report: `FAT32 + MBR = universal (CDJ-2000 → CDJ-3000X, all XDJ)` vs `exFAT = limited (CDJ-3000 / CDJ-3000X / XDJ-RX3 / XDJ-XZ / OPUS-QUAD / XDJ-AZ and newer only — NXS2 and older do NOT read exFAT)`; failed verification blocks the USB-pack copy step*
- [ ] **T3.2.9** Format UI in Export dialog — *drive picker with size/model display, filesystem selector with Pioneer compat badges (FAT32 "plays everywhere" default; exFAT "new booths only" warning; HFS+ macOS-only note), double-confirm (select + type/acknowledge label — formatting is destructive and irreversible), progress + result panel; format must complete before USB-pack copy is offered*
- [ ] **T3.2.10** USB format docs + hardware validation extension — *supported-matrix doc (filesystems × players), drive guidance (32–64 GB ideal, Mass Storage Class, no hubs, export via app so `/PIONEER` + `/Contents` exist — never drag-copy — safely eject), extend T3.2.4 protocol: formatted sticks must mount on CDJ-2000NXS2 **and** CDJ-3000*

**Phase 3 Exit Check:** See `05-ACCEPTANCE.md` § Phase 3

---

## Phase 4 — Polish, Automation, Closed Beta (Days 61–90)

### 4.1 Skills Platform
- [ ] **T4.1.1** Skills registry + lifecycle interface
- [ ] **T4.1.2** Enable/disable (global + workspace)
- [ ] **T4.1.3** Run logging + before/after snapshots
- [ ] **T4.1.4** Undo path for mutating skills
- [ ] **T4.1.5** Kill-switch
- [ ] **T4.1.6** Skills control panel UI
- [ ] **T4.1.7** Implement: Cue Master, Tag Surgeon, Set Architect, Energy Cartographer
- [ ] **T4.1.8** Implement: Prep Auditor, Library Doctor, Harmonic Scout (basic), Missing Track Hunter (basic)
- [ ] **T4.1.9** Simple automation rule engine (WHEN / IF / THEN)
- [ ] **T4.1.10** Gig Ready one-click workflow

### 4.2 Cloud Foundation & Collaboration
- [ ] **T4.2.1** Fastify API auth + workspace model
- [ ] **T4.2.2** PostgreSQL schema + migrations
- [ ] **T4.2.3** Optional metadata/set sync (no audio)
- [ ] **T4.2.4** LLM gateway with schema validation + rate limits
- [ ] **T4.2.5** Minimum viable B2B shared set (metadata only)

### 4.3 Polish & Beta Readiness
- [ ] **T4.3.1** Waveform peaks + cue marker visualization
- [ ] **T4.3.2** Performance pass (startup, large library, analysis throughput)
- [ ] **T4.3.3** Empty states, error states, onboarding
- [ ] **T4.3.4** Opt-in crash reporting / basic telemetry (no audio content)
- [ ] **T4.3.5** Closed beta distribution mechanism
- [ ] **T4.3.6** Beta user feedback channel + triage process
- [ ] **T4.3.7** Final MVP acceptance run against `05-ACCEPTANCE.md`

**Phase 4 / MVP Exit Check:** See `05-ACCEPTANCE.md` § MVP

---

## Audit-Driven Tasks (TA) — from `docs/audit/04-improvements.md` + `05-proposed-specs-functions.md`

> Status: Planned. TA.x are tracked like phase tasks and may gate Phase 2/3 exit where noted. `TM.x` below is multi-provider export; `TC.x` (cross-cutting, bottom section) is unrelated — previously both used `TX.x`, now disambiguated.

- [x] **TA.1** Slim MVP scope in docs + gates — move USB-format + B2B + 4/8 Skills to P1 in `01-SPECIFICATION.md`/`05-ACCEPTANCE.md`/`03-PHASES-AND-PLAN.md`. Docs done 2026-10-14 (see TA.1-docs above); code deferral tracked by T3.2.x/T4.2.5 remaining open.
- [ ] **TA.2** Lock single similarity/set scoring formula versioned with `analysis_version` + unit test pinning weights (resolves Canonical vs shipped drift).
- [ ] **TA.3** Define energy source (user tag + LUFS proxy + 0–10 slider) in `DATA_MODEL.md`; `build_set` never blocks on missing ML mood.
- [ ] **TA.4** Implement `skill_runs(before_state/after_state)` + `undo_skill_run` round-trip test before Tag Surgeon/Cue Master UI (gates P2.3/P2.7).
- [ ] **TA.5** Contract codegen: `contracts/*.json` → `packages/shared` + Rust structs; CI drift check; error envelope `code/message/retry`.
- [ ] **TA.6** Golden 50-track fixtures (MP3/FLAC/AIFF/WAV + corrupt) + hash-before/after script + p50 bench on fixed hardware spec; use for P1.1–P1.6, M.1, M.3.
- [ ] **TA.7** Unified `settings.schema.json` (Zod + Rust): theme, threads, model dir+SHA, USB policy (default disabled/advanced), telemetry=false, artwork LRU 2GB, OAuth port range, `RUST_LOG`, DB path; settings UI editor.
- [ ] **TA.8** USB safety hardening: rescan + no-default-select + type-label-to-confirm + dry-run + MBR verify + `skill_runs` audit (gates T3.2.6–T3.2.9).
- [ ] **TA.9** Error catalog `E_SCAN_*/E_ANALYSIS_*/E_EXPORT_*/E_USB_*/E_PROVIDER_*` on `error` event + docs.
- [ ] **TA.10** Log retention 14d + PII redact + `analysis_version` on every row; artwork LRU cap.
- [ ] **TA.11** Window default 1440x900 + frontend budgets (10k rows <100ms virtualized, waveform <16ms/frame).
- [ ] **TA.12** CI hardening: secret scan live, Cargo audit nightly already gating — add model-perf regression + pin Vite/Tailwind minor until Phase 3 exit.
- [ ] **TA.13** P1 functions F-1–F-10: smart playlists/history, relink (BLAKE3), beatgrid editor + correction memory, cue templates `.cuepreset`, harmonic traffic-light + mix-out + vocal warning, set versioning/diff, USB verify + set sheet, Prep Auditor queue, waveform peaks + cue drag (now with Preview Player T2.4.1–T2.4.7: grid overlay + beat jump + artwork), bulk tag preview+undo.
- [ ] **TA.14** Settings specs S-1–S-7: Profiles, Preview gain/keymap, Library locations+ignore+relink, Model manager, Privacy center, USB policy, Telemetry off-default.

---

## Post-MVP (Not Scheduled) — Discovery, Enrichment & Streaming Export

> **Status:** Partially shipped, partially post-MVP. Foundations + early slices are **live and non-gating**: `TF.1–TF.6` (local similarity, providers, migrations 003/004, IPC, UI), `TD.3` (chart snapshots, migration 005), `TE.1–TE.4` (adapters, pipeline, review UI, health score), `TM.1`/`TM.2a` (provider abstraction, Deezer live match). The remainder (`TP.x`, rest of `TD/TE/TM`) is **planned post-MVP, not scheduled, non-gating** (see `01-SPECIFICATION.md` §3, `02-SYSTEM-DESIGN.md` §3.6–3.8, `03-PHASES-AND-PLAN.md` §11, [ADR-0006](../ADR/0006-spotify-playlist-export.md), [ADR-0007](../ADR/0007-similar-tracks-enrichment-multiprovider.md)). Do not schedule the planned remainder until MVP ships.

### TF — Discovery & Provider Foundations (shipped)

Local-first groundwork with no network access, so later tracks extend rows and matchers instead of schema or contracts.

- [x] **TF.1** Local similar-track scoring engine — *`crates/core/src/similarity.rs`: BPM 45% / Camelot 35% / genre 10% / duration 10%, renormalised over available signals; wheel-aware `camelot_distance` (0 same, 1 adjacent/relative, 2 diagonal, cap 6); deterministic ordering; 8 unit tests*
- [x] **TF.2** Provider registry + store buy-links — *`crates/core/src/providers.rs`: closed `StreamingProvider` / `StoreProvider` enums; pure per-store search-URL builders (Beatport, Traxsource, Juno Download, Bandcamp, Discogs); 4 unit tests. No API, no audio — Tier 0 of the store integration*
- [x] **TF.3** Migrations 003 + 004 — *003: `isrc`, `external_ids`, `enrichment_runs`, generalized `streaming_*` tables; 004: `enrichment_runs.before_state`/`after_state` + `enrichment_candidates` proposals table. Both apply cleanly in order; scanner INSERT is column-explicit so ADD COLUMNs are safe*
- [x] **TF.4** IPC: `find_similar_tracks`, `track_tag_health`, `store_links_for_track`, `provider_status` — *all local reads; registered in `lib.rs`; mirrored in `packages/shared` + contract tests*
- [x] **TF.5** Library UI: inspector drawer (similar + gaps + buy-links), Tag Health modal, provider status — *`App.tsx`; mock-safe API wrappers; Esc closes drawer/modal*
- [x] **TF.6** ADR-0007 (similar tracks, enrichment & multi-provider strategy) + data-model note

### TP — Streaming Export (Spotify, reference implementation)

- [ ] **TP.1** PKCE OAuth + keychain token store — *OAuth 2.0 Authorization Code + PKCE (RFC 7636) in the Tauri app; loopback redirect (`http://127.0.0.1:<port>/callback`) or custom URI scheme; embedded public client ID (no client secret); refresh tokens stored in the OS keychain; minimal scopes (`playlist-modify-private` default; `playlist-modify-public` / `playlist-read-private` only when needed)*
- [ ] **TP.2** Spotify Web API client + rate-limit/backoff — *search, create playlist, add tracks (chunked ≤ 100 URIs/request); honor `429` + `Retry-After` with exponential backoff; `401` → token refresh; surface `403`/`404`*
- [ ] **TP.3** ISRC + fuzzy matching engine with confidence — *ISRC-first match → fuzzy fallback on normalized title/artist/album + ±3 s duration tolerance → confidence score; high/medium/low tiers mirroring the existing `needs_review` pattern*
- [ ] **TP.4** Export orchestration (set → playlist) + review queue — *publish a built set (or any playlist) as a real Spotify playlist from metadata only; high-confidence auto-add; medium/low to review queue; unmatched report with “search Spotify manually” / “skip”; record the created playlist as reversible/deletable*
- [ ] **TP.5** Connect/disconnect/revoke + match-review UI — *connect, disconnect/revoke (removes tokens), and a match-review screen for the confidence tiers and unmatched tracks*
- [ ] **TP.6** Tests (matching, backoff, token refresh, no-audio guarantee) — *unit/fixture coverage for the matcher, `429`/`Retry-After` backoff, token refresh without re-auth, and an automated assertion that no source audio is read, streamed, stored, or uploaded*
- [ ] **TP.7** Docs + telemetry/logging — *document scopes, privacy posture, and known limits; audit-log export actions without logging audio or secrets*

### TD — Discovery: External Similarity, Charts & Release Radar

Builds on TF.1/TF.4 (local scoring + `ScoredTrack` shape). External signals arrive with a `source` attached and never auto-modify sets.

- [x] **TD.3** Chart snapshots Tier 1 — *migration 005 `chart_snapshots`; `chart_import_snapshot` (validated, idempotent re-import) + `chart_list` with ISRC-exact ownership and 60/40 tempo/key taste scores vs a seed track; Charts modal (Top 100 / Hype × genre, taste-match toggle, owned badges, sample-data loader); format reference + shape tests in `fixtures/charts/*.SAMPLE.json`. Snapshots are versioned data — no catalog API exists*
- [ ] **TD.1** External similarity providers (opt-in) — *Last.fm `track.getSimilar` first (best free similarity graph for electronic music), then Deezer/Spotify seed recommendations; ISRC join via `external_ids`; per-provider opt-in toggle; cached 30 days; only IDs + metadata cross the network*
- [ ] **TD.2** Similar-tracks UI v2 — *source badges (Local / Last.fm / Deezer), "why" explanations, add-to-set from a result, set-gap mode ("suggest a 124 BPM 8A bridge for position 12")*
- [ ] **TD.4** Release radar Tier 2 — *follow artists/labels inside the app; poll public store feeds the user opts into (Beatport/Traxsource/Juno); weekly "new from your labels" digest with mix-compatibility flags; pre-order/exclusive badges; price/sale + buy-list with budget*
- [ ] **TD.5** Beatport partnership Tier 3 — *apply for Beatport LINK / affiliate access; replace snapshots with official feed when granted; scraping with user credentials is explicitly not the default path*
- [ ] **TD.6** Tests — *snapshot determinism, taste-filter correctness, feed-parser fixtures, no-audio invariant for every provider call*

### TE — Enrichment: Online Tags & Artwork (opt-in)

Builds on TF.3/TF.4 (`track_tag_health` gaps + `external_ids` cache). Every run is preview → apply → undo; writes DB canonical fields, never source files.

- [x] **TE.1** Provider adapters — *`crates/core/src/enrichment.rs`: pure query builders + response parsers + `match_confidence` tiers for MusicBrainz (+ Cover Art Archive front URLs), iTunes Search (600px art upgrade) and Deezer (ISRC + 1000px art); all three verified against live API responses; 11 unit tests. Audio preview URLs are never fetched by design. **Extended:** Discogs (`"Artist - Title"` split, year/label/cover), Last.fm `track.search`, AcoustID lookup (name+acoustic blended confidence) — query/parse/tested; Discogs/Last.fm need exported keys, AcoustID still needs native Chromaprint fingerprinting (run rejected with reason until then)*
- [x] **TE.2** Match pipeline — *ISRC-first → fingerprint → fuzzy with confidence tiers in the preview command; results cached in `external_ids`; runs + per-field proposals in `enrichment_runs` / `enrichment_candidates` (migration 004); `enrichment:progress` events*
- [x] **TE.3** Enrichment review UI — *Tag Health modal: provider picker, live lookup, per-track before → after diffs with tier badges, checkbox selection, bulk apply with confirmation, undo per run; artwork upgrade fills empty slots only (download + content-addressed cache)*
- [x] **TE.4** Tag Health Score — *core `tag_health_score` (title/artist 25, album/isrc/artwork 10, genre/year 5, bpm/key 4, duration 2) + library average; per-gap badges and header score in the modal; feeds the Prep Auditor checklist direction*
- [ ] **TE.5** Adapter expansion — *native Chromaprint fingerprinting (needs the C library — no cmake/perl on all dev machines, so gated); quota/backoff tests with mocked transport, undo round-trips, no-audio invariant*

### TM — Multi-Provider Streaming Export (was `TX` — renamed to resolve the `TX`/cross-cutting collision)

Generalizes TP: Spotify is the reference implementation of the generic `provider_match_set` / `provider_export_playlist` contract against the `provider` enum in `streaming_*`.

- [x] **TM.1** Provider abstraction — *generic `provider_match_set` / `provider_export_playlist` IPC live; per-provider `ProviderCapabilities` (live match, ISRC search, playlist write, needs-app-ID) surfaced in `provider_status`; Spotify re-implementation on top waits on TP*
- [x] **TM.2a** Deezer matching (live reads) — *`provider_match_tracks` (ISRC-exact → fuzzy, confidence tiers, stateless, no key); per-track "Match on Deezer" in the inspector drawer*
- [ ] **TM.2b** Deezer connect + export — *OAuth + keychain tokens + review queue + undo; needs a registered Deezer application ID (`DEEZER_APP_ID`) — plumbing waits on credentials*
- [ ] **TM.3** Apple Music / YouTube Music / SoundCloud / TIDAL — *one at a time, each with matcher + review UI + undo; in-app streaming playback stays out of scope everywhere*
- [ ] **TM.4** Tests — *per-provider matcher fixtures, chunked-add/backoff per API, undo (delete/unfollow) per provider*

**Post-MVP Exit Check:** See `05-ACCEPTANCE.md` § Post-MVP — Discovery, Enrichment & Streaming Export (Non-Gating).

---

## Cross-Cutting Tasks (Ongoing)

> IDs `TC.x` (cross-cutting). Formerly `TX.x` — renamed 2026-10-14 to resolve the collision with multi-provider export (now `TM.x`).

### Testing
- [x] **TC.1** Maintain golden audio fixture suite (expand each phase) — *synthetic corpus in `fixtures/audio/` generated by `scripts/make-fixtures.py`, verified against `manifest.json`; expand per phase*
- [ ] **TC.2** Fuzz / property tests for parsers and path handling
- [ ] **TC.3** Export snapshot tests + round-trip load checks
- [ ] **TC.4** Source-audio hash audit script in CI/dev workflow
- [ ] **TC.5** Skill undo integration tests for every mutating Skill
- [ ] **TC.6** Benchmark harness for analysis p50 (Criterion)
- [ ] **TC.7** E2E smoke journey (import → analyze → set → export) by Phase 4
- [x] **TC.8** Corrupt/malformed audio corpus kept passing — *4 corrupt fixtures (truncated WAV, garbage MP3, empty FLAC, header-only AIFF) asserted non-fatal in `scan_corpus.rs` + `fixture_manifest.rs`*

### Security
- [ ] **TC.9** Security review of FS access + IPC surface (each phase exit)
- [ ] **TC.10** Privacy review: confirm no audio leaves device by default
- [ ] **TC.11** Tauri capabilities + CSP re-audit on config changes
- [ ] **TC.12** LLM gateway schema-validation tests (adversarial prompts)
- [ ] **TC.13** Kill-switch behavior test
- [ ] **TC.14** Dependency pin + audit cadence (monthly)
- [ ] **TC.15** Secrets scanning in CI

### DevOps / CI/CD
- [ ] **TC.20** Pin GitHub Actions to full SHAs before public launch
- [ ] **TC.21** Release workflow + Environment `release` with required reviewers
- [ ] **TC.22** SHA-256 checksums on all release artifacts
- [ ] **TC.23** SBOM generation on release (Phase 4+)
- [ ] **TC.24** Code signing / notarization for beta and 1.0
- [ ] **TC.25** CodeQL (or equivalent SAST) on default branch
- [ ] **TC.26** Secret scanning / push protection enabled
- [ ] **TC.27** Pipeline security checklist enforced on workflow PRs

### Process
- [ ] **TC.16** Keep SDD docs and `docs/` in sync with code
- [ ] **TC.17** Weekly update of this task list
- [ ] **TC.18** CHANGELOG.md maintenance
- [ ] **TC.19** PR template includes test plan + security checklist sections

---

## Task ID Legend

- `T0.x.x` — Phase 0
- `T1.x.x` — Phase 1
- `T2.x.x` — Phase 2
- `T3.x.x` — Phase 3
- `T4.x.x` — Phase 4
- `TA.x` — Audit-driven (from `docs/audit/`; gates noted per task)
- `TP.x` — Post-MVP: Spotify Playlist Export (planned, non-gating)
- `TD.x` — Discovery incl. similar tracks, charts, release radar (TD.3 shipped; rest planned, non-gating)
- `TE.x` — Online tag/artwork enrichment (TE.1–TE.4 shipped; TE.5 planned, non-gating)
- `TM.x` — Multi-provider streaming export (TM.1/TM.2a shipped; rest planned, non-gating; was `TX.x`, renamed 2026-10-14)
- `TF.x` — Discovery & provider foundations (shipped: local similarity, tag health, store links, provider status)
- `TC.x` — Cross-cutting (was `TX.x`, renamed 2026-10-14)

When creating GitHub issues, prefer these IDs in titles for traceability.
