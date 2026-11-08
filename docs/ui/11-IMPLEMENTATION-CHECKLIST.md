# 11 — Implementation Checklist

**Version:** 1.2 · **Date:** 2026-10-19

Use this as the UI build order and acceptance gate.

---

## Phase A — Foundations

- [ ] Design tokens (color L0–L3, text, accent, space, radius, type)  
- [ ] ThemeProvider dark/light  
- [ ] DensityProvider compact/comfortable  
- [ ] Lucide icon setup  
- [ ] IBM Plex Sans + IBM Plex Mono font loading  
- [ ] Motion helpers + reduced-motion  

## Phase B — Shell

- [ ] AppShell layout slots  
- [ ] Menu bar (all sections)  
- [ ] Header + view switcher  
- [ ] Options bar (three contexts)  
- [ ] LeftNav expand/collapse + icons  
- [ ] Splitters + persistence (left, right, player)  
- [ ] Workspaces (Library / Prepare / Validate / save) — match [12-WIREFRAMES](12-WIREFRAMES-AND-FLEXIBILITY.md)  
- [ ] Command palette  

## Phase C — Library

- [ ] TrackTable virtualized  
- [ ] ColumnPicker show/hide/reorder/**resize** (widths persist)  
- [ ] **LibrarySourceTabs** — All Library · Categories · Playlists · Browser · Flash/Storage  
- [ ] SearchField  
- [ ] FilterBar + chips + Compatible only - Compatible only reuses the `keyCamelot` filter; the intent is committed separately from the derived key list, so the reference, the Strict/Wide mode and the Key chip's × each re-derive it (T2.1.8; running-window QA pending)  
- [ ] KeyPill - Camelot 1A-12B + classical 1m/1d (preference) - relation-tinted pill, text on the theme primary token so every relation clears 4.5:1; notation persisted in Settings (T2.1.8; running-window QA pending)  
- [x] **EnergyBars** (1–10 charging-bar meter) — click a segment to set, click it again to clear (T2.1.6)  
- [x] **TagChips** (compact chips + overflow) — click a chip to filter (T2.1.7; running-window QA pending)  
- [x] **StarRating** — editable 5 stars — click to set, click the same star again to clear, keys `1`–`5` / `0` (T2.1.4)  
- [ ] **ArtworkThumb** — hover play overlay; real embedded art per track  
- [x] Label + Year columns — present in `library-columns.ts`, default Off (T2.1.7)  
- [ ] **MixSuggestionsPanel** (right dock) + Options bar button  
- [ ] **TrackContextMenu** per view (Library ≠ Preparation ≠ Auto)  
- [ ] Library menu: Play, Analyze, Edit tags, Fix tags, Add to playlist, Find in playlists, Mix suggestions, Find smaller/similar online, Find new tracks online, Remove from library  
- [x] **Edit tags…** editor — title / artist / album / genre / label / year / tags / **comment** — `MetadataEditor`, single-row and bulk, dirty-field diff (T2.1.7/T2.1.13/T2.1.3)  
- [x] Column toggles (Energy, Tags, Rating, Label, Year, Artwork) persist  
- [x] BulkActionBar + Undo toast — the Undo toast ships with the rating/energy write path (Slice 2); the bar ships with T2.1.3 (PR #65). Select-all and the shared bulk actions remain open  
- [ ] Empty states  

## Phase D — Player

- [ ] PlayerDock Mini / Full / Hidden + Player view  
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

## Phase E — Preparation

- [ ] SetTrackList reorder + drag from Library  
- [ ] SkillsDock + SkillCard Run/Undo  
- [ ] ConstraintChips  
- [ ] ExportDialog + preview tree  
- [ ] GigReadyChecklist  

## Phase F — Auto Performance

- [ ] Set selector + AUTO on/off  
- [ ] AutoQueue  
- [ ] AutoNowPlaying  
- [ ] SetInsights (energy, key path, warnings)  
- [ ] Flag issue → Preparation deep link  

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
