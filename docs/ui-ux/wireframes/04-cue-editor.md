# Wireframe — Cue / Waveform Editor (04)

**Phase:** 2–3 · 📋 Planned
**See also:** [Screens & Flows §4.3](../12-SCREENS-AND-FLOWS.md) · [Canonical §4.3](../../product/CANONICAL_DOCUMENTATION.md)

Full-width waveform with a beat grid, phrase bands, colour-coded cue markers, and an
editable cue list. AI-generated cues are marked and every manual change is a recorded
override.

---

## Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  {1} Deep Horizon — Kael        124 BPM · 8A · 6:12 · FLAC          [ Generate ] [ Export ]    │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {2}   A          B      C           D              E          F        G           H          │
│        ▼          ▼      ▼           ▼              ▼          ▼        ▼           ▼          │
│  {3} ~≈~▁▂▃▅▇▇▇▅▃▂▁▂▃▅▇▇▇▇▇▅▃▂▁▂▃▅▇▇▇▇▇▇▇▅▃▂▁▂▃▅▇▇▇▇▇▇▇▅▃▂▁▂▃▅▇▇▇▇▇▇▇▇▇▅▃▂▁▂▃▅▇▇▇▇▇▅▃▂~≈~      │
│  {4} | intro  |  build   |   drop        |  breakdown   |  drop  |  outro  |                   │
│      0:00    0:45      1:30          2:15           3:00        4:00        5:50               │
│  {5} ├────────┼─────────┼────────────┼─────────────┼────────┼─────────┼──── beat grid (1 bar)  │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {6} Cue    Time     Label                Type      Source                                     │
│────────────────────────────────────────────────────────────────────────────────────────────────│
│      A     0:00     Downbeat             Hot       AI    {8}                                   │
│      B     0:45     Groove entry         Hot       AI                                          │
│      C     1:30     Build start          Hot       AI                                          │
│      D     2:15     Drop (peak)          Hot       AI                                          │
│      E     3:00     Breakdown            Hot       AI                                          │
│      F     3:40     Second drop          Hot       AI                                          │
│      G     4:30     Mix-out window       Hot       User  {9}                                   │
│      H     5:50     Track end (-16)      Hot       AI                                          │
│      ♪     4:10     Vocal warning        Memory    AI                                          │
│      ⏱     4:50     Mix-out deadline     Memory    AI                                          │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│  {7} [ + Add cue ]  [ Quantize ]  [ Undo ]           AI cues stay editable · audio untouched   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Annotations

| # | Element | Behaviour |
|---|---------|-----------|
| {1} | Header | Track identity + **Generate** cues + **Export** |
| {2} | Cue markers (A–H) | Drag to move; snap to the beat grid / 8-bar phase boundaries |
| {3} | Waveform | Zoomable; energy shading; pointer scrubs playback position |
| {4} | Phrase bands | Colour-coded structural sections (intro/build/drop/breakdown/outro) |
| {5} | Beat grid | Bar ruler; zoom reveals beats; cues snap to it |
| {6} | Cue list | Editable table mirroring the markers; keyboard-navigable |
| {7} | Toolbar | Add, quantize to nearest boundary, undo the last change |
| {8} | Source = `AI` | Cue was generated; still fully editable |
| {9} | Source = `User` | Cue was moved/added by the DJ; overrides the AI value |

### Cue slots

| Slot | Standard electronic | Extended club |
|------|---------------------|---------------|
| A | Downbeat | Downbeat |
| B | First rhythmic element / vocal intro | Groove entry (kick + bass) |
| C | Build-up start | Primary melodic element |
| D | Main drop peak | Peak-energy drop |
| E | Breakdown start | Atmospheric breakdown |
| F | Secondary drop | Second peak |
| G | Outro start | Mix-out window (32 bars prior) |
| H | Track end (−8 bars) | Track end (−16 bars) |
| ♪ / ⏱ | Memory cues: vocal warning, mix-out deadline | same |

---

## States

| State | Behaviour |
|-------|-----------|
| **No cues** | Waveform shown; `Generate` is the primary action; cue list empty |
| **Generating** | Short inline progress; existing cues remain visible |
| **Cued** | Markers + list populated; AI cues marked |
| **Edited** | Changed cues switch to `User`; **Undo** becomes available |
| **Playback error** | Waveform still renders; a note explains preview is unavailable |

---

## Interactions

- **Generate** → deterministic structural markers + genre heuristics → 8 hot + memory cues,
  snapped to 8-bar phase boundaries (`T = t0 + k·8·t_bar`).
- **Drag marker** → snaps to the nearest beat/bar; first edit records a user override.
- **Double-click cue row** → rename/relabel.
- **Zoom** → wheel/pinch; keep 60 FPS during zoom (an NFR).
- **Undo** → reverts the last cue change.

---

## Accessibility obligations

- Cue markers are focusable with keyboard equivalents for move/rename.
- The cue list is a real table; the waveform has a text alternative (cue list) for
  non-visual users.
- Colour-coded phrases are also labelled in the cue list / phrase band text.
- Zoom and scrubbing do not rely on motion alone.

---

## Notes

- Cue generation **does not overwrite** existing user cues without permission; every AI cue
  is logged.
- The editor never writes to the source audio; cues are stored locally and exported to
  sidecars.
