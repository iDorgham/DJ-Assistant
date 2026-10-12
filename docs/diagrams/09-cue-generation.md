# Genre-Aware Cue Generation

How Cue Master places musically meaningful hot cues.

```mermaid
flowchart TD
    A[Analyzed Track<br/>Beat Grid + Phrases] --> B[Detect Genre Context<br/>or User Template]
    B --> C[Compute Bar Duration<br/>t_bar = 240 / BPM]
    C --> D[Snap Targets to<br/>8-bar Phase Boundaries]
    D --> E[Assign Cue Slots by Heuristic]

    subgraph Heuristics["Genre Heuristics Example"]
        E --> F[Hot Cue A — Downbeat]
        E --> G[Hot Cue B — Groove / Vocal Entry]
        E --> H[Hot Cue C — Build / Melodic Element]
        E --> I[Hot Cue D — Main Drop]
        E --> J[Hot Cue E — Breakdown]
        E --> K[Hot Cue F — Secondary Drop]
        E --> L[Hot Cue G/H — Outro / Mix-out]
    end

    F --> M[Present in Review UI]
    G --> M
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M

    M --> N{DJ Edits?}
    N -->|Yes| O[Save User Override<br/>Learn Preference]
    N -->|No| P[Mark AI-Generated<br/>Ready for Export]
    O --> P

    style A fill:#0f3460,color:#fff
    style E fill:#533483,color:#fff
    style M fill:#1a1a2e,color:#eee
    style P fill:#e94560,color:#fff
```

## Snapping Rule (Reference)

\[
T_{cue} = t_0 + (k \times 8 \times t_{bar}), \quad k \in \mathbb{N}
\]

Where \( t_{bar} = 240 / \text{BPM} \).
