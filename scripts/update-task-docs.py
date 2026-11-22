"""Check off Phase 0 tasks in the docs that are verifiably complete.

Only flips lines whose task IDs/text are explicitly listed below, so the docs
cannot be rewritten by accident. Reports anything it could not find.
"""

from __future__ import annotations

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (file, exact task prefix or line text) pairs that are DONE.
DONE_SDD = [
    "T0.1.1",  # pnpm workspace + root package.json
    "T0.1.2",  # Cargo workspace
    "T0.1.3",  # apps/desktop Tauri v2 + React + TS + Tailwind
    "T0.1.4",  # apps/api Fastify skeleton
    "T0.1.5",  # packages/shared
    "T0.1.6",  # Prettier + TS strict (ESLint not adopted - noted in checklist)
    "T0.1.7",  # cargo fmt + clippy wired into CI and ci:local
    "T0.1.9",  # .env.example
    "T0.1.10",  # scripts/download-models.sh placeholder
    "T0.1.11",  # CI clippy -D warnings + test job
    "T0.1.12",  # fixtures/audio, metadata, exports
    "T0.1.13",  # path canonicalization + traversal unit tests
    "T0.1.14",  # Tauri CSP + capability allowlist
    "T0.1.16",  # pr-ci + main-ci workflows
    "T0.1.18",  # CODEOWNERS
    "T0.1.19",  # pnpm ci:local
    "T0.2.1",  # window boots with React screen
    "T0.2.2",  # native folder picker
    "T0.2.3",  # recursive scan with progress events
    "T0.2.4",  # BLAKE3 fingerprint
    "T0.2.5",  # hash-based dedup
    "T0.2.6",  # audiotags metadata extraction
    "T0.2.7",  # SQLite + migration runner
    "T0.2.8",  # tracks table schema
    "T0.2.9",  # scan_folder / list_tracks / get_track IPC
    "T0.2.10",  # minimal library list UI
    "T0.2.11",  # graceful skip + log
]

# The retired docs/tasks/archive/DEVELOPMENT_TASK_LIST.md is frozen; only the
# tracker, sdd/04-TASKS.md, is updated.


def flip(path: str, needle: str) -> bool:
    with open(path, encoding="utf-8") as fh:
        lines = fh.readlines()
    for i, line in enumerate(lines):
        if needle in line and "- [ ]" in line:
            lines[i] = line.replace("- [ ]", "- [x]", 1)
            with open(path, "w", encoding="utf-8", newline="") as fh:
                fh.writelines(lines)
            return True
    return False


def main() -> int:
    sdd = os.path.join(ROOT, "docs", "sdd", "04-TASKS.md")

    missing: list[str] = []
    done = 0
    for tid in DONE_SDD:
        if flip(sdd, f"**{tid}**"):
            done += 1
        else:
            missing.append(f"SDD {tid}")

    print(f"checked off {done} tasks")
    if missing:
        print("NOT FOUND (check manually):")
        for m in missing:
            print(f"  - {m}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
