# Information Architecture

Last updated: 2026-10-23  
Status: Locked

## 1. Final navigation

```text
┌──────────────────────────────────────────────────────────────┐
│ Global search   Import Center   Inbox   Backup status        │
├──────────────┬───────────────────────────────────────────────┤
│ Library      │                                               │
│ Playlists    │                 Main workspace                │
│ Discover     │                                               │
│ Statistics   │                                               │
│ Publish      │                                               │
│ Settings     │                                               │
├──────────────┴───────────────────────────────────────────────┤
│ Player dock: Mini / Full / Extended / Player view            │
└──────────────────────────────────────────────────────────────┘
```

Primary tabs:

1. Library
2. Playlists
3. Discover
4. Statistics
5. Publish
6. Settings

Persistent actions:

- Global search
- Import Center
- Inbox
- Backup status
- Player dock

## 2. Tab contracts

### Library

**Purpose:** the main music workspace.

v1 has one library. Saved views and tags provide separation; there is no per-library routing, switch, backup target or statistics scope.

Sub-tabs:

- **Tracks** — table, artwork grid and compact list.
- **Maintain** — library health, tags, genres, artists, duplicates, missing files, quarantine, smart fixes and history.

Library is the default landing tab.

### Playlists

**Purpose:** build, edit and score sets.

Sub-tabs inside a playlist:

- **Tracks** — playlist contents, ordering, add/remove, bulk actions.
- **Set Score** — score, breakdown, readiness and flow.

Playlist list is the entry point. Opening a playlist selects Tracks by default. Player view opens the playlist by default on wide screens.

### Discover

**Purpose:** find new music and free downloads.

Views:

- For You
- Free Downloads
- Sources
- Watchlist

Discover is library-aware and local-first. Free downloads from Bandcamp, SoundCloud and label promos come first.

### Statistics

**Purpose:** whole-library insight.

Views:

- Overview
- Genres
- Artists
- BPM & Key
- Play History
- Library Health

Every chart links to a filtered Library. Playlist-scoped statistics are not in v1.

### Publish

**Purpose:** send approved data to DJ applications and USB devices.

Sub-tabs:

- **Sync Library**
- **USB Export**

### Settings

**Purpose:** configure the application.

Sections:

- General
- Library
- Import
- Player
- Audio
- Tags
- Sync
- USB
- Backup
- Notifications
- Privacy
- Advanced

## 3. Persistent chrome

### Global search

- Searches tracks, artists, albums, playlists, tags and settings.
- Opens the shared Track panel or target screen.
- Keyboard shortcut: `Ctrl/Cmd + K`.
- Does not replace Library filters.

### Import Center

- Opened from the top bar.
- Handles folder scan, drag/drop, watch folder results and quick/curated import.
- Shows active jobs, recent imports, failures and duplicates.
- Not a permanent tab.

### Inbox

- Combines Needs Attention and Updates.
- No separate notification or attention tabs.
- Badge shows unresolved items.
- Supports filters, grouping, bulk actions, snooze and dismiss.
- Default delivery:
  - Watch folder: immediate.
  - Maintain: daily digest.
  - Discover: weekly digest.

### Backup status

- Shows last successful backup, verification state and active job.
- Click opens Settings → Backup.
- Failure creates an Inbox item.
- Never blocks normal library work unless the user configured a required backup.

### Player dock

- One engine, four presentations.
- Persistent across tabs.
- Can be collapsed.
- Player view is a presentation, not a separate audio engine.

## 4. Maintain workspace

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

Rules:

- Maintain is inside Library.
- Maintain is not a top-level tab.
- Every Maintain action opens the shared Track panel for affected tracks.
- Every fix has preview, scope and undo where possible.
- Bulk destructive actions require confirmation and a backup snapshot.

## 5. Playlists workspace

```text
Playlists
  Playlist list
    [Playlist]
      Tracks
      Set Score
```

Rules:

- Set Score is inside Playlists.
- Set Score is not a top-level tab.
- Playlist edits use explicit Save changes.
- An autosaved crash-recovery draft exists.
- Normal app close warns about unsaved changes.
- Set Score suggestions preview in the shared player.

## 6. Route map

| Route | Screen |
|---|---|
| `/library/tracks` | Library Tracks |
| `/library/maintain` | Maintain Overview |
| `/library/maintain/tags` | Tags |
| `/library/maintain/genres` | Genres |
| `/library/maintain/artists` | Artists |
| `/library/maintain/duplicates` | Duplicates |
| `/library/maintain/missing-files` | Missing Files |
| `/library/maintain/quarantine` | Unused / Quarantine |
| `/library/maintain/smart-fixes` | Smart Fixes |
| `/library/maintain/history` | History |
| `/playlists` | Playlist list |
| `/playlists/:id/tracks` | Playlist Tracks |
| `/playlists/:id/set-score` | Set Score |
| `/discover` | Discover |
| `/statistics` | Statistics |
| `/publish/sync` | Sync Library |
| `/publish/usb` | USB Export |
| `/settings` | Settings |
| `/settings/backup` | Backup & Restore |

Routes are illustrative; the final router can differ, but the hierarchy must not.

## 7. Cross-navigation rules

- Track identity is global. Any track reference opens the same Track panel.
- Statistics links to Library with filters applied.
- Discover saves to Library or Inbox; it does not create a parallel library.
- Maintain links to affected tracks in Library.
- Sync conflicts link to the comparison view and Inbox.
- Backup failures link to Settings → Backup and Inbox.
- Set Score gaps link to the affected playlist tracks.
- Import failures link to Import Center and Inbox.

## 8. Responsive behavior

Wide screens:

- Sidebar visible.
- Player view can show playlist.
- Table shows more columns.
- Split panes are allowed.

Medium screens:

- Sidebar collapses to icons.
- Table reduces columns.
- Player dock remains available.

Narrow screens:

- Sidebar becomes a drawer.
- Table becomes compact list or cards.
- Player dock becomes mini.
- Set Score stacks vertically.

The application is desktop-first for Windows and macOS. Mobile is out of scope for v1.

## 9. Keyboard and accessibility

- `Ctrl/Cmd + K` — global search.
- `Space` — play/pause when focus is not in a text field.
- `Ctrl/Cmd + S` — save playlist changes.
- `Esc` — close panel/dialog.
- `Tab` order follows visual order.
- Every icon button has an accessible name.
- Charts have table alternatives.
- Focus is never trapped outside dialogs.
- Reduced motion is respected.

## 10. Empty and error states

Every screen must define:

- First-use empty state.
- Cleared/no-results state.
- Loading state.
- Partial/error state.
- Offline state where relevant.
- Permission-denied state.

Empty states must offer the next action, not just an illustration.

## 11. What is not allowed

- A dashboard tab.
- A separate Maintain tab.
- A separate Set Score tab.
- A separate Notifications tab.
- A separate Attention tab.
- A permanent Import tab.
- A second player engine.
- A second library view with different vocabulary.
