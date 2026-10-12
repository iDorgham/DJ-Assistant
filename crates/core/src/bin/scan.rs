//! `dj-scan` — headless library scanner for real-library verification.
//!
//! The desktop app can only scan a folder chosen through a native dialog, which
//! cannot be driven from a script. This binary runs the *same*
//! `dj_assistant_core` pipeline (discover -> fingerprint -> dedup -> metadata ->
//! SQLite) against a real folder, so a full-size library can be verified and its
//! results inspected without a GUI.
//!
//! ```text
//! cargo run -p dj-assistant-core --features cli --bin dj-scan -- \
//!     --folder "D:\Music\Music Library" --limit 100 --db scan.db
//! ```
//!
//! Flags: `--folder` (required), `--limit N`, `--db PATH`, `--json`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Instant;

use dj_assistant_core::{
    compute_file_fingerprint, discover_audio_files, extract_metadata, ScanDeduplicator,
};
use rusqlite::{params, Connection};

const MIGRATION_001: &str =
    include_str!("../../../../apps/desktop/src-tauri/migrations/001_initial_schema.sql");

struct Args {
    folder: PathBuf,
    limit: Option<usize>,
    db: PathBuf,
    json: bool,
}

fn parse_args() -> Result<Args, String> {
    let mut folder = None;
    let mut limit = None;
    let mut db = PathBuf::from("dj-scan.db");
    let mut json = false;

    let mut it = std::env::args().skip(1);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--folder" | "-f" => folder = it.next().map(PathBuf::from),
            "--limit" | "-n" => {
                limit = Some(
                    it.next()
                        .ok_or("--limit needs a value")?
                        .parse::<usize>()
                        .map_err(|e| format!("bad --limit: {e}"))?,
                )
            }
            "--db" => db = it.next().map(PathBuf::from).ok_or("--db needs a value")?,
            "--json" => json = true,
            "--help" | "-h" => return Err("help".to_string()),
            other => return Err(format!("unknown argument: {other}")),
        }
    }

    Ok(Args {
        folder: folder.ok_or("--folder is required")?,
        limit,
        db,
        json,
    })
}

fn usage() {
    println!("dj-scan — headless library scanner for real-library verification\n");
    println!("USAGE:");
    println!("  dj-scan --folder <PATH> [--limit N] [--db <PATH>] [--json]\n");
    println!("Runs the same pipeline as the desktop app's scan_folder command.");
}

/// Creates the schema, mirroring the app's migration runner.
fn open_db(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;
    let already: i64 = conn.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE version = 1",
        [],
        |r| r.get(0),
    )?;
    if already == 0 {
        conn.execute_batch(MIGRATION_001)?;
        conn.execute("INSERT INTO schema_migrations (version) VALUES (1)", [])?;
    }
    Ok(conn)
}

fn main() -> ExitCode {
    let args = match parse_args() {
        Ok(a) => a,
        Err(msg) => {
            if msg != "help" {
                eprintln!("error: {msg}\n");
            }
            usage();
            return if msg == "help" {
                ExitCode::SUCCESS
            } else {
                ExitCode::FAILURE
            };
        }
    };

    if !args.folder.is_dir() {
        eprintln!("error: not a directory: {}", args.folder.display());
        return ExitCode::FAILURE;
    }

    let mut conn = match open_db(&args.db) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("error: cannot open database {}: {e}", args.db.display());
            return ExitCode::FAILURE;
        }
    };

    let started = Instant::now();
    let mut paths = discover_audio_files(&args.folder, true);
    let discovered = paths.len();
    if let Some(limit) = args.limit {
        paths.truncate(limit);
    }

    println!(
        "Scanning {} file(s) from {} (discovered {}) -> {}",
        paths.len(),
        args.folder.display(),
        discovered,
        args.db.display()
    );

    let mut dedup = ScanDeduplicator::new();
    let mut imported = 0usize;
    let mut duplicates = 0usize;
    let mut errors = 0usize;
    let mut format_counts: HashMap<String, usize> = HashMap::new();
    let mut zero_duration: Vec<String> = Vec::new();
    let mut fallback_artist = 0usize;

    // Re-hashing already-imported files each run is wasteful; load existing hashes once.
    let existing: Vec<String> =
        match conn
            .prepare("SELECT file_hash FROM tracks")
            .and_then(|mut s| {
                s.query_map([], |r| r.get::<_, String>(0))
                    .map(|rows| rows.filter_map(Result::ok).collect())
            }) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("error: cannot read existing hashes: {e}");
                return ExitCode::FAILURE;
            }
        };
    let existing_hashes: std::collections::HashSet<String> = existing.into_iter().collect();
    println!(
        "Database already contains {} track(s)",
        existing_hashes.len()
    );

    let tx = match conn.transaction() {
        Ok(t) => t,
        Err(e) => {
            eprintln!("error: cannot begin transaction: {e}");
            return ExitCode::FAILURE;
        }
    };

    for path in &paths {
        let hash = match compute_file_fingerprint(path) {
            Ok(h) => h,
            Err(e) => {
                errors += 1;
                eprintln!("  hash error: {} ({e})", path.display());
                continue;
            }
        };

        if dedup
            .classify(&hash, |h| existing_hashes.contains(h))
            .is_duplicate()
        {
            duplicates += 1;
            continue;
        }

        let meta = match extract_metadata(path) {
            Ok(m) => m,
            Err(e) => {
                errors += 1;
                dedup.release(&hash);
                eprintln!("  metadata error: {} ({e})", path.display());
                continue;
            }
        };

        let insert = tx.execute(
            "INSERT INTO tracks (
                id, workspace_id, file_path, file_hash, file_size, duration_ms, format,
                title, artist, album, genre, year, analysis_status, created_at, updated_at
            ) VALUES (?1, 'default', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'pending', ?12, ?12)",
            params![
                uuid_like(&hash),
                path.to_string_lossy(),
                hash,
                meta.file_size,
                meta.duration_ms,
                meta.format,
                meta.title,
                meta.artist,
                meta.album,
                meta.genre,
                meta.year,
                "2026-01-01T00:00:00Z",
            ],
        );

        match insert {
            Ok(_) => {
                imported += 1;
                *format_counts.entry(meta.format.clone()).or_default() += 1;
                if meta.duration_ms == 0 {
                    zero_duration.push(meta.format.clone());
                }
                if meta.artist == "Unknown Artist" {
                    fallback_artist += 1;
                }
            }
            Err(e) => {
                errors += 1;
                dedup.release(&hash);
                eprintln!("  insert error: {} ({e})", path.display());
            }
        }
    }

    if let Err(e) = tx.commit() {
        eprintln!("error: commit failed: {e}");
        return ExitCode::FAILURE;
    }

    let elapsed = started.elapsed();
    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM tracks", [], |r| r.get(0))
        .unwrap_or(-1);

    let mut formats: Vec<(&String, &usize)> = format_counts.iter().collect();
    formats.sort();

    if args.json {
        let fmt_json: Vec<String> = formats
            .iter()
            .map(|(k, v)| format!("\"{k}\": {v}"))
            .collect();
        println!(
            "{{\"discovered\": {discovered}, \"attempted\": {}, \"imported\": {imported}, \
             \"duplicates\": {duplicates}, \"errors\": {errors}, \"rows_in_db\": {total}, \
             \"fallback_artist\": {fallback_artist}, \"zero_duration\": {}, \
             \"elapsed_ms\": {}, \"formats\": {{{}}}}}",
            paths.len(),
            zero_duration.len(),
            elapsed.as_millis(),
            fmt_json.join(", ")
        );
    } else {
        println!("\n--- results ---");
        println!("attempted     : {}", paths.len());
        println!("imported      : {imported}");
        println!("duplicates    : {duplicates}");
        println!("errors        : {errors}");
        println!("rows in db    : {total}");
        println!("elapsed       : {:.1}s", elapsed.as_secs_f64());
        if imported > 0 {
            println!(
                "avg per track : {:.0} ms",
                elapsed.as_millis() as f64 / imported as f64
            );
        }
        println!("formats       : {formats:?}");
        println!("fallback artist (untagged): {fallback_artist}");
        if !zero_duration.is_empty() {
            println!(
                "ZERO-DURATION tracks       : {} (formats: {:?})",
                zero_duration.len(),
                zero_duration
            );
        }
    }

    ExitCode::SUCCESS
}

/// Deterministic id derived from the fingerprint (the CLI has no uuid crate).
fn uuid_like(hash: &str) -> String {
    format!("scan-{}", &hash[..16.min(hash.len())])
}
