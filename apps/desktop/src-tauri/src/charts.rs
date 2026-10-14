//! Chart snapshots Tier 1 (TD.3): versioned Beatport Top 100 / Hype data with
//! local taste filtering.
//!
//! Beatport/Traxsource/Juno expose no stable public catalog API, so charts
//! enter as imported snapshot data (JSON the DJ provides or curates) — never
//! as live calls. `chart_list` answers the two DJ questions locally: "do I
//! already own this?" (ISRC join against the library) and "does it mix with
//! my track?" (BPM/key taste score reusing the core similarity math).

use std::sync::Mutex;

use tauri::State;

use crate::db::Database;
use crate::models::{
    ChartEntry, ChartImportRequest, ChartImportResponse, ChartListRequest, ChartListResponse,
};

fn valid_chart(chart: &str) -> bool {
    matches!(
        chart.trim().to_ascii_lowercase().as_str(),
        "top100" | "hype"
    )
}

fn valid_date(date: &str) -> bool {
    let date = date.trim();
    date.len() == 10
        && date.as_bytes()[4] == b'-'
        && date.as_bytes()[7] == b'-'
        && date.bytes().enumerate().all(|(i, b)| {
            if i == 4 || i == 7 {
                true
            } else {
                b.is_ascii_digit()
            }
        })
}

/// Imports one chart snapshot, replacing the same
/// (provider, chart, genre, date) by default so re-imports never duplicate.
#[tauri::command]
pub async fn chart_import_snapshot(
    db: State<'_, std::sync::Arc<Mutex<Database>>>,
    request: ChartImportRequest,
) -> Result<ChartImportResponse, String> {
    let provider = request.provider.trim().to_ascii_lowercase();
    let chart = request.chart.trim().to_ascii_lowercase();
    let genre = request.genre.trim().to_string();
    let date = request.snapshot_date.trim().to_string();
    if provider.is_empty() || genre.is_empty() {
        return Err("provider and genre are required".to_string());
    }
    if !valid_chart(&chart) {
        return Err(format!(
            "unsupported chart: {} (supported: top100, hype)",
            request.chart
        ));
    }
    if !valid_date(&date) {
        return Err(format!(
            "snapshot_date must be YYYY-MM-DD, got {}",
            request.snapshot_date
        ));
    }
    if request.entries.is_empty() {
        return Err("entries cannot be empty".to_string());
    }

    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();
    if request.replace_existing.unwrap_or(true) {
        conn.execute(
            "DELETE FROM chart_snapshots WHERE provider = ?1 AND chart = ?2 AND genre = ?3 AND snapshot_date = ?4",
            rusqlite::params![provider, chart, genre, date],
        )
        .map_err(|e| e.to_string())?;
    }
    let mut imported = 0usize;
    let mut skipped = 0usize;
    for entry in &request.entries {
        let title = entry.title.trim();
        let artist = entry.artist.trim();
        if title.is_empty() || artist.is_empty() || !(1..=100).contains(&entry.position) {
            skipped += 1;
            continue;
        }
        let isrc = entry
            .isrc
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_ascii_uppercase());
        conn.execute(
            "INSERT INTO chart_snapshots
             (id, provider, chart, genre, snapshot_date, position,
              title, artist, label, isrc, bpm, key_camelot, artwork_url, source_url)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
             ON CONFLICT (provider, chart, genre, snapshot_date, position)
             DO UPDATE SET title = excluded.title, artist = excluded.artist,
               label = excluded.label, isrc = excluded.isrc, bpm = excluded.bpm,
               key_camelot = excluded.key_camelot, artwork_url = excluded.artwork_url,
               source_url = excluded.source_url",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                provider,
                chart,
                genre,
                date,
                entry.position,
                title,
                artist,
                entry.label,
                isrc,
                entry.bpm,
                entry.key_camelot,
                entry.artwork_url,
                entry.source_url,
            ],
        )
        .map_err(|e| e.to_string())?;
        imported += 1;
    }

    Ok(ChartImportResponse {
        provider,
        chart,
        genre,
        snapshot_date: date,
        imported,
        skipped,
    })
}

/// Taste score of a chart entry against a seed track: 60% tempo, 40% key,
/// reusing the core similarity curves. `None` when either side lacks data.
fn taste_score(
    seed_bpm: Option<f64>,
    seed_key: Option<&str>,
    entry_bpm: Option<f64>,
    entry_key: Option<&str>,
) -> Option<f64> {
    let bpm = dj_assistant_core::bpm_similarity(seed_bpm, entry_bpm)?;
    let key = match (seed_key, entry_key) {
        (Some(a), Some(b)) => {
            let dist = dj_assistant_core::camelot_distance(a, b)? as f64;
            (1.0 - dist / 6.0).clamp(0.0, 1.0)
        }
        _ => return Some(bpm),
    };
    Some(0.6 * bpm + 0.4 * key)
}

/// Lists a snapshot with per-entry ownership and optional taste scores.
///
/// Ownership is ISRC-exact against the library today (fuzzy ownership is a
/// follow-up); taste needs a `seed_track_id` with BPM/key data.
#[tauri::command]
pub async fn chart_list(
    db: State<'_, std::sync::Arc<Mutex<Database>>>,
    request: ChartListRequest,
) -> Result<ChartListResponse, String> {
    let provider = request
        .provider
        .as_deref()
        .unwrap_or("beatport")
        .trim()
        .to_ascii_lowercase();
    let chart = request
        .chart
        .as_deref()
        .unwrap_or("top100")
        .trim()
        .to_ascii_lowercase();
    let genre = request
        .genre
        .as_deref()
        .unwrap_or("techno")
        .trim()
        .to_string();
    if !valid_chart(&chart) {
        return Err(format!(
            "unsupported chart: {} (supported: top100, hype)",
            request.chart.as_deref().unwrap_or("")
        ));
    }
    let limit = request.limit.unwrap_or(100).clamp(1, 100);

    let db_guard = db.lock().map_err(|e| e.to_string())?;
    let conn = db_guard.conn();

    let snapshot_date: String = match request.snapshot_date.as_deref() {
        Some(date) if valid_date(date) => date.trim().to_string(),
        _ => conn
            .query_row(
                "SELECT MAX(snapshot_date) FROM chart_snapshots
                 WHERE provider = ?1 AND chart = ?2 AND genre = ?3",
                rusqlite::params![provider, chart, genre],
                |row| row.get::<_, Option<String>>(0),
            )
            .map_err(|e| e.to_string())?
            .ok_or_else(|| {
                format!("no {provider} {chart} snapshot for genre {genre} — import one first")
            })?,
    };

    // Seed features for the taste score (missing seed = no scores, not an error).
    let seed: Option<(Option<f64>, Option<String>)> =
        request.seed_track_id.as_deref().and_then(|id| {
            conn.query_row(
                "SELECT bpm, key_camelot FROM tracks WHERE id = ?1",
                [id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok()
        });

    // ISRCs owned by the library (upper-cased at import/enrichment time).
    let owned_isrcs: std::collections::HashSet<String> = {
        let mut stmt = conn
            .prepare("SELECT UPPER(isrc) FROM tracks WHERE isrc IS NOT NULL")
            .map_err(|e| e.to_string())?;
        let owned: std::collections::HashSet<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .flatten()
            .collect();
        owned
    };

    struct ChartRow {
        position: i64,
        title: String,
        artist: String,
        label: Option<String>,
        isrc: Option<String>,
        bpm: Option<f64>,
        key: Option<String>,
        artwork_url: Option<String>,
        source_url: Option<String>,
    }
    let mut stmt = conn
        .prepare(
            "SELECT position, title, artist, label, isrc, bpm, key_camelot,
                    artwork_url, source_url
             FROM chart_snapshots
             WHERE provider = ?1 AND chart = ?2 AND genre = ?3 AND snapshot_date = ?4
             ORDER BY position ASC LIMIT ?5",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<ChartRow> = stmt
        .query_map(
            rusqlite::params![provider, chart, genre, snapshot_date, limit],
            |row| {
                Ok(ChartRow {
                    position: row.get(0)?,
                    title: row.get(1)?,
                    artist: row.get(2)?,
                    label: row.get(3)?,
                    isrc: row.get(4)?,
                    bpm: row.get(5)?,
                    key: row.get(6)?,
                    artwork_url: row.get(7)?,
                    source_url: row.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    let mut entries = Vec::new();
    for row in rows {
        let owned = row
            .isrc
            .as_deref()
            .map(|s| owned_isrcs.contains(&s.to_ascii_uppercase()))
            .unwrap_or(false);
        let taste = seed.as_ref().and_then(|(seed_bpm, seed_key)| {
            taste_score(*seed_bpm, seed_key.as_deref(), row.bpm, row.key.as_deref())
        });
        entries.push(ChartEntry {
            position: row.position,
            title: row.title,
            artist: row.artist,
            label: row.label,
            isrc: row.isrc,
            bpm: row.bpm,
            key_camelot: row.key,
            artwork_url: row.artwork_url,
            source_url: row.source_url,
            owned,
            taste_score: taste,
        });
    }
    let total = entries.len();

    Ok(ChartListResponse {
        provider,
        chart,
        genre,
        snapshot_date,
        entries,
        total,
    })
}
