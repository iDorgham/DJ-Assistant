# Phase 2 — Library UX & Player Implementation Plan

**Scope:** T2.1.5 → T2.4 (plus supporting T2.1.1 / T2.1.3 / T2.1.4 as needed)  
**Status:** Living plan · **Date:** 2026-10-21  
**UI source of truth:** `docs/ui/` (00–03, 06, 09, 11, 12) + `docs/UI_UX_PLAYER_AND_LAYOUT_SPEC.md` v1.9+  
**Tasks:** `docs/sdd/04-TASKS.md` · **Acceptance:** `docs/sdd/05-ACCEPTANCE.md` P2.1 / P2.1a–d  
**Does not include:** T2.5 Spectrum Visualizer (optional polish), Tag Surgeon engine (T2.2), Cue Master generation (T2.3.5)

---

## 1. Goals

Deliver the professional Library working surface and a trustworthy preview player:

1. Customizable, dense track table (Energy, Tags, Rating, Key pills, Artwork).
2. Library-specific context menu + Mix Suggestions dock.
3. Left-nav source filtering (All Library · Categories · Playlists · Browser · Flash/Storage).
4. Real per-track audio playback with **Traktor-style dual-wave** (detailed + overview).
5. Transport, hot cues A–H, grid, beat jump — preview only, not a live mixer.

**Exit:** P2.1 + P2.1a–d green. Visualizer is explicitly out of the exit gate.

---

## 2. Principles

| # | Principle | Practice |
|---|-----------|----------|
| 1 | Vertical slices | Each PR leaves Library usable; no half-broken table |
| 2 | Components first | Design-system cells (`EnergyBars`, `TagChips`, …) with tests before full wiring |
| 3 | Data before chrome | Schema + IPC fields land before UI that depends on them |
| 4 | Player after play path | Dual-wave only after selection → load → real audio works |
| 5 | Per-track truth | Never shared waveform buffer, shared audio sample, or shared artwork for all rows |
| 6 | Reversibility | Rating / energy / tag bulk edits offer Undo toast |
| 7 | Density | 28–32px rows; ≥12–15 visible rows at 1440×900 with Mini player |

---

## 3. Prerequisites (Slice 0)

| Item | Status target | Notes |
|------|---------------|-------|
| T2.1.0 App shell | Merged or stable branch | View switcher, LeftNav slot, OptionsBar, PlayerDock modes, `ui-state` persistence, Ableton tokens |
| T2.1.2 Multi-filter + sort | Merged | BPM, key, genre, rating, analysis status; extend for Energy in Slice 2 |
| Virtualized track table | Exists from Phase 0 | Become `TrackTable` + column config |
| `list_tracks` / `get_track` | Exists | Extend request/response shapes below |
| Analysis fields | Phase 1 in progress | `key_camelot`, `key_classical`, BPM; energy may need migration |

**Do not start Slice 1 until shell + basic table are on the integration branch.**

---

## 4. Schema & IPC extensions (do early, shared)

### 4.1 SQLite / `tracks`

| Field | Change | Why |
|-------|--------|-----|
| `energy` | Prefer **INTEGER 1–10** (migrate from REAL if needed) | Charging bars; filter range |
| `user_rating` | Confirm 0–5 | Star UI |
| `label` | TEXT nullable | Label column |
| Tags | Junction `track_tags(track_id, tag)` **or** documented JSON | Chips + filter |
| Waveform peaks | Cache table or file: `track_id`, `version`, `peaks_blob` / path | Dual-wave; never one global buffer |

Migration rules: additive, reversible where practical; no source-audio touch.

### 4.2 IPC — extend existing contracts

Document in `docs/API_CONTRACTS.md` before merge of implementing PR.

**`list_tracks` filters / sort (extend)**

```ts
filters?: {
  // existing…
  energyMin?: number;      // 1–10
  energyMax?: number;
  ratingMin?: number;      // 0–5
  tags?: string[];
  label?: string[];
  yearMin?: number;
  yearMax?: number;
  hasCues?: boolean;
  source?: 'all' | 'playlist' | 'browser' | 'storage' | 'category';
  sourceId?: string;       // playlist id, folder path key, mount id
  compatibleWithKey?: string; // Camelot of playing/selected track
  compatibleMode?: 'strict' | 'wide';
};
sortBy?: // existing + 'energy' | 'rating' | 'year' | 'label' | 'key';
```

**`TrackSummary` / detail (extend)**

```ts
energy?: number | null;       // 1–10
userRating?: number;          // 0–5
label?: string | null;
year?: number | null;
tags?: string[];
keyCamelot?: string | null;
keyClassical?: string | null;
artworkUrl?: string | null;   // tauri asset / data URL / cache path protocol
hasCues?: boolean;
cueCount?: number;
```

**New / extended commands**

| Command | Purpose |
|---------|---------|
| `update_track_metadata` | Patch rating, energy, tags, label, year, notes (logged; undo payload) |
| `set_track_rating` | Convenience for single/multi rating |
| `get_waveform_peaks` | `{ trackId, zoomLevel? }` → peaks for detailed + overview |
| `player_load` | Load track into player engine (path validated server-side) |
| `player_play` / `pause` / `stop` / `seek` | Transport |
| `player_get_state` | Position, duration, playing, trackId |
| `mix_suggestions` | `{ trackId, limit?, mode? }` → ranked candidates + reasons |

**Events:** `player:state`, `player:ended`, `waveform:ready` (optional).

### 4.3 Pure shared modules (`packages/shared` or `lib/`)

| Module | Responsibility |
|--------|----------------|
| `column-config.ts` | Default columns, validate, merge, serialize |
| `harmonic.ts` | Camelot adjacency, relative maj/min, strict/wide, pill relation enum |
| `energy.ts` | Clamp 1–10, bar fill model |
| `mix-score.ts` | Weighted harmonic + BPM + energy delta → rank + reason chips |
| `key-format.ts` | Camelot ↔ 1m/1d ↔ classical display strings |

These get unit tests **first** (TDD-friendly).

---

## 5. Extended slice plan

### Overview

| # | Slice | Tasks | Est. | Parallel |
|---|--------|--------|------|----------|
| 0 | Baseline merge | T2.1.0, T2.1.2 | — | — |
| 1 | Column framework | **T2.1.5** | S | — |
| 2 | Rating + Energy | **T2.1.4**, **T2.1.6** | S–M | After 1 |
| 3 | Tags + Key pills | **T2.1.7**, **T2.1.8** | M | After 1; key needs playing id |
| 4 | Artwork | **T2.1.9** | S | After 1 |
| 5 | Context menu + nav sources | **T2.1.10**, **T2.1.12** | M | After 2–4 |
| 6 | Mix Suggestions | **T2.1.11** | M | After 3 + 5 |
| 7 | Player modes + real audio | **T2.4.1**, **T2.4.3** | M | After play path (5) |
| 8 | Dual-wave + transport | **T2.4.2**, **T2.4.4**, **T2.4.5** | L | After 7 |
| 9 | Hardening (optional same sprint) | a11y, perf, search fields T2.1.1, bulk T2.1.3 | M | Continuous |

S ≈ 1–2d · M ≈ 2–4d · L ≈ 4–7d (one mid-level engineer).

```
Slice 1 columns
  ├─ Slice 2 rating+energy
  ├─ Slice 3 tags+key
  └─ Slice 4 artwork
        └─ Slice 5 menu+nav
              └─ Slice 6 mix suggestions
Slice 7 real audio ──► Slice 8 dual-wave + transport
```

---

### Slice 1 — Column framework (T2.1.5)

**Intent:** Make the table a configurable product surface.

**Work**
1. `ColumnId` union + default config (match `03-LIBRARY-VIEW` §3.2).
2. Persist `{ id, visible, width, order }[]` per view in `localStorage` / workspace prefs.
3. `ColumnPicker`: checklist, drag reorder, resize handles, double-click auto-fit, Reset.
4. `TrackTable` header + body read config; virtualization still works with variable row height only if Artwork on (document rule: artwork row taller or fixed thumb).
5. Forbid hiding the last identity column (Title).

**Files (indicative)**
- `apps/desktop/src/features/library/columns.ts`
- `apps/desktop/src/components/library/ColumnPicker.tsx`
- `apps/desktop/src/components/library/TrackTable.tsx`
- tests: `columns.test.ts`

**DoD**
- [ ] Toggle any optional column; order + widths survive relaunch
- [ ] Reset restores defaults
- [ ] No layout jump that breaks virtualization
- [ ] Unit tests for merge/validate/persist

**Out of scope:** Fancy cell widgets (plain text OK).

---

### Slice 2 — Rating + Energy (T2.1.4, T2.1.6)

**Data**
- Migration if `energy` not INTEGER 1–10.
- `update_track_metadata` / `set_track_rating` with undo snapshot in skill_runs or lightweight undo stack.

**UI**
- `StarRating`: filled/outline, hover preview, keys `1`–`5` / `0`, multi-select apply.
- `EnergyBars`: 10 segments, accent fill, tooltip “Energy N / 10”, unanalyzed → “—”.
- Sort by `energy` / `rating`; filter `energyMin/Max`, `ratingMin`.

**DoD**
- [ ] Edit rating on 20 tracks; multi-select rate; Undo
- [ ] Filter Energy 6–8 + sort rating works via `list_tracks`
- [ ] Values survive app restart
- [ ] Component tests + IPC handler tests

**Enhancement:** Inline energy edit (click bars or context “Set energy”) with same undo path.

---

### Slice 3 — Tags + Key pills (T2.1.7, T2.1.8)

**Tags**
- Read tags into `TrackSummary.tags`.
- `TagChips` + `+N` overflow; click → push tag into `FilterBar`.
- Edit via existing “Edit tags…” stub or minimal dialog; full Tag Surgeon remains T2.2.

**Key**
- `key-format` + `harmonic` modules.
- Preference: Camelot | 1m/1d | both (Settings → Library).
- `KeyPill` relation vs **playing** track (or selected if nothing playing): same, ±1, relative, wide ±2, incompatible.
- Compatible-only filter uses same rules (Strict vs Wide).

**DoD**
- [ ] Playing 5A colors 5A / 4A / 6A / 5B correctly
- [ ] Tag chip filters table
- [ ] Preference switch updates column without reload
- [ ] Pure function tests for all Camelot relations (12×12 matrix sample)

**Enhancement:** Optional left row border for “mixable with playing track”.

---

### Slice 4 — Artwork (T2.1.9)

**Work**
- Extract/cache embedded art on import or lazy on first paint (Rust).
- Protocol for UI: `asset://` / custom scheme / base64 thumbnail — pick one, document in API contracts.
- `ArtworkThumb` + hover play overlay (40–50% dim); keyboard focus shows control.
- Column default **Off**.

**DoD**
- [ ] Mixed library shows correct thumbs; missing → placeholder icon
- [ ] Hover-play loads **that** track (IPC `player_load` or selection event)
- [ ] No cross-track art bleed after rapid scroll

**Risk:** Decode cost on huge libraries → thumbnail max edge (e.g. 64–96px), lazy load in view.

---

### Slice 5 — Context menu + left-nav sources (T2.1.10, T2.1.12)

**Library `TrackContextMenu`**
- Play, Analyze, Edit tags, Fix tags (stub → T2.2), Rate submenu, Add to playlist/set, Find in playlists, Mix suggestions, column toggles (Energy/Tags/Rating/Label/Year/Artwork), Reveal in Finder/Explorer, Copy path, Remove from library (soft + Undo).
- Multi-select rules per `03-LIBRARY-VIEW` §3.5.
- Preparation / Auto menus stay distinct stubs (do not reuse Library items blindly).

**`LibrarySourceTabs`**
- All Library · Categories · Playlists · Browser · Flash/Storage.
- Drive `list_tracks` `source` / `sourceId`.
- Collapsed rail = icons + tooltips; badge counts optional.

**DoD**
- [ ] Right-click “Show Energy” toggles column
- [ ] Remove from library does not delete file; Undo restores row
- [ ] Switching Playlist vs All Library changes result set
- [ ] Analyze queues real analysis job when Phase 1 ready

**Enhancement:** “Find in playlists…” popover lists membership; jump navigates source tab.

---

### Slice 6 — Mix Suggestions (T2.1.11)

**Work**
- Right dock + Options bar toggle; resizable like Skills dock.
- `mix_suggestions` IPC or client-side score over current page + fetch top-N from Rust for quality.
- Rank: harmonic distance, BPM delta, energy delta; reason chips (“+1 Camelot”, “same energy”).
- Actions: Preview (load player), Add to set (stub set OK), Replace selection.
- Empty: “Select a track to see mix suggestions”.

**DoD**
- [ ] Select track → ranked list within ~100ms for local score / reasonable for IPC
- [ ] Preview loads correct track
- [ ] Dock width persists

**Enhancement:** Pin “use playing track” vs “use selection”; Strict/Wide toggle shared with key filter.

---

### Slice 7 — Player modes + real audio (T2.4.1, T2.4.3)

**Critical rules**
- Decode and play the **actual file** for the loaded track.
- Artwork and identity update per track.
- Modes: Hidden / Mini (~72–88px) / Full; defaults Library=Mini, Preparation=Full; animate height 200–280ms.

**Work**
- Wire `PlayerDock` to engine state (`player:state` events).
- Transport basics: Play/Pause (Space when focused), Stop.
- Mini may show compact overview wave **or** thin progress until Slice 8 — audio must still be real.

**DoD**
- [ ] Double-click / context Play / hover-play all play the correct file
- [ ] Track A → Track B changes audio and art with no bleed
- [ ] Mode switching does not tear down decode incorrectly

**Risk:** Audio thread vs UI thread — keep decode/playback off the React render path.

---

### Slice 8 — Dual-wave + transport (T2.4.2, T2.4.4, T2.4.5)

**Waveform contract (acceptance-critical)**

| Layer | Behavior |
|-------|----------|
| **Top — Detailed** | Zoomed viewport; scrolls with follow-playhead; grid, phrases, cues; zoom −/+/Fit |
| **Bottom — Overview** | Full track width; zoom-window highlight; absolute playhead tick |
| **Data** | Per-track peaks only; `get_waveform_peaks` |

**Never:** identical full-track strips stacked; shared peak buffer; non-moving wave while audio plays.

**Transport / grid**
- Temporary CUE; Hot cues A–H (set / jump / clear / color); numbers 1–8 when focused.
- Grid snap, nudge, BPM fine, reset; beat jump ±1/4/8/16/32.
- Playhead RAF-locked; seek/scrub on both layers; optional snap to beat/bar/cue.

**DoD (maps to P2.1d + `06-PLAYER` §9)**
- [ ] Top ≠ bottom behavior verified on fixture tracks
- [ ] Follow playhead on/off
- [ ] Hot cue round-trip persists (DB) when cues exist
- [ ] Space / 1–8 / seek work when player focused
- [ ] No source file hash change

**Enhancement:** Prefetch peaks for next Mix Suggestion / next row on hover.

---

### Slice 9 — Hardening (continuous)

| Item | Notes |
|------|--------|
| T2.1.1 Search fields | title, artist, album, genre, tags, label, year, filename, comment |
| T2.1.3 Bulk select + bulk metadata | Undo for bulk rating/tags/energy |
| Virtualization perf | 5k–20k rows smoke; column toggle does not drop FPS |
| a11y | Star/Energy names; menu keyboard; focus rings; reduced motion on player height |
| Empty/error states | No tracks, no peaks yet, analyze failed |
| Telemetry (opt-in) | Column layout used, mix suggestion accept rate — no audio |

---

## 6. Component build order (matches `09-COMPONENTS`)

```
Theme tokens (done in T2.1.0)
  → ColumnPicker + column-config
  → StarRating, EnergyBars
  → TagChips, KeyPill
  → ArtworkThumb
  → TrackContextMenu (Library)
  → LibrarySourceTabs
  → MixSuggestionsPanel
  → PlayerMini / PlayerFull chrome
  → WaveformOverview → WaveformDetailed → Playhead
  → TransportControls → HotCueBank → GridControls → BeatJumpControls
```

Visualizer components (`SpectrumVisualizer`, …) stay **after** Slice 8 (T2.5).

---

## 7. Test strategy

| Layer | What |
|-------|------|
| Unit | `harmonic`, `mix-score`, `column-config`, `energy` clamp, key format |
| Rust | metadata update, peaks cache keying, path canonicalization on `player_load` |
| Integration | `list_tracks` energy/rating/tag filters; rating persist; soft-remove + undo |
| Component | StarRating keyboard; EnergyBars a11y name; ColumnPicker reorder |
| Manual script | P2.1a–d checklist; 94-track real library regression; dual-wave visual check |
| Non-goals | Visualizer FPS until T2.5; full Tag Surgeon accuracy until T2.2 |

CI gate: unit + Rust tests green; typecheck; no new Clippy/ESLint debt on touched paths.

---

## 8. Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Energy still REAL / missing in analysis | Filter/UI wrong | Migration + proxy from LUFS/spectral until model exists; user override |
| Dual-wave “looks done” but top==bottom | Fails P2.1d | Explicit QA script; screenshot evidence in `docs/evidence/` |
| Shared audio/art bug | Trust collapse | Fixture test: two tracks different hash → different PCM + art |
| Column persist races | Lost layout | Single writer module; versioned JSON schema |
| Mix suggestions O(n²) on huge library | UI freeze | Server-side top-N SQL prefilter (BPM±, key set) then score |
| Peaks generation blocks UI | Jank | Background job + skeleton wave; cache on disk |
| Scope creep (Visualizer, online find) | Slip exit | Keep T2.5 and online find off critical path |

---

## 9. Branch & PR strategy

```
main
 └─ feat/T2.1.5-column-framework
      ├─ feat/T2.1.4-6-rating-energy
      ├─ feat/T2.1.7-8-tags-key
      └─ feat/T2.1.9-artwork
           └─ feat/T2.1.10-12-menu-nav
                └─ feat/T2.1.11-mix-suggestions
 └─ feat/T2.4-player-audio
      └─ feat/T2.4-dual-wave-transport
```

**PR rules**
- One slice ≈ one PR (Slice 8 may split: peaks+layout, then grid/cues/jump).
- Description links task ids + acceptance ids (P2.1a…).
- Update `API_CONTRACTS.md` in the same PR when IPC changes.
- Manual smoke notes in PR body for Library/player paths.

---

## 10. Suggested calendar (1 engineer)

| Week | Focus |
|------|--------|
| **W1** | Slice 0 confirm → Slice 1 columns → Slice 2 rating/energy |
| **W2** | Slice 3 tags/key → Slice 4 artwork → Slice 5 menu/nav start |
| **W3** | Finish Slice 5 → Slice 6 Mix Suggestions → Slice 7 real audio |
| **W4** | Slice 8 dual-wave + transport → P2.1a–d evidence → harden |

**2 engineers:** A = Library slices 1–6, B = player research + Slice 7–8 after play path API agreed in W1.

---

## 11. Definition of Done — sequence complete

- [ ] All T2.1.5–T2.1.12 and T2.4.1–T2.4.5 checked in `04-TASKS.md`
- [ ] P2.1, P2.1a, P2.1b, P2.1c, P2.1d pass with notes/evidence
- [ ] API contracts and DATA_MODEL match implementation
- [ ] No shared waveform/audio/art across tracks
- [ ] Source file hashes unchanged after rating/tag/play/analyze paths
- [ ] UI checklist Phase C + Phase D (non-visualizer) in `docs/ui/11-IMPLEMENTATION-CHECKLIST.md` largely complete
- [ ] PROJECT_CONTEXT interface table updated to ✅ for shipped surfaces

---

## 12. Ticket template (copy per slice)

```markdown
### T2.x.x — <title>
**Slice:** N  
**Depends on:** …  
**Spec:** docs/ui/… §…

#### Work
- [ ] …

#### IPC / schema
- [ ] …

#### Tests
- [ ] Unit: …
- [ ] Manual: …

#### DoD
- [ ] …
#### Out of scope
- …
```

---

## 13. References

- **Dependency diagrams:** [`docs/diagrams/16-phase2-library-player-deps.md`](./diagrams/16-phase2-library-player-deps.md)  
- `docs/ui/03-LIBRARY-VIEW.md` v1.4  
- `docs/ui/06-PLAYER.md` v1.2  
- `docs/ui/09-COMPONENTS.md` · `11-IMPLEMENTATION-CHECKLIST.md`  
- `docs/UI_UX_PLAYER_AND_LAYOUT_SPEC.md` v1.9  
- `docs/sdd/04-TASKS.md` · `05-ACCEPTANCE.md`  
- `docs/API_CONTRACTS.md` · `docs/DATA_MODEL.md` · `docs/ARCHITECTURE.md`  

---

*Plan authored 2026-10-21. Update when slice order or IPC shapes change materially.*
