pub mod analysis;
pub mod charts;
pub mod commands;
pub mod db;
pub mod enrichment;
pub mod models;
pub mod scanner;
pub mod security;
pub mod streaming;

use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::Manager;

/// Use a nonempty override as supplied, otherwise `dj_assistant.db` under
/// `app_data_dir`. Relative overrides stay relative to the working directory;
/// this does not validate the path or create its parent directories.
fn resolve_database_path(app_data_dir: &Path, override_path: Option<&OsStr>) -> PathBuf {
    match override_path {
        Some(path) if !path.is_empty() => PathBuf::from(path),
        _ => app_data_dir.join("dj_assistant.db"),
    }
}

/// Run the desktop app with its SQLite database, applying pending migrations.
/// A nonempty `DJ_ASSISTANT_DB_PATH` overrides the default app-data database.
/// If the app-data directory cannot be resolved, the default is `./dj_assistant.db`.
///
/// # Panics
///
/// Panics if database initialization or the Tauri application run fails.
pub fn run() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle();
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            std::fs::create_dir_all(&app_data_dir).ok();
            let db_override =
                std::env::var_os("DJ_ASSISTANT_DB_PATH").filter(|value| !value.is_empty());
            let db_path = resolve_database_path(&app_data_dir, db_override.as_deref());
            if db_override.is_some() {
                log::warn!(
                    "DJ_ASSISTANT_DB_PATH is set; using {} instead of the app-data database",
                    db_path.display()
                );
            }
            log::info!("Connecting to SQLite database at: {}", db_path.display());

            let database =
                db::Database::new(&db_path).expect("Failed to initialize SQLite database");
            app.manage(Arc::new(Mutex::new(database)));
            app.manage(enrichment::RateLimiter::default());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_folder,
            commands::list_tracks,
            commands::list_genres,
            commands::get_track,
            commands::get_artwork,
            commands::analyze_library,
            commands::find_similar_tracks,
            commands::track_tag_health,
            commands::store_links_for_track,
            commands::provider_status,
            commands::update_track_metadata,
            commands::set_track_rating,
            commands::undo_track_metadata,
            enrichment::enrichment_preview,
            enrichment::enrichment_apply,
            enrichment::enrichment_undo,
            streaming::provider_match_tracks,
            streaming::provider_match_set,
            streaming::provider_export_playlist,
            charts::chart_import_snapshot,
            charts::chart_list
        ])
        .run(context)
        .expect("error while running DJ Assistant desktop application");
}

#[cfg(test)]
mod tests {
    use super::resolve_database_path;
    use std::ffi::OsStr;
    use std::path::{Path, PathBuf};

    #[test]
    fn database_path_prefers_the_environment_override() {
        let resolved =
            resolve_database_path(Path::new("app-data"), Some(OsStr::new("qa/fixture.db")));
        assert_eq!(resolved, PathBuf::from("qa/fixture.db"));
    }

    #[test]
    fn database_path_falls_back_to_the_app_data_directory() {
        assert_eq!(
            resolve_database_path(Path::new("app-data"), None),
            Path::new("app-data").join("dj_assistant.db")
        );
        assert_eq!(
            resolve_database_path(Path::new("app-data"), Some(OsStr::new(""))),
            Path::new("app-data").join("dj_assistant.db")
        );
    }
}
