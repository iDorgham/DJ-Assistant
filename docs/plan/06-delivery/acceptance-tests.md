# Acceptance Tests

Last updated: 2026-10-23  
Status: Proposed

## 1. Test strategy

- Unit tests for pure logic.
- Integration tests for database, import, sync and backup.
- End-to-end tests for user flows.
- Manual hardware tests for USB and audio.
- Performance tests with a 30,000-track fixture.
- Accessibility tests with keyboard and screen reader.
- Cross-platform tests on Windows and macOS.

## 2. Shell and navigation

- [ ] Six tabs are present: Library, Playlists, Discover, Statistics, Publish, Settings.
- [ ] v1 exposes one library, with no library switcher or per-library routing.
- [ ] Library is the default tab.
- [ ] Maintain is inside Library.
- [ ] Set Score is inside Playlists.
- [ ] Import Center is in the top bar, not a tab.
- [ ] Inbox combines Needs Attention and Updates.
- [ ] Player dock persists across tabs.
- [ ] Navigation state restores after relaunch.
- [ ] Keyboard navigation works.
- [ ] Deep links open the correct view.

## 3. Library

- [ ] 30,000 tracks load without freezing.
- [ ] Table/grid/compact views work.
- [ ] Sorting and filtering work.
- [ ] Filters persist.
- [ ] Multi-select works.
- [ ] Bulk actions show scope.
- [ ] Opening a track opens the shared Track panel.
- [ ] Missing file status is visible.
- [ ] Quarantined tracks are hidden by default and restorable.
- [ ] Empty states are helpful.

## 4. Import

- [ ] Import a single MP3.
- [ ] Import MP3, FLAC, WAV, AIFF and M4A/AAC.
- [ ] OGG/Opus is best-effort and reports unsupported cases clearly.
- [ ] WMA and DRM-protected files are rejected with a clear reason.
- [ ] Quick is the default import mode.
- [ ] Curated is available as an explicit per-job choice.
- [ ] Import a folder.
- [ ] Import a file with no tags.
- [ ] Import a duplicate.
- [ ] Import a corrupt file.
- [ ] Import offline.
- [ ] Pause/resume analysis.
- [ ] Restart during import.
- [ ] Watch folder add/rename/delete.
- [ ] Watch folder sends new files to Inbox by default.
- [ ] Per-folder auto-import opt-in works.
- [ ] Unicode path.
- [ ] Long path.
- [ ] Read-only file.
- [ ] Disk full.
- [ ] 30,000-file scan completes without UI freeze.
- [ ] Failures appear in Inbox.
- [ ] Metadata edits are database-first.
- [ ] Writing tags to files is an explicit job.
- [ ] Writing tags requires a backup and scope confirmation.
- [ ] Artwork is cache-only in v1.

## 5. Player

- [ ] Real audio plays.
- [ ] Pause/resume.
- [ ] Switch presentation without restart.
- [ ] Waveform uses real peaks.
- [ ] Beat grid renders only when available.
- [ ] EQ8 has eight bands.
- [ ] CUE behaves Traktor-style.
- [ ] Hot cues persist.
- [ ] Loops work.
- [ ] No Stop button.
- [ ] Missing file shows error and does not fake audio.
- [ ] Device disconnect handled.
- [ ] Keyboard controls work.
- [ ] Screen reader announces track changes.

## 6. Playlists and Set Score

- [ ] Create playlist.
- [ ] Smart playlists are not in v1.
- [ ] Add/remove tracks.
- [ ] Drag reorder.
- [ ] Save changes.
- [ ] Dirty indicator.
- [ ] Close warning.
- [ ] Crash recovery draft.
- [ ] Review draft.
- [ ] Restore draft.
- [ ] Discard draft.
- [ ] Save failure keeps draft.
- [ ] Undo/redo.
- [ ] Set Score uses real analysis.
- [ ] Set Score weights are 25/20/15/10/10/10/10.
- [ ] Missing data shows “Not enough data”.
- [ ] Set Readiness blocks missing files.
- [ ] Suggestions preview in player.
- [ ] Player view opens playlist on wide screens.
- [ ] Sync/USB prompt if dirty.

## 7. Maintain and tags

- [ ] Hybrid tag model works.
- [ ] Genre tree.
- [ ] Flat facets.
- [ ] Energy 1–10 and cannot be created as a tag.
- [ ] Rating displays 0–5 half-stars and stores 0–10.
- [ ] Tag aliases.
- [ ] Rename/merge with preview.
- [ ] Genre cleanup preview.
- [ ] Artist cleanup preview.
- [ ] Duplicate resolution.
- [ ] Missing file relink.
- [ ] Quarantine.
- [ ] Cleanup age defaults to 12 months.
- [ ] 6/12/24-month presets work.
- [ ] Library Health weights are 20/15/15/15/10/10/10/5.
- [ ] Unconfigured categories are neutral.
- [ ] Smart Fix never auto-applies.
- [ ] Restore.
- [ ] Permanent purge requires typed confirmation.
- [ ] Smart Fix preview.
- [ ] Undo.
- [ ] History.
- [ ] Bulk edit triggers backup.
- [ ] Library Health drill-down.

## 8. Discover

- [ ] Source list.
- [ ] Free downloads prioritized.
- [ ] Discover v1 sources are Bandcamp free, SoundCloud downloads and label promos.
- [ ] No scraping.
- [ ] Source/license/attribution visible.
- [ ] Download only when enabled.
- [ ] No scraping.
- [ ] Provider offline.
- [ ] Rate limit.
- [ ] Download enters Import Center/Inbox for review.
- [ ] No download is auto-imported.
- [ ] Duplicate check.
- [ ] Watchlist.
- [ ] Weekly digest.
- [ ] Promo embargo.
- [ ] No unauthorized download.

## 9. Statistics

- [ ] Whole-library scope.
- [ ] Statistics default to all-time.
- [ ] Date range applies only to Play History and Additions.
- [ ] No playlist-scoped Statistics in v1.
- [ ] KPI counts correct.
- [ ] Charts render.
- [ ] Missing data labeled.
- [ ] Click-through to filtered Library.
- [ ] Play history source labeled.
- [ ] Internal and imported history are separate and labeled.
- [ ] Third-party play history import is explicit.
- [ ] No fake zeros.
- [ ] CSV/PNG export.
- [ ] 30,000-track aggregation performance.
- [ ] Empty states.

## 10. Sync

- [ ] No app enabled by default.
- [ ] User selects apps.
- [ ] rekordbox is the first adapter.
- [ ] Traktor does not start until rekordbox is stable.
- [ ] Pull reads data.
- [ ] Cues and beat grids are readable even when DJ-app-owned.
- [ ] Review diff.
- [ ] Dry run does not write.
- [ ] Push only approved fields.
- [ ] Conflict resolution options.
- [ ] Conflict policy follows Library/DJ app ownership; BPM/key require review.
- [ ] Backup before sync.
- [ ] Backup failure blocks push by default.
- [ ] App running/locked.
- [ ] Unsupported version.
- [ ] Interrupted push.
- [ ] Rollback where supported.
- [ ] History.
- [ ] At least one real adapter end-to-end.

## 11. Backup and restore

- [ ] External drive backup.
- [ ] NAS backup.
- [ ] Google Drive backup.
- [ ] Google Drive personal account flow works.
- [ ] Workspace restriction is reported as unsupported/untested.
- [ ] Google Drive uses app-created folder only.
- [ ] Restore merge uses per-field “use backup”.
- [ ] Bulk merge is blocked.
- [ ] Mass-edit backup triggers above 50 tracks or 10% of the library, whichever is smaller.
- [ ] Audio included.
- [ ] Metadata included.
- [ ] Artwork/waveform cache excluded.
- [ ] 5 metadata snapshots.
- [ ] Last known good backup protected.
- [ ] Audio mirror incremental.
- [ ] Pause/resume.
- [ ] Cancel.
- [ ] Destination disconnect.
- [ ] Disk full.
- [ ] Permission denied.
- [ ] Locked file.
- [ ] Missing file.
- [ ] Unicode path.
- [ ] Long path.
- [ ] Interrupted upload.
- [ ] Google token expired.
- [ ] Google access revoked.
- [ ] Google quota exceeded.
- [ ] Verification.
- [ ] Partial snapshot.
- [ ] Prune retention.
- [ ] Restore new location.
- [ ] Replace current library.
- [ ] Selective restore.
- [ ] Merge restore.
- [ ] Restore conflict.
- [ ] Restore interrupted.
- [ ] 30,000-track backup/restore.

## 12. USB export

- [ ] Playlist-only export.
- [ ] Missing files block export.
- [ ] Pioneer legacy export is the default supported path.
- [ ] FAT32 is required.
- [ ] exFAT is hardware-gated.
- [ ] NTFS is unsupported.
- [ ] OneLibrary is visible with an experimental label.
- [ ] OneLibrary is not marketed as certified.
- [ ] Serato crates.
- [ ] Format tool.
- [ ] Profiles.
- [ ] Custom icon.
- [ ] Verify after export.
- [ ] Eject.
- [ ] No Lexicon.
- [ ] Windows and macOS.
- [ ] Real hardware validation.

## 13. Accessibility

- [ ] WCAG 2.2 AA contrast.
- [ ] Keyboard-only navigation.
- [ ] Visible focus.
- [ ] Screen-reader labels.
- [ ] Charts have table alternatives.
- [ ] Waveform has text alternative.
- [ ] Reduced motion.
- [ ] High contrast.
- [ ] No color-only status.
- [ ] Target sizes.
- [ ] Error messages tied to fields.

## 14. Performance

- [ ] Library first paint under target.
- [ ] 30,000-row scroll smooth.
- [ ] Filter response under target.
- [ ] Waveform render under target.
- [ ] No UI freeze during analysis.
- [ ] No UI freeze during backup.
- [ ] No UI freeze during sync.
- [ ] Memory stable after long session.
- [ ] Cache size bounded.

## 15. Security

- [ ] Secrets in OS keychain.
- [ ] No tokens in logs.
- [ ] `drive.file` scope only.
- [ ] No client secret in frontend.
- [ ] Least-privilege OAuth.
- [ ] Signed builds.
- [ ] Update verification.
- [ ] Diagnostics redaction.
- [ ] User data deletion.

## 16. Cross-platform

- [ ] Windows 10/11.
- [ ] macOS current.
- [ ] SMB paths.
- [ ] UNC paths.
- [ ] Long paths.
- [ ] Unicode.
- [ ] Audio devices.
- [ ] USB drives.
- [ ] Google Drive OAuth.

## 17. Exit criteria

A slice is complete only when:

- Acceptance tests pass.
- No P0/P1 bugs.
- Accessibility checks pass.
- Performance targets pass.
- History/audit works.
- Error states are implemented.
- Documentation is updated.
- The plan and implementation agree.
