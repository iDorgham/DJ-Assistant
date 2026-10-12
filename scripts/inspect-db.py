"""Inspect the local DJ Assistant SQLite database created by the desktop app."""

import os
import sqlite3
import sys


def main() -> int:
    default = os.path.join(os.environ["APPDATA"], "com.djassistant.desktop", "dj_assistant.db")
    path = sys.argv[1] if len(sys.argv) > 1 else default
    if not os.path.exists(path):
        print(f"NOT FOUND: {path}")
        return 1

    print(f"DB: {path} ({os.path.getsize(path)} bytes)")
    con = sqlite3.connect(path)
    tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    print(f"tables: {tables}")
    for table in ("tracks", "cue_points", "workspaces", "skill_runs", "schema_migrations"):
        if table in tables:
            cols = [r[1] for r in con.execute(f"PRAGMA table_info({table})")]
            print(f"  {table}: {cols}")
    if "schema_migrations" in tables:
        print(f"applied migrations: {[r[0] for r in con.execute('SELECT version FROM schema_migrations')]}")
    if "workspaces" in tables:
        print(f"workspaces: {list(con.execute('SELECT id, name FROM workspaces'))}")
    if "cue_points" in tables:
        has_slot = any(r[1] == "slot" for r in con.execute("PRAGMA table_info(cue_points)"))
        has_old = any(r[1] == "hot_cue_index" for r in con.execute("PRAGMA table_info(cue_points)"))
        print(f"cue_points has 'slot': {has_slot}; has legacy 'hot_cue_index': {has_old}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
