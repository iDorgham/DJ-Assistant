# 06 — Player

**Version:** 1.4 · **Date:** 2026-10-23  
**Master spec alignment:** UI_UX_PLAYER_AND_LAYOUT_SPEC.md v1.9+

> **Presentation authority:** [06A-PLAYER-PRESENTATIONS.md](06A-PLAYER-PRESENTATIONS.md) defines the three presentations — Mini, Full and Player view — plus the bar counter and the full-player Player view composition. This file remains the functional player reference; where mode/layout wording conflicts, 06A wins. Extended was retired on 2026-10-23; its grid & beat tools now live in Full's segmented panel.

Preview and validation only — not a live performance engine.  
Includes an optional **artistic Spectrum Visualizer** for beautiful, club-ready visuals that can be recorded and exported for Resolume Arena / VJ workflows.

---

## 1. Presentations and modes

| Presentation | Height (target) | Contents |
|------|-----------------|----------|
| **Hidden** | 0 | Header toggle restores; visibility state, not a presentation |
| **Mini** | ~96–139px (default 104) | Full-height artwork, track line with chips, compact seek rail, transport, A–H pads, expand/hide |
| **Full** | 246px (230–440) | 160px artwork column, centred detailed waveform + zoom cluster, track line, overview rail, transport row (CUE/Play, volume, compact hot cues), dock actions; the Hot cues ↔ Grid & beat segmented panel carries the grid tools; Visualizer panel is target-only |
| **Player view** | Window | Vertical composition: full player → EQ8 slide-down panel → playlist; Set Flow; nav hidden on wide screens |
| **Visualizer Expanded** | Large / floating / dual-monitor friendly | Optional visualizer surface; not a player presentation |

- Three presentations are **Mini, Full and Player view**; Hidden is visibility. Visualizer Expanded is an optional surface.
- See [06A](06A-PLAYER-PRESENTATIONS.md) for layouts, dimensions and acceptance.
- Slides from under main content; header stays fixed  
- Animate height 200–280ms ease-out  
- Defaults: Library → Mini · Playlists → Full · Auto Performance → compact  
- The splitter snaps the unsupported 140–229px gap to the nearer edge (139 or 230)
- Player view is entered manually from Full and is not a splitter height
- Visualizer can be toggled independently inside Full mode or opened as Expanded overlay / second window

---

## 2. Artwork column and track line

- **Artwork column** — left only; full dock height in Mini (91px), a 160px cover at the top of Full in a 184px column. Player view uses the same 160px cover inside its identity strip.
- **Track line** (directly above the waveform/progress rail): Title — Artist · BPM · Key · bar counter (Full/Player view) · elapsed / remaining time. There is no synth chip; the synthesized-audio disclosure is the Play button tooltip.
- **Rail** sits under the track line (Full/Player view: overview map · Mini: compact seek)
- **Zoom − / + / Fit / follow** floats at the detailed waveform's top-right (Full/Player view)
- **Visualizer toggle** (icon) — opens style picker + canvas

---

## 3. Waveform & playhead

### Full — two distinct layers (Traktor-style)

These are **not** the same waveform drawn twice at different heights.

| Layer | Role | Behavior |
|-------|------|----------|
| **Top — Detailed waveform** | Zoomed, high-resolution view around the playhead | **Moves / scrolls** with playback when “follow playhead” is on; user can zoom in/out; shows **beat grid**, phrase bands, cue markers, fine amplitude detail |
| **Bottom — Overview map** | Entire track at fixed full width | Always shows **0 → end**; a highlighted **zoom window** indicates what the top view is showing; cues as small ticks; playhead as a thin absolute-position line |

**Critical rules (implementation must match)**

1. **Top ≠ bottom.** Top is a **viewport** into a zoomed slice of the track. Bottom is the full-track overview.  
2. Top waveform **scrolls under a fixed reading head** while follow is on — the playhead stays on the centre line, Traktor “parallel” style. The window is `position − visibleDuration / 2`, so the track start lands on the centre line and the left half is blank; after the end the right half is blank. Fit (≤1.05×) is the exception: the whole track shows and the playhead travels across it.  
3. Bottom stays full-track width; only the highlight box and playhead line move.  
4. Zoom controls (− / + / Fit) affect **top only**. Default zoom is **8×**.  
5. Beat **grid** and high-detail peaks are drawn on the **top** view when analysis is available.  
6. Click/drag on top → seek/scrub with fine control; click on overview → seek. With follow on, the detailed view re-centres on the new position; a manual pan turns follow off.  
7. Per-track peak data must be unique — never reuse a single shared waveform buffer for all tracks.  
8. Artwork and audio decoding are **per track**; no shared placeholder beat/sample for every file.

### Mini

- Single compact **full-track** waveform (overview-style) with playhead  
- Expand to Full for detailed + overview pair  

### Playhead

- High-contrast vertical accent line  
- Real-time with audio (**RAF locked**; no laggy easing)  
- Pinned to the horizontal centre of the detailed waveform while follow is on; the peaks move beneath it  
- Click waveform → seek  
- Drag → scrub (preview while dragging when performance allows)  
- Overview shows absolute position as a 2px line above the zoom-window tint, with a diamond cap  
- **Follow playhead** default On for detailed view (user can pin/unpin); wheel pan and window dragging switch it off  
- Optional snap to beat / bar / cue when grid snap on  

### Waveform elements (detailed / top)

| Element | Display |
|---------|---------|
| Amplitude | Accent-colored high-detail waveform for the current zoom window |
| Beat grid | Vertical lines when analyzed (top view) |
| Phrases | Soft bands (intro/verse/drop/outro) |
| Hot cues | Colored markers + letters |
| Playhead | Accent line ± time tooltip on hover |
| Zoom window | Linked highlight on the overview map |

Loading: skeleton until **that track’s** peaks are ready. Empty: “Select a track to preview.”

### Known incorrect behavior to avoid

- Playing a simple constant beat / same sampler for every track → **must** decode and play the actual audio file  
- Artwork blank when file embeds art → load embedded / cache art per track  
- Top and bottom waves identical full-track strips (only height differs) → **wrong**; top must be zoomed + scrolling  
- Wave not moving while audio plays → top must scroll or playhead must move in lockstep with audio 

---

## 4. Spectrum Visualizer (artistic)

Optional real-time audio-reactive visual layer driven by the currently playing track (Web Audio AnalyserNode + WebGL / Canvas / Three.js).

### 4.1 Placement & modes

| Mode | Behavior |
|------|----------|
| **Inline (Full player)** | Visualizer canvas sits above or replaces part of the waveform area; height user-resizable |
| **Expanded** | Large floating panel or second-window style view optimized for dual-monitor / club laptop |
| **Record / Export** | Same engine used for live preview can capture frames for export |

Visualizer is **off by default** in Library Mini to preserve density. Easy one-click enable in Full / Auto Performance / Expanded.

### 4.2 Style families

Users can switch styles instantly. Each family has multiple presets + intensity / color / motion controls.

| Family | Character | Typical use |
|--------|-----------|-------------|
| **2D Classic** | Clean bars, mirrored bars, circular, radial, waveform-line, oscilloscope | Everyday preview, clean club |
| **2D Artistic** | Soft gradient waves, liquid, neon trails, geometric, minimal line art | Modern club, Instagram-friendly |
| **3D** | Tunnel, sphere, terrain, floating geometry, depth particles, camera motion | Immersive / big-screen |
| **Psychedelic** | Kaleidoscope, fractal, color-shift, feedback, trippy tunnels, liquid mirrors | Psy / progressive / late-night |
| **Particle** | Explosions, trails, constellation, dust, reactive emitters, physics-ish | High-energy drops, techno |
| **Club / Hybrid** | Combinations of the above (bars + particles, 3D + trails, logo-safe dark backgrounds) | Resolume / LED wall ready |

**Hybrid rule:** every style can optionally layer a secondary Particle system on top (strength 0–100%).

### 4.3 Controls (Visualizer panel)

- Style family + preset dropdown / grid  
- Intensity / Reactivity (low → extreme)  
- Color mode: Theme accent · Custom palette · Track-key aware · Rainbow / Psy cycle  
- Background: Solid dark · Transparent · Gradient · Logo-safe black  
- Motion / Speed / Bloom / Glow  
- Particle layer on/off + density  
- Beat / bar / phrase sync strength (uses analysis data when available)  
- Freeze / Hold frame  
- Fullscreen / Expanded toggle  

### 4.4 Performance & technical notes

- Prefer WebGL (or Canvas 2D fallback)  
- Use AnalyserNode (FFT) + optional time-domain data  
- Cap frame rate or resolution on low-power machines; respect “Reduce motion” accessibility preference  
- Never block audio or UI thread; visualizer runs on its own requestAnimationFrame loop  
- When analysis data (BPM, phrases, energy) is available, styles may react more musically  

### 4.5 Record & Export for Resolume Arena

Primary goal: produce clean, high-quality visual clips that drop straight into Resolume Arena (or similar VJ software).

| Export type | Details |
|-------------|---------|
| **Video file** | MP4 / ProRes / high-quality H.264/H.265 — selectable resolution (1080p / 1440p / 4K), frame rate (30 / 60), duration (current track, selection, or set) |
| **Image sequence** | PNG / EXR sequence for maximum quality compositing |
| **Live output (future / advanced)** | Spout (Windows) / Syphon (macOS) / NDI when native bridge is available |

**Recording UI**
- Record button in Visualizer panel  
- Choose: current track · in/out points · whole set (Auto Performance)  
- Optional: burn-in timecode / beat counter (off by default)  
- Progress + estimated size  
- Post-record: open folder / send to Resolume-friendly location / copy path  

**Best practices baked in**
- Logo-safe / letterbox options  
- Transparent background export where codec allows (or pure black)  
- High contrast, high saturation presets labeled “Club / LED”  
- No UI chrome in recorded output  

---

## 5. Transport

- **CUE** — set/return temporary cue (distinct from hot cues)  
- **Play / Pause** — single toggle (play icon ↔ pause icon)  
- **No Stop** — Pause is the stop-like action  
- Spacebar toggles play/pause when player focused  

---

## 6. Hot cues (CDJ-3000 style)

```
[ A ] [ B ] [ C ] [ D ] [ E ] [ F ] [ G ] [ H ]
```

- One horizontal row; equal width  
- **One compact pad style in both presentations:** 30px pads, 38–72px wide, colour border + 2px top bar, 11px letter over a 9px timecode, soft glow when set  
- Set: letter + time; empty: letter + dashed border and `—` time  
- The strip is centred in the transport row with 24px side padding and caps at 640px  
- In Full the strip shares its row slot with the Grid & beat panel behind a segmented control
- Click set cue → move playhead (± start play per preference)  
- Shift-click / context: set, clear, color  
- Numbers `1`–`8` trigger A–H when player focused  

---

## 7. Grid & beat jump (Full panel)

| Group | Controls |
|-------|----------|
| Grid | Snap on/off · Nudge left/right · BPM fine ± · Reset grid |
| Beat jump | ±1, 4, 8, 16, 32 (or −/+ with size) |

The tools live in Full's segmented **Grid & beat** panel, which shares the row slot with the Hot cues strip.  
BPM fine-tune drives the grid, the bar counter and the beat-jump size together.  
Grid edits update the waveform immediately and are undoable.  
Beat jump moves playhead by N beats.

---

## 8. View defaults by app view

| | Library | Preparation | Auto Performance |
|--|---------|-------------|------------------|
| Default | Mini | Full | Mini / compact |
| Hot cues | Yes | Primary | Visible |
| Grid / jump | On demand | Grid & beat panel | Minimal |
| Queue link | Optional | Current set | Auto queue |
| Visualizer | Off (or last used) | Available | Available / useful for validation + capture |

---

## 9. Acceptance

- Play ↔ Pause works; spacebar works when focused  
- Dual waveform + playhead seek/scrub reliable  
- Hot cues one row; click seeks  
- Grid/beat jump available in Full's Grid & beat panel  
- BPM fine-tune updates the grid, bar counter and beat-jump size together  
- Hot cues use one compact 30px pad style in Mini and Full  
- Waveform keeps the centred reading head and 8× default; Fit still shows the whole track
- Mini leaves maximum library rows visible  
- **Visualizer**  
  - At least one style from each family (2D, 3D, Psychedelic, Particle, Club hybrid)  
  - Style switch is instant and non-destructive  
  - Particle layer can be mixed on top of any style  
  - Record → export clean video (or image sequence) suitable for Resolume Arena  
  - Performance remains smooth on target hardware; visualizer can be disabled  
  - Respects “Reduce motion” preference  

---

*v1.5 — Extended retired: three presentations (Mini, Full, Player view); Full carries the Hot cues ↔ Grid & beat segmented panel; one compact 30px hot-cue pad style in both presentations.*

*v1.4 — Traktor parallel waveform: fixed centre reading head, 8× default, blank track edges, overview playhead line; Full keeps CUE/Play · volume · hot cues; synth chips removed from the track line. (Superseded by v1.5: it had moved the grid tools into an Extended presentation that no longer exists.)*

*v1.1 — Added Spectrum Visualizer (artistic styles + particle mix + Resolume export).*
