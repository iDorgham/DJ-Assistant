# fixtures/

Deterministic test fixtures. No licensed or copyrighted audio.

| Folder | Contents | Generator / notes |
|--------|----------|-------------------|
| `audio/` | 14 synthetic fixtures + `manifest.json` (tagged WAV/FLAC/AIFF/MP3 + tagged M4A PCM, no-tag WAV, unicode/apostrophe names, 4 corrupt files, unsupported `.txt`, duplicate pair) | `scripts/make-fixtures.py` (idempotent); `tagged-mp3-125.mp3` is tag-parsing only (silent audio) |
| `charts/` | `*.SAMPLE.json` chart snapshot format references (Beatport Top 100 / Hype) | Versioned data ingest via `chart_import_snapshot`; no catalog API exists |
| `models/` | `smoke_test.onnx` (61-byte `y = Relu(x)` graph) | `scripts/make-smoke-model.py`; SHA-256 pinned by `ModelSpec::smoke_test()` + fixture-integrity test |

Rules: do not commit large copyrighted audio; prefer short synthetic clips; store expected analysis outputs as JSON alongside fixtures (see `docs/engineering/TESTING_AND_SECURITY.md` §2.4).
