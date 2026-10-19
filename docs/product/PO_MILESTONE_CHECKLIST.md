# DJ Assistant — PO Milestone Checklist

**Audience:** Product owner (sign-off), tech lead (evidence)  
**Status:** Living  
**Last Updated:** 2026-10-12  

Use this to accept phase exits in **product language**. Engineering detail and test evidence live in SDD Acceptance and the task lists — this sheet is what the PO checks before saying “go.”

**How to use:** For each phase, all **Must** items should be true (or explicitly waived with a written reason). **Should** items can slip only with a follow-up date.

---

## Phase 0 — Foundation

**Product outcome:** “I pointed the app at a folder of tracks and I see a trustworthy library list.”

| # | Check | Must / Should | PO sign-off |
|---|--------|---------------|-------------|
| 0.1 | App launches on the target desktop OS(es) we care about for MVP | Must | ☑ (Verified on macOS and Windows via CI matrix #38219344042 & local Windows build) |
| 0.2 | User can choose a folder and see tracks listed (title, artist, duration, path/status) | Must | ☑ (Verified: folder picker → live scan → 94-track library run, see PHASE0_ACCEPTANCE_EVIDENCE.md) |
| 0.3 | Duplicates are detected sensibly (same file not listed twice as independent unknowns) | Must | ☑ (BLAKE3 fingerprint & dedup verified) |
| 0.4 | Bad/unsupported files don’t crash the app; they’re skipped or marked clearly | Must | ☑ (Tested on non-audio & corrupted fixtures) |
| 0.5 | Library list survives restart (local persistence works) | Must | ☑ (Verified local SQLite persistence & migrations) |
| 0.6 | No upload of audio; workflow feels local | Must | ☑ (100% offline, local filesystem & SQLite) |
| 0.7 | Demoable in &lt; 5 minutes to a non-engineer stakeholder | Should | ☑ (Clean UI boots instantly, folder scan in seconds) |

**PO decision:** ☑ Accepted · ☐ Accepted with waivers · ☐ Rejected  

**Sign-off Date:** 2026-10-12  
**Notes / waivers:** Accepted based on verified criteria P0.1–P0.8 in [PHASE0_ACCEPTANCE_EVIDENCE.md](../engineering/PHASE0_ACCEPTANCE_EVIDENCE.md). CI multi-platform build matrix (`windows-latest` and `macos-latest`), local folder scan on 94 real tracks, metadata enrichment, and SQLite persistence are all fully operational. Non-blocking plan gap noted: GitHub branch protection pending Pro plan upgrade.

---

## Phase 1 — Analysis Engine

**Product outcome:** “These tracks have usable BPM, key, and cues I can trust enough to prep.”

| # | Check | Must / Should | PO sign-off |
|---|--------|---------------|-------------|
| 1.1 | Batch analysis on a real ~50-track folder completes in a time that feels practical (target direction: usable set of results in minutes, not hours) | Must | ☐ |
| 1.2 | BPM / key / basic structure shown per track | Must | ☐ |
| 1.3 | Generated cues are visible, editable, and marked as system-generated vs user | Must | ☐ |
| 1.4 | Low-confidence items are obvious (needs review), not silently wrong | Must | ☐ |
| 1.5 | Re-analysis possible when we improve models | Should | ☐ |
| 1.6 | Source audio files unchanged (spot-check hashes or file dates) | Must | ☐ |

**PO decision:** ☐ Accepted · ☐ Accepted with waivers · ☐ Rejected  

Notes / waivers: ________________________________

---

## Phase 2 — Library intelligence & tags

**Product outcome:** “My messy library is cleaner and I know what’s gig-ready.”

| # | Check | Must / Should | PO sign-off |
|---|--------|---------------|-------------|
| 2.1 | Search / filter library by basics (BPM, key, status, text) | Must | ☐ |
| 2.2 | Tag cleanup: preview impact → confirm → apply | Must | ☐ |
| 2.3 | Tag cleanup is undoable | Must | ☐ |
| 2.4 | Clear sense of library health / prep gaps (even if simple) | Should | ☐ |
| 2.5 | Prep Auditor-style checklist answers “what’s blocking this gig?” | Should | ☐ |
| 2.6 | Three-view workspace (Library / Preparation / Auto Performance) with collapsible nav, theme switch, and a persistent preview player dock | Must | ☐ |

**PO decision:** ☐ Accepted · ☐ Accepted with waivers · ☐ Rejected  

Notes / waivers: ________________________________

---

## Phase 3 — Set builder & export (core path)

**Product outcome:** “I described constraints, got a set, exported, and can load it in my DJ software.”

| # | Check | Must / Should | PO sign-off |
|---|--------|---------------|-------------|
| 3.1 | User can specify duration / BPM / basic constraints (UI and/or simple language) | Must | ☐ |
| 3.2 | System produces an ordered set with visible transition rationale or risk | Must | ☐ |
| 3.3 | Locked tracks (Lock & Fill) respected when used | Should | ☐ |
| 3.4 | Export to rekordbox XML and/or Serato crate succeeds | Must | ☐ |
| 3.5 | Export loads in real software (or lab equivalent agreed for MVP) | Must | ☐ |
| 3.6 | User can edit order / swap alternatives without fighting the tool | Should | ☐ |

**PO decision:** ☐ Accepted · ☐ Accepted with waivers · ☐ Rejected  

Notes / waivers: ________________________________

---

## Phase 4 — Skills, Gig Ready, polish toward MVP

**Product outcome:** “One path from messy folder to export feels productized and safe.”

| # | Check | Must / Should | PO sign-off |
|---|--------|---------------|-------------|
| 4.1 | Core Skills available with enable/disable and visible last-run summary | Must | ☐ |
| 4.2 | Bulk / automated actions require confirmation when impact is large | Must | ☐ |
| 4.3 | Gig Ready (or equivalent one-click path) runs a sensible prep sequence | Should | ☐ |
| 4.4 | No irreversible surprise on source files or tags | Must | ☐ |
| 4.5 | MVP success metric directionally measurable (time-to-prep on a standard folder) | Should | ☐ |

**PO decision:** ☐ Accepted · ☐ Accepted with waivers · ☐ Rejected  

Notes / waivers: ________________________________

---

## Post-MVP / Backlog (not in MVP scope)

Items here are **out of the 90-day MVP** and do not block any phase. They are candidate follow-ups for V1.5+.

| # | Item | Target | Notes |
|---|------|--------|-------|
| B.1 | Spotify Playlist Export (metadata-only) | Post-MVP (V1.5) | Publish a built set (or any playlist) to the DJ’s own Spotify account as a real playlist. OAuth 2.0 + PKCE in the desktop app (no client secret; tokens in OS keychain); ISRC-first matching with fuzzy title/artist/album + ±3 s fallback → confidence tiers → review queue → unmatched report. Reversible + audit-logged. Metadata only — no audio download/streaming/storage, no in-app playback. Reuse Canonical §15. No MVP phase item depends on this. |
| B.2 | Similar tracks + Tag Health + store buy-links + provider registry (foundations) | ✅ Shipped | Local similarity scoring, gap detection, per-store buy-links and the provider registry are implemented, tested and visible in the library UI (TF.1–TF.6). No network access. |
| B.3 | Discovery: external similarity, Beatport charts/hype, release radar | Partial (TD.3 shipped) | Chart snapshots Tier 1 live (import + taste filter + Charts modal), including Beatport Top 100 / Hype snapshots filtered by taste (no public catalog API). Deezer live matching shipped (TM.2a, read-only). Opt-in Last.fm/Spotify similarity, release radar, and partnership as Tier 3 remain. Metadata only. |
| B.4 | Enrichment: online tags & artwork (opt-in) | ✅ Shipped (5 sources) | Live lookup with preview → apply → undo, tier badges, artwork into empty slots only, DB fields only. MusicBrainz / iTunes / Deezer keyless; Discogs / Last.fm keyed; AcoustID query-ready (fingerprinting pending). Tag Health Score shipped. |
| B.5 | Multi-provider streaming export (Deezer, Apple Music, …) | Partial (match live; export needs app ID) | `provider_match_tracks` live for Deezer; connect/export wait on `DEEZER_APP_ID` (TM.2b). Generic provider_match_set/export_playlist IPC + capabilities live; Spotify reference + further targets remain. Metadata-only playlists; no in-app playback for any provider. |

---

## Standing PO rules (every phase)

1. **Scope:** If it isn’t in Canonical MVP / this checklist, it doesn’t block the phase unless explicitly added.  
2. **Safety:** Any path that modifies library metadata in bulk must show preview + undo.  
3. **Privacy:** Core demo path must work without requiring cloud upload of audio.  
4. **Language:** Prefer product outcomes in reviews; send eng back to SDD Acceptance for test evidence.  
5. **Waivers:** Written, dated, and owned — not verbal.

---

## Related

- [Product Brief](./PRODUCT_BRIEF.md)  
- [SDD Acceptance](../sdd/05-ACCEPTANCE.md)  
- [Canonical Documentation](./CANONICAL_DOCUMENTATION.md)  
- [Development Task List](../engineering/DEVELOPMENT_TASK_LIST.md)  
