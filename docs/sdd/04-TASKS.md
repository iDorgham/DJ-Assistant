# 04 — Task Breakdown

**SDD Artifact:** Concrete Engineering Tasks  
**Status:** Living  
**Last reconciled:** 2026-10-12 (against actual code on disk)  
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
- [x] **T0.1.12** Fixture directory layout (`fixtures/audio`, `metadata`, `exports`)
- [x] **T0.1.13** Path canonicalization utility + traversal unit tests
- [x] **T0.1.14** Tauri CSP + capability allowlists locked to least privilege
- [x] **T0.1.15** Dependency audit workflow (cargo audit / npm audit schedule) — *`nightly-audit.yml` now **gates** weekly (Mondays 09:00 UTC): `pnpm audit --prod --audit-level=high` fails on high/critical JS advisories, and `cargo audit` (prebuilt via `taiki-e/install-action`, run against the workspace `Cargo.lock`) fails on any RustSec vulnerability; non-vulnerability warnings are reported but do not fail the job*
- [x] **T0.1.16** Copy GitHub workflow templates into `.github/workflows/` (pr-ci, main-ci) — *actual live: `pr-ci.yml`, `main-ci.yml`, `desktop-build.yml`*
- [ ] **T0.1.17** Branch protection on `main`: required PR checks, no direct push — *blocked by plan: required checks on a **private** repo need GitHub Pro (`403 Upgrade to GitHub Pro or make this repository public`). Documented exception with the exact checks + command in [`docs/devops/github-workflows/README.md`](../../devops/github-workflows/README.md#branch-protection--pending-plan-phase-0-exception-task-t0117)*
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
- [ ] **T1.1.5** Phrase / structure segmentation — *deterministic beat-grid-snapped novelty path in `crates/analysis/src/phrase.rs` (`detect_phrases`): per-bar RMS (dB energy delta), spectral-flux delta, and 12-bin chroma cosine distance combined into a boundary-novelty curve (mean + 0.5σ threshold, 2-bar min spacing), snapped to {4, 8, 16, 32}-bar phrases (±2-bar tolerance) off the T1.1.3 beat grid, with heuristic intro/build/drop/breakdown/outro labels from track-relative energy profile; degrades to an empty map (never an error) without a usable grid; ONNX seam reserved via `PhraseMethod::Onnx`; 8 new tests (synthesized six-section structure track, steady-track single phrase, grid coupling, real-FLAC smoke); full suite 59 green, `cargo fmt`/`clippy -D warnings` clean*
- [ ] **T1.1.6** Vocal presence / density — *deterministic mid/side STFT heuristic in `crates/analysis/src/vocal.rs` (vocal-band energy ratio over a ≥150 Hz denominator + center-dominance gate + median smoothing), producing a `0..=1` density curve + aggregate with an ONNX seam; full `vocal` test suite (11 tests, incl. wide-panned-pad and transient-rejection cases) green; `cargo fmt --check` + `cargo clippy -p dj-assistant-analysis -- -D warnings` clean*
- [ ] **T1.1.7** Loudness (EBU R128) — *EBU R128 / BS.1770-4 measurement in `crates/analysis/src/loudness.rs` (`detect_loudness`) on the pure-Rust `ebur128` crate: gated integrated LUFS + true peak (dBTP) + loudness range (Tech 3342); channels fed natively per BS.1770 channel-power sum (mono-downmix would misread correlated stereo ~9 LU; >2ch downmixed to stereo); silence/undefined results floored to -70.0 LUFS (the spec's absolute gate) so the profile is always finite; no options struct or method enum — deterministic spec with no tunables/alternate engine; full `loudness` test suite (11 tests, incl. sine-at-known-LUFS spec anchor, stereo = mono + 3.01 LU, relative-gate exclusion, inter-sample overshoot probe, real-FLAC smoke) green; `cargo fmt --check` + `cargo clippy -p dj-assistant-analysis -- -D warnings` clean*
- [ ] **T1.1.8** Model registry / analysis_version field — *registry type in place; DB `analysis_version` column + stamping still to do*

### 1.2 Pipeline & UI
- [ ] **T1.2.1** Local analysis job queue
- [ ] **T1.2.2** Per-track + overall progress IPC + UI
- [ ] **T1.2.3** Persist analysis results to SQLite
- [ ] **T1.2.4** Low-confidence / needs_review flagging
- [ ] **T1.2.5** Re-analyze support when version changes
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

## Cross-Cutting Tasks (Ongoing)

### Testing
- [x] **TX.1** Maintain golden audio fixture suite (expand each phase) — *synthetic corpus in `fixtures/audio/` generated by `scripts/make-fixtures.py`, verified against `manifest.json`; expand per phase*
- [ ] **TX.2** Fuzz / property tests for parsers and path handling
- [ ] **TX.3** Export snapshot tests + round-trip load checks
- [ ] **TX.4** Source-audio hash audit script in CI/dev workflow
- [ ] **TX.5** Skill undo integration tests for every mutating Skill
- [ ] **TX.6** Benchmark harness for analysis p50 (Criterion)
- [ ] **TX.7** E2E smoke journey (import → analyze → set → export) by Phase 4
- [x] **TX.8** Corrupt/malformed audio corpus kept passing — *4 corrupt fixtures (truncated WAV, garbage MP3, empty FLAC, header-only AIFF) asserted non-fatal in `scan_corpus.rs` + `fixture_manifest.rs`*

### Security
- [ ] **TX.9** Security review of FS access + IPC surface (each phase exit)
- [ ] **TX.10** Privacy review: confirm no audio leaves device by default
- [ ] **TX.11** Tauri capabilities + CSP re-audit on config changes
- [ ] **TX.12** LLM gateway schema-validation tests (adversarial prompts)
- [ ] **TX.13** Kill-switch behavior test
- [ ] **TX.14** Dependency pin + audit cadence (monthly)
- [ ] **TX.15** Secrets scanning in CI

### DevOps / CI/CD
- [ ] **TX.20** Pin GitHub Actions to full SHAs before public launch
- [ ] **TX.21** Release workflow + Environment `release` with required reviewers
- [ ] **TX.22** SHA-256 checksums on all release artifacts
- [ ] **TX.23** SBOM generation on release (Phase 4+)
- [ ] **TX.24** Code signing / notarization for beta and 1.0
- [ ] **TX.25** CodeQL (or equivalent SAST) on default branch
- [ ] **TX.26** Secret scanning / push protection enabled
- [ ] **TX.27** Pipeline security checklist enforced on workflow PRs

### Process
- [ ] **TX.16** Keep SDD docs and `docs/` in sync with code
- [ ] **TX.17** Weekly update of this task list
- [ ] **TX.18** CHANGELOG.md maintenance
- [ ] **TX.19** PR template includes test plan + security checklist sections

---

## Task ID Legend

- `T0.x.x` — Phase 0
- `T1.x.x` — Phase 1
- `T2.x.x` — Phase 2
- `T3.x.x` — Phase 3
- `T4.x.x` — Phase 4
- `TX.x` — Cross-cutting

When creating GitHub issues, prefer these IDs in titles for traceability.
