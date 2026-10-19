# 11 — Implementation Checklist

**Version:** 1.0 · **Date:** 2026-10-19

Use this as the UI build order and acceptance gate.

---

## Phase A — Foundations

- [ ] Design tokens (color L0–L3, text, accent, space, radius, type)  
- [ ] ThemeProvider dark/light  
- [ ] DensityProvider compact/comfortable  
- [ ] Lucide icon setup  
- [ ] Inter + mono font loading  
- [ ] Motion helpers + reduced-motion  

## Phase B — Shell

- [ ] AppShell layout slots  
- [ ] Menu bar (all sections)  
- [ ] Header + view switcher  
- [ ] Options bar (three contexts)  
- [ ] LeftNav expand/collapse + icons  
- [ ] Splitters + persistence  
- [ ] Workspaces (Library / Prepare / Validate / save)  
- [ ] Command palette  

## Phase C — Library

- [ ] TrackTable virtualized  
- [ ] ColumnPicker show/hide/reorder/resize  
- [ ] SearchField  
- [ ] FilterBar + chips + Compatible only  
- [ ] KeyPill harmonic coloring  
- [ ] BulkActionBar + Undo toast  
- [ ] Empty states  

## Phase D — Player

- [ ] PlayerDock Mini / Full / Hidden  
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
| Master narrative | [../UI_UX_PLAYER_AND_LAYOUT_SPEC.md](../UI_UX_PLAYER_AND_LAYOUT_SPEC.md) |
