# DJ Assistant — Glossary

**Status:** Living  
**Last Updated:** 2026-10-09

Short definitions of product and technical terms used across Canonical, SDD, Architecture, and engineering docs. Prefer these meanings in code, UI copy, and PRs.

---

## Product & Workflow

| Term | Definition |
|------|------------|
| **DJ Assistant** | Desktop-first preparation accelerator: local analysis → cues → tag cleanup → set building → export. Not a live performance / mixing engine. |
| **Gig Ready** | One-click workflow that runs a curated sequence (health check → analyze → optional tag cleanup → cues → Prep Auditor → export/USB pack). |
| **USB Pack** | Packaged export of a set (and related metadata/cues) prepared for performance media. |
| **Prep Auditor** | Skill that runs a pre-gig checklist: unanalyzed tracks, missing cues, tag issues, energy gaps, etc. |
| **Lock & Fill** | Set-builder mode: user locks hero tracks in position; system fills remaining slots optimally. |
| **Set Template** | Reusable profile of energy curve, BPM ramp, genre bias, and transition preferences derived from a successful set. |
| **B2B** | Back-to-back: collaborative set preparation between DJs without transferring audio files. |
| **Non-destructive** | Source audio files are never modified; outputs are metadata, cues, and interchange exports. |
| **Local-first** | Core import → analyze → cue → set → export works offline; cloud is optional enhancement. |

---

## Analysis & Music

| Term | Definition |
|------|------------|
| **BPM** | Beats per minute; primary tempo attribute from local analysis. |
| **Beat grid** | Time-aligned beat positions derived from analysis; used for cue snapping and phrase boundaries. |
| **Key (Camelot)** | Harmonic key notation on the Camelot wheel (e.g. `8A`, `12B`) for mixing compatibility. |
| **Key (classical)** | Traditional notation (e.g. A minor, C major) alongside Camelot. |
| **Phrase / phrase boundary** | Musical segment length typically 8, 16, or 32 bars; boundaries used for structure-aware cues and transitions. |
| **Structural markers** | Labeled sections: intro, build, drop, breakdown, outro (with confidence). |
| **Vocal presence** | Score or curve indicating how vocal-heavy a track is (0–1 aggregate and/or density over time). |
| **Loudness (LUFS)** | EBU R128 integrated loudness; used for level-aware prep, not as a “quality” score. |
| **Safe mix-out window** | Suggested region near the end of a track suitable for mixing out, derived from structure + energy. |
| **Energy curve** | Target or measured energy over set time (warmup → peak → close, wave, custom). |
| **Transition score** | Numeric compatibility between two adjacent tracks (key, BPM, energy, optional semantic). |
| **Transition risk** | Low / Medium / High flag from key jump + BPM jump + phrase alignment (plus numeric score). |

---

## Intelligence & Automation

| Term | Definition |
|------|------------|
| **Skill** | Scoped, enable/disable, logged, reversible automation unit (e.g. Cue Master, Tag Surgeon). Not an open-ended agent. |
| **Cue Master** | Skill that generates/refines hot cues and memory cues from structure + genre templates. |
| **Tag Surgeon** | Skill for fuzzy artist/title cleanup, canonical names, and aliases. |
| **Set Architect** | Skill / pipeline for constraint-driven set construction (with Beam Search). |
| **Energy Cartographer** | Skill for energy curve analysis, visualization, and suggestions. |
| **Harmonic Scout** | Skill that finds harmonic + tempo compatible candidates. |
| **Missing Track Hunter** | Skill that detects missing files, broken paths, version gaps. |
| **Library Doctor** | Skill for overall library health score and recommended fixes. |
| **Automation rule** | User- or template-defined trigger → condition → Skill chain. |
| **DJ Brain** | Structured preference model + behavioral history (BPM/key/genre prefs, edits). Not a general autonomous agent. |
| **Beam Search** | Deterministic set sequencing optimizer (beam width W = 10); maximizes cumulative transition fitness under constraints. |
| **Constraint extraction** | LLM (or UI) step that turns natural language / form input into structured set constraints; does **not** order tracks. |

---

## Technical

| Term | Definition |
|------|------------|
| **ONNX / ONNX Runtime** | Open Neural Network Exchange model format and inference engine used for local analysis. |
| **Symphonia** | Pure-Rust audio decoding library used in the desktop audio engine. |
| **BLAKE3** | Fast cryptographic hash used for file fingerprinting and deduplication (e.g. first 1MB + duration). |
| **IPC** | Inter-process communication between React UI and Rust core in Tauri (`invoke` commands + events). |
| **Workspace** | Isolation boundary for library / preferences / collaboration (even if single-library at first). |
| **analysis_version** | Identifier for the analysis pipeline + model set that produced a track’s features; drives re-analysis. |
| **needs_review** | Analysis status when confidence is low or models flag uncertain attributes. |
| **CLAP** | Contrastive language-audio pretraining style embedding (e.g. 512-dim) used for optional semantic search. |
| **pgvector** | PostgreSQL extension for vector similarity search in the cloud control plane. |
| **rekordbox XML / Serato crate** | Primary export interchange formats for performance software. |
| **Tauri v2** | Desktop application framework (Rust backend + web UI) chosen for the companion app. |

---

## Scoring (Set Builder)

Compatibility between tracks \(A\) and \(B\) is a weighted sum (Canonical §4):

\[
S(A,B) = w_1 S_{\text{key}}(A,B) + w_2 S_{\text{bpm}}(A,B) + w_3 S_{\text{energy}}(A,B) + w_4 S_{\text{semantic}}(A,B)
\]

- **\(S_{\text{key}}\)** — Camelot distance (same key / relative / adjacent preferred).
- **\(S_{\text{bpm}}\)** — Tempo delta (full score within ~1 BPM; falls off to zero beyond ~6 BPM).
- **Energy / semantic** — Curve fit and optional embedding similarity.

Exact weights are tunable implementation details; the hybrid rule (LLM for constraints only, Beam Search for order) is fixed by ADR-0004.

---

## Related Documents

- [Canonical Documentation](./CANONICAL_DOCUMENTATION.md)
- [Skills System](../architecture/SKILLS_SYSTEM.md)
- [Architecture](../architecture/ARCHITECTURE.md)
- [Models](../architecture/MODELS.md)
- [API Contracts](../architecture/API_CONTRACTS.md)
