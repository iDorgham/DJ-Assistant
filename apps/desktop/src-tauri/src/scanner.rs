use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use dj_assistant_core::{
    cache_artwork, compute_file_fingerprint, discover_audio_files, extract_metadata,
    files_have_same_content, ScanDeduplicator,
};

use dj_assistant_core::library_hygiene::{
    is_distinct_copy, COPY_IS_RECORDED_SQL, RECORD_COPY_SQL, RELOCATE_TRACK_SQL, TRACK_BY_HASH_SQL,
};

use crate::db::Database;
use crate::models::{ScanCompletedEvent, ScanProgressEvent, TrackSummary};

pub fn run_scan(
    app: AppHandle,
    db: Arc<Mutex<Database>>,
    root_dir: PathBuf,
    recursive: bool,
    artwork_dir: PathBuf,
    job_id: String,
) {
    std::thread::spawn(move || {
        let start_time = Instant::now();

        // 1. Discover all candidate audio files (rules live in dj-assistant-core and
        //    are unit-tested there; results are sorted for a deterministic order).
        let audio_paths = discover_audio_files(&root_dir, recursive);

        let total_files = audio_paths.len();
        let mut scanned_files = 0;
        let mut total_imported = 0;
        let mut total_duplicates = 0;
        let mut total_errors = 0;

        // Tracks fingerprints claimed during *this* run, so two copies of the same
        // file in one scan are reported as duplicates instead of the second one
        // tripping the UNIQUE(workspace_id, file_hash) constraint.
        let mut dedup = ScanDeduplicator::new();

        for path in audio_paths {
            scanned_files += 1;
            let path_str = path.to_string_lossy().to_string();

            // Compute BLAKE3 fingerprint
            let hash = match compute_file_fingerprint(&path) {
                Ok(h) => h,
                Err(err) => {
                    total_errors += 1;
                    let _ = app.emit(
                        "scan:progress",
                        ScanProgressEvent {
                            job_id: job_id.clone(),
                            scanned_files,
                            total_files,
                            current_path: path_str,
                            imported_track: None,
                            is_duplicate: false,
                            error: Some(format!("Failed to hash file: {}", err)),
                        },
                    );
                    continue;
                }
            };

            // Duplicate check: same-batch repeat first, then existing database row.
            let duplicate_kind = {
                let db_guard = match db.lock() {
                    Ok(g) => g,
                    Err(_) => break,
                };
                dedup.classify(&hash, |candidate| {
                    db_guard
                        .conn()
                        .prepare("SELECT COUNT(*) FROM tracks WHERE file_hash = ?")
                        .and_then(|mut stmt| {
                            stmt.query_row([candidate], |row| row.get::<_, i64>(0))
                        })
                        .map(|count| count > 0)
                        .unwrap_or(false)
                })
            };

            if duplicate_kind.is_duplicate() {
                total_duplicates += 1;
                // A byte-identical file at another path can never become a row of
                // its own (UNIQUE file_hash): re-point a row whose file moved, or
                // record the copy for the Duplicates review — otherwise it is
                // invisible. A rescan of the same file changes nothing.
                if let Err(err) = record_duplicate_copy(&db, &hash, &path_str) {
                    log::warn!("Failed to record duplicate copy {}: {}", path_str, err);
                }
                let _ = app.emit(
                    "scan:progress",
                    ScanProgressEvent {
                        job_id: job_id.clone(),
                        scanned_files,
                        total_files,
                        current_path: path_str,
                        imported_track: None,
                        is_duplicate: true,
                        error: None,
                    },
                );
                continue;
            }

            // Extract metadata (safe, graceful fallback)
            let meta = match extract_metadata(&path) {
                Ok(m) => m,
                Err(e) => {
                    total_errors += 1;
                    // This file never made it in, so don't hold its fingerprint
                    // against a later identical file.
                    dedup.release(&hash);
                    let _ = app.emit(
                        "scan:progress",
                        ScanProgressEvent {
                            job_id: job_id.clone(),
                            scanned_files,
                            total_files,
                            current_path: path_str,
                            imported_track: None,
                            is_duplicate: false,
                            error: Some(e),
                        },
                    );
                    continue;
                }
            };

            // Cache embedded cover art (content-addressed) so the row can point at a
            // local file instead of carrying image bytes. A caching failure only
            // costs the thumbnail; it never fails the import.
            let cached_artwork = meta.artwork.as_ref().and_then(|artwork| {
                match cache_artwork(artwork, &artwork_dir) {
                    Ok(cached) => Some(cached),
                    Err(err) => {
                        log::warn!("Failed to cache artwork for {}: {}", path_str, err);
                        None
                    }
                }
            });
            let artwork_hash = cached_artwork.as_ref().map(|a| a.hash.clone());
            let artwork_path = cached_artwork
                .as_ref()
                .map(|a| a.path.to_string_lossy().to_string());
            let artwork_mime = cached_artwork.as_ref().map(|a| a.mime_type.clone());

            // Insert into SQLite
            let track_id = Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();
            // The summary row carries no file size (that column is detail-only),
            // so derive the kbps value here: bytes * 8 / milliseconds.
            let bitrate_kbps = (meta.file_size > 0 && meta.duration_ms > 0)
                .then(|| (meta.file_size as f64 * 8.0 / meta.duration_ms as f64).round() as i64);

            let summary = TrackSummary {
                id: track_id.clone(),
                file_path: path_str.clone(),
                file_hash: hash.clone(),
                title: meta.title.clone(),
                artist: meta.artist.clone(),
                album: meta.album.clone(),
                genre: meta.genre.clone(),
                // Read from TPUB / Vorbis LABEL; the user can override it later.
                label: meta.label.clone(),
                year: meta.year.map(|year| year as i64),
                bpm: meta.bpm,
                key_camelot: meta.key_camelot.clone(),
                key_classical: meta.key_classical.clone(),
                duration_ms: meta.duration_ms,
                format: Some(meta.format.clone()),
                analysis_status: "pending".to_string(),
                user_rating: meta.rating,
                // Energy is user-assigned (T2.1.6); a freshly scanned file has none.
                energy: None,
                comments: meta.comments.clone(),
                // A scanned file carries no custom tags; the user adds them
                // in the metadata editor.
                tags: Vec::new(),
                artwork_hash: artwork_hash.clone(),
                created_at: now.clone(),
                updated_at: now.clone(),
                comment_2: meta.comment_2.clone(),
                composer: meta.composer.clone(),
                album_artist: meta.album_artist.clone(),
                remixer: meta.remixer.clone(),
                producer: meta.producer.clone(),
                grouping: meta.grouping.clone(),
                track_number: meta.track_number,
                disc_number: meta.disc_number,
                isrc: meta.isrc.clone(),
                catalog_number: meta.catalog_number.clone(),
                release_date: meta.release_date.clone(),
                copyright: meta.copyright.clone(),
                mood: meta.mood.clone(),
                mix_name: meta.mix_name.clone(),
                lyrics: meta.lyrics.clone(),
                bitrate_kbps,
            };

            {
                let db_guard = match db.lock() {
                    Ok(g) => g,
                    Err(_) => break,
                };
                let insert_res = db_guard.conn().execute(
                    "INSERT INTO tracks (
                        id, workspace_id, file_path, file_hash, file_size,
                        duration_ms, format, title, artist, album, genre, year,
                        bpm, key_camelot, key_classical, user_rating, comments,
                        artwork_hash, artwork_path, artwork_mime,
                        analysis_status, created_at, updated_at, label, comment_2,
                        composer, album_artist, remixer, producer, grouping,
                        track_number, disc_number, isrc, catalog_number, release_date,
                        copyright, mood, mix_name, lyrics, bitrate_kbps, label_user_set
                    ) VALUES (?, 'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
                    rusqlite::params![
                        track_id,
                        path_str,
                        hash,
                        meta.file_size,
                        meta.duration_ms,
                        meta.format,
                        meta.title,
                        meta.artist,
                        meta.album,
                        meta.genre,
                        meta.year,
                        meta.bpm,
                        meta.key_camelot,
                        meta.key_classical,
                        meta.rating,
                        meta.comments,
                        artwork_hash,
                        artwork_path,
                        artwork_mime,
                        now,
                        now,
                        meta.label,
                        meta.comment_2,
                        meta.composer,
                        meta.album_artist,
                        meta.remixer,
                        meta.producer,
                        meta.grouping,
                        meta.track_number,
                        meta.disc_number,
                        meta.isrc,
                        meta.catalog_number,
                        meta.release_date,
                        meta.copyright,
                        meta.mood,
                        meta.mix_name,
                        meta.lyrics,
                        bitrate_kbps,
                    ],
                );

                if let Err(e) = insert_res {
                    total_errors += 1;
                    dedup.release(&hash);
                    let _ = app.emit(
                        "scan:progress",
                        ScanProgressEvent {
                            job_id: job_id.clone(),
                            scanned_files,
                            total_files,
                            current_path: path_str,
                            imported_track: None,
                            is_duplicate: false,
                            error: Some(format!("Database insert error: {}", e)),
                        },
                    );
                    continue;
                }
            }

            total_imported += 1;
            let _ = app.emit(
                "scan:progress",
                ScanProgressEvent {
                    job_id: job_id.clone(),
                    scanned_files,
                    total_files,
                    current_path: path_str,
                    imported_track: Some(summary),
                    is_duplicate: false,
                    error: None,
                },
            );
        }

        // Emit scan:completed event
        let duration_ms = start_time.elapsed().as_millis();
        let _ = app.emit(
            "scan:completed",
            ScanCompletedEvent {
                job_id,
                total_scanned: scanned_files,
                total_imported,
                total_duplicates,
                total_errors,
                duration_ms,
            },
        );
    });
}

/// The workspace a scan imports into (the scanner's INSERT uses the same id).
const SCAN_WORKSPACE: &str = "default";

/// Handles a scanned file whose fingerprint already belongs to a library row.
///
/// * The row's own file (a rescan): nothing to do.
/// * The row's file is gone: the file was moved or renamed, so the row is
///   re-pointed to `path` — a rescan is how a relocated library recovers.
/// * Both files exist: `path` is recorded as a copy for the Duplicates review,
///   but only after the bytes match in full, since the fingerprint covers the
///   length and first MiB only. A path already recorded against the same
///   track and fingerprint is not compared again, so rescans stay cheap.
///
/// The full comparison runs with the database lock released.
fn record_duplicate_copy(db: &Mutex<Database>, hash: &str, path: &str) -> Result<(), String> {
    use rusqlite::OptionalExtension;
    let lock = || db.lock().map_err(|_| "database lock poisoned".to_string());
    let owner: Option<(String, String)> = lock()?
        .conn()
        .query_row(
            TRACK_BY_HASH_SQL,
            rusqlite::params![SCAN_WORKSPACE, hash],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let Some((track_id, owner_path)) = owner else {
        return Ok(());
    };
    if !is_distinct_copy(&owner_path, path) {
        return Ok(());
    }
    if !std::path::Path::new(&owner_path).exists() {
        let now = chrono::Utc::now().to_rfc3339();
        lock()?
            .conn()
            .execute(RELOCATE_TRACK_SQL, rusqlite::params![path, now, track_id])
            .map_err(|e| e.to_string())?;
        log::info!("Track {} moved: {} -> {}", track_id, owner_path, path);
        return Ok(());
    }
    let already_recorded: bool = lock()?
        .conn()
        .query_row(
            COPY_IS_RECORDED_SQL,
            rusqlite::params![path, track_id, hash],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if already_recorded {
        return Ok(());
    }
    if !files_have_same_content(&owner_path, path).map_err(|e| e.to_string())? {
        log::info!(
            "{} shares a fingerprint with {} but not its bytes; not recorded as a copy",
            path,
            owner_path
        );
        return Ok(());
    }
    lock()?
        .conn()
        .execute(RECORD_COPY_SQL, rusqlite::params![path, track_id, hash])
        .map_err(|e| e.to_string())?;
    Ok(())
}
