# DJ Assistant — System Architecture

**Status:** Approved for Engineering  
**Source of Truth:** Canonical Documentation v1.1 + this document  
**Last Updated:** 2026-10-08

---

## 1. Architectural Goals

1. **Local-first & Privacy-preserving** — Audio files and analysis never leave the user’s machine by default.
2. **High performance on consumer hardware** — 40+ track analysis + set generation in ≤ 15 minutes.
3. **Hybrid AI** — Deterministic optimization (Beam Search) for sequencing; LLM only for natural-language constraint extraction and explanations.
4. **Reversibility** — Every automated action (Skills, bulk tag fixes, cue generation) is logged and undoable.
5. **Non-destructive** — Source audio is never modified. All outputs are export files or local metadata.
6. **Offline-capable core** — Full library management, analysis, cue generation, and basic set building work without internet.
7. **Optional cloud enhancement** — Collaboration (B2B), global search, embeddings, and advanced LLM features.

---

## 2. High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TAURI V2 DESKTOP COMPANION                          │
│                                                                             │
│  ┌─────────────────────────┐            ┌────────────────────────────────┐  │
│  │   UI LAYER (React)      │◄──IPC─────►│ RUST CORE BACKEND              │  │
│  │   • Waveform Canvas     │  (JSON)    │ • Watch Folders (notify)       │  │
│  │   • Energy Graph Canvas │            │ • SQLite Local Metadata DB     │  │
│  │   • Skill Control Panel │            │ • Local Rule Engine            │  │
│  │   • Set Builder UI      │            │ • File Hashing (BLAKE3)        │  │
│  └─────────────────────────┘            └───────────────┬────────────────┘  │
│                                                         │                   │
│                                                         ▼                   │
│                                         ┌────────────────────────────────┐  │
│                                         │ NATIVE AUDIO ENGINE            │  │
│                                         │ • Symphonia (Decoding)         │  │
│                                         │ • ONNX Runtime (BPM/Key/Vocal) │  │
│                                         │ • Structural Segmentation      │  │
│                                         │ • Quick-XML (rekordbox export) │  │
│                                         │ • Binary Crate Serializer      │  │
│                                         └────────────────────────────────┘  │
└─────────────────────────────────────────┬───────────────────────────────────┘
                                          │ HTTPS / WSS (optional)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLOUD CONTROL PLANE                              │
│  • Fastify API (LLM Constraint Parser & Workflow Orchestrator)              │
│  • PostgreSQL 16 + pgvector (Embeddings, Set Indexing, Collaboration)       │
│  • Redis + BullMQ (Async Task Queue & Sync Buffer)                          │
│  • Auth • Track Service • Set Builder Service • Search • Collaboration      │
│  • AI Gateway (LLM + Embedding Models)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Responsibilities

### 3.1 Desktop App (Tauri v2)

| Component | Responsibility |
|-----------|----------------|
| **React UI** | Waveform visualization, Energy Canvas, Set Builder, Skills panel, Library browser, Tag Cleanup UI |
| **Rust Core** | Folder watching, file hashing, metadata extraction, orchestration of analysis, local SQLite, rule engine, export generation |
| **Native Audio Engine** | Decode audio (Symphonia), run ONNX models, compute beat grid / key / phrases / vocal presence / loudness |
| **Local SQLite** | Track metadata, analysis results, cue points, skill history, user preferences, aliases |
| **IPC Layer** | Typed JSON messages between React and Rust (see Canonical §6.1) |

### 3.2 Cloud Control Plane

| Service | Responsibility |
|---------|----------------|
| **API Gateway (Fastify)** | Auth, rate limiting, request routing |
| **Constraint Parser** | LLM-powered natural language → structured set constraints |
| **Set Builder Service** | Receives constraints + candidate track features; can run or validate Beam Search results |
| **Collaboration Service** | Shared set workspaces, presence, conflict resolution (no audio transfer) |
| **Search / Embeddings** | pgvector similarity search across user-consented libraries |
| **Task Queue** | Background jobs (re-indexing, large exports, etc.) |

**Important:** Cloud never receives raw audio. Only derived features, metadata, and set structures are synced (with explicit user consent).

---

## 4. Core Pipelines

### 4.1 Track Import & Analysis Pipeline

```
[File System Event / Manual Import]
        │
        ▼
[Validate format + basic integrity]
        │
        ▼
[BLAKE3 hash (first 1MB + duration) → Deduplication]
        │
        ▼
[Extract existing tags + artwork + any existing cues]
        │
        ▼
[ONNX Analysis Pipeline]
  • BPM + Beat Grid
  • Key (Camelot + classical)
  • Phrase boundaries (8/16/32-bar)
  • Structural markers (intro, build, drop, breakdown, outro)
  • Vocal presence / density curve
  • Loudness (EBU R128 LUFS)
  • Spectral brightness
  • Safe mix-out window
        │
        ▼
[Store results in Local SQLite + optional feature embedding]
        │
        ▼
[Review Gate] → Flag low-confidence attributes for DJ review
```

### 4.2 Set Generation Pipeline (Hybrid)

```
[User Constraints]  (natural language or structured UI)
        │
        ▼
[LLM Constraint Extraction]  (Cloud or local if available)
  → Structured constraints: duration, start/peak BPM, energy curve,
    genre bias, locked tracks, excluded tracks, mood filters
        │
        ▼
[Candidate Selection]  (Local SQLite + optional vector search)
        │
        ▼
[Transition Graph Construction]
  Nodes = tracks
  Edges = compatibility score S(Tᵢ, Tᵢ₊₁)
        │
        ▼
[Beam Search Optimizer]  (Deterministic, local)
  Beam width W = 10
  Maximize cumulative fitness while respecting constraints
        │
        ▼
[Explanation Layer]  (LLM or template-based)
  → Human-readable transition reasons + risk scores
        │
        ▼
[Set Object stored locally + optional cloud sync]
```

**Critical Design Decision:** The LLM never chooses the order of tracks. It only translates intent into constraints and later explains the deterministic result.

### 4.3 Cue Point Generation

- Deterministic structural markers + genre-aware heuristics + user templates.
- Snapping mathematics defined in Canonical Documentation §4.3.
- All generated cues are editable and logged.

---

## 5. Skills System (High Level)

Skills are scoped, reversible, inspectable automation units.  
Full design lives in [SKILLS_SYSTEM.md](./SKILLS_SYSTEM.md).

Examples:
- **Cue Master** — Generate / refine cue points
- **Tag Surgeon** — Smart tag cleanup & alias management
- **Set Architect** — Constraint-driven set building
- **Energy Cartographer** — Energy curve analysis & visualization
- **Prep Auditor** — Pre-gig health check
- **Library Doctor** — Library health scoring & fixes

Skills can be enabled/disabled globally or per workspace. Every run is logged with before/after state for full undo.

---

## 6. Data Boundaries & Privacy

| Data Type | Local Only | Optional Cloud Sync | Never Leaves Device |
|-----------|------------|---------------------|---------------------|
| Raw audio files | ✓ | ✗ | ✓ |
| Waveform peaks / analysis cache | ✓ | ✗ | ✓ |
| BPM, Key, Cues, Tags | ✓ | ✓ (user opt-in) | — |
| Set structures | ✓ | ✓ (collaboration) | — |
| User preferences / Skill history | ✓ | ✓ | — |
| Embeddings (CLAP etc.) | ✓ | ✓ (search) | — |

---

## 7. Key Technology Choices & Rationale

| Choice | Rationale |
|--------|-----------|
| Tauri v2 | Smaller binary, better security model, native performance vs Electron |
| Rust for core | Memory safety + performance for audio analysis and file watching |
| ONNX Runtime | Cross-platform, quantized models, no Python runtime dependency |
| Symphonia | Pure-Rust audio decoding (multiple formats) |
| Beam Search (not LLM) for sequencing | Deterministic, optimizable, explainable, no hallucination risk |
| SQLite local + Postgres cloud | Proven, simple offline story + powerful vector search when online |
| Fastify | High performance, TypeScript-native, good ecosystem for API |

---

## 8. Non-Goals (Architectural)

- Live audio playback / mixing engine
- Replacing rekordbox / Serato / Traktor as performance software
- Autonomous agents that take irreversible actions
- Uploading or streaming user audio libraries
- Social network / content calendar features

---

## 9. Related Documents

- [Canonical Documentation](../product/CANONICAL_DOCUMENTATION.md) — Full product + technical specification
- [Data Model](./DATA_MODEL.md)
- [Skills System](./SKILLS_SYSTEM.md)
- [Security & Privacy](../engineering/SECURITY_AND_PRIVACY.md)
- [Development Guide](../engineering/DEVELOPMENT.md)
