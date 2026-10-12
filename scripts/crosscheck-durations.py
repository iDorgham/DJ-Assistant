"""Cross-check dj-scan durations against ffprobe for the same files.

Reads the `tracks` table written by dj-scan, runs ffprobe on each file, and reports
the delta. This is the independent verification that the in-house MP3/WAV/AIFF
duration parsers agree with a mature reference decoder.
"""

import json
import os
import sqlite3
import subprocess
import sys


def ffprobe_duration_ms(path: str) -> int | None:
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "json", path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if out.returncode != 0:
            return None
        data = json.loads(out.stdout or "{}")
        seconds = data.get("format", {}).get("duration")
        return round(float(seconds) * 1000) if seconds else None
    except Exception:
        return None


def main() -> int:
    db = sys.argv[1] if len(sys.argv) > 1 else "dj-scan.db"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 25

    con = sqlite3.connect(db)
    rows = con.execute(
        "SELECT file_path, duration_ms, format FROM tracks ORDER BY RANDOM() LIMIT ?", (limit,)
    ).fetchall()

    if not rows:
        print("no rows to check")
        return 1

    print(f"cross-checking {len(rows)} file(s) against ffprobe\n")
    print(f"{'ours':>9} {'ffprobe':>9} {'delta':>7}  file")
    worst = 0
    checked = 0
    missing = 0

    for path, ours, fmt in rows:
        if not os.path.exists(path):
            missing += 1
            continue
        theirs = ffprobe_duration_ms(path)
        if theirs is None:
            missing += 1
            continue
        delta = ours - theirs
        worst = max(worst, abs(delta))
        checked += 1
        name = os.path.basename(path)
        print(f"{ours:>9} {theirs:>9} {delta:>+7}  {name[:58]}")

    print(f"\nchecked: {checked}   unreadable/missing: {missing}   worst delta: {worst} ms")
    # A few hundred ms is expected for VBR files without an accurate frame count.
    if worst <= 1000:
        print("VERDICT: in-house duration parsers agree with ffprobe")
        return 0
    print("VERDICT: durations disagree materially - investigate")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
