# Copy and Microcopy

Last updated: 2026-10-23  
Status: Proposed

## 1. Voice

DJ Assistant sounds:

- Calm.
- Direct.
- Competent.
- Specific.
- Never cute about destructive actions.

Use:

- “Track”
- “Playlist”
- “Set Score”
- “Maintain”
- “Inbox”
- “Quarantine”
- “Permanent purge”
- “Sync”
- “Push”
- “Backup”
- “Restore”

Avoid:

- “Oops”
- “Magic”
- “AI-powered” unless it is literally AI
- “Cleanup” when the action is quarantine
- “Delete” when the action is reversible
- “Synced” when there are unresolved conflicts

## 2. Buttons

| Context | Copy |
|---|---|
| Add music | `Add music` |
| Scan | `Scan folder` |
| Import | `Import` |
| Save playlist | `Save changes` |
| Discard | `Discard` |
| Quarantine | `Quarantine` |
| Restore | `Restore` |
| Permanent purge | `Permanently purge` |
| Sync | `Start sync` |
| Dry run | `Run dry run` |
| Backup | `Back up now` |
| Restore backup | `Restore` |
| Format USB | `Format USB` |
| Eject | `Eject` |

Do not use:

- `OK` for destructive actions.
- `Yes` / `No` in dialogs.
- `Submit`.
- `Proceed` without context.

## 3. Empty states

| Screen | Copy |
|---|---|
| Library | `Your library is empty. Add a music folder or import files.` |
| Playlists | `No playlists yet. Create one or import one from a DJ app.` |
| Discover | `Connect a source or browse free downloads.` |
| Statistics | `Import music to see statistics.` |
| Inbox | `Nothing needs attention.` |
| Maintain | `Your library looks healthy.` |
| Backup | `No backup configured. Choose a destination to protect your library.` |
| USB | `Connect a USB drive to export a playlist.` |

## 4. Errors

Good errors:

- Say what failed.
- Say why, if known.
- Say what to do next.
- Preserve work.
- Link to details.

Examples:

```text
Could not save the playlist.
The database is locked. Try again in a moment.
Your changes are still in the recovery draft.
```

```text
Google Drive upload failed.
The access token expired. Reconnect Google Drive and try again.
```

```text
2 files could not be imported.
Unsupported format: .wma
[ Open Import Center ]
```

Bad errors:

```text
Something went wrong.
Error 500.
Failed.
```

## 5. Confirmations

### Quarantine

```text
Quarantine 24 tracks?

They will be hidden from the Library but can be restored.
No files will be deleted.

[ Quarantine ] [ Cancel ]
```

### Permanent purge

```text
Permanently purge 24 tracks?

This cannot be undone.
The files and their metadata will be removed.

Type PURGE to confirm.
[ input ] [ Permanently purge ] [ Cancel ]
```

### Replace library

```text
Replace the current library?

DJ Assistant will back up the current library first.
If the restore fails, the current library stays in place.

[ Replace ] [ Cancel ]
```

### Format USB

```text
Format “DJA_SET_2026”?

Everything on this drive will be erased.
This cannot be undone.

Type FORMAT to confirm.
[ input ] [ Format USB ] [ Cancel ]
```

## 6. Backup and restore copy

- `Back up now`
- `Last backup`
- `Last verified`
- `Verified`
- `Partial`
- `Failed`
- `Not configured`
- `Keep the last known good backup`
- `5 metadata snapshots`
- `TLS and provider-side encryption`
- `App-level encryption is not enabled`
- `Restore to a new location`
- `Replace current library`
- `Selective restore`
- `Merge into current library`

Do not say:

- `100% safe`
- `Fully encrypted` unless app-level encryption exists
- `Instant backup`
- `Unlimited cloud`

## 7. Sync copy

- `Pull changes`
- `Review changes`
- `Push changes`
- `Dry run`
- `Conflict`
- `Use Library`
- `Use DJ app`
- `Keep both`
- `Skip`
- `Always use this choice for this field`
- `Backup before sync`
- `Sync paused: backup failed`
- `Sync complete with conflicts`

Do not say:

- `Auto-sync` when review is required
- `Overwrite` without context
- `Synced` when conflicts remain

## 8. Discover copy

- `Free download`
- `Name your price`
- `Download enabled`
- `Download not available`
- `Open source`
- `Preview`
- `Save to Watchlist`
- `Add to Inbox`
- `License`
- `Attribution`
- `Promo`
- `Embargo until`
- `Feedback due`

Do not say:

- `Free` when the license is unknown
- `Download` when only streaming is allowed
- `Unlimited`

## 9. Statistics copy

- `Not enough data`
- `Missing BPM`
- `Missing key`
- `Never played`
- `Imported play history`
- `DJ Assistant play history`
- `Whole library`
- `Open in Library`

Do not say:

- `0 BPM` for missing data
- `0 plays` when history is unavailable
- `Trend` from two data points

## 10. Inbox copy

Needs Attention:

```text
3 files are missing.
2 sync conflicts need review.
Backup failed.
```

Updates:

```text
Import complete: 1,204 tracks.
Maintain digest: 18 fixes suggested.
Discover weekly: 6 free downloads.
```

Do not call everything an “alert”.

## 11. Settings copy

- `Destination`
- `Scope`
- `Schedule`
- `Retention`
- `Encryption`
- `Test connection`
- `Disconnect`
- `Advanced`
- `Experimental`

Mark experimental features clearly:

```text
OneLibrary export is experimental and not certified.
```

## 12. Accessibility copy

- Describe icons with action names.
- Announce state changes.
- Provide text equivalents for charts.
- Do not use “click here”.
- Do not use color names as the only instruction.

## 13. Localization readiness

- Avoid concatenated sentences.
- Use placeholders.
- Support plural forms.
- Do not bake text into images.
- Allow longer translations.
- Use logical properties for RTL.
- Format dates and numbers by locale.

## 14. Tone examples

Instead of:

> Oops! Something broke while syncing.

Use:

> Sync stopped before pushing changes.
> rekordbox is open and its database is locked.
> Close rekordbox, then run the dry run again.

Instead of:

> Clean up your library!

Use:

> 1,284 tracks have never been played and are not in a playlist.
> Review them for quarantine.

Instead of:

> Backup complete!

Use:

> Backup verified.
> 31,443 tracks and 863 playlists.
> Last verified: just now.
