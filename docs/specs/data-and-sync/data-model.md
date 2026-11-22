# Data Model

Last updated: 2026-10-23  
Status: Proposed

## 1. Principles

- Local-first SQLite database.
- One library in v1; no per-library routing.
- Stable IDs.
- Soft delete for user data.
- UTC timestamps.
- Append-only audit log.
- Explicit migrations.
- One writer at a time.
- Background jobs are resumable.
- Secrets never stored in the database.

## 2. Core entities

```text
tracks
  id
  title
  artist_id
  album_id
  label_id
  genre_id
  year
  duration_ms
  bpm
  musical_key
  camelot_key
  energy        -- 1–10 numeric, not a tag
  rating        -- 0–10 integer; UI shows 0–5 half-stars
  comment
  isrc
  musicbrainz_recording_id
  status
  created_at
  updated_at
  deleted_at

track_files
  id
  track_id
  path
  file_hash
  size_bytes
  modified_at
  format
  sample_rate
  bit_depth
  channels
  bitrate
  is_primary
  status
  last_seen_at

artists
  id
  name
  sort_name
  musicbrainz_artist_id
  canonical_artist_id
  created_at
  updated_at

artist_aliases
  id
  artist_id
  alias
  source
  confidence

albums
  id
  title
  artist_id
  label_id
  year
  musicbrainz_release_id
  album_artist_id

labels
  id
  name
  musicbrainz_label_id

genres
  id
  name
  parent_id
  path
  canonical_id
  is_system
  created_at
  updated_at
```

## 3. Tags

```text
tags
  id
  namespace
  name
  parent_id
  path
  color
  is_system
  created_at
  updated_at

tag_aliases
  id
  tag_id
  alias
  source
  confidence

track_tags
  track_id
  tag_id
  source
  confidence
  created_at
```

Namespaces:

```text
genre
style
mood
set_position
vocal
version
content
structure
era
source
custom
```

Energy and rating are numeric fields, not tag namespaces. Do not allow an `energy` or `rating` tag.

## 4. Playlists

```text
playlists
  id
  name
  description
  kind
  created_at
  updated_at
  deleted_at

playlist_items
  id
  playlist_id
  track_id
  position
  added_at
  note

playlist_drafts
  id
  playlist_id
  payload
  updated_at
```

Rules:

- `position` is a stable order key, not an array index.
- Duplicate entries are allowed.
- Drafts are separate from saved playlists.
- Deleting a playlist does not delete tracks.

## 5. Cues and analysis

```text
cues
  id
  track_id
  kind          cue | hotcue | loop
  index
  position_ms
  length_ms
  name
  color
  created_at
  updated_at

beatgrids
  id
  track_id
  bpm
  anchor_ms
  mode
  source
  updated_at

analysis
  id
  track_id
  waveform_path
  peaks_path
  loudness
  duration_ms
  sample_rate
  analyzed_at
  stale
  error

play_history
  id
  track_id
  playlist_id
  played_at
  duration_ms
  source            internal | rekordbox | traktor | serato | ...
  source_file
  source_ref
  imported_at
```

Rules:

- Cues and beatgrids can be pulled from DJ apps.
- Source is recorded.
- Conflicts are explicit.
- Analysis cache is not backed up.
- Play history source is recorded and never merged silently.

## 6. Import

```text
watch_folders
  id
  path
  enabled
  include_subfolders
  mode
  last_scan_at

import_jobs
  id
  source
  mode
  status
  started_at
  finished_at
  total
  imported
  skipped
  failed
  error

import_items
  id
  job_id
  path
  track_id
  status
  error
```

## 7. Sync

```text
sync_profiles
  id
  name
  app
  direction
  fields
  enabled
  created_at
  updated_at

sync_runs
  id
  profile_id
  app
  direction
  dry_run
  status
  started_at
  finished_at
  backup_snapshot_id
  pulled
  pushed
  conflicts
  skipped
  failed

sync_changes
  id
  run_id
  entity_type
  entity_id
  field
  before
  after
  decision
  applied_at

sync_conflicts
  id
  run_id
  entity_type
  entity_id
  field
  library_value
  app_value
  resolution
  resolved_at
```

## 8. Backup

```text
backup_targets
  id
  kind          external | nas | google_drive
  name
  path
  config_json
  enabled
  last_test_at
  last_test_status

backup_jobs
  id
  target_id
  trigger       manual | daily | before_sync | before_mass_edit
  status
  started_at
  finished_at
  bytes_total
  bytes_done
  error

backup_snapshots
  id
  job_id
  target_id
  created_at
  verified_at
  status        pending | verified | partial | failed
  manifest_path
  metadata_path
  audio_manifest_path
  track_count
  playlist_count
  size_bytes
  is_last_known_good
```

Rules:

- A snapshot is not `verified` until checks pass.
- The last known good snapshot is protected from pruning.
- Audio mirror is tracked separately from metadata snapshots.
- Restore runs are recorded.

## 9. Discover

```text
discover_sources
  id
  provider
  enabled
  status
  last_sync_at
  config_json

discover_items
  id
  provider
  external_id
  title
  artist
  label
  genre
  bpm
  musical_key
  duration_ms
  source_url
  license
  price
  format
  quality
  release_date
  download_enabled
  attribution
  fetched_at
  ignored

discover_downloads
  id
  discover_item_id
  track_id
  downloaded_at
  file_hash
  license
  source_url

promos
  id
  discover_item_id
  label
  promoter
  embargo_until
  allowed_use
  feedback_due
  status
```

## 10. Operations

```text
quarantine_items
  id
  track_id
  reason
  quarantined_at
  restored_at
  purged_at
  file_moved

audit_log
  id
  timestamp
  actor
  action
  entity_type
  entity_id
  scope
  before_json
  after_json
  undoable
  undo_deadline

inbox_items
  id
  kind
  category
  severity
  title
  summary
  entity_refs
  primary_action
  resolved_at
  snooze_until

settings
  key
  value_json
  updated_at
```

## 11. Relationships

```text
artists 1 ── * tracks
albums  1 ── * tracks
labels  1 ── * albums
genres  1 ── * genres
genres  1 ── * tracks
tracks  1 ── * track_files
tracks  1 ── * cues
tracks  1 ── 1 beatgrids
tracks  1 ── * track_tags
tags    1 ── * track_tags
playlists 1 ── * playlist_items
tracks  1 ── * playlist_items
sync_runs 1 ── * sync_changes
backup_snapshots 1 ── * backup files
```

## 12. Indexing

Required indexes:

- `tracks(artist_id)`
- `tracks(album_id)`
- `tracks(genre_id)`
- `tracks(bpm)`
- `tracks(musical_key)`
- `tracks(rating)`
- `tracks(energy)`
- `track_files(file_hash)`
- `track_files(path)`
- `playlist_items(playlist_id, position)`
- `track_tags(track_id)`
- `track_tags(tag_id)`
- `play_history(track_id, played_at)`
- `inbox_items(resolved_at, severity)`

Full-text search:

- SQLite FTS5 for title, artist, album, label, tags, comments.

## 13. Identity and deduplication

```text
file_identity = hash + size
track_identity = isrc | musicbrainz_recording_id | normalized artist+title+duration
```

Rules:

- File identity and track identity are separate.
- A track can have multiple files.
- A file belongs to one track.
- Do not merge tracks without review.
- Preserve original metadata.

## 14. Migrations

- Versioned migrations.
- Forward-only.
- Backup before migration.
- Test on a copy.
- Never destructive without a backup.
- Record migration in History.
- Refuse to start if the schema is newer than the app.

## 15. Concurrency

- SQLite WAL mode.
- One writer.
- Background jobs use a queue.
- UI reads from snapshots or short transactions.
- Long analysis writes in batches.
- Do not hold a write transaction during file I/O.
- Handle `SQLITE_BUSY` with retry/backoff.

## 16. Backup integration

The database snapshot must be consistent:

1. Checkpoint WAL.
2. Use SQLite backup API or `VACUUM INTO`.
3. Write manifest.
4. Copy audio incrementally.
5. Verify.
6. Mark verified.

Do not copy a live database file while writes are happening.

## 17. Decisions and open data questions

Confirmed:

1. One library in v1.
2. Metadata is database-first; writing tags to files is an explicit job.
3. Rating is stored 0–10; displayed 0–5 half-stars.
4. Energy is 1–10 and is not a tag.
5. Cues and beat grids are DJ-app-owned by default but readable by DJ Assistant.
6. Play history records source, source file and import time.

Still open:

1. Are cues stored only in SQLite or also written to files?
2. Which DJ app data is imported first?
3. Are smart playlists in v1?
4. Is there a folder hierarchy for playlists?
