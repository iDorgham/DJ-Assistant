# scripts/

Helper scripts for fixtures, models, icons, and local verification. `environment.yml` is for notebooks; Python scripts require their own dependencies, and shell scripts are documented inline.

| Script | Purpose |
|--------|---------|
| `make-fixtures.py` | Generate the deterministic synthetic audio corpus in `fixtures/audio/` + `manifest.json` (idempotent, no licensed audio) |
| `make-smoke-model.py` | Regenerate the 61-byte `fixtures/models/smoke_test.onnx` (`y = Relu(x)`) without the `onnx` wheel |
| `make_icon.py` | Render `assets/logo.svg` → `apps/desktop/src-tauri/app-icon.png` (then run `tauri icon` for platform variants) |
| `download-models.sh` | Placeholder for real ONNX weight downloads (Phase 1) |
| `crosscheck-durations.py` | Compare a random sample of track durations from a SQLite DB with ffprobe |
| `show-fixture-durations.py` | Print fixture duration table |
| `inspect-db.py` | Inspect the local SQLite library DB |
| `summarize-scan.py` | Summarize a scan run |
| `update-task-docs.py` | Bulk-update SDD task docs |

Regenerating icons touches ~50 files under `apps/desktop/src-tauri/icons/` — keep icon regen in its own commit, only when `assets/logo.svg` changes.
