# 03 — Library View

**Version:** 1.0 · **Date:** 2026-10-19

Primary job: **music library management** — browse, search, filter, tag, analyze, organize.

---

## 1. Layout

```
Header · [Library] Preparation  Auto Performance
Options: Search | Filters | Columns | Analyze | Add to set
┌─ Left nav ─┬────────────────────────────────────────────┐
│ Sources    │ Track table (max space)                    │
│            │ # Title Artist Album BPM Key Time Status   │
│            │ …                                          │
├────────────┴────────────────────────────────────────────┤
│ Mini player (default)                                   │
└─────────────────────────────────────────────────────────┘
```

Default workspace: **Library** · player **Mini** · harmonic coloring on when a track is playing.

---

## 2. Track table

### 2.1 Behavior

- Virtualized for large libraries  
- Sticky header  
- Row height 28–32px (density)  
- Click selects; Cmd/Ctrl+click multi; Shift+click range  
- Double-click loads track into player (optional auto-play per settings)  
- Right-click → context menu (analyze, tags, add to playlist/set, reveal file, …)  
- Drag rows to Preparation set or playlist  

### 2.2 Customizable columns

**Configure:** right-click header or **Columns** control → checklist; drag to reorder; drag edge to resize; reset default.

| Column | Default | Notes |
|--------|---------|--------|
| # | On | |
| Artwork | Off | |
| Title | On | Cannot hide last identity column |
| Artist | On | |
| Album | On | |
| Genre | Off | |
| BPM | On | Tabular nums |
| Key | On | Colored pill vs playing track |
| Time | On | |
| LUFS | Off | |
| Energy | Off | |
| Rating | Off | |
| Color | Off | |
| Status | On | Analyzed / cues / error |
| Cues | Off | Count or indicator |
| Comment, Year, Label, Path, Size, custom tags | Off | |

Visibility, order, widths persisted **per view**.

### 2.3 Harmonic key display

- Key column uses colored pills relative to **player track** (see Design System)  
- Filter chip: **Compatible only**  
- Preference: Strict vs Wide; Camelot and/or classical notation  

---

## 3. Search

- Options bar + `Ctrl/Cmd+F` or `/`  
- Fields: title, artist, album, genre, comment, filename, tags, label  
- Debounced live filter; highlight matches  
- Scope chips optional: All · Title · Artist · Tags · Path  
- Esc clears  

---

## 4. Filters

| Filter | UI |
|--------|-----|
| BPM | Min–max or range |
| Key | Multi-select |
| Compatible only | Toggle (vs playing) |
| Energy | Range |
| Genre / tags | Multi / typeahead |
| Analyzed | Yes / No / Any |
| Has cues | Toggle |
| Rating / color | Multi |
| Date added | Presets or range |
| Location | Folder / USB |

Active filters = dismissible chips above table + Clear all.  
Optional: save as smart collection.

---

## 5. Bulk actions

When selection &gt; 0, show bulk bar:

- Analyze  
- Smart Tag Cleanup  
- Add to playlist / set  
- Export selection  
- Clear selection  

All bulk writes offer **Undo** toast. Field-writing bulk actions (Smart Tag Cleanup, enrichment apply) must show a **preview → apply → undo** flow: preview the affected tracks and field changes before anything is written.

---

## 6. Empty & loading

- **Empty library:** icon + “Add music folder” primary CTA  
- **No search hits:** “No tracks match” + clear filters  
- **Analyzing:** quiet progress in header/options; rows update as done  

---

## 7. Acceptance

- ≥12–15 rows visible at 1440×900 with Mini player  
- Column picker works; state restores  
- Compatible-only filter + key pills track the player key  
- Search and filters combine correctly  
