# Publish, Sync and USB Export

Last updated: 2026-10-23  
Status: Adapter order and OneLibrary status locked; app matrix and USB details partly proposed

## 1. Purpose

Publish is where DJ Assistant sends approved data to DJ applications and removable USB drives.

```text
Publish
  Sync Library
  USB Export
```

Rules:

- Publishing is explicit.
- Sync never silently overwrites.
- Default DJ-app publishing uses the non-destructive safe payload.
- Legacy four-column mapping is advanced and opt-in.
- Direct database writes are advanced, version-gated and off by default.
- USB export is playlist-only in v1.
- Backups run before sync and mass export.
- Every run is recorded in History.

## 2. Sync Library

### 2.1 Pipeline

```text
Select apps
  → Pull
  → Review
  → Maintain
  → Push
```

### Pull

Read from selected DJ apps:

- Playlists.
- Tracks.
- Metadata.
- Cues.
- Beat grids.
- BPM/key.
- Ratings.
- Play history where available.

### Review

Show a diff:

- Added.
- Removed.
- Changed.
- Conflicts.
- Unmatched.
- Missing files.
- Unsupported fields.

### Maintain

Fix issues in Library or Maintain:

- Relink files.
- Normalize tags.
- Resolve duplicates.
- Choose winners.
- Apply Smart Fixes.

### Push

Write approved changes:

- Only selected fields.
- Only selected apps.
- Only after a backup.
- Only after a dry run.
- With verification.

## 3. App selection

The user chooses which DJ apps participate **per workflow**.

```text
Sync Library

Apps
[x] rekordbox
[ ] Traktor
[ ] Serato DJ Pro
[ ] VirtualDJ
[ ] Engine DJ

Direction
( ) Pull only
( ) Push only
(•) Pull → Review → Push

[ Dry run ]   [ Start sync ]
```

Rules:

- No app is enabled by default.
- An app can be read-only.
- An app can be write-disabled but still pulled from.
- Per-app field selection is advanced but available.
- A sync profile stores the choices.
- Changing the profile does not change historical runs.

## 4. Candidate app matrix

**Adapter order:** rekordbox first, Traktor second. Do not start Traktor until rekordbox is stable end-to-end. Other apps follow only after the second adapter is proven.

This is a **planning matrix**, not a compatibility promise. Each adapter must be validated against real app versions.

| Capability | Traktor | rekordbox | Serato DJ Pro | VirtualDJ | Engine DJ |
|---|---|---|---|---|---|
| Read collection | TBD | TBD | TBD | TBD | TBD |
| Write metadata | TBD | TBD | TBD | TBD | TBD |
| Read playlists | TBD | TBD | TBD | TBD | TBD |
| Write playlists | TBD | TBD | TBD | TBD | TBD |
| Read cues | TBD | TBD | TBD | TBD | TBD |
| Write cues | TBD | TBD | TBD | TBD | TBD |
| Read beat grid | TBD | TBD | TBD | TBD | TBD |
| Write beat grid | TBD | TBD | TBD | TBD | TBD |
| Read play history | TBD | TBD | TBD | TBD | TBD |
| Safe file-based export | TBD | TBD | TBD | TBD | TBD |
| Direct database write | Risky | Risky | Risky | Risky | Risky |

Rules:

- Prefer safe file-based payloads over direct database writes.
- Direct database writes are advanced and version-gated.
- Never write to an app while it is running unless the adapter explicitly supports it.
- Every adapter declares capabilities, versions and limitations.
- Unsupported fields are shown, not silently dropped.
- Cues and beat grids are DJ-app-owned by default, but DJ Assistant reads them for health checks and review.
- Ratings are stored as 0–10 integers and mapped to each app's native scale.

## 5. Source-of-truth proposal

| Field | Proposed default | Notes |
|---|---|---|
| Title / artist / album | Library | Canonical metadata |
| Genre / style / mood | Library | Library tags are the main taxonomy |
| Rating | Library | Pull optional |
| Comments | Library | Do not overwrite app-specific notes without review |
| Playlists | Library for DJ Assistant playlists | Imported app playlists may remain app-owned |
| Cues / loops | DJ app | Performance data usually lives in the DJ app |
| Beat grid | DJ app | Or Library, per app |
| BPM / key | Conflict review | Both may analyze; do not silently replace |
| Play history | Pull only | Merge into Statistics with source labels |
| File path | Library | Local path is canonical |
| Artwork | Library | Cache is not backed up |

This matrix is not locked. See `04-data-and-sync/sync-and-source-of-truth.md` and `06-delivery/open-questions.md`.

## 6. Conflict handling

Conflict types:

- Field conflict.
- Missing file.
- Unmatched track.
- Playlist order conflict.
- Duplicate track.
- Cue conflict.
- Beat grid conflict.
- Unsupported field.
- App version mismatch.
- App locked/running.

Actions:

- Use Library.
- Use DJ app.
- Keep both.
- Merge.
- Skip.
- Always use this choice for this field.

Rules:

- Show before/after.
- Show affected tracks.
- Preview in player.
- Never auto-resolve high-risk conflicts.
- Remember per-field choices only when the user opts in.
- Every resolution is logged.

## 7. Dry run and backups

Before a real sync:

1. Run a dry run.
2. Show the diff.
3. Confirm scope.
4. Create a backup snapshot.
5. Back up affected playlists and metadata.
6. Run the sync.
7. Verify.
8. Record History.

Rules:

- A dry run never writes.
- A backup failure blocks the push by default.
- The user can override with an explicit warning.
- The backup includes metadata; audio is incremental.
- Sync history can be rolled back where the adapter supports it.

## 8. Sync history

```text
Sync run
  id
  started_at
  finished_at
  apps
  direction
  fields
  pulled
  pushed
  conflicts
  skipped
  failed
  backup_snapshot
  dry_run
  status
```

Actions:

- View diff.
- Re-run dry run.
- Roll back.
- Export log.
- Open affected tracks.
- Open Inbox conflicts.

## 9. USB Export

```text
Publish  ›  USB Export
```

v1 scope:

- Playlist-only export.
- Pioneer legacy export.
- Pioneer OneLibrary (experimental until AlphaTheta certification).
- Serato crates.
- In-app format tool.
- Custom USB icon.
- Windows and macOS.

Not v1:

- Full library export.
- Lexicon compatibility.
- Uncertified OneLibrary as a supported feature.
- Automatic background USB writes.

## 10. USB workflow

```text
1. Select playlist
2. Select destination drive
3. Choose format/profile
4. Review tracks and missing files
5. Review file formats
6. Export
7. Verify
8. Eject
```

### Preflight

- Drive detected.
- Free space.
- Filesystem supported.
- Playlist complete.
- All files present.
- All tracks analyzed where required.
- No quarantined tracks.
- No duplicate entries.
- Format profile selected.
- Destination is not the library drive.

### Export

- Copy audio.
- Write metadata.
- Write playlist.
- Write cues where supported.
- Write OneLibrary database where supported.
- Verify checksums.
- Verify track count.
- Verify playlist.
- Eject safely.

## 11. USB format tool

```text
Format USB

Profile
(•) Pioneer legacy
( ) Pioneer OneLibrary
( ) Serato
( ) Generic

Filesystem
( ) FAT32
( ) exFAT

Label
[ DJA_SET_2026 ]

Icon
[ Choose icon ]

[ Format ]   [ Cancel ]
```

Rules:

- Formatting is destructive.
- Require typed confirmation.
- Show the drive identity.
- Never format the library drive.
- Never format a drive with an existing backup without warning.
- Profiles are versioned.
- Hardware validation is required.
- OneLibrary remains experimental until certified.

## 12. USB safety

- Verify destination identity, not just drive letter.
- Detect removable drives.
- Detect free space.
- Detect filesystem limits.
- Handle long paths.
- Handle Unicode.
- Handle file name collisions.
- Handle unsupported formats.
- Handle interrupted copy.
- Resume or restart safely.
- Verify before eject.
- Never leave a half-written USB silently.
- Report “Export complete” only after verification.

## 13. OneLibrary

Status: **experimental / uncertified**.

- Visible in v1 with a clear “experimental” label.
- Not hidden until certification.
- Requires AlphaTheta partner/certification process.
- Do not market as certified.
- Keep the adapter behind a feature flag.
- Test with real hardware.
- Pioneer legacy is the default supported path.
- Do not block Pioneer legacy export.

## 14. Serato crates

- Write crate files.
- Preserve order.
- Handle missing tracks.
- Respect Serato path conventions.
- Validate with Serato DJ Pro.
- Do not write proprietary cue data without validation.

## 15. No Lexicon

Lexicon compatibility is explicitly out of scope.

Do not build a Lexicon importer, exporter or compatibility layer in v1.

## 16. Publish empty states

| State | Message |
|---|---|
| No DJ apps | “Choose a DJ app to sync.” |
| No sync profile | “Create a sync profile.” |
| No USB drive | “Connect a USB drive.” |
| Playlist not ready | “Fix missing files before exporting.” |
| OneLibrary not certified | “OneLibrary export is experimental.” |
| Backup failed | “Backup failed. Sync is paused.” |

## 17. Decisions and open questions

Confirmed:

- rekordbox is the first sync adapter.
- Traktor is the second, after rekordbox is stable.
- DJ app owns cues and beat grids by default; DJ Assistant reads them.
- Ratings are stored 0–10 and mapped per app.
- OneLibrary is visible in v1 as clearly experimental.
- Pioneer legacy is the default supported USB path.
- USB filesystem profiles: FAT32 required; exFAT only for validated hardware profiles; no NTFS.

Still open:

1. Which apps come after rekordbox and Traktor?
2. Which apps are read-only vs read/write?
3. Which fields can be pushed per app?
4. What is the default conflict resolution?
5. Does sync support rollback for every app?
6. Which Serato crate features are in v1?
7. What is the mass-export threshold that triggers a backup?
