# 03 — Library View

**Version:** 1.4 · **Date:** 2026-10-19  
**Full wireframes:** [12-WIREFRAMES-AND-FLEXIBILITY.md](12-WIREFRAMES-AND-FLEXIBILITY.md)

Primary job: **music library management** — browse, search, filter, tag, analyze, organize.

---

## 1. Layout

Default workspace: **Library** · player **Mini** · harmonic coloring when a track is playing.  
Left nav and player are **resizable/collapsible**. Right dock opens for **Mix Suggestions** when requested.

```
┌─ Menu ──────────────────────────────────────────────────────────────┐
├─ Header: [Library] Preparation  Auto Performance                    │
├─ Options: Search | Filters | Columns | Analyze | Mix Suggestions | Add to set │
├─ Left nav ─┬─ Track table (primary) ──────────────┬─ Mix Suggestions ┤
│ (tabs)     │ # Art Title Artist … Key Energy Tags │ (right dock)     │
│ ←resize→   │ virtualized · multi-select · bulk    │ ←resize / hide→  │
├────────────┴──────────────────────────────────────┴──────────────────┤
│ Mini player ↑ height  ·  expand to Full when needed                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Left nav — Library sources (tabs)

Left panel is organized as **tabs / sections** (not a flat list only):

| Tab / section | Icon | Content |
|---------------|------|---------|
| **All Library** | `library` | Every imported track |
| **Categories** | `folder` / `tags` | Genre, energy bands, custom categories, smart collections |
| **Playlists** | `list-music` | User playlists + crates |
| **Browser** | `folder-tree` | Watched folder tree on disk |
| **Flash / Storage** | `usb` / `hard-drive` | Mounted USB, external drives, export targets |

- Expanded: icon + label + optional count badge  
- Collapsed: icon rail 48px + tooltips  
- Active tab: accent left bar + elevated background  
- Storage devices list updates when mounts appear/disappear  
- Selecting a source filters the main track table  

---

## 3. Track table

### 3.1 Behavior

- Virtualized for large libraries  
- Sticky header  
- Row height 28–32px (density); taller when Artwork column is on  
- Click selects; Cmd/Ctrl+click multi; Shift+click range  
- Double-click loads track into player (optional auto-play per settings)  
- **Right-click** → Library-specific context menu (see §3.5)  
- Drag rows to Preparation set or playlist  

### 3.2 Customizable columns (resize + show/hide)

**Configure:** right-click header or **Columns** control → checklist; drag headers to **reorder**; drag column edges to **resize**; double-click edge to auto-fit; reset default.

| Column | Default | Notes |
|--------|---------|--------|
| # | On | |
| **Artwork** | Off | Hover → play overlay (see §3.7) |
| Title | On | Cannot hide last identity column |
| Artist | On | |
| Album | On | |
| Genre | Off | |
| BPM | On | Tabular nums |
| **Key** | On | Camelot **1A–12A / 1B–12B** + classical **1m / 1d** etc. (see §3.3) |
| **Energy** | Off | 1–10 charging bars |
| **Tags** | Off | Inline tag chips (music file tags + custom) |
| **Rating** | Off | **Editable 5-star icons** (see §3.4) |
| Time | On | |
| **Label** | Off | Record label / publisher |
| **Year** | Off | |
| LUFS | Off | |
| Color | Off | |
| Status | On | Analyzed / cues / error |
| Cues | Off | Count or indicator |
| Comment, Path, Size, format, custom tags | Off | |

Visibility, order, **and widths** persisted **per view**.

**Quick show/hide** from track context menu (and Columns picker): Energy, Tags, Rating, Label, Year, Artwork — plus full list in Columns.

### 3.3 Key display (harmonic + easy keys)

Supported notations (user preference; can show both):

| System | Examples |
|--------|----------|
| **Camelot** | `1A` `1B` … `12A` `12B` |
| **Classical / Open Key style** | `1m` `1d` (minor / major), or full classical when preferred |
| Optional | Traditional classical (Am, C, …) |

- Key column = colored **pills** relative to **currently playing** track (harmonic compatibility)  
- Filter: **Compatible only** (Strict vs Wide)  
- Settings → Library / Analysis: default notation + Strict/Wide  

### 3.4 Rating — editable 5 stars

- Column shows **5 star icons** (outline / filled)  
- Click a star sets rating 1–5; click same star again can clear (0) if preferred  
- Keyboard: focus cell → `1`–`5` or `0` to clear  
- Multi-select: set same rating on all selected (with Undo)  
- Sortable; filterable by rating  

### 3.5 Library right-click context menu

**Library-only** menu (Preparation and Auto Performance have different menus — see those views).

Primary actions the user expects on a track (or selection):

```
┌─────────────────────────────────────────┐
│ Play / Load into player                 │
│ Analyze                                 │
│ ───────────────────────────────────     │
│ Edit tags…                              │
│ Fix tags (Smart Tag Cleanup)            │
│ Rate ▸  ★★★★★                           │
│ ───────────────────────────────────     │
│ Add to playlist ▸                       │
│ Add to set ▸                            │
│ Find in playlists…                      │  → lists playlists that contain this track
│ Mix suggestions…                        │  → opens right Mix Suggestions panel for this track
│ ───────────────────────────────────     │
│ Find smaller / similar tracks online…   │  → search web for smaller file size or similar new tracks
│ Find new tracks online…                 │  → discover related / newer releases (artist, label, style)
│ ───────────────────────────────────     │
│ View columns                            │
│   ☑ Show Artwork                        │
│   ☑ Show Energy                         │
│   ☑ Show Tags                           │
│   ☑ Show Rating                         │
│   ☑ Show Label                          │
│   ☑ Show Year                           │
│ ───────────────────────────────────     │
│ Reveal in Finder / Explorer             │
│ Copy path                               │
│ ───────────────────────────────────     │
│ Remove from library…                    │  (does not delete the music file on disk)
└─────────────────────────────────────────┘
```

**Action notes**

| Item | Behavior |
|------|----------|
| **Play** | Load focused track into player and play |
| **Analyze** | Queue analysis (BPM, key, energy, peaks, cues as configured) for selection |
| **Edit tags…** | Open tag editor for title, artist, album, genre, label, year, custom tags **and the free-text comment** |
| **Fix tags** | Run Smart Tag Cleanup / Tag Surgeon on selection (Undo toast) |
| **Add to playlist ▸** | Submenu of existing playlists + “New playlist…” |
| **Find in playlists…** | Dialog or popover listing every playlist that includes this track; jump to playlist |
| **Mix suggestions…** | Opens **Mix Suggestions** right dock focused on this track (harmonic / BPM / energy) |
| **Find smaller / similar tracks online…** | Opens online search flow for a smaller-file or closely matching version (same track, lower bitrate/size, or alternate release). Results are reviewable before any download; never auto-overwrite library files |
| **Find new tracks online…** | Discover related or newer tracks (same artist, label, or style). Results are suggestions only; user chooses what to add |
| **Remove from library…** | Soft-remove from DJ Assistant library index only; file on disk stays; Undo available |

**Rules**

- Multi-select: Analyze, Fix tags, Add to playlist/set, Remove apply to the whole selection  
- Play, Edit tags, Find in playlists, Mix suggestions, online find act on the focused/primary row (or first selected)  
- Online find actions are **opt-in**, privacy-safe: no bulk upload of the library; query uses title/artist/label the user already has  
- Destructive / write actions offer **Undo** where possible  


### 3.6 Energy & Tags (recap)

- **Energy:** 1–10 charging bars; tooltip “Energy N / 10”  
- **Tags:** compact chips + “+N” overflow; click chip → filter  

### 3.7 Artwork column + hover play

- When **Artwork** column is visible: small cover thumb per row  
- **Hover** artwork → semi-transparent **play icon** overlay  
- Click play icon (or artwork with modifier per settings) → load + play track in player  
- Missing artwork → muted placeholder (album icon)  
- Artwork must load from embedded tags / sidecar / analysis cache (implementation must not leave blank when file has art)

### 3.8 Label & Year

- Dedicated columns (default Off); show via Columns or context menu  
- Label = record label / publisher from tags  
- Year = release year  
- Both searchable / filterable where data exists  

---

## 4. Mix Suggestions (right panel)

**Options bar button: Mix Suggestions** — opens/closes the **right dock**.

| Content | Behavior |
|---------|----------|
| Compatible next tracks | Harmonic + BPM + energy proximity to selection or playing track |
| Energy / key path hints | Short list with reason chips (e.g. “+1 Camelot”, “same energy”) |
| Actions | Add to set · Preview · Replace selection |
| Empty | “Select a track to see mix suggestions” |

- Resizable / collapsible like Skills dock in Preparation  
- Does not replace Library table; sits beside it  
- Uses same harmonic rules as key pills  

---

## 5. Search & filters

- Options bar + `Ctrl/Cmd+F` or `/`  
- Fields include title, artist, album, genre, comment, filename, **tags**, label, year  
- Filters: BPM, Key, Compatible only, Energy, Genre/tags, Rating, Analyzed, Has cues, Date, Location  

---

## 6. Bulk actions

When selection > 0:

- Analyze · Smart Tag Cleanup · Rate · Add to playlist/set · Export selection · Clear selection  
- All bulk writes → **Undo** toast  

---

## 7. Empty & loading

- Empty library → “Add music folder”  
- No search hits → clear filters  
- Analyzing → quiet progress; rows update as done  

---

## 8. Acceptance

- Left nav tabs: All Library · Categories · Playlists · Browser · Flash/Storage  
- Columns resize, reorder, show/hide; widths persist  
- Rating = editable 5-star icons  
- Key pills support Camelot 1A–12B and classical-style 1m/1d (per preference)  
- Label + Year columns available  
- Artwork hover shows play; click plays in player  
- Mix Suggestions button opens right panel with harmonic/BPM suggestions  
- Library context menu is distinct from Preparation / Auto Performance menus  
- Library menu includes: Play, Analyze, Edit tags, Fix tags, Add to playlist, Find in playlists, Mix suggestions, Find smaller/similar online, Find new tracks online, Remove from library  
- Energy bars + Tags chips as previously specified  
