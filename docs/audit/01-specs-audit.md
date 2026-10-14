# 01 — Specs Audit

**Sources:** `docs/product/CANONICAL_DOCUMENTATION.md` v1.1, `docs/sdd/01-SPECIFICATION.md`, `docs/sdd/03-PHASES-AND-PLAN.md`, `docs/sdd/04-TASKS.md`, `docs/sdd/05-ACCEPTANCE.md`, `docs/architecture/ARCHITECTURE.md`, `docs/diagrams/`

## What exists

- Product vision: `Analyze → Clean → Cue → Sequence → Export` ≤15min/40 tracks (`01-SPECIFICATION.md:15-16`).
- P0 / P1 / P2 + Post-MVP split (`01-SPECIFICATION.md:31-88`). Post-MVP = Spotify metadata-only export, Discovery, Enrichment, Multi-provider.
- Explicit out-of-scope (`01-SPECIFICATION.md:91-99`): no live mixing, no audio download/rip/stream/store, no cloud raw audio, no open agents.
- Constraints table (`01-SPECIFICATION.md:105-113`): offline core, non-destructive source, hardware CDJ-2000NXS2/3000, USB FAT32+MBR default.
- Binding acceptance (`05-ACCEPTANCE.md:5`): Global + P0.1-P0.8 + P1.1-P1.8 + P2.1-P2.12 + P3.1-P3.11 + M.1-M.8 + non-gating S/D/E/X.
- 90-day plan WS1-WS5 (`03-PHASES-AND-PLAN.md`), task list T0-T4 + TF/TD/TE/TP/TX (`04-TASKS.md`).

## Pros

1. Single source declared (`01-SPECIFICATION.md:4` points to Canonical). Good.
2. Quantitative gates: p50 <3s/track, 50 tracks <5min, 40 tracks <15min, cues >90%, tags >95% (`05-ACCEPTANCE.md:49-50,100-104`).
3. Non-gating Post-MVP (`05-ACCEPTANCE.md:113-115`) prevents Spotify/discovery from blocking MVP.
4. USB + hardware specificity (FAT32+MBR, 32KB clusters, ASCII ≤11 chars) matches Pioneer reality.
5. AI boundaries table (`01-SPECIFICATION.md:129-136`): ONNX local, Beam Search deterministic, LLM only for constraint parse/explain.

## Cons

1. **P0 still broad:** import + ONNX + 8 cues + Tag Surgeon + Beam Search + basic Skills framework are MVP. USB is classified P1, but P3.9–P3.11 and the MVP gate still require it. Slip risk.
2. **Duplication drift:** Canonical 828+ lines vs SDD vs ARCH vs 18 diagrams. No spec-lint. Example drift already: set/similarity formula Canonical `0.35/0.30/0.20/0.15` vs shipped `0.45/0.35/0.10/0.10` (`API_CONTRACTS.md:395`).
3. **Manual-heavy acceptance:** ~60% rows = `Manual`. No golden corpus size, no fixed benchmark hardware (“mid-range laptop” undefined).
4. **Missing specs:** error-code catalog, log/telemetry retention, frontend perf budget, backup/restore, file move/rename handling, batch concurrency, model update/rollback, constraint-parser LLM provider (cloud vs local) decision.
5. **90-day overlap:** Days 31-55 P2 + 41-70 P3 overlap without dependency map; hardware validation (CDJ) on critical path with no fallback.

## Verdict

Spec system is strong for a v1 (explicit, measurable, non-gating). Main risk is breadth + drift + manual verification.
