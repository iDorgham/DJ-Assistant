# Onboarding

Last updated: 2026-10-23  
Status: Proposed

## 1. Goal

Get the user from first launch to a usable library without forcing a cloud account, a demo library or a long setup wizard.

The first-run experience should answer four questions:

1. Where is your music?
2. How should DJ Assistant import it?
3. Which DJ apps do you use?
4. Where should backups go?

Everything else can be configured later.

## 2. First launch

```text
Welcome to DJ Assistant

[ Add music folder ]   [ Scan a drive ]   [ Import a playlist ]

[ Continue with an empty library ]
```

Rules:

- No synthetic demo audio.
- No forced account.
- No forced cloud connection.
- No fake sample library that looks like real music.
- The user can start empty and add music later.

## 3. Step 1 — Choose library folder

```text
Where is your music?

[ D:\Music\DJ Library ]   [ Browse ]

[x] Watch this folder for new files
[ ] Include subfolders
[ ] Import existing playlists
```

New watch-folder files go to the Inbox for review by default. Auto-import is a per-folder opt-in.

Checks:

- Folder exists.
- Read permission.
- Free space.
- Not the same folder as the backup destination.
- Not inside the application install directory.

If the user chooses a folder with tens of thousands of files, warn about scan time and offer a background import.

## 4. Step 2 — Import mode

```text
How should we import?

(•) Quick import
    Add files now, analyze and enrich in the background.

( ) Curated import
    Review metadata, duplicates and tags before adding.
```

### Quick import

Use when:

- The library is large.
- The files are already tagged.
- The user wants to start listening fast.

Behavior:

- Add tracks with existing metadata.
- Analyze in the background.
- Queue enrichment.
- Send problems to Inbox.
- Never block the library.

### Curated import

Use when:

- The user is importing a new batch.
- Metadata quality matters.
- The user wants duplicate review.
- The user wants genre and artist normalization before commit.

Behavior:

- Review metadata.
- Resolve duplicates.
- Normalize genres and artists.
- Add to library only after confirmation.

Quick is the default. The user can choose Curated per job and change the default later in Settings → Import.

## 5. Step 3 — Choose DJ apps

```text
Which DJ apps should DJ Assistant work with?

[ ] rekordbox
[ ] Traktor
[ ] Serato DJ Pro
[ ] VirtualDJ
[ ] Engine DJ

You can change this later.
```

Rules:

- Apps are optional.
- No app is enabled by default.
- The user chooses which apps participate in each sync workflow.
- rekordbox is the first supported adapter; Traktor follows after rekordbox is stable.
- No app is silently treated as the source of truth.
- If an app is not installed, it is disabled with a clear reason.
- Do not write to an app before the first dry run and backup.

The app list after rekordbox and Traktor is still open.

## 6. Step 4 — Choose backup destination

```text
Protect your library

[ ] External drive
[ ] NAS
[ ] Google Drive

Recommended: external drive + one off-site destination.
```

Defaults:

- Daily backup.
- Before sync.
- Before mass edits.
- 5 metadata snapshots.
- Last known good full backup.
- Audio included.
- Artwork and waveform caches excluded.

Google Drive is optional. If selected, start OAuth and create the `DJ Assistant Backups` folder.

The user can skip backup and be reminded later, but the app should warn that sync and mass edits are riskier without a backup.

## 7. Step 5 — Audio setup

```text
Audio output

Device: [ System default ]
Sample rate: [ 48,000 Hz ]
Buffer: [ 512 samples ]

[ Test audio ]
```

Rules:

- Real audio only.
- If no output device is available, explain it.
- Do not fail onboarding because audio is unavailable.
- Allow changes later in Settings → Audio.

## 8. Step 6 — Library tour

Show a short, skippable tour:

1. Library Tracks.
2. Maintain.
3. Playlists and Set Score.
4. Discover.
5. Statistics.
6. Publish.
7. Inbox and Import Center.

Do not block the user with a multi-page modal. Use small inline hints and a “Show me” action.

## 9. First-run checklist

```text
Setup checklist
[x] Music folder added
[x] Import started
[ ] First track analyzed
[ ] DJ app connected
[ ] Backup destination configured
[ ] First backup verified
```

The checklist is a guide, not a gate. It can be dismissed.

## 10. Returning user with an existing library

If DJ Assistant detects a previous library:

```text
We found an existing library.

[ Open library ]
[ Restore from backup ]
[ Start fresh ]
```

Do not overwrite or merge without explicit choice.

## 11. Migration from another app

Supported paths:

- Import a folder.
- Import playlists from a DJ app.
- Import a backup created by DJ Assistant.
- Paste a link or add a file manually.

Out of scope:

- Lexicon migration.
- Proprietary database conversion without an explicit adapter.
- Scraping another app's data.

## 12. Errors and edge cases

| Case | Behavior |
|---|---|
| Folder missing | Keep the path, show error, let the user browse |
| Permission denied | Explain which permission is missing |
| No audio files | Offer another folder or empty library |
| Corrupt files | Import metadata if possible, mark `Needs Attention` |
| Duplicate library | Offer review, do not auto-merge |
| No DJ app installed | Continue; sync is optional |
| No network | Continue; enrichment waits |
| Google Drive not connected | Continue; backup can be local-only |
| No backup destination | Warn before sync and mass edits |

## 13. What onboarding must not do

- Force a Google account.
- Force a cloud library.
- Create fake tracks.
- Auto-download music.
- Auto-push to a DJ app.
- Auto-delete duplicates.
- Hide the import mode choice.
- Require a backup before the user can play music.

## 14. Onboarding completion

Onboarding is complete when:

- The user has a library folder or an explicit empty library.
- The import mode is chosen.
- At least one DJ app choice is recorded or skipped.
- A backup choice is recorded or skipped.
- The user has seen the Library.

The app should not ask again unless settings are reset.
