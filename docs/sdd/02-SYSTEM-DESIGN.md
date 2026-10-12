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

### 3.4 Set Builder & Export (WS4)
- Constraint model (structured + optional NL)
- Candidate filtering
- Transition scoring matrix
- Beam Search (width 10)
- Energy Canvas, Lock & Fill, Templates
- rekordbox XML + Serato .crate exporters
- Hardware validation path

### 3.5 Cloud, Collaboration & Skills Platform (WS5)
- Skills runtime (local-first execution)
- Automation rules + Gig Ready
- Auth, workspaces, shared sets
- LLM gateway with schema validation
- pgvector for future similarity search

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
- Typed request/response commands
- Examples: `scan_folder`, `analyze_tracks`, `run_skill`, `build_set`, `export_set`
- Large binary data transferred by reference (paths) where possible

### Export Contracts
- rekordbox XML must load in rekordbox and on Pioneer CDJs
- Serato .crate must load in Serato
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
| Analysis throughput | p50 < 3s/track on mid-range laptop |
| End-to-end 40-track prep | < 15 minutes |
| Startup | Fast enough for daily use (target < 3–4s to interactive) |
| Offline | Full core workflow available |
| Reliability | Zero source-file corruption |

---

## 10. Open Design Items (to resolve in Phase 0–1)

- Exact ONNX model selection & quantization strategy
- Final SQLite schema migration tooling
- Auth provider for cloud (if cloud ships in MVP window)
- Waveform peak storage format
