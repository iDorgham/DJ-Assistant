# 09 — Component Inventory

**Version:** 1.0 · **Date:** 2026-10-19

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
| `TrackTable` | Virtualized rows, selection, sort |
| `ColumnPicker` | Show/hide/reorder/resize |
| `SearchField` | Global/list search |
| `FilterBar` | Chips + filter controls |
| `KeyPill` | Harmonic-colored key |
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
| `PlayerDock` | Mini/Full/Hidden shell |
| `PlayerMini` | Compact chrome |
| `PlayerFull` | Full chrome |
| `WaveformDetailed` | Zoomable waveform |
| `WaveformOverview` | Full-track map |
| `Playhead` | Position line + seek |
| `TransportControls` | Cue / Play-Pause / Stop |
| `HotCueBank` | A–H pads |
| `GridControls` | Snap, nudge, BPM fine |
| `BeatJumpControls` | ± beat jumps |

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
| Play / Pause / Stop | `play` / `pause` / `square` |
| Settings | `settings` |
| Theme | `sun` / `moon` |
| Analyze | `activity` |
| Export | `file-output` |

---

## State notes

- Player: `mode`, `trackId`, `isPlaying`, `positionMs`, `cues[]`, `zoom`, `followPlayhead`  
- Library: `selection[]`, `filters`, `columns`, `sort`  
- Preparation: `setId`, `tracks[]`, `dirty`  
- Auto: `autoOn`, `setId`, `index`  
- Shell: `workspaceId`, `navCollapsed`, `theme`, `density`  
