# Gig Ready One-Click Workflow

Curated sequence that turns a library into a performance-ready package.

```mermaid
flowchart TD
    START([User clicks Gig Ready]) --> A[1. Library Doctor<br/>Quick Health Check]
    A --> B[2. Analyze Missing Tracks<br/>ONNX Queue]
    B --> C{Tags messy?}
    C -->|Yes| D[3. Tag Surgeon<br/>Optional / Preview]
    C -->|No| E[4. Cue Master<br/>Selected / New Tracks]
    D --> E
    E --> F[5. Prep Auditor<br/>Final Readiness Checklist]
    F --> G{Issues remain?}
    G -->|Yes| H[Show Issues<br/>User resolves]
    H --> F
    G -->|No| I[6. Export Package<br/>USB Pack / Set Export]
    I --> DONE([Ready to play])

    style START fill:#e94560,color:#fff
    style DONE fill:#533483,color:#fff
    style A fill:#0f3460,color:#fff
    style B fill:#0f3460,color:#fff
    style D fill:#0f3460,color:#fff
    style E fill:#0f3460,color:#fff
    style F fill:#0f3460,color:#fff
    style I fill:#0f3460,color:#fff
```

## Design Notes

- Every step is a Skill (or composition of Skills)
- User can skip optional steps
- Full log + undo available after the run
- Works offline for the core path
