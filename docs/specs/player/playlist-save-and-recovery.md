# Playlist Save and Recovery

Last updated: 2026-10-23  
Status: Locked

## 1. Principle

Playlist edits are intentional. The app must protect work without silently changing the saved playlist.

```text
Saved playlist
  ≠
Unsaved draft
  ≠
Crash-recovery draft
```

## 2. States

```text
clean
  → dirty
  → saving
  → saved
  → error

dirty
  → discard
  → clean

dirty
  → crash
  → recovery draft
  → restore
  → dirty
```

### Clean

- No unsaved changes.
- Save is disabled.
- Close is safe.

### Dirty

- Changes are in memory and in the crash-recovery draft.
- Save is enabled.
- Close warns.
- Dirty indicator visible.

### Saving

- Save is in progress.
- Controls that would invalidate the save are disabled or queued.
- Show progress if slow.

### Saved

- Saved playlist is updated.
- Draft is cleared.
- History entry written.
- Dirty indicator cleared.

### Error

- Save failed.
- Keep the draft.
- Show the reason.
- Allow retry.
- Do not discard automatically.

## 3. Save changes

- Explicit Save.
- `Ctrl/Cmd + S`.
- Save button.
- Save before export/sync/USB if the playlist is dirty.
- Save is atomic.
- Save writes a History entry.
- Save does not change the player order until confirmed.

## 4. Crash-recovery draft

- Written after each meaningful edit, debounced.
- Stored outside the saved playlist.
- Includes playlist ID, order, edits, timestamp.
- Does not overwrite the saved playlist.
- Cleared after successful save.
- Recovered on next launch.

```text
We found unsaved playlist changes.

Playlist: Friday Peak Time
Draft saved: 20:42
Changes: 14

[ Review draft ] [ Discard ]
```

Rules:

- Review before restore.
- Show a diff.
- Allow “restore draft” or “discard draft”.
- Never auto-restore without review.
- Never auto-discard a draft.

## 5. Close warning

Normal app close with dirty playlist:

```text
Save changes to “Friday Peak Time”?

[ Save ] [ Discard ] [ Cancel ]
```

Rules:

- Cancel returns to the app.
- Discard keeps the crash-recovery draft? No; discard means discard. Make the consequence clear.
- Save failure blocks close.
- Closing the window is not a save.
- Do not hide the warning behind a toast.

## 6. Undo and redo

- Undo/redo for playlist edits.
- History stack per playlist.
- Undo after save is allowed until the next save? Define: undo creates a new dirty state.
- Undo does not automatically save.
- Redo is available until a new edit.
- Bulk edits are one undo step.
- Drag reorder is one undo step.

## 7. Conflicts

If the playlist changed elsewhere while dirty:

```text
This playlist changed in another view.

[ Compare ] [ Keep mine ] [ Use saved ] [ Cancel ]
```

Rules:

- Never silently overwrite.
- Show both versions.
- Allow merge where possible.
- Record the resolution.

## 8. Autosave boundaries

Autosave only the crash-recovery draft.

Do not autosave the saved playlist.

Do not autosave:

- Sync profile changes.
- USB export settings.
- Tag taxonomy changes.
- Backup settings.

Those have their own save models.

## 9. History

Record:

- Playlist created.
- Playlist renamed.
- Track added.
- Track removed.
- Order changed.
- Track metadata changed from playlist.
- Save.
- Draft restored.
- Draft discarded.
- Conflict resolution.

## 10. Edge cases

| Case | Behavior |
|---|---|
| App crashes | Draft survives |
| OS kills app | Draft survives if flushed |
| Disk full | Save fails; draft remains |
| Database locked | Retry; keep draft |
| Playlist deleted elsewhere | Show conflict; do not resurrect silently |
| Missing track | Keep entry; mark unplayable |
| Track quarantined | Keep entry; mark quarantined |
| USB export while dirty | Prompt to save first |
| Sync while dirty | Prompt to save first |
| Player view reorder | Draft only |

## 11. Acceptance tests

- Edit, close, cancel → still open, dirty.
- Edit, close, save → saved, clean.
- Edit, close, discard → saved state unchanged, draft cleared.
- Edit, crash, relaunch → draft offered.
- Restore draft → dirty with changes.
- Discard draft → saved state unchanged.
- Save fails → draft remains, error shown.
- Reorder in Player view → draft, not saved.
- Sync with dirty playlist → prompt.
- USB export with dirty playlist → prompt.

## 12. Anti-patterns

- Silent autosave to the saved playlist.
- Losing work on crash.
- Auto-restoring a draft without review.
- Discarding a draft without confirmation.
- Saving on window close without telling the user.
- Multiple drafts for the same playlist without a conflict view.
- Making Undo save automatically.
