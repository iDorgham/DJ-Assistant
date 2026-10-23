# Player Model and Layouts

Last updated: 2026-10-23  
Status: Locked model; visual details proposed

## 1. One engine

DJ Assistant has one audio engine. Mini, Full and Player view are presentations, not separate players.

```text
AudioEngine
  ├── Mini
  ├── Full
  └── Player view
```

State shared across presentations:

- Current track.
- Queue/playlist.
- Playback position.
- Play/pause.
- Cue points.
- Hot cues.
- Loops.
- EQ8.
- Volume.
- Waveform zoom.
- Key lock.
- Output device.

Switching presentation must not restart playback or lose state.

## 2. Mini

Purpose: stay out of the way.

Shows:

- Artwork.
- Title / artist.
- Play/pause.
- Seek bar.
- Time.
- BPM / key.
- Cue indicator.
- Expand button.

Hides:

- EQ8.
- Full cue list.
- Playlist.
- Analysis details.

## 3. Full

Purpose: everyday preparation.

Shows:

- Artwork.
- Waveform.
- Transport.
- BPM / key.
- Cue and hot cues.
- Loops.
- EQ8.
- Volume.
- Playlist toggle.
- Track panel toggle.

## 4. Extended (removed)

Extended was retired on 2026-10-23. It was a taller duplicate of Full whose only
unique content was the grid & beat tools row; those tools now live in Full's
**Hot cues ↔ Grid & beat** segmented row, so deep preparation does not need a
third dock height. See the 2026-10-23 entry in
[`discussions.md`](../06-delivery/discussions.md).

The playlist, track rail, EQ8 and loops once planned for Extended belong to
Player view and later player work, not to a taller dock.

## 5. Player view

Purpose: performance-style view.

Shows:

- Large artwork.
- Large waveform.
- Transport.
- Cues.
- EQ8.
- Playlist by default on wide screens.
- Set Flow overlay optional.
- Key/BPM.
- Time.

Rules:

- No separate engine.
- No separate cue store.
- No separate playlist.
- Escape returns to the previous tab.
- The playlist remains the same playlist.

## 6. Layout rules

- The player dock is anchored at the bottom.
- The dock height is stable per presentation.
- The main workspace scrolls independently.
- The track panel can coexist with the dock.
- Player view can hide the primary navigation on wide screens.
- The dock remains visible when switching tabs.
- The dock can be collapsed to a mini bar.

**Row order (shipped):**

- **Full:** detailed waveform (zoom cluster top-right) → track line (`Title — Artist`, BPM/key, bar counter, time) → overview rail → transport row (`CUE`, Play → volume → hot cues ↔ grid & beat panel → collapse to Mini / hide).
- **Mini:** track line → compact seek rail → transport row; the full-height artwork column sits left of all three.
- **Artwork:** left column only — a 160px cover in Full (184px column), full dock height in Mini (~91px). BPM/key never sit under the artwork.
- **Transport:** Full's row spans the dock width under the rail and carries the Hot cues ↔ Grid & beat segmented panel. In Mini, `CUE`/Play sit immediately right of the artwork column, left of volume.
- **Zoom:** `− / + / Fit / follow` float at the detailed waveform's top-right.
- **Mini height:** default 104px, range 96–139px. Full's range is 230–440px, default 246px; the splitter snaps the unsupported 140–229px gap to the nearer edge.
- No Stop button in any presentation; Pause is the stop-like action.

## 7. Transport behavior

| Control | Behavior |
|---|---|
| Play | Start from current position |
| Pause | Pause at current position |
| CUE | Set cue when stopped; return to cue when playing |
| Hot cue | Jump/trigger |
| Previous | Previous playlist track |
| Next | Next playlist track |
| Seek | Scrub waveform or click |
| Beat jump | Move by beats |
| Loop | Set/activate loop |
| Volume | Master volume |
| EQ8 | Eight-band EQ |

There is no Stop button. Pause is the stop-like action.

## 8. Waveform

Layers:

- Peaks.
- RMS.
- Beat grid.
- Phrase markers.
- Cue markers.
- Hot cue markers.
- Loop region.
- Playhead.
- Set position markers in Player view.

Rules:

- Real peaks only.
- Zoom levels; default **8×** in the detailed view.
- **Traktor parallel view:** the reading head is fixed at the horizontal centre while follow is on; the peaks scroll underneath. The window offset is `position − visibleDuration / 2`, so blank space can appear before 0 and after the end.
- Fit (≤1.05×) shows the whole track and lets the playhead travel across it.
- Click to seek.
- Hover time (hidden over blank pre/post-track regions).
- Keyboard seek.
- Shift/horizontal wheel pans; a manual pan turns follow off and the follow control re-arms it.
- The overview draws the absolute playhead as a 2px line above the zoom-window tint.
- Reduced-motion option.
- High-contrast option.

## 9. Beat grid and phrases

- BPM.
- Downbeat.
- Bar markers.
- Phrase markers.
- Grid offset.
- Manual adjustment.
- Re-analyze.
- Stale analysis warning.

Do not show a grid if analysis is missing.

## 10. Queue and playlist

- Current playlist drives next/previous.
- Queue can be “play next”.
- Playlist order is visible.
- Reordering in Player view edits the draft.
- Save changes explicit.
- Missing tracks are skipped with a warning, not silently.

## 11. Audio routing

- Master output.
- Headphone cue if supported.
- Output device selection.
- Sample rate.
- Buffer.
- Mono/stereo.
- Latency display.
- Test tone.

If headphone routing is not supported by the platform, say so. Do not fake it.

## 12. Player states

| State | UI |
|---|---|
| No track | Empty player |
| Loading | Spinner + file name |
| Playing | Active |
| Paused | Active, paused |
| Missing file | Error state |
| Unsupported format | Error state |
| Analysis missing | Playable, no grid |
| Output unavailable | Warning |
| Device disconnected | Pause + warning |
| Playlist ended | End state |

## 13. Performance rules

- Decode off the UI thread where possible.
- Preload next track.
- Keep waveform peaks in cache.
- Release artwork memory.
- Avoid full-library re-renders on play state changes.
- Use stable keys.
- Throttle time updates.
- Render waveform at device pixel ratio.
- Handle 30,000+ tracks.

## 14. Accessibility rules

- All transport buttons have labels.
- Space toggles play/pause outside text fields.
- Arrow keys seek when the waveform is focused.
- Cue buttons are keyboard reachable.
- Focus is visible.
- Reduced motion disables waveform animation.
- High contrast.
- Screen reader announces track changes.
- Time is announced in text.

## 15. Anti-patterns

- Separate players per layout.
- Fake waveform.
- Stop button.
- Losing state on tab switch.
- Blocking UI on analysis.
- Autoplay without a license.
- Hidden output errors.
- Cue changes that do not persist.
