# 17 — Discovery, Enrichment & Providers

Shipped: local foundations (`TF`) + live opt-in enrichment (`TE.1–TE.4`) and
Deezer matching (`TM.2a`). Still post-MVP: external similarity/charts remainder (`TD.1–TD.2`, `TD.4–TD.6`),
adapter expansion (`TE.5`), provider connect/export (`TM.2b`/`TM.3`/`TM.4`, `TP.x`).
See ADR-0007, `API_CONTRACTS.md` §2.6–§2.7 and wireframe 12.

```mermaid
flowchart TB
    subgraph Local["Desktop · local-only (shipped)"]
        Lib["Library (SQLite)"]
        Sim["similarity.rs<br/>BPM 45 · Key 35 · Genre 10 · Dur 10"]
        Gaps["track_tag_health<br/>gap detection"]
        Links["store_links_for_track<br/>pure search URLs"]
        Reg["providers.rs<br/>StreamingProvider / StoreProvider"]
        UI["Inspector drawer · Tag Health modal · provider status"]
    end

    subgraph Online["Opt-in online (post-MVP)"]
        Ext["Last.fm / Deezer<br/>external similarity"]
        Enr["MusicBrainz · iTunes · Deezer<br/>Discogs · AcoustID<br/>enrichment adapters"]
        Charts["Beatport Top 100 / Hype<br/>snapshots (data, no API)"]
        Radar["Release radar<br/>followed artists/labels"]
        Export["provider_match_set<br/>provider_export_playlist<br/>Spotify → Deezer → …"]
    end

    Lib --> Sim --> UI
    Lib --> Gaps --> UI
    Lib --> Links --> UI
    Reg --> Export
    Reg --> Links

    Gaps -.->|"opt-in"| Enr
    Enr -.->|"preview → apply → undo"| Lib
    Sim -.->|"source badge"| Ext
    Charts -.->|"taste filter"| UI
    Radar -.->|"digest"| UI
    Export -.->|"undo = delete"| Lib

    style Local fill:#0B0D12,stroke:#00D9FF,stroke-width:1.5px,color:#E9EDF3
    style Online fill:#0B0D12,stroke:#888888,stroke-width:1px,stroke-dasharray:5,5,color:#E9EDF3
```

Rules drawn here:

- Solid lines run offline today. Dashed lines need explicit opt-in per provider.
- Only metadata, fingerprints and search queries cross the dashed boundary — never audio.
- Enrichment writes DB canonical fields, never source files; every run is undoable.
- New providers add matchers and rows, never schema (`provider` column) or IPC shape.
- Beatport has no public catalog API: charts/radar are versioned data + links (Tiers 0–2),
  partnership is Tier 3. Credential scraping is not a path.

---

*Derived from ADR-0007 and the shipped `TF` foundations.*
