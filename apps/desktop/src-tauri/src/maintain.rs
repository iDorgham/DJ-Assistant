//! Library › Maintain reads and the two small duplicate-review writes:
//! duplicates (T2.3.1), versions (T2.3.2) and the Library Health Score
//! (T2.3.3).
//!
//! The rules live in `dj-assistant-core` (`duplicates`, `versions`,
//! `library_health`, `library_hygiene`) and are tested there and in
//! `tests/schema`; this module only runs the SQL and shapes the IPC payload.
//! Nothing here deletes a file or a track row: "keep this one" is the existing
//! undoable soft remove, called by the renderer.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use tauri::State;

use dj_assistant_core::duplicates::{
    find_duplicate_groups, DuplicateGroup, DEFAULT_DURATION_TOLERANCE_MS,
};
use dj_assistant_core::library_health::{compute_health, FileState, HealthContext};
use dj_assistant_core::library_hygiene::{
    HygieneRow, DISMISSED_KEYS_SQL, DISMISS_GROUP_SQL, DUPLICATE_COPIES_SQL, FORGET_COPY_SQL,
    HYGIENE_TRACKS_SQL,
};
use dj_assistant_core::versions::group_versions;

use crate::db::Database;
use crate::models::{
    DismissDuplicateGroupRequest, DuplicateCopyView, DuplicateGroupView,
    ForgetDuplicateCopyRequest, HealthCategoryView, HealthCountView, LibraryDuplicatesResponse,
    LibraryHealthResponse, LibraryVersionsResponse, MaintainTrack, VersionGroupView,
    VersionMemberView,
};

/// Everything the three reads share, captured under one lock.
struct Snapshot {
    rows: Vec<HygieneRow>,
    /// `(copy_path, track_id, detected_at)`.
    copies: Vec<(String, String, String)>,
    dismissed: HashSet<String>,
}

/// Maps one [`HYGIENE_TRACKS_SQL`] row, in its column order.
fn hygiene_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<HygieneRow> {
    Ok(HygieneRow {
        id: row.get(0)?,
        title: row.get(1)?,
        artist: row.get(2)?,
        album: row.get(3)?,
        genre: row.get(4)?,
        year: row.get(5)?,
        label: row.get(6)?,
        mood: row.get(7)?,
        energy: row.get(8)?,
        bpm: row.get(9)?,
        key: row.get(10)?,
        analysis_status: row.get(11)?,
        isrc: row.get(12)?,
        mix_name: row.get(13)?,
        duration_ms: row.get(14)?,
        format: row.get(15)?,
        bitrate_kbps: row.get(16)?,
        file_path: row.get(17)?,
        has_tags: row.get(18)?,
        beatgrid_confidence: row.get(19)?,
    })
}

/// Runs a parameterless read and collects every mapped row, failing on the
/// first row that does not map instead of dropping it.
fn read_all<T, C: FromIterator<T>>(
    conn: &rusqlite::Connection,
    sql: &str,
    map: impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>,
) -> Result<C, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], map).map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<C>>()
        .map_err(|e| e.to_string())
}

fn read_snapshot(conn: &rusqlite::Connection) -> Result<Snapshot, String> {
    Ok(Snapshot {
        rows: read_all(conn, HYGIENE_TRACKS_SQL, hygiene_row)?,
        copies: read_all(conn, DUPLICATE_COPIES_SQL, |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?,
        dismissed: read_all(conn, DISMISSED_KEYS_SQL, |row| row.get::<_, String>(0))?,
    })
}

fn snapshot(db: &Mutex<Database>) -> Result<Snapshot, String> {
    let guard = db.lock().map_err(|e| e.to_string())?;
    read_snapshot(guard.conn())
}

fn track_view(row: &HygieneRow) -> MaintainTrack {
    MaintainTrack {
        id: row.id.clone(),
        title: row.title.clone(),
        artist: row.artist.clone(),
        album: row.album.clone(),
        duration_ms: row.duration_ms,
        format: row.format.clone(),
        bitrate_kbps: row.bitrate_kbps,
        file_path: row.file_path.clone(),
        isrc: row.isrc.clone(),
    }
}

/// Open (not dismissed) duplicate groups over the snapshot's rows.
fn open_groups(snapshot: &Snapshot) -> (Vec<DuplicateGroup>, usize) {
    let inputs: Vec<_> = snapshot
        .rows
        .iter()
        .map(HygieneRow::duplicate_input)
        .collect();
    let all = find_duplicate_groups(&inputs, DEFAULT_DURATION_TOLERANCE_MS);
    let total = all.len();
    let open: Vec<DuplicateGroup> = all
        .into_iter()
        .filter(|g| !snapshot.dismissed.contains(&g.key))
        .collect();
    let dismissed = total - open.len();
    (open, dismissed)
}

#[tauri::command]
pub async fn library_duplicates(
    db: State<'_, Arc<Mutex<Database>>>,
) -> Result<LibraryDuplicatesResponse, String> {
    let snapshot = snapshot(&db)?;
    let by_id: HashMap<&str, &HygieneRow> =
        snapshot.rows.iter().map(|r| (r.id.as_str(), r)).collect();
    let (groups, dismissed_count) = open_groups(&snapshot);

    let groups = groups
        .into_iter()
        .map(|group| DuplicateGroupView {
            key: group.key,
            reason: group.reason.as_str().to_string(),
            tracks: group
                .track_ids
                .iter()
                .filter_map(|id| by_id.get(id.as_str()).map(|r| track_view(r)))
                .collect(),
        })
        .filter(|g| g.tracks.len() > 1)
        .collect();

    let copies = snapshot
        .copies
        .iter()
        .filter_map(|(path, track_id, detected_at)| {
            by_id.get(track_id.as_str()).map(|row| DuplicateCopyView {
                copy_path: path.clone(),
                detected_at: detected_at.clone(),
                track: track_view(row),
            })
        })
        .collect();

    Ok(LibraryDuplicatesResponse {
        groups,
        copies,
        dismissed_count,
    })
}

#[tauri::command]
pub async fn dismiss_duplicate_group(
    db: State<'_, Arc<Mutex<Database>>>,
    request: DismissDuplicateGroupRequest,
) -> Result<(), String> {
    let key = request.key.trim();
    if key.is_empty() {
        return Err("a duplicate group key is required".to_string());
    }
    let guard = db.lock().map_err(|e| e.to_string())?;
    guard
        .conn()
        .execute(DISMISS_GROUP_SQL, [key])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn forget_duplicate_copy(
    db: State<'_, Arc<Mutex<Database>>>,
    request: ForgetDuplicateCopyRequest,
) -> Result<bool, String> {
    let guard = db.lock().map_err(|e| e.to_string())?;
    let changed = guard
        .conn()
        .execute(FORGET_COPY_SQL, [request.path.as_str()])
        .map_err(|e| e.to_string())?;
    Ok(changed > 0)
}

#[tauri::command]
pub async fn library_versions(
    db: State<'_, Arc<Mutex<Database>>>,
) -> Result<LibraryVersionsResponse, String> {
    let snapshot = snapshot(&db)?;
    let by_id: HashMap<&str, &HygieneRow> =
        snapshot.rows.iter().map(|r| (r.id.as_str(), r)).collect();
    let inputs: Vec<_> = snapshot
        .rows
        .iter()
        .map(HygieneRow::version_input)
        .collect();
    let groups = group_versions(&inputs)
        .into_iter()
        .map(|group| VersionGroupView {
            key: group.key,
            artist: group.artist,
            base_title: group.base_title,
            members: group
                .members
                .into_iter()
                .filter_map(|member| {
                    by_id.get(member.id.as_str()).map(|row| VersionMemberView {
                        track: track_view(row),
                        kind: member.kind.as_str().to_string(),
                        label: member.label,
                    })
                })
                .collect(),
        })
        .collect();
    Ok(LibraryVersionsResponse { groups })
}

#[tauri::command]
pub async fn library_health(
    db: State<'_, Arc<Mutex<Database>>>,
) -> Result<LibraryHealthResponse, String> {
    // The snapshot and the disk walk run on a blocking thread, so checking
    // 30,000 paths ties up neither an async runtime worker nor — the lock is
    // released after the snapshot — every other command.
    let db = Arc::clone(&db);
    tauri::async_runtime::spawn_blocking(move || health_report(&db))
        .await
        .map_err(|e| format!("health check failed: {e}"))?
}

/// Opens a path for the file check without ever blocking: on Unix, opening a
/// named pipe with no writer blocks unless `O_NONBLOCK` is set, and the path
/// can turn into a pipe between any earlier check and the open.
fn open_for_check(path: &str) -> std::io::Result<std::fs::File> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        std::fs::OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_NONBLOCK)
            .open(path)
    }
    #[cfg(not(unix))]
    {
        std::fs::File::open(path)
    }
}

/// What a track's file looks like on disk, without decoding any audio. The
/// type is read from the opened descriptor, so what is checked is what was
/// opened.
fn file_state(path: &str) -> FileState {
    match open_for_check(path) {
        Ok(file) => match file.metadata() {
            // A directory or pipe at a track path is not an audio file.
            Ok(meta) if meta.is_file() && meta.len() > 0 => FileState::Present,
            _ => FileState::Unreadable,
        },
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => FileState::Missing,
        Err(_) => FileState::Unreadable,
    }
}

/// Whether a recorded copy's file is confirmed gone. Any other error (a
/// permission problem, an unplugged drive's odd error) keeps it counted.
fn copy_is_gone(path: &str) -> bool {
    matches!(std::fs::metadata(path), Err(err) if err.kind() == std::io::ErrorKind::NotFound)
}

fn health_report(db: &Mutex<Database>) -> Result<LibraryHealthResponse, String> {
    let snapshot = snapshot(db)?;
    let (groups, _) = open_groups(&snapshot);

    let mut duplicate_ids: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut extras: u64 = 0;
    for group in &groups {
        extras += group.track_ids.len().saturating_sub(1) as u64;
        for id in &group.track_ids {
            if seen.insert(id.clone()) {
                duplicate_ids.push(id.clone());
            }
        }
    }
    // A copy deleted outside the app no longer duplicates anything.
    for (_, track_id, _) in snapshot
        .copies
        .iter()
        .filter(|(path, _, _)| !copy_is_gone(path))
    {
        extras += 1;
        if seen.insert(track_id.clone()) {
            duplicate_ids.push(track_id.clone());
        }
    }

    let tracks: Vec<_> = snapshot
        .rows
        .iter()
        .map(|row| row.health_track(file_state(&row.file_path)))
        .collect();

    // Playlists, sync and backup are not built yet, so they stay neutral
    // (D-050): `None` rather than a made-up ratio.
    let context = HealthContext {
        duplicate_extras: extras,
        duplicate_track_ids: duplicate_ids,
        playlists: None,
        sync: None,
        backup: None,
    };
    let report = compute_health(&tracks, &context);

    let by_id: HashMap<&str, &HygieneRow> =
        snapshot.rows.iter().map(|r| (r.id.as_str(), r)).collect();
    let categories = report
        .categories
        .into_iter()
        .map(|category| HealthCategoryView {
            id: category.id.to_string(),
            label: category.label.to_string(),
            weight: category.weight,
            configured: category.configured,
            score: category.score,
            counts: category
                .counts
                .into_iter()
                .map(|c| HealthCountView {
                    label: c.label,
                    count: c.count,
                })
                .collect(),
            affected: category
                .affected_ids
                .iter()
                .filter_map(|id| by_id.get(id.as_str()).map(|r| track_view(r)))
                .collect(),
            affected_total: category.affected_total,
        })
        .collect();

    Ok(LibraryHealthResponse {
        score: report.score,
        track_count: report.track_count,
        categories,
    })
}
