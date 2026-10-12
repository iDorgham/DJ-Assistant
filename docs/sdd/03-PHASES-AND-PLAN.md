# 03 — Phases & Implementation Plan

**SDD Artifact:** Phased Delivery Plan  
**Horizon:** 90-day MVP  
**Status:** Approved  
**Source:** Detailed Build Plan + AI-Native Build Plan

---

## 1. Delivery Principles

1. **Vertical slices** — Ship usable DJ workflows early rather than finishing horizontal layers in isolation.
2. **Local-first** — Core value must work offline from the first usable build.
3. **Reversibility by default** — Every mutating feature ships with preview + undo.
4. **Hardware is a gate** — Exports are not “done” until they load on real Pioneer CDJs.
5. **Weekly internal builds** from Day 15 onward.
6. **Closed beta** starts no earlier than Day 61.
7. **Public MVP** gated on the acceptance criteria in `05-ACCEPTANCE.md`.

---

## 2. Workstreams (Parallel Tracks)

| ID | Workstream | Primary Focus |
|----|------------|---------------|
| WS1 | Desktop Shell & Local Data | Tauri, scanning, hashing, SQLite, basic UI |
| WS2 | Audio Analysis Engine | ONNX, BPM/key/structure/vocals/loudness, queue |
| WS3 | Library, Cues & Tags | Browser, Cue Master, Tag Surgeon, Health |
| WS4 | Set Builder & Export | Constraints, Beam Search, exporters, CDJ validation |
| WS5 | Cloud, Collaboration & Skills | Skills runtime, rules, Gig Ready, optional cloud |

Workstreams run in parallel but have clear integration points and phase gates.

---

## 3. Phase Plan Overview

```
Days 1–15     Phase 0  Foundation
Days 16–35    Phase 1  Analysis Engine
Days 31–55    Phase 2  Library Intelligence & Tag Cleanup
Days 41–70    Phase 3  Set Builder & Export
Days 61–90    Phase 4  Polish, Automation, Closed Beta
```

Phases intentionally overlap once foundations exist.

---

## 4. Phase 0 — Foundation (Days 1–15)

**Goal:** Runnable desktop shell that can scan a folder, hash files, extract basic metadata, and store tracks locally.

### Major Deliverables
- Monorepo scaffold (apps/desktop, apps/api, packages/shared)
- Tauri v2 + React + TypeScript + Tailwind running
- Folder picker + recursive scan
- BLAKE3 fingerprinting + deduplication
- Metadata extraction (title, artist, album, duration, tags)
- Local SQLite + migration system
- Minimal library list UI
- Basic typed IPC
- CI builds for macOS + Windows

### Exit Gate
- 50–100 track folder can be scanned and listed with stable hashes and correct basic metadata
- Graceful handling of unsupported/malformed files
- CI green on target platforms

---

## 5. Phase 1 — Analysis Engine (Days 16–35)

**Goal:** Local ONNX analysis producing usable musical features.

### Major Deliverables
- ONNX Runtime integrated in Rust
- BPM + beat grid
- Key detection (Camelot + classical)
- Phrase / structure segmentation
- Vocal presence + loudness (EBU R128)
- Analysis job queue + progress UI
- Results persisted with versioning and confidence flags
- Golden fixture tests started

### Exit Gate
- 50-track folder analyzed with usable structural data in < 5 minutes wall time
- p50 analysis < 3s/track on mid-range laptop
- Results survive restart; low-confidence items flagged

---

## 6. Phase 2 — Library Intelligence & Tag Cleanup (Days 31–55)

**Goal:** Professional library experience + Smart Tag Cleanup that works on real messy libraries.

### Major Deliverables
- Full library browser (search, filter, bulk actions)
- Tag Surgeon (fuzzy clustering, canonicalization, aliases, preview, undo)
- Duplicate + version detection
- Library Health Score
- Prep Auditor Skill
- Cue Master v1 (structural cues + review UI)

### Exit Gate
- Messy ~1,000-track library can be cleaned in one focused review pass
- Bulk tag operations fully reversible
- Health score reflects reality

---

## 7. Phase 3 — Set Builder & Export (Days 41–70)

**Goal:** Constraint-driven sets that working DJs will actually play, plus production exports.

### Major Deliverables
- Constraint model + UI (+ optional NL parser)
- Candidate filtering + transition scoring matrix
- Beam Search sequencer (width 10)
- Energy Canvas, Lock & Fill, Set Templates
- Transition explanations
- rekordbox XML exporter
- Serato .crate exporter
- Hardware validation on CDJ-2000NXS2 / CDJ-3000

### Exit Gate
- Can produce a coherent 90–120 min set from constraints with only light manual edits
- Exports load cleanly in rekordbox, Serato, and on real Pioneer CDJs
- Zero source audio modification

---

## 8. Phase 4 — Polish, Automation, Closed Beta (Days 61–90)

**Goal:** Skills platform, Gig Ready, foundational collaboration, and beta-ready quality.

### Major Deliverables
- Full Skills framework (register, enable/disable, run, log, undo, kill-switch)
- Core Skills implemented and wired
- Automation rules + Gig Ready workflow
- Waveform visualization
- Cloud foundation (auth, workspaces, optional sync, LLM gateway)
- Minimum viable B2B shared sets (metadata only)
- Performance & reliability pass
- Closed beta distribution + feedback loop

### Exit Gate
- Meets all MVP Success Metrics in `05-ACCEPTANCE.md`
- Core offline workflow is reliable end-to-end
- Skills are controllable and reversible
- Ready for closed beta users

---

## 9. Team Shape (Recommended)

Minimum viable for aggressive 90-day delivery: **5–7 FTE**

Suggested coverage:
- Desktop / Rust (WS1 + WS2 heavy)
- Frontend / UI (React)
- Analysis / ML integration
- Set Builder + Export
- Cloud / Skills / Full-stack
- Product / QA / Hardware validation (can be shared)

Smaller teams must ruthlessly cut to pure P0.

---

## 10. Risk Register (Top Items)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Analysis quality insufficient on real libraries | High | Early fixture collection, closed beta feedback, model iteration |
| Export incompatibility with CDJs | High | Hardware validation as phase gate, not afterthought |
| Scope creep into live performance features | High | Strict non-goals enforcement |
| ONNX performance on lower-end machines | Medium | Quantization, progressive analysis, clear hardware guidance |
| LLM constraint parsing unreliability | Medium | Schema validation + structured UI fallback |
| Under-estimated polish for beta | Medium | Phase 4 explicitly reserved for polish + beta |

---

## 11. Post-MVP Direction (Not Scheduled)

- Deeper preference model (“DJ Brain”)
- Advanced vector search
- Richer B2B collaboration
- Additional export targets
- Continuous delivery of P1/P2 on 4–6 week cycles

---

## 12. Governance

- Canonical Documentation remains the product/technical source of truth.
- This phase plan sequences the work; it does not override the specification.
- Any change to phase exit criteria requires explicit agreement and update to `05-ACCEPTANCE.md`.
