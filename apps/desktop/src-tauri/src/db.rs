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
                self.conn.execute_batch(sql)?;
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
        db.init_migrations().expect("reapplying migrations must be a no-op");
    }
}
