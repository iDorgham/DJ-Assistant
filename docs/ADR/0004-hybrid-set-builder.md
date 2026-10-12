# ADR-0004: Hybrid Set Builder (LLM Constraints + Beam Search)

**Status:** Accepted  
**Date:** 2026-10-09

## Context

Users want natural-language set requests (“2-hour dark melodic techno, start 123 BPM, peak 128 around 80 minutes”). Pure LLM sequencing is non-deterministic, hard to constrain, and can hallucinate orderings. Pure rule systems are rigid and poor at understanding intent.

## Decision

Use a **hybrid pipeline**:

1. **LLM** (cloud or local when available) — Parse natural language / UI into structured constraints only. Also used for post-hoc transition explanations.
2. **Deterministic Beam Search** (local) — Build the transition graph and optimize track order (beam width W = 10). Maximize cumulative compatibility score while respecting duration, locked tracks, exclusions, and energy curve.
3. **Scoring** — Weighted combination of key (Camelot), BPM delta, energy, and optional semantic similarity. LLM does **not** choose track order.

## Consequences

**Positive**
- Deterministic, optimizable, explainable sequences.
- Natural language UX without giving the LLM optimization authority.
- Scoring function and beam parameters are tunable and testable.

**Negative**
- Two subsystems to maintain (constraint parser + optimizer).
- Beam Search quality depends on scoring weights and candidate pool quality.

**Neutral**
- Explanation layer can be template-based offline if LLM is unavailable.

## Alternatives Considered

- **LLM end-to-end sequencing** — Rejected: non-deterministic, hard to enforce hard constraints, hallucination risk, costly.
- **Pure greedy / rule-based sequencer** — Rejected: weaker global optimization; poor handling of multi-objective constraints.
- **ILP / full combinatorial solvers** — Overkill for interactive use; latency and complexity too high for v1.
