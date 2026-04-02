use crate::database::Database;
use crate::parsers::claude::ClaudeParser;
use crate::parsers::opencode::OpenCodeParser;
use crate::parsers::roo::RooParser;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;

pub struct AppState {
    pub db: Arc<Mutex<Database>>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsResponse {
    pub total_input: i64,
    pub total_output: i64,
    pub total_cache_read: i64,
    pub total_cache_write: i64,
    pub total_tokens: i64,
    pub session_count: i64,
    pub by_ide: HashMap<String, IdeStats>,
    pub by_model: HashMap<String, ModelStats>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdeStats {
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_write_tokens: i64,
    pub session_count: i64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStats {
    pub model: String,
    pub ide: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub total: i64,
}

#[derive(serde::Serialize)]
pub struct ContributionGraphResponse {
    pub data: Vec<ContributionDay>,
}

#[derive(serde::Serialize)]
pub struct ContributionDay {
    pub date: String,
    pub count: i64,
    pub level: i32,
}

#[tauri::command]
pub fn get_stats(
    state: State<AppState>,
    start_ts: i64,
    end_ts: i64,
    ide_filter: Option<String>,
) -> Result<StatsResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let events = db
        .get_stats_for_range(start_ts, end_ts, ide_filter.as_deref())
        .map_err(|e: rusqlite::Error| e.to_string())?;

    let mut total_input = 0i64;
    let mut total_output = 0i64;
    let mut total_cache_read = 0i64;
    let mut total_cache_write = 0i64;
    let mut by_ide: HashMap<String, IdeStats> = HashMap::new();
    let mut by_model: HashMap<String, ModelStats> = HashMap::new();
    let mut session_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

    for event in &events {
        total_input += event.input_tokens;
        total_output += event.output_tokens;
        total_cache_read += event.cache_read_tokens;
        total_cache_write += event.cache_write_tokens;

        if let Some(ref sid) = event.session_id {
            session_ids.insert(sid.clone());
        }

        let ide_entry = by_ide.entry(event.ide.clone()).or_insert_with(|| IdeStats {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            session_count: 0,
        });
        ide_entry.input_tokens += event.input_tokens;
        ide_entry.output_tokens += event.output_tokens;
        ide_entry.cache_read_tokens += event.cache_read_tokens;
        ide_entry.cache_write_tokens += event.cache_write_tokens;

        if let Some(ref model) = event.model {
            let model_key = format!("{}:{}", event.ide, model);
            let model_entry = by_model.entry(model_key).or_insert_with(|| ModelStats {
                model: model.clone(),
                ide: event.ide.clone(),
                input_tokens: 0,
                output_tokens: 0,
                total: 0,
            });
            model_entry.input_tokens += event.input_tokens;
            model_entry.output_tokens += event.output_tokens;
            model_entry.total += event.input_tokens + event.output_tokens;
        }
    }

    let ide_keys: Vec<String> = by_ide.keys().cloned().collect();
    for ide in ide_keys {
        let count = events
            .iter()
            .filter(|e| e.ide == ide && e.session_id.is_some())
            .map(|e| e.session_id.clone().unwrap())
            .collect::<std::collections::HashSet<_>>()
            .len() as i64;
        by_ide.get_mut(&ide).unwrap().session_count = count;
    }

    Ok(StatsResponse {
        total_input,
        total_output,
        total_cache_read,
        total_cache_write,
        total_tokens: total_input + total_output + total_cache_read + total_cache_write,
        session_count: session_ids.len() as i64,
        by_ide,
        by_model,
    })
}

#[tauri::command]
pub fn get_contribution_graph(
    state: State<AppState>,
    start_date: String,
    end_date: String,
    ide_filter: Option<String>,
) -> Result<ContributionGraphResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let daily_stats = db
        .get_daily_stats(&start_date, &end_date, ide_filter.as_deref())
        .map_err(|e: rusqlite::Error| e.to_string())?;

    let max_count = daily_stats
        .iter()
        .map(|s| s.total_input + s.total_output)
        .max()
        .unwrap_or(0);

    let data: Vec<ContributionDay> = daily_stats
        .into_iter()
        .map(|s| {
            let count = s.total_input + s.total_output;
            let level = if count == 0 {
                0
            } else {
                let threshold = (max_count as f64 / 4.0).max(1.0);
                ((count as f64 / threshold).ceil() as i32).min(4)
            };

            ContributionDay {
                date: s.date,
                count,
                level,
            }
        })
        .collect();

    Ok(ContributionGraphResponse { data })
}

#[tauri::command]
pub fn sync_claude_code(state: State<AppState>) -> Result<SyncResult, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let projects_dir = home_dir.join(".claude/projects");

    if !projects_dir.exists() {
        return Ok(SyncResult {
            processed: 0,
            skipped: 0,
            errors: vec!["Claude Code projects directory not found".to_string()],
        });
    }

    let mut total_processed = 0usize;
    let mut total_skipped = 0usize;
    let mut errors = Vec::new();

    for entry in std::fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            for file_entry in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
                let file_entry = file_entry.map_err(|e| e.to_string())?;
                let file_path = file_entry.path();

                if file_path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                    let source_path = file_path.to_string_lossy().to_string();

                    let checkpoint = {
                        let db = state.db.lock().map_err(|e| e.to_string())?;
                        db.get_checkpoint("claude", &source_path)
                            .map_err(|e: rusqlite::Error| e.to_string())?
                    };

                    let offset = checkpoint.map(|c| c.last_offset as u64);

                    match ClaudeParser::parse_file(&file_path, offset) {
                        Ok(result) => {
                            for event in result.events {
                                let inserted = {
                                    let db = state.db.lock().map_err(|e| e.to_string())?;
                                    db.insert_or_ignore_event(&event)
                                        .map_err(|e: rusqlite::Error| e.to_string())?
                                };

                                if inserted {
                                    total_processed += 1;
                                } else {
                                    total_skipped += 1;
                                }
                            }

                            let modified = std::fs::metadata(&file_path)
                                .and_then(|m| m.modified())
                                .ok()
                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|d| d.as_secs() as i64)
                                .unwrap_or(0);

                            {
                                let db = state.db.lock().map_err(|e| e.to_string())?;
                                db.update_checkpoint(
                                    "claude",
                                    &source_path,
                                    result.last_offset as i64,
                                    modified,
                                )
                                .map_err(|e: rusqlite::Error| e.to_string())?;
                            }
                        }
                        Err(e) => {
                            errors.push(format!("Parse error for {}: {}", source_path, e));
                        }
                    }
                }
            }
        }
    }

    Ok(SyncResult {
        processed: total_processed,
        skipped: total_skipped,
        errors,
    })
}

#[tauri::command]
pub fn sync_opencode(state: State<AppState>) -> Result<SyncResult, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let db_path = home_dir.join(".local/share/opencode/opencode.db");

    if !db_path.exists() {
        let legacy_dir = home_dir.join(".local/share/opencode/storage/message");
        if legacy_dir.exists() {
            match OpenCodeParser::query_legacy_storage(&legacy_dir) {
                Ok(events) => {
                    let mut processed = 0usize;
                    let mut skipped = 0usize;

                    for event in &events {
                        let inserted = {
                            let db = state.db.lock().map_err(|e| e.to_string())?;
                            db.insert_or_ignore_event(&event)
                                .map_err(|e: rusqlite::Error| e.to_string())?
                        };

                        if inserted {
                            processed += 1;
                        } else {
                            skipped += 1;
                        }
                    }

                    return Ok(SyncResult {
                        processed,
                        skipped,
                        errors: vec!["Used legacy storage format".to_string()],
                    });
                }
                Err(e) => {
                    return Err(format!("Legacy parse error: {}", e));
                }
            }
        }

        return Ok(SyncResult {
            processed: 0,
            skipped: 0,
            errors: vec!["OpenCode database not found".to_string()],
        });
    }

    let checkpoint = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.get_checkpoint("opencode", &db_path.to_string_lossy())
            .map_err(|e: rusqlite::Error| e.to_string())?
    };

    let since_timestamp = checkpoint.map(|c| c.last_modified);

    match OpenCodeParser::parse_database(&db_path, since_timestamp) {
        Ok(result) => {
            let mut processed = 0usize;
            let mut skipped = 0usize;

            for event in result.events {
                let inserted = {
                    let db = state.db.lock().map_err(|e| e.to_string())?;
                    db.insert_or_ignore_event(&event)
                        .map_err(|e: rusqlite::Error| e.to_string())?
                };

                if inserted {
                    processed += 1;
                } else {
                    skipped += 1;
                }
            }

            {
                let db = state.db.lock().map_err(|e| e.to_string())?;
                db.update_checkpoint(
                    "opencode",
                    &db_path.to_string_lossy(),
                    result.db_modified,
                    result.db_modified,
                )
                .map_err(|e: rusqlite::Error| e.to_string())?;
            }

            Ok(SyncResult {
                processed,
                skipped,
                errors: vec![],
            })
        }
        Err(e) => Err(format!("OpenCode sync error: {}", e)),
    }
}

#[tauri::command]
pub fn sync_roo_code(state: State<AppState>) -> Result<SyncResult, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let tasks_dir =
        home_dir.join(".config/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks");

    if !tasks_dir.exists() {
        let server_dir = home_dir
            .join(".vscode-server/data/User/globalStorage/rooveterinaryinc.roo-cline/tasks");
        if server_dir.exists() {
            return sync_roo_from_dir(&state, &server_dir);
        }

        return Ok(SyncResult {
            processed: 0,
            skipped: 0,
            errors: vec!["Roo Code tasks directory not found".to_string()],
        });
    }

    sync_roo_from_dir(&state, &tasks_dir)
}

fn sync_roo_from_dir(state: &State<AppState>, tasks_dir: &PathBuf) -> Result<SyncResult, String> {
    match RooParser::scan_tasks_directory(tasks_dir) {
        Ok(result) => {
            let mut processed = 0usize;
            let mut skipped = 0usize;

            for event in result.events {
                let inserted = {
                    let db = state.db.lock().map_err(|e| e.to_string())?;
                    db.insert_or_ignore_event(&event)
                        .map_err(|e: rusqlite::Error| e.to_string())?
                };

                if inserted {
                    processed += 1;
                } else {
                    skipped += 1;
                }
            }

            Ok(SyncResult {
                processed,
                skipped,
                errors: vec![],
            })
        }
        Err(e) => Err(format!("Roo Code sync error: {}", e)),
    }
}

#[tauri::command]
pub fn rebuild_aggregates(state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.rebuild_aggregates()
        .map_err(|e: rusqlite::Error| e.to_string())?;
    Ok(())
}

#[derive(serde::Serialize)]
pub struct SyncResult {
    pub processed: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}
