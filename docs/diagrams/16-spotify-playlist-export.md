# Spotify Playlist Export (Post-MVP)

Publishes a built set (or any playlist) to the DJ's **own** Spotify account as a real Spotify
playlist — **metadata only**. It is the one export path that touches the network; audio never
leaves the device.

```mermaid
flowchart TD
    A([Set / playlist<br/>N local tracks + metadata]) --> B[Connect Spotify<br/>OAuth 2.0 Authorization Code + PKCE<br/>embedded public client ID · no secret<br/>tokens in OS keychain]

    B --> C[Match each track<br/>1. ISRC exact<br/>2. fuzzy: normalized title / artist / album<br/>+ ±3 s duration tolerance]
    C --> D{Confidence score}

    D -->|High| E[Auto-add to playlist]
    D -->|Medium / low| F[Review queue<br/>accept · pick a different match · skip]
    D -->|No candidate| G[Unmatched list<br/>search Spotify manually · skip]

    E --> H[Create playlist<br/>Spotify Web API<br/>playlist-modify-private default<br/>playlist-modify-public opt-in]
    F --> H
    H --> I[Add matched tracks]
    I --> J[Result<br/>open in Spotify · added / skipped counts]
    J --> K[Delete playlist<br/>undo / reversibility]
    G -.->|manual match| H

    C -.-> N[Metadata only<br/>audio never downloaded, streamed,<br/>stored, or uploaded]
    B -.-> N

    style A fill:#0f3460,color:#fff
    style B fill:#533483,color:#fff
    style H fill:#533483,color:#fff
    style J fill:#e94560,color:#fff
    style K fill:#1a1a2e,color:#eee
    style N fill:#1a1a2e,color:#eee
```

## Matching & confidence

| Step | Rule | Outcome |
|------|------|---------|
| 1. ISRC | Exact ISRC match wins outright | high confidence |
| 2. Fuzzy | Normalized title / artist / album vs. Spotify search | scored |
| 3. Duration | ±3 s tolerance filters fuzzy candidates | scored |
| 4. Confidence | Aggregated score → **high** / **medium** / **low** / none | high auto-adds; medium/low review; none unmatched |

## Auth & scopes

- **OAuth 2.0 Authorization Code with PKCE**, run entirely in the desktop app: an embedded
  public client ID, **no client secret**, tokens stored in the OS keychain.
- `playlist-modify-private` is the **default** (minimum) scope; `playlist-modify-public` is
  **opt-in**.
- **Disconnect** revokes access and removes tokens, with confirmation.

## Non-Negotiable

- **Metadata only** — only track metadata and search queries leave the device; audio is never
  downloaded, streamed, stored, or uploaded.
- **Reversible** — the created playlist can be deleted (undo); source files are never modified.
- **Post-MVP** — not part of the 90-day MVP; specified here so the Export surface is designed once.
