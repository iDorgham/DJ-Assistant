# 11 — Implementation Checklist

**Version:** 1.4 · **Date:** 2026-11-09

Use this as the UI build order and acceptance gate.

---

## Phase A — Foundations

- [x] Design tokens (color L0–L3, text, accent, space, radius, type)
- [x] ThemeProvider dark/light/system
- [ ] DensityProvider compact/comfortable — **not implemented**: there is no density concept in the desktop today (no `density` prop, no density preference in `UiState`, no density provider component). The row height is fixed per column set (`rowHeightForColumns`). Leave this unchecked until a density mode ships.
- [x] Lucide icon setup
- [ ] IBM Plex Sans + IBM Plex Mono font loading
- [x] Motion helpers + reduced-motion  

## Phase B — Shell

- [x] AppShell layout slots (PR #53)  
- [ ] Menu bar (all sections)  
- [x] Header + view switcher (six-tab primary nav)  
- [ ] Options bar (three contexts)  
- [x] LeftNav expand/collapse + icons (PR #53)  
- [ ] Splitters + persistence (left, right, player)  
- [ ] Workspaces (Library / Prepare / Validate / save) — match [12-WIREFRAMES](12-WIREFRAMES-AND-FLEXIBILITY.md)  
- [ ] Command palette  

## Phase C — Library

- [x] TrackTable virtualized (PR #56: 19–23 rows mounted at 30k tracks)  
- [x] ColumnPicker show/hide/reorder/**resize** (widths persist) (PR #49)  
- [ ] **LibrarySourceTabs** — All Library · Categories · Playlists · Browser · Flash/Storage  
- [x] SearchField (title/artist/album/path + comment + tags, PR #53)  
- [x] FilterBar + chips + Compatible only - Compatible only reuses the `keyCamelot` filter; the intent is committed separately from the derived key list, so the reference, the Strict/Wide mode and the Key chip's × each re-derive it, and a committed intent whose reference is lost stays enabled and removable in the panel instead of needing a full reset (T2.1.8; running-window QA pending)  
- [x] KeyPill - Camelot 1A-12B + classical 1m/1d (preference) - relation-tinted pill, text on the theme primary token so every relation clears 4.5:1; notation persisted in Settings (T2.1.8; running-window QA pending)  
- [x] **EnergyBars** (1–10 charging-bar meter) — click a segment to set, click it again to clear (T2.1.6)  
- [x] **TagChips** (compact chips + overflow) — click a chip to filter (T2.1.7; running-window QA pending)  
- [x] **StarRating** — editable 5 stars — click to set, click the same star again to clear, keys `1`–`5` / `0` (T2.1.4). PR #72 (`307a13fb`, 2026-11-09) made the cell one roving tab stop that claims its digits (`lib/rating-keys.ts`, `data-rating-widget`) so the preview player no longer reads them as hot cues; the running-window pass for it is still unrun  
- [ ] **ArtworkThumb** — hover play overlay; real embedded art per track  
- [x] Label + Year columns — present in `library-columns.ts`, default Off (T2.1.7)  
- [ ] **MixSuggestionsPanel** (right dock) + Options bar button  
- [x] **TrackContextMenu** — the Library `RowContextMenu` ships (PR #60). The approved Playlists → Set Score flow uses suggestion cards with action controls and Why/Confidence, not a second track context menu; superseded Preparation and Auto views do not block this gate.
- [x] Library menu: Play, Analyze, Edit tags, Fix tags, Add to playlist, Find in playlists, Mix suggestions, Find smaller/similar online, Find new tracks online, Remove from library — Play, Edit tags, Rate, column toggles, Reveal, Copy path, Remove live with soft delete; other items disabled stubs (PR #60)
- [x] **Edit tags…** editor — title / artist / album / genre / label / year / tags / **comment** — `MetadataEditor`, single-row and bulk, dirty-field diff (T2.1.7/T2.1.13/T2.1.3)  
- [x] Column toggles (Energy, Tags, Rating, Label, Year, Artwork) persist  
- [x] BulkActionBar + Undo toast — the Undo toast ships with the rating/energy write path (Slice 2); the bar ships with T2.1.3 (PR #65). Select-all and the shared bulk actions remain open  
- [ ] Empty states  

## Phase D — Player

- [x] PlayerDock Mini / Full / Hidden — the dock ships with all three modes via PR #54; `PlayerMode` is `"hidden" | "mini" | "full"` (`ui-state.ts:55`)
- [ ] Full-window **Player view** — the spec's third presentation is not the Full dock: there is no separate player route or `PlayerMode` value for it, so it stays unchecked until a dedicated full-window Player view ships
- [ ] **WaveformDetailed** = zoomed viewport that **scrolls/moves** with playhead (not full-track strip)
- [ ] **WaveformOverview** = full-track map + zoom-window highlight (distinct from detailed)  
- [ ] Per-track peak data (never shared waveform for all files)  
- [ ] Real audio decode/playback per file (no shared metronome/sample)  
- [ ] Beat grid + high detail on detailed wave  
- [ ] Playhead seek/scrub RAF-locked to audio  
- [ ] Transport Play↔Pause, Cue, previous/next (no Stop)  
- [ ] HotCueBank A–H  
- [ ] GridControls + BeatJumpControls  
- [ ] Keyboard shortcuts when focused  
- [ ] **SpectrumVisualizer** (WebGL/Canvas) — at least one style per family: 2D Classic, 2D Artistic, 3D, Psychedelic, Particle, Club Hybrid  
- [ ] VisualizerStylePicker + particle mix layer + intensity/color controls  
- [ ] VisualizerRecorder — clean video / image-sequence export for Resolume Arena  
- [ ] Expanded / floating Visualizer mode  
- [ ] Performance caps + Reduce Motion respect  

## Phase E — Preparation (superseded; not a v1 gate)

The former standalone Preparation view is superseded by the approved Playlists
workspace. Set Score suggestions use action controls with Why and Confidence;
the legacy Preparation component list is out of scope and does not gate v1.

## Phase F — Auto Performance (superseded; not a v1 gate)

The former Auto Performance view is not part of approved v1 navigation. Its
legacy component list is out of scope and does not gate v1.

## Phase G — Settings & overlays

- [ ] SettingsWindow all categories  
- [ ] Settings search  
- [ ] Modal / Confirm / Toast / ContextMenu / Popover  
- [ ] Onboarding first-run  
- [ ] Session restore  

## Phase H — Polish

- [ ] Adobe-style options bar content complete  
- [ ] Ableton-style collapse all docks  
- [ ] Harmonic colors Strict/Wide preference  
- [ ] Accessibility pass (focus, contrast, a11y names)  
- [ ] Performance: large library scroll, waveform decode non-blocking  

---

## Cross-cutting acceptance

- [ ] UI never presents as live DJ performance software  
- [ ] Source audio never modified by UI actions  
- [ ] Undo available for bulk tag/cue/Skill operations  
- [ ] Dark + light both usable on waveform and key pills  
- [ ] 1440×900 Library ≥12 rows with Mini player  

---

## Doc references

| Topic | Doc |
|-------|-----|
| Principles / IA | [00-OVERVIEW.md](00-OVERVIEW.md) |
| Tokens | [01-DESIGN-SYSTEM.md](01-DESIGN-SYSTEM.md) |
| Shell | [02-SHELL-AND-NAVIGATION.md](02-SHELL-AND-NAVIGATION.md) |
| Screens | [03](03-LIBRARY-VIEW.md)–[05](05-AUTO-PERFORMANCE-VIEW.md) |
| Player | [06-PLAYER.md](06-PLAYER.md) · [06A-PLAYER-PRESENTATIONS.md](06A-PLAYER-PRESENTATIONS.md) |
| Settings | [07-SETTINGS.md](07-SETTINGS.md) |
| Patterns | [08-DIALOGS-AND-PATTERNS.md](08-DIALOGS-AND-PATTERNS.md) |
| Components | [09-COMPONENTS.md](09-COMPONENTS.md) |
| A11y | [10-ACCESSIBILITY-AND-KEYBOARD.md](10-ACCESSIBILITY-AND-KEYBOARD.md) |
| Wireframes & flexibility | [12-WIREFRAMES-AND-FLEXIBILITY.md](12-WIREFRAMES-AND-FLEXIBILITY.md) |
| Master narrative | [../UI_UX_PLAYER_AND_LAYOUT_SPEC.md](../UI_UX_PLAYER_AND_LAYOUT_SPEC.md) |
