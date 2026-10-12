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

### P0 — Must Have for MVP
- Local library import & folder watching
- Local audio analysis (BPM, key, beat grid, phrases, vocal presence, loudness)
- Intelligent cue point generation (8 hot cues + memory cues)
- Smart Tag Cleanup (fuzzy artist clustering, aliases, bulk apply + undo)
- Constraint-driven Set Builder with Beam Search sequencing
- Energy-aware set construction + basic templates
- Export to rekordbox XML and Serato .crate
- Offline-capable core workflow
- Basic Skills framework (enable/disable, log, undo)
- Prep Auditor / Library Health basics

### P1 — Should Have (Strongly Preferred in MVP or immediately after)
- Gig Ready one-click workflow
- Lock & Fill
- Set Templates
- Transition explanations
- B2B shared sets (metadata-only collaboration)
- Waveform visualization with cue markers

### P2 — Later
- Advanced vector search (CLAP embeddings)
- Richer collaboration presence
- Additional export formats (Traktor, VirtualDJ)
- Preference model (“DJ Brain”) personalization depth

---

## 4. Explicit Out-of-Scope (Do Not Build)

- Live audio playback or mixing engine
- Replacement for rekordbox / Serato / Traktor / CDJs as performance software
- Social network, content calendar, or marketing tools
- Spotify / Apple Music / YouTube / SoundCloud downloading or piracy features
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
| Hardware | Exports must load correctly on Pioneer CDJ-2000NXS2 / CDJ-3000 |

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
| Constraint understanding | LLM allowed (cloud or local) |
| Explanations | LLM or templates |
| Tag normalization | Deterministic + fuzzy algorithms (no LLM required) |
| Autonomy | Scoped Skills only; no open agents |

---

## 8. References

- Full detail: `docs/product/CANONICAL_DOCUMENTATION.md`
- Product Requirements: `DJ-Assistant-PRD.docx` *(external, not committed)*
- AI principles: `DJ-Assistant-AI-Native-Build-Plan.docx` *(external, not committed)*
