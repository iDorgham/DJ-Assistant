# Settings

Last updated: 2026-10-23  
Status: Proposed structure; backup and import defaults locked

## 1. Purpose

Settings configures the app without hiding critical safety decisions.

```text
Settings
  General
  Library
  Import
  Player
  Audio
  Tags
  Sync
  USB
  Backup
  Notifications
  Privacy
  Advanced
```

Rules:

- Settings search.
- Changes are saved explicitly or immediately with a clear indicator.
- Destructive settings require confirmation.
- Data-affecting settings create a History entry.
- No hidden cloud account requirement.

## 2. General

- Language.
- Theme: system, light, dark.
- Density.
- Reduced motion.
- High contrast.
- Start screen.
- Remember last tab.
- Confirm on close.
- Keyboard shortcuts.
- Check for updates.
- About / version / logs.

## 3. Library

- Library folder.
- Watch folders.
- Include subfolders.
- File naming rules.
- Duplicate detection sensitivity.
- Missing file behavior.
- Quarantine location.
- Default views.
- Table columns.
- Artwork cache location.
- Artwork handling: cache only in v1; writing artwork to files is explicit and advanced.
- Analysis cache location.
- Database location.
- Rebuild index.
- Vacuum database.
- Export library metadata.
- Import play history (explicit; stores source, source file and import time).
- Write tags to files (explicit job; backup and scope confirmation required).

Rules:

- Never move the library without a backup.
- Warn if the library folder is on a removable drive.
- Do not allow the library and backup destination to be the same path.

## 4. Import

- Default mode: **Quick**.
- Curated is an explicit per-job choice.
- Supported formats: MP3, FLAC, WAV, AIFF, M4A/AAC; OGG/Opus best-effort.
- No WMA or DRM-protected audio.
- Auto-analyze.
- Smart Fix auto-apply: no silent auto-apply; preview + one-click apply.
- Auto-enrich.
- Watch folder behavior.
- Per-folder auto-import override.
- Duplicate handling.
- Unsupported file handling.
- Import playlist files.
- Artwork handling.
- Metadata priority.
- File date handling.
- Move vs copy.
- Destination folder pattern.

Watch folder behavior:

- Add to Inbox for review. **Default.**
- Auto-import and notify. Per-folder opt-in.
- Scan only.

The default applies to new watch folders. A trusted folder can opt into auto-import. Auto-import still runs duplicate checks and reports failures in Inbox.

## 5. Player

- Default presentation: Mini / Full / Player view.
- Open playlist in Player view on wide screens.
- Waveform style.
- Beat grid display.
- Key notation: musical / Camelot.
- Cue behavior.
- Hot cue count.
- Loop behavior.
- Crossfader curve (if present).
- Output device.
- Buffer size.
- Sample rate.
- Mono/stereo.
- Headphone cue routing (if supported).
- Remember position.
- Resume behavior.

## 6. Audio

- Output device.
- Sample rate.
- Buffer.
- Latency.
- Test tone.
- Exclusive mode.
- Normalization: off by default.
- Limiter: off by default.
- EQ8 enable.
- Metering.

Rules:

- Do not apply loudness normalization silently.
- Do not apply limiting silently.
- Do not fake audio devices.

## 7. Tags

- Tag model: hybrid (confirmed).
- Genre tree.
- Flat facets.
- Energy scale: numeric 1–10; not a tag.
- Rating scale: 0–5 stars with half-stars, stored 0–10.
- Custom tags.
- Aliases.
- Case normalization.
- Import mapping.
- Tag colors.
- Tag manager.
- Reset taxonomy.

Rules:

- Do not bulk-delete tags without reassignment.
- Do not rename system tags without warning.
- Do not auto-merge tags without preview.

## 8. Sync

- Participating DJ apps.
- Per-app sync profile.
- Direction: pull / push / both.
- Field mapping.
- Source-of-truth rules.
- Conflict policy.
- Dry run before push.
- Backup before sync.
- App version checks.
- Watch for app changes.
- Sync history retention.
- Rollback.
- Advanced direct database writes.

Rules:

- No app is enabled by default.
- Backup before sync is on by default.
- Restore merge uses per-field “use backup”; bulk merge is blocked.
- Dry run is on by default.
- Direct database writes are advanced.
- Unsupported app versions are blocked or warned.

## 9. USB

- Default export profile.
- Pioneer legacy is the default supported path.
- OneLibrary (visible, experimental, uncertified).
- USB filesystem profiles: FAT32 required; exFAT only for validated hardware; no NTFS.
- Serato crates.
- Filesystem profile.
- Custom icon.
- Verify after export.
- Eject after export.
- Remember last drive.
- Format tool.
- Hardware test mode.

Rules:

- Formatting requires typed confirmation.
- Never format the library drive.
- Never claim OneLibrary certification before approval.

## 10. Backup

### 10.1 Destinations

```text
[ ] External drive
[ ] NAS
[ ] Google Drive
```

- External drive path.
- NAS SMB/UNC path.
- Google Drive account: personal accounts in v1; Workspace is untested.
- Google Drive folder: app-created `DJ Assistant Backups` only in v1.
- Google Drive folder: `DJ Assistant Backups`.
- Test connection.
- Free space estimate.
- Bandwidth limit.

### 10.2 Scope

```text
[x] Audio files
[x] Library database and metadata
[x] Cues, beat grids, ratings, tags, playlists, settings
[ ] Artwork cache
[ ] Waveform cache
```

### 10.3 Schedule

```text
[x] Daily
[x] Before sync
[x] Before mass edits
[ ] On app close
```

- Time of day.
- Only when idle.
- Pause on battery.
- Bandwidth window.
- Retry policy.
- Mass-edit threshold: >50 tracks or >10% of the library, whichever is smaller.

### 10.4 Retention

```text
Keep [ 5 ] metadata snapshots
Keep the last known good full backup
Keep 1 audio mirror per destination
```

Rules:

- Never prune the last verified backup.
- Never prune the last known good full backup.
- Purge of old backups requires confirmation.
- Cloud retention respects the provider.

### 10.5 Encryption

v1:

- TLS in transit.
- Provider-side encryption at rest.
- OS keychain for secrets.

Later:

- App-level encryption.
- User-managed recovery key.

### 10.6 Verification

- Verify after every backup.
- Show last verified time separately from last backup time.
- Run periodic restore tests.
- Mark `verified` or `partial`.
- Never mark a backup successful without checks.

### 10.7 Restore

Modes:

1. New location.
2. Replace current library.
3. Selective.
4. Merge.

Rules:

- Back up the current library before restore.
- Preview restore.
- Stage and verify.
- Roll back on failure.
- Record History.

## 11. Notifications

| Source | Default |
|---|---|
| Watch folder | Immediate review item |
| Maintain | Daily digest |
| Discover | Weekly digest |
| Sync | Completion + conflicts |
| Backup | Failure + verification |
| USB | Completion + failure |
| Import | Completion + failure |

Options:

- In-app only.
- OS notifications.
- Digest time.
- Quiet hours.
- Critical only.
- Do not disturb.

Rules:

- No notification for every file.
- Critical failures always notify.
- Dismissing a notification does not resolve the issue.

## 12. Privacy

- Local-first.
- No account required.
- Telemetry off by default.
- Crash reports opt-in.
- Provider connections listed.
- API scopes shown.
- Disconnect provider.
- Delete cached data.
- Export personal data.
- Delete all data.

Rules:

- Do not upload the library without consent.
- Do not send file paths to providers unless required.
- Redact secrets in logs.
- Show what Google Drive can access.

## 13. Advanced

- Database path.
- Log level.
- Open log folder.
- Rebuild search index.
- Rebuild waveform cache.
- Rebuild artwork cache.
- Reset sync profiles.
- Reset settings.
- Feature flags.
- Experimental features.
- Diagnostics bundle.

Rules:

- Advanced settings are clearly marked.
- Destructive actions require confirmation.
- Diagnostics bundle redacts secrets.

## 14. About

- Version.
- Build.
- Commit.
- Platform.
- License.
- Third-party notices.
- Privacy policy.
- Terms.
- Check for updates.
- Open data folder.

## 15. Settings anti-patterns

- Hidden backup settings.
- Automatic cloud upload.
- Automatic sync without review.
- Automatic deletion.
- Unclear encryption claims.
- Storing tokens in plain text.
- Formatting a drive without typed confirmation.
- Making experimental OneLibrary look certified.
