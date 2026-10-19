# System Architecture

High-level view of the Tauri desktop companion and optional cloud control plane.

```mermaid
flowchart TB
    subgraph Desktop["TAURI v2 DESKTOP COMPANION"]
        UI["UI Layer<br/>React + TypeScript<br/>App Shell • Library • Player Dock • Waveform • Energy Canvas • Skills Panel • Set Builder"]
        IPC[["IPC (JSON)"]]
        Rust["Rust Core Backend<br/>Watch Folders • SQLite • Rule Engine<br/>BLAKE3 • Metadata • Export"]
        Audio["Native Audio Engine<br/>Symphonia • ONNX Runtime<br/>BPM • Key • Phrases • Vocals • Loudness"]
        
        UI <--> IPC
        IPC <--> Rust
        Rust --> Audio
    end

    subgraph Cloud["CLOUD CONTROL PLANE (Optional)"]
        API["Fastify API<br/>LLM Gateway • Workflow Orchestrator"]
        DB["PostgreSQL 16 + pgvector"]
        Queue["Redis + BullMQ"]
        Services["Auth • Track • Set • Search • Collaboration"]
        
        API --> DB
        API --> Queue
        API --> Services
    end

    Desktop -->|"HTTPS / WSS<br/>(metadata & sets only)"| Cloud

    style Desktop fill:#1a1a2e,stroke:#e94560,color:#eee
    style Cloud fill:#16213e,stroke:#0f3460,color:#eee
    style UI fill:#0f3460,stroke:#e94560,color:#fff
    style Rust fill:#0f3460,stroke:#e94560,color:#fff
    style Audio fill:#0f3460,stroke:#e94560,color:#fff
```

## Key Principles Shown

- Audio analysis stays inside the desktop boundary
- Cloud receives only derived metadata, features, and set structures
- UI talks to Rust exclusively via typed IPC
