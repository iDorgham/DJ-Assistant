# Lifecycle and Vocabulary

Last updated: 2026-10-23  
Status: Locked, except where marked proposed

## 1. One lifecycle

Every track moves through the same lifecycle, whether it arrives from a folder, a watch folder, a DJ app, a free download or a playlist import.

```text
Found
  → Identified
  → Analyzed
  → Tagged
  → Organized
  → Set-ready
  → Published
  → Maintained
```

### Lifecycle states

| State | Meaning | Primary action |
|---|---|---|
| **Found** | File discovered but not yet committed to the library | Review / Import |
| **Identified** | File has a stable track identity and basic metadata | Confirm metadata |
| **Analyzed** | BPM, key, peaks and beat grid are present | Review analysis |
| **Tagged** | Genre, style, mood and other tags are assigned | Improve tags |
| **Organized** | File path, artist, album and playlists are consistent | Maintain |
| **Set-ready** | Track is usable in a playlist or performance context | Add to playlist |
| **Published** | Metadata has been pushed to a DJ app or USB | Verify |
| **Maintained** | Track is actively curated, or quarantined when unused | Review / Restore |

A track can be in more than one workflow state at once. For example, it can be **Set-ready** and have a **sync conflict**.

## 2. Status chips

Status chips must be short, consistent and shared across the app.

### Library status

- `New`
- `Needs Review`
- `Ready`
- `Needs Attention`
- `Missing File`
- `Duplicate`
- `Quarantined`
- `Archived`

### Analysis status

- `Not analyzed`
- `Analyzing`
- `Analyzed`
- `Analysis failed`
- `Stale analysis`

### Sync status

- `Not synced`
- `Pending pull`
- `Pending review`
- `Pending push`
- `In sync`
- `Conflict`
- `Sync failed`

### Backup status

- `Not backed up`
- `Backing up`
- `Verified`
- `Partial`
- `Failed`
- `Restore needed`

Do not invent local variants such as “OK”, “Fine”, “Problem” or “Synced?”. Use the shared chips.

## 3. Vocabulary

### Library

The user's canonical music collection and its metadata.

### Track

A logical piece of music. A track can have one or more files, but normally one primary file.

### Release / Album

A collection of tracks. Do not call every release an album.

### Playlist

An ordered collection of tracks for preparation or performance.

### Set

A playlist that is being prepared for a performance. In the UI, use **Playlist** for the container and **Set Score** for the evaluation.

### Set Score

The overall quality score of a playlist/set.

### Set Check

The breakdown of the Set Score into reasons and suggestions.

### Set Readiness

The technical checklist for a set: missing files, analysis, cues, sync, USB readiness.

### Set Flow

The visual curve of energy, key, BPM, vocals, tension and variety.

### Maintain

The library care workspace inside Library.

### Smart Fix

A reviewable, reversible rule-based recommendation that improves library quality.

### Inbox

The combined destination for Needs Attention and Updates.

### Needs Attention

Items that block or degrade library quality, sync, playback, backup or export.

### Updates

Informational changes: completed scans, new recommendations, weekly Discover digest, successful backups.

### Import Center

The top-bar workspace for scanning, importing and reviewing new files.

### Quarantine

A safe holding area for tracks suggested for cleanup. Quarantine is not deletion.

### Publish

The act of sending approved data to a DJ app or USB device.

### Sync

The Pull → Review → Maintain → Push workflow with DJ applications.

### Pull

Read changes from a DJ application into DJ Assistant for review.

### Push

Write approved changes from DJ Assistant to a DJ application.

### USB Export

Writing a playlist and its files to a removable drive for Pioneer or Serato use.

### Snapshot

A point-in-time copy of the library database and metadata.

### Backup

A snapshot plus the configured audio scope, stored on a destination.

### Restore

Bringing data back from a backup. Modes: new location, replace, selective, merge.

### Energy

A numeric 1–10 attribute. It is never a tag.

### Rating

A 0–5 star rating with half-stars in the UI, stored as a 0–10 integer.

### Watch Folder

A folder monitored for new music. New files go to the Inbox for review by default. A trusted folder can opt into auto-import.

### Free Download

A track the source explicitly allows the user to download for free, with license and attribution recorded.

### Promo

A track supplied by a label or promoter, often before release, with usage restrictions.

## 4. Terms we do not use

| Avoid | Use |
|---|---|
| Dashboard | Library / Statistics |
| Maintenance tab | Library → Maintain |
| Set Score tab | Playlist → Set Score |
| Notification center | Inbox |
| Attention center | Inbox → Needs Attention |
| Cleanup / purge | Quarantine / Permanent purge |
| Sync overwrite | Push with review |
| Library scan | Import / Watch Folder scan |
| Demo audio | Real audio |
| AI magic | Smart Fix / recommendation |

## 5. Inbox model

The Inbox has two groups:

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
  Updates
    Import completed
    Maintain digest
    Discover weekly digest
    Backup verified
    Sync completed
    USB export completed
```

Rules:

- Needs Attention is actionable.
- Updates are informational.
- An item can be snoozed or dismissed when appropriate.
- Dismissing an item does not delete the underlying problem.
- Resolving the problem resolves the item.
- Bulk actions show scope and require confirmation when destructive.

## 6. Lifecycle rules

- A track without a playable file is `Missing File`, not `Ready`.
- A track with a duplicate is not automatically deleted; it is `Duplicate` until reviewed.
- A track with stale analysis is `Stale analysis`, not `Analyzed`.
- A playlist with missing files is not `Set-ready`.
- A USB export is not complete until verified and ejected.
- A backup is not successful until verified.
- A sync is not complete until the user has reviewed conflicts.

## 7. Naming rules

- Use sentence case for labels.
- Use title case for tab names only if the existing design system requires it; be consistent.
- Use “DJ Assistant” in full, not “DJA”, in user-facing copy.
- Use “DJ app” in prose and the actual app name in UI.
- Use “track” for a piece of music, “file” for the bytes on disk.
- Use “playlist” for the container, “set” for the performance intent.
- Use “quarantine” for the safe holding state, “purge” only for permanent deletion.

## 8. Tag vocabulary

The hybrid tag model is confirmed. See `02-experience/maintain-and-tags.md`.

- Genre and Subgenre are hierarchical.
- Style, Mood, Set Position, Vocal, Version, Content, Structure, Era, Source and Custom are flat facets.
- Energy is numeric 1–10 and is not a tag.
- Rating is 0–5 stars with half-stars, stored 0–10.
