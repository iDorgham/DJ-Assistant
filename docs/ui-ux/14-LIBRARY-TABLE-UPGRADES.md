# 14 - Library table upgrades (proposal)

**Version:** 0.2 - **Date:** 2026-11-19 - **Status:** Proposal, not approved. Section 0.1 lists the parts that already shipped in the 2026-11-19 pass; everything else is unimplemented.  
**Amends:** [03-LIBRARY-VIEW.md](03-LIBRARY-VIEW.md) section 3 and section 5 once accepted  
**Scope:** Library track table only. Player, playlists, and import flows are untouched.

This document turns a raw wish-list into a buildable design. Each item states the
problem, the proposed behaviour, the cost, and what would make it wrong. The intent
is to protect the two things this table already does well - **density** and
**honest counts** - while making it faster to find a track, quicker to tag one, and
easier to read at a glance.

---

## 0.1 Shipped in the 2026-11-19 pass

This document is still a proposal, but four of its items are now done, and one
defect it reports is fixed:

| Item | State |
|---|---|
| Label is never read (section 6) | **Fixed.** `crates/core/src/metadata.rs` extracts `TPUB` / `LABEL` / `PUBLISHER` / `ORGANIZATION`, `scanner.rs` stores it, and `tracks.label_user_set` records that the user typed or cleared the value. The backfill for existing libraries and label search are still to do. |
| Default column order (section 5) | **Partly done.** `status` is now the second column, immediately after `#`, and renders as an icon only: the header keeps the word, and the cell keeps its label in the tooltip and `aria-label`. Color, waveform and the rest of section 5.1 are still proposed. |
| Header drag-to-reorder | **Fixed.** HTML5 drag and drop never fired because Tauri's `dragDropEnabled` was on, which makes WebView2 intercept the drag. The config now sets it to `false`, and both the column picker and the table headers ship `dataTransfer` payloads. |
| Comment 2 | **Shipped ahead of this document.** `tracks.comment_2` is imported from `TXXX:COMMENT 2` and the Vorbis `COMMENT 2` field, and it is editable in the metadata editor and the Tags tab. The rest of the import-time fields (composer, ISRC, catalog number and so on) follow the same rule: a real tag source, or no column. |

The remaining items - density, waveform, color, column filters, view styles and
the Tag Manager - are unchanged: proposed, not approved, not implemented.

---

## 0. The asks, translated

| Raw ask | Refined feature | Kind |
|---|---|---|
| Adjustable row height | **Density control** with presets + drag, persisted per view | UI |
| Waveform in the table | **Waveform column** fed by cached overview peaks, never live decode | Data + UI |
| Move color next to `#` | **Track color** (new field) as a swatch beside the row number | Data + UI |
| Tags before comment | Column order change, plus Tags on by default | UI |
| Label in my file tags is invisible | **Import bug**: label is never read. Fix + backfill + truth in the panel | Defect |
| Search icon in cells like Traktor | **Column filters** row, server-side, honest with paging | Data + UI |
| Two or more view styles | **Table / List / Grid** views sharing one query state | UI |
| Tag manager for fast tagging | **Tag Manager drawer** with quick-assign, rename, merge | UI + write path |

Seven of the eight are features. **The label one is a bug** and should not wait for
the redesign.

---

## 1. Design principles for this round

1. **Density is the product.** Every addition must earn its pixels. A control that
   is always visible must be worth ~40 px on every row.
2. **Never filter only what is loaded.** The table pages (200 + 500). Any filter
   that runs in the renderer will lie about a 30,000-track library. Column filters
   go through `list_tracks`, like the existing filters do.
3. **One query state, three presentations.** Switching Table, List, or Grid must
   never reset search, filters, sort, or selection. Scroll position is per view.
4. **A hidden preference must be visible in the UI.** If a column filter, a density,
   or a tag filter is active, the toolbar says so.
5. **Every write is reversible.** Color, tags, and label use the existing
   `skill_runs` snapshot path and the Undo toast. No new silent writers.
6. **File tags are not my tags.** Genre, label, and year come from the file; custom
   tags belong to the user. The UI must name them differently everywhere.
7. **No per-row drag targets.** Virtualization needs one exact row pitch. Density
   is a table-level control, not a per-row handle.

---

## 2. Density (adjustable row height)

### 2.1 Behaviour

- Presets in the options bar / columns menu: **Compact 28 - Default 36 -
  Comfortable 44 - Artwork 56**. Each is a *minimum*; a cell that needs more
  (artwork, waveform) raises the pitch automatically, exactly as
  `rowHeightForColumns()` does today.
- Free range 28-72 px via a small **row-height slider** in the View menu, or by
  dragging the bottom edge of the table (the splitter that already separates the
  table from the player dock).
- Persisted per view in `localStorage` with the column layout (`columns.v3` payload
  or a sibling `table.v2` key).
- Changing density keeps the **top visible track anchored** - the user must not
  lose their place when the table re-pitches.
- Keyboard: menu items are radio items; no bare drag-only control.
- At 200 % OS zoom the pitch is recomputed from the root font size, not hard-coded
  to 36 px.

### 2.2 What it must not break

- Spacer arithmetic in `virtual-window.ts` assumes a constant pitch. A variable
  per-row height would break `topPadding` and `bottomPadding`; that is why density
  is uniform.
- Row separators are inset cell shadows, not borders - keep that, or the 30k-row
  math drifts by one pixel per row.

**Touchpoints:** `lib/virtual-window.ts`, `lib/ui-state.ts`, `App.tsx`,
`components/ColumnPicker.tsx`. **Effort:** S (~1 day).

---

## 3. Waveform column

### 3.1 Value

A DJ recognises a track by its shape faster than by its title: long intro, early
breakdown, short outro. A 160 x row-height strip answers "is this the version I
mean?" without loading the player.

### 3.2 Behaviour

- Default **Off**. When on, the row pitch becomes at least 48 px.
- Renders one static, non-interactive strip per row from the **cached overview
  peaks** (`get_waveform_peaks` already writes them under `<appdata>/peaks`).
- **No audio decode during scroll.** A new batch command returns a downsampled
  strip (~96 buckets) for the visible row ids in one IPC call. Cache in the
  renderer keyed by `track id + analysis version`; invalidate when a track is
  re-analysed.
- Unanalysed or failed track: a muted baseline with a tooltip ("Not analysed -
  run Analyze"), never a synthesised shape.
- Colour: `accent` fill at low opacity on the row ground; no grid, no playhead, no
  cue ticks at this size. Cue ticks are a later enhancement only if the strip is
  >= 40 px tall.
- Clicking the strip does nothing. The row click and double-click behaviour wins;
  a 160 px play button inside a row is a mis-click factory.

### 3.3 Cost and risk

The expensive part is the data path, not the drawing: decode is already cached, but
there is no batch read and no version key on `TrackSummary`. Budget **~20 KB per
visible page**, one IPC per page, and no frame drops while scrolling.

**Touchpoints:** `commands.rs` (batch peaks), `packages/shared`, `api.ts`,
`lib/library-columns.ts`, `App.tsx`, new `components/RowWaveform.tsx`.
**Effort:** M (3-4 days). **Do after Phase 0**; it is the riskiest item.

---

## 4. Track color (the `Color` column becomes real)

Today `color` is a placeholder that always renders the em dash. "Move it next to
`#`" is therefore a new feature, not a reorder.

### 4.1 Model

- New migration: `tracks.color TEXT NULL`, holding a **palette id**, not a hex
  value: `red - orange - yellow - green - cyan - blue - purple - magenta`.
- Palette resolves against the theme from one table in `lib/track-color.ts`
  (Carbon values, 4.5:1 on the row ground for the dot border; colour alone never
  carries meaning - always paired with a filter chip label).
- `null` means no colour. Clearing writes `NULL`.

### 4.2 Surface

- A narrow **Color column (40 px) directly after `#`**, default **On**. The cell is
  a 10 px dot; hover reveals a pencil ring.
- Click opens an 8-swatch popover plus "No color"; keyboard arrows + Enter; Esc
  closes.
- Multi-select applies the same colour to every selected row as **one** reversible
  write (Undo toast: "Color set on 12 tracks").
- A 2 px left rail on the row when a colour is set, matching the existing
  inspected-row marker language without competing with the accent selection fill.
- Filter: "Color" group in the Filters panel (multi-select) and a chip in the
  summary bar. Sorting by color is **not** proposed.

### 4.3 Why a palette id

Storing a hex value would freeze a theme decision into user data and duplicate the
design tokens. An id survives a palette revision.

**Touchpoints:** migration `010_track_color.sql`, `models.rs`, scanner default,
`library_query.rs` filter, `library-columns.ts`, new `TrackColorSwatch.tsx`,
`App.tsx`, filter panel. **Effort:** S-M (~2 days including undo + filter).

---

## 5. Column order and defaults

### 5.1 Proposed default order

`# - Status - Color - Art - Waveform - Title - Artist - Album - Genre - BPM - Key -
Energy - Rating - Time - Label - Year - LUFS - Cues - Tags - Comment - Path - Size -
Format - Fingerprint`

Changes: Status stays second, right after `#`, as shipped on 2026-11-19; Color
after Status; Waveform after Art; Tags immediately before Comment.

### 5.2 Proposed default visibility changes

| Column | Today | Proposed | Why |
|---|---|---|---|
| Color | Off | **On** | The feature is only useful at a glance; the column is 40 px. |
| Label | Off | **On** | The primary complaint. Labels organise a DJ library. |
| Tags | Off | **On** | Fast tag scanning is the point of the Tag Manager. |
| Album | On | **On (kept)** unless width is a problem | Not a silent change; see decision D-3. |

Width budget: the default set above is ~1600 px. That fits a 1920-wide window with
the expanded nav, and does **not** fit 1440. Either Album or Status should become
Off on narrow windows - propose the table hides the lowest-priority visible column
via a responsive rule rather than changing the stored preference (D-3).

### 5.3 Header typography

`docs/ui-ux/01` section 5 says "Title case for headers - never all-caps"; the table
ships all-caps headers today. This proposal keeps the current treatment for now and
records the contradiction rather than mixing a typographic change into a density
change (D-4).

**Effort:** XS (order + defaults + tests).

---

## 6. Label is a defect, not a feature

### 6.1 Root cause (before the table-upgrades pass)

This is the pre-pass root cause, kept for the record. Extraction and storage of
label have shipped (see section 0.1). The remaining work is backfilling rows
imported before the change, and search.

`crates/core/src/metadata.rs` extracted title, artist, album, genre, year, BPM, key,
rating, comment, and artwork - **never label**. `scanner.rs` therefore writes
`label: None`, and `models.rs` documents the consequence honestly: "the file tag
extractor has no label source". The column exists, the editor can type into it,
but an imported `LABEL` or `TPUB` tag is discarded.

### 6.2 Fix

1. Extend `ExtractedMetadata` with `label: Option<String>` and read, per container:
   - **ID3 (mp3/wav/aiff):** `TPUB`, then `TXXX:LABEL`, `TXXX:PUBLISHER`,
     `TXXX:ORGANIZATION`.
   - **Vorbis (flac):** `LABEL`, `PUBLISHER`, `ORGANIZATION`.
   - **MP4/M4A:** publisher atom or freeform `LABEL` - verify what `audiotags`
     exposes before promising it.
   - Do **not** fall back to `TCOM` (composer) or `TCOP` (copyright); they are not
     labels and would poison the field.
2. Store it on insert in `scanner.rs`.
3. **Backfill existing libraries.** Read tags for rows where `label IS NULL` and the
   user has never edited the field, in bounded batches, cancellable, with one status
   line ("Recovered labels for 84 tracks"). Never touch a user-cleared label.
4. Provenance: add `tracks.label_user_set INTEGER NOT NULL DEFAULT 0`, set to 1 by
   any metadata write that touches `label`. Clearing the field writes `NULL` **and**
   the flag, so the next repair does not resurrect it. (This is the general
   provenance problem in miniature; do not generalise it yet.)
5. Make `label` searchable in the library search box and usable in column filters.
6. The Tags tab must say **"File tags"** for genre, label, and year, and **"My
   tags"** for custom tags. The Tag Manager only manages custom tags. This is where
   the confusion started.

### 6.3 Acceptance

- Import a file with `LABEL=Ninja Tune`: the Label column shows it without a manual
  edit.
- Existing library: labels appear after the repair, with no re-import.
- User clears a label: it stays cleared after restart and after a rescan.
- A file with no label shows the em dash, never a guessed value.

**Effort:** M (~2 days including tests and the backfill). **Do first.**

---

## 7. Column filters (the Traktor-like funnel)

### 7.1 What Traktor actually does

Each column header can open a small search field or funnel, and the result is a
filtered collection. The useful part is *per-field narrowing*, not "an input in
every cell". Copying the pixels without the semantics would put 20 tab stops in the
header and still filter only the loaded page.

### 7.2 Proposed behaviour

- A **funnel icon appears on header hover or focus** for filterable columns.
  Clicking toggles a single **filter row** directly under the header (not one row
  per column). The header shows a filled funnel while its filter is active.
- The filter row is a mode of the table, not a second header: one row, active cell
  highlighted, Tab walks active filters only.
- Filter types follow the column:
  - Text contains: Title, Artist, Album, Label, Genre, Comment, Path, Tag, Format.
  - Numeric range: BPM, Energy, Rating, Year, LUFS, Duration.
  - Multi-select: Key, Status, Format, Color, Tag.
- Library search and column filters combine with **AND**. Active filters appear in
  the existing summary chip bar with a remove button each, plus "Clear all".
- Debounce 250 ms; Enter applies immediately; Esc clears the focused input; a
  shortcut (Ctrl/Cmd+Shift+F) focuses the filter row.
- The status bar count is always the count the API returned. No optimistic client
  filtering.
- Filters survive a view switch (Table, List, Grid) and are **cleared on app
  restart** (a hidden filter that survives a restart is the classic "my library is
  empty" bug). The chip bar makes the current state visible either way.

### 7.3 Contract and safety

- `ListTracksFilters` grows an allow-listed `columnFilters` map, or explicit typed
  fields, translated to bound SQL in `library_query.rs`. Never build SQL from a
  column name supplied by the renderer without checking it against the allow-list.
- LIKE patterns keep the existing escape treatment for percent and underscore.
- No new indexes in v1. A leading-wildcard LIKE over 30k rows is a few
  milliseconds; measure before adding an index that writes on every import.

### 7.4 Why not filter in the renderer

The renderer holds only the loaded pages. A renderer-side filter would show "3
results" for a library that actually has 300. That is worse than no filter.

**Effort:** L (4-6 days: query builder + panel + keyboard + tests).

---

## 8. View styles: Table, List, Grid

Use the Windows vocabulary as **tooltips**, not labels:

| Our name | Windows analogue | Shape |
|---|---|---|
| **Table** | Details | Current table; all columns, headers, column filters, density control |
| **List** | Titles / Content | Two-line rows, 40 px artwork, title + artist, meta line; no header |
| **Grid** | Large icons | Artwork cards, 1:1 covers, title and artist, key and BPM badges |

```
Table (Details)
 #  Color  Art  Wave   Title                  Artist            BPM   Key   Time  Label        Tags
 1    *     []   ~~~~   Break (Extended Mix)   2FASS, ZALEON     127   10A   4:12  Indie Beats  [peak] [warm]
 2          []   ~~~~   Karasa (Original Mix)  ADAMARK           123   6m    3:48  In Music     [warm]

List (Titles)
 [art] Break (Extended Mix)                              127   10A   4:12
       2FASS, ZALEON - Indie Beats                     [peak]  [warm]

Grid (Large icons)
 [ cover ]   [ cover ]   [ cover ]
 Break       Karasa      Poca
 2FASS       ADAMARK     Abradan
 127 10A     123 6m      128 10m
```

The sketches are layout intent, not a pixel spec.

### 8.1 Shared rules

- A segmented control at the right of the options bar (icons + tooltips), not three
  tabs: this is a presentation of the library, not a navigation destination. The
  locked IA stays untouched.
- View mode persists per view. Search, filters, sort, and selection survive a
  switch. Scroll position is remembered per view.
- Every view supports the same row context menu, multi-select, Undo, and bulk bar.
- Empty, loading, and error states are shared, with copy that names the active
  filters.
- Keyboard: a single "cycle view" shortcut (Shift+V), not Ctrl+1..6 (already
  navigation).

### 8.2 List

- Row pitch 56 px (64 comfortable), 40 px artwork, two text lines.
- Line 1: title (13 px). Line 2: artist, BPM, key, time, with tags as up to two
  chips at the right. Label appears in the meta line when space allows.
- No header: sorting via a compact "Sort: Artist" dropdown in the options bar.
- All rows remain virtualized; the text must not reflow with hover.

### 8.3 Grid

- Card width 160-220 px depending on window width; artwork square; title two lines,
  then artist; badges for key and BPM; color dot in the corner.
- Selection is a check overlay plus accent border (visible on dark artwork).
- Virtualize by **rows of cards** (compute columns from measured width); with 30k
  tracks this is not optional.
- Arrow-key navigation is a roving tabindex across the grid; Enter opens the panel,
  double-click loads the player. Tag and filter state is identical to Table.
- Missing artwork uses the existing placeholder; the card must not collapse.

### 8.4 What is explicitly not a view

"Preparation", "Playlists", and "Discover" are navigation destinations. Adding
library presentations must not add primary tabs (`AGENTS.md` rule, IA doc).

**Effort:** L (5-7 days for all three; List first, Grid second).

---

## 9. Tag Manager

### 9.1 Two jobs, one surface

1. **Fast assign** - the reason the user asked. Select rows, hit a key, type a tag,
   Enter, keep going.
2. **Curate** - see all tags with counts, rename, merge duplicates, delete. This is
   the natural home for the Tag Surgeon suggestions.

A modal is wrong for job 1 because it hides the tracks. Use a **right drawer**
(resizable, collapsible, Esc closes), so the table stays visible and tags can be
dragged onto rows.

### 9.2 Open it

- Toolbar button "Tags" (tag icon; count of distinct tags), next to Columns.
- Row context menu: "Manage tags..." (the existing "Edit tags..." stays for the
  full metadata editor).
- Track panel, Tags tab: "Quick tag".
- Keyboard: T with rows selected opens the drawer with the search field focused.

### 9.3 Quick assign

- A single searchable list of all tags with usage counts, sorted by **recent** on
  open; typing filters; Enter on a new name creates and applies it.
- Applied tags are checked; clicking toggles. Applies to the whole selection in one
  reversible write.
- Last 8 used tags are pinned at the top ("Recent") - stored locally, not in the DB.
- Drag a tag chip from the drawer onto a row or a multi-selection as an alternative
  to selecting first.
- The write is optimistic with the existing Undo toast; a failed write rolls the
  chips back and reports the error, never a success-shaped lie.

### 9.4 Curate

- Table of tags: name, count, last used. Search, sort by name or count.
- **Rename**: updates `track_tags` transactionally; a collision merges into the
  existing tag.
- **Merge** (multi-select two tags): same transaction; confirmation names both and
  the resulting count.
- **Delete**: removes the tag from every track; confirmation states the number of
  tracks. Undo is capped: snapshot up to 500 affected tracks inline; above that,
  require a second confirmation and state that Undo is unavailable (a 20k-track tag
  snapshot is not a toast).
- Tag colours are **not** in v1. Usage data is derived with a GROUP BY; a
  `tag_meta` table only earns its keep once colour or pinning proves useful.
- Normalisation stays the single `normalizeTags` / Rust `normalize_tags` pair;
  rename and merge must call them, never invent a second spelling.

### 9.5 Tag Surgeon

Keep the existing read-only clustering report and render its suggestions here as
"Merge these?" rows. Do not auto-apply.

**Effort:** L (4-6 days; quick-assign alone is ~2).

---

## 10. Cross-cutting requirements

| Area | Requirement |
|---|---|
| **Undo** | Color, tag assign/toggle, rename/merge/delete, and label writes all snapshot through `skill_runs`. One toast per operation, with count. |
| **Counts** | The status bar reads "N tracks" or "N of M" from the API. Never count table rows. |
| **Selection** | By track id; survives view switch and reload; cleared by Esc. |
| **A11y** | Filter row has labelled inputs; grid has roving tabindex and arrow keys; view switcher is a radio group; 4.5:1 on all row states; focus rings not suppressed; reduced motion honoured. |
| **Performance** | One IPC per page or filter change; ~25-40 mounted rows in Table, ~30 cards in Grid; no decode during scroll; no layout shift when a tag or colour changes. |
| **State** | Persist per view: columns (v3), density, view mode, drawer width. Do **not** persist: search, column filters, tag filter. |
| **Docs** | On approval, fold sections 2-9 into `03-LIBRARY-VIEW.md` (v1.5) and tick the checklist doc; this file then becomes the rationale record. |

---

## 11. Delivery plan

| Phase | Contents | Why this order | Estimate |
|---|---|---|---|
| **0 - Truth** | Label extraction + backfill + provenance; Tags before Comment; default Label and Tags on; Color after `#` | Fixes the only defect and the cheapest wins; no new architecture | 3 days |
| **1 - Density and identity** | Row height presets/slider; real track color; List view | Immediate daily feel; List is the cheapest new view | 4-5 days |
| **2 - Find** | Column filters; Tag Manager quick-assign | Directly serves "find tracks easier" and "tag fast" | 6-8 days |
| **3 - Shape** | Waveform column; Grid view; Tag Manager curate/merge | Highest data cost and the most new surface; ship last | 6-8 days |

Each phase is independently shippable and reversible. Phase 0 should not wait for
approval of the rest.

---

## 12. Decisions needed

| # | Question | Recommendation |
|---|---|---|
| D-1 | Is "color" a track colour (Traktor-style) or the key colour? | Track colour; never repurpose key/harmonic colour |
| D-2 | Should Tags default to visible? | Yes - it is the workflow the manager exists for |
| D-3 | When the window is narrow, which default column drops? | Album, via a responsive rule, not by changing the stored preference |
| D-4 | Keep all-caps headers, or align with `01` section 5 (title case)? | Separate typography pass; do not mix into this work |
| D-5 | Persist column filters across restarts? | No - clear on restart; chips make them visible within a session |
| D-6 | Tag colours in v1? | No - derive counts only; add `tag_meta` when proven |
| D-7 | Waveform click behaviour? | None; row click and double-click stay authoritative |
| D-8 | Does the waveform column need cue ticks? | Not at row height; revisit only above 40 px strips |

---

## 13. Deliberately rejected

- **A search input in every cell.** Noise, twenty tab stops, and it implies a
  filter that is not applied server-side.
- **Client-side column filtering.** Lies about unloaded rows.
- **Per-row drag-to-resize.** Breaks the virtualization contract.
- **A 16-colour palette.** Eight plus "none" is enough to group a crate and keeps
  the swatch legible at 10 px.
- **Auto-tagging from folder or filename in this round.** It creates data the user
  did not ask for and is a separate product decision.
- **New primary navigation.** Views are presentations inside Library; Set Score
  still lives inside Playlists.

