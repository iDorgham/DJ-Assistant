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
| 0.2 | User can choose a folder and see tracks listed (title, artist, duration, path/status) | Must | ☑ (Verified live GUI run on 94-track library) |
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
