# Phase 2 — Library UX & Player Implementation Dependencies

**Scope:** T2.1.5 → T2.4 (Slices 0–9)  
**Plan:** [`docs/PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md`](../PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md)  
**Tasks:** [`docs/sdd/04-TASKS.md`](../sdd/04-TASKS.md) · **Acceptance:** P2.1 + P2.1a–d

Render in any Mermaid-compatible viewer (GitHub, VS Code, mermaid.live).

---

## 1. Slice dependency graph (critical path)

```mermaid
flowchart TB
  subgraph Baseline["Slice 0 — Baseline"]
    S0["T2.1.0 Shell<br/>T2.1.2 Filters/Sort"]
  end

  subgraph Library["Library surface"]
    S1["Slice 1 — T2.1.5<br/>Column framework"]
    S2["Slice 2 — T2.1.4 + T2.1.6<br/>Rating + Energy"]
    S3["Slice 3 — T2.1.7 + T2.1.8 + T2.1.13<br/>Tags + Key pills + Comments"]
    S4["Slice 4 — T2.1.9<br/>Artwork + hover-play"]
    S5["Slice 5 — T2.1.10 + T2.1.12<br/>Context menu + Left-nav sources"]
    S6["Slice 6 — T2.1.11<br/>Mix Suggestions dock"]
  end

  subgraph Player["Player surface"]
    S7["Slice 7 — T2.4.1 + T2.4.3<br/>Modes + real audio"]
    S8["Slice 8 — T2.4.2 + T2.4.4 + T2.4.5<br/>Dual-wave + transport"]
  end

  subgraph Hardening["Ongoing"]
    S9["Slice 9 — Harden<br/>T2.1.1 Search · T2.1.3 Bulk<br/>virtualization · a11y · perf · empty states"]
  end

  subgraph OutOfPath["Not on exit path"]
    T25["T2.5 Spectrum Visualizer<br/>Resolume export"]
    T22["T2.2 Tag Surgeon engine"]
    T23["T2.3 Cue Master / Health"]
  end

  S0 --> S1
  S1 --> S2
  S1 --> S3
  S1 --> S4
  S2 --> S5
  S3 --> S5
  S4 --> S5
  S3 --> S6
  S5 --> S6
  S5 --> S7
  S7 --> S8

  S1 -.-> S9
  S2 -.-> S9
  S8 -.-> S9

  S8 -.-> T25
  S5 -.-> T22
  S8 -.-> T23

  classDef done fill:#1a3d2e,stroke:#22c55e,color:#e6e8ec
  classDef next fill:#1a2a3d,stroke:#2dd4bf,color:#e6e8ec
  classDef later fill:#2a2e36,stroke:#6b7380,color:#9ba3b0
  classDef out fill:#3d1a1a,stroke:#ef4444,color:#9ba3b0

  class S0 done
  class S1,S2,S3,S4,S5,S6,S7,S8 next
  class S9 later
  class T25,T22,T23 out
```

---

## 2. Parallelism map (what can run side-by-side)

```mermaid
flowchart LR
  subgraph W1["Week 1"]
    direction TB
    A0[Slice 0 confirm]
    A1[Slice 1 Columns]
    A2[Slice 2 Rating/Energy]
    A0 --> A1 --> A2
  end

  subgraph W2["Week 2"]
    direction TB
    B3[Slice 3 Tags/Key]
    B4[Slice 4 Artwork]
    B5s[Slice 5 start]
    B3 --- B4
    B3 --> B5s
    B4 --> B5s
  end

  subgraph W3["Week 3"]
    direction TB
    C5[Slice 5 finish]
    C6[Slice 6 Mix]
    C7[Slice 7 Real audio]
    C5 --> C6
    C5 --> C7
  end

  subgraph W4["Week 4"]
    direction TB
    D8[Slice 8 Dual-wave]
    D9[P2.1a–d evidence]
    D8 --> D9
  end

  W1 --> W2 --> W3 --> W4
```

**Two-engineer split**

```mermaid
flowchart TB
  subgraph EngA["Engineer A — Library"]
    A1[S1 Columns] --> A2[S2 Rating/Energy]
    A1 --> A3[S3 Tags/Key]
    A1 --> A4[S4 Artwork]
    A2 --> A5[S5 Menu/Nav]
    A3 --> A5
    A4 --> A5
    A5 --> A6[S6 Mix Suggestions]
  end

  subgraph EngB["Engineer B — Player"]
    B0[Agree player IPC in W1] --> B7[S7 Modes + real audio]
    B7 --> B8[S8 Dual-wave + transport]
  end

  A5 -.->|play path ready| B7
```

---

## 3. Task → slice mapping

```mermaid
flowchart TB
  subgraph Tasks["SDD tasks"]
    T214[T2.1.4 Rating]
    T215[T2.1.5 Columns]
    T216[T2.1.6 Energy]
    T217[T2.1.7 Tags]
    T218[T2.1.8 Key pills]
    T219[T2.1.9 Artwork]
    T2110[T2.1.10 Context menu]
    T2111[T2.1.11 Mix Suggestions]
    T2112[T2.1.12 Left-nav sources]
    T2113[T2.1.13 Comments]
    T241[T2.4.1 Player modes]
    T242[T2.4.2 Dual-wave]
    T243[T2.4.3 Real audio/art]
    T244[T2.4.4 Transport/cues/grid]
    T245[T2.4.5 RAF playhead]
  end

  subgraph Slices["Implementation slices"]
    SL1[Slice 1]
    SL2[Slice 2]
    SL3[Slice 3]
    SL4[Slice 4]
    SL5[Slice 5]
    SL6[Slice 6]
    SL7[Slice 7]
    SL8[Slice 8]
  end

  T215 --> SL1
  T214 --> SL2
  T216 --> SL2
  T217 --> SL3
  T218 --> SL3
  T2113 --> SL3
  T219 --> SL4
  T2110 --> SL5
  T2112 --> SL5
  T2111 --> SL6
  T241 --> SL7
  T243 --> SL7
  T242 --> SL8
  T244 --> SL8
  T245 --> SL8
```

---

## 4. Data & IPC dependencies

```mermaid
flowchart LR
  subgraph Schema["Schema / shared"]
    EN[energy INTEGER 1–10]
    RT[user_rating 0–5]
    LB[label TEXT]
    TG[track tags]
    PK[waveform peaks cache]
    HM[harmonic.ts]
    MS[mix-score.ts]
    CC[column-config.ts]
  end

  subgraph IPC["Tauri IPC"]
    LT[list_tracks extended]
    UT[update_track_metadata]
    WP[get_waveform_peaks]
    PL[player_load / play / seek]
    MX[mix_suggestions]
  end

  subgraph UI["UI consumers"]
    COL[Column framework]
    EB[EnergyBars / StarRating]
    KP[KeyPill / TagChips]
    ART[ArtworkThumb]
    MENU[TrackContextMenu]
    MIX[MixSuggestionsPanel]
    WAVE[WaveformDetailed + Overview]
  end

  EN --> LT
  RT --> LT
  LB --> LT
  TG --> LT
  EN --> UT
  RT --> UT
  PK --> WP

  CC --> COL
  LT --> COL
  UT --> EB
  HM --> KP
  HM --> MS
  MS --> MX
  MX --> MIX
  LT --> MIX
  PL --> ART
  PL --> WAVE
  WP --> WAVE
  MENU --> PL
  MENU --> MX
```

---

## 5. Acceptance criteria coverage

```mermaid
flowchart TB
  subgraph Accept["Phase 2 UI acceptance"]
    P21[P2.1 Search + multi-filter]
    P21a[P2.1a Customizable columns<br/>Energy / Tags / Rating / Artwork]
    P21b[P2.1b Camelot + 1m/1d pills]
    P21c[P2.1c Context menu + Mix Suggestions]
    P21d[P2.1d Dual-wave + real audio]
  end

  S1[Slice 1] --> P21a
  S2[Slice 2] --> P21a
  S2 --> P21
  S3[Slice 3] --> P21b
  S3 --> P21
  S4[Slice 4] --> P21a
  S5[Slice 5] --> P21c
  S6[Slice 6] --> P21c
  S7[Slice 7] --> P21d
  S8[Slice 8] --> P21d
```

---

## 6. Component build order

```mermaid
flowchart TB
  TOK[Design tokens T2.1.0] --> CC[column-config + ColumnPicker]
  CC --> SR[StarRating]
  CC --> EB[EnergyBars]
  CC --> TC[TagChips]
  CC --> KP[KeyPill]
  CC --> AT[ArtworkThumb]
  SR --> MENU[TrackContextMenu Library]
  EB --> MENU
  TC --> MENU
  KP --> MENU
  AT --> MENU
  MENU --> NAV[LibrarySourceTabs]
  NAV --> MIX[MixSuggestionsPanel]
  MENU --> PM[PlayerMini / PlayerFull]
  PM --> WO[WaveformOverview]
  WO --> WD[WaveformDetailed]
  WD --> PH[Playhead RAF]
  PH --> TR[Transport + HotCueBank]
  TR --> GR[Grid + BeatJump]
  GR -.-> VIZ[SpectrumVisualizer T2.5]
```

---

## 7. Branch topology

```mermaid
gitGraph
  commit id: "main"
  branch feat_T215_columns
  checkout feat_T215_columns
  commit id: "S1 columns"
  branch feat_T214_6_rating_energy
  checkout feat_T214_6_rating_energy
  commit id: "S2 rating energy"
  checkout feat_T215_columns
  branch feat_T217_8_tags_key
  checkout feat_T217_8_tags_key
  commit id: "S3 tags key"
  checkout feat_T215_columns
  branch feat_T219_artwork
  checkout feat_T219_artwork
  commit id: "S4 artwork"
  checkout main
  branch feat_T2110_12_menu_nav
  checkout feat_T2110_12_menu_nav
  commit id: "S5 menu nav"
  branch feat_T2111_mix
  checkout feat_T2111_mix
  commit id: "S6 mix"
  checkout main
  branch feat_T24_player_audio
  checkout feat_T24_player_audio
  commit id: "S7 real audio"
  branch feat_T24_dual_wave
  checkout feat_T24_dual_wave
  commit id: "S8 dual-wave"
```

---

## 8. Critical path (shortest path to P2.1d)

```mermaid
flowchart LR
  S0[S0 Baseline] --> S1[S1 Columns]
  S1 --> S2[S2 Rating/Energy]
  S2 --> S5[S5 Menu + Play path]
  S5 --> S7[S7 Real audio]
  S7 --> S8[S8 Dual-wave]
  S8 --> GATE[P2.1d + P2.1a–c]

  S1 -.-> S3[S3 Key pills]
  S3 -.-> GATE
  S1 -.-> S4[S4 Artwork]
  S4 -.-> GATE
  S5 -.-> S6[S6 Mix]
  S6 -.-> GATE
```

**Critical path length:** S0 → S1 → (S2 ∥ S3 ∥ S4) → S5 → S7 → S8  
**Parallel off-path (still required for full P2.1a–c):** S6

---

## References

- Implementation plan: [`../PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md`](../PHASE2_LIBRARY_PLAYER_IMPLEMENTATION_PLAN.md)
- UI checklist: [`../ui/11-IMPLEMENTATION-CHECKLIST.md`](../ui/11-IMPLEMENTATION-CHECKLIST.md)
- Player spec: [`../ui/06-PLAYER.md`](../ui/06-PLAYER.md)
- Library spec: [`../ui/03-LIBRARY-VIEW.md`](../ui/03-LIBRARY-VIEW.md)
- Acceptance: [`../sdd/05-ACCEPTANCE.md`](../sdd/05-ACCEPTANCE.md)

---

*Added 2026-10-21 with Phase 2 Library + Player implementation plan.*
