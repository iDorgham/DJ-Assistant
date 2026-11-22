# Vision and Principles

Last updated: 2026-10-23  
Status: Locked direction

## 1. Why DJ Assistant exists

DJs usually have music spread across folders, downloads, DJ applications, streaming links, promo inboxes and USB sticks. The library becomes inconsistent:

- The same track exists under several names.
- Genres are a mix of iTunes, Beatport, Traktor and personal labels.
- Artists have aliases and collaboration variants.
- Cues and beat grids live in one DJ app but not another.
- Playlists are duplicated or stale.
- Nobody knows which files are missing, unused or badly tagged.
- Backups are either missing or unverified.
- New music discovery is separated from the library.

DJ Assistant solves that by being the **main library and preparation workspace**, not another player that owns the music.

## 2. Target user

The primary user is a working DJ who:

- Has a local music library, typically thousands to tens of thousands of tracks.
- Uses one or more DJ applications.
- Cares about tags, playlists, cues, keys, BPM, energy and set flow.
- Prepares sets before performing.
- Wants control over what is published to DJ apps and USB devices.
- Does not want a cloud account just to manage a local library.

Secondary users:

- Bedroom DJs building a first serious library.
- DJs returning to music after a break.
- Collectors who care about metadata quality.
- People preparing USB sticks for other DJs.

## 3. Product promise

> One library. One vocabulary. One place to prepare, play, publish and protect your music.

DJ Assistant should make the library feel calmer after every session:

- Fewer duplicates.
- Fewer missing files.
- Cleaner genres and artists.
- Better playlists.
- Better sets.
- Safer sync.
- Verified backups.

## 4. Principles

### 4.1 Library first

The Library is the home screen. There is no dashboard. The user should land on music, not metrics.

### 4.2 Real audio only

- Real files.
- Real peaks.
- Real beat grids.
- Real analysis.
- No synthetic playback.
- No placeholder waveform data.

If a file is missing or corrupt, say so. Do not fake it.

### 4.3 One track lifecycle

A track has one lifecycle from import to archive. Every screen uses the same states and the same Track panel.

### 4.4 One vocabulary

The same concept must have one name everywhere. See `lifecycle-and-vocabulary.md`.

### 4.5 Safe by default

- Sync never silently overwrites.
- Cleanup never silently deletes.
- Backup runs before risky operations.
- Restore backs up the current state first.
- Destructive actions are explicit, previewed and auditable.

### 4.6 Reversible where possible

- Undo for tag, playlist and metadata edits.
- Quarantine before purge.
- Sync history and rollback.
- Backup snapshots and restore points.
- Audit log for mass edits.

### 4.7 Local-first

- The library is local.
- The app works without an account.
- Cloud is optional and used for backup or discovery, not as the source of truth.
- Secrets live in the OS keychain.

### 4.8 Actionable, not decorative

Statistics, Set Score and Library Health must lead somewhere:

- Click a chart → filtered Library.
- Click a warning → affected tracks.
- Click a score gap → suggested fix.
- Click a conflict → comparison view.

### 4.9 Progressive disclosure

Show the common path first. Put advanced mapping, format profiles and conflict rules behind clear advanced panels.

### 4.10 Performance is a feature

The app must remain responsive with 30,000+ tracks. Long work runs in the background with progress, pause and recovery.

### 4.11 No dark patterns

- No fake urgency.
- No hidden subscriptions.
- No forced cloud account.
- No silent telemetry.
- No auto-publishing to DJ apps.
- No autoplay of purchased or streamed content where the license does not allow it.

## 5. Product boundaries

DJ Assistant is not:

- A replacement for performance DJ software during a live set.
- A streaming service.
- A music store.
- A piracy tool.
- A full DAM or video library.
- A Lexicon-compatible migration tool.
- A cloud drive.

DJ Assistant owns the library and preparation. DJ applications own live performance.

## 6. What "main library" means

The user's statement is explicit: **DJ Assistant should be the main library.**

That means:

- DJ Assistant is the canonical place for tags, ratings, playlists, comments and library organization.
- DJ applications can still own performance-specific data such as cues and beat grids, unless the user chooses otherwise.
- Sync pulls from DJ apps, reviews differences, lets the user maintain the library, and pushes approved changes.
- No DJ app becomes an invisible source of truth for the whole library.

The exact field-level source-of-truth matrix is still open. See `04-data-and-sync/sync-and-source-of-truth.md`.

## 7. Success metrics

Product success:

- A new user can import a folder and hear a track within minutes.
- A returning user can find and fix library problems without reading documentation.
- A DJ can build and score a set, then export it to USB safely.
- A sync run produces a reviewable diff, not a surprise.
- A restore from backup actually works and is verified.

Technical success:

- 30,000+ tracks remain usable.
- No destructive operation lacks confirmation and audit.
- No sync run lacks a backup and dry run.
- No backup is marked successful without verification.

## 8. Non-negotiable rules

1. Do not fake audio or waveforms.
2. Do not delete without confirmation.
3. Do not overwrite a DJ app without review.
4. Do not publish a backup as verified unless it passed checks.
5. Do not add a new concept when an existing one can be extended.
6. Do not add a top-level tab for a workspace that belongs inside an existing tab.
