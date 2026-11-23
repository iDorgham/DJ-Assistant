# Shell, Navigation and Inbox

Last updated: 2026-10-23  
Status: Locked direction

## 1. Shell

The application shell is stable across every tab:

- Primary navigation
- Global search
- Import Center
- Inbox
- Backup status
- Main workspace
- Player dock

The shell must not change vocabulary or status models between tabs.

## 2. Primary navigation

```text
Library
Playlists
Discover
Statistics
Publish
Settings
```

Rules:

- Library is selected by default.
- The selected tab is visually obvious.
- The player dock remains visible when switching tabs.
- Navigation state is restored on relaunch.
- Deep links open the correct tab and sub-view.

## 3. Top bar

### Global search

- Searches tracks, artists, albums, playlists, tags and settings.
- Recent searches.
- Keyboard shortcut `Ctrl/Cmd + K`.
- Results grouped by type.
- Selecting a track opens the shared Track panel.
- Selecting a playlist opens Playlist → Tracks.

### Import Center

- Opens a panel or full workspace.
- Shows active imports, recent imports, failures and duplicates.
- Badge shows active jobs or unresolved failures.
- Does not replace Library filters.

### Inbox

- Badge shows unresolved Needs Attention count.
- Updates are visible but do not create a red badge unless the user chooses.
- Opens the combined Inbox.
- Supports keyboard navigation.

### Backup status

- Shows `Verified`, `Backing up`, `Failed` or `Not configured`.
- Click opens Settings → Backup.
- Failure creates a Needs Attention item.
- Does not block the app unless the user required a backup before sync.

## 4. Inbox model

The Inbox combines **Needs Attention** and **Updates**. There are no separate notification and attention tabs.

```text
Inbox
  Needs Attention
    Missing files
    Duplicates
    Sync conflicts
    Backup failures
    Import failures
    Analysis failures
    Unreadable files
    Permission problems
    Watch folder review
  Updates
    Import completed
    Maintain daily digest
    Discover weekly digest
    Backup verified
    Sync completed
    USB export completed
```

### Item contract

Every Inbox item has:

```text
id
kind: attention | update
category
severity: info | warning | critical
title
summary
source
created_at
updated_at
entity_refs
primary_action
secondary_actions
dismissible
snooze_until
resolved_at
```

### Rules

- Needs Attention is actionable.
- Updates are informational.
- Dismissing an item does not delete the underlying problem.
- Resolving the problem resolves the item.
- An item can reference multiple tracks, playlists or files.
- Bulk actions show scope before applying.
- Destructive actions require confirmation.
- Every action is recorded in History.

### Filters

- All
- Needs Attention
- Updates
- Import
- Maintain
- Discover
- Sync
- Backup
- USB
- Resolved
- Snoozed

### Grouping

Default grouping:

1. Critical
2. Warning
3. Info
4. Resolved

Within a group, sort by newest first.

## 5. Notification defaults

| Source | Default | User can change |
|---|---|---|
| Watch folder | Immediate (review item by default) | Yes |
| Maintain | Daily digest | Yes |
| Discover | Weekly digest | Yes |
| Sync | On completion and conflict | Yes |
| Backup | On failure and verification | Yes |
| USB export | On completion and failure | Yes |
| Import | On completion and failure | Yes |

Do not notify for every individual file. Batch by job or digest.

## 6. Import Center

Import Center is a top-bar action, not a permanent tab.

Views:

- Active
- Recent
- Failed
- Duplicates
- Watch folder

Actions:

- Add folder
- Add files
- Scan now
- Pause
- Resume
- Retry
- Review duplicates
- Open Inbox
- Clear completed

Import Center shows:

- Source
- Mode (Quick / Curated)
- Progress
- Files found/imported/skipped/failed
- Current stage
- Estimated time
- Cancel

## 7. Backup status

The top-bar status is a compact health indicator.

```text
Backup: Verified 2h ago
Backup: Running 42%
Backup: Failed
Backup: Not configured
```

Clicking opens Settings → Backup & Restore.

Backup failures must include:

- Destination
- Error
- Last successful backup
- Retry action
- Link to logs

## 8. Search and command palette

Search results:

- Tracks
- Artists
- Albums
- Playlists
- Tags
- Settings
- Actions

Commands:

- Play/pause
- Open Library
- Open Maintain
- Open Inbox
- Start import
- Backup now
- Toggle player presentation

The command palette must not become a second navigation system. It is an accelerator.

## 9. Keyboard and focus

- `Ctrl/Cmd + K` — search.
- `Space` — play/pause outside text fields.
- `Ctrl/Cmd + S` — save playlist.
- `Esc` — close dialog/panel.
- `Tab` — next focusable element.
- `Shift + Tab` — previous.
- `Arrow keys` — move within tables and lists.
- `Enter` — open selected item.
- `Delete` — remove selection with confirmation when destructive.

Focus rules:

- Focus returns to the trigger after a dialog closes.
- Focus is never trapped outside a modal.
- The player dock is reachable by keyboard.
- Charts have keyboard-focusable data points or a table alternative.

## 10. Empty states

Every top-level tab needs:

- First-use state.
- No-results state.
- Error state.
- Loading state.

Examples:

- Library empty: “Add a music folder” / “Import files”.
- Playlists empty: “Create your first playlist” / “Import a playlist from a DJ app”.
- Discover empty: “Connect a source or browse free downloads”.
- Statistics empty: “Import tracks to see statistics”.
- Publish empty: “Choose a DJ app to sync”.
- Inbox empty: “Nothing needs attention”.

## 11. Error and offline behavior

- Local library work continues offline.
- Enrichment and Discover wait for network.
- Google Drive backup pauses when offline and resumes.
- NAS backup pauses when unavailable and retries.
- Sync does not run if the target app is open and locked, unless the adapter supports it safely.
- Errors are written to History and Inbox when actionable.

## 12. Shell anti-patterns

- Do not add a dashboard.
- Do not add a separate notifications tab.
- Do not add a separate attention tab.
- Do not add a permanent import tab.
- Do not hide the player dock when navigating.
- Do not use different status chips in different tabs.
- Do not make the user guess where a problem lives.
