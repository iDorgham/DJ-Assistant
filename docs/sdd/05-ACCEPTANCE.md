# 05 — Acceptance Criteria

**SDD Artifact:** Phase & Feature Acceptance  
**Status:** Binding for phase exit and MVP  
**Rule:** A phase is not complete until every criterion in its section is demonstrably met.

---

## 1. Global Acceptance Rules

These apply to every phase and to MVP:

1. **No source audio modification** — Verified by file hash before/after operations.
2. **Reversibility** — Every bulk/AI mutation that ships has working preview + undo.
3. **Offline core** — Import → Analyze → Cue → Build Set → Export works without network.
4. **Graceful failure** — Unsupported or corrupt files are skipped and logged; app does not crash.
5. **Provenance** — AI-generated cues and major automated changes are visibly marked.
6. **Testing gate** — New logic in the phase has automated unit and/or fixture tests; CI green.
7. **Security gate** — Path safety, no secrets, Skill undo for mutations, and phase security checklist from `docs/engineering/TESTING_AND_SECURITY.md` satisfied.

---

## 2. Phase 0 — Foundation Acceptance

| # | Criterion | Verification |
|---|-----------|--------------|
| P0.1 | App boots to a usable UI on macOS and Windows | CI + manual launch |
| P0.2 | User can select a folder and scan 50–100 tracks | Manual test |
| P0.3 | BLAKE3 hashes are stable across rescans | Automated assertion |
| P0.4 | Exact duplicate files are detected and not double-imported | Manual + unit test |
| P0.5 | Basic metadata (title, artist, album, duration) is correctly extracted for common formats (MP3, FLAC, AIFF, WAV) | Fixture tests |
| P0.6 | Tracks appear in a list UI with correct fields | Manual |
| P0.7 | Unsupported/corrupt files do not crash the scan | Manual with bad fixtures |
| P0.8 | Data persists after app restart | Manual |

**Phase 0 is accepted only when all P0.x criteria pass.**

---

## 3. Phase 1 — Analysis Engine Acceptance

| # | Criterion | Verification |
|---|-----------|--------------|
| P1.1 | BPM and beat grid produced for supported tracks | Golden fixtures |
| P1.2 | Key produced in Camelot and classical forms | Golden fixtures |
| P1.3 | Phrase/structure markers produced (intro/build/drop/breakdown/outro as applicable) | Golden fixtures + spot check |
| P1.4 | Vocal presence and loudness (LUFS) stored | Fixture + manual |
| P1.5 | p50 analysis time < 3s/track on agreed mid-range laptop | Benchmark script |
| P1.6 | 50-track folder fully analyzed in < 5 minutes wall time (including light review) | Timed manual run |
| P1.7 | Low-confidence results flagged for review | Manual + unit |
| P1.8 | Analysis results survive restart and are version-stamped | Manual |

**Phase 1 is accepted only when all P1.x criteria pass.**

---

## 4. Phase 2 — Library Intelligence & Tag Cleanup Acceptance

| # | Criterion | Verification |
|---|-----------|--------------|
| P2.1 | Library supports search and multi-field filtering | Manual test script |
| P2.2 | Tag Surgeon clusters near-duplicate artist names (case/space/accent/punctuation) with high precision | Beta library test (≥ 95% target directionally) |
| P2.3 | Bulk tag apply shows preview and is fully undoable | Manual |
| P2.4 | Aliases cause future imports of known variants to normalize | Integration test |
| P2.5 | Duplicates (hash) and version groups are visible | Manual |
| P2.6 | Library Health Score changes appropriately when tracks are analyzed or tags fixed | Manual |
| P2.7 | Cue Master generates editable structural cues; overrides persist | Manual + fixture |
| P2.8 | Prep Auditor produces a usable readiness checklist | Manual |

**Phase 2 is accepted only when all P2.x criteria pass.**

---

## 5. Phase 3 — Set Builder & Export Acceptance

| # | Criterion | Verification |
|---|-----------|--------------|
| P3.1 | User can define constraints (duration, BPM range, energy shape, key compatibility, locks/excludes) | Manual |
| P3.2 | System produces a sequenced set via Beam Search (not LLM ordering) | Code review + output inspection |
| P3.3 | Generated 90–120 min set is musically coherent enough that a working DJ would play it with only light edits | Expert review |
| P3.4 | Lock & Fill and basic Templates work | Manual |
| P3.5 | rekordbox XML exports load in rekordbox with playlist + cues | Manual |
| P3.6 | Serato .crate exports load in Serato | Manual |
| P3.7 | Exports load and play correctly on Pioneer CDJ-2000NXS2 and/or CDJ-3000 | Hardware validation |
| P3.8 | Source audio hashes unchanged after full prepare + export cycle | Automated hash check |

**Phase 3 is accepted only when all P3.x criteria pass.**

---

## 6. Phase 4 / MVP Acceptance

All Phase 0–3 criteria remain green, **plus**:

| # | Criterion | Verification |
|---|-----------|--------------|
| M.1 | Full analysis + export of a **40-track library in < 15 minutes** | Timed run on target hardware |
| M.2 | Cue placement acceptance rate **> 90%** in closed beta (or internal expert panel if beta not yet live) | Survey / review log |
| M.3 | **Zero source-file corruption** across all testing | Hash audits |
| M.4 | Tag cleanup achieves **> 95%** clustering accuracy on agreed beta libraries | Measured on sample libraries |
| M.5 | Skills can be enabled/disabled; mutating runs are logged and undoable | Manual + unit |
| M.6 | Gig Ready (or equivalent one-click path) executes a sensible prepare sequence | Manual |
| M.7 | Core offline workflow is reliable end-to-end without network | Manual airplane-mode test |
| M.8 | Closed beta build can be distributed and basic feedback collected | Process check |

**MVP is accepted only when all M.x criteria and prior phase criteria pass.**

---

## 7. Feature-Level Acceptance (Selected Critical Features)

### Cue Master
- Generates up to 8 hot cues + essential memory cues from structure
- Cues snap to musical grid according to documented rules
- All cues editable; AI provenance visible
- Export includes cues correctly

### Tag Surgeon
- Preview before apply
- Full undo
- Aliases persist and affect future imports
- No silent changes

### Set Architect / Beam Search
- Ordering produced by Beam Search, never by raw LLM output
- Respects locked tracks and duration constraints
- Produces alternative suggestions on re-run

### Export
- rekordbox XML and Serato crate are primary; both must work
- Hardware validation is mandatory for phase exit

---

## 8. Acceptance Process

1. Engineer marks tasks complete in `04-TASKS.md`.
2. Tech lead (or designated reviewer) verifies phase criteria in this document.
3. Evidence (screenshots, fixture results, hardware notes, timing logs) stored in agreed location.
4. Phase gate recorded (date + approver).
5. Only then does the team formally move the “current phase” forward.

---

## 9. Changes to Acceptance Criteria

Any relaxation or strengthening of criteria in this document requires:
- Explicit discussion
- Update to this file
- Note in project changelog / decision log

Acceptance criteria are part of the specification contract, not informal goals.
