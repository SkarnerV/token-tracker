use crate::database::TokenEvent;
use serde_json::Value;
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

pub struct RooParser;

#[derive(Debug)]
pub struct RooParseResult {
    pub events: Vec<TokenEvent>,
    pub task_ids: HashSet<String>,
    pub record_count: usize,
}

impl RooParser {
    pub fn scan_tasks_directory<P: AsRef<Path>>(
        dir_path: P,
    ) -> Result<RooParseResult, Box<dyn std::error::Error>> {
        let dir_path = dir_path.as_ref();
        let mut all_events = Vec::new();
        let mut all_task_ids = HashSet::new();
        let mut total_count = 0;

        if !dir_path.exists() {
            return Ok(RooParseResult {
                events: all_events,
                task_ids: all_task_ids,
                record_count: total_count,
            });
        }

        // Iterate through task subdirectories
        for entry in std::fs::read_dir(dir_path)? {
            let entry = entry?;
            let task_dir = entry.path();

            if task_dir.is_dir() {
                // Look for history_item.json in each task directory
                let history_file = task_dir.join("history_item.json");
                if history_file.exists() {
                    if let Ok(event) = Self::parse_history_item(&history_file) {
                        all_task_ids.insert(event.session_id.clone().unwrap_or_default());
                        all_events.push(event);
                        total_count += 1;
                    }
                }
            }
        }

        Ok(RooParseResult {
            events: all_events,
            task_ids: all_task_ids,
            record_count: total_count,
        })
    }

    fn parse_history_item<P: AsRef<Path>>(
        path: P,
    ) -> Result<TokenEvent, Box<dyn std::error::Error>> {
        let path = path.as_ref();
        let file = File::open(path)?;
        let reader = BufReader::new(file);

        let content: String = reader.lines().collect::<Result<Vec<_>, _>>()?.join("\n");
        let json: Value = serde_json::from_str(&content)?;

        let task_id = json
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default();

        // Extract tokens from history_item.json format
        let input_tokens = json.get("tokensIn").and_then(|v| v.as_i64()).unwrap_or(0);

        let output_tokens = json.get("tokensOut").and_then(|v| v.as_i64()).unwrap_or(0);

        let cache_read_tokens = json.get("cacheReads").and_then(|v| v.as_i64()).unwrap_or(0);

        let cache_write_tokens = json
            .get("cacheWrites")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        // Skip if no tokens
        if input_tokens == 0 && output_tokens == 0 {
            return Err("No tokens in history item".into());
        }

        // Timestamp is in milliseconds
        let timestamp_ms = json
            .get("ts")
            .and_then(|v| v.as_i64())
            .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

        let project_path = json
            .get("workspace")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Mode might contain model info
        let model = json
            .get("apiConfigName")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let source_file = path.to_string_lossy().to_string();

        Ok(TokenEvent {
            id: None,
            ide: "roo".to_string(),
            session_id: Some(task_id.clone()),
            source_event_id: format!("{}:{}", source_file, task_id),
            model,
            input_tokens,
            output_tokens,
            cache_read_tokens,
            cache_write_tokens,
            timestamp_utc: timestamp_ms / 1000, // Convert ms to seconds
            project_path,
            source_file,
        })
    }

    // Legacy method kept for backwards compatibility
    #[allow(dead_code)]
    pub fn parse_task_file<P: AsRef<Path>>(
        path: P,
    ) -> Result<RooParseResult, Box<dyn std::error::Error>> {
        let path = path.as_ref();
        let file = File::open(path)?;
        let reader = BufReader::new(file);

        let content: String = reader.lines().collect::<Result<Vec<_>, _>>()?.join("\n");
        let json: Value = serde_json::from_str(&content)?;

        let mut events = Vec::new();
        let mut task_ids = HashSet::new();

        let task_id = json
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default();

        if !task_id.is_empty() {
            task_ids.insert(task_id.clone());
        }

        let source_file = path.to_string_lossy().to_string();

        if let Some(_token_usage) = json.get("tokenUsage") {
            if let Some(event) = Self::extract_event_legacy(&json, &source_file, &task_id) {
                events.push(event);
            }
        }

        let record_count = events.len();
        Ok(RooParseResult {
            events,
            task_ids,
            record_count,
        })
    }

    #[allow(dead_code)]
    fn extract_event_legacy(json: &Value, source_file: &str, task_id: &str) -> Option<TokenEvent> {
        let token_usage = json.get("tokenUsage")?;

        let input_tokens = token_usage
            .get("inputTokens")
            .or_else(|| token_usage.get("input_tokens"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let output_tokens = token_usage
            .get("outputTokens")
            .or_else(|| token_usage.get("output_tokens"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        if input_tokens == 0 && output_tokens == 0 {
            return None;
        }

        let timestamp = json
            .get("timestamp")
            .and_then(|v| v.as_i64())
            .unwrap_or_else(|| {
                json.get("createdAt")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(chrono::Utc::now().timestamp())
            });

        let model = json
            .get("model")
            .or_else(|| {
                json.get("apiConversationHistory")
                    .and_then(|h| h.get(0))
                    .and_then(|m| m.get("model"))
            })
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let project_path = json
            .get("workspace")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Some(TokenEvent {
            id: None,
            ide: "roo".to_string(),
            session_id: Some(task_id.to_string()),
            source_event_id: format!("{}:{}", source_file, task_id),
            model,
            input_tokens,
            output_tokens,
            cache_read_tokens: token_usage
                .get("cacheReadTokens")
                .or_else(|| token_usage.get("cache_read_tokens"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0),
            cache_write_tokens: token_usage
                .get("cacheWriteTokens")
                .or_else(|| token_usage.get("cache_write_tokens"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0),
            timestamp_utc: timestamp,
            project_path,
            source_file: source_file.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_event_valid() {
        let json_str = r#"{
            "id": "task-123",
            "model": "claude-sonnet-4",
            "timestamp": 1705315800,
            "tokenUsage": {
                "inputTokens": 3000,
                "outputTokens": 1500,
                "cacheReadTokens": 1000,
                "cacheWriteTokens": 500
            },
            "workspace": "/test/workspace"
        }"#;

        let json: Value = serde_json::from_str(json_str).unwrap();
        let event = RooParser::extract_event_legacy(&json, "/test/task.json", "task-123");

        assert!(event.is_some());
        let event = event.unwrap();
        assert_eq!(event.ide, "roo");
        assert_eq!(event.input_tokens, 3000);
        assert_eq!(event.output_tokens, 1500);
        assert_eq!(event.cache_read_tokens, 1000);
        assert_eq!(event.cache_write_tokens, 500);
        assert_eq!(event.session_id, Some("task-123".to_string()));
    }

    #[test]
    fn test_extract_event_zero_tokens() {
        let json_str = r#"{
            "id": "task-124",
            "tokenUsage": {
                "inputTokens": 0,
                "outputTokens": 0
            }
        }"#;

        let json: Value = serde_json::from_str(json_str).unwrap();
        let event = RooParser::extract_event_legacy(&json, "/test/task.json", "task-124");

        assert!(event.is_none());
    }
}
