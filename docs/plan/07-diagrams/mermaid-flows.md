# Mermaid Flows

Last updated: 2026-10-23  
Status: Reference

## 1. Information architecture

```mermaid
flowchart TD
  Shell[DJ Assistant Shell]
  Shell --> Library
  Shell --> Playlists
  Shell --> Discover
  Shell --> Statistics
  Shell --> Publish
  Shell --> Settings

  Library --> Tracks
  Library --> Maintain
  Maintain --> Overview
  Maintain --> Tags
  Maintain --> Genres
  Maintain --> Artists
  Maintain --> Duplicates
  Maintain --> Missing
  Maintain --> Quarantine
  Maintain --> SmartFixes
  Maintain --> History

  Playlists --> PlaylistTracks[Tracks]
  Playlists --> SetScore[Set Score]

  Publish --> Sync[Sync Library]
  Publish --> USB[USB Export]

  Shell --> TopBar[Search · Import Center · Inbox · Backup]
  Shell --> PlayerDock[Player: Mini / Full / Player view]
```

## 2. Track lifecycle

```mermaid
stateDiagram-v2
  [*] --> Found
  Found --> Identified
  Identified --> Analyzed
  Analyzed --> Tagged
  Tagged --> Organized
  Organized --> SetReady
  SetReady --> Published
  Published --> Maintained
  Maintained --> Quarantined
  Quarantined --> Maintained
  Maintained --> [*]
```

## 3. Import

```mermaid
flowchart LR
  A[Folder / Watch / Drop / Download] --> B[Discover files]
  B --> C[Read metadata]
  C --> D[Hash + fingerprint]
  D --> E{Duplicate?}
  E -- Yes --> F[Review duplicate]
  E -- No --> G[Create track]
  F --> G
  G --> H[Analyze audio]
  H --> I[Generate peaks + grid]
  I --> J[Enrich optional]
  J --> K[Commit]
  K --> L[Inbox update]
```

## 4. Sync

```mermaid
flowchart TD
  A[Select apps + fields] --> B[Pull]
  B --> C[Review diff]
  C --> D{Conflicts?}
  D -- Yes --> E[Resolve conflicts]
  D -- No --> F[Maintain fixes]
  E --> F
  F --> G[Backup]
  G --> H{Backup OK?}
  H -- No --> I[Block push / notify]
  H -- Yes --> J[Dry run]
  J --> K{Approve?}
  K -- No --> C
  K -- Yes --> L[Push]
  L --> M[Verify]
  M --> N[History + Inbox]
```

## 5. Backup

```mermaid
flowchart TD
  A[Trigger: daily / sync / mass edit / manual] --> B[Queue job]
  B --> C[Scan library]
  C --> D[Snapshot database]
  D --> E[Hash audio]
  E --> F[Copy/upload changed files]
  F --> G[Write manifest]
  G --> H[Verify checksums + counts]
  H --> I{Verified?}
  I -- Yes --> J[Mark last known good]
  I -- No --> K[Partial / failed]
  K --> L[Inbox alert]
  J --> M[Prune old snapshots]
  M --> N[Done]
```

## 6. Restore

```mermaid
flowchart TD
  A[Choose snapshot] --> B[Choose mode]
  B --> C{New location?}
  C -- Yes --> D[Restore to new folder]
  C -- No --> E[Back up current library]
  E --> F[Restore to staging]
  F --> G[Verify]
  G --> H{Replace / selective / merge}
  H --> I[Apply]
  I --> J[History + Inbox]
  D --> G
```

## 7. Inbox

```mermaid
flowchart LR
  A[Needs Attention] --> C[Inbox]
  B[Updates] --> C
  C --> D[Filter / group]
  D --> E[Open entity]
  E --> F[Fix / review]
  F --> G[Resolve]
  G --> H[History]
```

## 8. Discover

```mermaid
flowchart LR
  A[Library signals] --> B[Recommendation]
  C[Providers] --> B
  B --> D[Discover card]
  D --> E{Action}
  E --> F[Preview / link out]
  E --> G[Save to Watchlist]
  E --> H[Download if enabled]
  H --> I[Import Center]
  E --> J[Ignore]
```

## 9. Playlist save and recovery

```mermaid
stateDiagram-v2
  [*] --> Clean
  Clean --> Dirty: edit
  Dirty --> Saving: Save
  Saving --> Clean: success
  Saving --> Dirty: failure
  Dirty --> Clean: discard
  Dirty --> Recovery: crash
  Recovery --> Dirty: restore draft
  Recovery --> Clean: discard draft
```

## 10. Set Score

```mermaid
flowchart LR
  A[Playlist] --> B[Energy]
  A --> C[Key flow]
  A --> D[BPM flow]
  A --> E[Vocals]
  A --> F[Variety]
  A --> G[Tension]
  A --> H[Readiness]
  B --> I[Set Score]
  C --> I
  D --> I
  E --> I
  F --> I
  G --> I
  H --> I
  I --> J[Set Check]
  J --> K[Suggestions]
  K --> L[Preview in player]
```

## 11. USB export

```mermaid
flowchart TD
  A[Select playlist] --> B[Detect drive]
  B --> C[Preflight]
  C --> D{Ready?}
  D -- No --> E[Fix missing/analyze/save]
  D -- Yes --> F[Export audio + metadata]
  F --> G[Verify counts + checksums]
  G --> H{OK?}
  H -- No --> I[Report failure]
  H -- Yes --> J[Eject]
  J --> K[Done]
```

## 12. Backup job states

```mermaid
stateDiagram-v2
  [*] --> Queued
  Queued --> Scanning
  Scanning --> Snapshotting
  Snapshotting --> Copying
  Copying --> Verifying
  Verifying --> Done: verified
  Verifying --> Partial: missing files
  Verifying --> Failed: checksum/integrity
  Copying --> Paused
  Paused --> Copying
  Copying --> Cancelled
  Failed --> [*]
  Partial --> [*]
  Done --> [*]
  Cancelled --> [*]
```
