#!/usr/bin/env python3
"""Hash audit for fixture source audio (TA.6 / global acceptance rule 1 + M.3).

Records SHA-256 of every file under fixtures/audio/ and verifies nothing changed.

Modes:
  --record   Walk fixtures/audio/, hash every file, write fixtures/audio/hashes.json
  (default)  Load hashes.json, re-hash every file, exit 1 on any mismatch.

Usage:
    python3 scripts/hash-audit.py --record   # after generating/updating fixtures
    python3 scripts/hash-audit.py            # in CI and before any pipeline run
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

FIXTURES_ROOT = Path("fixtures/audio")
HASHES_FILE   = FIXTURES_ROOT / "hashes.json"
HASHES_VERSION = 1


def sha256_file(path: Path) -> str:
    """Compute the SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def walk_files(root: Path, skip: Path) -> list[Path]:
    """Return all files under root, sorted, excluding skip."""
    results = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.resolve() != skip.resolve():
            results.append(path)
    return results


def record_mode() -> int:
    """Hash every file under fixtures/audio/ and write hashes.json."""
    if not FIXTURES_ROOT.exists():
        print(f"ERROR: fixtures root not found: {FIXTURES_ROOT}", file=sys.stderr)
        return 1

    files = walk_files(FIXTURES_ROOT, HASHES_FILE)
    file_hashes: dict[str, str] = {}
    for path in files:
        rel = path.relative_to(FIXTURES_ROOT).as_posix()
        digest = sha256_file(path)
        file_hashes[rel] = digest
        print(f"  OK   {rel}")

    payload = {
        "version": HASHES_VERSION,
        "files": dict(sorted(file_hashes.items())),
    }
    HASHES_FILE.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nRecorded {len(file_hashes)} file(s) → {HASHES_FILE}")
    return 0


def verify_mode() -> int:
    """Load hashes.json and verify every recorded file matches its stored hash."""
    if not HASHES_FILE.exists():
        print(
            f"ERROR: {HASHES_FILE} not found. Run with --record first.",
            file=sys.stderr,
        )
        return 1

    raw = json.loads(HASHES_FILE.read_text(encoding="utf-8"))
    recorded: dict[str, str] = raw.get("files", {})

    mismatches  = 0
    missing     = 0
    new_untracked = 0

    # Check every recorded file
    for rel, expected_digest in sorted(recorded.items()):
        path = FIXTURES_ROOT / rel
        if not path.exists():
            print(f"FAIL {rel}  (file missing from disk)")
            missing += 1
            continue
        actual_digest = sha256_file(path)
        if actual_digest == expected_digest:
            print(f"OK   {rel}")
        else:
            print(
                f"FAIL {rel}  "
                f"expected={expected_digest[:8]}...  "
                f"got={actual_digest[:8]}..."
            )
            mismatches += 1

    # Check for new untracked files
    current_files = walk_files(FIXTURES_ROOT, HASHES_FILE)
    for path in current_files:
        rel = path.relative_to(FIXTURES_ROOT).as_posix()
        if rel not in recorded:
            print(f"WARN {rel}  (new untracked file — run --record to add)")
            new_untracked += 1

    total_ok = len(recorded) - mismatches - missing
    print()

    if mismatches == 0 and missing == 0 and new_untracked == 0:
        print(f"All {total_ok} files OK")
        return 0
    else:
        print(
            f"FAILED: {mismatches} mismatch(es), {missing} missing, "
            f"{new_untracked} new untracked"
        )
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="SHA-256 hash audit for fixture audio files."
    )
    parser.add_argument(
        "--record",
        action="store_true",
        help="Record current hashes to fixtures/audio/hashes.json",
    )
    args = parser.parse_args()

    if args.record:
        sys.exit(record_mode())
    else:
        sys.exit(verify_mode())


if __name__ == "__main__":
    main()
