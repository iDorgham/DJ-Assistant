# 02 — Shell & Navigation

**Version:** 1.0 · **Date:** 2026-10-19

---

## 1. Window structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Menu bar (File Edit View Library Set Tools Help)                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Header 36–40px: App · View switcher · status · theme · player · window  │
├──────────────────────────────────────────────────────────────────────────┤
│ Options bar ~32px: context actions for current view                      │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Left nav   │ Main canvas (Library | Preparation | Auto Performance)      │
│ 220 / 48px │                                                             │
│            │                                                             │
├────────────┴─────────────────────────────────────────────────────────────┤
│ Player dock: Mini | Full | Hidden                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

- Header never covered by player  
- Player slides up under main content  
- All vertical splits resizable; double-click resets  

---

## 2. Application menus

### File
- Add folder to library…
- Import playlist / crate…
- Export set… / Export selected…
- Gig Ready…
- Preferences… (`Ctrl/Cmd+,`)
- Quit

### Edit
- Undo / Redo  
- Cut / Copy / Paste  
- Select all / Deselect  
- Find… (`Ctrl/Cmd+F`)

### View
- Library / Preparation / Auto Performance  
- Toggle left nav · inspector · player  
- Mini / Full player  
- Density: Compact / Comfortable  
- Theme: Dark / Light / System  
- Workspaces → Library · Prepare · Validate · Save… · Reset  

### Library
- Analyze selected / Analyze pending  
- Smart Tag Cleanup…  
- Create playlist / smart collection  
- Rescan folders  
- Library health  

### Set
- New / Open / Duplicate set  
- Run Set Architect / Energy Cartographer…  
- Validate set (opens Auto Performance)  
- Export…  

### Tools
- Skills gallery  
- Cue Master, Tag Surgeon, …  
- Batch operations…  
- Keyboard shortcuts  

### Help
- Documentation  
- Keyboard shortcuts  
- Check for updates  
- About  

Show shortcuts in menus; respect macOS standard roles.

---

## 3. Header

Left → right:

1. App mark + name (small)  
2. **View switcher:** `[ Library ] [ Preparation ] [ Auto Performance ]`  
3. Spacer  
4. Analysis / job status (quiet)  
5. Theme toggle  
6. Volume (hover slider)  
7. Player visibility  
8. Native window controls  

Shortcuts: `Ctrl/Cmd+1..3` for views.

---

## 4. Options bar (context)

Changes by view:

| View | Typical contents |
|------|------------------|
| Library | Search · filter chips · Columns · Analyze · Add to set |
| Preparation | Set name · Template · Skills shortcuts · Export · Gig Ready |
| Auto Performance | Set selector · AUTO on/off · Skip · Flag issue |

Height ~32px; secondary to header; no duplicate of menu-only rare actions.

---

## 5. Left navigation

| Item | Icon (Lucide) | Role |
|------|---------------|------|
| Library | `library` | All tracks, smart collections |
| Playlists | `list-music` | User playlists |
| Browser | `folder-tree` | Watched folder tree |
| Flash / USB | `usb` | Mounted drives, export targets |
| Sets | `layers` | Preparation sets |
| Skills | `sparkles` | Skills shortcuts |

- Expanded: icon + label + optional count badge  
- Collapsed: icon rail 48px + tooltips  
- Active: accent left bar + elevated background  
- Collapse control: `panel-left` / `panel-left-close`  

---

## 6. Workspaces (Adobe-style)

| Preset | Layout |
|--------|--------|
| Library | Wide table, Mini player, nav as needed |
| Prepare | Set list + Full player + Skills open |
| Validate | Auto queue + insights, compact player |
| Custom | User-saved sizes + collapsed flags |

Save / reset from View menu. Switch animates pane sizes ≤200ms.

---

## 7. Splitters

- Visible 1px hairline  
- Hit target 4–6px  
- Cursor `col-resize` / `row-resize`  
- Live resize; min sizes enforced  
- Double-click → default size  
- Persist per workspace / view  

---

## 8. Command palette

- Shortcut: `Ctrl/Cmd+K`  
- Fuzzy search: views, sets, Skills, settings entries, recent tracks  
- Keyboard-only complete path  
- Centered overlay, L3 surface  
