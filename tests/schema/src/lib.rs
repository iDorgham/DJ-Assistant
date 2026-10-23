//! Schema + query contract tests for the DJ Assistant local SQLite database.
//!
//! These run against the *real* migration file used by the desktop app, so SQL
//! drift between `migrations/*.sql` and the queries in
//! `apps/desktop/src-tauri/src/commands.rs` fails here instead of at runtime.

use rusqlite::params;
use rusqlite::Connection;

/// The single source of truth for the schema. Included directly from the app so
/// there is no copy to keep in sync.
pub const MIGRATION_001: &str =
    include_str!("../../../apps/desktop/src-tauri/migrations/001_initial_schema.sql");
pub const MIGRATION_002: &str =
    include_str!("../../../apps/desktop/src-tauri/migrations/002_track_tags.sql");
pub const MIGRATION_006: &str =
    include_str!("../../../apps/desktop/src-tauri/migrations/006_track_energy.sql");
pub const MIGRATION_007: &str =
    include_str!("../../../apps/desktop/src-tauri/migrations/007_track_tags_table.sql");

/// The migrations this crate's contract tests need, in the order `db.rs`
/// applies them: the base schema, the tag columns, the energy column and the
/// custom-tag table.
/// Migrations 003-005 (enrichment, charts) are deliberately left out - no
/// contract here reads those tables.
const MIGRATIONS: &[(i64, &str)] = &[
    (1, MIGRATION_001),
    (2, MIGRATION_002),
    (6, MIGRATION_006),
    (7, MIGRATION_007),
];

/// Opens (or creates) a **file-backed** database at `path`, applies the pragmas and
/// migration exactly as `Database::new` does, and returns the connection.
///
/// File-backed rather than in-memory is what makes persistence testable: an
/// in-memory database cannot demonstrate that data survives a reopen.
pub fn open_migrated_at<P: AsRef<std::path::Path>>(path: P) -> Connection {
    let conn = Connection::open(path).expect("file-backed sqlite");
    apply_schema(&conn);
    conn
}

/// Creates `schema_migrations`, enables foreign keys and applies migration 001.
///
/// Shared by the in-memory and file-backed openers so both stay in step with
/// `db.rs`.
fn apply_schema(conn: &Connection) {
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .expect("foreign_keys must be settable");

    // Confirm enforcement is actually on, rather than assuming the pragma applied.
    let fk_enabled: i64 = conn
        .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
        .expect("PRAGMA foreign_keys must be readable");
    assert_eq!(fk_enabled, 1, "foreign key enforcement must be enabled");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )
    .expect("schema_migrations table must be creatable");

    // Match db.rs: apply each migration at most once, in order, so reopening an
    // existing database is a no-op rather than an error. Bare ALTERs are
    // additionally filtered so a retry after a crash between the ALTER and the
    // version INSERT does not fail with "duplicate column name".
    for (version, sql) in MIGRATIONS {
        let already: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
                [version],
                |row| row.get(0),
            )
            .expect("schema_migrations must be queryable");

        if already == 0 {
            let filtered =
                without_applied_alters(conn, sql).expect("migration SQL must be filterable");
            if !filtered.trim().is_empty() {
                conn.execute_batch(&filtered)
                    .unwrap_or_else(|e| panic!("migration {version} must apply cleanly: {e}"));
            }
            conn.execute(
                "INSERT INTO schema_migrations (version) VALUES (?1)",
                [version],
            )
            .expect("migration version must be recorded");
        }
    }
}

/// Mirrors `Database::init_migrations` + `Database::apply_pragmas` for an
/// in-memory database. Kept in step with db.rs.
pub fn open_migrated() -> Connection {
    let conn = Connection::open_in_memory().expect("in-memory sqlite");
    apply_schema(&conn);
    conn
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> rusqlite::Result<bool> {
    let sql = format!("SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = ?1");
    let n: i64 = conn.query_row(&sql, [column], |row| row.get(0))?;
    Ok(n > 0)
}

fn parse_add_column_line(line: &str) -> Option<(String, String)> {
    // Single-line `ALTER TABLE <table> ADD [COLUMN] <column> ...`. Comment lines
    // never match (they start with `--`), so semicolons inside comments cannot
    // confuse this, unlike statement splitting on `;`.
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
fn without_applied_alters(conn: &Connection, sql: &str) -> rusqlite::Result<String> {
    let mut kept = Vec::new();
    for line in sql.lines() {
        if let Some((table, column)) = parse_add_column_line(line) {
            if column_exists(conn, &table, &column).unwrap_or(false) {
                continue;
            }
        }
        kept.push(line);
    }
    Ok(kept.join("\n"))
}

/// Column list must match `get_track`'s tracks SELECT in commands.rs.
pub const TRACK_DETAIL_COLUMNS: &str =
    "id, file_path, file_hash, title, artist, album, genre, label, year, bpm, key_camelot, key_classical, \
     duration_ms, format, analysis_status, user_rating, energy, comments, artwork_hash, created_at, updated_at, \
     file_size, sample_rate, channels, bit_depth, loudness_lufs, \
     vocal_presence, phrase_confidence, analysis_version, notes";

/// Column list must match `list_tracks`'s SELECT in commands.rs.
pub const TRACK_SUMMARY_COLUMNS: &str =
    "id, file_path, file_hash, title, artist, album, genre, label, year, bpm, key_camelot, key_classical, \
     duration_ms, format, analysis_status, user_rating, energy, comments, artwork_hash, created_at, updated_at";

/// Column list must match the cue SELECT in `get_track`.
pub const CUE_COLUMNS: &str =
    "id, track_id, slot, position_ms, label, cue_type, color_hex, source, created_at";

pub fn seed_track(conn: &Connection) -> String {
    let id = "track-1".to_string();
    conn.execute(
        "INSERT INTO tracks (
            id, workspace_id, file_path, file_hash, file_size, duration_ms, format,
            title, artist, album, genre, year, analysis_status, created_at, updated_at
        ) VALUES (?1, 'default', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'pending', ?12, ?12)",
        params![
            id,
            "D:\\Music\\track.mp3",
            "abc123",
            1024i64,
            240_000i64,
            "mp3",
            "Test Title",
            "Test Artist",
            Some("Test Album"),
            Some("House"),
            Some(2024i64),
            "2026-01-01T00:00:00Z",
        ],
    )
    .expect("track insert must succeed");
    id
}

pub fn seed_cue(conn: &Connection, track_id: &str) -> String {
    let id = "cue-1".to_string();
    conn.execute(
        "INSERT INTO cue_points (id, track_id, position_ms, cue_type, slot, label, color_hex, source)
         VALUES (?1, ?2, 1500, 'hot_cue', 1, 'Intro', '#3b82f6', 'ai_generated')",
        params![id, track_id],
    )
    .expect("cue insert must succeed");
    id
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_applies_and_records_version() {
        let conn = open_migrated();
        let tables: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table'
                 AND name IN ('tracks','cue_points','workspaces','skill_runs','schema_migrations')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(tables, 5, "all Phase 0 tables must exist");
    }

    #[test]
    fn retry_after_crash_between_alter_and_version_stamp_is_a_noop() {
        // Same scenario as db.rs: columns exist but the version row is missing.
        // Re-running apply_schema must filter the bare ALTERs and succeed.
        let conn = open_migrated();
        assert!(column_exists(&conn, "tracks", "comments").unwrap());
        let filtered = without_applied_alters(&conn, MIGRATION_002).unwrap();
        assert!(
            !filtered.to_uppercase().contains("ADD COLUMN"),
            "applied ALTERs must be filtered, got: {filtered}"
        );
        conn.execute("DELETE FROM schema_migrations WHERE version = 2", [])
            .unwrap();
        apply_schema(&conn);
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = 2",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "migration 002 must be re-stamped after retry");
        // And a full second pass is a clean no-op.
        apply_schema(&conn);
    }

    #[test]
    fn default_workspace_is_seeded() {
        // The scanner hardcodes workspace_id = 'default', so this row is load-bearing.
        let conn = open_migrated();
        let ws: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM workspaces WHERE id = 'default'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(ws, 1);
    }

    #[test]
    fn track_detail_query_matches_schema() {
        let conn = open_migrated();
        let track_id = seed_track(&conn);
        let sql = format!("SELECT {TRACK_DETAIL_COLUMNS} FROM tracks WHERE id = ?");
        let mut stmt = conn
            .prepare(&sql)
            .expect("get_track SELECT must match the migrated schema");

        let (title, duration, file_size): (String, i64, i64) = stmt
            .query_row([&track_id], |row| {
                Ok((row.get(3)?, row.get(12)?, row.get(21)?))
            })
            .expect("row mapping must succeed");

        assert_eq!(title, "Test Title");
        assert_eq!(duration, 240_000);
        assert_eq!(file_size, 1024);
    }

    #[test]
    fn track_summary_query_matches_schema() {
        let conn = open_migrated();
        seed_track(&conn);
        let sql = format!(
            "SELECT {TRACK_SUMMARY_COLUMNS} FROM tracks ORDER BY created_at DESC LIMIT ?1 OFFSET ?2"
        );
        let mut stmt = conn
            .prepare(&sql)
            .expect("list_tracks SELECT must match the migrated schema");
        let count = stmt
            .query_map(params![200i64, 0i64], |row| row.get::<_, String>(0))
            .expect("query_map must succeed")
            .count();
        assert_eq!(count, 1);
    }

    #[test]
    fn cue_query_matches_schema() {
        // Regression test: this SELECT previously referenced a non-existent
        // `slot` column (schema had `hot_cue_index`), which failed at runtime.
        let conn = open_migrated();
        let track_id = seed_track(&conn);
        let cue_id = seed_cue(&conn, &track_id);

        let sql = format!(
            "SELECT {CUE_COLUMNS} FROM cue_points WHERE track_id = ? ORDER BY position_ms ASC"
        );
        let mut stmt = conn
            .prepare(&sql)
            .expect("cue SELECT must match the migrated schema");

        let (id, slot, position, label, cue_type, source): (
            String,
            Option<i64>,
            i64,
            String,
            String,
            String,
        ) = stmt
            .query_row([&track_id], |row| {
                Ok((
                    row.get(0)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(7)?,
                ))
            })
            .expect("cue row mapping must succeed");

        assert_eq!(id, cue_id);
        assert_eq!(slot, Some(1));
        assert_eq!(position, 1500);
        assert_eq!(label, "Intro");
        assert_eq!(cue_type, "hot_cue");
        assert_eq!(source, "ai_generated");
    }

    #[test]
    fn duplicate_hash_per_workspace_is_rejected() {
        // Backs the scanner's hash-based dedup guarantee.
        let conn = open_migrated();
        seed_track(&conn);
        let dup = conn.execute(
            "INSERT INTO tracks (id, workspace_id, file_path, file_hash, file_size, title, artist)
             VALUES ('track-2', 'default', 'D:\\Music\\copy.mp3', 'abc123', 1024, 'Dup', 'Artist')",
            [],
        );
        assert!(
            dup.is_err(),
            "same (workspace_id, file_hash) must violate the unique constraint"
        );
    }

    #[test]
    fn deleting_track_cascades_to_cues() {
        let conn = open_migrated();
        let track_id = seed_track(&conn);
        seed_cue(&conn, &track_id);
        conn.execute("DELETE FROM tracks WHERE id = ?", params![track_id])
            .unwrap();
        let cues: i64 = conn
            .query_row("SELECT COUNT(*) FROM cue_points", [], |r| r.get(0))
            .unwrap();
        assert_eq!(cues, 0, "cues must cascade-delete with their track");
    }

    #[test]
    fn slot_is_nullable_for_memory_cues() {
        let conn = open_migrated();
        let track_id = seed_track(&conn);
        conn.execute(
            "INSERT INTO cue_points (id, track_id, position_ms, cue_type, slot, label, source)
             VALUES ('c2', ?1, 9000, 'memory_cue', NULL, 'Drop', 'user_custom')",
            params![track_id],
        )
        .expect("memory cues must allow a NULL slot");
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM cue_points WHERE slot IS NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 1);
    }
}
