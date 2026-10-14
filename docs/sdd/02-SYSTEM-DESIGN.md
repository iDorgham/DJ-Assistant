# 02 — System Design

**SDD Artifact:** System Architecture & Detailed Design  
**Status:** Approved for implementation  
**Companion docs:** `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DATA_MODEL.md`, `docs/architecture/SKILLS_SYSTEM.md`, `docs/engineering/SECURITY_AND_PRIVACY.md`

---

## 1. Architectural Style

- **Desktop-first** companion application (Tauri v2)
- **Local-first** data and analysis
- **Optional cloud control plane** for collaboration, sync, and LLM gateway
- **Hybrid intelligence**: deterministic engines + narrowly scoped LLM usage
- **Skill-oriented automation** with full observability and reversibility

---

## 2. High-Level Component View

```
┌─────────────────────────────────────────────────────────────┐
│                    TAURI v2 DESKTOP APP                     │
│  React + TypeScript UI  ←──IPC──→  Rust Core Backend        │
│  • Library Browser                                           │
│  • Waveform / Energy Canvas                                  │
│  • Set Builder UI                                            │
│  • Skills Control Panel                                      │
│                                                              │
│  Rust Core                                                   │
│  • Folder watcher (notify)                                   │
│  • BLAKE3 hashing & dedup                                    │
│  • Metadata extraction (audiotags)                           │
│  • Local SQLite                                              │
│  • Rule / Skills engine                                      │
│  • Export generators (quick-xml, crate serializer)           │
│                                                              │
│  Native Audio Engine                                         │
│  • Symphonia (decode)                                        │
│  • ONNX Runtime (BPM, key, structure, vocals, loudness)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / WSS (optional)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   CLOUD CONTROL PLANE                        │
│  Fastify + PostgreSQL 16 + pgvector + Redis/BullMQ           │
│  • Auth & Workspaces                                         │
│  • LLM Gateway (constraints, explanations)                   │
│  • Collaboration (shared sets, no audio)                     │
│  • Vector search & embeddings                                │
│  • Optional metadata / set sync                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Major Subsystems

### 3.1 Desktop Shell & Local Data (WS1)
- Tauri window + React UI
- File system access limited to user-selected roots
- SQLite as local source of truth
- Workspace concept (even if single-user initially)

### 3.2 Audio Analysis Engine (WS2)
- Fully local ONNX pipeline
- Job queue + progress reporting
- Versioned analysis results
- Low-confidence review flags

### 3.3 Library, Cues & Tag Intelligence (WS3)
- Library browser with rich filtering
- Cue Master (structural + genre heuristics)
- Tag Surgeon (fuzzy clustering, aliases, undo)
- Library Health Score & Prep Auditor
- Professional Preview Player (prep-only single-deck: cached waveform + grid overlay + beat jump + artwork; local files only, no mixing — spec §3A, tasks T2.4.1–T2.4.7)

### 3.4 Set Builder & Export (WS4)
- Constraint model (structured + optional NL)
- Candidate filtering
- Transition scoring matrix — single locked formula versioned with `analysis_version` (see TA.2)
- Energy = user tag + LUFS proxy + manual 0–10 slider; never blocks `build_set`
- Beam Search (width 10)
- Energy Canvas, Lock & Fill, Templates
- Set versioning + diff + safer/bolder alternatives persisted (F-6)
- Harmonic traffic-light + mix-out window + vocal-overlap warning (F-5)
- rekordbox XML + Serato .crate exporters + USB pack verify + set sheet PDF/CSV (F-7)
- Professional USB media format tool (FAT32 + exFAT, Pioneer-tuned) + post-format verify/certify + dry-run + type-to-confirm (P1 per audit)
- Hardware validation path

### 3.5 Cloud, Collaboration & Skills Platform (WS5)
- Skills runtime (local-first execution)
- Automation rules + Gig Ready
- Auth, workspaces, shared sets
- LLM gateway with schema validation
- pgvector for future similarity search

### 3.6 Streaming Export — Spotify (Planned, Post-MVP)
- **Desktop-only**: runs entirely in the Tauri app; the cloud control plane is not involved
- **Metadata-only external service**: sends track metadata + search queries to the Spotify Web API; never downloads, streams, stores, or uploads audio
- **Auth**: OAuth 2.0 Authorization Code + PKCE (RFC 7636) via loopback redirect (`http://127.0.0.1:<port>/callback`) or custom URI scheme; embedded public client ID; refresh tokens in the OS keychain
- **Matching engine**: ISRC-first match → fuzzy fallback (normalized title/artist/album + ±3 s duration) → confidence tiers → reuse of the existing `needs_review` review-queue pattern → unmatched report
- **Export orchestration**: create playlist + chunked add-tracks (≤ 100 URIs/request); `429` → backoff honoring `Retry-After`; `401` → token refresh; surface `403`/`404`
- **Reversibility**: the created playlist is recorded locally so the DJ can delete it; audited like other side-effecting actions
- **Isolation**: no dependency on WS1–WS4 internals beyond reading local metadata; failure of this component never blocks the offline core workflow

**Flow (desktop-only, external service):**

```
User: prepare set → Export to Spotify
    │
    ▼
[OAuth 2.0 + PKCE]  ── browser ──▶  Spotify authorize  ──▶  loopback callback  ──▶  token in OS keychain
    │
    ▼
[Match engine]  ISRC → fuzzy (±3 s) → confidence
    ├─ high   → auto-add
    ├─ med/low→ review queue (needs_review pattern)
    └─ none   → unmatched report ("search manually" / "skip")
    │
    ▼
[Export orchestrator]  create playlist → add tracks (chunked ≤ 100 URIs, 429 backoff, 401 refresh)
    │
    ▼
Record created playlist (deletable from app) + audit log       [no audio read/streamed/uploaded]
```

### 3.7 Discovery & Enrichment (TF shipped; TD/TE planned, post-MVP)

- **Local similarity first**: `similarity.rs` scores BPM/key/genre/duration with no I/O; `find_similar_tracks` serves the inspector drawer. External similarity reuses the `ScoredTrack` shape with a `source` field.
- **Gap detection before lookup**: `track_tag_health` is a pure-DB read; online adapters (MusicBrainz, iTunes, Deezer, Discogs, AcoustID) are opt-in, cached in `external_ids`, and gated by the preview → apply → undo flow recorded in `enrichment_runs`.
- **Charts without an API**: Beatport/Traxstore/Juno catalogs have no stable public catalog API for a desktop client, so charts enter as versioned snapshot data filtered locally by taste; buy-links (Tier 0) are pure URLs.

### 3.8 Multi-Provider Registry (TF shipped; TX planned, post-MVP)

- **Closed enums, open rows**: `StreamingProvider` / `StoreProvider` in `providers.rs`; `streaming_*` tables carry a free-text `provider` column — new targets add matchers, never schema.
- **Spotify is the reference**: generic `provider_match_set` / `provider_export_playlist` contracts; Deezer second (open API + ISRC search).

---

## 4. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop framework | Tauri v2 | Smaller, safer, native performance vs Electron |
| Analysis runtime | ONNX Runtime in Rust | Offline, fast, no Python dependency |
| Sequencing | Beam Search (not LLM) | Deterministic, optimizable, no hallucination |
| Local DB | SQLite | Simple, reliable, offline-first |
| Cloud API | Fastify (TypeScript) | Fast, good DX, shared language with frontend |
| Cloud DB | PostgreSQL 16 + pgvector | Mature + vector search when needed |
| Automation model | Scoped Skills | Controllable, reversible, auditable |

---

## 5. Data Design Summary

- **Local SQLite**: tracks, cues, phrases, aliases, skill_runs, sets, preferences, watch_folders
- **Cloud PostgreSQL**: users, workspaces, synced features/metadata, shared sets, embeddings (opt-in)
- Raw audio and full waveforms stay on device only
- Every bulk mutation writes history for undo

See `docs/architecture/DATA_MODEL.md` for column-level detail.

---

## 6. Interface Design (Critical Paths)

### IPC (React ↔ Rust)
- Typed request/response commands generated from single `contracts/*.json` → `packages/shared` + Rust structs; CI fails on drift (TA.5)
- Examples: `scan_folder`, `analyze_tracks`, `run_skill`, `build_set`, `export_set`
- Large binary data transferred by reference (paths) where possible
- Errors: cataloged `E_SCAN_*/E_ANALYSIS_*/E_EXPORT_*/E_USB_*/E_PROVIDER_*` with `code/message/retry` envelope

### Export Contracts
- rekordbox XML must load in rekordbox and on Pioneer CDJs
- Serato .crate must load in Serato
- USB format defaults to FAT32 + MBR, single primary active partition (universal across CDJ-2000 → CDJ-3000X and all XDJ); exFAT (MBR, single partition) only behind an explicit booth-capability warning — NXS2 and older do not read exFAT; never NTFS/GPT
- Zero modification of source audio

### Skills Interface
- Standard lifecycle: pre-flight → snapshot → execute → record → notify
- Mandatory undo support for mutating skills

---

## 7. AI / Intelligence Design Boundaries

```
User Intent
    │
    ▼
[LLM Constraint Extractor]  ←── only place LLM chooses structure
    │
    ▼
[Candidate Filter + Scoring Matrix]  ←── deterministic
    │
    ▼
[Beam Search Sequencer]  ←── deterministic optimization
    │
    ▼
[Explanation Generator]  ←── LLM or templates
    │
    ▼
DJ Review & Override
```

**Rule:** The LLM never emits the final ordered tracklist.

---

## 8. Security & Privacy Design

- Filesystem access restricted to user-approved directories
- No raw audio upload in v1 architecture
- Skills mutations always logged + reversible
- LLM outputs treated as untrusted and schema-validated
- Tauri capability allowlists used

See `docs/engineering/SECURITY_AND_PRIVACY.md`.

---

## 9. Non-Functional Targets

| Attribute | Target |
|-----------|--------|
| Analysis throughput | p50 < 3s/track on fixed bench spec (see TA.6) |
| End-to-end 40-track prep | < 15 minutes |
| Startup | Fast enough for daily use (target < 3–4s to interactive) |
| Library list | 10k rows virtualized <100ms |
| Waveform | <16ms/frame |
| Window | Default 1440x900, min 1100x700 (audit: 1280x800 cramped for 3-pane) |
| Offline | Full core workflow available |
| Reliability | Zero source-file corruption |
| Settings | Validated `settings.schema.json` (Zod + Rust); telemetry default off |
| Logs | 14d rotation, PII-redacted cloud logs |

---

## 10. Open Design Items (to resolve in Phase 0–1)

- Exact ONNX model selection & quantization strategy
- Final SQLite schema migration tooling
- Auth provider for cloud (if cloud ships in MVP window)
- Waveform peak storage format
- ~~Resolved by audit (see `04-TASKS.md` TA.x):~~ energy source (user tag + LUFS proxy + slider), scoring formula lock, settings schema, error catalog, golden fixtures, USB safety hardening
