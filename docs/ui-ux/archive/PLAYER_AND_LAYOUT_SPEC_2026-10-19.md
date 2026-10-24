# DJ Assistant — Application Views, Player & Layout UI/UX Spec

**Version:** 1.7 (final polish)  
**Status:** Historical design proposal — superseded by [`docs/ui/`](../../ui/README.md)
**Date:** 2026-10-19  
**Scope:** Final UI/UX language — Adobe-inspired precision + Ableton flexibility + 2026 pro-app trends; full screens, menus, settings, motion, dialogs, player, library tools

---

## 0. Product Positioning (locked)

DJ Assistant is **not** a DJ performance application.

It is a desktop tool for:

1. **Music library management** — import, analyze, tag, organize, search
2. **Playlist creation** — collections, smart lists, set drafts
3. **Set mix preparation** — cues, grid, harmonic/energy sequencing, export to rekordbox/Serato/CDJ

The player is a **preview and validation** surface only. There is no live mixing engine, no dual-deck performance UI, no replacement for CDJs / rekordbox / Serato as the performance surface.

---

## 1. Three Primary Application Views

The app has **three top-level views**, switched from the header. Each view has a different primary job and a different default layout emphasis.

| View | Primary job | What the user does here |
|------|-------------|-------------------------|
| **Library** | Music library management | Browse, search, filter, tag, analyze, organize folders/USB, fix metadata |
| **Preparation** | Set & playlist preparation | Build playlists/sets, place cues, correct grid, run Skills, sequence by key/energy, export |
| **Auto Performance** | Automated set validation | Play through a prepared set in order (auto-advance), check flow/energy/transitions before export |

These are **modes of the same app**, not separate products. Shared: left nav sources, player, track data, analysis results.

### 1.1 View switcher (header)

Compact segmented control, always visible:

```
[ Library ]  [ Preparation ]  [ Auto Performance ]
```

- Active view: filled / accent
- Keyboard: `Ctrl/Cmd+1..3` (bare digits are reserved for hot cues)
- View choice persists per session (and optionally as user preference)

---

## 2. View Definitions

### 2.1 Library View — music library management

**Goal:** Fast, dense management of the entire collection.

**Layout emphasis**

```
┌─ Header: [Library] Preparation  Auto Performance  · search · status ────┐
├─ Left nav ─┬─ Toolbar (filter, sort, analyze, tag actions) ─────────────┤
│ Library    │                                                             │
│ Playlists  │   TRACK TABLE / GRID (maximum space)                        │
│ Browser    │   columns: # Title Artist Album BPM Key Time Status Tags    │
│ Flash/USB  │                                                             │
│            │                                                             │
├────────────┴─────────────────────────────────────────────────────────────┤
│ Mini player (default) — preview only                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Capabilities**

- Folder / collection browser (left)
- **Search bar** for tracks and tags (see §2.1.2)
- **Filters** panel / bar (BPM, key, energy, tags, analysis status, etc.) — see §2.1.2
- **Harmonic key coloring** relative to the playing track (see §2.1.3)
- Bulk select → analyze, tag cleanup, add to playlist, export selection
- Inline tag editing, smart collections
- Analysis progress and health (missing BPM/key, failed files)
- USB / Flash section for export targets and “what’s on the stick”
- **Customizable track columns** — show/hide, reorder, and resize (see §2.1.1)
- **Flexible Ableton-style layout** — resizable panels, collapsible sections (see §3.3)

**Player role:** Mini by default. Full player only when user opens it to verify a track while tagging. No queue/auto-DJ chrome in this view unless user opts in.

#### 2.1.1 Library track table — customizable columns

Users can control which columns appear in the track list, matching pro library tools (rekordbox, Serato, MusicBee, etc.).

**How to configure**

- Right-click any column header → checklist of available columns (show/hide)
- Or toolbar control: **Columns** button / “Customize columns…”
- Drag column headers to **reorder**
- Drag column edges to **resize** (double-click edge to auto-fit)
- **Reset to default** option in the same menu

**Column set (show/hide independently)**

| Column | Default | Notes |
|--------|---------|--------|
| # / Index | On | Row number or playlist order |
| Artwork | Off | Small cover thumb (optional density cost) |
| Title | On | Always recommended on |
| Artist | On | |
| Album | On | |
| Genre | Off | |
| BPM | On | |
| Key | On | Camelot / open key display per preference |
| Duration / Time | On | |
| LUFS / Loudness | Off | |
| Energy | Off | 0–10 or analysis proxy |
| Rating | Off | Stars / color |
| Color | Off | User color tag |
| Bitrate / Format | Off | |
| Year | Off | |
| Date added | Off | |
| Date analyzed | Off | |
| Cues | Off | Count or “has hot cues” indicator |
| Status | On | Analyzed / missing grid / error |
| Comment | Off | |
| Label / Publisher | Off | |
| File path / Location | Off | |
| File size | Off | |
| *Custom user tags* | Off | Any extra tag fields the library supports |

**Rules**

- At least **Title** (or Title+Artist) must remain visible — cannot hide the last identity column.
- Column visibility, order, and widths are **persisted per view** (Library vs Preparation set list can differ) and per user.
- Horizontal scroll appears only when visible columns exceed the panel width; prefer keeping the table usable without scroll on typical laptop widths when defaults are used.
- Compact density: optional “narrow columns” mode for BPM / Key / Time so more tag columns fit.
- Preparation set list and Auto Performance queue can reuse the same column-picker component with a smaller default set (e.g. #, Title, Artist, BPM, Key, Time).

#### 2.1.2 Search bar & filters

**Search bar** (always visible in Library; available in Preparation source browser)

- Single prominent field: placeholder *Search tracks, artists, albums, tags…*
- Searches across: title, artist, album, genre, comment, filename, user tags, label
- Instant results as you type (debounced); highlight matching text in rows
- Keyboard: `Ctrl/Cmd+F` or `/` focuses search; `Esc` clears
- Optional scope chips under the field: *All · Title · Artist · Tags · Path*
- Recent searches dropdown

**Filters** (toolbar row and/or collapsible filter panel)

| Filter | Type | Example |
|--------|------|---------|
| BPM | Range slider or min–max | 120–128 |
| Key | Multi-select (Camelot or classical) | 5A, 5B, 6A |
| Compatible only | Toggle | Keys mixable with **playing track** |
| Energy | Range | 4–8 |
| Genre / Tag | Multi-select or typeahead | House, Vocal |
| Analyzed | Tri-state | Yes / No / Any |
| Has cues | Toggle | |
| Rating / Color | Multi-select | |
| Date added | Preset or range | Last 7 days |
| Location | Folder / USB | |

- Active filters shown as **dismissible chips** above the track table
- **Clear all** control
- Filter state persisted per view (optional “save as smart collection”)
- “Compatible only” ties directly to harmonic coloring (§2.1.3): one click to show only mixable keys vs the current player track

#### 2.1.3 Harmonic key coloring (vs playing track)

When a track is loaded in the player, the **Key** column (and optional row accent) shows which library tracks are harmonically compatible for mixing.

**Rules (Camelot / Open Key style)**

Relative to the **playing track** key:

| Relation | Meaning | Visual |
|----------|---------|--------|
| **Same key** | Perfect match | Strongest fill (e.g. full key color) |
| **±1 Camelot (adjacent)** | Classic compatible mix | Clear compatible color |
| **Relative major/minor** (e.g. 5A ↔ 5B) | Energy shift, still compatible | Same family, slightly different shade |
| **±2 or dominant options** (optional preference) | Wider “mixable” set | Softer compatible tint |
| **Incompatible** | Clash risk | Muted / neutral key text, no highlight |
| **Unknown key** | Not analyzed | Dim “—” or warning icon |

**UI details**

- Key cell uses a **colored pill or left swatch** (not only text color) so it stays readable in light and dark themes
- Optional thin **row left border** or background wash for compatible tracks when “highlight mixable” is on
- Playing track’s own row: distinct “now playing” marker (icon or bar), not the same as compatible
- Preference: *Strict* (same + adjacent + relative) vs *Wide* (±2, energy boosts)
- Preference: show classical notation (Am, C#m) or Camelot (5A) or both
- Works in Library table, Preparation source list, and “add to set” browsers
- When player is empty, keys show default analysis color or neutral — no compatibility highlighting

This is a **prep aid** (what can mix with what I’m previewing), not a live DJ harmonic panel.

---

### 2.2 Preparation View — playlist creation & set mix preparation

**Goal:** Turn library tracks into a performance-ready set (cues, order, energy, export).

**Layout emphasis**

```
┌─ Header: Library [Preparation] Auto Performance  · set name · export ───┐
├─ Left ─┬─ Set / Playlist workspace ──────────────┬─ Inspector / Skills ─┤
│ Sources│  Track list of current set (reorderable) │  Cue / Tag / Energy  │
│ Library│  + harmonic / energy helpers              │  Skills panel        │
│ Lists  │                                           │  Constraints         │
│        │                                           │                      │
├────────┴───────────────────────────────────────────┴──────────────────────┤
│ Player — Mini or Full (Full preferred for cue/grid work)                  │
│ Detailed waveform + full-track map when Full                              │
└───────────────────────────────────────────────────────────────────────────┘
```

**Capabilities**

- Create / open playlists and set drafts
- Drag from Library sources into set order
- Cue Master, Tag Surgeon, Set Architect, Energy Cartographer, etc. (Skills)
- Constraint-driven sequencing (key, energy, BPM range) — Beam Search results editable
- Per-track cue editing on the dual waveform
- Grid adjust + beat jump for analysis correction
- Harmonic key coloring + “compatible only” filter vs playing track (same as Library)
- Search + filters in source browser when adding tracks
- Gig Ready / export actions (rekordbox XML, Serato crate, USB pack)
- Resizable set list / inspector / player (Ableton-style splits)

**Player role:** Central. Mini for quick checks; Full for serious cue and grid work. “Up Next” reflects the current set order.

---

### 2.3 Auto Performance View — automated set validation (not live DJ software)

**Goal:** Listen through a **prepared** set automatically to validate flow, energy curve, and transitions **before** export. This is a quality-check / rehearsal preview, not a club performance interface.

**What it is**

- Load one prepared playlist/set
- Auto-advance through tracks (with optional gap or simple crossfade *preview*)
- Show now-playing + upcoming queue
- Display energy / key path of the set
- Allow pause, skip, jump to track — still for validation, not mixing

**What it is not**

- Not dual decks, EQ, filters, or live remixing
- Not a replacement for CDJs / rekordbox / Serato performance mode
- Not marketed as “DJ software”

**Layout emphasis**

```
┌─ Header: Library  Preparation [Auto Performance]  · set selector ────────┐
├─ Now playing + large transport ─────────────────────────────────────────┤
│  Artwork · title · waveform overview · time · AUTO ON/OFF · skip        │
├─ Queue (set order) ────────────────────┬─ Set insights ─────────────────┤
│  1. Track …                            │  Energy curve                   │
│  2. Track …                            │  Key path                       │
│  3. …                                  │  Warnings (key clash, energy    │
│                                        │   drop, missing cues)           │
├────────────────────────────────────────┴────────────────────────────────┤
│ Mini or compact full player controls                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Capabilities**

- Choose set → Start Auto
- Auto-advance on track end (or on user-defined outro cue)
- Optional short crossfade preview (aesthetic only; not a mixer)
- Jump to any track in the set; resume auto from there
- Flag issues for return to Preparation (e.g. “fix grid on track 4”)
- No claim of live performance readiness beyond “preview sounds correct”

**Naming in UI:** Prefer **“Auto Performance”** as requested, with subtitle or tooltip: *“Preview your set in order — validate flow before export.”* Alternative internal name: Set Preview / Performance Check.

---

## 3. Shared Shell (all views)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  HEADER (~36–40 px)                                                        │
│  App · [ Library | Preparation | Auto Performance ] · search · status · ⚙  │
├──────────┬─────────────────────────────────────────────────────────────────┤
│ LEFT NAV │  VIEW-SPECIFIC MAIN CONTENT                                     │
│ (sources)│  (table / set workspace / auto queue + insights)                │
│          │                                                                 │
├──────────┴─────────────────────────────────────────────────────────────────┤
│  PLAYER — Mini (default in Library) / Full (common in Preparation)         │
│  slides up under header; never covers header                               │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Left navigation (shared sources)

Same sources across views; selection context follows the user when switching views where possible.

| Item | Role |
|------|------|
| **Library** | All tracks, smart collections |
| **Playlists** | User playlists + set drafts |
| **Browser** | Watched folders (file tree) |
| **Flash / USB** | Mounted drives, export targets |
| **Sets** | Preparation sets / Gig Ready candidates |
| **Skills** | Shortcut into Skills (mainly Preparation) |

Collapsible to icon rail for maximum content width.

### 3.2 Header

- View switcher (primary)
- Global search (Library-weighted; works in all views)
- Analysis / job status
- Theme (light/dark) + density
- Export / Gig Ready when a set is active
- Volume (hover) + Player visibility toggle

### 3.3 Flexible layout (Ableton Live–style)

The interface must feel **adjustable and flexible**, like Ableton Live: panels resize, collapse, and reflow without a rigid fixed chrome.

**Resizable splits**

- Drag vertical splitters: left nav width, inspector/Skills width (Preparation), insights width (Auto Performance)
- Drag horizontal splitters: player height (Mini ↔ intermediate ↔ Full), filter panel height if docked
- Double-click splitter → reset that pane to default size
- Minimum sizes enforced so content never becomes unusable

**Collapsible regions**

| Region | Behavior |
|--------|----------|
| Left nav | Expand / collapse to icon rail (or fully hide) |
| Filter bar / panel | Collapse to a single “Filters” chip row |
| Inspector / Skills (Preparation) | Collapse to a tab or icon strip on the right |
| Player | Mini / Full / hidden (player toggle in header) |
| Set insights (Auto Performance) | Collapse to free queue width |

**Layout presets (optional but recommended)**

- **Library focus** — wide table, Mini player, nav icons
- **Prep focus** — set list + wide waveform (Full player) + Skills open
- **Browser focus** — wide folder tree + table
- User can **save custom layout** (pane sizes + collapsed state) per view

**Ableton-like interaction details**

- Splitter hit area slightly larger than the visible line (easy grab)
- While dragging, live resize (no laggy ghost-only preview if performance allows)
- Panels keep internal scroll; only the pane chrome resizes
- No overlapping floating windows required for MVP; docking + collapse is enough
- Cursor feedback: `col-resize` / `row-resize` on splitters
- Persist layout per view + per user (restore on next launch)

**Density**

- Same ~85% professional density as before; flexibility must not add empty padding
- “Comfortable” vs “Compact” density toggle still applies inside panes

This keeps the app feeling like a serious desktop instrument (Ableton, rekordbox, DaVinci), not a fixed consumer layout.

---

## 4. Player (shared, behavior per view)

Unchanged principles from v1.0, with view-aware defaults:

| | Library | Preparation | Auto Performance |
|--|---------|-------------|------------------|
| Default size | **Mini** | **Full** (or last used) | **Mini / compact Full** |
| Hot cues | Available | Primary | Visible read-only or light edit |
| Grid / beat jump | On demand | Always in Full | Hidden or minimal |
| Queue | Optional | = current set | = Auto queue |
| Auto-advance | Off | Off | **On** (core of view) |

**Mini vs Full** (all views)

- **Mini:** identity + compact waveform + transport + cue strip + expand
- **Full:** detailed waveform + **full-track waveform map** under it + extended controls
- Play button **toggles to Pause** while playing
- Player slides from under the header

### 4.1 Waveform display & playhead

Waveform is a first-class preview surface for analysis, cues, and set validation — not a decorative progress bar.

**Two layers (Full player)**

```
┌─ Detailed waveform (zoomable) ─────────────────────────────────────────┐
│  ▁▂▃▅▇█▇▅▃▂▁  beat grid  ·  phrases  ·  cue markers  ·  PLAYHEAD      │
└────────────────────────────────────────────────────────────────────────┘
┌─ Overview map (full track) ────────────────────────────────────────────┐
│  ▁▂▃▅█▇▅▃▂▁▂▃▅▇█ … entire track …     [visible zoom region]  PLAYHEAD │
└────────────────────────────────────────────────────────────────────────┘
```

**Mini player**

- Single compact waveform strip (full-track overview style)
- Same playhead behavior, reduced height
- Click/drag to seek

**Playhead**

- Vertical line, high contrast (accent color), always visible when a track is loaded
- Moves in real time during playback
- **Click** anywhere on detailed or overview waveform → seek playhead to that position
- **Drag** playhead (or scrub on waveform) → continuous seek; audio previews while dragging when performance allows
- On overview map: playhead shows absolute position in the whole track
- On detailed waveform: playhead stays in view while playing (auto-scroll optional preference: *follow playhead* on/off)
- Snapping: optional snap seek to beat / bar / cue when grid snap is enabled

**Waveform content**

| Element | Display |
|---------|---------|
| Amplitude waveform | Teal/cyan (or theme accent) filled or mirrored bars |
| Beat grid | Vertical lines at beat/bar intervals when analyzed |
| Phrase regions | Subtle background bands or markers (intro / verse / drop / outro) |
| Hot cues | Colored markers + letters (A–H) on both detailed and overview |
| Memory cues | Secondary markers if present |
| Playhead | Accent vertical line + optional small time tooltip on hover |
| In/out or loop (if any) | Region shading |

**Interaction**

- Scroll wheel / pinch on detailed waveform → **zoom** in/out (time axis)
- Overview map: drag the highlighted region to move the zoom window; drag edges to resize zoom range
- **Fit** button → show entire track in detailed view
- Double-click overview → jump playhead and center detailed view
- Keyboard: arrow keys nudge playhead by beat/bar when waveform focused; Home/End → start/end

**Performance & states**

- Waveform generated from local analysis or lightweight decode peak data (never blocks UI)
- Loading: skeleton / pulsing placeholder until peaks ready
- No track loaded: empty state with short hint (“Select a track to preview”)
- Dark and light themes: playhead and cues stay WCAG-visible against waveform

**Hot cues — CDJ-3000 style**

Single row: `[ A ] [ B ] [ C ] [ D ] [ E ] [ F ] [ G ] [ H ]`  
Equal width, times when set, empty = letter + dashed border.  
Clicking a set cue moves the **playhead** to that position (and optionally starts playback).

**Extended controls (mainly Preparation / Full)**

Transport · Hot cues · Grid (snap, nudge, BPM fine) · Beat jump · Zoom / Fit  
Beat jump moves the **playhead** by N beats; grid nudge updates grid lines on the waveform immediately.

---

## 5. Typography, Icons & Color

### 5.1 Professional typography

Use a clean, highly legible **UI sans** for the whole app, plus a tabular/mono face for numeric columns (BPM, time, key codes).

| Role | Recommended family | Fallback stack | Notes |
|------|--------------------|----------------|-------|
| **UI / labels** | **Inter** | `Inter, "Segoe UI", system-ui, sans-serif` | Default for pro desktop tools; excellent at 12–13px |
| **Alternative UI** | **IBM Plex Sans** or **Geist Sans** | Same system fallbacks | Slightly more “instrument” character |
| **Numeric / data** | **Inter Tabular** or **IBM Plex Mono** / **JetBrains Mono** | `ui-monospace, monospace` | BPM, duration, key, timecode — tabular figures so columns align |
| **Waveform time** | Same mono | | Playhead tooltip, cue times |

**Type scale (compact / ~85% density)**

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `text.xs` | 11px | 400/500 | Meta, column headers, cue times |
| `text.sm` | 12px | 400/500 | Table cells, secondary labels |
| `text.md` | 13px | 500/600 | Primary UI, track titles in lists |
| `text.lg` | 15–16px | 600 | Player title, section titles |
| `text.xl` | 18–20px | 600 | Rare (empty states, onboarding) |

- Line-height: 1.25–1.4 for UI; tighter in tables  
- No decorative display fonts  
- Font rendering: enable antialiasing; respect OS font smoothing  

### 5.2 Professional icon library

**Primary icon set:** **Lucide** (or **Phosphor** / **Tabler Icons** as alternates)

Why: consistent 24×24 grid, open license, familiar in pro tools (Linear, Raycast, many Electron/Tauri apps), works at 16–18px UI size.

**Rules**

- Default display size: **16px** in tables/toolbars, **18px** in nav, **20px** for primary transport  
- Stroke icons (1.5–2px optical), not heavy filled consumer style  
- Color: `text.secondary` by default; `text.primary` or `accent` when active  
- Always pair icon + label in left nav when expanded; **icon-only** when collapsed to rail  
- Tooltip required on icon-only controls  

### 5.3 Panel & view icons (show / hide / navigate)

Use consistent icons so users can show, hide, and switch panels at a glance.

**Top-level views (header switcher)**

| View | Icon (Lucide name) | Meaning |
|------|--------------------|---------|
| Library | `library` or `disc-3` | Music library management |
| Preparation | `list-music` or `layers` | Set / playlist prep |
| Auto Performance | `play-circle` or `gallery-horizontal-end` | Auto set preview |

**Left nav / sources**

| Panel | Icon | |
|-------|------|--|
| Library (all tracks) | `library` | |
| Playlists | `list-music` | |
| Browser (folders) | `folder-tree` | |
| Flash / USB | `usb` or `hard-drive` | |
| Sets | `layers` | |
| Skills | `sparkles` or `wand-2` | |

**Chrome & panels (show / view / collapse)**

| Control | Icon | |
|---------|------|--|
| Collapse / expand left nav | `panel-left` / `panel-left-close` | |
| Inspector / Skills panel | `panel-right` / `panel-right-close` | |
| Filters | `list-filter` or `sliders-horizontal` | |
| Columns (show/hide) | `columns-3` | |
| Search | `search` | |
| Player show/hide | `panel-bottom` or `audio-lines` | |
| Mini ↔ Full player | `chevrons-up-down` or `maximize-2` | |
| Layout preset | `layout-dashboard` | |
| Settings | `settings` | |
| Theme light/dark | `sun` / `moon` | |

**Transport & analysis**

| Control | Icon | |
|---------|------|--|
| Play | `play` | |
| Pause | `pause` | |
| Stop | `square` | |
| Cue | `flag` or text **CUE** | |
| Beat jump | `chevrons-left` / `chevrons-right` | |
| Grid | `grid-3x3` | |
| Zoom in/out | `zoom-in` / `zoom-out` | |
| Fit waveform | `scan` or `fullscreen` | |
| Analyze | `waveform` or `activity` | |
| Export | `upload` or `file-output` | |

**Track / status**

| Meaning | Icon |
|---------|------|
| Analyzed OK | `check-circle` (muted success) |
| Missing analysis | `circle-dashed` or `alert-circle` |
| Has cues | `flag` |
| Playing row | `volume-2` or bar glyph |
| Compatible key | color pill (not only icon) |

**Implementation notes**

- Prefer **one** icon pack app-wide (Lucide recommended) — no mixing styles  
- Tree-shake / import only used icons  
- Nav items: icon left of label; active state = accent icon + accent bar  
- Collapsed rail: centered icons, tooltip with full name on hover  
- Panel “show/hide” toggles use `panel-*` icons so the action is obvious  

### 5.4 Density & color (summary)

**Density (~85% feel)**  
12–13px UI text, 28–32px rows, 36–40px header, tight 8–12px gaps. Professional desktop, not consumer streaming.

**Dark (default) & Light**  
Pro PC palettes (Ableton / rekordbox / VS Code style). No pure black/white slabs; teal/cyan waveform accent; distinct cue colors; icons inherit text tokens above.

---

## 6. Navigation between views (UX flow)

Typical path:

1. **Library** — import, analyze, clean tags, organize  
2. **Preparation** — build set, cues, sequence, Skills  
3. **Auto Performance** — listen through, validate, flag issues  
4. Back to **Preparation** if fixes needed → Export  

Switching views does not destroy state: current set, selection, and player track are preserved where it makes sense.

---

## 7. Explicit non-goals (UI must not imply)

- Live dual-deck mixing, EQ, effects racks, or beat-matched live performance
- “DJ software” positioning in titles, onboarding, or Auto Performance chrome
- Cloud upload of audio for analysis
- Irreversible bulk actions without undo

---

## 8. Application menus (desktop)

Native-style menu bar (Tauri / OS integration on macOS; app menu bar on Windows/Linux). Every important action reachable without hunting in panels.

### 8.1 Menu structure

**File**
- Add folder to library…
- Import playlist / crate…
- Export set… (rekordbox XML, Serato crate, USB pack)
- Export selected tracks…
- Gig Ready…
- Preferences / Settings… (`Ctrl/Cmd+,`)
- Quit

**Edit**
- Undo / Redo (all reversible Skills, tags, cues, grid)
- Cut / Copy / Paste (playlist order, tags where safe)
- Select all / Deselect
- Find… (`Ctrl/Cmd+F`)

**View**
- Library / Preparation / Auto Performance
- Toggle left nav · Toggle inspector · Toggle player
- Mini player / Full player
- Density: Compact / Comfortable
- Theme: Dark / Light / System
- Layout presets → Library focus · Prep focus · Browser focus · Reset layout

**Library**
- Analyze selected / Analyze all pending
- Smart Tag Cleanup…
- Create playlist / smart collection
- Rescan folders
- Library health / missing analysis

**Set** (active in Preparation)
- New set · Open set · Duplicate set
- Run Set Architect / Energy Cartographer…
- Validate set (jump to Auto Performance)
- Export…

**Tools**
- Skills gallery (enable/disable)
- Cue Master · Tag Surgeon · …
- Batch operations…
- Keyboard shortcuts reference

**Help**
- Documentation
- Keyboard shortcuts
- Check for updates
- About DJ Assistant

Menus show **keyboard shortcuts** on the right; destructive items separated; OS-standard roles (Quit, Preferences, Hide) respected on macOS.

---

## 9. Settings screens

Settings open as a **dedicated window or full modal page** (not a tiny popover). Left category list + right content — standard pro-app pattern (VS Code, Ableton Preferences, rekordbox).

### 9.1 Categories

| Category | Contents |
|----------|----------|
| **General** | Language, startup view, density default, confirm before quit |
| **Library** | Watched folders, auto-analyze on add, duplicate policy, file types |
| **Analysis** | BPM/key engines, Camelot vs classical, energy model, re-analyze policy |
| **Cues & Grid** | Default hot-cue count/colors, snap defaults, phrase detection sensitivity |
| **Playback** | Output device, latency buffer, auto-play on select, follow playhead |
| **Export** | Default format (rekordbox/Serato), USB structure, filename template |
| **Skills & Automation** | Enable/disable Skills, confirm before bulk apply, undo history size |
| **Appearance** | Theme, accent color, waveform colors, key color strict/wide |
| **Keyboard** | Shortcut editor (searchable list, conflict detection) |
| **Privacy** | Local-only analysis reminder, optional cloud features opt-in, crash reports |
| **Advanced** | Cache location, log level, ONNX threads, reset layout / reset all settings |

### 9.2 Settings UX rules

- Search box at top of settings (“Search settings”)
- Changes apply immediately where safe; **Apply** only for restart-required items
- Each section: short description + controls; link “Learn more” to docs
- Dangerous actions (reset library index, clear cache) require confirm dialog
- Settings persisted locally; export/import settings file optional (P1)

---

## 10. Dialogs, popups & overlays

### 10.1 Types

| Type | Use | Behavior |
|------|-----|----------|
| **Modal dialog** | Confirm destructive action, export options, tag cleanup review | Centered, dimmed backdrop, focus trap, Esc cancels |
| **Sheet / drawer** | Filters (optional), Skills detail, batch results | Slides from edge; does not block entire app if possible |
| **Popover** | Column picker, layout preset, volume, small menus | Anchored to control; click outside closes |
| **Toast / snackbar** | Success, undo offer, non-blocking errors | Bottom or top; auto-dismiss; action button (Undo) |
| **Command palette** | `Ctrl/Cmd+K` — jump to view, run Skill, open set, search settings | Centered, fuzzy search, keyboard-only friendly |
| **Context menu** | Right-click track / column / cue | Native-feel list; icons + shortcuts |

### 10.2 Dialog content patterns

- **Title** (clear verb) · short body · primary + secondary buttons  
- Primary button right (or OS convention); destructive primary = danger color  
- Never only icons for confirm/cancel — always labels  
- Long operations (analyze 200 tracks): progress dialog with **cancel** and live count  
- Tag cleanup / bulk cue: **review list** before apply + always Undo after  

### 10.3 Popup polish

- Consistent padding (16–20px), radius (8–10px), border + soft shadow  
- No giant empty modals; size to content with max-width  
- Stacking: only one modal at a time; toasts above everything  
- Mobile-unrelated: this is desktop-first; no bottom-sheet-only mobile patterns  

---

## 11. Motion & animation

Motion should feel like **pro tools** (Ableton, Linear, VS Code): fast, subtle, purposeful — never bouncy consumer “delight.”

| Interaction | Motion |
|-------------|--------|
| View switch (Library ↔ Prep ↔ Auto) | Cross-fade or short content fade 120–180ms |
| Player Mini ↔ Full | Height spring/ease 200–280ms; waveform reflow after |
| Panel collapse / expand | Width/height ease 150–200ms |
| Modal open/close | Fade + slight scale 150ms; backdrop fade |
| Toast in/out | Slide + fade 150ms |
| Row hover | Instant or ≤80ms background |
| Playhead | Continuous RAF; no easing lag behind audio |
| List virtualization | No animation on scroll; only on insert/remove if needed |
| Progress bars | Smooth determinate; indeterminate pulse subtle |

**Rules**

- Respect **prefers-reduced-motion**: replace with instant cuts / fades only  
- No animation longer than ~300ms for UI chrome  
- Never animate layout in a way that makes clicking unreliable  
- Easing: `ease-out` or standard CSS `--ease-out-cubic`; avoid elastic bounce  

---

## 12. Screen-by-screen polish

### 12.1 Library

- Sticky header row; zebra or hairline separators (prefer hairline for density)
- Empty library: single clear CTA (“Add music folder”) + short benefit line
- Multi-select: checkbox column optional; bulk bar appears with count + actions
- Status column: quiet icons, not loud badges
- Harmonic pills: consistent width so columns don’t jump

### 12.2 Preparation

- Set name editable inline; dirty state indicator if unsaved export state
- Drag handles on set rows; drop gap highlight while dragging
- Skills panel: each Skill card = name, one-line effect, Run, last result, Undo
- Constraint chips for set builder visible and editable
- Export / Gig Ready as primary buttons in header when set is valid enough

### 12.3 Auto Performance

- Large now-playing identity; AUTO badge clearly on/off
- Queue row = current highlight; past tracks slightly muted
- Insights: energy curve sparkline + key path; warnings as list with “Fix in Preparation”
- No mixer-looking chrome

### 12.4 Shared empty & error states

- Empty: icon + one sentence + one primary action  
- Error: what failed + what to do (retry / open folder / skip)  
- Offline: banner only if a cloud feature was requested; core app works offline  

### 12.5 First-run / onboarding (short)

- 2–3 steps max: add folder → wait for analysis sample → open Preparation  
- Skip always available; never a long carousel  
- Optional “Load demo set” for evaluation without a library  

---

## 13. Modern UX suggestions (professional DJ focus)

Aimed at club, festival, mobile, wedding, and B2B DJs who prep weekly.

1. **Command palette (`Ctrl/Cmd+K`)** — fastest way to open sets, run Skills, jump views (Linear/VS Code pattern).
2. **Undo everything** — toast with Undo after bulk tag, cue gen, reorder; Edit → Undo history.
3. **Gig Ready checklist** — pre-export gate: missing cues, unanalyzed tracks, key clashes; one click to jump to each issue.
4. **Smart collections** — “Unanalyzed”, “No cues”, “Added this week”, “Compatible with playing track”.
5. **Keyboard-first prep** — space play/pause, numbers 1–8 hot cues, arrows nudge, `A` analyze selection.
6. **Multi-library / USB context** — clear indicator when browsing Flash vs main library so export targets stay obvious.
7. **Comparison / duplicate assistant** — when importing, show likely duplicates by hash/duration/BPM (non-destructive).
8. **Set templates** — “Warm-up 60m”, “Peak 45m”, “B2B alternate” as starting structures in Preparation.
9. **Quiet confidence UI** — status and analysis health visible but calm; no gamification, no social feeds.
10. **Accessibility** — focus rings, screen-reader labels on transport/cues, high-contrast playhead option, reduced motion.
11. **Session restore** — reopen last view, last set, player state (track + playhead optional).
12. **Export preview** — before writing USB/XML, show file tree / track list that will be written.

---

## 14. Implementation priority (updated)

1. Shell + view switcher + menus + command palette  
2. Library (table, search, filters, columns, harmonic keys, Mini player)  
3. Player Full + dual waveform + playhead + hot cues + grid/beat jump  
4. Preparation (set list, Skills, export entry points)  
5. Auto Performance (queue, auto-advance, insights)  
6. Settings window (all categories)  
7. Dialogs, toasts, context menus, animations  
8. Themes, density, layout presets, session restore  
9. Onboarding + Gig Ready checklist + smart collections  

---

## 15. Success criteria (updated)

- Professional DJs can manage library, prepare sets, and validate with Auto Performance without leaving the app  
- Menus + shortcuts cover primary workflows; Settings is complete and searchable  
- Motion is fast and calm; dialogs are clear and reversible  
- Harmonic coloring, search, filters, and custom columns support real prep speed  
- UI never implies live DJ performance software  
- Feels at home next to Ableton, rekordbox, and Serato as a **prep** companion  

---

## 16. Final design language — Adobe × Ableton × 2026

This section is the **last polish pass**: visual system and interaction rules inspired by **Adobe** (precision, panels, workspaces) and **Ableton Live** (flexibility), expressed as a **2026 professional desktop** product.

### 16.1 Design intent

| Source | What we take |
|--------|----------------|
| **Adobe** (Photoshop, Premiere, Audition) | Docked panels, workspace presets, dense toolbars, precise numeric fields, calm dark surfaces, strong hierarchy, options bars |
| **Ableton Live** | Fully resizable splits, collapse-to-minimum, session-like view switching, color as information, minimal chrome when focused |
| **2026 pro apps** | Refined depth (not flat, not glassy), variable-friendly type, restrained motion, excellent focus states, searchable everything, command palette |

**Result:** A prep studio that feels as serious as Adobe Creative Cloud tools and as malleable as Ableton — not a consumer music player and not a club performance deck.

### 16.2 Surface & depth system (Adobe-like)

Layered surfaces instead of one flat gray:

| Level | Role | Dark (approx) | Light (approx) |
|-------|------|----------------|----------------|
| L0 App | Window background | `#0E0F12` | `#F0F1F3` |
| L1 Panel | Nav, player chrome, side panels | `#16181D` | `#FFFFFF` |
| L2 Elevated | Active header, selected row, cards | `#1C1F26` | `#FFFFFF` + soft shadow |
| L3 Overlay | Menus, popovers, dialogs | `#22262F` | `#FFFFFF` + stronger shadow |
| Hairline | Borders / splitters | `#2A2F3A` @ 1px | `#E4E6EB` @ 1px |

- Prefer **hairline borders + slight elevation** over heavy shadows  
- Splitters: 1px line, **4–6px hit target** (Ableton-style grab)  
- Selected row: left **3px accent bar** + subtle fill (Adobe layers panel feel)  
- No skeuomorphism; no neon; accent used sparingly (playhead, primary button, active view)

### 16.3 Radius, spacing, controls (2026 compact)

| Token | Value | Use |
|-------|-------|-----|
| Radius control | 6px | Buttons, inputs, key pills |
| Radius panel | 0–8px | Panels flush in docks; 8px for floating dialogs |
| Radius menu | 8px | Context menus, popovers |
| Space xs–lg | 4 / 8 / 12 / 16 / 24 | Tight Ableton density; avoid 32px+ empty gaps |
| Control height | 28px default, 32px touch-critical | Toolbars, table actions |
| Icon | 16px UI / 18px nav | Lucide stroke |

Inputs: quiet border at rest, accent border on focus, no thick outlines. Numeric fields (BPM, zoom) support drag-to-scrub like Adobe.

### 16.4 Workspaces (Adobe) + flexible docks (Ableton)

**Named workspaces** (View menu + preset switcher):

1. **Library** — max table, Mini player, filters ready  
2. **Prepare** — set list + Full player + Skills dock  
3. **Validate** — Auto Performance queue + insights  
4. **Reset** — factory pane sizes  

Users can resize freely (Ableton); **Save Workspace…** stores current splits + collapsed state (Adobe). Switching workspace animates pane sizes once (≤200ms), then settles.

Panel behaviors:

- Drag edge to resize  
- Double-click edge → default size  
- Collapse control on each dock (icon remains in a thin strip)  
- Player dock: Mini / Full / Hidden — same as Adobe’s “panel on demand”

### 16.5 Options bar (Adobe-inspired)

Below the header, a **context options bar** (~32px) that changes by view:

- **Library:** search · filter chips · columns · analyze · add to set  
- **Preparation:** set name · template · Skills shortcuts · export / Gig Ready  
- **Auto Performance:** set selector · AUTO toggle · skip · flag issue  

This avoids burying actions only in menus while keeping the main canvas clean.

### 16.6 Color & accent (trendy but pro)

- Default accent: refined **teal-cyan** for waveform + primary actions (distinct from Adobe blue and Ableton yellow — own identity)  
- Optional accent override in Appearance settings (for brand/personalization)  
- Semantic: success muted green, warning amber, danger red — never rainbow UI  
- Key compatibility colors: controlled palette on pills only, not full-row noise  
- Waveform: single accent family + grid at low opacity; phrases as soft bands  

### 16.7 Typography finish

- Inter for UI; tabular nums for BPM/time/key  
- Column headers: 11px medium, uppercase optional **or** title case — pick one app-wide (recommend **title case**, less Adobe-legacy shouting)  
- Player title: 15–16px semibold; artist secondary  
- Avoid mixed font families beyond UI + mono  

### 16.8 Motion finish (2026 restraint)

- Workspace switch: coordinated pane resize + content fade  
- No parallax, no blur-heavy acrylic on every surface (optional light blur only on modal backdrop)  
- Micro-feedback: button press scale 0.98 / 80ms; toggle state instant color  
- Analysis progress: determinate bar in options bar or status; no full-screen spinners when possible  

### 16.9 Interaction details borrowed from both

| Pattern | From | In DJ Assistant |
|---------|------|-----------------|
| Workspace presets | Adobe | Library / Prepare / Validate / custom |
| Docked resizable panels | Both | Nav, inspector, player, insights |
| Scrubbable numeric fields | Adobe | BPM fine, zoom, energy |
| Color as structure | Ableton | Key pills, cue colors, set energy |
| Session-like modes | Ableton | Three top-level views |
| Options bar | Adobe | Context actions under header |
| Command palette | 2026 | Ctrl/Cmd+K everywhere |
| Undo toast | 2026 | After every bulk Skill / tag / cue |

### 16.10 What “trendy 2026” deliberately avoids

- Glassmorphism everywhere  
- Oversized rounded consumer cards  
- Social / story / feed layouts  
- Gamified streaks or badges  
- Live DJ deck skeuomorphism (vinyl, LED walls)  
- Low-contrast gray-on-gray that fails accessibility  

### 16.11 One-line product UI statement

> **DJ Assistant looks like a 2026 Adobe-class studio tool, flexes like Ableton, and stays ruthlessly focused on library management, playlist creation, and set preparation for professional DJs.**

---

## 17. Implementation priority (final)

1. Design tokens (surfaces L0–L3, radius, space, type, accent)  
2. Shell + menus + options bar + workspaces  
3. Library + search/filters/columns + harmonic keys  
4. Player Mini/Full + waveform + playhead + cues  
5. Preparation + Skills dock + export  
6. Auto Performance  
7. Settings + dialogs + toasts + command palette  
8. Motion + session restore + onboarding + Gig Ready  

---

*Document history: v1.0–v1.6 iterative product UI → **v1.7 final polish**: Adobe precision panels & workspaces × Ableton flexible docks × 2026 pro-app trends.*
