# Library and Maintain

Last updated: 2026-10-23  
Status: Locked structure; some defaults proposed

## 1. Library

Library is the default tab and the main music workspace.

```text
Library
  Tracks
  Maintain
```

### Tracks views

| View | Use |
|---|---|
| **Table** | Detailed metadata, sorting, bulk work |
| **Artwork grid** | Visual browsing; title, artist, key, BPM |
| **Compact list** | Fast scanning and playlist building |

Rules:

- The selected view persists.
- Filters and sorting persist per view.
- Opening a track opens the shared Track panel.
- Multi-select works the same in every view.
- The player dock remains available.

### Table columns

Default:

- Title
- Artist
- Album
- Genre
- BPM
- Key
- Energy
- Rating
- Duration
- Date added
- Play count
- Last played
- Status

Optional:

- Label
- Year
- Comment
- File path
- Format
- Bitrate / bit depth
- Sample rate
- Tag coverage
- Sync status
- Backup status

### Filters

- Text search
- Artist
- Album
- Genre / Subgenre
- Style
- Mood
- Set Position
- Vocal
- Version
- BPM range
- Key
- Energy range
- Rating
- Play count
- Last played
- Date added
- File format
- Sample rate
- Status
- Sync status
- Missing file
- Duplicate
- Quarantined

Filters combine with AND by default. The user can create OR groups in advanced filter mode.

### Bulk actions

- Edit tags
- Edit genre
- Edit artist
- Edit rating
- Add to playlist
- Remove from playlist
- Analyze
- Re-analyze
- Relink file
- Move to quarantine
- Restore from quarantine
- Export metadata
- Sync selected
- Backup selected metadata

Bulk destructive actions require:

1. Scope summary.
2. Confirmation.
3. Metadata snapshot.
4. Audit log entry.

“Mass edit” threshold is locked: more than 50 tracks or more than 10% of the library, whichever is smaller. It triggers a backup snapshot before the edit.

### Selection

- Click selects.
- `Ctrl/Cmd + click` toggles.
- `Shift + click` selects a range.
- `Ctrl/Cmd + A` selects all filtered results.
- Selection count is always visible.
- Escape clears selection.

### Status chips

Use the shared chips from `01-product/lifecycle-and-vocabulary.md`.

Do not introduce Library-only labels.

## 2. Maintain

Maintain is a full workspace inside Library.

```text
Library  ›  Maintain
  Overview
  Tags
  Genres
  Artists
  Duplicates
  Missing Files
  Unused / Quarantine
  Smart Fixes
  History
```

Maintain is not a top-level tab. It is where library health, cleanup and metadata repair live.

### 2.1 Overview

Purpose: show what needs care and where to start.

Sections:

- Library Health score
- Needs Attention count
- Metadata completeness
- Analysis coverage
- Duplicate count
- Missing file count
- Quarantine count
- Sync conflicts
- Backup health
- Recent fixes
- Quick actions

Proposed Library Health categories:

| Category | What it measures |
|---|---|
| Metadata | Required fields, artist, title, genre, year, label |
| Tags | Genre, style, mood, energy coverage |
| Analysis | BPM, key, beat grid, waveform |
| Files | Missing, corrupt, unreadable, low quality |
| Duplicates | Exact and near duplicates |
| Playlists | Broken entries, orphaned tracks |
| Sync | Unresolved conflicts |
| Backup | Last verified backup age |

Score weights are open. See `06-delivery/open-questions.md`.

### 2.2 Tags

See `maintain-and-tags.md` for the full model.

Summary:

- Hierarchical Genre/Subgenre.
- Flat Style, Mood, Set Position, Vocal, Version, Content, Structure.
- Numeric Energy (1–10).
- Custom tags.
- Aliases, merge, rename, delete with preview and undo.

### 2.3 Genres

Purpose: make genre data consistent without flattening the user's taxonomy.

Features:

- Genre tree.
- Subgenre tree.
- Unmapped genre list.
- Suggested canonical mapping.
- Merge duplicates.
- Rename.
- Add alias.
- Bulk assign.
- Unknown genre bucket.
- Preview affected tracks.
- Undo.

Rules:

- One primary genre path per track.
- Multiple subgenres allowed only if the user enables it.
- Do not silently rewrite genre strings during import.
- Suggested mappings are reviewed.

### 2.4 Artists

Purpose: fix artist identity and aliases.

Features:

- Canonical artist list.
- Aliases.
- Collaboration handling.
- “feat.” parsing.
- Case and punctuation normalization.
- Duplicate artist merge.
- Various Artists handling.
- MusicBrainz ID matching.
- Preview affected tracks.
- Undo.

Rules:

- Do not merge artists by name alone.
- Show conflicts.
- Preserve original display names where possible.
- Do not overwrite `artist` and `album artist` incorrectly.

### 2.5 Duplicates

Duplicate types:

- Exact file hash duplicate.
- Same track, different file format.
- Same ISRC.
- Near duplicate: artist + title + duration within tolerance.
- Duplicate playlist entries.
- Duplicate artist entries.

UI:

```text
Duplicate group
  Track A   FLAC   7:12   320 kbps?   path
  Track B   MP3    7:14   320 kbps    path

[ Keep A ] [ Keep B ] [ Keep both ] [ Compare ] [ Quarantine ]
```

Rules:

- Never auto-delete.
- Default action is review.
- “Keep both” is valid for different versions.
- Quarantine the losing copy, not delete.
- Permanent purge requires explicit confirmation.
- Audit every merge.

### 2.6 Missing Files

Detection:

- Path missing.
- Permission denied.
- Drive disconnected.
- File moved.
- File renamed.
- File corrupted.
- Unsupported format.

Actions:

- Relink.
- Search folder.
- Search whole library.
- Remove from library.
- Move to quarantine.
- Ignore until next scan.
- Open containing folder.

Rules:

- Do not remove a track automatically because a drive is offline.
- Distinguish “missing” from “offline”.
- Keep playlist entries, but mark them unplayable.
- Provide a bulk relink workflow.

### 2.7 Unused / Quarantine

Purpose: reduce library clutter without destroying music.

Suggested filters:

- Never played.
- Not in any playlist.
- Low rating.
- Age in months (user-set).
- No cues.
- No tags.
- Duplicate loser.
- Missing file.
- Low quality.
- Ignored.

Default review:

```text
Cleanup suggestions

[ ] Never played
[ ] Not in playlists
[ ] Rating <= 2
[ ] Added more than [ 12 ] months ago

[ Preview 1,284 tracks ]   [ Quarantine selected ]
```

Rules:

- Quarantine first.
- Never delete from this screen.
- Quarantine keeps metadata and file path.
- Quarantined tracks are excluded from normal views by default.
- Restore is one click.
- Permanent purge is a separate, explicit action.
- Purge requires typed confirmation and a backup snapshot.

Quarantine location:

- A managed folder or a logical state.
- The file is not moved unless the user chooses “move file to quarantine folder”.
- Default: logical quarantine, no file move.

### 2.8 Smart Fixes

Smart Fixes are reviewable recommendations, not silent automation.

Categories:

- Missing title/artist.
- Genre normalization.
- Artist alias.
- Duplicate merge.
- Missing file relink.
- Broken playlist entry.
- Missing BPM/key.
- Stale analysis.
- Inconsistent energy.
- Missing cue/beat grid.
- Unused track suggestion.
- Sync conflict.
- Backup failure.
- Artwork missing (informational; not backed up).
- File path issues.

Each Smart Fix shows:

- What will change.
- How many tracks.
- Risk level.
- Reversible?
- Preview.
- Apply.
- Dismiss.
- Snooze.

Rules:

- No auto-apply without review.
- High-risk fixes require confirmation.
- Every applied fix is in History.
- Undo is available for metadata fixes.
- File moves are reversible where possible.

### 2.9 History

History records:

- Imports.
- Scans.
- Tag edits.
- Genre changes.
- Artist merges.
- Duplicate resolutions.
- Missing file actions.
- Quarantine and restore.
- Purges.
- Smart Fix applications.
- Sync runs.
- Backup runs.
- Restores.
- USB exports.
- Settings changes that affect data.

History item fields:

```text
id
timestamp
action
scope
affected_count
before_summary
after_summary
undo_available
undo_deadline
actor: user | system | sync
```

Rules:

- History is append-only.
- Undo is available where the operation is reversible.
- Purge and restore are not silently undoable; they require a new operation.
- History can be filtered and exported.

## 3. Maintain empty states

| Screen | Empty state |
|---|---|
| Overview | “Your library looks healthy. Keep it that way.” |
| Tags | “No tags yet. Add genre and style tags.” |
| Genres | “No genre problems found.” |
| Artists | “No artist problems found.” |
| Duplicates | “No duplicates found.” |
| Missing Files | “All files are present.” |
| Quarantine | “Nothing is quarantined.” |
| Smart Fixes | “No fixes suggested right now.” |
| History | “No history yet.” |

## 4. Maintain anti-patterns

- Auto-deleting tracks.
- Auto-merging artists.
- Rewriting genres during import without review.
- Hiding quarantined tracks without a way to restore them.
- Making History a separate top-level tab.
- Letting Smart Fixes run as a black box.
- Treating “never played” as proof a track is unwanted.
