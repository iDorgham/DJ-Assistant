# Backup and Restore

Last updated: 2026-10-23  
Status: Locked decisions; Google Drive implementation proposed

## 1. Purpose

Backup protects the library, the metadata and the work that would be expensive to recreate.

Restore must actually work. A backup that was never verified is not a backup.

## 2. Locked decisions

| Decision | Final |
|---|---|
| Library scope | One library in v1; no per-library targets |
| Audio files | Included |
| Metadata | Included |
| Destinations | External drive, NAS, Google Drive |
| Cloud v1 | Google Drive only |
| Google account | Personal accounts first; Workspace untested |
| Later cloud | S3-compatible, Dropbox |
| NAS | SMB/UNC path first |
| Schedule | Daily + before sync + before mass edits |
| Retention | 5 metadata snapshots + last known good full backup |
| Audio mirror | 1 per destination |
| Cache | Do not back up artwork or waveform caches |
| Encryption | TLS + provider-side encryption now; app-level later |
| Restore modes | New location, replace, selective, merge |
| Restore order | New location → replace → selective → merge |

## 3. Backup targets

```text
BackupTarget
  ├── ExternalDriveTarget
  ├── NasTarget
  └── GoogleDriveTarget
```

### External drive

- Detect by volume identity, not drive letter.
- Check free space.
- Check filesystem.
- Handle disconnect.
- Pause/resume.
- Eject safely.
- Never use the library drive as the destination.

### NAS

- Windows: `\\NAS\Share\DJA-Backup`
- macOS: mounted SMB volume.
- Credentials in OS keychain.
- Test connection before starting.
- Check free space and permissions.
- Pause/resume if unavailable.
- Do not store credentials in the database.
- Do not assume the NAS is always mounted.
- SMB signing/encryption depends on the OS and NAS configuration.

### Google Drive

- v1 targets personal Google accounts.
- Workspace is untested; admin policy may block the app or scope.
- OAuth 2.0 desktop flow.
- PKCE.
- `drive.file` scope.
- App-created folder: `DJ Assistant Backups`.
- Refresh token in OS keychain.
- No client secret embedded in the frontend.
- Resumable uploads.
- Retry with backoff.
- Verify uploaded size and checksum.

## 4. Backup scope

Included:

- Audio files.
- Library database.
- Tags.
- Playlists.
- Cues.
- Beat grids.
- BPM/key.
- Ratings.
- Comments.
- Settings.
- Sync state.
- Backup manifests.

Excluded:

- Artwork cache.
- Waveform cache.
- Temporary analysis files.
- Logs.
- Thumbnails.
- Search index.
- Preview cache.

Notes:

- Embedded artwork inside audio files remains because the audio file is backed up.
- Waveforms and artwork can be regenerated.
- Excluding caches keeps backup size and upload time manageable.

## 5. Schedule and triggers

```text
Daily
Before sync
Before mass edits
```

### Daily

- At a user-selected time.
- Only when idle.
- Metadata snapshot + incremental audio.
- Skip if a backup is already running.
- Retry on failure.

### Before sync

- Automatic.
- Metadata snapshot.
- Affected playlists and cues.
- Incremental audio check.
- Runs before any push.
- If it fails, push is blocked by default.

### Before mass edits

- Triggered by bulk metadata edits, file moves, tag rewrites or quarantine.
- Metadata snapshot.
- Affected files.
- Incremental audio.
- Threshold: more than 50 tracks or more than 10% of the library, whichever is smaller.
- The threshold is a backup trigger, not a blocking confirmation dialog.

## 6. Retention

```text
Keep 5 metadata snapshots
Keep the last known good full backup
Keep 1 audio mirror per destination
```

Rules:

- Metadata snapshots are small.
- Audio is mirrored once and updated incrementally.
- The last known good full backup is never pruned automatically.
- A snapshot must be verified before it can become “last known good”.
- Pruning requires the user or a documented retention policy.
- Pruning never deletes the only verified copy.
- Cloud retention respects the provider.
- The UI shows what will be deleted before pruning.

## 7. Encryption

v1:

- TLS in transit.
- Google Drive encryption at rest.
- OS keychain for refresh tokens and credentials.
- Private app folder.
- No plaintext secrets in logs or database.

Later:

- App-level encryption.
- User-managed recovery key.
- Encrypted metadata.
- Encrypted audio.

Rules:

- Do not claim end-to-end encryption.
- Do not claim app-level encryption before it exists.
- If the user enables app-level encryption later, define key recovery.
- A lost key is unrecoverable; say so.

## 8. Architecture

```text
BackupJob
  queued
  → scanning
  → snapshotting database
  → copying audio
  → uploading metadata
  → verifying checksums
  → done | failed | cancelled | paused
```

### Job fields

```text
id
target_id
trigger
status
started_at
finished_at
bytes_total
bytes_done
files_total
files_done
current_file
error
snapshot_id
```

### Rules

- One job per target at a time.
- Jobs are resumable.
- A job can be paused and resumed.
- A job can be cancelled safely.
- A cancelled job leaves a partial staging area, not a broken snapshot.
- A failed job does not overwrite the last known good backup.
- The UI shows progress and estimated time.

## 9. Folder layout

### Local / external / NAS

```text
DJA-Backup/
  audio/
    Artist/Album/Track.mp3
  snapshots/
    2026-10-23_20-15-00/
      manifest.json
      library.db
      settings.json
      checksums.json
      audio-manifest.json
  latest.json
```

### Google Drive

```text
DJ Assistant Backups/
  audio/
    <hash>/Track.mp3
  snapshots/
    2026-10-23_20-15-00/
      manifest.json
      library.db
      settings.json
      checksums.json
      audio-manifest.json
  latest.json
```

Rules:

- Use file/folder IDs, not names, for Google Drive operations.
- Use content hashes for cloud audio object names.
- Store relative paths in manifests.
- Handle Unicode normalization.
- Handle long paths.
- Do not depend on drive letters.
- Do not store secrets in manifests.

## 10. Manifest

`manifest.json`:

```json
{
  "version": 1,
  "snapshot_id": "2026-10-23_20-15-00",
  "created_at": "2026-10-23T20:15:00Z",
  "app_version": "0.x.x",
  "target": "google_drive",
  "scope": {
    "audio": true,
    "metadata": true,
    "artwork_cache": false,
    "waveform_cache": false
  },
  "counts": {
    "tracks": 31443,
    "playlists": 863,
    "files": 31443
  },
  "database": {
    "path": "library.db",
    "sha256": "..."
  },
  "audio_manifest": "audio-manifest.json"
}
```

`audio-manifest.json`:

```json
{
  "files": [
    {
      "relative_path": "Artist/Album/Track.mp3",
      "hash": "...",
      "size": 12345678,
      "track_id": "..."
    }
  ]
}
```

## 11. Database snapshot

1. Checkpoint WAL.
2. Use SQLite backup API or `VACUUM INTO`.
3. Open the snapshot and run `PRAGMA integrity_check`.
4. Count tracks, playlists, cues, tags.
5. Write manifest.
6. Compare counts with the live database.
7. Mark `verified` or `partial`.

Rules:

- Do not copy a live database file while writes are happening.
- Do not block the UI for the entire snapshot.
- Do not mark success before integrity checks.
- If the database is locked, retry with backoff.

## 12. Audio copy

- Hash each file.
- Skip unchanged files by hash and size.
- Copy to staging.
- Verify size and hash.
- Commit to the snapshot.
- Keep the last known good copy.
- Handle file changes during copy.
- Handle locked files.
- Handle missing files.
- Handle permission errors.

Rules:

- Do not copy a file that changed during the copy without re-reading.
- Do not silently skip a missing file; record it.
- A snapshot with missing files can be `partial`, not `verified`.
- Audio mirror is incremental.

## 13. Google Drive integration

### Setup

1. Google Cloud project.
2. Enable Google Drive API.
3. OAuth consent screen.
4. Scope: `https://www.googleapis.com/auth/drive.file`.
5. OAuth client type: Desktop app.
6. PKCE.
7. Loopback redirect: `http://127.0.0.1:<port>`.
8. Refresh token in OS keychain.

### Folder

- App creates `DJ Assistant Backups`.
- Store folder ID.
- Do not rely on the folder name.
- User can disconnect and reconnect.
- User can revoke access in Google Account settings.

### Upload

- Resumable upload.
- Chunked upload.
- Exponential backoff.
- Retry on 429/5xx.
- Verify size and checksum.
- Store hash in `appProperties`.
- Skip existing objects by hash.
- Pause/resume.
- Bandwidth limit.
- Estimate time.
- Show provider errors clearly.

### Quotas

- Google Drive enforces daily upload limits and API quotas.
- Commonly 750 GB/day per user; verify current Google limits.
- Large audio libraries may take days.
- Show a warning before the first full upload.
- Allow scheduling outside working hours.
- Do not promise instant cloud backup.

### Security

- `drive.file` only.
- No full-drive scope.
- No client secret in the frontend.
- Tokens in OS keychain.
- Redact tokens in logs.
- Allow disconnect and revoke.
- Handle account change.
- Handle revoked token.
- Handle expired token.

## 14. NAS integration

- SMB/UNC path.
- Credentials in OS keychain.
- Test connection.
- Check free space.
- Check write permission.
- Check SMB version.
- Handle disconnect.
- Handle sleep.
- Pause/resume.
- Retry.
- Do not store credentials in logs.
- Do not back up to the same physical device as the library.
- On macOS, handle mount/unmount.
- On Windows, handle UNC and mapped drives.

## 15. Verification

A backup is `verified` only if:

- Database integrity check passes.
- Manifest exists.
- Track count matches.
- Playlist count matches.
- Audio manifest exists.
- Every expected audio file is present.
- Checksums match.
- The snapshot can be opened.
- The snapshot can be read by the restore code.

Status:

```text
pending
verified
partial
failed
```

Rules:

- Show `Last backup` and `Last verified` separately.
- A `partial` backup is not the last known good.
- A failed verification creates an Inbox item.
- Periodic restore tests are recommended.
- Do not mark a backup successful just because the copy finished.

## 16. Restore modes

All four are in v1. Build in this order:

1. New location.
2. Replace current library.
3. Selective.
4. Merge.

### 16.1 New location

- Restore to a new folder.
- Do not touch the current library.
- Open the restored library as a separate library.
- Verify before opening.
- Safest mode.

### 16.2 Replace current library

- Back up the current library first.
- Restore to staging.
- Verify.
- Swap.
- Keep a rollback copy.
- Record History.
- If anything fails, keep the current library.

### 16.3 Selective

- Choose playlists, tracks, settings or metadata.
- Restore into the current library.
- Show conflicts.
- Do not overwrite silently.
- Record History.

### 16.4 Merge

- Match by file hash.
- Then ISRC.
- Then MusicBrainz ID.
- Then normalized artist + title + duration.
- Show conflicts.
- Allow keep both, use backup, use current, skip.
- Preserve playlists and cues.
- Record every decision.
- Hardest mode; build last.

## 17. Restore workflow

```text
1. Choose snapshot
2. Choose mode
3. Preview
4. Back up current library
5. Restore to staging
6. Verify
7. Apply
8. Record History
9. Notify Inbox
```

Rules:

- Never restore over the current library without a backup.
- Never restore a `failed` snapshot.
- A `partial` snapshot requires explicit confirmation.
- Show what will change.
- Show missing files.
- Show disk space.
- Allow cancel.
- Resume downloads where possible.
- Verify after restore.

## 18. Restore conflict rules

| Conflict | Default |
|---|---|
| Same file hash | Keep one, merge metadata |
| Same ISRC | Review |
| Same artist/title/duration | Review |
| Different metadata | Show both |
| Different cues | Show both |
| Different playlists | Merge, keep order |
| Missing file in backup | Keep current if present |
| Missing file in current | Restore from backup |
| Duplicate after merge | Quarantine, do not delete |

## 19. UI

### Backup

```text
Settings  ›  Backup & Restore

[ Backup now ]   [ Restore ]   [ Verify ]

Destination
( ) External drive
( ) NAS
(•) Google Drive

Google Drive
Account: user@gmail.com
Folder: DJ Assistant Backups
[ Connect ] [ Disconnect ] [ Test ]

Scope
[x] Audio files
[x] Library database and metadata
[ ] Artwork cache
[ ] Waveform cache

Schedule
[x] Daily
[x] Before sync
[x] Before mass edits

Retention
Keep [ 5 ] metadata snapshots
Keep the last known good full backup

Encryption
TLS + Google Drive encryption at rest
App-level encryption: later

Status
Last backup: 2 hours ago
Last verified: 2 hours ago
Size: 42.1 GB
Pending upload: 2.4 GB
Estimated time: 18 minutes
```

### Restore

```text
Restore

Snapshot: 2026-10-23 20:15
Contains: 31,443 tracks · 863 playlists · 42.1 GB

Mode
( ) New location
( ) Replace current library
( ) Selective
( ) Merge

[ Preview restore ]   [ Restore ]
```

## 20. History and audit

Record:

- Backup started/completed/failed.
- Verification result.
- Retention pruning.
- Restore started/completed/failed.
- Restore mode.
- Conflicts and resolutions.
- Target changes.
- Credential disconnect.
- Overrides.

Rules:

- History is append-only.
- Logs redact secrets.
- Backup history is visible in Settings and Inbox.
- A failed backup links to logs.

## 21. Risks

| Risk | Mitigation |
|---|---|
| Huge audio library | Incremental copy, estimate, schedule |
| Google Drive quota | Backoff, pause/resume, warning |
| OAuth review | Use `drive.file`, prepare privacy policy |
| NAS disconnect | Pause/resume, retry, Inbox |
| Drive letter change | Volume identity |
| File locked | Retry, report |
| Long paths | Path handling, validation |
| Unicode | Normalize and test |
| Database write during copy | Snapshot API |
| Corrupt backup | Verify, keep last good |
| Restore overwrite | Backup current, staging, rollback |
| Token leak | OS keychain, redaction |
| User revokes access | Detect, prompt reconnect |
| Cloud cost | Estimate, quota, retention |

## 22. Acceptance tests

- Backup to external drive.
- Backup to NAS.
- Backup to Google Drive.
- First full backup.
- Incremental backup.
- Daily trigger.
- Before-sync trigger.
- Before-mass-edit trigger.
- Pause/resume.
- Cancel.
- Disconnect destination.
- Disk full.
- Permission denied.
- Locked file.
- Missing file.
- Unicode path.
- Long path.
- Interrupted upload.
- Google token expired.
- Google access revoked.
- Google quota exceeded.
- Verify snapshot.
- Verify partial snapshot.
- Prune retention.
- Restore to new location.
- Replace current library.
- Selective restore.
- Merge restore.
- Restore conflict.
- Restore interrupted.
- Restore with missing file.
- 30,000+ tracks.

## 23. Decisions and open questions

Confirmed:

1. Google Drive v1 targets personal accounts; Workspace is untested.
2. Mass-edit threshold: >50 tracks or >10% of the library, whichever is smaller.
3. Backups include audio and metadata; artwork and waveform caches are excluded.
4. Restore modes: new location, replace, selective, merge.
5. Google Drive folder choice: app-created `DJ Assistant Backups` folder only in v1; no arbitrary folder picker.
6. Restore merge default: keep current Library value; show backup value; per-field “use backup”; bulk merge blocked.

Still open:

1. How often should restore tests run?
2. Is app-level encryption still planned for v1.1?
3. Should Google Drive backup run only on Wi-Fi?
4. Should backup run when the app is closed (tray/background)?
5. What is the maximum audio size warning threshold?
6. Should backups include the search index? No, but confirm.
7. Should the last known good backup be protected per target or globally?
