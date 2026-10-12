# DJ Assistant — Entire Project Overview

One-page Mermaid view of the full product, architecture, intelligence, delivery plan, and control model.

---

## 1. Full System Map

```mermaid
flowchart TB
    %% ========== ACTORS ==========
    DJ([Professional DJ])
    B2B([B2B Partner])

    %% ========== DESKTOP APP ==========
    subgraph Desktop["TAURI v2 DESKTOP APP — Local-First Core"]
        direction TB

        subgraph UI["React + TypeScript UI"]
            LIB[Library Browser]
            WAVE[Waveform + Energy Canvas]
            SETUI[Set Builder]
            SKILLUI[Skills Panel]
            TAGUI[Tag Cleanup]
        end

        subgraph Core["Rust Core Backend"]
            WATCH[Folder Watcher]
            HASH[BLAKE3 Dedup]
            META[Metadata Extractor]
            SQLITE[(Local SQLite)]
            RULES[Rule Engine]
            EXPORT[Export Generators<br/>rekordbox XML • Serato crate]
        end

        subgraph Audio["Native Audio Engine"]
            SYM[Symphonia Decoder]
            ONNX[ONNX Runtime<br/>BPM • Key • Phrases<br/>Vocals • Loudness]
        end

        UI <-->|Typed IPC| Core
        Core --> Audio
        Core --> SQLITE
    end

    %% ========== CLOUD ==========
    subgraph Cloud["CLOUD CONTROL PLANE — Optional"]
        API[Fastify API + LLM Gateway]
        PG[(PostgreSQL 16 + pgvector)]
        REDIS[Redis + BullMQ]
        COLLAB[Collaboration Service]
        AUTH[Auth + Workspaces]
    end

    %% ========== SKILLS ==========
    subgraph Skills["Scoped Skills System"]
        CM[Cue Master]
        TS[Tag Surgeon]
        SA[Set Architect]
        EC[Energy Cartographer]
        HS[Harmonic Scout]
        MTH[Missing Track Hunter]
        PA[Prep Auditor]
        LD[Library Doctor]
    end

    %% ========== FLOWS ==========
    DJ -->|Import / Scan library| Desktop
    DJ -->|Build sets • Clean tags • Run Skills| Desktop
    DJ -->|Export| USB[USB / rekordbox / Serato]
    USB --> CDJ[Pioneer CDJ Hardware]
    B2B -.->|Shared sets metadata only| Cloud
    Desktop <-->|Optional sync<br/>No raw audio| Cloud
    Skills --> Core
    Skills --> UI

    %% ========== STYLING ==========
    style Desktop fill:#1a1a2e,stroke:#e94560,color:#eee
    style Cloud fill:#16213e,stroke:#0f3460,color:#eee
    style Skills fill:#0f3460,stroke:#e94560,color:#fff
    style DJ fill:#e94560,stroke:#1a1a2e,color:#fff
    style B2B fill:#533483,stroke:#1a1a2e,color:#fff
    style USB fill:#533483,stroke:#1a1a2e,color:#fff
    style CDJ fill:#533483,stroke:#1a1a2e,color:#fff
```

---

## 2. Core Value Pipeline (End-to-End)

```mermaid
flowchart LR
    A[Raw Music<br/>Library] --> B[Scan + Hash<br/>Deduplicate]
    B --> C[Local ONNX<br/>Analysis]
    C --> D[Smart Tag<br/>Cleanup]
    D --> E[Cue Point<br/>Generation]
    E --> F[Constraint-Driven<br/>Set Builder]
    F --> G[Beam Search<br/>Sequencing]
    G --> H[DJ Review<br/>Lock & Fill]
    H --> I[Export<br/>rekordbox / Serato]
    I --> J[Play on<br/>CDJs]

    style A fill:#1a1a2e,color:#eee
    style C fill:#e94560,color:#fff
    style F fill:#533483,color:#fff
    style G fill:#533483,color:#fff
    style I fill:#0f3460,color:#fff
    style J fill:#0f3460,color:#fff
```

**Target:** 40+ tracks → performance-ready set in **≤ 15 minutes**.

---

## 3. Hybrid Intelligence Boundary

```mermaid
flowchart TB
    INTENT[User Intent<br/>Form or Natural Language]

    subgraph AI["AI / LLM Zone"]
        LLM1[Constraint Extraction]
        LLM2[Transition Explanations]
        LLM3[NL Search Parsing]
    end

    subgraph DET["Deterministic Zone"]
        SCORE[Transition Scoring Matrix]
        BEAM[Beam Search Sequencer<br/>Width = 10]
        CUE[Cue Snapping Rules]
        TAG[Fuzzy Tag Clustering]
        HASH2[BLAKE3 Dedup]
    end

    INTENT --> LLM1
    LLM1 --> SCORE
    SCORE --> BEAM
    BEAM --> LLM2
    LLM2 --> REVIEW[DJ Review & Override]
    REVIEW --> FINAL[Final Set]

    style AI fill:#e94560,stroke:#1a1a2e,color:#fff
    style DET fill:#533483,stroke:#1a1a2e,color:#fff
    style REVIEW fill:#0f3460,color:#fff
    style FINAL fill:#0f3460,color:#fff
```

**Rule:** LLM never chooses the final track order. Beam Search does.

---

## 4. 90-Day Delivery Plan

```mermaid
gantt
    title DJ Assistant MVP — 90 Days
    dateFormat X
    axisFormat %s

    section Phase 0
    Foundation (Shell, Scan, SQLite)          :0, 15

    section Phase 1
    Analysis Engine (ONNX)                    :15, 35

    section Phase 2
    Library + Tags + Cues                     :30, 55

    section Phase 3
    Set Builder + Export + CDJ Validation     :40, 70

    section Phase 4
    Skills + Gig Ready + Beta                 :60, 90
```

| Phase | Goal | Exit Gate |
|-------|------|-----------|
| 0 | Runnable shell + scan + local DB | 50–100 tracks listed with stable hashes |
| 1 | Local musical analysis | 50 tracks analyzed < 5 min; p50 < 3s/track |
| 2 | Pro library UX + Tag Surgeon | Messy 1k library cleaned in one pass |
| 3 | Sets + production exports | Coherent 90–120 min set; CDJ-validated |
| 4 | Automation + beta readiness | 40-track prep < 15 min; MVP criteria met |

---

## 5. Workstreams × Phases

```mermaid
flowchart TB
    subgraph WS["Five Parallel Workstreams"]
        WS1[WS1 Desktop Shell<br/>& Local Data]
        WS2[WS2 Audio Analysis<br/>Engine]
        WS3[WS3 Library, Cues<br/>& Tags]
        WS4[WS4 Set Builder<br/>& Export]
        WS5[WS5 Cloud, Skills<br/>& Collaboration]
    end

    P0[Phase 0] --> WS1
    P1[Phase 1] --> WS2
    P2[Phase 2] --> WS3
    P3[Phase 3] --> WS4
    P4[Phase 4] --> WS5

    WS1 --> WS2
    WS2 --> WS3
    WS3 --> WS4
    WS4 --> WS5

    style WS1 fill:#1a1a2e,color:#eee
    style WS2 fill:#16213e,color:#eee
    style WS3 fill:#0f3460,color:#fff
    style WS4 fill:#533483,color:#fff
    style WS5 fill:#e94560,color:#fff
```

---

## 6. Product Boundaries

```mermaid
flowchart LR
    subgraph IN["IN SCOPE"]
        A1[Local analysis]
        A2[Cue generation]
        A3[Tag cleanup]
        A4[Set builder]
        A5[B2B prep]
        A6[Export to DJ software]
    end

    subgraph OUT["OUT OF SCOPE"]
        B1[Live mixing engine]
        B2[Replace rekordbox/Serato]
        B3[Social / marketing tools]
        B4[Audio downloading]
        B5[Open-ended agents]
        B6[Cloud audio analysis]
    end

    style IN fill:#0f3460,stroke:#e94560,color:#fff
    style OUT fill:#1a1a2e,stroke:#533483,color:#eee
```

---

## 7. Control & Safety Model

```mermaid
flowchart TD
    ACTION[Any Mutating Action<br/>Skill / Bulk Tag / Cue Gen]
    ACTION --> PREVIEW[Preview Diff]
    PREVIEW --> CONFIRM{User Confirms?}
    CONFIRM -->|No| CANCEL[Cancel]
    CONFIRM -->|Yes| SNAP[Snapshot before_state]
    SNAP --> EXEC[Execute]
    EXEC --> LOG[Write skill_runs Log]
    LOG --> UNDO[Undo Available]
    UNDO --> KILL[Global Kill-switch]

    style ACTION fill:#e94560,color:#fff
    style PREVIEW fill:#533483,color:#fff
    style SNAP fill:#0f3460,color:#fff
    style UNDO fill:#0f3460,color:#fff
    style KILL fill:#1a1a2e,color:#eee
```

---

## 8. One-Line Summary

```mermaid
mindmap
  root((DJ Assistant))
    Vision
      Fastest path from library to set
      15-min prep for 40+ tracks
    Architecture
      Tauri + Rust + React
      Local ONNX
      Optional Cloud
    Intelligence
      LLM = constraints + explanations
      Beam Search = sequencing
      Skills = scoped automation
    Delivery
      90-day MVP
      5 workstreams
      5 phases
      Strict acceptance gates
    Principles
      Local-first
      Reversible
      Non-destructive
      DJ always in control
```

---

*This overview consolidates Canonical Spec v1.1, SDD set, Architecture, Skills, and the 90-day plan into a single project map.*
