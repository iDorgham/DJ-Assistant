# Open Questions and Decision Register

Last updated: 2026-10-23  
Status: Q1–Q9, Q10, Q11–Q13, Q14, Q15, Q16, Q17, Q18, Q19, Q20, Q21, Q22, Q23, Q24 and Q33 resolved; P2 and non-decision items remain open

## 1. How to use this file

- **Locked** decisions are not open unless there is a written reason.
- **P0** questions block architecture or the first implementation slice.
- **P1** questions block a specific milestone.
- **P2** questions can be answered later without blocking the plan.

Each question includes a recommendation. The user can accept, change or defer it.

---

## 2. Locked decisions

| ID | Decision |
|---|---|
| D-001 | Six primary tabs: Library, Playlists, Discover, Statistics, Publish, Settings |
| D-002 | Maintain is a full workspace inside Library |
| D-003 | Set Score lives inside Playlists |
| D-004 | Import is a top-bar Import Center |
| D-005 | Inbox combines Needs Attention and Updates |
| D-006 | Statistics is whole-library only in v1 |
| D-007 | Discover is top-level; local-first; free downloads first |
| D-008 | Sync is Pull → Review → Maintain → Push; user selects apps |
| D-009 | Cleanup is quarantine-first; purge requires explicit confirmation |
| D-010 | Inbox defaults: watch folder immediate, Maintain daily, Discover weekly |
| D-011 | Backup includes audio and metadata |
| D-012 | Backup destinations: external drive, NAS, Google Drive |
| D-013 | Backup schedule: daily + before sync + before mass edits |
| D-014 | Retention: 5 metadata snapshots + last known good full backup; 1 audio mirror |
| D-015 | Do not back up artwork or waveform caches |
| D-016 | Encryption: TLS + provider-side now; app-level later |
| D-017 | Restore modes all v1; build new location → replace → selective → merge |
| D-018 | Cloud v1 is Google Drive only; S3/Dropbox later |
| D-019 | NAS uses SMB/UNC first |
| D-020 | USB v1: playlist-only; Pioneer legacy + OneLibrary experimental; Serato crates; format tool |
| D-021 | Real audio, peaks and beat grids only |
| D-022 | No Lexicon compatibility |
| D-023 | API strategy: manual/link-out + free APIs first; partner later; no scraping |
| D-024 | Playlist save is explicit + crash draft + close warning |
| D-025 | EQ8, Traktor-style CUE, no Stop button |
| D-026 | Hybrid tag model; Energy is numeric 1–10 and is not a tag |
| D-027 | Default DJ-app publishing uses the non-destructive safe payload; legacy four-column mapping is advanced and opt-in |
| D-028 | One library in v1 |
| D-029 | First sync adapter is rekordbox; Traktor second |
| D-030 | DJ app owns cues and beat grids by default; DJ Assistant reads them |
| D-031 | Rating is 0–5 half-stars in UI, stored 0–10 |
| D-032 | Watch folder defaults to Inbox review; auto-import is per-folder opt-in |
| D-033 | Play history combines internal and imported, labeled; imports are explicit and provenance is stored |
| D-034 | Metadata is database-first; writing tags to files is an explicit job after backup and scope confirmation |
| D-035 | v1 supports MP3, FLAC, WAV, AIFF and M4A/AAC; OGG/Opus best-effort; no WMA or DRM-protected audio |
| D-036 | Default import mode is Quick; Curated is explicit per job |
| D-037 | Cleanup age default is 12 months, with 6/12/24-month presets |
| D-038 | Mass-edit backup trigger is >50 tracks or >10% of the library, whichever is smaller |
| D-039 | Discover downloads go to Inbox/Import Center for review; no auto-import |
| D-040 | Set Score weights: energy 25, key 20, BPM 15, vocals 10, variety 10, tension/release 10, readiness 10 |
| D-041 | Google Drive v1 targets personal accounts; Workspace is untested and not guaranteed |
| D-042 | OneLibrary is visible as clearly experimental in v1; Pioneer legacy is the supported default |
| D-043 | Statistics date ranges: all-time default; date range only for Play History and Additions; no playlist scope |
| D-044 | Discover v1 sources: Bandcamp free/name-your-price, SoundCloud download-enabled tracks, label/promoter promos; manual/link-out first; no scraping; no Beatport dependency |
| D-045 | Default sync conflict policy: Library wins editorial metadata; DJ app wins cues/beat grids; BPM/key require review |
| D-046 | Google Drive folder choice: app-created `DJ Assistant Backups` folder only in v1; no arbitrary folder picker |
| D-047 | USB filesystem profiles: FAT32 required; exFAT only for validated hardware profiles; no NTFS |
| D-048 | Restore merge default: keep current Library value; show backup value; per-field “use backup”; bulk merge blocked |
| D-049 | Smart Fix auto-apply: no silent auto-apply; preview + one-click apply |
| D-050 | Library Health weights: 20/15/15/15/10/10/10/5; unconfigured categories neutral; configured-but-failing categories count |
| D-051 | Smart playlists: out of v1; manual and imported playlists only |
| D-052 | Artwork handling: cache only in v1; writing artwork to files is an explicit advanced action |

---

## 3. P0 — Resolved and remaining

### Q1. Tag model

**Question:** Confirm the hybrid model?

**Recommendation:** Hybrid.

```text
Genre / Subgenre: hierarchy
Style, Mood, Set Position, Vocal, Version, Content, Structure, Era, Source: flat facets
Energy: numeric 1–10
Custom: user-defined
```

**Why:** Flat-only makes genre cleanup weak; fully hierarchical makes everyday tagging slow.

**Status:** Resolved. Hybrid confirmed. Energy is numeric 1–10 and is not a tag.

---

### Q2. Single library or multiple libraries?

**Question:** Does DJ Assistant manage one library or several independent libraries?

**Recommendation:** One library in v1, with saved views and playlists for separation. Add multiple libraries later only if needed.

**Why:** Multiple libraries affect the database, backup, sync, settings, search and Statistics. It is expensive to retrofit.

**Status:** Resolved. One library in v1.

---

### Q3. Which DJ apps are in v1?

**Question:** Which apps must sync in v1?

Candidates:

- rekordbox
- Traktor
- Serato DJ Pro
- VirtualDJ
- Engine DJ

**Recommendation:** Start with rekordbox as the first end-to-end adapter. Add Traktor only after rekordbox is stable. Do not promise five.

**Why:** Each adapter has different database formats, locks, cue behavior and versioning.

**Status:** Resolved. rekordbox first; Traktor second after rekordbox is stable.

---

### Q4. Cues and beat-grid ownership

**Question:** Who owns cues and beat grids: DJ Assistant or the DJ app?

**Recommendation:** DJ app owns performance data by default; Library can own them if the user opts in per app.

**Why:** Cues are performance-specific. But some users want one source of truth. The conflict model depends on this.

**Status:** Resolved. DJ app owns cues and beat grids by default; DJ Assistant still reads them for health checks and review.

---

### Q5. Rating scale

**Question:** 0–5 stars, 1–5 stars, half-stars, or 1–10?

**Recommendation:** 0–5 stars with half-stars in the UI, stored as 0–10 integer. This maps cleanly to common DJ app scales.

**Why:** Migration and filtering depend on the scale. Do not change it later without a migration.

**Status:** Resolved. 0–5 stars with half-stars in the UI, stored as a 0–10 integer.

---

### Q6. File tagging or database-only metadata?

**Question:** Should edits write ID3/Vorbis tags to files, or only to the DJ Assistant database?

**Recommendation:** Database-first in v1, with an explicit “Write tags to files” background job after a backup and scope confirmation.

**Why:** Writing tags is destructive, slow and format-specific. Database-only is safer for v1.

**Status:** Resolved. Metadata edits are database-first. Writing tags to files is an explicit, pausable job after backup and scope confirmation.

---

### Q7. Watch folder behavior

**Question:** When a new file appears, should DJ Assistant auto-import it or put it in the Inbox for review?

**Recommendation:** Inbox review by default; per-folder auto-import is an explicit opt-in.

**Why:** Watch folders collect random downloads, partial captures, rips and temp files. Auto-import would silently ingest junk before duplicate and license review.

**Status:** Resolved. Inbox review is the default. Trusted folders can opt into auto-import.

---

### Q8. Play history source

**Question:** Is Statistics based on DJ Assistant plays only, imported DJ app history, or both?

**Recommendation:** Both, labeled separately. Internal history is authoritative. Imported history is shown with its source until reconciled.

**Why:** Most DJs play in another app. Internal-only history would be misleading.

**Status:** Resolved. Both sources are shown separately. Third-party imports are explicit and store source, source file and import timestamp.

---

### Q9. Supported audio formats

**Question:** Which formats are supported in v1?

**Recommendation:** MP3, FLAC, WAV, AIFF, M4A/AAC, OGG/Opus. Validate per platform.

**Why:** Format support affects import, analysis, playback and USB export.

**Status:** Resolved. MP3, FLAC, WAV, AIFF and M4A/AAC are supported. OGG/Opus is best-effort. No WMA or DRM-protected audio in v1.

---

### Q10. Statistics date ranges

**Question:** Is v1 all-time only, or does it include date filters?

**Recommendation:** Whole library with all-time totals; add a date range for play history and additions. No playlist scope.

**Why:** Date filters are useful but should not expand v1 into playlist analytics.

**Status:** Resolved. All-time default; date range only for Play History and Additions; no playlist scope.

---

## 4. P1 — Must decide before the relevant milestone

### Q11. Cleanup age default

**Question:** What is the default age for “unused” suggestions?

**Recommendation:** 12 months.

**Options:** 6, 12, 24 months.

**Why:** Too short creates false positives; too long misses clutter.

**Status:** Resolved. Default is 12 months. The presets are 6, 12 and 24 months.

---

### Q12. Mass-edit threshold

**Question:** When should a backup run before a bulk edit?

**Recommendation:** More than 50 tracks or more than 10% of the library, whichever is smaller.

**Why:** Backups before every small edit would be noisy; no backup before a huge edit is risky.

**Status:** Resolved. Trigger a backup above 50 tracks or above 10% of the library, whichever is smaller. This is a backup trigger, not a blocking dialog.

---

### Q13. Discover download flow

**Question:** Does a free download auto-import or land in the Inbox?

**Recommendation:** Land in Import Center/Inbox with duplicate check and license review. No silent auto-import of downloads.

**Why:** Downloads can be mislabeled, malicious or duplicate. Review is safer.

**Status:** Resolved. Downloads land in Inbox/Import Center for review. No auto-import.

---

### Q14. Discover v1 sources

**Question:** Which sources are enabled first?

**Recommendation:** Bandcamp free/name-your-price, SoundCloud downloads, label promos. Beatport and streaming partners later.

**Why:** These are the closest to free downloads and do not require partner catalog access.

**Status:** Resolved. Bandcamp free/name-your-price, SoundCloud download-enabled tracks, label/promoter promos. Manual/link-out first; no scraping; no Beatport dependency.

---

### Q15. Set Score weights

**Question:** Confirm the score signals and weights.

**Recommendation:**

```text
Energy curve 25
Key flow 20
BPM flow 15
Vocal balance 10
Variety 10
Tension/release 10
Readiness 10
```

**Why:** The score must reflect the user's idea of a good set.

**Status:** Resolved. Use 25/20/15/10/10/10/10 as the v1 default. Make weights configurable later.

---

### Q16. Default sync conflict policy

**Question:** When Library and DJ app disagree, which wins by default?

**Recommendation:** Library wins for editorial metadata; DJ app wins for cues and beat grids; BPM/key require review.

**Why:** This matches the proposed source-of-truth matrix.

**Status:** Resolved. Library wins editorial metadata; DJ app wins cues/beat grids; BPM/key require review.

---

### Q17. Google account type

**Question:** Is the Google Drive account personal or Google Workspace?

**Recommendation:** Support both; test personal first.

**Why:** Workspace admins can restrict OAuth apps, scopes and Drive access.

**Status:** Resolved. Personal Google accounts are the v1 target. Workspace is untested and not guaranteed.

---

### Q18. Google Drive folder choice

**Question:** Always use the app-created `DJ Assistant Backups` folder, or let the user choose an existing folder?

**Recommendation:** App-created folder in v1 with `drive.file`. Folder choice later.

**Why:** `drive.file` only grants access to files the app creates; choosing existing folders requires broader access and review.

**Status:** Resolved. App-created `DJ Assistant Backups` folder only in v1; no arbitrary folder picker.

---

### Q19. OneLibrary v1 status

**Question:** Is OneLibrary visible as experimental in v1, or hidden until certification?

**Recommendation:** Visible behind an experimental flag, clearly labeled, with Pioneer legacy as the supported path.

**Why:** It is useful but uncertified. Do not market it as certified.

**Status:** Resolved. Visible in v1 as clearly experimental. Pioneer legacy is the default supported path. Do not market OneLibrary as certified.

---

### Q20. USB filesystem profiles

**Question:** Which filesystem profiles are required?

**Recommendation:** FAT32 for legacy compatibility, exFAT where validated. Profiles per hardware target.

**Why:** The correct filesystem depends on the CDJ/controller and firmware.

**Status:** Resolved. FAT32 required; exFAT only for validated hardware profiles; no NTFS.

---

### Q21. Restore merge default

**Question:** When merging, what is the default when Library and backup differ?

**Recommendation:** Keep current Library, show the backup value, allow “use backup” per field. Never overwrite silently.

**Why:** The current library is usually newer.

**Status:** Resolved. Keep current Library value; show backup value; per-field “use backup”; bulk merge blocked.

---

### Q22. Smart Fix auto-apply

**Question:** Can low-risk fixes apply automatically?

**Recommendation:** No in v1. Low-risk fixes can be one-click, but not silent.

**Why:** Trust is more important than automation.

**Status:** Resolved. No silent auto-apply; preview + one-click apply.

---

### Q23. Library Health weights

**Question:** Confirm the health-score categories and weights.

**Recommendation:** Use the proposed weights in `02-experience/maintain-and-tags.md`, with all categories visible.

**Why:** A single score without explanation is not actionable.

**Status:** Resolved. Keep 20/15/15/15/10/10/10/5; unconfigured categories neutral; configured-but-failing categories count.

---

### Q24. Smart playlists

**Question:** Are smart playlists in v1?

**Recommendation:** No. Manual and imported playlists only. Smart playlists later.

**Why:** Smart playlists add query, caching and sync complexity.

**Status:** Resolved. Smart playlists are out of v1; manual and imported playlists only.

---

## 5. P2 — Can decide later

### Q25. Backup when app is closed

Should backup run in the tray/background when the app is closed?

**Recommendation:** Later. v1 requires the app to be open.

### Q26. App-level encryption

When should app-level encryption arrive?

**Recommendation:** v1.1, with a recovery-key design.

### Q27. Restore test frequency

How often should DJ Assistant prompt a restore test?

**Recommendation:** Monthly reminder; quarterly automated test on a copy.

### Q28. Cloud bandwidth rules

Should Google Drive backup run only on Wi-Fi or outside working hours?

**Recommendation:** Default to “any connection, bandwidth limit 20 Mbps, pause on metered” with user override.

### Q29. Statistics exports

CSV and PNG in v1?

**Recommendation:** Yes.

### Q30. Onboarding demo

Should onboarding include a demo library?

**Recommendation:** No synthetic audio. Use the user's files or an empty library.

### Q31. Telemetry

Telemetry on by default?

**Recommendation:** Off by default, opt-in crash reports.

### Q32. Update channel

Stable only, or beta channel?

**Recommendation:** Stable plus opt-in beta.

### Q33. Artwork

Write artwork to files or cache only?

**Recommendation:** Cache only in v1; write to files as an explicit advanced action.

**Why:** Embedded artwork travels with audio. Cache stays out of backups and file writes stay deliberate.

**Status:** Resolved. Cache only in v1; writing artwork to files is an explicit advanced action.

### Q34. Playlist folders

Do playlists need folders in v1?

**Recommendation:** No. Add when the playlist list becomes hard to scan.

### Q35. Multiple languages

Is localization in v1?

**Recommendation:** English only in v1, but keep copy localization-ready.

---

## 6. Remaining questions

Most of the first two decision batches are locked. These are the important questions still open:

1. **Statistics date ranges:** resolved — all-time default; date range only for Play History and Additions.
2. **Discover v1 sources:** resolved — Bandcamp free/name-your-price, SoundCloud download-enabled tracks, label/promoter promos.
3. **Default sync conflict policy:** resolved — Library wins editorial metadata; DJ app wins cues/beat grids; BPM/key require review.
4. **Google Drive folder choice:** resolved — app-created folder only in v1.
5. **USB filesystem profiles:** resolved — FAT32 required; exFAT only for validated hardware profiles; no NTFS.
6. **Restore merge default:** resolved — keep current Library value; show backup value; per-field “use backup”; bulk merge blocked.
7. **Smart Fix auto-apply:** resolved — no silent auto-apply; preview + one-click apply.
8. **Library Health weights:** resolved — 20/15/15/15/10/10/10/5; unconfigured categories neutral.
9. **Smart playlists:** resolved — out of v1.
10. **Artwork handling:** resolved — cache only in v1; writing artwork to files is explicit and advanced.

These are now locked as D‑043–D‑052. The remaining open items are mass-export threshold, Serato crate feature set, which apps come after rekordbox and Traktor, per-adapter rollback and P2 items.
