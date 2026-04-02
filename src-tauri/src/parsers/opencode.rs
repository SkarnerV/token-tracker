use crate::database::TokenEvent;
use rusqlite::{Connection, OpenFlags};
use std::path::Path;

pub struct OpenCodeParser;

#[derive(Debug)]
#[allow(dead_code)]
pub struct OpenCodeEvent {
    pub events: Vec<TokenEvent>,
    pub db_modified: i64,
    pub record_count: usize,
}

impl OpenCodeParser {
    pub fn parse_database<P: AsRef<Path>>(
        db_path: P,
        since_timestamp: Option<i64>,
    ) -> Result<OpenCodeEvent, Box<dyn std::error::Error>> {
        let db_path = db_path.as_ref();

        let metadata = std::fs::metadata(db_path)?;
        let db_modified = metadata
            .modified()?
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;

        let conn = Connection::open_with_flags(
            db_path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;

        let since_clause = since_timestamp
            .map(|ts| format!("AND timestamp > {}", ts))
            .unwrap_or_default();

        let mut stmt = conn.prepare(&format!(
            "SELECT 
                session_id,
                model,
                input_tokens,
                output_tokens,
                cache_read_tokens,
                cache_creation_tokens,
                timestamp,
                project_path
             FROM interactions 
             WHERE input_tokens IS NOT NULL 
               AND output_tokens IS NOT NULL
               {}
             ORDER BY timestamp",
            since_clause
        ))?;

        let events: Vec<TokenEvent> = stmt
            .query_map([], |row| {
                let source_file = db_path.to_string_lossy().to_string();
                let offset = row.get::<_, i64>(6)?;

                Ok(TokenEvent {
                    id: None,
                    ide: "opencode".to_string(),
                    session_id: row.get(0)?,
                    source_event_id: format!("{}:{}", source_file, offset),
                    model: row.get(1)?,
                    input_tokens: row.get(2)?,
                    output_tokens: row.get(3)?,
                    cache_read_tokens: row.get::<_, Option<i64>>(4)?.unwrap_or(0),
                    cache_write_tokens: row.get::<_, Option<i64>>(5)?.unwrap_or(0),
                    timestamp_utc: row.get(6)?,
                    project_path: row.get(7)?,
                    source_file,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let record_count = events.len();

        Ok(OpenCodeEvent {
            events,
            db_modified,
            record_count,
        })
    }

    pub fn query_legacy_storage<P: AsRef<Path>>(
        storage_dir: P,
    ) -> Result<Vec<TokenEvent>, Box<dyn std::error::Error>> {
        let mut all_events = Vec::new();
        let storage_dir = storage_dir.as_ref();

        if !storage_dir.exists() {
            return Ok(all_events);
        }

        for entry in std::fs::read_dir(storage_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(event) = Self::parse_legacy_event(&json, &path) {
                            all_events.push(event);
                        }
                    }
                }
            }
        }

        Ok(all_events)
    }

    fn parse_legacy_event(json: &serde_json::Value, path: &Path) -> Option<TokenEvent> {
        let usage = json.get("usage")?;
        let input_tokens = usage.get("input_tokens")?.as_i64()?;
        let output_tokens = usage.get("output_tokens")?.as_i64()?;
        let timestamp = json.get("timestamp")?.as_i64()?;

        Some(TokenEvent {
            id: None,
            ide: "opencode".to_string(),
            session_id: json
                .get("session_id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            source_event_id: format!("{}:legacy", path.to_string_lossy()),
            model: json
                .get("model")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            input_tokens,
            output_tokens,
            cache_read_tokens: usage
                .get("cache_read_tokens")
                .and_then(|v| v.as_i64())
                .unwrap_or(0),
            cache_write_tokens: usage
                .get("cache_creation_tokens")
                .and_then(|v| v.as_i64())
                .unwrap_or(0),
            timestamp_utc: timestamp,
            project_path: json
                .get("project_path")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            source_file: path.to_string_lossy().to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_parse_legacy_event() {
        let json_str = r#"{
            "session_id": "test-session",
            "model": "gpt-4",
            "timestamp": 1705315800,
            "usage": {
                "input_tokens": 2000,
                "output_tokens": 1000,
                "cache_read_tokens": 500
            },
            "project_path": "/test/project"
        }"#;

        let json: serde_json::Value = serde_json::from_str(json_str).unwrap();
        let path = Path::new("/test/message.json");
        let event = OpenCodeParser::parse_legacy_event(&json, path);

        assert!(event.is_some());
        let event = event.unwrap();
        assert_eq!(event.ide, "opencode");
        assert_eq!(event.input_tokens, 2000);
        assert_eq!(event.output_tokens, 1000);
        assert_eq!(event.cache_read_tokens, 500);
    }
}
