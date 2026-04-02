use crate::commands::{
    get_contribution_graph, get_stats, rebuild_aggregates, sync_claude_code, sync_opencode,
    sync_roo_code, AppState,
};
use crate::database::Database;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;

mod commands;
mod database;
mod parsers {
    pub mod claude;
    pub mod opencode;
    pub mod roo;
}

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            let app_dir = dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("token-tracker");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("token-tracker.db");

            let db = match Database::new(db_path.to_str().unwrap()) {
                Ok(db) => db,
                Err(e) => {
                    eprintln!("Failed to initialize database: {}", e);
                    std::process::exit(1);
                }
            };

            _app.manage(AppState {
                db: Arc::new(Mutex::new(db)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_stats,
            get_contribution_graph,
            sync_claude_code,
            sync_opencode,
            sync_roo_code,
            rebuild_aggregates
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
