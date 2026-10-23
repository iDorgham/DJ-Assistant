# Discussions and Decision Log

Last updated: 2026-10-23  
Status: Active  
Owner: Product + engineering  
Decision register: [`README.md`](../README.md) §4, D-001–D-052

This file records **why** the plan is shaped the way it is: the alternatives
considered, the trade-offs accepted, the UI/UX changes, the implementation
consequences and the items deliberately left open. It complements the decision
register; it does not replace it.

The plan's decision IDs (`D-001–D-052`) are scoped to `docs/plan/`. They are
separate from the repository's agent-memory decision ledger
(`docs/ai/memory/decisions.md`, currently `D-001–D-014`).

## How to use this log

- Add a dated entry when a decision changes, a new trade-off is accepted, or an
  implementation detail needs context that the plan alone does not preserve.
- Link to the affected plan document and to the code or task where relevant.
- Record rejected alternatives. A decision without its rejected alternative is
  easy to reopen by accident.
- Never rewrite history. Supersede an entry with a new one and link back.
- Keep unresolved items here only while they are genuinely open; move locked
  outcomes into the decision register.

---

## 2026-10-23 — v1 plan locked, mirrored and ready for implementation

### Context

The product plan was developed in Plan mode across four areas: product shape,
the six-tab experience, the data/sync/backup model and the delivery slices. The
last batch of decisions was reviewed for conflicts, then locked as
**D-043–D-052**. Slice 3A already existed as uncommitted work, so the baseline
had to be secured before any new implementation could start safely.

The plan is now mirrored at `docs/plan/`. The repository copy is the
implementation reference; the original plan-mode copy remains an archive.

### Locked product shape

- **Six primary tabs:** Library, Playlists, Discover, Statistics, Publish,
  Settings.
- **Library is the main workspace.** Maintain is a workspace inside Library.
- **Playlists own sets.** Set Score is a sub-view of a playlist, not a tab.
- **Import is a top-bar Import Center**, not a permanent tab.
- **Inbox combines Needs Attention and Updates.** There are no separate
  notification or attention tabs.
- **One player engine, four presentations:** Mini, Full, Extended and Player
  view. The dock persists across tabs.
- **One library in v1.** Saved views, tags and playlists provide separation.
  Multiple libraries would add routing, backup and statistics scope that the
  product does not need yet.
- **Statistics is whole-library in v1.** Date ranges apply only to Play History
  and Additions; playlist-scoped statistics are out of scope.

### Locked data and safety decisions

- **Real audio only.** No synthetic playback, placeholder waveform data or demo
  library. A browser-only session is a mock and is not acceptance evidence.
- **Database-first metadata.** Writing tags to files is an explicit background
  job after backup and scope confirmation. The job appears in History with
  progress and pause.
- **Hybrid tag model.** Hierarchical Genre/Subgenre plus flat facets. Energy is a
  numeric 1–10 value, never a tag. Rating is 0–5 stars with half-stars, stored
  as 0–10.
- **Watch folders default to Inbox review.** Per-folder auto-import is explicit;
  there is never a global auto-import setting.
- **Cleanup is quarantine-first.** Permanent purge requires typed confirmation.
- **Playlist edits are explicit.** Save changes is deliberate, an autosaved
  crash-recovery draft exists, and normal close warns about unsaved changes.
- **DJ app ownership is explicit.** The Library wins editorial metadata; the DJ
  app wins cues and beat grids; BPM/key conflicts require review.
- **rekordbox first, Traktor second.** Traktor does not start until rekordbox is
  stable end to end.
- **Backups include audio and metadata.** Artwork and waveform caches are
  excluded. Retention is five metadata snapshots plus the last known good full
  backup.
- **Google Drive is the only cloud target in v1.** Personal accounts only in
  v1; Workspace is untested. The app uses an app-created
  `DJ Assistant Backups` folder, not an arbitrary folder picker.
- **Restore merge is per-field.** Keep the current Library value by default,
  show the backup value, and require an explicit “use backup” choice. Bulk merge
  is blocked.
- **USB media is conservative.** FAT32 is required, exFAT only for validated
  hardware profiles, NTFS unsupported. OneLibrary is visible but clearly
  experimental until AlphaTheta certification.
- **Smart Fix never auto-applies.** Preview plus one-click apply.
- **Library Health uses fixed v1 weights:** 20/15/15/15/10/10/10/5.
  Unconfigured categories are neutral; configured-but-failing categories count.
- **Smart playlists are out of v1.** Manual and imported playlists only.
- **Artwork is cache-only in v1.** Writing artwork into files is an explicit
  advanced action.

### Locked UI/UX decisions

- **Dense but calm.** The interface should feel like a professional music tool,
  not a dashboard.
- **Dark-first with a proper light theme.** Semantic tokens, no second palette.
- **No dashboard, no decorative charts, no fake data.** Missing data is shown
  explicitly; zero is not used as a substitute.
- **Sentence case, persistent labels, visible units and counts.** Tooltips carry
  the detail that compact cells truncate.
- **Every state is designed:** default, hover, focus, active, selected,
  disabled, loading, error, empty, partial.
- **WCAG 2.2 AA:** keyboard reachability, visible focus, target size, contrast,
  reduced motion, text alternatives for waveform and charts, no color-only
  meaning.
- **Destructive actions explain scope and consequence.** Typed confirmation is
  required for irreversible actions; a safer alternative is offered.
- **Compact library table** with sticky header, sorting, resizing, visibility,
  row selection, bulk action bar and virtualized rows for large libraries.
- **Tag chips** have `+N` overflow and click-through into the filter bar. The
  `tags` column is off by default.
- **Row context menu** is the entry point to the metadata editor in Slice 3A.
  It ships only “Edit tags…” for now; the wider menu remains later work.
- **Metadata editor** covers title, artist, album, genre, label, year, custom
  tags and the user comment. The comment overwrites `tracks.comments`; the
  previous value survives through Undo.
- **Set Score suggestions preview in the shared player.** The player is never
  duplicated per screen.
- **Copy uses the shared vocabulary:** “Quarantine”, not “Delete”, unless the
  action is irreversible; “Permanent purge” only for irreversible deletion.

### Implementation decisions

- **Slice 3A is code-complete** in commit `ec2b191f`, tagged
  `slice-3a-code-complete`.
- Migration 007 adds `track_tags` and `tracks.label`.
- Tags are read into `TrackSummary.tags`; the `tag` filter is an `EXISTS` in
  `library_query.rs`; free-text search covers comments and tag values.
- The write path snapshots a whole tag set transactionally. Undo restores a set
  only when it still matches the snapshot; a track changed since is skipped.
- Pure write rules live in `crates/core` (`patch.rs`, `tags.rs`) because the
  desktop crate's test harness does not load on this Windows toolchain.
- The UI adds `TagChips`, the `tags` column, the row context menu and the
  metadata editor.
- **Automated checks pass:** `pnpm lint`, `pnpm typecheck`, desktop node tests,
  `pnpm rust:fmt`, `pnpm rust:clippy`, and
  `cargo test -p dj-assistant-core -p dj-assistant-schema-tests`.
- **Manual running-window QA is still open.** T2.1.7 and T2.1.13 stay unticked.
  The checklist is
  [`SLICE3A_MANUAL_QA_CHECKLIST.md`](../../engineering/SLICE3A_MANUAL_QA_CHECKLIST.md).

### Alternatives considered and rejected

- **Per-library workspaces in v1.** Rejected: extra routing, backup scope,
  statistics scope and a second vocabulary before the core library is finished.
- **Separate Maintain and Set Score tabs.** Rejected: they are workflows inside
  Library and Playlists, not destinations.
- **Dashboard-first landing page.** Rejected: DJs open the library, not a report.
- **Synthetic demo audio.** Rejected: it would make acceptance evidence
  meaningless and violate the real-audio rule.
- **Automatic tag writes to files.** Rejected for v1: destructive, hard to
  reverse and unnecessary for the database-first workflow.
- **Global watch-folder auto-import.** Rejected: partial and junk files would
  enter the library without review.
- **Last-write-wins sync.** Rejected: it silently destroys editorial work.
- **Metadata-only backup.** Rejected: rebuilding audio metadata does not rebuild
  the library.
- **Arbitrary Google Drive folder selection.** Rejected for v1: `drive.file`
  scope is least-privilege and app-created folders are easier to verify.
- **Bulk restore merge.** Rejected: a merge without a per-field decision is a
  silent overwrite with extra steps.
- **Silent Smart Fix auto-apply.** Rejected: “smart” is not permission.
- **Smart playlists in v1.** Rejected: rule evaluation, refresh and sync
  semantics would expand the scope before the manual playlist workflow is solid.
- **Writing artwork into files in v1.** Rejected: the cache is enough for the
  library UI; file writes remain explicit and advanced.
- **Scraping Beatport/Bandcamp/SoundCloud.** Rejected: brittle, hostile to the
  sources and outside the manual/link-out-first API strategy.

### Delivery sequence

1. **Stage 0 — Secure the baseline.** Complete: commit, tag, tests, known
   issues recorded, and a current-library DB/WAL/SHM backup taken to
   `C:\Users\User\AppData\Local\Temp\opencode\dj-assistant-backups\2026-10-23-slice3a`.
2. **Stage 1 — Foundation and shell.** Six tabs, top bar, player dock shell,
   route structure, settings skeleton, error boundary and redacted logging.
3. **Stage 2 — Library and Track panel.** Table, artwork grid, compact list,
   filters, sorting, bulk actions, shared Track panel and virtualized rows.
4. **Stage 3 — Import Center.** Scan, drag/drop, watch folder, Quick default,
   formats, duplicate detection and analysis queue.
5. **Stage 4 — Player.** Real audio, peaks, beat grid, EQ8, Traktor-style cues,
   loops and accessibility.
6. **Stage 5 — Playlists and Set Score.** Explicit save, recovery, Set Score,
   Set Check, Set Readiness and Set Flow.
7. **Stage 6 — Maintain and tags.** Health, tags, genres, artists, duplicates,
   missing files, quarantine, Smart Fixes and History.
8. **Stage 7 — Discover.** Local-first recommendations, free downloads, sources,
   watchlist and Inbox handoff.
9. **Stage 8 — Statistics.** Whole-library views, drill-down and date ranges.
10. **Stage 9 — Sync.** Pull → Review → Maintain → Push, rekordbox first.
11. **Stage 10 — Backup and restore.** External drive, NAS, Google Drive and all
    four restore modes.
12. **Stage 11 — USB export.** Playlist-only, Pioneer legacy default, OneLibrary
    experimental.
13. **Stage 12 — Polish.** Accessibility, performance, copy, onboarding,
    diagnostics and release packaging.

### Known risks and open items

- Slice 3A manual QA is not executed; do not mark T2.1.7 or T2.1.13 complete.
- A current-library DB/WAL/SHM backup was taken before the next migration to
  `C:\Users\User\AppData\Local\Temp\opencode\dj-assistant-backups\2026-10-23-slice3a`.
- OneLibrary certification requires AlphaTheta; keep it labeled experimental.
- No Google Drive, SoundCloud, Bandcamp, Beatport or Spotify API project exists
  yet.
- USB filesystem and OneLibrary behavior need real hardware validation.
- Non-blocking open items: mass-export threshold, Serato crate feature set,
  apps after rekordbox/Traktor, per-adapter rollback and P2 items such as
  localization and telemetry.

### Verification for this entry

- Plan mirrored: `docs/plan/` contains 29 files.
- Slice 3A protected: commit `ec2b191f`, tag `slice-3a-code-complete`.
- Working tree clean after the baseline commit.
- No factory repository files were touched.

---

## Entry template

```md
## YYYY-MM-DD — short title

### Context

What changed, and why now.

### Decision

What was chosen.

### Alternatives rejected

What was not chosen, and why.

### Consequences

UI/UX, data, sync, backup, performance, security or delivery impact.

### Open items

What remains unresolved, and who or what unblocks it.
```
