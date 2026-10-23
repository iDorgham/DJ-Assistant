# 12 — Wireframes & Interface Flexibility

**Version:** 1.2 · **Date:** 2026-10-19  
**Status:** Canonical wireframe reference for implementation  
**Design system:** [01-DESIGN-SYSTEM.md](01-DESIGN-SYSTEM.md) (Ableton Live 12–inspired)

> **Player layout authority:** [06A-PLAYER-PRESENTATIONS.md](06A-PLAYER-PRESENTATIONS.md) defines Mini, Full and Player view, including the full-player Player view composition. The player sketches below are dock-era sketches; the target removes Stop and adds Player view. Extended was retired on 2026-10-23. Where they conflict, 06A wins.

Desktop-first layouts. The interface is built on the same modular philosophy as **Ableton Live**: every major region is resizable, collapsible, and restorable. Workspaces act as named layout snapshots (Adobe-style presets on top of Ableton-style flexibility).

---

## 1. Flexibility model (Ableton DNA)

### 1.1 Dock regions

```
┌─────────────────────────────────────────────────────────────────────────┐
│ MENU                                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│ HEADER                         (fixed height)                           │
├─────────────────────────────────────────────────────────────────────────┤
│ OPTIONS BAR                    (fixed height, content by view)          │
├──────────┬────────────────────────────────────────────┬─────────────────┤
│          │                                            │                 │
│  LEFT    │              MAIN CANVAS                   │  RIGHT DOCK     │
│  NAV     │         (view-specific)                    │  (optional)     │
│  ←drag→  │                                            │  ←drag→         │
│          │                                            │  Skills /       │
│          │                                            │  Insights       │
├──────────┴────────────────────────────────────────────┴─────────────────┤
│ PLAYER DOCK  ↑ drag height  Mini | Full | Hidden                        │
└─────────────────────────────────────────────────────────────────────────┘
```

Player view is a full-window presentation, not a dock height.

| Region | Min | Default | Max behavior |
|--------|-----|---------|--------------|
| Left nav | 48px (icon rail) or 0 (hidden) | 220px | ~320px |
| Right dock | 0 (collapsed) | 280px when open | ~400px |
| Player | 0 (hidden) | Mini ~104px / Full ~246px (range 230–440px) | ~40% of window height |
| Main canvas | Remaining space | Grows when docks collapse | Always primary |

**Interactions (non-negotiable)**

- Drag splitter → live resize (content reflows continuously)
- Double-click splitter → reset that pane to workspace default
- Collapse buttons → icon rail or fully hide
- View → Workspaces → save current sizes + collapsed flags
- Persist per workspace and per user preference
- Layout animation ≤ 200ms; no content jump after settle

### 1.2 Workspace presets

| Workspace | Left | Main | Right | Player |
|-----------|------|------|-------|--------|
| **Library** | 220 or rail | Track table max | Hidden | Mini |
| **Prepare** | 200 | Set list | Skills 280 | Full |
| **Validate** | Rail or hidden | Queue wide | Insights 260 | Mini |
| **Custom** | User | User | User | User |

Switching workspace animates pane sizes ≤200ms, then content settles. Users can override any preset and save a new Custom workspace.

---

## 2. Library view — wireframe

### 2.1 Default (Library workspace)

```
┌─ File  Edit  View  Library  Set  Tools  Help ──────────────────────────┐
├─ ♪ DJ Assistant   [ Library ] Preparation  Auto Performance    ⚙  ◐  ▭ ┤
├─ 🔍 Search…  [BPM] [Key] [Compatible] [Columns] Analyze  Mix Suggestions┤
├────────────┬──────────────────────────────────────────┬─────────────────┤
│ All Library│ # ★ Art Title Artist BPM Key Energy Tags │ Mix Suggestions │
│ Categories │ 1 ★★★★☆ [▶] Neon… Ava 126 5A ▮▮▮▮▮▮▮░░░ │ Compatible next │
│ Playlists  │ 2 ★★★☆☆ [ ] Gravity Kaelen 126 5A …     │ +1 Camelot · …  │
│ Browser    │ 3 …                                       │ Add to set      │
│ Flash/Stor.│ … virtualized · hover art = play icon     │                 │
│            │ right-click = Library menu (≠ Prep/Auto)  │                 │
├────────────┴──────────────────────────────────────────┴─────────────────┤
│ Mini: art · title · compact wave · transport                            │
└─ Full player: TOP detailed zoomed MOVING wave + grid | BOTTOM overview ─┘
```

**Key UI notes**

- Left nav **tabs**: All Library · Categories · Playlists · Browser · Flash/Storage  
- Key = Camelot **1A–12B** and/or **1m / 1d** pills vs playing track  
- **Energy** charging bars · **Tags** chips · **Rating** editable 5 stars · **Label/Year** columns  
- Artwork hover → play icon → plays in player  
- **Mix Suggestions** button opens right dock  
- Columns resize + show/hide; context menu **per view**  
- Full player: **top** = zoomed moving detailed wave + grid; **bottom** = full-track overview (not the same strip)  
 

### 2.2 Library — nav collapsed + filters open

```
├─[📚]┬─ 🔍 …  [Filters open: BPM 120–130 · Compatible · Clear] ──────────┤
│[📋]│  track table uses full width …                                    │
│[🗂]│                                                                    │
│[💾]│                                                                    │
├─────┴────────────────────────────────────────────────────────────────────┤
│ Mini player                                                              │
```

---

## 3. Preparation view — wireframe

### 3.1 Default (Prepare workspace)

```
┌─ menus ──────────────────────────────────────────────────────────────────┐
├─ ♪   Library [ Preparation ] Auto Performance              Export GigReady┤
├─ Set: Club Peak Friday ▾  · Template ▾  · Cue Master  Tag Surgeon  …    ┤
├──────────┬──────────────────────────────┬────────────────────────────────┤
│ Sources  │ SET ORDER                    │ SKILLS                         │
│ Library  │ # Title         BPM Key      │ ┌ Cue Master ─────────────┐   │
│ Lists    │ 1 Neon Skyline  126 ⬤5A     │ │ Generate 8 hot cues     │   │
│ Sets     │ 2 Gravity Pull  126 ⬤5A     │ │ [Run]  last: 40 tracks  │   │
│          │ 3 Solar Wind    128 ⬤8B     │ └─────────────────────────┘   │
│          │ 4 Ember Lane    124 ⬤2A     │ ┌ Set Architect ──────────┐   │
│          │ (drag handle · drop gap)     │ │ Sequence by key/energy │   │
│          │                              │ │ [Run] [Undo]           │   │
│          │                              │ └─────────────────────────┘   │
├──────────┴──────────────────────────────┴────────────────────────────────┤
│ FULL PLAYER                                                              │
│ Title · chips · 1:24 / 3:48                                              │
│ ┌ Detailed waveform ════════════ playhead ════════════ cues A B C … ──┐ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌ Overview map ░░░░░▓▓▓visible░░░░░  playhead ───────────────────────┐ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ CUE  ▶/❚❚   [A][B][C][D][E][F][G][H]   Grid · Beat Jump · Zoom Fit      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Preparation — Skills collapsed (max set list)

```
├─ Sources ┬─ SET ORDER (wide) ─────────────────────────────┬─[✨]┤
│          │ more columns visible                            │ strip│
├──────────┴─────────────────────────────────────────────────┴─────┤
│ Full or Mini player per user preference                          │
```

---

## 4. Auto Performance view — wireframe

```
┌─ menus ──────────────────────────────────────────────────────────────────┐
├─ ♪   Library  Preparation [ Auto Performance ]                           ┤
├─ Set: Club Peak Friday ▾    AUTO ● ON    Skip    Flag issue              ┤
├──────────────────────────────────────────────────────────────────────────┤
│ NOW PLAYING                                                              │
│ ▨  Neon Skyline — Ava Thompson     126 BPM  5A     1:12 / 4:38           │
│ ▁▂▃▅▇█▇▅▃▂▁▂▃▅ playhead  ▅▃    AUTO advancing                            │
├─────────────────────────────┬────────────────────────────────────────────┤
│ QUEUE                       │ INSIGHTS                                   │
│ ▶ 1 Neon Skyline    5A      │ Energy  ▁▂▃▅▇▅▃▂                           │
│   2 Gravity Pull    5A      │ Key path 5A→5A→8B→2A                       │
│   3 Solar Wind      8B      │ ⚠ Track 3: large key jump                  │
│   4 Ember Lane      2A      │    [Fix in Preparation]                    │
│   5 Deep Current    4A      │ ⚠ Track 4: no hot cues                     │
│                             │    [Fix in Preparation]                    │
├─────────────────────────────┴────────────────────────────────────────────┤
│ Compact transport · queue-linked                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Not shown:** dual decks, crossfader, FX — out of product scope. EQ8 is a preview equalizer, not a live mixer strip.

---

## 5. Player states — wireframe detail

> These are dock-only sketches. The canonical three-presentation layout is [06A](06A-PLAYER-PRESENTATIONS.md); the target removes Stop and adds the full-player Player view composition. Extended was retired on 2026-10-23.

### Mini

```
┌──────┬────────────────────────────────────────────────────────────┐
│ art  │ Title · Artist · BPM Key LUFS                               │
│      │ ▁▂▃▅█playhead▅▃▂▁  1:24/3:48    CUE ▶  [A]…[H]  ↗ Full     │
└──────┴────────────────────────────────────────────────────────────┘
```

### Full

```
┌──────┬────────────────────────────────────────────────────────────┐
│ art  │ Title · Artist · chips · time · Zoom − + Fit                │
├──────┴────────────────────────────────────────────────────────────┤
│ DETAILED WAVEFORM (grid · phrases · cues · PLAYHEAD)               │
│ OVERVIEW MAP (full track · zoom window · PLAYHEAD)                 │
│ CUE  Play/Pause  A B C D E F G H   Grid  BeatJump  Zoom            │
└──────┴────────────────────────────────────────────────────────────┘
```

Play button icon **toggles to Pause** while playing. Target transport has no Stop.

---

## 6. Settings window — wireframe

```
┌─ Settings ────────────────────────────────────────────── × ┐
│ 🔍 Search settings                                      │
├─────────────┬───────────────────────────────────────────┤
│ General     │  Theme        (•) Dark  ( ) Light  ( ) Sys│
│ Library     │  Density      (•) Compact  ( ) Comfortable│
│ Analysis    │  Accent       [ cyan-40   ▾ ]             │
│ Cues & Grid │  …                                        │
│ Playback    │                                           │
│ Export      │                                           │
│ Skills      │                                           │
│ Appearance  │ ← selected                                │
│ Keyboard    │                                           │
│ Privacy     │                                           │
│ Advanced    │                                           │
└─────────────┴───────────────────────────────────────────┘
```

---

## 7. Overlays — quick wireframes

**Command palette**

```
        ┌─ Search tracks, sets, Skills, settings… ────┐
        │ Library view                         ⌘1     │
        │ Preparation view                     ⌘2     │
        │ Run Cue Master                              │
        │ Settings → Export                           │
        └─────────────────────────────────────────────┘
```

**Toast + Undo**

```
  ┌─ Applied Tag Surgeon to 12 tracks    [Undo] ────┐
```

**Export preview**

```
  ┌─ Export set ─────────────────────────────┐
  │ Format: rekordbox XML ▾                  │
  │ Destination: ~/Exports/ClubPeak.xml      │
  │ Preview: 24 tracks · 1 playlist          │
  │ [Cancel]                    [Export]     │
  └──────────────────────────────────────────┘
```

---

## 8. Responsive / size rules (desktop)

| Width | Behavior |
|-------|----------|
| ≥1600px | Comfortable multi-dock |
| 1280–1599 | Default; collapse right dock earlier |
| 1024–1279 | Prefer nav rail; Full player still available |
| &lt;1024 | Supported best-effort; stack priority = Main → Player → Nav |

No mobile layout required for MVP.

---

## 9. Alignment checklist

- [ ] Every view uses the same shell (menu, header, options, nav, player)  
- [ ] Splitters work on left, right, and player  
- [ ] Workspaces restore sizes  
- [ ] Library maximizes table; Preparation prioritizes waveform; Validate prioritizes queue + insights  
- [ ] Wireframes match components in [09-COMPONENTS.md](09-COMPONENTS.md)  
