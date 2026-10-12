# Track Import & Analysis Pipeline

Local-first pipeline from filesystem event to stored musical features.

```mermaid
flowchart TD
    A[File System Event<br/>or Manual Import] --> B[Validate Format<br/>& Integrity]
    B --> C[BLAKE3 Hash<br/>First 1MB + Duration]
    C --> D{Duplicate?}
    D -->|Yes| E[Skip / Link Existing]
    D -->|No| F[Extract Metadata<br/>ID3 / audiotags]
    F --> G[ONNX Analysis Queue]
    
    subgraph ONNX["Local ONNX Analysis"]
        G --> H[BPM + Beat Grid]
        G --> I[Key Detection<br/>Camelot + Classical]
        G --> J[Phrase / Structure<br/>Segmentation]
        G --> K[Vocal Presence<br/>& Density]
        G --> L[Loudness<br/>EBU R128 LUFS]
        G --> M[Spectral Brightness]
    end

    H --> N[Store Results<br/>Local SQLite]
    I --> N
    J --> N
    K --> N
    L --> N
    M --> N

    N --> O{Low Confidence?}
    O -->|Yes| P[Flag Needs Review]
    O -->|No| Q[Ready for Cues / Sets]
    P --> Q

    style ONNX fill:#1a1a2e,stroke:#e94560,color:#eee
    style A fill:#0f3460,stroke:#533483,color:#fff
    style N fill:#0f3460,stroke:#533483,color:#fff
    style Q fill:#533483,stroke:#e94560,color:#fff
```

## Performance Target

- p50 analysis time **< 3 seconds per track** on mid-range laptop (CPU)
- 50-track folder fully analyzed in **< 5 minutes** wall time
