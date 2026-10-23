# Track Panel and Player

Last updated: 2026-10-23  
Status: Locked model

## 1. Shared Track panel

There is one Track panel. It opens from every track reference:

- Import
- Library
- Playlist
- Player
- Search
- Discover
- Statistics
- Maintain
- Sync conflict
- USB export

The panel does not change its vocabulary or controls by context. Context only changes the default tab and available actions.

## 2. Track panel contract

```text
Track panel
  Header: artwork, title, artist, album, status
  Tabs: Overview | Tags | Cues | Analysis | Playlists | History | File
  Footer: Play | Add to playlist | More
```

### Overview

- Title
- Artist
- Album
- Label
- Year
- Genre
- BPM
- Key
- Energy
- Rating
- Duration
- Format
- Sample rate
- Bit depth
- Play count
- Last played
- Status chips
- Sync status
- Backup status

### Tags

- Genre path.
- Style.
- Mood.
- Set Position.
- Vocal.
- Version.
- Content.
- Structure.
- Custom.
- Energy.
- Rating.
- Save / cancel.

### Cues

- Cue list.
- Hot cues.
- Loops.
- Colors.
- Names.
- Jump to cue.
- Delete cue.
- Save.

### Analysis

- Waveform.
- Beat grid.
- BPM.
- Key.
- Loudness.
- Phrase markers.
- Re-analyze.
- Stale analysis warning.

### Playlists

- Playlists containing the track.
- Add to playlist.
- Remove from playlist.
- Set position.

### History

- Import.
- Tag changes.
- Playlist changes.
- Sync changes.
- Backup changes.
- Quarantine / restore.
- Audit entries.

### File

- Path.
- Size.
- Hash.
- Format.
- Modified date.
- Relink.
- Reveal in folder.
- Copy path.
- Missing/offline state.

## 3. Panel behavior

- Opens as a side panel on wide screens.
- Opens as a sheet/dialog on narrow screens.
- The player keeps playing.
- The current track stays highlighted.
- Unsaved changes are indicated.
- Closing with unsaved changes prompts.
- Escape closes; if dirty, prompt.
- The panel remembers its tab per user, not per track, unless the user pins a tab.

## 4. Player dock

One engine, four presentations:

| Presentation | Use |
|---|---|
| **Mini** | Persistent compact dock |
| **Full** | Expanded dock with EQ8 and cues |
| **Extended** | Large preparation view |
| **Player view** | Performance-style view; playlist by default on wide screens |

Rules:

- Same audio engine.
- Same playback state.
- Same queue/playlist.
- Same cues.
- Same EQ8.
- Switching presentation does not restart playback.
- The dock can collapse.
- The dock is keyboard-accessible.

## 5. Real audio

- Real files only.
- Real peaks.
- Real beat grid.
- Real analysis.
- No synthetic playback.
- No placeholder waveform.
- No fake BPM/key.

If a file is missing, the player shows an error and the track is marked `Missing File`. It does not play a substitute.

## 6. Transport

- Play / pause.
- Seek.
- Previous / next.
- CUE.
- Hot cues.
- Loops.
- Volume.
- EQ8.
- Waveform zoom.
- Beat jump.
- Key lock (if supported).

There is **no Stop button**. Use pause and return-to-cue behavior instead.

## 7. EQ8

EQ8 is an eight-band EQ, not a three-band DJ isolator.

See `03-player/eq8-and-cue.md`.

## 8. CUE and hotcues

Traktor-style behavior:

- CUE sets the cue point.
- CUE while playing returns to cue.
- Hot cues trigger.
- Hot cues can be set while stopped or playing.
- Hot cue colors and names.
- Delete with modifier or context menu.
- Persist to the track.

See `03-player/eq8-and-cue.md`.

## 9. Playlist in Player view

On wide screens, Player view opens the current playlist by default.

- Current track highlighted.
- Upcoming tracks visible.
- Click to jump.
- Drag to reorder (draft).
- Set Flow overlay optional.
- Cues visible.
- Save changes explicit.

## 10. Accessibility

- Keyboard transport.
- Screen-reader labels.
- Focus order.
- Reduced motion.
- High contrast.
- Waveform alternatives.
- No color-only cues.
- Adjustable text size.
- Captions for any video/tutorial content.

## 11. Performance

- Waveform rendering off the main thread.
- Preload next track.
- Cache peaks.
- Limit memory for artwork.
- Avoid re-rendering the whole library on play state changes.
- Handle 30,000+ tracks.
- No blocking analysis on the UI thread.

## 12. Anti-patterns

- A second player for Player view.
- Fake waveform data.
- A Stop button.
- Three-band EQ pretending to be EQ8.
- Cue behavior that differs by screen.
- Losing playback when switching tabs.
- Blocking the UI while analyzing.
- Autoplaying purchased or streamed content without a license.
