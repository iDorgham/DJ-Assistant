# ADR-0003: Local-First ONNX Analysis

**Status:** Accepted  
**Date:** 2026-10-09

## Context

Core value proposition depends on analyzing 40+ tracks quickly without uploading audio. Privacy, bandwidth, and offline capability are non-negotiable. Analysis must produce BPM, key, beat grid, phrase boundaries, vocal presence, and loudness on consumer hardware.

## Decision

All primary audio analysis runs **locally** via:

- **Symphonia** for decoding
- **ONNX Runtime** for inference (quantized models where possible)
- Results stored in local SQLite with `analysis_version` / model versioning

Raw audio never leaves the device by default. Cloud receives only derived, user-consented metadata and features.

Target: p50 analysis time < 3s per track on a mid-range laptop (CPU).

## Consequences

**Positive**
- Strong privacy story and offline core workflow.
- No per-track cloud compute cost for analysis.
- Deterministic, versionable analysis pipeline.

**Negative**
- Model packaging, download, and platform linking complexity.
- CPU performance constraints; must invest in quantization and efficient pipelines.
- Harder to hot-swap models than a pure cloud service.

**Neutral**
- Optional cloud embeddings / search remain available with explicit consent.

## Alternatives Considered

- **Cloud-only analysis** — Rejected: violates privacy-first positioning and offline promise; high bandwidth and cost.
- **Python runtime (Essentia/madmom directly)** — Rejected for production desktop: heavy dependency, packaging pain, GIL/perf issues. ONNX exports of similar models preferred.
- **Hybrid “local if possible, cloud fallback”** — Deferred; core path must be fully local. Cloud fallback may be considered later for low-end devices only.
