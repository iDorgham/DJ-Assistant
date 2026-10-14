# 01 — Specification

**SDD Artifact:** Product & Technical Specification Summary  
**Source of Truth:** `docs/product/CANONICAL_DOCUMENTATION.md` (v1.1)  
**Status:** Approved

---

## 1. Product Vision

> The fastest way to turn a music library into a performance-ready DJ set.

DJ Assistant is a **desktop-first preparation accelerator**. It helps professional DJs go from an unorganized local music library to a fully prepared, exportable set in minutes — not hours.

### Core Promise
Analyze locally → Clean tags → Generate cues → Build harmonic/energy-aware sets → Collaborate (B2B) → Export to rekordbox/Serato — targeting **≤ 15 minutes for 40+ tracks**.

---

## 2. Target Users

- Working club & festival DJs preparing multiple sets per week
- Mobile / wedding DJs needing fast, reliable prep
- Rising DJs who want pro-level preparation without years of manual tagging
- DJs who regularly perform B2B and need clean collaborative prep

---

## 3. In-Scope Capabilities (Must / Should)

### P0 — Must Have for MVP (slimmed per `docs/audit/AUDIT-SUMMARY.md`)

> MVP gates on **Import → Analyze → Cue → Export** only. USB-format, B2B collab, and 4/8 Skills move to P1 (see §3 P1). This keeps the 90-day gate achievable.

- Local library import & folder watching
- Local audio analysis (BPM, key, beat grid, phrases, vocal presence, loudness)
- Intelligent cue point generation (8 hot cues + memory cues)
- Smart Tag Cleanup (fuzzy artist clustering, aliases, bulk apply + undo)
- Constraint-driven Set Builder with Beam Search sequencing
- Energy-aware set construction + basic templates — energy = user tag + LUFS proxy + manual 0–10 slider (never blocks `build_set`; ML mood not required)
- Export to rekordbox XML and Serato .crate
- Offline-capable core workflow
- Basic Skills framework (enable/disable, log, undo) — Cue Master + Tag Surgeon first; remainder P1
- Prep Auditor / Library Health basics

### P1 — Should Have (Strongly Preferred in MVP or immediately after)
- Professional USB media format tool (FAT32 + MBR default; exFAT gated; removable-only + rescan + type-to-confirm + MBR verify + dry-run + audit-logged) — moved from P0 per audit
- B2B shared sets (metadata-only collaboration) — moved from P0 per audit
- Remaining Skills (Set Architect, Energy Cartographer, Harmonic Scout, Missing Track Hunter beyond basics) — moved from P0 per audit
- Gig Ready one-click workflow
- Lock & Fill
- Set Templates
- Transition explanations
- Waveform visualization with cue markers
- Professional Preview Player (prep-only, single-deck — see §3A; not a performance mixer)
- Settings specs S-1–S-7 (`docs/audit/05-proposed-specs-functions.md`): Profiles, Preview gain/keymap, Library locations+ignore+relink, Model manager, Privacy center, USB policy, Telemetry off-default
- Functions F-1–F-10 (`docs/audit/05-proposed-specs-functions.md`): smart playlists/history, relink, beatgrid editor, cue templates, harmonic traffic-light + mix-out + vocal warning, set versioning/diff, USB pack verify + set sheet, Prep Auditor queue, waveform, bulk tag preview+undo

### 3A. Professional Preview Player (prep-only)

A single-deck local audition tool for verifying analysis, cues, grids, and transitions during prep. It is explicitly **not** a live mixer, performance surface, or streaming player.

- **Waveform:** cached peaks (per-track, offline), zoom (overview + detail), phrase bands (intro/build/drop/breakdown/outro), cue/loop markers draggable, color sections, <16ms/frame render.
- **Beat grid overlay:** downbeat + bar lines from analysis beat grid; editable offset (nudge ±1ms / ±1 beat), halve/double BPM; correction memory hookup ("remember for similar"); grid confidence shown, low-confidence flagged.
- **Transport + beat jump:** play/pause, seek-to-cue, beat jump ±1/4/8/16/32 beats (grid-quantized), temporary loop preview (4/8/16 bars), single-deck only — no crossfade, no dual-deck sync, no FX, no recording.
- **Artwork:** cached embedded art (`get_artwork` content-addressed cache) large-format display; placeholder when missing; high-res upgrade path via post-MVP enrichment (never required).
- **Audio path:** local files only (library tracks); gain + limiter, split-cue mono optional; seek latency <100ms; output device + samplerate selectable in settings S-2; no network source, no streaming service audio, no in-app recording.
- **Keyboard map:** space play/pause, ←/→ ±1 beat, Shift+←/→ ±4/±16, C set cue, Esc stop; fully remappable (S-2).

### P2 — Later
- Advanced vector search (CLAP embeddings)
- Richer collaboration presence
- Additional export formats (Traktor, VirtualDJ)
- Preference model (“DJ Brain”) personalization depth

### Post-MVP Scope (Planned — not part of the 90-day MVP)

These capabilities are explicitly **post-MVP**. They are recorded here so scope is agreed, but they add **no** MVP acceptance gate and must not delay or alter the Phase 0–4 plan.

### Streaming Export — Spotify Playlist Export

**Spotify Playlist Export** publishes a built set (or any playlist) to the DJ’s own Spotify account as a real Spotify playlist, using **metadata only**. Each local track is matched to a Spotify track by **ISRC first**, falling back to a fuzzy match on normalized title/artist/album plus a **±3 s duration tolerance**, producing a **confidence score**. High-confidence matches are added automatically; medium/low matches go to a **review queue**; unmatched tracks are listed with a “search Spotify manually” / “skip” option. It connects via **OAuth 2.0 Authorization Code with PKCE** run entirely in the desktop app (public client ID embedded at build time; **no client secret, no cloud dependency**). Only track metadata and search queries leave the device; tokens live in the **OS keychain**. Audio is never downloaded, streamed, stored, or uploaded.

- **Auth:** OAuth 2.0 Authorization Code + PKCE (RFC 7636), desktop (Tauri); loopback redirect (`http://127.0.0.1:<port>/callback`) or custom URI scheme; embedded public client ID; local token refresh.
- **Scopes (minimal):** `playlist-modify-private` (default); `playlist-modify-public` only if the DJ opts into a public playlist; `playlist-read-private` only if updating an existing playlist; no library or email scopes.
- **Matching:** mirrors the existing `needs_review` pattern — ISRC-first → fuzzy fallback → confidence tiers → review queue → unmatched report.
- **API behavior:** Spotify Web API search, create playlist, add tracks (≤ 100 URIs per request, chunked); handle `429` + `Retry-After` with exponential backoff; `401` → refresh; surface `403`/`404`. Spotify only exposes playlists the user owns or collaborates on.
- **Privacy/security:** metadata-only; tokens in the OS keychain; minimal scopes; disconnect/revocation removes tokens; no audio; no AI training on Spotify data.
- **Reversibility:** creating a playlist is an external side effect — record the created playlist so the DJ can delete it from the app; audit-logged.

**Post-MVP acceptance direction:** a 40-track set → Spotify playlist with ≥ 90% auto-matches; unmatched/low-confidence tracks reported; no source audio read/modified beyond existing tags; token refresh without re-auth; 429s handled; disconnect revokes + removes tokens; the created playlist is deletable from the app.

### Discovery — Similar Tracks, Charts & Release Radar

**Similar tracks (foundation shipped, TF.1/TF.4):** local mix-compatibility scoring on BPM, Camelot key, genre and duration — no network. External similarity (Last.fm, Deezer/Spotify recommendations) is opt-in per provider, cached, and arrives with a `source` attached; it never auto-modifies sets.

**Charts & release radar:** Beatport offers no public catalog API, so Beatport Top 100 per genre and Hype Top 100 enter as versioned chart snapshots (Tier 1), filtered by library taste (BPM ±3%, Camelot, owned-vs-missing via ISRC). Release radar over followed artists/labels (Tier 2) is opt-in, cached, rate-limited and marked unofficial; an official Beatport LINK/affiliate partnership (Tier 3) is the long-term path. Scraping with user credentials is not the default. Per-track store buy-links (Tier 0, shipped in TF.2) are pure search URLs — metadata and links only, never audio.

### Enrichment — Online Tags & Artwork (opt-in)

Gap detection (`track_tag_health`, shipped in TF.4) is the read half. Online lookup (MusicBrainz + Cover Art Archive, iTunes Search, Deezer, Discogs, AcoustID fingerprinting, Last.fm genre correction) fills gaps through ISRC-first → fingerprint → fuzzy matching with confidence tiers, always preview → apply → undo, writing DB canonical fields and never source files. Only track metadata, fingerprints and search queries leave the device.

### Multi-Provider Streaming Export

Spotify (above) is the reference implementation of a generic provider contract (`provider_match_set` / `provider_export_playlist`); Deezer is the planned second target, then Apple Music / YouTube Music / SoundCloud / TIDAL one at a time. In-app streaming playback of any service's audio stays out of scope everywhere — export is metadata-only playlists, nothing else.

---

## 4. Explicit Out-of-Scope (Do Not Build)

- Live mixing engine (dual-deck, crossfade, sync-to-perform, FX, recording) or use as performance software. The §3A Preview Player is prep-only audition (single-deck, local files, no mixing) and does not lift this ban.
- Replacement for rekordbox / Serato / Traktor / CDJs as performance software
- Social network, content calendar, or marketing tools
- **Spotify / Apple Music / YouTube / SoundCloud downloading, ripping, streaming, or storing of audio, or piracy/purchase-bypass features** — *(Not to be confused with the metadata-only playlist export in the Post-MVP scope above, which is allowed and post-MVP: no audio is downloaded, streamed, stored, or uploaded.)*
- Open-ended autonomous agents that take irreversible actions
- Career OS, label management, or demo submission automation
- Cloud analysis of raw audio (audio must stay local)

---

## 5. Key Product Constraints

| Constraint | Requirement |
|------------|-------------|
| Privacy | Raw audio never leaves the device by default |
| Performance | 40-track library analyzed + exported in < 15 minutes |
| Non-destructive | Source audio files are never modified |
| Control | Every AI/bulk action is previewable and reversible |
| Offline | Core path works without internet |
| Preview latency | Seek <100ms, waveform <16ms/frame, grid-quantized beat jump |
| Hardware | Exports must load correctly on Pioneer CDJ-2000NXS2 / CDJ-3000 |
| USB media | Format tool defaults to FAT32 + MBR (universal); exFAT only for known exFAT-capable booths; formatting is user-initiated, destructive, and audit-logged — the non-destructive guarantee covers source audio, never the target USB |

---

## 6. Success Metrics (MVP)

- Full analysis + export of a 40-track library in < 15 minutes
- Cue placement acceptance rate > 90% in closed beta
- Zero source-file corruption across all testing
- Tag cleanup clusters near-duplicate artist names with > 95% accuracy on beta libraries
- Working DJs report meaningful time savings (“this saved me hours”)

---

## 7. AI Boundaries (Specification Level)

| Concern | Decision |
|---------|----------|
| Audio analysis | Local ONNX only |
| Set sequencing | Deterministic Beam Search only |
| Similarity scoring | Single locked formula versioned with `analysis_version` (audit fix: resolve Canonical `0.35/0.30/0.20/0.15` vs shipped `0.45/0.35/0.10/0.10` drift; pin weights by unit test — see `04-TASKS.md` TA.2) |
| Energy source | User tag + LUFS proxy + manual 0–10 slider; never blocks `build_set` |
| Constraint understanding | LLM allowed (cloud or local) |
| Explanations | LLM or templates |
| Tag normalization | Deterministic + fuzzy algorithms (no LLM required) |
| Autonomy | Scoped Skills only; no open agents |
| Contracts | Single `contracts/*.json` → `packages/shared` + Rust structs; CI fails on drift (TA.5) |
| Errors | Cataloged `E_SCAN_*/E_ANALYSIS_*/E_EXPORT_*/E_USB_*/E_PROVIDER_*` with `code/message/retry` on `error` event (TA.9) |

---

## 8. References

- Full detail: `docs/product/CANONICAL_DOCUMENTATION.md`
- Audit: `docs/audit/AUDIT-SUMMARY.md`, `01-specs-audit.md`, `02-functions-audit.md`, `03-settings-audit.md`, `04-improvements.md`, `05-proposed-specs-functions.md`
- Product Requirements: `DJ-Assistant-PRD.docx` *(external, not committed)*
- AI principles: `DJ-Assistant-AI-Native-Build-Plan.docx` *(external, not committed)*
