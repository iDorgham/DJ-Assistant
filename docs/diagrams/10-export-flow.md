# Export Flow

From prepared set to performance software and hardware.

```mermaid
flowchart TD
    A[Prepared Set<br/>Tracks + Cues + Order] --> B{Export Target}

    B -->|rekordbox| C[Rust quick-xml<br/>Generate XML]
    B -->|Serato| D[Binary Crate Serializer]
    B -->|Standard CUE| E[.cue File Writer]

    C --> F[Write XML File]
    D --> G[Write .crate File]
    E --> H[Write .cue File]

    F --> I[Validate Structure]
    G --> I
    H --> I

    I --> J{Hardware Check}
    J -->|rekordbox / USB| K[Load on Pioneer CDJ<br/>2000NXS2 / 3000]
    J -->|Serato| L[Load in Serato DJ]

    K --> M{Plays Correctly?}
    L --> M
    M -->|Yes| N[Export Accepted]
    M -->|No| O[Fix Exporter<br/>Re-validate]

    style A fill:#0f3460,color:#fff
    style C fill:#533483,color:#fff
    style D fill:#533483,color:#fff
    style N fill:#e94560,color:#fff
    style O fill:#1a1a2e,color:#eee
```

## Non-Negotiable

- Source audio files are **never** modified
- Exports are validated on real Pioneer CDJs before phase exit
