# Component & IPC View

Major desktop components and how they communicate.

```mermaid
flowchart TB
    subgraph React["React UI Layer"]
        LIB[Library Browser]
        WAVE[Waveform Canvas]
        ENERGY[Energy Canvas]
        SETUI[Set Builder UI]
        SKILLS[Skills Panel]
        TAGS[Tag Cleanup UI]
    end

    subgraph IPC["Typed IPC Bridge"]
        CMD[Commands<br/>scan_folder • analyze_library • find_similar_tracks<br/>enrichment_preview • provider_match_tracks • build_set • export_set]
        EVT[Events<br/>scan:progress • analysis:progress • analysis:completed<br/>enrichment:progress • skill:progress]
    end

    subgraph Rust["Rust Core"]
        WATCH[Folder Watcher]
        HASH[BLAKE3 Hasher]
        META[Metadata Extractor]
        DB[(SQLite)]
        QUEUE[Analysis Queue]
        SKILLRT[Skills Runtime]
        EXPORT[Export Generators]
    end

    subgraph Native["Native Audio"]
        SYM[Symphonia Decoder]
        ONNX[ONNX Runtime]
    end

    React <--> IPC
    IPC <--> Rust
    QUEUE --> Native
    Rust --> DB

    style React fill:#0f3460,stroke:#e94560,color:#fff
    style IPC fill:#1a1a2e,stroke:#533483,color:#eee
    style Rust fill:#16213e,stroke:#e94560,color:#eee
    style Native fill:#533483,stroke:#e94560,color:#fff
```

## Example Command Flow

```mermaid
sequenceDiagram
    participant UI as React UI
    participant IPC as IPC Bridge
    participant Core as Rust Core
    participant ONNX as ONNX Runtime
    participant DB as SQLite

    UI->>IPC: analyze_library(track_ids?, force?)
    IPC->>Core: analyze_library
    Core->>DB: select stale versions
    loop For each track
        Core->>ONNX: run analyzer pipeline (heuristic now, ONNX seam)
        ONNX-->>Core: features
        Core->>DB: persist results + analysis_version
        Core-->>IPC: analysis:progress
        IPC-->>UI: progress event
    end
    Core-->>IPC: analysis:completed
    IPC-->>UI: complete
```
