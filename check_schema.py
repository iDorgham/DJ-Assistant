#!/usr/bin/env python3
"""Print the table list, migration versions, and migration-007 feature presence
for a DJ Assistant database.

Usage:
    python check_schema.py path/to/dj_assistant_qa_copy.db

The path is required and must point at an existing, readable file. This is a
diagnostic helper for QA copies: it opens the given path read-only (URI mode=ro),
so it never modifies the database — not even WAL checkpointing or hot-journal
recovery. It only issues SELECTs.
"""

import sqlite3
import sys
from contextlib import closing
from pathlib import Path


class HotJournalRecoveryError(RuntimeError):
    """Raised when a read-only schema check cannot recover a hot journal."""


def _is_missing_schema_object(error: sqlite3.OperationalError) -> bool:
    """Return whether SQLite reports a missing table or column."""
    message = str(error).lower()
    return "no such table:" in message or "no such column:" in message


def _needs_hot_journal_recovery(
    error: sqlite3.OperationalError, journal_path: Path
) -> bool:
    """Recognize a read-only failure while a rollback journal is present."""
    message = str(error).lower()
    error_code = getattr(error, "sqlite_errorcode", None)
    read_only_error = (
        error_code is not None and error_code & 0xFF == sqlite3.SQLITE_READONLY
    ) or "readonly" in message or "read-only" in message
    return journal_path.exists() and read_only_error


def check(path: str) -> None:
    """Print the tables, migration versions, and migration-007 feature probes."""
    database_path = Path(path).resolve()
    journal_path = Path(f"{database_path}-journal")
    uri = f"{database_path.as_uri()}?mode=ro"

    try:
        with closing(sqlite3.connect(uri, uri=True)) as conn:
            c = conn.cursor()
            c.execute("SELECT name FROM sqlite_master WHERE type='table'")
            print([r[0] for r in c.fetchall()])

            try:
                c.execute("SELECT version FROM schema_migrations")
                print([r[0] for r in c.fetchall()])
            except sqlite3.OperationalError as error:
                if "no such table: schema_migrations" not in str(error).lower():
                    raise
                print("no schema_migrations table")

            try:
                c.execute("SELECT * FROM track_tags LIMIT 1")
                print("has track_tags")
            except sqlite3.OperationalError as error:
                if not _is_missing_schema_object(error):
                    raise
                print("no track_tags", error)

            try:
                c.execute("SELECT label FROM tracks LIMIT 1")
                print("has label")
            except sqlite3.OperationalError as error:
                if not _is_missing_schema_object(error):
                    raise
                print("no label", error)
    except sqlite3.OperationalError as error:
        if not _needs_hot_journal_recovery(error, journal_path):
            raise
        raise HotJournalRecoveryError(
            "schema check cannot run read-only because the database needs "
            "hot-journal recovery; run the check on a writable copy"
        ) from error


def main(argv: list[str]) -> int:
    """Validate arguments and run the read-only schema check."""
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
    try:
        check(path)
    except HotJournalRecoveryError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
