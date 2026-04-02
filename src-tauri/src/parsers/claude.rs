use crate::database::TokenEvent;
use serde_json::Value;
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::Path;

pub struct ClaudeParser;

#[derive(Debug)]
#[allow(dead_code)]
pub struct ParseResult {
    pub events: Vec<TokenEvent>,
    pub last_offset: u64,
    pub session_ids: HashSet<String>,
    pub record_count: usize,
}

impl ClaudeParser {
    pub fn parse_file<P: AsRef<Path>>(
        path: P,
        checkpoint: Option<u64>,
    ) -> Result<ParseResult, Box<dyn std::error::Error>> {
        let path = path.as_ref();
        let file = File::open(path)?;
        let metadata = file.metadata()?;
        let file_size = metadata.len();

        let mut reader = BufReader::new(file);
        let start_offset = checkpoint.unwrap_or(0);

        if start_offset > 0 {
            reader.seek(SeekFrom::Start(start_offset))?;
        }

        let mut events = Vec::new();
        let mut session_ids = HashSet::new();
        let mut record_count = 0;
        let mut current_offset = start_offset;

        let source_path = path.to_string_lossy().to_string();

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };

            current_offset += line.len() as u64 + 1;

            if line.trim().is_empty() {
                continue;
            }

            let json: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(event) = Self::extract_event(&json, &source_path, current_offset) {
                if event.session_id.is_some() {
                    session_ids.insert(event.session_id.clone().unwrap());
                }
                events.push(event);
                record_count += 1;
            }
        }

        Ok(ParseResult {
            events,
            last_offset: file_size,
            session_ids,
            record_count,
        })
    }

    fn extract_event(json: &Value, source_file: &str, offset: u64) -> Option<TokenEvent> {
        let usage = json.get("usage")?;
        let input_tokens = usage.get("input_tokens")?.as_i64()?;
        let output_tokens = usage.get("output_tokens")?.as_i64()?;

        let timestamp_str = json.get("timestamp")?.as_str()?;
        let timestamp_utc = chrono::DateTime::parse_from_rfc3339(timestamp_str)
            .ok()?
            .timestamp();

        let session_id = json
            .get("sessionId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let model = json
            .get("model")
            .or_else(|| json.get("message").and_then(|m| m.get("model")))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let cache_read_tokens = usage
            .get("cache_read_tokens")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let cache_write_tokens = usage
            .get("cache_creation_tokens")
            .or_else(|| usage.get("cache_write_tokens"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        Some(TokenEvent {
            id: None,
            ide: "claude".to_string(),
            session_id,
            source_event_id: format!("{}:{}", source_file, offset),
            model,
            input_tokens,
            output_tokens,
            cache_read_tokens,
            cache_write_tokens,
            timestamp_utc,
            project_path: json
                .get("cwd")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
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
            "type": "assistant",
            "timestamp": "2024-01-15T10:30:00Z",
            "sessionId": "test-session-123",
            "model": "claude-sonnet-4-5",
            "usage": {
                "input_tokens": 1500,
                "output_tokens": 800,
                "cache_read_tokens": 2000,
                "cache_creation_tokens": 500
            }
        }"#;

        let json: Value = serde_json::from_str(json_str).unwrap();
        let event = ClaudeParser::extract_event(&json, "/test/file.jsonl", 12345);

        assert!(event.is_some());
        let event = event.unwrap();
        assert_eq!(event.ide, "claude");
        assert_eq!(event.input_tokens, 1500);
        assert_eq!(event.output_tokens, 800);
        assert_eq!(event.cache_read_tokens, 2000);
        assert_eq!(event.cache_write_tokens, 500);
        assert_eq!(event.session_id, Some("test-session-123".to_string()));
    }

    #[test]
    fn test_extract_event_missing_usage() {
        let json_str = r#"{
            "type": "user",
            "timestamp": "2024-01-15T10:30:00Z",
            "message": "Hello"
        }"#;

        let json: Value = serde_json::from_str(json_str).unwrap();
        let event = ClaudeParser::extract_event(&json, "/test/file.jsonl", 12345);

        assert!(event.is_none());
    }
}
