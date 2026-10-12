"""Summarise a dj-scan database: rows, sample metadata, and data-quality counts."""

import sqlite3
import sys


def main() -> int:
    db = sys.argv[1] if len(sys.argv) > 1 else "dj-scan.db"
    con = sqlite3.connect(db)

    total = con.execute("SELECT COUNT(*) FROM tracks").fetchone()[0]
    print(f"total rows: {total}")

    print("\ndistinct duration_ms values:", con.execute(
        "SELECT DISTINCT duration_ms FROM tracks ORDER BY duration_ms"
    ).fetchall())

    checks = [
        ("zero/negative duration", "SELECT COUNT(*) FROM tracks WHERE duration_ms IS NULL OR duration_ms <= 0"),
        ("fallback artist", "SELECT COUNT(*) FROM tracks WHERE artist = 'Unknown Artist'"),
        ("empty title", "SELECT COUNT(*) FROM tracks WHERE title IS NULL OR TRIM(title) = ''"),
        ("null album", "SELECT COUNT(*) FROM tracks WHERE album IS NULL"),
        ("null genre", "SELECT COUNT(*) FROM tracks WHERE genre IS NULL"),
        ("null year", "SELECT COUNT(*) FROM tracks WHERE year IS NULL"),
        ("null format", "SELECT COUNT(*) FROM tracks WHERE format IS NULL"),
        ("duplicate hashes", "SELECT COUNT(*) FROM (SELECT file_hash FROM tracks GROUP BY file_hash HAVING COUNT(*) > 1)"),
    ]
    print()
    for label, sql in checks:
        n = con.execute(sql).fetchone()[0]
        flag = "  <-- PROBLEM" if (n and "duration" in label and n == total) or (n and "duplicate" in label) else ""
        print(f"  {label:24s}: {n}{flag}")

    print("\nby format:", con.execute(
        "SELECT format, COUNT(*) FROM tracks GROUP BY format ORDER BY 2 DESC"
    ).fetchall())

    print("\nsample rows:")
    for r in con.execute(
        "SELECT title, artist, album, genre, year, duration_ms, format FROM tracks LIMIT 5"
    ):
        print(f"  title={r[0]!r}\n    artist={r[1]!r} album={r[2]!r}")
        print(f"    genre={r[3]!r} year={r[4]} duration_ms={r[5]} format={r[6]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
