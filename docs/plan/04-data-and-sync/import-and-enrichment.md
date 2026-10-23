# Import and Enrichment

Last updated: 2026-10-23  
Status: Locked direction; watch-folder, formats and default import mode confirmed

## 1. Purpose

Import is how music enters the library. It must be fast, safe and recoverable.

Import is a top-bar **Import Center**, not a permanent tab.

## 2. Import sources

- Folder scan.
- Watch folder.
- Drag and drop.
- Individual files.
- Playlist file (M3U, CSV where supported).
- DJ app Pull.
- Discover download.
- Restore from backup.

## 3. Import modes

### Quick import

- Add files with existing metadata.
- Analyze in the background.
- Queue enrichment.
- Send problems to Inbox.
- Never block the library.

### Curated import

- Review metadata.
- Review duplicates.
- Normalize genre and artist.
- Review artwork.
- Add only after confirmation.

**Quick is the default.** Curated is an explicit per-job choice. The user can change the default in Settings → Import.

## 4. Import pipeline

```text
Discover files
  → Read file metadata
  → Fingerprint / hash
  → Match existing tracks
  → Create or update track
  → Analyze audio
  → Generate waveform / peaks
  → Detect BPM / key / beat grid
  → Enrich metadata (optional)
  → Apply tags
  → Commit
  → Notify Inbox
```

Long stages run in the background with progress, pause and cancel.

## 5. File handling

Supported formats:

- MP3
- FLAC
- WAV
- AIFF
- M4A / AAC
- OGG / Opus — best-effort; validate per platform

Not supported in v1:

- WMA.
- DRM-protected audio.

Rules:

- Read tags without modifying the file first.
- Metadata is database-first in v1.
- Writing tags to files is an explicit background job, not a side effect of saving.
- Never rewrite audio tags without a backup and a scope confirmation.
- Handle Unicode normalization.
- Handle long Windows paths.
- Handle read-only files.
- Handle locked files.
- Handle zero-byte files.
- Handle corrupt headers.
- Handle missing artwork.
- Do not convert formats silently.
- Do not normalize audio silently.

## 6. Track identity

Identity signals, in order:

1. File hash.
2. ISRC.
3. MusicBrainz recording ID.
4. Normalized artist + title + duration.
5. File path (weakest).

Rules:

- Hash is the strongest file identity.
- Metadata identity is separate from file identity.
- Two files can be the same track in different formats.
- Do not merge by title alone.
- Keep the original metadata.
- Store the source of each metadata field where possible.

## 7. Duplicate detection

Types:

- Exact file hash.
- Same track, different format.
- Same ISRC.
- Near duplicate: artist + title + duration tolerance.
- Duplicate playlist entry.
- Duplicate artist.
- Duplicate album.

Behavior:

- Flag, do not delete.
- Show both files.
- Show quality and metadata differences.
- Allow keep both.
- Allow quarantine loser.
- Record resolution.

## 8. Watch folder

Default notification: immediate Inbox review item.

Behavior options:

1. Add to Inbox for review. **Default.**
2. Auto-import with duplicate check, then notify. Per-folder opt-in only.
3. Scan only.

Confirmed default: **Inbox review**. Watch folders collect random downloads, partial captures, rips and temp files, so they must not silently enter the library before duplicate and license review. A trusted incoming folder can opt into auto-import per folder.

Rules:

- The Inbox item groups the batch.
- The user can accept all, review individually or ignore.
- Auto-import is never global by default.
- The chosen behavior is stored per watch folder.
- Debounce file writes.
- Wait for file copy to finish.
- Ignore temporary files.
- Handle renamed files.
- Handle deleted files.
- Do not import the same file twice.
- Do not block on enrichment.
- Report failures in Inbox.

## 9. Analysis

- BPM.
- Key.
- Beat grid.
- Downbeat.
- Phrase markers.
- Waveform peaks.
- Loudness.
- Duration.
- Sample rate / bit depth / channels.

Rules:

- Real audio only.
- Mark `Not analyzed` until done.
- Mark `Stale analysis` when the file changes.
- Analysis failure is visible.
- Re-analysis is explicit.
- Analysis runs off the UI thread.
- Analysis can be paused.

## 10. Enrichment

Providers:

- MusicBrainz — canonical artist/release metadata.
- ReccoBeats — audio features.
- Last.fm — similar artists/tags.
- Discogs — release/label metadata.
- Spotify / SoundCloud / Bandcamp — only within approved access.

Rules:

- Online enrichment never blocks import.
- Cache results.
- Respect rate limits.
- Use a meaningful User-Agent.
- Show attribution.
- Do not overwrite manual edits silently.
- Store provider and confidence.
- Allow disable per provider.
- Fail gracefully offline.

## 11. Metadata priority

Proposed:

1. Manual user edit.
2. File tags.
3. DJ app pull.
4. MusicBrainz.
5. Provider enrichment.
6. Inferred.

Rules:

- Never let a lower-priority source overwrite a higher-priority manual edit.
- Show the source.
- Allow “revert to file tag”.
- Keep original values for audit.

## 12. Import Center UI

```text
Import Center

Active
  D:\Incoming\Promos       142 files    Analyzing 38%
  Drag and drop            3 files      Ready

Recent
  D:\Music\New             1,204 files  Imported
  SoundCloud free download 1 file       Imported

Failed
  2 files   Unsupported format
  1 file    Permission denied

[ Add folder ] [ Add files ] [ Scan watch folders ]
```

## 13. Import errors

| Error | Behavior |
|---|---|
| Unsupported format | Skip, list in Inbox |
| Corrupt file | Import metadata if possible, mark `Needs Attention` |
| Permission denied | Explain, retry |
| Path too long | Suggest shortening or moving |
| Duplicate | Review, do not auto-delete |
| No audio stream | Mark unreadable |
| Metadata unreadable | Import with blanks, review |
| Disk full | Pause, notify |
| File changed during import | Re-read or retry |

## 14. Performance

- Scan in batches.
- Stream file list.
- Use a worker pool.
- Limit concurrent analysis.
- Persist job progress.
- Resume after restart.
- Avoid loading the whole library into memory.
- Use incremental UI updates.
- Test with 30,000+ files.

## 15. Import and backup

- Import does not require a backup.
- Mass metadata changes after import do.
- The mass-edit threshold is >50 tracks or >10% of the library, whichever is smaller.
- Before a large import, suggest a backup if none exists.
- Before rewriting file tags, create a metadata snapshot.
- Before moving files, create a backup.

## 16. Acceptance tests

- Import a single MP3.
- Import a folder.
- Import a file with no tags.
- Import a duplicate.
- Import a corrupt file.
- Import while offline.
- Import while analysis is running.
- Pause and resume analysis.
- Restart during import.
- Watch folder add, rename and delete.
- Unicode paths.
- Long paths.
- Read-only file.
- Disk full.
- 30,000-file scan performance.

## 17. Decisions and open questions

Confirmed:

1. Watch folder default: **Inbox review**; per-folder auto-import is opt-in; never global.
2. Metadata is **database-first**; writing tags to files is an explicit job.
3. One library in v1.
4. Formats: MP3, FLAC, WAV, AIFF and M4A/AAC; OGG/Opus best-effort; no WMA or DRM.
5. Default import mode: **Quick**.
6. Mass-edit backup trigger: >50 tracks or >10% of the library, whichever is smaller.
7. Discover downloads: Inbox/Import Center review; no auto-import.

Still open:

1. What is the duplicate duration tolerance?
2. Which enrichment providers are enabled by default?
3. Should artwork be written to files or only cached?
4. What is the maximum import batch size before a backup prompt?
