# 09 — Component Inventory

**Version:** 1.2 · **Date:** 2026-10-19

Logical UI components for implementation (React + design tokens).

---

## Shell

| Component | Responsibility |
|-----------|----------------|
| `AppShell` | Menu, header, options bar, nav, main, player slot |
| `AppMenuBar` | File…Help |
| `AppHeader` | View switcher, status, theme, volume, player toggle |
| `OptionsBar` | Context actions by view |
| `LeftNav` | Sources list, collapse rail |
| `Splitter` | Resize panes |
| `WorkspaceManager` | Presets save/load |

---

## Library

| Component | Responsibility |
|-----------|----------------|
| `TrackTable` | Virtualized rows, selection, sort, context menu |
| `ColumnPicker` | Show/hide/reorder/**resize** (widths persist) |
| `SearchField` | Global/list search |
| `FilterBar` | Chips + filter controls |
| `KeyPill` | Harmonic-colored key (Camelot 1A–12B + 1m/1d) |
| `EnergyBars` | 1–10 charging-bar meter |
| `TagChips` | Compact tag chips + overflow “+N” |
| `StarRating` | Editable 5-star icons (click / keys 0–5) |
| `ArtworkThumb` | Cover + **hover play overlay** |
| `TrackContextMenu` | Per-view menus; Library: Play, Analyze, Edit/Fix tags, Add to playlist, Find in playlists, Mix suggestions, Find smaller/new tracks online, Remove |
| `MixSuggestionsPanel` | Right dock: harmonic/BPM next-track suggestions |
| `LibrarySourceTabs` | All Library · Categories · Playlists · Browser · Flash/Storage |
| `BulkActionBar` | Selection actions |
| `SmartCollectionList` | Saved filters |

---

## Preparation

| Component | Responsibility |
|-----------|----------------|
| `SetTrackList` | Reorderable set rows |
| `SkillsDock` | Skill cards Run/Undo |
| `SkillCard` | Single Skill |
| `ConstraintChips` | Set builder constraints |
| `GigReadyChecklist` | Pre-export issues |
| `ExportDialog` | Format + preview tree |

---

## Auto Performance

| Component | Responsibility |
|-----------|----------------|
| `AutoNowPlaying` | Identity + AUTO transport |
| `AutoQueue` | Set order list |
| `SetInsights` | Energy, key path, warnings |

---

## Player

| Component | Responsibility |
|-----------|----------------|
| `PlayerDock` | Mini/Full/Hidden dock shell |
| `PlayerMini` | Compact chrome |
| `PlayerFull` | Full dock chrome, including the Hot cues ↔ Grid & beat segmented panel |
| `PlayerView` | Full-window composition: Full player + EQ8 drawer + playlist |
| `PlayerEQ8Drawer` | Slide-down EQ panel between player and playlist |
| `PlayerPlaylistTable` | Time-left, title and artist playlist below EQ |
| `WaveformDetailed` | Zoomable waveform |
| `WaveformOverview` | Full-track map |
| `Playhead` | Position line + seek |
| `TransportControls` | Cue / previous / play-pause / next |
| `HotCueBank` | A–H pads |
| `GridControls` | Snap, nudge, BPM fine |
| `BeatJumpControls` | ± beat jumps |
| `SpectrumVisualizer` | Artistic real-time spectrum (2D / 3D / Psy / Particle / Club) |
| `VisualizerStylePicker` | Family + preset + intensity / color / particle mix |
| `VisualizerRecorder` | Record / export video or image sequence for Resolume |

---

## Overlays & shared

| Component | Responsibility |
|-----------|----------------|
| `Modal` | Dialog frame |
| `ConfirmDialog` | Destructive confirm |
| `Toast` | Message + Undo |
| `CommandPalette` | ⌘K |
| `ContextMenu` | Right-click |
| `Popover` | Anchored small UI |
| `EmptyState` | Icon + CTA |
| `ProgressBar` | Determinate/indeterminate |
| `SettingsWindow` | Categories + panels |
| `ThemeProvider` | Dark/light tokens |
| `DensityProvider` | Compact/comfortable |

---

## Icon assignments (Lucide)

| UI | Icon |
|----|------|
| Library view | `library` |
| Preparation | `list-music` |
| Auto Performance | `play-circle` |
| Playlists | `list-music` |
| Browser | `folder-tree` |
| USB | `usb` |
| Sets | `layers` |
| Skills | `sparkles` |
| Filters | `list-filter` |
| Columns | `columns-3` |
| Search | `search` |
| Panel left | `panel-left` |
| Panel right | `panel-right` |
| Player panel | `panel-bottom` |
| Play / Pause | `play` / `pause` |
| Player view | `maximize-2` |
| Settings | `settings` |
| Theme | `sun` / `moon` |
| Analyze | `activity` |
| Export | `file-output` |

---

## State notes

- Player: `presentation`, `trackId`, `isPlaying`, `positionMs`, `cues[]`, `zoom`, `followPlayhead`, `eqOpen`, `playlistDirty`  
- Library: `selection[]`, `filters`, `columns`, `sort`  
- Preparation: `setId`, `tracks[]`, `dirty`  
- Auto: `autoOn`, `setId`, `index`  
- Shell: `workspaceId`, `navCollapsed`, `theme`, `density`  
