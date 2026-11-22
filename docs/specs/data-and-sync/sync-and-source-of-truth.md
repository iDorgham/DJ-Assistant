# Sync and Source of Truth

Last updated: 2026-10-23  
Status: Pipeline locked; app and field matrix open

## 1. Goal

DJ Assistant is the main library, but DJ applications still hold performance data. Sync must reconcile the two without silent overwrites.

```text
Pull → Review → Maintain → Push
```

## 2. Why this order

- **Pull** first: see what changed in the DJ app.
- **Review** second: understand differences before acting.
- **Maintain** third: fix library issues while both sides are known.
- **Push** last: write only approved changes.

Pushing first would overwrite data before the user has seen it.

## 3. User-selected apps

The user chooses which DJ apps participate in each workflow.

```text
Sync profile: “Weekend rekordbox”

Apps
[x] rekordbox
[ ] Traktor
[ ] Serato DJ Pro

Direction
(•) Pull → Review → Push
( ) Pull only
( ) Push only

Fields
[x] Playlists
[x] Tags
[x] Rating
[ ] Cues
[ ] Beat grid
[ ] BPM / key
[x] Comments

[ Dry run ] [ Save profile ]
```

Rules:

- No app enabled by default.
- Per-app profile.
- Per-field selection.
- Read-only mode.
- Push disabled until a dry run passes.
- Sync profile changes are versioned.
- Default publishing uses the non-destructive safe payload.
- Legacy four-column mapping is advanced and opt-in.
- Direct database writes are advanced, version-gated and off by default.
- **First adapter: rekordbox.** Traktor is the second adapter after rekordbox is stable end-to-end.
- One adapter must reach end-to-end stability before a second begins.

## 4. Pull

Read:

- Collection.
- Playlists.
- Track metadata.
- Cues.
- Beat grids.
- BPM/key.
- Ratings.
- Play history where available.
- Hot cues / loops where available.

Rules:

- Never write during Pull.
- Record the app version.
- Record the last sync timestamp.
- Handle app closed/running.
- Handle locked database.
- Handle schema changes.
- Handle missing files.
- Handle unsupported fields.

## 5. Review

The diff view groups changes:

```text
Review changes

Added in app        12
Removed in app       3
Changed metadata    48
Playlist changes     7
Cue changes         22
Unmatched           5
Conflicts            9
```

Per item:

- Entity.
- Field.
- Library value.
- App value.
- Recommended action.
- Confidence.
- Open in Track panel.
- Preview.

Rules:

- Show the scope before applying.
- Allow filter by change type.
- Allow select all/none.
- Bulk decisions only for low-risk fields.
- High-risk fields require individual review.

## 6. Maintain

While reviewing, the user can fix:

- Missing files.
- Duplicate tracks.
- Genre/artist problems.
- Broken playlist entries.
- Missing analysis.
- Cue conflicts.
- Rating conflicts.

Maintain opens the shared Track panel or Maintain workspace. It does not create a separate sync editor.

## 7. Push

Write only:

- Approved fields.
- Approved apps.
- Approved entities.

Before push:

1. Save playlist changes.
2. Create a backup snapshot.
3. Run a dry run.
4. Confirm the diff.
5. Check the app is not locked.
6. Push.
7. Verify.
8. Record History.

Rules:

- No push without a backup by default.
- No push without a dry run by default.
- No push if the app version is unsupported.
- No push if the target is locked.
- No push if the diff changed since review.
- No silent overwrite.

## 8. Source-of-truth matrix

This is a **proposal**. It must be confirmed per app.

| Field | Proposed default | Pull | Push | Notes |
|---|---|---|---|---|
| Title | Library | Yes | Yes | Manual edits win |
| Artist | Library | Yes | Yes | Canonical artist |
| Album | Library | Yes | Yes | Preserve release |
| Genre | Library | Yes | Yes | Library taxonomy |
| Style / Mood | Library | Yes | Optional | May not exist in app |
| Rating | Library | Yes | Yes | Scale must match |
| Comment | Library | Yes | Yes | Review app-specific notes |
| Playlists | Library for DJA playlists | Yes | Yes | Imported playlists may be app-owned |
| Cues | DJ app | Yes | Optional | Performance data |
| Hot cues | DJ app | Yes | Optional | Performance data |
| Loops | DJ app | Yes | Optional | Performance data |
| Beat grid | DJ app | Yes | Optional | Analysis may differ |
| BPM | Conflict review | Yes | Optional | Do not silently replace |
| Key | Conflict review | Yes | Optional | Analysis may differ |
| Play history | Pull only | Yes | No | Label source |
| File path | Library | No | Yes | Local path is canonical |
| Artwork | Library | Optional | Optional | Cache not backed up |
| Energy | Library | Optional | Optional | May not exist in app |

### Why this default

- Library owns editorial metadata.
- DJ app owns performance data.
- Cues and beat grids are owned by the DJ app by default, but DJ Assistant always reads them for health checks and review.
- Analysis fields are conflict-prone; default to review.
- Ratings are stored as 0–10 integers and mapped to each app's native scale.
- Play history is evidence, not a setting.
- File paths must follow the local library.

### Open

- Cues and beat grids may be better owned by the library for users who want one source.
- Some DJ apps cannot write every field.
- Some apps store cues in proprietary databases.
- Some apps expose only XML or crates.
- The matrix must be per-app, not global.

## 9. Conflict model

```text
Conflict
  entity
  field
  library_value
  app_value
  library_updated_at
  app_updated_at
  source
  confidence
```

Resolution:

- Use Library.
- Use DJ app.
- Keep both.
- Merge.
- Skip.
- Apply to all in this run.
- Always use for this field.

Rules:

- Timestamps are evidence, not truth.
- Manual edits win by default.
- Show both values.
- Show the source.
- Show the affected tracks.
- Record the resolution.
- Allow undo where possible.

## 10. Backup before sync

- Metadata snapshot.
- Affected playlists.
- Cues and grids if pushed.
- Incremental audio check.
- Manifest.
- Verification.

If backup fails:

- Block push by default.
- Allow override with a warning.
- Record the override.

## 11. Sync history

```text
Sync run
  started_at
  finished_at
  app
  app_version
  direction
  fields
  dry_run
  pulled
  pushed
  conflicts
  skipped
  failed
  backup_snapshot
  status
```

Actions:

- View diff.
- Open conflicts.
- Roll back.
- Re-run dry run.
- Export log.
- Delete run record (does not undo changes).

## 12. Rollback

Rollback is adapter-dependent.

- Restore the pre-sync snapshot.
- Re-push the previous values.
- Use the app's own undo if available.
- Never claim rollback if the adapter cannot do it.
- Record rollback in History.

## 13. App adapter contract

```text
interface SyncAdapter {
  id
  name
  versions
  capabilities
  detectInstallation()
  readCollection()
  readPlaylists()
  readCues()
  readBeatgrids()
  readHistory()
  dryRun(changes)
  push(changes)
  verify()
  rollback()
}
```

Rules:

- Adapter declares capabilities.
- Adapter declares supported versions.
- Adapter never writes outside declared fields.
- Adapter logs errors with redaction.
- Adapter handles app not installed.
- Adapter handles app running.
- Adapter handles locked database.
- Adapter handles schema change.
- Adapter is feature-flagged.

## 14. App-specific risks

### Traktor

- **Second adapter, after rekordbox is stable.**
- Collection and playlists in NML.
- Cues and grids in collection data.
- Direct edits while Traktor is running are risky.
- Validate NML round-trip.

### rekordbox

- **First adapter.**
- XML export/import is safer than direct database edits.
- Database encryption/versioning.
- USB export is separate.
- OneLibrary requires certification.

### Serato DJ Pro

- Crates are file-based.
- Cue data is proprietary; validate.
- Path conventions matter.
- Database may be locked while running.

### VirtualDJ

- Database format and versioning.
- Validate read/write.
- Do not assume XML is stable.

### Engine DJ

- Engine Library database.
- USB export is separate.
- Validate versioning and hardware.

## 15. Acceptance tests

- Pull from an empty library.
- Pull from a large library.
- Pull with missing files.
- Push a tag change.
- Push a playlist.
- Push a cue.
- Conflict resolution each option.
- App not installed.
- App running.
- App database locked.
- Unsupported version.
- Backup failure blocks push.
- Dry run does not write.
- Rollback.
- Interrupted push.
- Retry.
- 30,000+ tracks.

## 16. Decisions and open questions

Confirmed:

1. First adapter: rekordbox. Traktor second.
2. Cues and beat grids are DJ-app-owned by default; DJ Assistant reads them.
3. Ratings are stored as 0–10 integers and mapped per app.
4. Default publishing uses the safe payload; legacy mapping is opt-in.
5. Default sync conflict policy: Library wins editorial metadata; DJ app wins cues/beat grids; BPM/key require review.

Still open:

1. Is each app read-only, write-only or both?
2. Which fields can each app write?
3. ~~What is the default conflict policy?~~ Resolved above.
4. Is rollback required for every app?
5. Does sync support direct database writes or only safe files?
6. What happens when the app is running?
7. How are imported playlists marked as app-owned?
8. Is there a two-way playlist sync, or is Library always the owner?
