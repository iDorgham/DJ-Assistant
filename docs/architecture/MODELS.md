# DJ Assistant — Models & Analysis Assets

**Status:** Foundation implemented (Phase 1 in progress)  
**Source:** Canonical Documentation §3.2, Architecture, Development Guide  
**Last Updated:** 2026-10-12

This document describes the **local ONNX analysis models**, packaging expectations, versioning, and performance targets. Exact model files and checksums will be filled in when models are selected and exported.

---

## 1. Principles

1. **Local-first** — Primary analysis (BPM, key, beat grid, phrases, vocal presence, loudness) runs on-device via ONNX Runtime. Raw audio never leaves the machine by default.
2. **Versioned** — Every analysis result records `analysis_version` (pipeline + model versions). Re-analysis is supported when versions change.
3. **Quantized preferred** — Prefer INT8 / optimized ONNX graphs for CPU latency and smaller download size.
4. **Graceful degradation** — Missing or failed models must not crash the app; flag tracks as `needs_review` / `failed` and continue.
5. **No training on user audio in v1** — Inference only. Training on user libraries requires explicit, separate consent and is out of scope for MVP.

---

## 2. Analysis Capabilities & Model Roles

| Capability | Typical Approach | Runtime | Notes |
|------------|------------------|---------|-------|
| BPM + Beat grid | Beat-tracking CNN / RNN (madmom-class lineage or equivalent ONNX export) | ONNX | High reliability target |
| Key (Camelot + classical) | Key-detection model (Essentia-style or CNN) | ONNX | Reasonably reliable; allow override |
| Phrase / structure | CNN segmentation → intro, build, drop, breakdown, outro + 8/16/32-bar phrases | ONNX + heuristics | Confidence score stored |
| Vocal presence / density | Lightweight vocal activity or source-separation proxy (quantized Spleeter-class or smaller) | ONNX | Curve + aggregate score |
| Loudness | EBU R128 LUFS (algorithmic; may not need ML) | Native / crate | Deterministic |
| Spectral brightness | Spectral feature extraction | Native / light model | Optional |
| Embeddings (search) | CLAP 512-dim (or similar) | ONNX (optional cloud index) | User opt-in for cloud sync |

Canonical note: Energy, mood, danceability, and “groove” are **not** auto-scored from audio as ground truth; they remain user tags / preferences.

---

## 3. Model Registry (Local)

Models live under `models/` (or a configurable path). They are **not** committed as large binaries without Git LFS or a download script.

Suggested layout:

```
models/
├── registry.json          # name, version, filename, sha256, input/output specs
├── beat_grid/
│   └── v1/
│       └── model.onnx
├── key/
│   └── v1/
│       └── model.onnx
├── structure/
│   └── v1/
│       └── model.onnx
├── vocal/
│   └── v1/
│       └── model.onnx
└── embeddings/            # optional
    └── clap/
        └── v1/
            └── model.onnx
```

`registry.json` (conceptual):

```json
{
  "models": [
    {
      "id": "beat_grid",
      "version": "1.0.0",
      "path": "beat_grid/v1/model.onnx",
      "sha256": "…",
      "framework": "onnx",
      "input": { "name": "audio", "shape": ["batch", "samples"], "sample_rate": 44100 },
      "output": { "bpm": "float", "beats": "float[]" }
    }
  ]
}
```

`scripts/download-models.sh` fetches and verifies checksums. CI may use a minimal smoke-test model only.

### Smoke-test fixture (implemented)

The engine-foundation smoke test does not need a real model. A 61-byte identity-like
graph — `y = Relu(x)`, `tensor(float)[1]` in/out, opset 7 — is committed at
`fixtures/models/smoke_test.onnx` and regenerated deterministically (no `onnx` wheel
required) by:

```bash
python scripts/make-smoke-model.py
```

`Relu` is used instead of `Identity` because the operator-trimmed ONNX Runtime bundled
with Microsoft Edge WebView2 (a zero-install fallback discovered on Windows) implements
`Relu` but rejects `Identity`. Its SHA-256 is declared once in Rust by
`dj_assistant_analysis::ModelSpec::smoke_test()` and pinned by a fixture-integrity test,
so the file and the spec cannot drift apart. The generator prints the digest to copy
into the spec when the graph changes.

---

## 4. Runtime Integration

- **ONNX Runtime** integrated from Rust in the Tauri-free `crates/analysis`
  (`dj-assistant-analysis`) crate; the desktop `src-tauri` layer consumes it. Dylib
  discovery (`ORT_DYLIB_PATH` → exe/cwd → known platform locations) and SHA-256 model
  verification happen before any inference.
- Decode with **Symphonia** → resample/normalize as required by each model → inference → post-process (beat snap, Camelot mapping, phrase merge).
- Analysis job queue is **local** (per-track + batch). UI receives progress events.
- Store in SQLite: feature columns + `analysis_status` + `analysis_version` + confidence flags.

### Performance Targets

| Metric | Target |
|--------|--------|
| p50 analysis time / track (mid-range laptop, CPU) | < 3 s |
| 50-track folder wall time (analyze + usable cues) | < 5 min + light review |
| Model load | Once per process; warm cache |

---

## 5. Versioning & Re-analysis

- Bump `analysis_version` when model weights, preprocessing, or post-processing change in a way that affects outputs.
- UI offers “Re-analyze” (single / selection / library).
- Golden fixtures (BPM / key / phrase) guard regressions in CI.

---

## 6. Cloud / Optional Models

| Model | Where | Consent |
|-------|-------|---------|
| LLM constraint parser / explanations | Cloud (or local if available) | Account / feature use |
| CLAP (or similar) embeddings for search | Local compute; optional cloud index | Explicit sync consent |
| Future personalization | Derived preferences only (DJ Brain) | User-inspectable; no raw audio training in v1 |

---

## 7. Security & Supply Chain

- Pin model file checksums; verify on download and load.
- Prefer audited ONNX Runtime builds and minimal native deps.
- Models are inference artifacts only — treat untrusted model files as potentially hostile (limit filesystem/network from inference threads).

---

## 8. Open Items (Fill During Phase 1)

- [ ] Final model selection and ONNX export pipeline for BPM/beat, key, structure, vocal
- [ ] Exact input sample rates, mono/stereo policy, and max duration chunking
- [ ] Quantization recipe and measured CPU latency on reference hardware
- [x] Smoke-test / CI model stub strategy — committed `fixtures/models/smoke_test.onnx`
      (regenerated by `scripts/make-smoke-model.py`), digest-pinned by a fixture-integrity
      test that runs without the runtime; the inference test skips when no runtime exists
- [ ] Golden BPM / key / phrase fixture set
- [ ] Documented fallback when a model fails to load

---

## Related Documents

- [Architecture](./ARCHITECTURE.md) — Analysis pipeline
- [Data Model](./DATA_MODEL.md) — Where results are stored
- [Development Guide](../engineering/DEVELOPMENT.md) — Setup & model download
- [ADR-0003: Local-first ONNX Analysis](../ADR/0003-local-first-onnx-analysis.md)
- [Canonical Documentation §3.2](../product/CANONICAL_DOCUMENTATION.md)
