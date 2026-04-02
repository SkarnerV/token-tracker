use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenEvent {
    pub id: Option<i64>,
    pub ide: String,
    pub session_id: Option<String>,
    pub source_event_id: String,
    pub model: Option<String>,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_write_tokens: i64,
    pub timestamp_utc: i64,
    pub project_path: Option<String>,
    pub source_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct HourlyStats {
    pub hour: String,
    pub ide: String,
    pub total_input: i64,
    pub total_output: i64,
    pub total_cache_read: i64,
    pub total_cache_write: i64,
    pub session_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyStats {
    pub date: String,
    pub ide: String,
    pub total_input: i64,
    pub total_output: i64,
    pub total_cache_read: i64,
    pub total_cache_write: i64,
    pub session_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestionCheckpoint {
    pub source_type: String,
    pub source_path: String,
    pub last_offset: i64,
    pub last_modified: i64,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        // Raw token events with idempotency key
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS token_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ide TEXT NOT NULL,
                session_id TEXT,
                source_event_id TEXT NOT NULL UNIQUE,
                model TEXT,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                cache_read_tokens INTEGER DEFAULT 0,
                cache_write_tokens INTEGER DEFAULT 0,
                timestamp_utc INTEGER NOT NULL,
                project_path TEXT,
                source_file TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        // Hourly stats for 5h/day/week queries
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS hourly_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hour TEXT NOT NULL,
                ide TEXT NOT NULL,
                total_input INTEGER DEFAULT 0,
                total_output INTEGER DEFAULT 0,
                total_cache_read INTEGER DEFAULT 0,
                total_cache_write INTEGER DEFAULT 0,
                session_count INTEGER DEFAULT 0,
                UNIQUE(hour, ide)
            )",
            [],
        )?;

        // Daily stats for month/year/heatmap
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS daily_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                ide TEXT NOT NULL,
                total_input INTEGER DEFAULT 0,
                total_output INTEGER DEFAULT 0,
                total_cache_read INTEGER DEFAULT 0,
                total_cache_write INTEGER DEFAULT 0,
                session_count INTEGER DEFAULT 0,
                UNIQUE(date, ide)
            )",
            [],
        )?;

        // Ingestion checkpoints for idempotency
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS ingestion_checkpoints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_type TEXT NOT NULL,
                source_path TEXT NOT NULL,
                last_offset INTEGER DEFAULT 0,
                last_modified INTEGER DEFAULT 0,
                last_event_id TEXT,
                UNIQUE(source_type, source_path)
            )",
            [],
        )?;

        // Dirty ranges for rollup invalidation
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS dirty_ranges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_hour TEXT NOT NULL,
                end_hour TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )",
            [],
        )?;

        // Create indexes for fast queries
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_events_ide_ts ON token_events(ide, timestamp_utc)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_events_model_ts ON token_events(model, timestamp_utc)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_events_source ON token_events(source_event_id)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_hourly_date ON hourly_stats(hour)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_stats(date)",
            [],
        )?;
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_daily_ide ON daily_stats(date, ide)",
            [],
        )?;

        Ok(())
    }

    pub fn insert_or_ignore_event(&self, event: &TokenEvent) -> Result<bool> {
        let rows = self.conn.execute(
            "INSERT OR IGNORE INTO token_events 
             (ide, session_id, source_event_id, model, input_tokens, output_tokens, 
              cache_read_tokens, cache_write_tokens, timestamp_utc, project_path, source_file)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                &event.ide,
                event.session_id.as_ref().unwrap_or(&String::new()),
                &event.source_event_id,
                event.model.as_ref().unwrap_or(&String::new()),
                event.input_tokens,
                event.output_tokens,
                event.cache_read_tokens,
                event.cache_write_tokens,
                event.timestamp_utc,
                event.project_path.as_ref().unwrap_or(&String::new()),
                &event.source_file
            ],
        )?;

        Ok(rows > 0)
    }

    pub fn get_checkpoint(
        &self,
        source_type: &str,
        source_path: &str,
    ) -> Result<Option<IngestionCheckpoint>> {
        let mut stmt = self.conn.prepare(
            "SELECT source_type, source_path, last_offset, last_modified 
             FROM ingestion_checkpoints 
             WHERE source_type = ?1 AND source_path = ?2",
        )?;

        let checkpoint = stmt
            .query_row(params![source_type, source_path], |row| {
                Ok(IngestionCheckpoint {
                    source_type: row.get(0)?,
                    source_path: row.get(1)?,
                    last_offset: row.get(2)?,
                    last_modified: row.get(3)?,
                })
            })
            .optional()?;

        Ok(checkpoint)
    }

    pub fn update_checkpoint(
        &self,
        source_type: &str,
        source_path: &str,
        offset: i64,
        modified: i64,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT INTO ingestion_checkpoints (source_type, source_path, last_offset, last_modified)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(source_type, source_path) 
             DO UPDATE SET last_offset = excluded.last_offset, last_modified = excluded.last_modified",
            params![source_type, source_path, offset, modified],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn mark_dirty_range(&self, start_hour: &str, end_hour: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO dirty_ranges (start_hour, end_hour) VALUES (?1, ?2)",
            params![start_hour, end_hour],
        )?;
        Ok(())
    }

    pub fn get_stats_for_range(
        &self,
        start_ts: i64,
        end_ts: i64,
        ide_filter: Option<&str>,
    ) -> Result<Vec<TokenEvent>> {
        let sql = if ide_filter.is_some() {
            "SELECT ide, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, timestamp_utc
             FROM token_events 
             WHERE timestamp_utc >= ?1 AND timestamp_utc <= ?2 AND ide = ?3
             ORDER BY timestamp_utc"
        } else {
            "SELECT ide, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, timestamp_utc
             FROM token_events 
             WHERE timestamp_utc >= ?1 AND timestamp_utc <= ?2
             ORDER BY timestamp_utc"
        };

        let mut stmt = self.conn.prepare(sql)?;

        let rows = if let Some(ide) = ide_filter {
            stmt.query_map(params![start_ts, end_ts, ide], |row| {
                Ok(TokenEvent {
                    id: None,
                    ide: row.get(0)?,
                    session_id: None,
                    source_event_id: String::new(),
                    model: None,
                    input_tokens: row.get(1)?,
                    output_tokens: row.get(2)?,
                    cache_read_tokens: row.get(3)?,
                    cache_write_tokens: row.get(4)?,
                    timestamp_utc: row.get(5)?,
                    project_path: None,
                    source_file: String::new(),
                })
            })?
            .collect::<Result<Vec<_>>>()?
        } else {
            stmt.query_map(params![start_ts, end_ts], |row| {
                Ok(TokenEvent {
                    id: None,
                    ide: row.get(0)?,
                    session_id: None,
                    source_event_id: String::new(),
                    model: None,
                    input_tokens: row.get(1)?,
                    output_tokens: row.get(2)?,
                    cache_read_tokens: row.get(3)?,
                    cache_write_tokens: row.get(4)?,
                    timestamp_utc: row.get(5)?,
                    project_path: None,
                    source_file: String::new(),
                })
            })?
            .collect::<Result<Vec<_>>>()?
        };

        Ok(rows)
    }

    pub fn get_daily_stats(
        &self,
        start_date: &str,
        end_date: &str,
        ide_filter: Option<&str>,
    ) -> Result<Vec<DailyStats>> {
        let sql = if ide_filter.is_some() {
            "SELECT date, ide, total_input, total_output, total_cache_read, total_cache_write, session_count
             FROM daily_stats 
             WHERE date >= ?1 AND date <= ?2 AND ide = ?3
             ORDER BY date"
        } else {
            "SELECT date, ide, total_input, total_output, total_cache_read, total_cache_write, session_count
             FROM daily_stats 
             WHERE date >= ?1 AND date <= ?2
             ORDER BY date"
        };

        let mut stmt = self.conn.prepare(sql)?;

        let rows = if let Some(ide) = ide_filter {
            stmt.query_map(params![start_date, end_date, ide], |row| {
                Ok(DailyStats {
                    date: row.get(0)?,
                    ide: row.get(1)?,
                    total_input: row.get(2)?,
                    total_output: row.get(3)?,
                    total_cache_read: row.get(4)?,
                    total_cache_write: row.get(5)?,
                    session_count: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?
        } else {
            stmt.query_map(params![start_date, end_date], |row| {
                Ok(DailyStats {
                    date: row.get(0)?,
                    ide: row.get(1)?,
                    total_input: row.get(2)?,
                    total_output: row.get(3)?,
                    total_cache_read: row.get(4)?,
                    total_cache_write: row.get(5)?,
                    session_count: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?
        };

        Ok(rows)
    }

    pub fn rebuild_aggregates(&self) -> Result<()> {
        // Clear and rebuild hourly_stats from raw events
        self.conn.execute("DELETE FROM hourly_stats", [])?;

        self.conn.execute(
            "INSERT INTO hourly_stats (hour, ide, total_input, total_output, total_cache_read, total_cache_write, session_count)
             SELECT 
                strftime('%Y-%m-%d %H:00', timestamp_utc, 'unixepoch') as hour,
                ide,
                SUM(input_tokens) as total_input,
                SUM(output_tokens) as total_output,
                SUM(cache_read_tokens) as total_cache_read,
                SUM(cache_write_tokens) as total_cache_write,
                COUNT(DISTINCT session_id) as session_count
             FROM token_events
             GROUP BY hour, ide",
            [],
        )?;

        // Clear and rebuild daily_stats from hourly_stats
        self.conn.execute("DELETE FROM daily_stats", [])?;

        self.conn.execute(
            "INSERT INTO daily_stats (date, ide, total_input, total_output, total_cache_read, total_cache_write, session_count)
             SELECT 
                substr(hour, 1, 10) as date,
                ide,
                SUM(total_input) as total_input,
                SUM(total_output) as total_output,
                SUM(total_cache_read) as total_cache_read,
                SUM(total_cache_write) as total_cache_write,
                SUM(session_count) as session_count
             FROM hourly_stats
             GROUP BY date, ide",
            [],
        )?;

        // Clear dirty ranges
        self.conn.execute("DELETE FROM dirty_ranges", [])?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Database {
        let conn = Connection::open_in_memory().unwrap();
        let db = Database { conn };
        db.init_schema().unwrap();
        db
    }

    #[test]
    fn test_insert_and_query_events() {
        let db = setup_test_db();

        let event = TokenEvent {
            id: None,
            ide: "claude".to_string(),
            session_id: Some("test-session-1".to_string()),
            source_event_id: "claude:/path/to/file.jsonl:123".to_string(),
            model: Some("claude-sonnet-4".to_string()),
            input_tokens: 1000,
            output_tokens: 500,
            cache_read_tokens: 2000,
            cache_write_tokens: 0,
            timestamp_utc: 1704067200, // 2024-01-01 00:00:00 UTC
            project_path: Some("/test/project".to_string()),
            source_file: "/path/to/file.jsonl".to_string(),
        };

        let inserted = db.insert_or_ignore_event(&event).unwrap();
        assert!(inserted);

        // Same event should be ignored (idempotency)
        let inserted2 = db.insert_or_ignore_event(&event).unwrap();
        assert!(!inserted2);
    }

    #[test]
    fn test_checkpoint_management() {
        let db = setup_test_db();

        let checkpoint = db.get_checkpoint("claude", "/test/file.jsonl").unwrap();
        assert!(checkpoint.is_none());

        db.update_checkpoint("claude", "/test/file.jsonl", 1000, 1704067200)
            .unwrap();

        let checkpoint = db.get_checkpoint("claude", "/test/file.jsonl").unwrap();
        assert!(checkpoint.is_some());
        let cp = checkpoint.unwrap();
        assert_eq!(cp.last_offset, 1000);
        assert_eq!(cp.last_modified, 1704067200);
    }
}
