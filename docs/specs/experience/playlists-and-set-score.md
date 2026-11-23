# Playlists and Set Score

Last updated: 2026-10-23  
Status: Locked structure; score weights locked for v1; smart playlists out of v1

## 1. Purpose

Playlists are where the user prepares music. Set Score is where the playlist becomes a set.

```text
Playlists
  Playlist list
    [Playlist]
      Tracks
      Set Score
```

Set Score is inside Playlists, not a top-level tab.

## 2. Playlist list

Shows:

- Name
- Track count
- Total duration
- Last edited
- Set Score (if scored)
- Set Readiness
- Sync status
- USB status

Actions:

- New playlist
- Rename
- Duplicate
- Delete
- Export
- Add to sync
- Export to USB

Rules:

- Delete requires confirmation.
- Deleting a playlist does not delete tracks.
- Playlist history is recorded.
- Smart playlists are not confirmed for v1.
- Smart playlists are locked out of v1.

## 3. Playlist Tracks

### Layout

```text
Playlist header
  Name · 42 tracks · 2h 18m · Set Score 78

[ Add tracks ] [ Import ] [ Analyze ] [ Sync ] [ USB ]

Track table
  #  Title  Artist  BPM  Key  Energy  Rating  Time  Status
```

### Actions

- Add from Library.
- Drag to reorder.
- Remove.
- Duplicate.
- Bulk edit tags.
- Analyze missing.
- Preview in player.
- Open Track panel.
- Set cue points.
- Mark as played.

### Rules

- Order is meaningful.
- Drag and drop is keyboard-accessible with move up/down actions.
- Missing files are visible and block Set Readiness.
- Duplicate entries are allowed but flagged.
- Playlist edits are explicit.
- The player follows the playlist order.

## 4. Playlist save and recovery

Locked:

- Explicit **Save changes**.
- Autosaved crash-recovery draft.
- Warning on normal app close.
- Undo/redo for playlist edits.
- Dirty indicator.
- Draft recovery on next launch.

```text
Unsaved changes
[ Save ] [ Discard ] [ Cancel ]
```

Rules:

- Normal close warns.
- Crash recovery restores the draft.
- Draft is separate from the saved playlist.
- The user can compare draft vs saved.
- Saving creates a History entry.
- No silent autosave to the saved playlist.

## 5. Set Score

Set Score is the overall quality score of a playlist.

```text
Set Score  78 / 100
Set Readiness  92%
Set Flow  [energy curve]
```

### Set Check

The breakdown:

- Energy curve
- Key flow
- BPM flow
- Vocal balance
- Variety
- Tension and release
- Technical readiness
- Library coverage

Each check shows:

- Score
- Reason
- Affected tracks
- Suggested action
- Preview in player

### Set Readiness

Technical checklist:

- All files present.
- All tracks analyzed.
- BPM/key available.
- Cues present where required.
- No duplicate entries.
- No quarantined tracks.
- Sync state known.
- USB-ready format available.

### Set Flow

Visual curve of:

- Energy
- BPM
- Key movement
- Vocal density
- Tension
- Variety

The curve is interactive:

- Click a point to open the track.
- Drag to reorder.
- Hover for details.
- Toggle layers.

## 6. Scoring signals

| Signal | What it measures | Weight |
|---|---|---|
| Energy curve | Shape, progression, peak placement | 25% |
| Key flow | Harmonic compatibility | 20% |
| BPM flow | Tempo transitions | 15% |
| Vocal balance | Vocal density and contrast | 10% |
| Variety | Repetition, artist/genre diversity | 10% |
| Tension and release | Builds, breakdowns, drops | 10% |
| Readiness | Technical completeness | 10% |

These weights total 100% and are locked for v1. Make them configurable later without changing stored scores.

## 7. Score rules

- Score is a guide, not a verdict.
- Never block playback because of a low score.
- Show reasons, not just a number.
- Every suggestion links to a track.
- Every suggestion can preview in the player.
- The user can override.
- Score is recomputed after playlist changes.
- Score uses real analysis, not placeholders.
- If data is missing, show `Not enough data`, not a fake score.

## 8. Set Score UI

```text
Set Score

78 / 100        Set Readiness 92%

Energy curve
  [interactive curve]

Set Check
  Energy curve        82   Good
  Key flow            74   Two rough transitions
  BPM flow            88   Smooth
  Vocal balance       70   Vocal-heavy middle
  Variety             65   Artist repeated 3×
  Tension/release     80   Good
  Readiness           92   Analysis complete

Suggestions
  Move track 14 later
  Replace track 21
  Add a breakdown before track 30
```

### Suggestions

- Move.
- Replace.
- Add.
- Remove.
- Change order.
- Add cue.
- Analyze.
- Relink.
- Sync.

Each suggestion has:

- Why.
- Confidence.
- Preview.
- Apply.
- Dismiss.

## 9. Player view

On wide screens, Player view opens the playlist by default.

Rules:

- The playlist is visible next to the player.
- The current track is highlighted.
- The next tracks are visible.
- Cues and loops are accessible.
- Set Flow can be shown in the player.
- The player uses the same playlist order.
- Reordering in Player view updates the playlist draft.

## 10. Playlist types

v1:

- Manual playlist.
- Imported playlist.
- Set playlist.

Not confirmed for v1:

- Smart playlist.
- Auto-generated playlist.
- Folder/collection hierarchy.
- Collaborative playlist.

## 11. Import and export

Import:

- From DJ app via Pull.
- From file list.
- From another DJ Assistant backup.
- From CSV/M3U where supported.

Export:

- Sync to DJ app.
- USB export.
- CSV.
- M3U.
- JSON manifest.

Rules:

- Export never mutates the playlist.
- USB export is playlist-only in v1.
- Sync export is metadata-only or playlist-based depending on the app.

## 12. Empty states

| State | Message |
|---|---|
| No playlists | “Create a playlist or import one from a DJ app.” |
| Empty playlist | “Add tracks from your Library.” |
| No score | “Analyze the playlist to see Set Score.” |
| Missing files | “Some tracks need relinking before this set is ready.” |
| No analysis | “Analyze tracks to unlock Set Score.” |

## 13. Anti-patterns

- A separate Set Score tab.
- A score with no explanation.
- Blocking playback until the score is high.
- Auto-reordering a playlist.
- Auto-removing tracks based on score.
- Hiding missing files.
- Silent autosave to the saved playlist.
- Using placeholder BPM/key to make the score look complete.
