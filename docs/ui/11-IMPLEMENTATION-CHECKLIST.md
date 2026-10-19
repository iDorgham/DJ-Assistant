# 11 — Implementation Checklist

**Version:** 1.0 · **Date:** 2026-10-19

Use this as the UI build order and acceptance gate.

**Status (2026-10-19):** Partial implementation on `feat/T2.1.0-shell-ui`
(pending merge): tokens/theme/icons, shell layout, header, options bar, nav,
search/filters, empty states, and the player dock shell. Density, font loading,
motion helpers, menu bar, splitters, workspaces, command palette, and all player
playback/waveform/cue/grid controls remain open.

---

## Phase A — Foundations

- [x] Design tokens (color L0–L3, text, accent, space, radius, type)  
- [x] ThemeProvider dark/light (hook-based theme resolution + `data-theme`; system mode included)  
- [ ] DensityProvider compact/comfortable  
- [x] Lucide icon setup  
- [ ] Inter + mono font loading (stacks declared; no webfont bundled yet)  
- [ ] Motion helpers + reduced-motion (global reduced-motion rule only)  

## Phase B — Shell

- [x] AppShell layout slots  
- [ ] Menu bar (all sections)  
- [x] Header + view switcher  
- [x] Options bar (three contexts)  
- [x] LeftNav expand/collapse + icons  
- [ ] Splitters + persistence  
- [ ] Workspaces (Library / Prepare / Validate / save)  
- [ ] Command palette  

## Phase C — Library

- [ ] TrackTable virtualized  
- [ ] ColumnPicker show/hide/reorder/resize  
- [x] SearchField  
- [x] FilterBar + chips (Compatible-only toggle not yet)  
- [ ] KeyPill harmonic coloring  
- [ ] BulkActionBar + Undo toast  
- [x] Empty states  

## Phase D — Player

- [x] PlayerDock Mini / Full / Hidden (layout + mode switching; transport, waveform, cues, and grid are T2.4)  
- [ ] WaveformDetailed + WaveformOverview  
- [ ] Playhead seek/scrub  
- [ ] Transport Play↔Pause, Cue, Stop  
- [ ] HotCueBank A–H  
- [ ] GridControls + BeatJumpControls  
- [ ] Keyboard shortcuts when focused  

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
| Player | [06-PLAYER.md](06-PLAYER.md) |
| Settings | [07-SETTINGS.md](07-SETTINGS.md) |
| Patterns | [08-DIALOGS-AND-PATTERNS.md](08-DIALOGS-AND-PATTERNS.md) |
| Components | [09-COMPONENTS.md](09-COMPONENTS.md) |
| A11y | [10-ACCESSIBILITY-AND-KEYBOARD.md](10-ACCESSIBILITY-AND-KEYBOARD.md) |
| Product canon | [../product/CANONICAL_DOCUMENTATION.md](../product/CANONICAL_DOCUMENTATION.md) |
