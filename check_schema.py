#!/usr/bin/env python3
"""Print the table list, migration versions, and migration-007 feature presence
for a DJ Assistant database.

Usage:
    python check_schema.py path/to/dj_assistant_qa_copy.db

The path is required and must point at an existing, readable file. This is a
diagnostic helper for QA copies: it opens whatever path it is given, so point it
at a copy rather than the live library. It only issues SELECTs and never writes.
"""

import sqlite3
import sys


def check(path: str) -> None:
    conn = sqlite3.connect(path)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    print([r[0] for r in c.fetchall()])
    c.execute("SELECT version FROM schema_migrations")
    print([r[0] for r in c.fetchall()])
    # check track_tags
    try:
        c.execute("SELECT * FROM track_tags LIMIT 1")
        print("has track_tags")
    except Exception as e:
        print("no track_tags", e)
    # check label column
    try:
        c.execute("SELECT label FROM tracks LIMIT 1")
        print("has label")
    except Exception as e:
        print("no label", e)
    conn.close()


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python check_schema.py <path-to-dj-assistant.db>")
        return 2
    path = argv[1]
    # Probe before connecting: sqlite3.connect() would otherwise create an empty
    # database at a mistyped path and report a confusing "no such table" instead.
    try:
        with open(path, "rb"):
            pass
    except OSError as e:
        print(f"error: database not found or not readable: {path}: {e}")
        return 1
    check(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
