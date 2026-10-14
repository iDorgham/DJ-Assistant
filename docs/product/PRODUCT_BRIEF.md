# DJ Assistant — Product Brief

**Audience:** Product owner, founders, stakeholders  
**Status:** Living  
**Last Updated:** 2026-10-09  
**Source of truth for detail:** Canonical Documentation v1.1 + PRD

---

## Problem

Working DJs spend hours on repetitive prep: fixing messy tags, finding BPM/key, placing cues, and building sets that actually mix. Tools either ignore prep or force cloud uploads and slow workflows. B2B prep is still “send me a USB.”

## Promise

**The fastest way to turn a music library into a performance-ready DJ set.**

Analyze locally → clean tags → generate cues → build harmonic, energy-aware sets → collaborate on B2B → export to rekordbox / Serato — in about **15 minutes for 40+ tracks**.

## Target users

- Club / festival DJs prepping multiple sets per week  
- Mobile / wedding DJs who need reliable speed  
- Rising DJs who want pro prep without years of manual tagging  
- DJs who play B2B and need shared prep without sending audio  

## What it is

A **desktop-first preparation accelerator** (not a live mixer). Local analysis (ONNX), intelligent cues, Smart Tag Cleanup, constraint-driven set building, scoped Skills, optional collaboration — export into existing performance software.

## What it is not

- Live performance / mixing engine  
- Social network or marketing suite  
- Spotify/YouTube downloader or piracy tool — no audio download, ripping, or in-app streaming (a **metadata-only** Spotify playlist export is a planned post-MVP direction; see Canonical §15)
- Autonomous agent that changes the library without confirmation  
- Replacement for rekordbox / Serato / CDJs as the performance surface  

## MVP in scope (product view)

| Outcome | Why it matters |
|---------|----------------|
| Scan local folder → stable library list | Foundation of trust |
| Local analysis: BPM, key, beat grid, structure, cues | Core time save |
| Editable, non-destructive cues | DJ stays in control |
| Smart tag cleanup (preview + undo) | Real libraries are messy |
| Constraint-based set + export (rekordbox / Serato) | End-to-end prep path |
| Prep Auditor + Gig Ready path | “Am I ready for the gig?” |

## Explicit out of MVP

Live mixing, social features, open-ended agents, training on user audio, full multi-device product polish, deep collaboration UX (basic B2B can follow core prep).

**Post-MVP directions (planned, not in MVP):** **Spotify Playlist Export** — publish a built set (or any playlist) to the DJ’s own Spotify account as a real playlist using metadata only. Local tracks are matched to Spotify tracks by ISRC first, then a fuzzy title/artist/album match with a ±3 s tolerance; remaining low-confidence and unmatched tracks go to a review/manual list. Auth is OAuth 2.0 + PKCE in the desktop app, with tokens in the OS keychain. No audio is ever downloaded, streamed, or stored, and there is no in-app streaming playback.
**Shipped foundations (offline):** local similar-track scoring, Tag Health gap detection, per-store buy-links and a provider registry — no network access.
**Post-MVP discovery & enrichment (planned):** opt-in external similarity (Last.fm, Deezer/Spotify), Beatport Top 100 / Hype snapshots filtered by library taste plus release radar (no public catalog API — data integrations; partnership as Tier 3), and opt-in online tag/artwork lookup (MusicBrainz, iTunes, Deezer, Discogs, AcoustID) via preview → apply → undo. **Multi-provider export (planned):** Spotify as reference, Deezer second, then Apple Music / YouTube Music / SoundCloud / TIDAL — metadata-only playlists, never in-app playback.

## Success metrics (product)

| Metric | Target direction |
|--------|------------------|
| Time to prep ~40 tracks (analyze → cues → basic set → export) | Toward ≤ 15 minutes |
| Analysis usable without heavy manual fix | High first-pass usefulness; overrides allowed |
| Export loads in target DJ software | Primary formats work on real hardware/software |
| Destructive surprises | Zero (source audio never modified; bulk actions preview + undo) |

## Non-negotiables (product contract)

1. **Local-first** — Core prep works offline; raw audio not uploaded by default.  
2. **Non-destructive** — Source files untouched.  
3. **DJ in control** — Skills scoped, reversible; no silent irreversible bulk changes.  
4. **Hybrid intelligence** — Natural language for intent; deterministic sequencing for order.  

## Primary references

- Canonical Documentation — full product + technical truth  
- PRD — requirements and personas  
- SDD Acceptance (`docs/sdd/05-ACCEPTANCE.md`) — phase/feature done criteria  
- PO Milestone Checklist (`docs/product/PO_MILESTONE_CHECKLIST.md`) — sign-off gates  
