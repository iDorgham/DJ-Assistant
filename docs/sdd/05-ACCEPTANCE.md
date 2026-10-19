# 05 — Acceptance Criteria

**SDD Artifact:** Phase & Feature Acceptance  
**Status:** Binding for phase exit and MVP  
**Rule:** A phase is not complete until every criterion in its section is demonstrably met.

---

## 1. Global Acceptance Rules

These apply to every phase and to MVP:

1. **No source audio modification** — Verified by file hash before/after operations (golden 50-track corpus + hash audit script TA.6).
2. **Reversibility** — Every bulk/AI mutation that ships has working preview + undo backed by `skill_runs(before_state/after_state)` (TA.4).
3. **Offline core** — Import → Analyze → Cue → Build Set → Export works without network.
4. **Graceful failure** — Unsupported or corrupt files are skipped and logged; app does not crash.
5. **Provenance** — AI-generated cues and major automated changes are visibly marked.
6. **Testing gate** — New logic in the phase has automated unit and/or fixture tests; CI green. P1.1–P1.6/M.1/M.3 use golden fixtures + fixed bench spec, not ad-hoc manual runs (TA.6).
7. **Security gate** — Path safety, no secrets, Skill undo for mutations, and phase security checklist from `docs/engineering/TESTING_AND_SECURITY.md` satisfied.
8. **Contract gate** — New IPC/HTTP surface generated from `contracts/*.json`; drift fails CI (TA.5).
9. **Settings gate** — New knobs added to `settings.schema.json` with validation + docs (TA.7).

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
| P1.1 | BPM and beat grid produced for supported tracks | Golden fixtures TA.6 |
| P1.2 | Key produced in Camelot and classical forms | Golden fixtures TA.6 |
| P1.3 | Phrase/structure markers produced (intro/build/drop/breakdown/outro as applicable) | Golden fixtures + spot check |
| P1.4 | Vocal presence and loudness (LUFS) stored | Fixture + manual |
| P1.5 | p50 analysis time < 3s/track on fixed bench spec (defined in TA.6) | Benchmark script |
| P1.6 | 50-track folder fully analyzed in < 5 minutes wall time (including light review) | Timed fixture run |
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
| P2.9 | Preview Player shows cached waveform + beat grid + artwork; play/pause/seek-to-cue works offline on local files | Manual |
| P2.10 | Beat jump ±1/4/8/16/32 is grid-quantized; seek <100ms; temp loop 4/8/16 previews cleanly | Manual + timed check |
| P2.11 | Grid overlay matches analysis (halve/double + nudge persist via F-3); low-confidence grids flagged | Manual + fixture |
| P2.12 | Player guardrails hold: single-deck only, no crossfade/FX/record, no network/streaming source | Manual + code review |
| P2.13 | App shell routes Library/Preparation/Auto Performance via the header and Ctrl/Cmd+1–3; left nav collapses; theme cycles dark/light/system; player dock switches Hidden/Mini/Full; view, nav, theme, and player mode persist across reload | Manual test script |

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
| P3.9 | USB format tool produces a **FAT32 + MBR, single-partition** stick that mounts on **both** CDJ-2000NXS2 and CDJ-3000 (default path); settings: 32 KB clusters, ASCII uppercase label ≤ 11 chars | Hardware validation |
| P3.10 | Format safety gates hold: only removable drives listed, system/internal drives blocked, no default selection, double-confirm required, every format audit-logged | Manual + unit |
| P3.11 | exFAT path is gated behind an explicit compat warning and verifies as MBR/single-partition; never offered as the default | Manual |

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

## 6a. Post-MVP Acceptance — Discovery, Enrichment & Streaming Export (NON-GATING)

> **Not part of MVP.** These criteria apply **only** to the post-MVP discovery / enrichment / streaming-export scope (`01-SPECIFICATION.md` §3, Post-MVP scope). They are explicitly **non-gating**: they do **not** block or alter any Phase 0–4 exit, any M.x criterion, or MVP acceptance. No M.x or Px.x criterion depends on this scope. See `04-TASKS.md` § Post-MVP for the `TF/TD/TE/TP/TM` tasks. Already shipped and covered by unit, contract and migration checks (non-gating, but live): `TF.1–TF.6` foundations, `TD.3` chart snapshots (D.3), `TE.1–TE.4` adapters/pipeline/review/health (E.1–E.3), `TM.1`/`TM.2a` provider abstraction + Deezer live match (X.1-partial).

| # | Criterion | Verification |
|---|-----------|--------------|
| S.1 | A **40-track set exports to a Spotify playlist with ≥ 90% auto-matches** | Timed run against a defined fixture set |
| S.2 | Unmatched and low/medium-confidence tracks are reported (review queue + unmatched report) | Manual + unit |
| S.3 | Matching is **ISRC-first**, then fuzzy (normalized title/artist/album + ±3 s) with a confidence score | Unit + fixture tests |
| S.4 | Only track metadata + search queries leave the device; **no audio is downloaded, streamed, stored, or uploaded**, and source audio is not read/modified beyond existing tags | Automated hash/read audit + code review |
| S.5 | Tokens live in the OS keychain and refresh **without re-auth** | Integration test + manual restart |
| S.6 | `429` / `Retry-After` responses are handled with backoff; `401` refreshes the token; `403`/`404` are surfaced | Unit + mocked-API tests |
| S.7 | Disconnect/revoke removes stored tokens | Manual + unit |
| S.8 | The created Spotify playlist is recorded and **deletable from within the app** | Manual |
| S.9 | Auth uses OAuth 2.0 Authorization Code + PKCE with an embedded public client ID and **no client secret / no cloud dependency** | Code review |
| S.10 | Minimal scopes only (`playlist-modify-private` default; public/read only when opted in); no library or email scopes | Code review |

| # | Criterion | Verification |
|---|-----------|--------------|
| D.1 | Similar-tracks results carry a `source` (local / Last.fm / provider) and never auto-modify sets | Unit + manual |
| D.2 | External similarity is opt-in per provider; only IDs + metadata cross the network, cached ≥ 30 days | Code review + unit |
| D.3 | Chart snapshots are versioned data with a taste score (60% tempo / 40% key) and ISRC-exact ownership | Fixture tests |
| D.4 | Release radar is opt-in, cached and rate-limited; unofficial feeds are labelled as such | Manual + unit |
| E.1 | Enrichment runs preview → apply → undo; bulk apply needs explicit confirmation | Manual + undo tests |
| E.2 | Enrichment writes DB canonical fields only; source-file BLAKE3 hashes are unchanged | Automated hash audit |
| E.3 | Provider IDs are cached in `external_ids`; re-runs are cache hits, quota/backoff respected | Unit (mocked transport) |
| E.4 | Fingerprint-based identification (AcoustID) computes locally; only the fingerprint leaves the device | Code review |
| X.1 | Each new export target reuses the generic match → review → publish → undo contract | Per-provider fixtures |
| X.2 | No provider integration downloads, streams, stores or plays back audio in-app | Automated audit + review |

**A failed S.x / D.x / E.x / X.x criterion never blocks MVP.** It affects only whether that post-MVP scope ships.

---

## 7. Feature-Level Acceptance (Selected Critical Features)

### Cue Master
- Generates up to 8 hot cues + essential memory cues from structure
- Cues snap to musical grid according to documented rules
- All cues editable; AI provenance visible
- Cues verifiable in Preview Player (wave + grid + beat jump + artwork); overrides persist
- Export includes cues correctly

### Tag Surgeon
- Preview before apply
- Full undo
- Aliases persist and affect future imports
- No silent changes

### Set Architect / Beam Search
- Ordering produced by Beam Search, never by raw LLM output
- Scoring uses the single locked formula versioned with `analysis_version` (TA.2)
- Energy input = user tag + LUFS proxy + manual slider; missing ML mood never blocks build
- Respects locked tracks and duration constraints
- Produces alternative suggestions on re-run
- Set versions + diff persisted (F-6); transitions carry traffic-light + mix-out + vocal warning (F-5)

### Export
- rekordbox XML and Serato crate are primary; both must work
- Hardware validation is mandatory for phase exit
- USB media format targets universal Pioneer compat: FAT32 + MBR default; exFAT only behind an explicit booth-capability warning

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
