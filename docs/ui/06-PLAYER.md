# 06 — Player

**Version:** 1.0 · **Date:** 2026-10-19

Preview and validation only — not a live performance engine.

---

## 1. Modes

| Mode | Height (target) | Contents |
|------|-----------------|----------|
| **Hidden** | 0 | Header toggle restores |
| **Mini** | ~72–88px | Artwork, identity, chips, compact waveform, transport, cue strip, expand |
| **Full** | ~220–280px | Identity, **detailed waveform**, **overview map**, full controls |

- Slides from under main content; header stays fixed  
- Animate height 200–280ms ease-out  
- Defaults: Library → Mini · Preparation → Full · Auto Performance → compact  

---

## 2. Identity strip

- Artwork  
- Title · Artist  
- Chips: BPM · Key · LUFS · bars/phrases as available  
- Elapsed / remaining time  
- Zoom − / + / Fit (Full)  

---

## 3. Waveform & playhead

### Full — two layers

1. **Detailed waveform** — zoomable; beat grid; phrase bands; cue markers  
2. **Overview map** — entire track; zoom-window highlight; cues at small size  

### Mini

- Single compact full-track waveform  

### Playhead

- High-contrast vertical accent line  
- Real-time with audio (RAF; no laggy easing)  
- Click waveform → seek  
- Drag → scrub (preview while dragging when performance allows)  
- Overview shows absolute position  
- Optional **follow playhead** on detailed view  
- Optional snap to beat / bar / cue when grid snap on  

### Waveform elements

| Element | Display |
|---------|---------|
| Amplitude | Accent-colored waveform |
| Beat grid | Vertical lines when analyzed |
| Phrases | Soft bands (intro/verse/drop/outro) |
| Hot cues | Colored markers + letters |
| Playhead | Accent line ± time tooltip on hover |

Loading: skeleton until peaks ready. Empty: “Select a track to preview.”

---

## 4. Transport

- **CUE** — set/return temporary cue (distinct from hot cues)  
- **Play / Pause** — single toggle (play icon ↔ pause icon)  
- **Stop**  
- Spacebar toggles play/pause when player focused  

---

## 5. Hot cues (CDJ-3000 style)

```
[ A ] [ B ] [ C ] [ D ] [ E ] [ F ] [ G ] [ H ]
```

- One horizontal row; equal width; tight gaps  
- Set: letter + time; empty: letter + dashed border  
- Click set cue → move playhead (± start play per preference)  
- Shift-click / context: set, clear, color  
- Numbers `1`–`8` trigger A–H when player focused  

---

## 6. Grid & beat jump (Full / Preparation)

| Group | Controls |
|-------|----------|
| Grid | Snap on/off · Nudge left/right · BPM fine ± · Reset grid |
| Beat jump | ±1, 4, 8, 16, 32 (or −/+ with size) |

Grid edits update waveform immediately and are undoable.  
Beat jump moves playhead by N beats.

---

## 7. View defaults by app view

| | Library | Preparation | Auto Performance |
|--|---------|-------------|------------------|
| Default | Mini | Full | Mini / compact |
| Hot cues | Yes | Primary | Visible |
| Grid / jump | On demand | Visible in Full | Minimal |
| Queue link | Optional | Current set | Auto queue |

---

## 8. Acceptance

- Play ↔ Pause works; spacebar works when focused  
- Dual waveform + playhead seek/scrub reliable  
- Hot cues one row; click seeks  
- Grid/beat jump visible in Preparation Full  
- Mini leaves maximum library rows visible  
