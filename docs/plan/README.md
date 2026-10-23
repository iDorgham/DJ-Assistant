# DJ Assistant — Product, UX and Implementation Plan

Last updated: 2026-10-23  
Status: **Approved and mirrored**. The plan is mirrored into the project at `docs/plan/`; use the project copy as the implementation reference. This source copy is retained as the planning archive.

```text
D:\Work\AI\Projects\DJ Assistant\docs\plan\
```

The plan's decision IDs (**D-001–D-052**) are scoped to this tree. They are separate from the repository's agent-memory decision ledger (`docs/ai/memory/decisions.md`, currently D-001–D-014).

---

## 1. Product in one sentence

DJ Assistant is the DJ's main library and set-preparation application: it imports and analyzes real audio, cleans and tags the library, builds and scores sets, plays music through a real DJ-style player, and publishes only the useful metadata safely to DJ applications and USB devices.

---

## 2. Product shape

DJ Assistant is **library-first**, not dashboard-first.

- The Library is the main workspace.
- Sets are built inside Playlists.
- Maintenance is a full workspace inside Library.
- Import is a top-bar Import Center, not a permanent tab.
- The Inbox combines Needs Attention and Updates.
- Discover, Statistics, Publish and Settings are top-level tabs.
- The player is one engine with three presentations: Mini, Full and Player view.

There is no separate dashboard, notification center, attention center or maintenance tab.

---

## 3. Final information architecture

### Primary tabs

| Tab | Purpose | Sub-tabs / views |
|---|---|---|
| **Library** | The main music library | **Tracks**, **Maintain** |
| **Playlists** | Build, edit and score sets | **Tracks**, **Set Score** |
| **Discover** | Find new music, free downloads and promos | For You, Free Downloads, Sources, Watchlist |
| **Statistics** | Whole-library insight | Overview, Genres, Artists, BPM & Key, Play History, Library Health |
| **Publish** | Send metadata to DJ apps and USB | **Sync Library**, **USB Export** |
| **Settings** | App, library, player, sync, backup and privacy | General, Library, Import, Player, Audio, Tags, Sync, USB, Backup, Notifications, Privacy, Advanced |

### Persistent chrome

```text
┌──────────────────────────────────────────────────────────────┐
│ Global search   Import Center   Inbox   Backup status        │
├──────────────┬───────────────────────────────────────────────┤
│ Library      │                                               │
│ Playlists    │                 Main workspace                │
│ Discover     │                                               │
│ Statistics   │                                               │
│ Publish      │                                               │
│ Settings     │                                               │
├──────────────┴───────────────────────────────────────────────┤
│ Player dock: Mini / Full / Player view                       │
└──────────────────────────────────────────────────────────────┘
```

### Maintain inside Library

Maintain is a workspace, not a top-level tab.

```text
Library  ›  Maintain
  Overview
  Tags
  Genres
  Artists
  Duplicates
  Missing Files
  Unused / Quarantine
  Smart Fixes
  History
```

### Set Score inside Playlists

```text
Playlists  ›  [Playlist]  ›  Tracks | Set Score
```

Set Score is not a top-level tab.

---

## 4. Locked decisions

| ID | Decision | Status |
|---|---|---|
| D-001 | Six primary tabs: Library, Playlists, Discover, Statistics, Publish, Settings | Locked |
| D-002 | Maintain is a full workspace inside Library | Locked |
| D-003 | Set Score lives inside Playlists | Locked |
| D-004 | Import is a top-bar Import Center, not a permanent tab | Locked |
| D-005 | Inbox combines Needs Attention and Updates; no separate notification/attention tabs | Locked |
| D-006 | Statistics is whole-library only in v1; playlist-scoped statistics later | Locked |
| D-007 | Discover is top-level; local-first recommendations; free downloads first | Locked |
| D-008 | Sync pipeline is Pull → Review → Maintain → Push; user chooses participating DJ apps | Locked |
| D-009 | Cleanup is review-for-quarantine, never silent deletion; permanent purge needs explicit confirmation | Locked |
| D-010 | Inbox defaults: watch folder immediate review item, Maintain daily digest, Discover weekly digest | Locked |
| D-011 | Backup includes audio files and metadata | Locked |
| D-012 | Backup destinations: external drive, NAS, Google Drive | Locked |
| D-013 | Backup schedule: daily + before sync + before mass edits | Locked |
| D-014 | Retention: 5 metadata snapshots + last known good full backup; one audio mirror per destination | Locked |
| D-015 | Do not back up artwork or waveform caches; regenerate them | Locked |
| D-016 | Encryption: TLS + provider-side encryption now; app-level encryption later | Locked |
| D-017 | Restore modes all in v1, built in order: new location → replace → selective → merge; merge requires per-field “use backup”; bulk merge is blocked | Locked |
| D-018 | Cloud v1 is Google Drive only; S3-compatible and Dropbox later | Locked |
| D-019 | NAS uses SMB/UNC paths first | Locked |
| D-020 | USB export v1: playlist-only; Pioneer legacy + OneLibrary (experimental until certified); Serato crates; in-app format tool | Locked |
| D-021 | Real audio, real peaks and real beat grids only; no synthetic playback or placeholder waveform data | Locked |
| D-022 | No Lexicon compatibility | Locked |
| D-023 | API strategy: manual/link-out and free APIs first; partner access later, never a v1 dependency; no scraping | Locked |
| D-024 | Playlist edits use explicit Save changes, an autosaved crash-recovery draft, and a warning on normal close | Locked |
| D-025 | Player uses EQ8 (eight bands), Traktor-style CUE/hotcues, and no Stop button | Locked |
| D-026 | Tags use a hybrid model: hierarchical Genre/Subgenre + flat Style/Mood/Set Position/etc. + numeric Energy 1–10; Energy is not a tag | Locked |
| D-027 | Default DJ-app publishing uses the non-destructive safe payload; legacy four-column mapping is advanced and opt-in | Locked |
| D-028 | One library in v1; multiple libraries later only if needed | Locked |
| D-029 | First sync adapter is rekordbox; Traktor is the second adapter after rekordbox is stable | Locked |
| D-030 | DJ app owns cues and beat grids by default; DJ Assistant reads them for health checks only and does not write by default | Locked |
| D-031 | Rating is 0–5 stars with half-stars in the UI, stored as a 0–10 integer | Locked |
| D-032 | Watch folder default is Inbox review; per-folder auto-import is an explicit opt-in; never a global auto-import setting | Locked |
| D-033 | Play history combines internal and imported history, labeled separately; third-party imports are explicit and provenance is stored | Locked |
| D-034 | Metadata is database-first; writing tags to files is an explicit background job after backup and scope confirmation; the job appears in History with progress and pause | Locked |
| D-035 | v1 supports MP3, FLAC, WAV, AIFF and M4A/AAC; OGG/Opus is best-effort; no WMA or DRM-protected audio | Locked |
| D-036 | Default import mode is Quick; Curated is explicit per job | Locked |
| D-037 | Cleanup age default is 12 months, with 6/12/24-month presets | Locked |
| D-038 | Mass-edit backup trigger is more than 50 tracks or more than 10% of the library, whichever is smaller | Locked |
| D-039 | Discover downloads go to Inbox/Import Center for review; no auto-import | Locked |
| D-040 | Set Score weights are 25/20/15/10/10/10/10 for energy, key, BPM, vocals, variety, tension/release and readiness | Locked |
| D-041 | Google Drive v1 targets personal accounts; Workspace is untested and not guaranteed | Locked |
| D-042 | OneLibrary is visible in v1 as clearly experimental; Pioneer legacy is the default supported path | Locked |
| D-043 | Statistics date ranges: all-time default; date range only for Play History and Additions; no playlist scope | Locked |
| D-044 | Discover v1 sources: Bandcamp free/name-your-price, SoundCloud download-enabled tracks, label/promoter promos; manual/link-out first; no scraping; no Beatport dependency | Locked |
| D-045 | Default sync conflict policy: Library wins editorial metadata; DJ app wins cues/beat grids; BPM/key require review | Locked |
| D-046 | Google Drive folder choice: app-created `DJ Assistant Backups` folder only in v1; no arbitrary folder picker | Locked |
| D-047 | USB filesystem profiles: FAT32 required; exFAT only for validated hardware profiles; no NTFS | Locked |
| D-048 | Restore merge default: keep current Library value; show backup value; per-field “use backup”; bulk merge blocked | Locked |
| D-049 | Smart Fix auto-apply: no silent auto-apply; preview + one-click apply | Locked |
| D-050 | Library Health weights: 20/15/15/15/10/10/10/5; unconfigured categories are neutral; configured-but-failing categories count | Locked |
| D-051 | Smart playlists: out of v1; manual and imported playlists only | Locked |
| D-052 | Artwork handling: cache only in v1; writing artwork to files is an explicit advanced action | Locked |

### Explicit non-goals for v1

- Lexicon compatibility.
- Synthetic or demo audio playback.
- WMA and DRM-protected audio in v1.
- Multiple independent libraries in v1.
- A dashboard page.
- Separate Needs Attention and Updates tabs.
- Separate Maintain or Set Score top-level tabs.
- Playlist-scoped Statistics.
- S3-compatible, Dropbox or OneDrive backup.
- Full USB library export.
- OneLibrary as a certified feature before AlphaTheta approval.
- Scraping Beatport, Bandcamp, SoundCloud or any other catalog.

---

## 5. Core workflow

```text
Import → Identify → Analyze → Tag → Organize → Prepare → Perform → Publish → Maintain
```

The application is the main library. DJ applications are participants, not the source of truth for everything.

```text
Pull from DJ apps
  → Review changes and conflicts
  → Maintain in DJ Assistant
  → Push approved changes back
```

No sync step silently overwrites another application.

---

## 6. Plan map

```text
dj-assistant/
  README.md
  api-access-guide.md

  01-product/
    vision-and-principles.md
    information-architecture.md
    lifecycle-and-vocabulary.md
    onboarding.md

  02-experience/
    shell-navigation-and-inbox.md
    library-and-maintain.md
    maintain-and-tags.md
    playlists-and-set-score.md
    discover.md
    statistics.md
    publish-and-usb.md
    settings.md
    track-panel-and-player.md

  03-player/
    player-model-and-layouts.md
    eq8-and-cue.md
    playlist-save-and-recovery.md
    player-settings-and-accessibility.md

  04-data-and-sync/
    import-and-enrichment.md
    data-model.md
    sync-and-source-of-truth.md
    backup-and-restore.md

  05-design-system/
    ui-ux-guidelines.md
    copy-and-microcopy.md

  06-delivery/
    implementation-slices.md
    acceptance-tests.md
    open-questions.md

  07-diagrams/
    mermaid-flows.md
```

---

## 7. Reading order

1. `01-product` — why the app exists, final IA, vocabulary, first run.
2. `02-experience` — every tab and workspace, including Maintain, Discover, Statistics, Publish and Settings.
3. `03-player` — one engine, three presentations, EQ8, Traktor-style cues, playlist save/recovery.
4. `04-data-and-sync` — import, data model, sync, backup and restore.
5. `05-design-system` — visual rules, states, accessibility and copy.
6. `06-delivery` — build order, acceptance tests and open questions.
7. `07-diagrams` — flows in one place.
8. `api-access-guide.md` — provider access and Google Drive backup setup.

---

## 8. The connectedness rule

Every screen must feel like the same application:

- Opening a track from Import, Library, Playlist, Player, Discover or Search opens the same Track panel.
- A missing tag, duplicate, missing file, scan failure, sync conflict or backup failure lands in the same Inbox.
- The player dock is always the same player, only presented differently.
- Set Score suggestions preview in the same player.
- Sync conflicts return to the same Inbox.
- Statistics links to the same filtered Library, not a separate report view.
- Discover saves to the same library, wishlist and Inbox.
- The same status chips and vocabulary appear everywhere.

If a feature needs its own vocabulary, inspector or status model, it is not ready.

---

## 9. Current project state

- Slice 3A is code-complete, committed as `ec2b191f` and tagged `slice-3a-code-complete`.
- Slice 3A manual running-window QA is still pending; T2.1.7 and T2.1.13 stay unticked.
- The approved plan is mirrored at `docs/plan/` in the DJ Assistant project.
- The discussion log lives at `docs/plan/06-delivery/discussions.md`.
- The factory repository is a separate workstream and must not be mixed into DJ Assistant delivery.
- OneLibrary certification has not started; it requires an AlphaTheta contact and partner process.
- No SoundCloud, Bandcamp, Beatport, Spotify or Google Drive API projects exist yet.
- USB hardware validation and OneLibrary testing remain pending.

---

## 10. Next gate

The plan and baseline are secured. The **Stage 1 shell is implemented**; native acceptance QA is pending before Stage 2 begins.

1. ~~Confirm the hybrid tag model (D-026).~~ Locked.
2. ~~Resolve the remaining decisions.~~ Locked as D-043–D-052; non-blocking items remain in `06-delivery/open-questions.md`.
3. ~~Secure Slice 3A with a commit/tag.~~ Done: `ec2b191f`, tag `slice-3a-code-complete`.
4. ~~Mirror the plan into `docs/plan/`.~~ Done.
5. Run the Slice 3A manual QA in the Tauri window; keep T2.1.7 and T2.1.13 unticked until it passes.
6. Run the Stage 1 native acceptance pass: six tabs, player persistence, navigation restore, no dead routes, keyboard navigation and the 30,000-track fixture.
7. Start Stage 2 — Library and Track panel after Stage 1 acceptance.

---

## 11. Decision log

The detailed decision log lives in `06-delivery/open-questions.md` and in each relevant document. Locked decisions should not be reopened without a written reason.
