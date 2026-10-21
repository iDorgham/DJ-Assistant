use rusqlite::{Connection, Result};
use std::path::Path;

pub struct Database {
    conn: Connection,
}

const MIGRATIONS: &[(i64, &str)] = &[
    (1, include_str!("../migrations/001_initial_schema.sql")),
    (2, include_str!("../migrations/002_track_tags.sql")),
    (
        3,
        include_str!("../migrations/003_enrichment_providers.sql"),
    ),
    (
        4,
        include_str!("../migrations/004_enrichment_candidates.sql"),
    ),
    (5, include_str!("../migrations/005_chart_snapshots.sql")),
    (6, include_str!("../migrations/006_track_energy.sql")),
];

impl Database {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.apply_pragmas()?;
        db.init_migrations()?;
        Ok(db)
    }

    #[allow(dead_code)]
    pub fn new_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Database { conn };
        db.apply_pragmas()?;
        db.init_migrations()?;
        Ok(db)
    }

    /// SQLite leaves foreign-key enforcement OFF by default. The schema relies on it:
    /// `tracks.workspace_id` -> `workspaces(id)` and `cue_points.track_id` -> `tracks(id)`
    /// both declare `ON DELETE CASCADE`, which is a no-op unless this is enabled.
    fn apply_pragmas(&self) -> Result<()> {
        // `foreign_keys` must be set per connection.
        self.conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        // WAL is persistent and needs the statement's return value checked - it is a
        // no-op for in-memory databases, and `execute_batch` would hide that silently.
        let journal_mode: String = self
            .conn
            .query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))?;
        log::debug!("SQLite journal_mode = {}", journal_mode);

        self.conn.execute_batch("PRAGMA synchronous = NORMAL;")
    }

    fn init_migrations(&self) -> Result<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )?;

        // Apply each migration at most once, in order. Migration 001 is the
        // full initial schema; later migrations are additive `ALTER TABLE`s, so
        // a database created before they existed is upgraded in place.
        for (version, sql) in MIGRATIONS {
            let applied: i64 = self.conn.query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
                [version],
                |row| row.get(0),
            )?;

            if applied == 0 {
                // Retry-safe: bare `ALTER TABLE ... ADD COLUMN` fails with
                // "duplicate column name" if a previous run crashed between the
                // ALTER and the version INSERT. Strip already-applied ALTERs so
                // re-running a migration is a no-op even without the guard.
                let filtered = without_applied_alters(&self.conn, sql)?;
                if !filtered.trim().is_empty() {
                    self.conn.execute_batch(&filtered)?;
                }
                self.conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES (?1)",
                    [version],
                )?;
            }
        }

        Ok(())
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Mutable access to the connection. Commands that need a transaction hold
    /// the `MutexGuard` mutably, so the write and its undo snapshot commit
    /// together.
    pub fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }
}

/// True when `column` already exists on `table`. Used to make bare
/// `ALTER TABLE ... ADD COLUMN` statements retry-safe (SQLite has no
/// `ADD COLUMN IF NOT EXISTS` on all supported versions).
fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    // Table names are internal constants, never user input.
    let sql = format!("SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = ?1");
    let n: i64 = conn.query_row(&sql, [column], |row| row.get(0))?;
    Ok(n > 0)
}

/// Parse a single-line `ALTER TABLE <table> ADD [COLUMN] <column> ...`.
/// Returns `None` for anything else. Comment lines never match (they start with
/// `--`), so semicolons inside comments cannot confuse this, unlike statement
/// splitting on `;`.
fn parse_add_column_line(line: &str) -> Option<(String, String)> {
    let mut tokens = line.split_whitespace();
    if tokens.next()?.to_uppercase() != "ALTER" {
        return None;
    }
    if tokens.next()?.to_uppercase() != "TABLE" {
        return None;
    }
    let table = tokens
        .next()?
        .trim_matches(['"', '[', ']', '`'])
        .to_string();
    if tokens.next()?.to_uppercase() != "ADD" {
        return None;
    }
    let mut next = tokens.next()?.to_string();
    if next.to_uppercase() == "COLUMN" {
        next = tokens.next()?.to_string();
    }
    let column = next
        .trim_matches(['"', '[', ']', '`', ';', '(', '\''])
        .to_string();
    if table.is_empty() || column.is_empty() {
        return None;
    }
    Some((table, column))
}

/// Drop `ALTER TABLE ... ADD COLUMN` lines whose column already exists, keeping
/// every other line byte-for-byte. Line-based (not `;`-split), so semicolons
/// inside `--` comments or string literals cannot corrupt statement boundaries.
fn without_applied_alters(conn: &Connection, sql: &str) -> Result<String> {
    let mut kept = Vec::new();
    for line in sql.lines() {
        if let Some((table, column)) = parse_add_column_line(line) {
            if column_exists(conn, &table, &column)? {
                continue;
            }
        }
        kept.push(line);
    }
    Ok(kept.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table_columns(conn: &Connection, table: &str) -> Vec<String> {
        let mut stmt = conn
            .prepare(&format!("PRAGMA table_info({table})"))
            .expect("pragma must prepare");
        stmt.query_map([], |row| row.get::<_, String>(1))
            .expect("pragma must query")
            .flatten()
            .collect()
    }

    fn tables(conn: &Connection) -> Vec<String> {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .expect("tables must query");
        stmt.query_map([], |row| row.get(0))
            .expect("tables must map")
            .flatten()
            .collect()
    }

    #[test]
    fn all_migrations_apply_in_order_with_enrichment_tables() {
        let db = Database::new_in_memory().expect("migrations must apply");
        let conn = db.conn();
        let present = tables(conn);
        for table in [
            "tracks",
            "cue_points",
            "skill_runs",
            "external_ids",
            "enrichment_runs",
            "enrichment_candidates",
            "chart_snapshots",
            "streaming_accounts",
            "streaming_exports",
            "streaming_matches",
        ] {
            assert!(
                present.contains(&table.to_string()),
                "missing table {table}"
            );
        }
        assert!(table_columns(conn, "tracks").contains(&"isrc".to_string()));
        let run_cols = table_columns(conn, "enrichment_runs");
        assert!(run_cols.contains(&"before_state".to_string()));
        assert!(run_cols.contains(&"after_state".to_string()));
        let cand_cols = table_columns(conn, "enrichment_candidates");
        for col in [
            "run_id",
            "track_id",
            "field",
            "proposed_value",
            "confidence",
            "status",
        ] {
            assert!(cand_cols.contains(&col.to_string()), "missing column {col}");
        }
        // Re-applying over an existing database is a no-op (version-tracked).
        db.init_migrations()
            .expect("reapplying migrations must be a no-op");
    }

    #[test]
    fn retry_after_crash_between_alter_and_version_stamp_is_a_noop() {
        // Simulate a crash after migration 002's ALTERs ran but before its
        // version row was recorded: the columns exist, the guard says "not
        // applied". A retry must complete instead of failing with
        // "duplicate column name".
        let db = Database::new_in_memory().expect("migrations must apply");
        db.conn()
            .execute("DELETE FROM schema_migrations WHERE version = 2", [])
            .expect("version row must be deletable");
        db.init_migrations()
            .expect("retrying a partially-applied migration must succeed");
        let count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = 2",
                [],
                |row| row.get(0),
            )
            .expect("version must be queryable");
        assert_eq!(count, 1, "migration 002 must be re-stamped after retry");
    }
}
