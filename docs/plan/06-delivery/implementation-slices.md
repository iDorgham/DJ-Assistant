# Implementation Slices

Last updated: 2026-10-24  
Status: Active — Stage 1 shipped, Stage 2 in progress; native acceptance QA pending.

## 1. Current state

- **PR #53 merged 2026-10-23** (squash `03991d3c`): the Stage 1 shell, Slice 3A, the v1 plan mirror and the Slice 2 QA checklist are on `main`.
- **PR #54 merged 2026-10-23** (squash `5e7334eb`): the player dock now uses the three-presentation model (Mini / Full / Player view); Extended is retired; BPM fine-tune drives the grid, bar counter and beat jump.
- **PR #55 merged 2026-10-24** (squash `83831774`): the shared Track inspect panel with player entry points.
- **PR #56 merged 2026-10-24** (squash `ed8d1046`): the 30,000-track virtualized Library table and the `DJ_ASSISTANT_DB_PATH` override.
- Slice 3A manual running-window QA is still pending; T2.1.7 and T2.1.13 stay unticked.
- The approved plan is mirrored at `docs/plan/`; the discussion log is `docs/plan/06-delivery/discussions.md`.
- The factory repository is a separate workstream and must not be mixed into DJ Assistant delivery.
- Stage 0 is complete, including the current-library backup. Stage 1 is shipped; native acceptance QA is pending.
- Stage 2 (Library and Track panel) is **in progress** — the shell, filters, shared Track panel and virtualized table are on `main`. Stages 3–12 are **not started**; the `Done` list under each is its exit criteria, not a completion claim.

## 2. Delivery principles

- Build the library core before the extras.
- Build real audio before Set Score.
- Build backup and restore before sync and USB.
- Build dry run before push.
- Build quarantine before purge.
- Build accessibility and performance into each slice, not at the end.
- Each slice must be shippable on its own.
- No slice may silently destroy data.

## 3. Stage 0 — Secure the baseline

Status: **complete 2026-10-23**.

Scope:

- Review uncommitted Slice 3A work.
- Run tests and lint.
- Commit the work.
- Tag a baseline.
- Record the current schema and app version.
- Back up the current library if one exists.

Done:

- [x] Clean working tree.
- [x] Baseline tag: `slice-3a-code-complete`.
- [x] Tests and lint pass.
- [x] Known issues recorded: Slice 3A manual QA is pending.
- [x] Current library backup taken to
      `C:\Users\User\AppData\Local\Temp\opencode\dj-assistant-backups\2026-10-23-slice3a`
      (DB + WAL + SHM).

## 4. Stage 1 — Foundation and shell

Status: **shipped 2026-10-23** — merged via PR #53 (squash `03991d3c`);
running-window acceptance QA is pending.

Scope:

- Tauri shell.
- SQLite database and migrations.
- Design tokens.
- Primary navigation: Library, Playlists, Discover, Statistics, Publish, Settings.
- Top bar: search, Import Center, Inbox, backup status.
- Player dock shell.
- Route structure.
- Settings skeleton.
- Error boundary.
- Logging with redaction.

Implemented:

- [x] Six primary tabs with typed view registry and persisted navigation.
- [x] Top-bar library search, Import Center, Inbox and backup-status actions.
- [x] Honest placeholders for Playlists, Discover, Statistics and Publish.
- [x] Inbox empty state and Settings skeleton with utility links.
- [x] Player dock persists across tabs.
- [x] Player dock rebuilt to the three-presentation model with BPM fine-tune,
      dock-height snap and one hot-cue pad style (PR #54, squash `5e7334eb`).
- [x] Keyboard shortcuts (`Ctrl/Cmd+1..6`, `Ctrl/Cmd+I`, `Ctrl/Cmd+,`)
      and skip-to-main-content.
- [x] App error boundary and redacted renderer logging.
- [x] Automated checks: typecheck, build, Prettier, ESLint and desktop tests.

Acceptance (native Tauri window, not browser mock mode):

- Checklist: [`docs/engineering/STAGE1_MANUAL_QA_CHECKLIST.md`](../../engineering/STAGE1_MANUAL_QA_CHECKLIST.md).
- [ ] All six tabs open.
- [ ] Player dock persists.
- [ ] Navigation state restores.
- [ ] No dead routes.
- [ ] Keyboard navigation works.
- [ ] 30,000-track fixture loads without freezing.

## 5. Stage 2 — Library and Track panel

Status: **in progress** — the Library table (filters, sort, multi-select, column
config, 30k virtualization) and the shared Track panel are merged via PR #55 and
PR #56; the artwork grid, compact list, bulk actions, cue/waveform editor, tag
cleanup and health score remain open.

Scope:

- Library Tracks table.
- Artwork grid.
- Compact list.
- Filters.
- Sorting.
- Selection and bulk actions.
- Shared Track panel.
- Track overview, tags, cues, analysis, playlists, history, file tabs.
- Status chips.
- Empty states.
- Virtualized rows.

Done:

- 30,000 tracks scroll smoothly.
- Selecting a track opens the same panel everywhere.
- Filters persist.
- Bulk actions show scope.
- Track panel is keyboard accessible.

## 6. Stage 3 — Import Center

Scope:

- Folder scan.
- Drag and drop.
- Watch folder with Inbox review by default.
- Per-folder auto-import opt-in.
- Quick as the default import mode.
- Curated as an explicit per-job mode.
- MP3, FLAC, WAV, AIFF and M4A/AAC; OGG/Opus best-effort.
- No WMA or DRM-protected audio.
- Duplicate detection.
- File metadata.
- Analysis queue.
- Background progress.
- Pause/resume.
- Failures in Inbox.
- Import history.

Done:

- Import a folder.
- Import a duplicate.
- Import a corrupt file.
- Import offline.
- Restart during import.
- Watch folder add/rename/delete.
- No UI freeze during analysis.

## 7. Stage 4 — Player

Already shipped (PR #54): the dock shell and its three presentations, dock
heights, BPM fine-tune and the hot-cue strip. The synthesized preview waveform
is **not** the real-peaks deliverable; real audio, real peaks, EQ8, loops and
playlist playback remain.

Scope:

- Real audio engine.
- Mini, Full, Player view.
- Waveform from real peaks.
- Beat grid.
- EQ8.
- Traktor-style CUE and hot cues.
- Loops.
- Playlist playback.
- Track panel integration.
- Audio settings.
- Accessibility.

Done:

- Play real files.
- Switch presentations without restart.
- Cue persistence.
- EQ8 eight bands.
- No Stop button.
- No synthetic audio.
- Device disconnect handled.

## 8. Stage 5 — Playlists and Set Score

Scope:

- Playlist list.
- Playlist Tracks.
- Drag reorder.
- Add/remove.
- Save changes.
- Crash-recovery draft.
- Close warning.
- Undo/redo.
- Set Score.
- Set Check.
- Set Readiness.
- Set Flow.
- Player view playlist.
- CSV/M3U export.

Done:

- Save/recovery acceptance tests pass.
- Set Score uses real analysis.
- Set Score weights are 25/20/15/10/10/10/10.
- Smart playlists are out of v1.
- Statistics date ranges are all-time default; date range only for Play History and Additions.
- Missing data shows “Not enough data”.
- Suggestions preview in player.
- No silent autosave to the saved playlist.

## 9. Stage 6 — Maintain and tags

Scope:

- Maintain Overview.
- Library Health.
- Tags.
- Genres.
- Artists.
- Duplicates.
- Missing Files.
- Quarantine.
- Smart Fixes.
- History.
- Undo.
- Bulk edit backup trigger.
- Library Health weights are 20/15/15/15/10/10/10/5.
- Smart Fix never auto-applies.
- Artwork is cache-only in v1.

Done:

- Confirmed hybrid tag model implemented.
- Energy is numeric 1–10 and never a tag.
- Rating is 0–5 with half-stars, stored 0–10.
- Library Health weights are 20/15/15/15/10/10/10/5.
- Smart Fix never auto-applies.
- Cleanup age defaults to 12 months, with 6/12/24-month presets.
- Genre cleanup preview and undo.
- Artist cleanup preview and undo.
- Duplicate resolution quarantines, never deletes.
- Missing file relink.
- Quarantine restore.
- Purge requires typed confirmation and backup.
- Every fix is in History.

## 10. Stage 7 — Discover

Scope:

- Discover shell.
- For You.
- Free Downloads.
- Sources.
- Watchlist.
- Provider adapters.
- Local-first recommendations.
- Free download license tracking.
- Promo tracking.
- Weekly digest.
- Import handoff.

Done:

- No scraping.
- No unauthorized download.
- Source/license/attribution visible.
- Discover v1 sources are Bandcamp free, SoundCloud downloads and label promos.
- Download enters Import Center/Inbox for review.
- No download is auto-imported.
- Weekly digest is one item, not a flood.
- Provider offline/rate-limited states work.

## 11. Stage 8 — Statistics

Scope:

- Overview.
- Genres.
- Artists.
- BPM & Key.
- Play History.
- Library Health.
- Actionable drill-down.
- CSV/PNG export.
- Missing data states.

Done:

- Every chart links to filtered Library.
- No fake zeros.
- Play history source labeled.
- Whole-library scope only.
- Statistics date ranges are all-time default; date range only for Play History and Additions.
- 30,000-track aggregation is fast.

## 12. Stage 9 — Sync

Scope:

- Sync profiles.
- User-selected apps.
- Pull.
- Review diff.
- Maintain handoff.
- Dry run.
- Push.
- Conflicts.
- Backup before sync.
- History.
- Rollback where supported.
- rekordbox adapter first.
- Traktor adapter second, only after rekordbox is stable.

Done:

- No silent overwrite.
- Dry run never writes.
- Conflict policy follows Library/DJ app ownership; BPM/key require review.
- Conflict resolution works.
- Backup failure blocks push by default.
- App running/locked handled.
- rekordbox validated end to end before Traktor starts.

## 13. Stage 10 — Backup and restore

Scope:

- External drive target.
- NAS SMB/UNC target.
- Google Drive target.
- Daily/sync/mass-edit triggers.
- Metadata snapshots.
- Audio mirror.
- Retention.
- Verification.
- Restore new location.
- Restore replace.
- Restore selective.
- Restore merge.
- UI.
- History.

Build order:

1. External drive backup + verify.
2. Restore to new location.
3. Replace current library.
4. NAS.
5. Google Drive.
6. Selective restore.
7. Merge restore.

Done:

- Backup includes audio, excludes caches.
- 5 snapshots + last known good.
- Google Drive uses `drive.file`, PKCE, keychain.
- Google Drive targets personal accounts; Workspace is untested.
- Google Drive uses app-created folder only.
- Restore merge uses per-field “use backup”; bulk merge blocked.
- Mass-edit backup triggers above 50 tracks or 10% of the library, whichever is smaller.
- Restore all modes pass acceptance tests.
- Interrupted upload resumes.
- Revoked token handled.
- 30,000-track backup/restore tested.

## 14. Stage 11 — USB export

Scope:

- Playlist-only export.
- Pioneer legacy as the default supported path.
- OneLibrary visible and clearly experimental.
- FAT32 required; exFAT only for validated hardware; no NTFS.
- Serato crates.
- Format tool.
- Profiles.
- Custom icon.
- Verify and eject.
- Windows/macOS.

Done:

- Missing files block export.
- Export verified before success.
- Eject safe.
- OneLibrary labeled experimental.
- No Lexicon.
- Hardware validation recorded.

## 15. Stage 12 — Polish

Scope:

- Accessibility audit.
- Performance audit.
- Copy audit.
- Empty/error states.
- Onboarding.
- Crash recovery.
- Diagnostics.
- Cross-platform testing.
- Documentation.
- Release packaging.

Done:

- WCAG 2.2 AA checks pass.
- 30,000-track performance targets met.
- No P0/P1 bugs.
- Backup/restore tested on real data.
- Sync tested with real apps.
- USB tested on real hardware.

## 16. Cross-cutting work

### Testing

- Unit tests for data model.
- Integration tests for import, sync, backup.
- End-to-end tests for core flows.
- Fixture library.
- Corrupt files.
- Unicode paths.
- Long paths.
- 30,000-track fixture.

### Performance

- Virtualized tables.
- Background workers.
- Waveform cache.
- Incremental queries.
- No full-library re-render.
- Measured budgets.

### Security

- OS keychain.
- Redacted logs.
- Least-privilege OAuth.
- No secrets in frontend.
- Signed builds.
- Update verification.

### Observability

- Structured logs.
- Job history.
- Diagnostics bundle.
- Crash reports opt-in.

## 17. Risks

| Risk | Mitigation |
|---|---|
| Uncommitted baseline lost | Stage 0 |
| Tag model changes later | Confirm early |
| Sync adapter complexity | One adapter first |
| Google Drive quota | Incremental, resume, warn |
| OneLibrary certification | Keep experimental |
| 30k performance | Fixture and budgets |
| Data loss | Backup, quarantine, audit |
| Scope creep | Six-tab IA, no dashboard |
