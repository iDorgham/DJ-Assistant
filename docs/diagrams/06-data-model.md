# Data Model (Conceptual)

> Conceptual only — `docs/architecture/DATA_MODEL.md` summarizes the schemas; authoritative SQL is in `docs/product/CANONICAL_DOCUMENTATION.md` §5, and shipped SQLite changes are in `apps/desktop/src-tauri/migrations/`. Shipped tables beyond this sketch: `external_ids`, `enrichment_runs`/`enrichment_candidates`, `streaming_*`, `chart_snapshots`, `tracks.isrc`/`artwork_*`.

```mermaid
erDiagram
    WORKSPACE ||--o{ TRACK : contains
    WORKSPACE ||--o{ SET : contains
    WORKSPACE ||--o{ SKILL_RUN : logs
    WORKSPACE ||--o{ ALIAS : owns

    TRACK ||--o{ CUE_POINT : has
    TRACK ||--o{ PHRASE_MARKER : has

    SET ||--o{ SET_TRACK : ordered
    SET_TRACK }o--|| TRACK : references

    TRACK {
        uuid id PK
        string path
        string blake3_hash
        string title
        string artist
        float bpm
        string key_camelot
        string analysis_status
        string analysis_version
    }

    CUE_POINT {
        uuid id PK
        uuid track_id FK
        string name
        string type
        int position_ms
        string source
    }

    SET {
        uuid id PK
        string name
        json constraints
        string energy_curve
    }

    SET_TRACK {
        uuid set_id FK
        uuid track_id FK
        int position
        float transition_score
    }

    SKILL_RUN {
        uuid id PK
        string skill_id
        string status
        json before_state
        json after_state
    }

    ALIAS {
        uuid id PK
        string canonical_name
        string alias
        string entity_type
    }
```

## Local vs Cloud Boundary

```mermaid
flowchart LR
    subgraph Local["Local Only"]
        L_A[Raw Audio]
        L_B[Waveform Cache]
        L_C[Full Analysis Results]
    end

    subgraph Optional["Optional Sync"]
        O_D[Metadata]
        O_E[Cues]
        O_F[Set Structures]
        O_G[Embeddings]
    end

    subgraph Never["Never Transmitted"]
        N_A[Raw Audio]
        N_B[Waveform Cache]
    end

    L_A -.->|never| N_A
    L_B -.->|never| N_B

    style Local fill:#1a1a2e,stroke:#e94560,color:#eee
    style Optional fill:#0f3460,stroke:#533483,color:#fff
    style Never fill:#e94560,stroke:#1a1a2e,color:#fff
```
