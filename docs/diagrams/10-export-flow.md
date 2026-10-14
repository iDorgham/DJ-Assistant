# Export Flow

From prepared set to performance software and hardware. Includes the **post-MVP** Spotify
playlist export branch (metadata only).

```mermaid
flowchart TD
    A[Prepared Set<br/>Tracks + Cues + Order] --> B{Export Target}

    B -->|rekordbox| C[Rust quick-xml<br/>Generate XML]
    B -->|Serato| D[Binary Crate Serializer]
    B -->|Standard CUE| E[.cue File Writer]
    B -->|USB media| F[Format Tool<br/>FAT32+MBR default · exFAT opt-in]
    B -->|Spotify (post-MVP)| P[OAuth 2.0 Authorization Code + PKCE<br/>Desktop app · public client ID · no secret<br/>Tokens in OS keychain]

    C --> G[Write XML File]
    D --> H[Write .crate File]
    E --> I[Write .cue File]

    F --> F1[Verify FS + MBR + writability<br/>Compat report:<br/>FAT32=universal · exFAT=new booths only]
    F1 --> F2[Copy USB pack<br/>PIONEER + Contents<br/>never drag-copy]

    G --> J[Validate Structure]
    H --> J
    I --> J
    F2 --> J

    J --> K{Hardware Check}
    K -->|rekordbox / USB| L[Load on Pioneer CDJ<br/>2000NXS2 + 3000]
    K -->|Serato| M[Load in Serato DJ]

    K --> Z{Plays Correctly?}
    L --> Z
    M --> Z
    Z -->|Yes| N[Export Accepted]
    Z -->|No| O[Fix Exporter<br/>Re-validate]

    P --> Q[Match each track<br/>ISRC first, then fuzzy<br/>title/artist/album ±3 s]
    Q --> R{Confidence}
    R -->|High| S[Add automatically]
    R -->|Medium / low| T[Review queue<br/>accept · pick other · skip]
    R -->|No match| U[Unmatched<br/>search manually · skip]
    S --> V[Create playlist + add tracks<br/>Spotify Web API]
    T --> V
    U -.->|manual match| V
    V --> W[Result: open in Spotify<br/>Delete playlist = undo]
    Q -.-> NA[Metadata only<br/>audio never downloaded, streamed,<br/>stored, or uploaded]

    style A fill:#0f3460,color:#fff
    style C fill:#533483,color:#fff
    style D fill:#533483,color:#fff
    style F fill:#533483,color:#fff
    style P fill:#533483,color:#fff
    style V fill:#533483,color:#fff
    style N fill:#e94560,color:#fff
    style W fill:#e94560,color:#fff
    style O fill:#1a1a2e,color:#eee
    style NA fill:#1a1a2e,color:#eee
```

## Non-Negotiable

- Source audio files are **never** modified
- USB media defaults to **FAT32 + MBR** (plays on every CDJ/XDJ); exFAT only for known exFAT-capable booths (CDJ-3000 / 3000X, XDJ-RX3, XDJ-XZ, OPUS-QUAD, XDJ-AZ and newer — NXS2 and older do not read exFAT); never NTFS/GPT
- Exports are validated on real Pioneer CDJs before phase exit
- Spotify export is **metadata only** — audio is never downloaded, streamed, stored, or uploaded,
  and the created playlist is reversible (delete)
