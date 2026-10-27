//! `dj-query` — headless, read-only queries against the app's own library
//! database.
//!
//! The Library view can only be reached through the Tauri IPC boundary, which
//! a script or an agent cannot drive. This binary runs the *same*
//! `dj_assistant_core::library_query` builder the desktop app uses, over a
//! **read-only** connection, so the agent and the UI can never disagree about
//! what the library contains.
//!
//! ```text
//! cargo run -p dj-assistant-core --features cli --bin dj-query -- \
//!     --db "%APPDATA%\com.djassistant.desktop\dj_assistant.db" --stats
//! ```
//!
//! Flags:
//!
//! | Flag | Meaning |
//! | ---- | ------- |
//! | `--db PATH` | Database to read. Defaults to `%APPDATA%\com.djassistant.desktop\dj_assistant.db`, or `$DJ_ASSISTANT_DB`. |
//! | `--stats` | Print the library summary instead of a track list. |
//! | `--check-files` | Also report tracks whose audio file is no longer on disk. |
//! | `--query TEXT` | Free-text search across title, artist, album, path, comment and tags. |
//! | `--bpm-min` / `--bpm-max` | Inclusive BPM bounds. |
//! | `--key CODE` | Camelot key. Repeatable. |
//! | `--status S` | Analysis status. Repeatable. |
//! | `--genre G` | Genre. Repeatable. |
//! | `--tag T` | Custom tag. Repeatable; matches a track that carries **any** of the tags. |
//! | `--rating-min N` | Inclusive minimum star rating (0–5). |
//! | `--energy-min` / `--energy-max` | Inclusive energy bounds (1–10). |
//! | `--sort KEY` | One of the allow-listed sort keys. |
//! | `--dir asc\|desc` | Sort direction. |
//! | `--limit N` / `--offset N` | Page size and offset. |
//! | `--json` | Machine-readable output. |
//!
//! The connection is opened `SQLITE_OPEN_READ_ONLY`, so this binary cannot
//! write to the library database, and it never touches the audio files unless
//! `--check-files` is passed (which only stats them).
//!
//! The database is migrated by the desktop app, so the file this binary is pointed
//! at can be older than the code reading it — a snapshot taken before migration 008
//! has no `tracks.removed_at`. The list, the summary and the drift check adapt to
//! the schema they find ([`dj_assistant_core::library_schema`]) and say so on stderr,
//! rather than failing every read with `no such column`.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use dj_assistant_core::library_query::{sort_column, QueryParam, TrackFilters, TrackQuery};
use dj_assistant_core::library_reads::missing_file_paths_sql;
use dj_assistant_core::library_schema::LibrarySchema;
use dj_assistant_core::library_stats::{stat_queries, status_breakdown_sql};
use rusqlite::types::Value;
use rusqlite::{params, Connection, OpenFlags};

/// The library predates migration 008, so the soft-removal filter is dropped.
///
/// Nothing is lost by dropping it — a database without the column cannot have
/// removed a track — but the caller has to know the read is not the app's own,
/// because the next migration may not be tolerated the same way. On stderr, so
/// `--json` on stdout stays parseable.
const OUTDATED_SCHEMA_WARNING: &str = "Warning: Database schema is outdated (missing \
    'removed_at' column). Some filters are disabled. Run migrations for full functionality.";

/// The columns the list query selects, in row order.
///
/// A trimmed subset of the desktop's `TRACK_SUMMARY_COLUMNS`: everything an
/// agent needs to answer "which track is this?", without the artwork and
/// comment blobs.
const TRACK_COLUMNS: [&str; 12] = [
    "id",
    "title",
    "artist",
    "album",
    "genre",
    "bpm",
    "key_camelot",
    "duration_ms",
    "analysis_status",
    "user_rating",
    "energy",
    "file_path",
];

/// Columns that every schema the app has ever written has.
const REQUIRED_COLUMNS: [&str; 5] = ["id", "title", "artist", "duration_ms", "file_path"];

const DEFAULT_LIMIT: i64 = 50;
const MAX_LIMIT: i64 = 100_000;

struct Args {
    db: PathBuf,
    stats: bool,
    check_files: bool,
    query: Option<String>,
    filters: TrackFilters,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    limit: i64,
    offset: i64,
    json: bool,
}

fn parse_args() -> Result<Args, String> {
    let mut db: Option<PathBuf> = None;
    let mut stats = false;
    let mut check_files = false;
    let mut query = None;
    let mut filters = TrackFilters::default();
    let mut sort_by = None;
    let mut sort_dir = None;
    let mut limit = DEFAULT_LIMIT;
    let mut offset = 0i64;
    let mut json = false;

    let mut it = std::env::args().skip(1);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--db" => db = Some(PathBuf::from(next_value(&mut it, "--db")?)),
            "--stats" => stats = true,
            "--check-files" => check_files = true,
            "--query" => query = Some(next_value(&mut it, "--query")?),
            "--bpm-min" => {
                filters.bpm_min = Some(parse_f64(&next_value(&mut it, "--bpm-min")?, "--bpm-min")?)
            }
            "--bpm-max" => {
                filters.bpm_max = Some(parse_f64(&next_value(&mut it, "--bpm-max")?, "--bpm-max")?)
            }
            "--key" => filters.key_camelot.push(next_value(&mut it, "--key")?),
            "--status" => filters
                .analysis_status
                .push(next_value(&mut it, "--status")?),
            "--genre" => filters.genre.push(next_value(&mut it, "--genre")?),
            "--tag" => filters.tag.push(next_value(&mut it, "--tag")?),
            "--rating-min" => {
                filters.rating_min = Some(parse_i64(
                    &next_value(&mut it, "--rating-min")?,
                    "--rating-min",
                )?)
            }
            "--energy-min" => {
                filters.energy_min = Some(parse_i64(
                    &next_value(&mut it, "--energy-min")?,
                    "--energy-min",
                )?)
            }
            "--energy-max" => {
                filters.energy_max = Some(parse_i64(
                    &next_value(&mut it, "--energy-max")?,
                    "--energy-max",
                )?)
            }
            "--sort" => sort_by = Some(next_value(&mut it, "--sort")?),
            "--dir" => sort_dir = Some(next_value(&mut it, "--dir")?),
            "--limit" => limit = parse_i64(&next_value(&mut it, "--limit")?, "--limit")?,
            "--offset" => offset = parse_i64(&next_value(&mut it, "--offset")?, "--offset")?,
            "--json" => json = true,
            "--help" | "-h" => return Err("help".to_string()),
            other => return Err(format!("unknown argument: {other}")),
        }
    }

    if limit < 0 {
        return Err("--limit must not be negative".to_string());
    }
    if offset < 0 {
        return Err("--offset must not be negative".to_string());
    }

    Ok(Args {
        db: db.unwrap_or_else(default_db_path),
        stats,
        check_files,
        query,
        filters,
        sort_by,
        sort_dir,
        limit: limit.min(MAX_LIMIT),
        offset,
        json,
    })
}

fn next_value(it: &mut impl Iterator<Item = String>, flag: &str) -> Result<String, String> {
    it.next().ok_or_else(|| format!("{flag} needs a value"))
}

fn parse_f64(value: &str, flag: &str) -> Result<f64, String> {
    value.parse::<f64>().map_err(|e| format!("bad {flag}: {e}"))
}

fn parse_i64(value: &str, flag: &str) -> Result<i64, String> {
    value.parse::<i64>().map_err(|e| format!("bad {flag}: {e}"))
}

/// The library database the desktop app owns.
///
/// `$DJ_ASSISTANT_DB` wins so the same binary can be pointed at a snapshot;
/// otherwise the app's Windows location is used when it exists.
fn default_db_path() -> PathBuf {
    if let Ok(path) = std::env::var("DJ_ASSISTANT_DB") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        let candidate = Path::new(&appdata)
            .join("com.djassistant.desktop")
            .join("dj_assistant.db");
        if candidate.exists() {
            return candidate;
        }
    }
    PathBuf::from("dj_assistant.db")
}

/// Opens the database **read-only**.
///
/// The app runs the database in WAL mode. A read-only connection cannot create
/// the WAL index (`-shm`), so it fails when the app is closed and SQLite has
/// removed both the `-wal` and `-shm` files. Two fallbacks keep the tool
/// usable without ever opening the file for writing:
///
/// 1. If the `-wal` file still holds content, the main file is **stale** and
///    reading it would silently under-report. That is an error, not a
///    fallback: the caller is told to query a snapshot instead.
/// 2. If the `-wal` file is empty or missing, the main file is complete, and
///    SQLite's `immutable=1` can read it without a WAL index.
fn open_read_only(path: &Path) -> Result<Connection, String> {
    match Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY) {
        Ok(conn) => Ok(conn),
        Err(first) => {
            let wal = wal_path(path);
            let wal_has_content = wal
                .as_ref()
                .and_then(|p| p.metadata().ok())
                .map(|m| m.len() > 0)
                .unwrap_or(false);

            if wal_has_content {
                return Err(format!(
                    "cannot open {} read-only: {first}\n\
                     The database has uncheckpointed WAL content, so the main file is stale. \
                     Point --db at a snapshot copy instead of the live file.",
                    path.display()
                ));
            }

            let uri = format!("file:{}?immutable=1", uri_escape(&path.to_string_lossy()));
            Connection::open_with_flags(
                &uri,
                OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI,
            )
            .map_err(|second| {
                format!(
                    "cannot open {} read-only: {first} (immutable fallback: {second})",
                    path.display()
                )
            })
        }
    }
}

/// The WAL sidecar file for a SQLite database.
fn wal_path(path: &Path) -> Option<PathBuf> {
    let mut name = path.file_name()?.to_os_string();
    name.push("-wal");
    Some(path.with_file_name(name))
}

/// Percent-encodes the characters that would otherwise end the URI path.
fn uri_escape(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        match ch {
            '%' => out.push_str("%25"),
            '?' => out.push_str("%3F"),
            '#' => out.push_str("%23"),
            other => out.push(other),
        }
    }
    out
}

/// Maps a core query parameter onto the `rusqlite` value type — the same
/// mapping the desktop command layer uses.
fn to_sql_value(param: &QueryParam) -> Value {
    match param {
        QueryParam::Text(value) => Value::Text(value.clone()),
        QueryParam::Int(value) => Value::Integer(*value),
        QueryParam::Real(value) => Value::Real(*value),
    }
}

/// True when the database has the given table.
///
/// The custom tags live in their own table (migration 007), so a library
/// that was last opened before that migration has none.
fn table_exists(conn: &Connection, table: &str) -> Result<bool, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            params![table],
            |row| row.get(0),
        )
        .map_err(|e| format!("cannot read the schema of {table}: {e}"))?;
    Ok(count > 0)
}

/// The columns the `tracks` table actually has.
///
/// The library database is migrated by the desktop app on startup, so it can
/// be older than the code asking the question — a library that was last opened
/// before the energy migration has no `energy` column at all. Reading the
/// schema first lets the CLI answer with the columns it has instead of dying
/// on "no such column".
fn table_columns(conn: &Connection, table: &str) -> Result<HashSet<String>, String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|e| format!("cannot read the schema of {table}: {e}"))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("cannot read the schema of {table}: {e}"))?;

    let columns: HashSet<String> = rows.flatten().collect();
    if columns.is_empty() {
        return Err(format!(
            "the database has no `{table}` table — it is not a DJ Assistant library"
        ));
    }
    Ok(columns)
}

/// The select list, adapted to the columns the database actually has.
///
/// A missing optional column becomes `NULL AS <name>` so the row layout never
/// shifts: the mapper reads fixed positions.
fn select_columns(available: &HashSet<String>) -> String {
    TRACK_COLUMNS
        .iter()
        .map(|column| {
            if available.contains(*column) {
                (*column).to_string()
            } else {
                format!("NULL AS {column}")
            }
        })
        .collect::<Vec<_>>()
        .join(", ")
}

/// Fails with a clear message when the request needs a column the database
/// does not have.
fn check_schema(conn: &Connection, args: &Args, available: &HashSet<String>) -> Result<(), String> {
    for column in REQUIRED_COLUMNS {
        if !available.contains(column) {
            return Err(format!(
                "the library database is missing the `{column}` column — \
                 it is not a DJ Assistant library"
            ));
        }
    }

    // The free-text search and the tag filter both read `track_tags`, which
    // only exists since migration 007. A library last opened before that
    // migration has no such table, so the request is refused with a clear
    // message instead of failing inside SQLite.
    let searches_tags = args
        .query
        .as_deref()
        .is_some_and(|query| !query.trim().is_empty())
        || !args.filters.tag.is_empty();
    if searches_tags && !table_exists(conn, "track_tags")? {
        return Err(
            "the library database has no `track_tags` table, so it cannot be searched or \
             filtered by tag. Open the desktop app once to apply the newest migration."
                .to_string(),
        );
    }

    let sort_column = sort_column(args.sort_by.as_deref());
    if !available.contains(sort_column) {
        return Err(format!(
            "the library database has no `{sort_column}` column, so it cannot be \
             sorted by it. Open the desktop app once to apply the newest \
             migration, or pick another --sort key."
        ));
    }

    if (args.filters.energy_min.is_some() || args.filters.energy_max.is_some())
        && !available.contains("energy")
    {
        return Err(
            "the library database has no `energy` column, so it cannot be filtered by \
             energy. Open the desktop app once to apply the newest migration."
                .to_string(),
        );
    }

    Ok(())
}

/// One row of the list query, as plain values.
struct TrackRow {
    id: String,
    title: String,
    artist: String,
    album: Option<String>,
    genre: Option<String>,
    bpm: Option<f64>,
    key: Option<String>,
    duration_ms: i64,
    status: String,
    rating: Option<i64>,
    energy: Option<i64>,
    path: String,
}

fn map_track(row: &rusqlite::Row) -> rusqlite::Result<TrackRow> {
    Ok(TrackRow {
        id: row.get(0)?,
        title: row.get(1)?,
        artist: row.get(2)?,
        album: row.get(3)?,
        genre: row.get(4)?,
        bpm: row.get(5)?,
        key: row.get(6)?,
        duration_ms: row.get(7)?,
        status: row.get(8)?,
        rating: row.get(9)?,
        energy: row.get(10)?,
        path: row.get(11)?,
    })
}

/// Runs a read-only library query, printing results or help to stdout and
/// diagnostics to stderr, including a warning when removal tracking is absent.
/// Returns success for help or a completed query, and failure for argument,
/// database, schema or query errors.
fn main() -> ExitCode {
    let args = match parse_args() {
        Ok(args) => args,
        Err(message) => {
            if message != "help" {
                eprintln!("error: {message}\n");
            }
            usage();
            return if message == "help" {
                ExitCode::SUCCESS
            } else {
                ExitCode::FAILURE
            };
        }
    };

    if !args.db.exists() {
        eprintln!(
            "error: database not found: {}\n\
             Pass --db <PATH>, or set DJ_ASSISTANT_DB.",
            args.db.display()
        );
        return ExitCode::FAILURE;
    }

    let conn = match open_read_only(&args.db) {
        Ok(conn) => conn,
        Err(message) => {
            eprintln!("error: {message}");
            return ExitCode::FAILURE;
        }
    };

    // The schema is read once, here, so the warning about an old library is
    // printed once — and both modes see the same answer.
    let available = match table_columns(&conn, "tracks") {
        Ok(columns) => columns,
        Err(message) => {
            eprintln!("error: {message}");
            return ExitCode::FAILURE;
        }
    };
    let schema = LibrarySchema::from_columns(&available);
    if !schema.removal_tracked {
        eprintln!("{OUTDATED_SCHEMA_WARNING}");
    }

    let result = if args.stats {
        run_stats(&conn, &args, &available, &schema)
    } else {
        run_list(&conn, &args, &available, &schema)
    };

    if let Err(message) = result {
        eprintln!("error: {message}");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}

fn usage() {
    println!("dj-query — read-only queries against the DJ Assistant library database\n");
    println!("USAGE:");
    println!("  dj-query [--db <PATH>] [--stats] [--check-files] [filters] [--json]\n");
    println!("FILTERS:");
    println!("  --query <TEXT>       free-text search (title, artist, album, path)");
    println!("  --bpm-min <F>        inclusive lower BPM bound");
    println!("  --bpm-max <F>        inclusive upper BPM bound");
    println!("  --key <CODE>         Camelot key, repeatable");
    println!("  --status <S>         analysis status, repeatable");
    println!("  --genre <G>          genre, repeatable");
    println!("  --tag <T>            custom tag, repeatable");
    println!("  --rating-min <N>     inclusive minimum star rating (0-5)");
    println!("  --energy-min <N>     inclusive minimum energy (1-10)");
    println!("  --energy-max <N>     inclusive maximum energy (1-10)");
    println!("  --sort <KEY>         title|artist|bpm|key|duration|imported_at|rating|energy");
    println!("  --dir asc|desc       sort direction");
    println!("  --limit <N>          page size (default {DEFAULT_LIMIT})");
    println!("  --offset <N>         page offset (default 0)");
    println!("  --json               machine-readable output\n");
    println!("EXAMPLES:");
    println!("  dj-query --stats");
    println!("  dj-query --bpm-min 122 --bpm-max 126 --key 8A --json");
    println!("  dj-query --status needs_review --sort bpm --limit 20");
}

/// Columns the summary statements read.
const STAT_COLUMNS: [&str; 5] = [
    "analysis_status",
    "bpm",
    "key_camelot",
    "user_rating",
    "file_hash",
];

/// Prints library-wide counts and a status breakdown to stdout as JSON or text.
/// `available` and `schema` must describe the connection's `tracks` table.
/// With `check_files`, also checks paths and caps examples at `args.limit`.
///
/// Returns an error for missing summary columns, count or status-query setup
/// failures, or a failed file-path query. Unreadable status rows are skipped.
fn run_stats(
    conn: &Connection,
    args: &Args,
    available: &HashSet<String>,
    schema: &LibrarySchema,
) -> Result<(), String> {
    for column in STAT_COLUMNS {
        if !available.contains(column) {
            return Err(format!(
                "the library database is missing the `{column}` column — \
                 it is not a DJ Assistant library"
            ));
        }
    }

    let mut counts: Vec<(String, i64)> = Vec::new();
    for stat in stat_queries(schema) {
        let value: i64 = conn
            .query_row(&stat.sql, [], |row| row.get(0))
            .map_err(|e| format!("{}: {e}", stat.key))?;
        counts.push((stat.key.to_string(), value));
    }

    let mut by_status: Vec<(String, i64)> = Vec::new();
    {
        let sql = status_breakdown_sql(schema);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("status breakdown: {e}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })
            .map_err(|e| format!("status breakdown: {e}"))?;
        for row in rows.flatten() {
            by_status.push(row);
        }
    }

    let missing_files = if args.check_files {
        Some(missing_files(conn, args.limit, schema)?)
    } else {
        None
    };

    if args.json {
        let mut payload = serde_json::Map::new();
        payload.insert(
            "db".into(),
            serde_json::Value::String(args.db.display().to_string()),
        );
        for (key, value) in &counts {
            payload.insert(key.clone(), serde_json::Value::from(*value));
        }
        let status_map: serde_json::Map<String, serde_json::Value> = by_status
            .iter()
            .map(|(status, count)| (status.clone(), serde_json::Value::from(*count)))
            .collect();
        payload.insert("by_status".into(), serde_json::Value::Object(status_map));
        if let Some((total, sample)) = &missing_files {
            payload.insert(
                "missing_files".into(),
                serde_json::Value::from(*total as u64),
            );
            payload.insert(
                "missing_file_paths".into(),
                serde_json::Value::Array(
                    sample
                        .iter()
                        .map(|path| serde_json::Value::String(path.clone()))
                        .collect(),
                ),
            );
        }
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::Value::Object(payload)).unwrap()
        );
        return Ok(());
    }

    println!("database : {}", args.db.display());
    for (key, value) in &counts {
        println!("{key:<18}: {value}");
    }
    println!("by status           :");
    for (status, count) in &by_status {
        println!("  {status:<16}: {count}");
    }
    if let Some((total, sample)) = &missing_files {
        println!("missing files       : {total}");
        for path in sample {
            println!("  {path}");
        }
    }
    Ok(())
}

/// Tracks whose audio file is no longer on disk.
///
/// Read-only: the file is only stat-ed, never opened for writing. This is the
/// cheapest way to spot a library that has drifted from the filesystem.
///
/// Returns the total number of missing files and up to `limit` example paths.
/// The caller supplies a nonnegative sample limit; zero returns no examples
/// without limiting the count. `schema` controls whether soft-removed rows are
/// excluded. Paths whose existence cannot be determined also count as missing.
///
/// Returns an error if the file-path query cannot be prepared or started.
/// Unreadable path rows are skipped.
fn missing_files(
    conn: &Connection,
    limit: i64,
    schema: &LibrarySchema,
) -> Result<(usize, Vec<String>), String> {
    let sql = missing_file_paths_sql(schema);
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("missing files: {e}"))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("missing files: {e}"))?;

    let mut total = 0usize;
    let mut sample = Vec::new();
    for path in rows.flatten() {
        if !Path::new(&path).exists() {
            total += 1;
            if sample.len() < limit as usize {
                sample.push(path);
            }
        }
    }
    Ok((total, sample))
}

/// Prints a filtered, sorted page and its unpaginated matching count as JSON or text.
/// `available` and `schema` must describe the connection's `tracks` table;
/// missing optional output columns become NULL. With `check_files`, checks the
/// entire library rather than just the matching page, capping examples at `args.limit`.
///
/// Returns schema-check, filter-validation, count or list-query setup errors,
/// including errors from the optional file-path query. Unreadable track rows are skipped.
fn run_list(
    conn: &Connection,
    args: &Args,
    available: &HashSet<String>,
    schema: &LibrarySchema,
) -> Result<(), String> {
    check_schema(conn, args, available)?;

    let query = TrackQuery {
        query: args.query.clone(),
        filters: args.filters.clone(),
        sort_by: args.sort_by.clone(),
        sort_dir: args.sort_dir.clone(),
    };

    let built = query
        .build_with(schema, &select_columns(available), args.limit, args.offset)
        .map_err(|e| e.to_string())?;

    let params: Vec<Value> = built.params.iter().map(to_sql_value).collect();
    let count_params = &params[..params.len().saturating_sub(2)];

    let total: i64 = conn
        .query_row(
            &built.count_sql,
            rusqlite::params_from_iter(count_params.iter()),
            |row| row.get(0),
        )
        .map_err(|e| format!("count: {e}"))?;

    let mut stmt = conn
        .prepare(&built.select_sql)
        .map_err(|e| format!("prepare: {e}"))?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), map_track)
        .map_err(|e| format!("query: {e}"))?;
    let tracks: Vec<TrackRow> = rows.flatten().collect();

    // `--check-files` is honoured in the list mode too, not only in `--stats`:
    // the tracks are still listed, and the files that are gone are reported
    // alongside them. Same scan as the summary — every track in the library,
    // with the sample capped at the page size.
    let missing_files = if args.check_files {
        Some(missing_files(conn, args.limit, schema)?)
    } else {
        None
    };

    if args.json {
        let mut payload = serde_json::json!({
            "db": args.db.display().to_string(),
            "total": total,
            "returned": tracks.len(),
            "offset": args.offset,
            "tracks": tracks
                .iter()
                .map(|track| serde_json::json!({
                    "id": track.id,
                    "title": track.title,
                    "artist": track.artist,
                    "album": track.album,
                    "genre": track.genre,
                    "bpm": track.bpm,
                    "key": track.key,
                    "duration_ms": track.duration_ms,
                    "status": track.status,
                    "rating": track.rating,
                    "energy": track.energy,
                    "path": track.path,
                }))
                .collect::<Vec<_>>(),
        });
        if let Some((missing_total, sample)) = &missing_files {
            payload["missing_files"] = serde_json::Value::from(*missing_total as u64);
            payload["missing_file_paths"] = serde_json::Value::Array(
                sample
                    .iter()
                    .map(|path| serde_json::Value::String(path.clone()))
                    .collect(),
            );
        }
        println!("{}", serde_json::to_string_pretty(&payload).unwrap());
        return Ok(());
    }

    println!(
        "database : {}\nmatching : {total}\nreturned : {}\n",
        args.db.display(),
        tracks.len()
    );
    for track in &tracks {
        println!(
            "{:<28} {:<24} {:>7} {:>5} {:>9}  {}",
            truncate(&track.title, 28),
            truncate(&track.artist, 24),
            track
                .bpm
                .map(|bpm| format!("{bpm:.1}"))
                .unwrap_or_else(|| "-".to_string()),
            track.key.clone().unwrap_or_else(|| "-".to_string()),
            track.status,
            track.path
        );
    }
    if let Some((missing_total, sample)) = &missing_files {
        println!("missing files       : {missing_total}");
        for path in sample {
            println!("  {path}");
        }
    }
    Ok(())
}

/// Shortens a value for the fixed-width table, without breaking UTF-8.
fn truncate(value: &str, width: usize) -> String {
    if value.chars().count() <= width {
        return value.to_string();
    }
    let mut out: String = value.chars().take(width.saturating_sub(1)).collect();
    out.push('…');
    out
}
