# 06A — Player Presentations, UI & Bar Counter

**Version:** 1.4 · **Date:** 2026-10-23  
**Status:** Canonical UI reference for the three player presentations.  
**Target:** Locked presentation model; visual details proposed where the plan does not fix them.  
**Companions:** [06-PLAYER.md](06-PLAYER.md) · [01-DESIGN-SYSTEM.md](01-DESIGN-SYSTEM.md) · [`../plan/03-player/player-model-and-layouts.md`](../plan/03-player/player-model-and-layouts.md) · [`../plan/02-experience/track-panel-and-player.md`](../plan/02-experience/track-panel-and-player.md)

> **One engine, three presentations.** Mini and Full are different views of the same player state. **Hidden** is a visibility state, not a presentation. **Visualizer Expanded** is an optional visualizer surface, not a third player. Extended was removed; Full swaps between **Hot cues** and **Grid & beat** via a segmented control.

---

## 0. Read this first

| Mark | Meaning |
|------|---------|
| ✅ | Shipped and verified |
| 🟡 | Partially shipped; the target below differs |
| 📋 | Specified here; not implemented yet |
| ⛔ | Blocked or out of scope for v1 |

**Current build:** **Mini** and **Full** exist. Full swaps between hot cues and a compact **Grid & beat** row. Player view is specified here for implementation. The current player uses synthesized preview audio and estimated waveform peaks; the synth disclosure now lives in the Play button's tooltip rather than a track-line chip. There is no Stop button. Those remaining items are **known gaps**, not the target.

**Bar counter:** the small `Bar N.B` readout is a musical *bar/beat position*, not a loudness meter and not the player dock itself. It is specified in §9.

**Player view:** this is the performance-style, full-window presentation. It is a **vertical Winamp-inspired stack**: full player → EQ8 slide-down panel → playlist. The player module keeps the Full composition: identity, detailed waveform, overview and full controls. It is **not** the existing Studio placeholder. Studio is a separate planned mix/timeline workspace.

---

## 1. The three presentations at a glance

| Presentation | Job | Where it lives | Target height | Default entry | Status |
|---|---|---|---:|---|---|
| **Mini** | Stay out of the way while browsing | Bottom dock | 104px (96–139) | Library, Auto Performance | ✅ Layout shipped |
| **Full** | Everyday preparation | Bottom dock | 246px (min 230–440) | Playlists, Preparation | 🟡 Layout shipped; EQ8/loops/playlist missing |
| **Player view** | Performance-style listening | Full window: full player + EQ8 + playlist | Window | Manual, from Full | 📋 Not implemented |
| **Hidden** | No player chrome | — | 0 | Header toggle / close | ✅ |

### 1.1 Height and width summary

| Presentation | Height | Artwork | Identity | Waveform | Utility surfaces |
|---|---:|---:|---|---|---|
| Mini | 104px | 91px (full height) | One row above the rail | 28px full-track seek | A–H pads, expand/hide |
| Full | 246px (230–440) | 160px (184px column) | 24px track line | ~112px detailed + 22px overview | CUE/Play, volume, Hot cues ↔ Grid & beat, dock actions |
| Player view | Window | 160px | Large block | 140–180px detailed + 22px overview | EQ8 drawer, playlist below, Set Flow |
| Hidden | 0 | — | — | — | — |

**Recommended presets:** Mini `104`, Full `246`. The dock supports continuous dragging from `96` to `440`; Player view is a window presentation, not a splitter state.

---

## 2. One engine, one state

```text
AudioEngine
  ├── Mini
  ├── Full
  └── Player view
```

Shared state across every presentation:

- Current track.
- Queue / playlist.
- Playback position and play/pause.
- Temporary CUE.
- Hot cues A–H.
- Loops.
- EQ8.
- Volume and mute.
- Waveform zoom, view offset and follow-playhead.
- Key lock.
- Output device.
- Presentation preference and last visible presentation.

### 2.1 Switching rules

- Switching presentation **must not** restart playback, reseek, reload the waveform, or clear cue/loop/EQ state.
- Switching tabs **must not** hide or reset the player. The dock persists.
- Player view uses the **same** playlist, cue store and audio engine. It is not a second player.
- `Escape` in Player view returns to the previous tab and preserves playback.
- Hiding the player restores the last visible presentation when toggled back.
- A missing or unsupported track keeps the player shell and shows the error state; it does not silently fall back to another track.

### 2.2 Presentation switcher

| From | Visible controls |
|---|---|
| Mini | Expand to Full; hide. |
| Full | `Mini` collapse, hide. |
| Player view | `Back` (Escape), `Full`, hide. |

Use text labels at normal width. Icon-only controls require tooltips and accessible names. Never change presentation on a single click of the waveform or artwork.

**As shipped:** Mini ⇄ Full only. Player view rows are the target; there is no Player-view presentation yet.

### 2.3 Splitter

- Hit area: top 8px of the dock; visible 2px hairline.
- Cursor: `row-resize`; hover/focus uses the accent.
- Role: `separator`; `aria-valuemin=96`, `aria-valuemax=440`, `aria-valuenow=height`.
- Mouse: drag up to grow, down to shrink; double-click resets to the workspace default.
- Keyboard: `↑`/`↓` changes height by 16px; `Enter`/`Space` resets.
- Current behavior: live resize over `96–440px`. Mini tops out at `139px`, Full starts at `230px`, and the splitter snaps the unsupported `140–229px` gap to the nearer edge.
- Presets: Mini `104`, Full `246`.
- Target behavior: snap to the nearest preset on release; Player view is a window presentation, not a splitter state.

---

## 3. Mini

**Purpose:** keep the track glanceable and controllable without stealing library rows.  
**Default:** Library and Auto Performance.  
**Target height:** 104px; allowed 96–139px.

### 3.1 Target layout

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ┌──────┐  Title of the track — Artist    BPM 128  KEY 8A               1:12 / 5:00         │
│ │      │  ▁▂▅█▇▆▅▃▂▁▁▂▅█▇▆▅▃▂▁▁▂▅█▇▆▅▃▂▁  full-track seek (rail)                            │
│ │ 91px │  CUE  ▶   🔊   A B C D E F G H                                ⤢   ×                │
│ └──────┘                                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Anatomy

| Region | Size / position | Content | Behavior |
|---|---|---|---|
| Artwork | 91×91 (dock height − 12px padding), left, full height | Embedded/cached art; music-note fallback | Read-only; tooltip shows title/artist |
| Track line | Full width above the rail | `Title — Artist`, BPM/key chips, elapsed/total time | Truncate with tooltip; time click toggles remaining |
| Chips | 11px mono, 2px radius | BPM, key | Neutral BPM; accent key; unknown shows `—` |
| Rail | 28px high | Full-track peaks, cue dots, playhead, hover time | Click/drag seeks; arrows seek |
| Transport | Left of the row under the rail | CUE, Play/Pause, mute | Play becomes Pause while playing |
| Hot cues | Flex, scrolls at narrow widths | A–H pads | Always visible; never silently dropped |
| Presentation | Far right | Expand to Full, hide | Icon + tooltip |
| Bar counter | Hidden | — | Use Full or larger |
| Volume fader | Hidden | Mute only | Full carries the fader |

### 3.3 Behavior

- The waveform is the seek bar; there is no separate scrubber.
- Hover shows time only, not a bar/beat tooltip.
- `CUE` sets a temporary cue when paused and returns to it when playing.
- Mini hides EQ8, loops, playlist, analysis and the full cue list.
- Expansion preserves playback, position, cues, loops and zoom.
- There is no Stop button in any presentation; Pause is the stop-like action.

### 3.4 Current build notes

- Height is 104px (splitter clamps at 96px); artwork is a full-height 91px square; the rail is 28px.
- Order: **track line → rail → transport row**, with the artwork column spanning all three.
- The A–H hot-cue strip is visible and scrolls horizontally instead of disappearing.
- No bar counter and no volume fader in Mini; the synthesized-audio disclosure lives in the Play button tooltip, not a track-line chip.

---

## 4. Full

**Purpose:** everyday preparation: move through the track, set cues, and listen with enough context.  
**Default:** Playlists and Preparation.  
**Target height:** 246px; minimum 230px (splitter). Full is resizable up to 440px.

### 4.1 Target layout

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ┌────────┐  detailed waveform · grid · phrases · cues      ┃ reading head   − 8.0× + Fit ◉ │
│ │        │  ▁▂▅█▇▆▅▃▂▁▁▂▅█▇▆▅▃▂┃▁▂▅█▇▆▅▃▂▁▁▂▅█▇▆▅▃▂▁▁▂▅█        (peaks scroll under it)    │
│ │ 160px  ├──────────────────────────────────────────────────────────────────────────────────┤
│ │ cover  │  Title — Artist      BPM 128  KEY 8A  Bar 33.2        1:12.40 / 5:00            │
│ │        ├──────────────────────────────────────────────────────────────────────────────────┤
│ │        │  overview map  [==== zoom window ====]  cue ticks · playhead                     │
│ └────────┘                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ CUE  ▶  🔊 ─────   A   B   C   D   E   F   G   H                         ⤡   ⤢   ×          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Anatomy

| Region | Size / position | Content | Behavior |
|---|---|---|---|
| Artwork column | 184px wide, 160px cover top-aligned | Embedded/cached art; music-note fallback | Artwork only — BPM/key live on the track line |
| Detailed waveform | Flex, ≥90px high (112px at the 246px default) | Zoomed peaks, beat grid, bar labels, phrases, cues, CUE, loop, playhead, hover time + bar | Reading head pinned to the centre; click/drag seek; wheel zoom; Shift/horizontal wheel pan; arrows seek |
| Zoom cluster | Top-right of the waveform | Out, multiplier (8.0× default), In, Fit, follow | Affects the detailed waveform only |
| Track line | 24px, above the overview | `Title — Artist`, BPM/key, bar counter, elapsed/total | Time toggles elapsed/remaining |
| Overview map | 22px high | Full track, zoom window, cue dots, absolute playhead line | Click seeks; drag window pans the detailed view |
| Bottom control row | 56px + 1px divider, full dock width under the rail | CUE, Play/Pause, volume, the Hot cues ↔ Grid & beat panel switch, dock actions | Primary actions stay visible; no Stop |
| EQ8 rack | 200–240px wide | Eight mini bands, bypass, reset | Not shipped |
| Presentation | Right of the control row | Collapse to Mini, hide | Same state; no reload |

### 4.3 Behavior

- The top waveform is a **zoomed viewport**, not a duplicate of the overview. The overview always shows 0 to end.
- **Traktor-style parallel view:** while follow is on, the reading head stays on the centre line and the peaks scroll beneath it. The window offset is `position − visibleDuration / 2`, so blank space can appear before 0 and after the end rather than compressing the waveform.
- Default zoom is **8×**. Range is 1× (Fit) to 16×. Fit shows the whole track and lets the playhead travel across it; every zoom above Fit keeps the centred reading head.
- Manual pans (Shift/horizontal wheel, dragging the overview window) turn follow off. The follow control in the zoom cluster re-arms it; **Fit** always shows the whole track.
- Overview click seeks only; the follow effect re-centres the detailed view. The overview playhead is a 2px `dj-text` line above the zoom-window tint, with a small diamond cap.
- The bar counter follows the BPM and grid offset; beat/bar snap applies to seek, scrub, beat jump and loop placement.
- Hot cue pads are compact: 30px tall, colour bar across the top when set, letter and timecode inline, right-click for Call/Delete menu with Escape handling. Empty pads use a dashed border. The strip has horizontal breathing room (px-2) in Mini and scrolls when narrow.
- Full swaps between Hot cues and Grid & beat via a segmented control; grid tools are always accessible without expanding to a taller presentation.
- Playlist and track panel open beside/over the dock without changing playback. On narrow windows they become sheets.
- CUE is the temporary cue; it is not the same as hot cues and not a Stop action.
- No Stop button. Pause is the stop-like action.

### 4.4 Current build notes

- Full is 246px (splitter minimum 230px, overall dock 96–440px); artwork 160px in a 184px column; track line 24px; overview 22px; transport row 56px + divider.
- Order: **waveform → track line → overview rail → transport row**; the artwork column spans the upper region only.
- The artwork is deliberately larger than the Mini cover (160 vs 91).
- Measured at 1296px: waveform 112px, pads ~65–72px wide, no horizontal overflow at 1024px; Mini pads scroll at ~800px with px-2 gutters.
- Hot cues are one compact 30px pad style in both presentations: letter and timecode inline.
- It does **not** yet have EQ8, loops, playlist toggle, track panel toggle, previous/next, or Player view.
- The waveform is estimated and labeled in the tooltip/ARIA (no persistent badge); the synthesized preview audio is disclosed in the Play tooltip, not a track-line chip.
- The bar counter is present in Full. It shows vertical rectangles beside each other (horizontal row of upright bars) to the right of the beat digit.
- There is no `SNAP: Beat` indicator on the waveform. Snap is controlled in Grid & beat.

---

## 5. Extended (removed)

Extended was retired on 2026-10-23. It was a taller duplicate of Full whose only unique content was the grid & beat tools row; those tools now live in Full's **Hot cues ↔ Grid & beat** segmented row, so deep preparation does not need a third dock height.

- `PlayerMode` is `hidden | mini | full`; a persisted legacy `extended` session migrates to `full`.
- The old 380–440px dock height is gone. Full is resizable from 230px to 440px.
- Historical references to a four-presentation model are superseded by this section and the 2026-10-23 decision entry in [`../plan/06-delivery/discussions.md`](../plan/06-delivery/discussions.md).
- The playlist/track/loop/EQ8 rails once planned for Extended are **not** part of Full; they belong to Player view and later player work.

---

## 6. Player view (music player view)

**Purpose:** a focused, performance-style listening surface for validating a set and playing through a playlist.  
**Alias:** “music player view.”  
**Reference:** Winamp-inspired vertical composition — full player, equalizer, dense playlist.  
**Target:** full-window presentation; primary navigation hidden on wide screens.  
**Status:** 📋 not implemented.

### 6.1 Direction

Player view is the **Full player opened into the window**, with EQ8 and the playlist below it. It is one vertical composition, not a three-column workspace and not a stripped compact player.

```text
top bar
  └── full player module
        ├── identity strip
        ├── detailed waveform
        ├── overview map
        ├── transport row
        └── performance row
              └── EQ8 slide-down panel
                    └── playlist
                          └── optional Set Flow overlay
```

- **Everything from Full remains**: identity, detailed moving waveform, overview map, zoom/follow, grid, phrases, cues, loops, hot cues, transport, volume and EQ toggle.
- Within the player module, the only change from Full is composition: it gets the window width. EQ8 and the playlist follow underneath.
- The detailed waveform is the primary scrub surface. Do not replace it with a compact seek strip.
- The playlist is always below the player/EQ stack, never a right-hand rail.
- The content frame uses the window width with 24px gutters, capped at `1440px` and centered. This is a full-window composition, not a narrow side column.
- Winamp is the structural reference: stacked modules, a strong numeric time display, a real equalizer and a dense text playlist. It is not a skin clone.
- Keep Carbon surfaces, 1px borders, Plex Sans/Mono and the existing accent language. No bitmap bevels, fake LEDs or 1990s chrome.
- Player view remains one engine, one playlist and one cue store.

### 6.2 Target layout

```text
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Playlists      PLAYER VIEW · Friday Peak                    Set Flow   −   ×     │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  PLAYER                                                                                    │
│  ┌──────────────┐  Title                                                                   │
│  │   ARTWORK    │  Artist · BPM 128 · KEY 8A · Bar 33.2        1:12.40 / 5:00             │
│  │   160 × 160  │  Zoom −  2.0×  +  Fit   Follow ◉                                      │
│  └──────────────┘                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ DETAILED WAVEFORM  ·  moving viewport · grid · phrases · cues · loop · playhead       │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ OVERVIEW MAP  [════════════ zoom window ════════════]  ·  playhead                    │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
│  CUE   ◀   ▶/❚❚   ▶   LOOP   VOL ────   EQ8 ▾                                             │
│  A B C D E F G H    ◀ 1 4 8 16 32 ▶    SNAP   NUDGE   BPM ±                               │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  EQ8   [ON]  [Bypass]  [Reset]                                          [collapse ▴]       │
│   80      160      320      640      1.2k     2.5k      5k       10k                       │
│   ▮        ▮        ▮        ▮        ▮        ▮        ▮        ▮                        │
├────────────────────────────────────────────────────────────────────────────────────────────┤
│  PLAYLIST · Friday Peak                         12 tracks · 1:04:22             [Save]     │
│  ⠿  TIME    TITLE                                                │ ARTIST                  │
│  ⠿  0:00    Track A                                              │ Artist A                │
│  ⠿  6:12    Track B                                              │ Artist B                │
│  ⠿  5:48    Track C                                              │ Artist C                │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Player module anatomy

The player module is the **Full composition, not a reduced one**.

| Region | Size / position | Content | Behavior |
|---|---|---|---|
| Top bar | 44–48px | Back, context, playlist/set name, Set Flow, minimize/close | Escape/Back returns to previous tab; no restart |
| Identity strip | 160px high (112px artwork on narrow/short windows) | Artwork 160px, title 24/600, artist, BPM/key, bar counter, elapsed/total, zoom/follow | Same hierarchy as Full, scaled up; tooltips carry full text |
| Detailed waveform | Full width, 140–180px (120px under 840px height) | Moving viewport, beat grid, phrase bands, cues, loop region, playhead, hover time + bar | Click/drag seeks; zoom and follow work exactly as Full |
| Overview map | Full width, 22px | Full track, zoom window, cue ticks, playhead | Click jumps; never replaced by the detailed view |
| Transport row | 40px | CUE, previous, play/pause, next, loop, volume/mute, EQ8 toggle | No Stop |
| Performance row | 36px | A–H hot cues, beat jump, snap, nudge, BPM fine | Same controls and state as Full |
| EQ8 | Slide-down drawer | Eight bands, bypass/reset | See §6.4 |
| Playlist | Full width below EQ8 | Time, title, artist | See §6.5 |

- Keep the player module fixed while the playlist scrolls.
- Do not drop the overview, zoom, grid, hot cues or performance row in Player view; they are part of “everything from Full.”
- At short heights the identity artwork and waveform shrink, but the control set remains reachable through wrapping or overflow.

### 6.4 EQ8 slide-down panel

The equalizer sits **directly under the full player module and above the playlist**.

- Closed: only the `EQ8` toggle is visible in the transport row; the playlist expands upward.
- Open: the panel slides down from under the player, pushing the playlist down. It does **not** cover playlist rows.
- Height: `140–170px`; eight vertical sliders in one row.
- Each band: frequency label below, gain value above, vertical track, reset on double-click.
- Header: `EQ8`, `ON`, `Bypass`, `Reset`, collapse chevron.
- Frequencies follow the EQ8 defaults: 80Hz, 160Hz, 320Hz, 640Hz, 1.2kHz, 2.5kHz, 5kHz, 10kHz.
- Inner slider rack caps at `960px` and centers inside the drawer on very wide windows.
- Open/closed state is remembered per user.
- Default: open on first use when the window is tall enough; auto-collapse below `840px` window height or when the playlist would fall below three visible rows.
- Animation: max-height/translate, 200–240ms ease-out. Reduced motion: instant.
- Preserve playlist scroll position when opening/closing.
- On short windows, the panel stays collapsed rather than crushing the playlist; below `560px` it becomes a modal sheet instead.
- Full and Player view share the same EQ8 state; opening EQ8 here does not reset bands.

### 6.5 Playlist

The playlist is a dense full-width table below the EQ drawer.

| Column | Width | Content | Behavior |
|---|---:|---|---|
| Drag | 16px, hover only | Handle | Drag edits draft order |
| Time | 52–64px, left | Track duration `m:ss` | Fixed-width mono; not elapsed time |
| Title | Flex | Track title, 13/500 | Truncate; current track accent |
| Divider | 1px | Vertical rule | Separates title from artist |
| Artist | 28–34% | Artist, 11–12 secondary | Truncate; missing track marked |

- Header: `PLAYLIST · [name]`, track count, total duration, dirty dot, `Save`.
- Keep the table to time, title and artist; do not add BPM/key/energy columns by default.
- Row height: 32–36px; current row gets a 2px accent left border and subtle tint.
- Clicking a row jumps to that track; double-click is not required.
- The current track stays visible when the playlist opens; scroll it into view once.
- The playlist is the same playlist as the main app, in the same order. Reorder is draft-only; Save is explicit.
- Missing tracks remain in the list and are marked unplayable; they are skipped with a warning, not silently removed.
- The playlist scrolls independently; the player and EQ stay fixed.
- Time stays on the left; title and artist stay on the right. At narrow widths, artist wraps under the title.
- Optional row actions (play next, remove, more) appear on hover/focus only and never replace time/title/artist.

### 6.6 Set Flow

- Optional overlay, opened from the top bar or player controls.
- It may cover the right side of the playlist, but must not replace the playlist or stop playback.
- `Escape` closes Set Flow first; a second `Escape` leaves Player view.
- Set Flow uses the same playlist order and real analysis; unknown values show `—`, not invented scores.

### 6.7 Responsive behavior

| Condition | Behavior |
|---|---|
| Width ≥1280px | 1440px max frame, 24px gutters; full waveform and both control rows |
| Width 1024–1279px | Full width; artwork 132px; waveform 120px; performance row may scroll horizontally |
| Width <1024px | Artwork 112px; waveform min 100px; controls wrap without hiding transport |
| Width <760px | Playlist artist wraps under title; time remains left; EQ remains a drawer |
| Height <840px | EQ auto-collapses; artwork 112px; waveform 120px |
| Height <720px | Playlist keeps at least two visible rows; EQ stays collapsed |
| Height <560px | EQ opens as a sheet overlay; player + playlist remain visible |

Primary navigation is hidden at ≥1280px. Back/Escape restores the previous tab.

### 6.8 Boundaries

- Player view is a **presentation**. It must not instantiate a new audio engine, cue store or playlist.
- It is not the existing Studio placeholder. Studio is a separate planned mix/timeline/automation workspace.
- It is not a live DJ deck: no crossfader, no second deck, no FX rack.
- The Winamp reference is structural, not a skin system.
- Escape returns to the previous tab, not to a blank shell.

### 6.9 Current build notes

- No Player view route, full player composition, EQ drawer, playlist table or Set Flow exists today.

---

## 7. Control coverage matrix

`●` visible · `◐` conditional/collapsible · `—` hidden

### 7. Control coverage matrix

`●` visible · `◐` conditional/collapsible · `—` hidden

| Control | Mini | Full | Player view | Notes |
|---|:---:|:---:|:---:|---|
| Artwork | ● | ● | ● | 91 / 160 / 160px |
| Title + artist | ● | ● | ● | Tooltip carries full text |
| BPM + key | ● | ● | ● | 11px mono; key chip follows Camelot colors |
| Bar counter | — | ● | ● | `Bar N.B`; horizontal upright bars beside each other §9 |
| Elapsed / remaining | ● | ● | ● | Click toggles |
| Full-track seek | ● | ● | ● | Mini compact; Full/Player view detailed |
| Detailed waveform | — | ● | ● | Full/Player view; zoomable moving viewport, 16k 3-band peaks |
| Overview map | — | ● | ● | Full track + zoom window; Full/Player view |
| Zoom / follow | — | ● | ● | 1×–16×; default 8× centred |
| CUE | ● | ● | ● | Temporary cue |
| Play / Pause | ● | ● | ● | One toggle |
| Previous / next | — | ● | ● | Playlist order |
| Hot cues A–H | ● | ● | ● | Mini 30px pads with scroll/padding; Full 30px pads, Call/Delete menu, × clear with Undo |
| Loops | — | ● | ● | Requires grid |
| EQ8 | — | ● | ● | Full rack; Player view drawer |
| Grid + beat jump | — | ● | ● | Full "Grid & beat" panel: snap, nudge, BPM fine, beat jump |
| Volume / mute | — | ● | ● | Header volume remains available |
| Playlist | — | ◐ | ● | Toggle in Full; full-width table below EQ8 in Player view |
| Track panel | — | ◐ | — | Side panel wide; sheet narrow |
| Set Flow | — | — | ◐ | Optional overlay |
| Presentation switch | ● | ● | ◐ | Expand/collapse/open/back |
| Hide | ● | ● | ● | Restores last visible |
| Status badges | ● | ● | ● | Estimated waveform moved to tooltip/ARIA; no snap badge |
| Undo toast | ◐ | ◐ | ◐ | Cue clear undo |
| Analysis summary | — | ◐ | ◐ | Never fake values |

---

## 8. Shared anatomy and functions

### 8.1 Identity and track line

**Hierarchy:**
- **Artwork column** — its own left column: full dock height in Mini (91px), a 160px cover at the top of Full in a 184px column. The column carries the cover only; BPM/key never sit under it.
- **Track line** — directly above the rail: `Title — Artist` → BPM → key → bar counter (Full) → elapsed/total time.
- **Zoom / follow** — floats at the detailed waveform's top-right, not on the track line.
- **Presentation controls** — collapse to Mini and hide at the far right of the transport row.

- **Artwork:** per-track embedded/cached art. Fallback is a neutral music icon, never another track's art.
- **Title:** 14/600 at Full, 12/600 at Mini, 24/600 in Player view. Single line with ellipsis and title tooltip.
- **Artist:** 11px secondary; same line as the title, separated by an em dash.
- **BPM:** monospaced. Unknown shows `—`; never invent 124 as real metadata.
- **Key:** Camelot (`8A`) or musical notation per Settings. Unknown shows `—`. Key chip follows the extracted Camelot wheel palette (theme-aware).
- **Time:** monospaced. Mini uses `m:ss`; Full/Player view use `m:ss.ff` hundredths. Click toggles elapsed ↔ remaining; total remains visible.
- **Zoom:** `−`, multiplier/Fit, `+`, Fit, follow. Zoom affects the detailed waveform only. Disable at bounds instead of hiding.
- **Status badges:** `No grid`, `Missing file`, `Output unavailable`. Use warning/danger tokens, not accent. Estimated waveform is disclosed via the waveform title/ARIA and Play button tooltip, not a persistent badge. The synthesized-audio disclosure is the Play button tooltip.

### 8.2 Waveforms

| Layer | Role | Rules |
|---|---|---|
| Compact | Full-track quick seek in Mini | Cue dots + playhead; hover time; no grid labels |
| Detailed | Centred viewport under a fixed reading head | Peaks, RMS/low-frequency core, beat grid, bar labels, phrase bands, cues, loop, playhead, hover time + bar |
| Overview | Entire track at fixed width | Zoom-window highlight, cue dots, absolute playhead line; click seeks |

- The detailed and overview layers are **not the same strip at two heights**.
- Real peaks only. Estimated peaks must be visibly labeled. Never render fabricated analysis as final.
- **Traktor parallel view:** the detailed reading head is locked to the horizontal centre while follow is on, and the waveform scrolls under it. The visible window is `position − visibleDuration / 2`; before 0 and after the end the canvas is intentionally blank instead of clamping the track to an edge.
- Playhead is RAF-locked to audio, high contrast, with top/bottom needle caps. The overview playhead is a 2px `dj-text` line with a diamond cap, drawn above the zoom-window tint.
- **Default zoom is 8×.** Fit (≤1.05×) shows the whole track with offset 0 and lets the playhead travel; every other zoom keeps the centred window.
- Click seeks; drag scrubs; arrows seek ±2s, Shift ±10s; Home/End jump to bounds. Clicking the overview seeks only — the follow effect re-centres the detailed view.
- Wheel zooms; Shift/horizontal wheel pans. A manual pan turns follow off; the zoom cluster's follow control re-arms it.
- Bar labels use `N.1`; sub-beat lines appear only when the visible window is under 60 seconds.
- Cue flags and the temporary CUE marker use distinct shapes/colors; color is never the only identifier.

### 8.3 Transport

| Control | Behavior |
|---|---|
| CUE | Paused: set temporary cue at the playhead. Playing: return to the temporary cue and pause. Distinct from hot cues. |
| Play/Pause | Single toggle. Space outside text fields. |
| Previous | Previous playlist track; warning if missing. |
| Next | Next playlist track; warning if missing. |
| Seek | Click/drag waveform, overview or arrows. |
| Beat jump | Move by selected beats; respects snap/grid. |
| Loop | Set/activate loop; disabled when no grid. |
| Volume | Master preview volume; mute remembered. |
| EQ8 | Eight-band EQ; bypass and reset. |

**No Stop button.** Pause is the stop-like action. The current build's Stop is a documented gap (§14).

### 8.4 Hot cues A–H

```text
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ A   │ │ B   │ │ C   │ │ D   │ │ E   │ │ F   │ │ G   │ │ H   │
│ 1:12│ │ 1:48│ │ 2:30│ │ 3:12│ │  — │ │  — │ │  — │ │  — │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘
```

- One row, equal width. **All presentations:** 30px tall pads; letter and timecode inline. Set pads have a 2px colour bar across the top and a subtle gradient. **Mini:** strip wrapped with `px-2` breathing room on both sides and horizontal scroll at narrow widths.
- Empty: dashed border, muted letter, `—` timestamp. Set: coloured border, top bar, timestamp.
- Click set → jump/trigger; click empty → set at playhead.
- Right-click opens a portal menu with **Call hot cue** and **Delete hot cue** (Escape closes, focus returns). Shift-click clears. The visible `×` on hover clears. Clearing offers a visible Undo toast for about 6 seconds.
- Number keys `1`–`8` trigger A–H when not typing.
- Defaults may place A–D on intro/drop/break/drop 2 for estimated tracks; E–H stay empty.
- Cue changes must persist to the track in the target; localStorage-only persistence is a current gap.
- No color-only meaning: letters and timestamps accompany colors.

### 8.5 Loops

- Controls: `IN`, `OUT`, size (`1/2`, `1`, `2`, `4`, `8`, `16`, `32` beats), `ON/OFF`, `CLEAR`.
- Loop region is drawn on the detailed waveform and mirrored on the overview.
- Quantize to beat/bar when a grid exists; turn controls off with a tooltip when analysis is missing.
- Loop is a player function, not a playlist repeat mode.
- No loop state is lost when switching presentation.

### 8.6 EQ8

Eight bands, not a three-band isolator:

| Band | Type | Default |
|---|---|---:|
| 1 | Low shelf | 80 Hz |
| 2 | Peak | 160 Hz |
| 3 | Peak | 320 Hz |
| 4 | Peak | 640 Hz |
| 5 | Peak | 1.2 kHz |
| 6 | Peak | 2.5 kHz |
| 7 | Peak | 5 kHz |
| 8 | High shelf | 10 kHz |

- Each band: frequency, gain, Q/slope, enable, reset, numeric value, keyboard adjustment.
- Show Hz/kHz and dB; clamp to safe ranges; obvious bypass and reset all.
- Full uses a compact rack; Player view uses a full-width drawer under the full player module.
- In Player view, the eight vertical sliders sit in one row inside the slide-down panel, above the playlist.
- Do not label a three-band control as EQ8.

### 8.7 Grid and beat jump

| Group | Controls | Behavior |
|---|---|---|
| Beat jump | `−` / `+`, size 1 / 4 / 8 / 16 / 32 | Moves by beats; disabled without grid |
| Snap | Off / Beat / Bar | Applies to seek, scrub, loop and jump |
| Nudge | `< NUDGE` / `NUDGE >` | ±10ms grid offset |
| BPM fine | `−0.1` / `+0.1` | Calibrates grid and must update the bar counter |
| Reset | `⟲` | Restores offset and BPM calibration |

- Grid edits update the waveform immediately and are undoable.
- If analysis is missing, do not draw a fake grid. Show `No grid` and disable quantized actions.
- BPM fine-tune is applied to the grid, bar counter and beat jump from the same calibrated value; the track BPM itself is never overwritten.

### 8.8 Playlist and queue

- The current playlist drives previous/next.
- “Play next” inserts a queue item without creating a second playlist.
- Playlist order is visible in Player view; Full gets a playlist toggle in the target.
- Reordering in Player view edits the draft; Save is explicit. Closing dirty shows a prompt.
- Missing tracks are skipped with a warning; never silently removed.
- Player view always uses the same playlist, not a copy.

### 8.9 Track panel

- Opens as a side panel on wide screens; sheet/dialog on narrow screens.
- Tabs: `Overview`, `Analysis`, `Cues`, `File` (implementation may add more without changing the shell).
- Player keeps playing; current track stays highlighted.
- Unsaved changes are indicated; closing dirty prompts.
- Remembers the tab per user unless pinned per track.
- Never blocks playback or analysis.

### 8.10 Status and errors

- Warnings sit in the player shell, not in a transient toast that disappears.
- A missing file stays visible with Relink/Reveal actions.
- Output failure is a persistent warning; do not fake a device.
- An estimated waveform is labeled where the waveform is rendered, not only in Settings.
- Synthesized preview audio is disclosed in the Play button tooltip wherever the player can play.

---

## 9. Bar counter

### 9.1 What it is

The **bar counter** is the player's musical position readout:

```text
Bar 33.2
```

It means **bar 33, beat 2** in 4/4. It is not a loudness bar, not a spectrum, not a playlist position, and not the dock itself.

### 9.2 Exact math (current implementation)

```text
beatMs     = 60000 / BPM
adjustedMs = max(0, positionMs − gridOffsetMs)
totalBeats = adjustedMs / beatMs
bar        = floor(totalBeats / 4) + 1
beat       = floor(totalBeats % 4) + 1
text       = `Bar ${bar}.${beat}`
```

- 4/4 only in v1. Do not fake 3/4, 5/4 or 7/8.
- `gridOffsetMs` is positive when the grid starts later than 0; negative values shift it earlier.
- The current function falls back to `124` when BPM is ≤ 40. **Target:** do not invent a BPM; if analysis/BPM is missing, hide the grid and show `Bar —`.
- Use the calibrated BPM (fine-tune) and the actual grid offset; the counter, beat grid and beat jump all read that same value.
- Clamp at the end of the track; never show a bar beyond the last valid grid position.

### 9.3 Examples at 128 BPM

`beatMs = 468.75ms`, one bar = `1875ms`.

| Position | Counter |
|---:|---|
| 0ms | `Bar 1.1` |
| 469ms (1 beat) | `Bar 1.2` |
| 1875ms (1 bar) | `Bar 2.1` |
| 15,000ms (8 bars) | `Bar 9.1` |
| 60,000ms | `Bar 33.1` |

At 124 BPM, one beat is `483.87ms`, one bar is `1935.48ms`; 60 seconds lands on `Bar 32.1`. Always compute from the actual BPM; never hard-code examples.

### 9.4 Placement and appearance

| Presentation | Placement | Style | Visible |
|---|---|---|---|
| Mini | — | — | No; cue indicator and time instead |
| Full | Track line, after BPM/key, before time | 11px mono, neutral border, 2px horizontal padding | Yes |
| Player view | Under BPM/key, above time | 13px mono; stronger hierarchy | Yes |
| Hidden | — | — | — |

- Use a neutral surface and border; key uses accent, bar counter does not.
- Fixed-width/tabular numerals so values do not jitter.
- Hover title: `Musical position: bar 33, beat 2 · 128 BPM · grid offset +0 ms`.
- Do not make it a button in v1; it is read-only.
- Do not place it in the transport row or confuse it with the waveform's bar labels.

### 9.5 Tooltip, waveform and screen-reader behavior

- Detailed waveform hover shows **time + bar/beat**, e.g. `1:12.40 · Bar 33.2`.
- Bar lines on the detailed waveform are labeled `N.1` at the downbeat.
- The waveform `aria-valuetext` includes time and bar/beat when a grid exists.
- Screen readers hear “Bar 33, beat 2,” not “Bar thirty-three point two.”
- Do not use a live region that announces every beat. Announce on seek, pause or explicit query.

### 9.6 States

| State | Display | Reason |
|---|---|---|
| No track | Hidden | Nothing to count |
| Real analysis + grid | `Bar N.B` | Normal |
| Estimated waveform / no analysis | `Bar —` + `No grid` badge; no grid lines | Do not present estimated grid as real |
| BPM unknown or ≤ 40 | `Bar —` | Do not invent 124 |
| Grid offset | Recalculated from offset | Downbeat moves with grid |
| Position before offset | `Bar 1.1` | Clamp to track start |
| Playlist ended | Last valid value until next load | Preserve last position state |
| Track missing/unsupported | Hidden or `Bar —` | No playback position |

### 9.7 Acceptance for the bar counter

- `Bar 1.1` at the first downbeat; `Bar 2.1` exactly one 4/4 bar later.
- Correct at 124, 128 and non-integer BPMs.
- Grid offset shifts the counter and the drawn downbeat together.
- BPM fine-tune updates both the grid and counter.
- No bar counter or grid is fabricated when analysis is missing.
- Hover, ARIA and visual counter agree.
- No layout shift as digits change.

---

## 10. Interaction and keyboard

### 10.1 Mouse

| Target | Action |
|---|---|
| Player splitter | Drag to resize; double-click resets |
| Waveform | Click/drag to seek/scrub |
| Overview | Click seeks (follow re-centres); drag the zoom window to pan, which turns follow off |
| Wheel over detailed waveform | Zoom in/out |
| Shift/horizontal wheel | Pan visible window |
| Hot cue | Click set/trigger; Shift-click/right-click/`×` clears; Undo toast |
| CUE | Set temporary cue / return and pause |
| Presentation control | Switch without restarting |
| Playlist row | Jump to track; drag edits draft |
| Artwork/title | Tooltip only |

### 10.2 Keyboard

| Shortcut | Action |
|---|---|
| `Space` | Play/pause when focus is not in a text field or owning a native button activation |
| `C` | Temporary CUE |
| `1`–`8` | Hot cues A–H |
| `←` / `→` | Seek −2s / +2s on focused waveform; Shift ±10s |
| `↑` / `↓` | Seek ±2s on focused waveform; on splitter, resize by 16px |
| `Home` / `End` | Start / end of track |
| `Enter` / `Space` on splitter | Reset height |
| `Escape` | Close overlay; in Player view, return to previous tab |
| Wheel / Shift+wheel | Zoom / pan |

- Typing fields own every key; do not hijack inputs, textareas, selects or contenteditable.
- Do not steal `Space`/`Enter` from a focused button, link, slider or separator.
- Focus rings must be visible in both themes.
- Shortcut conflicts are surfaced in Settings → Keyboard.

### 10.3 Focus and state

- Presentation switch keeps focus on the control that caused it where possible.
- Switching from Mini to Full must not drop focus into the waveform unexpectedly.
- After a hot-cue clear, the Undo toast is keyboard reachable.
- After a missing track is selected, focus moves to the error action, not the hidden waveform.

---

## 11. Player states

| State | Mini | Full | Player view |
|---|---|---|---|
| No track | “Select a track” + compact shortcut hint | Empty waveform with “Select a track to preview & validate” + shortcuts | “Nothing playing” + playlist visible |
| Loading | Spinner + filename in identity | Spinner over waveform; transport disabled | Spinner + filename; playlist remains |
| Playing | Play becomes Pause; active accent | Active waveform/playhead; active transport | Full stage active |
| Paused | Pause becomes Play; position held | Position held; no fake motion | Position held |
| Missing file | Warning badge; track title remains | Error block + Relink/Reveal | Error block + next track action |
| Unsupported format | Warning badge | Error block; no fake playback | Error block |
| Analysis missing | Playable; no grid | Playable; `No grid`; bar `—`; quantized tools disabled | Playable; no grid; bar `—` |
| Estimated data | Waveform tooltip/ARIA names it estimated | Same; synth audio in the Play tooltip | Same, visible near waveform |
| Output unavailable | Warning | Persistent warning; transport may remain disabled | Persistent warning |
| Device disconnected | Pause + warning | Pause + warning; no silent fallback | Pause + warning |
| Playlist ended | End state in identity | “Playlist ended” + replay/back | “Playlist ended” + replay |
| Save error | — | Playlist dirty + error; draft retained | Playlist dirty + error; draft retained |

**No silent fallbacks:** never switch to another track, another output device, or a synthetic grid without telling the user.

---

## 12. Visual specification

### 12.1 Dimensions

| Element | Value |
|---|---:|
| Mini height | 104px (96–139) |
| Full height | 246px (min 230, max 440) |
| Splitter hit area | 8px; visible line 2px |
| Mini artwork | 91px (full dock height minus padding) |
| Full artwork | 160px (184px column) |
| Player view artwork | 160px; 132px at 1024–1279px; 112px below 1024px |
| Mini identity width | Full remaining width |
| Full track line height | 24px |
| Mini waveform | 28px high, min 140px wide |
| Detailed waveform | ≥90px high (112px at the 246px default; grows with the dock) |
| Overview | 22px high |
| Full bottom row | 56px + 1px divider, full dock width |
| Hot-cue pad | 30px high, 38–72px wide, 11px letter, 9px timecode |
| Player view player module | 400–460px at full height; 360–400px under 840px |
| Player view detailed waveform | 140–180px high (min 100px) |
| Player view overview | 22px high |
| Player view transport row | 40px |
| Player view performance row | 36px |
| Player view content frame | max-width 1440px, 24px gutters |
| EQ8 rack | 200–240px wide (Full); drawer in Player view |
| EQ8 drawer | 140–170px high (Player view) |
| Player view playlist | Full width below EQ; time 52–64px; artist 28–34% |
| Track rail | 280–320px |

### 12.2 Typography

| Role | Size / weight | Family |
|---|---|---|
| Mini title | 12px / 600 | Plex Sans |
| Full title | 14px / 600 | Plex Sans |
| Player view title | 24px / 600 | Plex Sans |
| Artist | 11px / 400 | Plex Sans |
| BPM/key/bar/time | 11–13px / 500 | Plex Mono, tabular |
| Control labels (`CUE`, `SNAP`) | 10–11px / 600, uppercase | Plex Mono |
| Cue letter | 11px / 700 (all presentations) | Plex Mono |
| Cue timecode | 9px / 500 tabular | Plex Mono |
| Phrase label | 11px / 600, uppercase | Plex Mono |

Use `text.xs` (11px), `text.sm` (12px), `text.md` (13px) and `text.lg` (15–16px) from the design system. Do not introduce a new type scale.

### 12.3 Surfaces and tokens

| Role | Token |
|---|---|
| Dock surface | `bg-dj-panel` |
| Player background | `bg-dj-bg` |
| Chips / raised controls | `bg-dj-elevated` |
| Floating overlay | `bg-dj-overlay` |
| Hover / active | `bg-dj-hover` / `bg-dj-active` |
| Hairline / strong border | `border-dj-border` / `border-dj-border-strong` |
| Primary / secondary / muted text | `text-dj-text` / `text-dj-text-secondary` / `text-dj-text-muted` |
| Accent | `text-dj-accent` / `bg-dj-accent` |
| CUE | `bg-dj-cue` |
| Warning / danger | `text-dj-warning` / `text-dj-danger` |

### 12.4 Waveform colors

| Element | Dark | Light |
|---|---|---|
| Played peak | `#33b1ff` (Cyan 40) | `#0072c3` (Cyan 60) |
| Unplayed peak | `#005d5d` (Teal 70) | `#82cfff` (Cyan 30) |
| Played low-frequency core | `#08bdba` (Teal 40) | `#1192e8` (Cyan 50) |
| Unplayed low-frequency core | `#003d3d` | `#a6c8ff` (Blue 30) |
| Playhead | `#f4f4f4` | `#0f62fe` (Blue 60) |
| Temporary CUE | `#ff832b` (Orange 40) | `#eb6200` (Orange 50) |
| Drop phrase | Carbon Cyan | Carbon Cyan 60 |
| Break phrase | Carbon Purple | Carbon Purple 70 |
| Build phrase | Carbon Yellow | Carbon Yellow 50 |

Cue pad colors are IBM Carbon accents; always pair with the letter and timestamp.

### 12.5 Motion

- Dock height: 250ms ease-out; no content jump after settle.
- Splitter drag: no transition while dragging.
- Playhead: RAF-locked, no laggy easing.
- Reading head: fixed at the centre; the waveform scrolls under it on every RAF tick with no easing.
- Zoom and manual pan apply immediately; do not animate the viewport toward the playhead.
- Hover tooltip: instant/fade only; no bounce.
- Respect `prefers-reduced-motion`: disable waveform auto-scroll, parallax and decorative motion; keep playhead updates and essential state changes.
- Never animate data values (BPM, key, cue times, bar counter) with counting effects.

### 12.6 Responsive behavior

| Width / height | Behavior |
|---|---|
| ≥1280px | 1440px max frame with 24px gutters; full waveform and both control rows |
| 1024–1279px | Full width; artwork 132px; waveform 120px; performance row may scroll horizontally |
| <1024px | Artwork 112px; waveform min 100px; controls wrap without hiding transport |
| <900px wide | Mini may hide the artist line and cue timestamps; never hide transport |
| <760px | Playlist artist wraps under title; EQ remains a drawer |
| Height <840px | Player view EQ auto-collapses; artwork 112px; waveform 120px |
| Height <720px | Player view playlist keeps at least two visible rows; EQ stays collapsed |
| Height <560px | Player view EQ opens as a sheet instead of crushing the playlist |

No mobile layout is required for v1. Do not hide a control without an accessible overflow path.

---

## 13. Accessibility

- Transport, waveform, hot cues, loops, EQ8, playlist and splitter are keyboard reachable.
- Every icon-only control has `aria-label` and a tooltip.
- Waveform uses `role="slider"` with min/max/now and a text value including time and bar/beat.
- Bar counter has a plain-language accessible label; do not rely on the dot notation alone.
- Cue identity is not color-only: letter, timestamp, shape and text accompany color.
- Focus is visible, high contrast, and never trapped behind a floating panel.
- `Space` is play/pause only outside text fields and native activation contexts.
- Screen readers hear track changes and explicit seek/pause updates; no per-beat spam.
- `prefers-reduced-motion` disables waveform auto-scroll and decorative motion.
- High-contrast mode keeps playhead and cues distinguishable from peaks.
- Error and warning badges are text, not color-only dots.
- Hit targets: 28–32px desktop; 40px for primary transport where layout allows.

---

## 14. As-built vs target

| Area | Current | Target |
|---|---|---|
| Mini | ✅ 104px (96–139); full-height 91px art; track line → rail → transport; one 30px letter+timecode A–H strip; no synth chip; no Stop | Same anatomy; keep the strip scrollable at narrow widths |
| Full | 🟡 246px (230–440); identity, centred 8× waveform, overview, transport, one 30px hot-cue strip or the Grid & beat panel; no Extended height | Add EQ8, loops, playlist/track toggles, previous/next |
| Player view | 📋 None | Full-window vertical composition: full player (identity, detailed waveform, overview, controls) → EQ8 drawer → playlist; Set Flow; nav hidden wide |
| Bar counter | 🟡 Full; 4/4; calibrated BPM; grid offset; no real-analysis gating | Player view too; `Bar —` without grid |
| Audio | 🟡 Synthesized timing beat, disclosed in the Play tooltip | Real decoded audio per track; no synth fallback |
| Waveform | 🟡 Estimated peaks; centred reading head; 8× default | Real peaks, RMS and low-frequency data; labeled if estimated |
| Cue persistence | 🟡 localStorage per track | Persist to track/store; survive restart and sync |
| BPM fine-tune | ✅ Calibrated value drives the grid, bar counter and beat jump | Same, once analysis supplies the base BPM |
| Hot cues | ✅ One 30px pad style (both presentations): colour bar, letter + timecode, right-click Call/Delete, × clear with Undo | Persist and sync with the same visual contract |
| Grid tools | ✅ Snap/nudge/BPM/beat jump/reset in Full's Grid & beat panel | Same, plus loops and real analysis gating |
| Visualizer | 📋 Spec only in 06 | Optional overlay; not a player presentation |

**Do not mark the player complete** until Player view, real audio, real peaks, EQ8, loops, the Player view playlist table and bar-counter gating are implemented and verified.

---

## 15. Acceptance checklist

### Presentation switching
- [ ] Mini → Full → Player view keeps playback position and play state.
- [ ] Cues, loops, EQ8, volume, zoom, follow and selection survive switching.
- [ ] Hiding and restoring returns to the last visible presentation.
- [ ] Escape from Player view returns to the previous tab.
- [ ] Splitter works by mouse and keyboard; reset works.

### Layout
- [ ] Mini is 96–139px (default 104) and leaves library rows visible.
- [ ] Full is 230px minimum (default 246) and keeps waveform ≥90px.
- [ ] The splitter snaps across the unsupported 140–229px gap to the nearer edge.
- [ ] The reading head stays centred and the waveform scrolls under it at the default 8× zoom.
- [ ] Hot cues are one 30px letter+timecode pad style in both Mini and Full.
- [ ] Player view is one vertical composition: top bar → full player module → EQ8 drawer → playlist.
- [ ] The player module keeps Full's detailed waveform, overview, zoom/follow, grid, hot cues and performance row.
- [ ] Player view hides nav on wide screens; the playlist is always visible below the EQ.
- [ ] EQ8 sits under the full player, slides down when opened and pushes the playlist down instead of covering rows.
- [ ] EQ8 open/closed state is remembered; it auto-collapses below 840px height.
- [ ] Playlist rows show duration on the left and `title | artist` on the right.
- [ ] Below 760px, the playlist table stays usable without hiding the time column.
- [ ] No control disappears without an overflow path.

### Player functions
- [ ] CUE sets when paused and returns/pauses when playing.
- [ ] Play/pause, previous/next, seek, beat jump and hot cues work.
- [ ] Loops require a grid and draw on both waveform layers.
- [ ] EQ8 is eight bands with bypass/reset.
- [ ] Playlist reorder is draft-only and Save is explicit.
- [ ] Missing file is visible, not silently skipped.
- [ ] Output failure is a persistent warning.

### Bar counter
- [ ] `Bar 1.1` at the first downbeat; `Bar 2.1` one bar later at 124 and 128 BPM.
- [ ] Grid offset and BPM fine-tune update the counter and grid together.
- [ ] `Bar —` and no grid when analysis is missing.
- [ ] Hover, ARIA and visual values agree.
- [ ] No hard-coded 124 fallback in the target.

### Honesty
- [ ] Synth audio is disclosed in the Play tooltip and estimated peaks are labeled wherever they appear.
- [ ] No fake LUFS, BPM, key, cue or waveform data.
- [ ] Stop is absent from the target; Pause is the stop-like action.
- [ ] Visualizer is not presented as a player presentation.

### Accessibility
- [ ] Keyboard reaches all controls; focus is visible.
- [ ] Space does not hijack inputs or native button activation.
- [ ] Waveform has time + bar/beat text value.
- [ ] Hot cues are not color-only.
- [ ] Reduced motion stops auto-scroll/decorative motion.
- [ ] Screen reader announces track changes and explicit seek/pause updates.

---

## 16. Proposed decisions needing sign-off

These are visual details not fixed by the locked plan:

1. Extended default height `420px` vs `400px` — **resolved by removal:** Extended was retired on 2026-10-23; Full carries the grid & beat tools.
2. Full EQ8 as an always-visible compact rack vs a collapsible rack.
3. Mini target cue indicator vs retaining the A–H strip at wide widths.
4. Player view as a routed utility presentation vs a full-window overlay; either must return via Escape.
5. Player view EQ8 open by default vs collapsed by default; this draft chooses open on first use when height allows, with remembered state.
6. Player view EQ8 push-down vs overlay; this draft chooses push-down to keep every playlist row reachable.
7. Player view content frame `1280px` vs `1440px`; this draft uses `1440px` with 24px gutters.
8. Player view control arrangement: one compressed row vs transport + performance rows; this draft uses two rows.
9. Player view artwork `160px` vs `132px`; this draft uses `160px`, `132px` at 1024–1279px and `112px` below 1024px.
10. Playlist artist separator: 1px vertical rule vs a literal `|` glyph; this draft uses the rule.
11. Bar counter in Mini: locked plan implies no; confirm before adding.
12. Whether `Bar N.B` should show a trailing `*` when the grid is estimated. Recommended: no; use a separate `Estimated waveform` / `No grid` badge.

---

*1.4 — Extended retired: Mini and Full are the two dock presentations and Player view is the window presentation. Full keeps the grid & beat tools behind a segmented switch; hot cues are one compact 30px letter+timecode pad style everywhere; BPM fine-tune drives the grid, bar counter and beat jump; the splitter snaps the 140–229px gap. Traktor parallel waveform (centred reading head, 8× default, blank edges), overview playhead line and the moving overview playhead remain.*

*1.3 — Traktor parallel waveform (playhead pinned to the centre, 8× default, blank edges), CDJ-scale 44px hot-cue pads, a clean Full row (CUE/Play · volume · pads · dock actions), a tall Extended tools row, and a moving overview playhead. Synth chips removed from the track line; the disclosure lives in the Play tooltip. Superseded by 1.4, which removed Extended and the 44px pads.*

*1.2 — Refined Player view to the Full player composition at window width, followed by the EQ8 drawer and playlist.*
