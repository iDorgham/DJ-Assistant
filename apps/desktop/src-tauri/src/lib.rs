pub mod commands;
pub mod db;
pub mod models;
pub mod scanner;
pub mod security;

use std::sync::{Arc, Mutex};
use tauri::Manager;

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
            let db_path = app_data_dir.join("dj_assistant.db");
            log::info!("Connecting to SQLite database at: {}", db_path.display());

            let database =
                db::Database::new(&db_path).expect("Failed to initialize SQLite database");
            app.manage(Arc::new(Mutex::new(database)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_folder,
            commands::list_tracks,
            commands::get_track,
            commands::get_artwork
        ])
        .run(context)
        .expect("error while running DJ Assistant desktop application");
}
