use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use dj_assistant_core::{
    cache_artwork, compute_file_fingerprint, discover_audio_files, extract_metadata,
    ScanDeduplicator,
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

            let summary = TrackSummary {
                id: track_id.clone(),
                file_path: path_str.clone(),
                file_hash: hash.clone(),
                title: meta.title.clone(),
                artist: meta.artist.clone(),
                album: meta.album.clone(),
                genre: meta.genre.clone(),
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
                artwork_hash: artwork_hash.clone(),
                created_at: now.clone(),
                updated_at: now.clone(),
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
                        analysis_status, created_at, updated_at
                    ) VALUES (?, 'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
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
