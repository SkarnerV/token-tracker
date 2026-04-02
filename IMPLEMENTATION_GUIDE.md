# Token Tracker - Implementation Guide

## Overview

This is a **multi-IDE token usage tracker** inspired by ccmate, designed to track Claude Code, OpenCode, and Roo Code usage with GitHub-style contribution graphs and time-based statistics.

## Architecture Decisions

### Why Tauri?
- Native desktop app with web tech (React + Rust)
- Small bundle size (~5MB vs Electron's ~100MB)
- Native file system access for reading IDE logs
- Built-in SQLite support via rusqlite

### Why Single-Writer Pattern?
Following Metis recommendations:
- **Rust backend owns all database operations** - no frontend DB writes
- Prevents lock contention between Tauri plugin and backend
- Transactional consistency for ingestion + checkpoint updates

## Database Schema

### Core Tables

#### 1. token_events (Source of Truth)
```sql
CREATE TABLE token_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ide TEXT NOT NULL,                    -- 'claude', 'opencode', 'roo'
    session_id TEXT,
    source_event_id TEXT NOT NULL UNIQUE, -- idempotency key: "file:offset"
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    timestamp_utc INTEGER NOT NULL,       -- Unix epoch seconds (UTC)
    project_path TEXT,
    source_file TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

**Key Design Points:**
- `source_event_id` prevents duplicates: `"~/.claude/projects/foo/bar.jsonl:12345"`
- `timestamp_utc` stored as INTEGER for fast range queries
- Indexes on `(ide, timestamp_utc)` and `(model, timestamp_utc)`

#### 2. hourly_stats (Fast 5h/Day/Week Queries)
```sql
CREATE TABLE hourly_stats (
    hour TEXT NOT NULL,                   -- 'YYYY-MM-DD HH:00'
    ide TEXT NOT NULL,
    total_input INTEGER DEFAULT 0,
    total_output INTEGER DEFAULT 0,
    total_cache_read INTEGER DEFAULT 0,
    total_cache_write INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    UNIQUE(hour, ide)
);
```

#### 3. daily_stats (Contribution Graph + Month/Year)
```sql
CREATE TABLE daily_stats (
    date TEXT NOT NULL,                   -- 'YYYY-MM-DD'
    ide TEXT NOT NULL,
    total_input INTEGER DEFAULT 0,
    total_output INTEGER DEFAULT 0,
    total_cache_read INTEGER DEFAULT 0,
    total_cache_write INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    UNIQUE(date, ide)
);
```

#### 4. ingestion_checkpoints (Resume Capability)
```sql
CREATE TABLE ingestion_checkpoints (
    source_type TEXT NOT NULL,            -- 'claude', 'opencode', 'roo'
    source_path TEXT NOT NULL,
    last_offset INTEGER DEFAULT 0,        -- byte offset in file
    last_modified INTEGER DEFAULT 0,      -- file mtime
    UNIQUE(source_type, source_path)
);
```

#### 5. dirty_ranges (Lazy Rollup Rebuild)
```sql
CREATE TABLE dirty_ranges (
    start_hour TEXT NOT NULL,
    end_hour TEXT NOT NULL
);
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Sync Process                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Check checkpoint for source file                           │
│     → Get last_offset and last_modified                        │
│                                                                 │
│  2. Parse new content since last_offset                        │
│     Claude: JSONL → line by line                              │
│     OpenCode: SQLite query with timestamp > checkpoint         │
│     Roo: JSON files → task by task                            │
│                                                                 │
│  3. For each event:                                            │
│     a. Generate source_event_id: "{file}:{offset}"            │
│     b. INSERT OR IGNORE INTO token_events                      │
│     c. Mark dirty range for rollup                             │
│                                                                 │
│  4. Update checkpoint:                                         │
│     → file_size, mtime                                         │
│                                                                 │
│  5. Rebuild aggregations (hourly + daily)                     │
│     → Only for dirty ranges                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Parser Implementations

### Claude Code (JSONL)

**Location:** `~/.claude/projects/{project-path}/{session-id}.jsonl`

**Event Format:**
```json
{
  "type": "assistant",
  "timestamp": "2024-01-15T10:30:00Z",
  "sessionId": "uuid-here",
  "model": "claude-sonnet-4-5",
  "usage": {
    "input_tokens": 1500,
    "output_tokens": 800,
    "cache_read_tokens": 2000,
    "cache_creation_tokens": 500
  }
}
```

**Checkpoint Strategy:**
- Byte offset in file
- Resume from offset on next sync
- Handle partial last lines (skip incomplete)

### OpenCode (SQLite)

**Location:** `~/.local/share/opencode/opencode.db`

**Schema (v1.2+):**
```sql
SELECT session_id, model, input_tokens, output_tokens, 
       cache_read_tokens, cache_creation_tokens, timestamp
FROM interactions
WHERE timestamp > ?
```

**Checkpoint Strategy:**
- Last timestamp (since v1.2 uses monotonic IDs)
- Alternative: Last modified time of DB file

**Fallback:** Legacy JSON files in `~/.local/share/opencode/storage/message/`

### Roo Code (JSON Tasks)

**Location:** `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks/*.json`

**Event Format:**
```json
{
  "id": "task-uuid",
  "model": "claude-sonnet-4",
  "timestamp": 1705315800,
  "tokenUsage": {
    "inputTokens": 3000,
    "outputTokens": 1500
  },
  "workspace": "/path/to/project"
}
```

**Checkpoint Strategy:**
- No checkpoint (atomic file reads)
- Deduplication via source_event_id: "{file}:{task_id}"
- Server fallback: `~/.vscode-server/data/User/globalStorage/...`

## Query Patterns

### Time Range Stats (5h, Day, Week)
```sql
-- Use hourly_stats for fast aggregation
SELECT ide, SUM(total_input), SUM(total_output)
FROM hourly_stats
WHERE hour >= '2024-01-15 05:00' 
  AND hour <= '2024-01-15 10:00'
GROUP BY ide;
```

### Contribution Graph (1 Year)
```sql
-- Use daily_stats for heatmap
SELECT date, 
       total_input + total_output as count,
       CASE 
         WHEN count = 0 THEN 0
         WHEN count < threshold THEN 1
         WHEN count < threshold*2 THEN 2
         WHEN count < threshold*3 THEN 3
         ELSE 4
       END as level
FROM daily_stats
WHERE date >= '2024-01-01' AND date <= '2025-01-01'
ORDER BY date;
```

### Model Breakdown
```sql
SELECT model, ide, 
       SUM(input_tokens), SUM(output_tokens)
FROM token_events
WHERE timestamp_utc >= ? AND timestamp_utc <= ?
GROUP BY model, ide;
```

## Frontend Architecture

### State Management (Zustand)

```typescript
interface TokenState {
  stats: StatsResponse | null;
  contributionData: ContributionDay[];
  selectedRange: TimeRangeType;  // '5h' | 'day' | 'week' | 'month' | 'year' | 'all'
  selectedIdes: string[];        // ['claude', 'opencode', 'roo']
  isLoading: boolean;
  
  setSelectedRange: (range: TimeRangeType) => void;
  toggleIde: (ide: string) => void;
  fetchStats: () => Promise<void>;
  fetchContributionGraph: () => Promise<void>;
  syncAll: () => Promise<void>;
}
```

### Components

#### ActivityGraph (Contribution Heatmap)
- Custom SVG-based grid (53 weeks × 7 days)
- 5 intensity levels based on quartiles
- Hover tooltips with exact token counts
- Dark mode support via Tailwind classes

#### StatsCards
- Time range selector buttons
- Summary cards: Total, Input, Output, Cache
- Breakdown by IDE
- Responsive grid layout

#### IDESelector
- Toggle visibility per IDE
- Last sync timestamp
- Sync All button
- Color-coded indicators

## Time Range Implementation

```typescript
function getTimeRange(rangeType: TimeRangeType): TimeRange {
  const now = new Date();
  const endTs = Math.floor(now.getTime() / 1000);
  
  switch (rangeType) {
    case '5h':
      return { startTs: endTs - 5 * 60 * 60, endTs };
    case 'day':
      return { 
        startTs: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000,
        endTs 
      };
    case 'week':
      return { startTs: endTs - 7 * 24 * 60 * 60, endTs };
    case 'month':
      return { 
        startTs: new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000,
        endTs 
      };
    case 'year':
      return { 
        startTs: new Date(now.getFullYear(), 0, 1).getTime() / 1000,
        endTs 
      };
    case 'all':
      return { startTs: 0, endTs };
  }
}
```

## Color Scale Algorithm

```typescript
function calculateLevel(count: number, maxCount: number): number {
  if (count === 0) return 0;
  
  const threshold = maxCount / 4;
  return Math.min(4, Math.ceil(count / threshold));
}

// Theme colors
const LEVEL_COLORS = [
  'bg-gray-100 dark:bg-gray-800',   // Level 0
  'bg-green-300 dark:bg-green-900', // Level 1
  'bg-green-400 dark:bg-green-700', // Level 2
  'bg-green-500 dark:bg-green-600', // Level 3
  'bg-green-600 dark:bg-green-500', // Level 4
];
```

## Testing Strategy

### Parser Tests
Each parser has unit tests with sample data:
- `test_extract_event_valid` - Happy path
- `test_extract_event_missing_usage` - Skip events without tokens

### Integration Tests
- `test_claude_ingestion_is_idempotent_on_replay` - Same file twice = same count
- `test_opencode_reader_handles_wal_snapshot` - SQLite WAL mode
- `test_roo_parser_handles_atomic_file_replace` - Temp file rename
- `test_hourly_rollup_matches_raw_events` - Aggregation correctness

## Deployment

### Build
```bash
cd src-tauri
cargo build --release
```

### Platform Notes
- **macOS**: May need to codesign the app
- **Windows**: Bundle with WiX installer
- **Linux**: AppImage or .deb package

## Future Enhancements

1. **Real-time Sync**: File watchers with debouncing
2. **Cost Tracking**: Add pricing per model
3. **Export**: CSV/JSON export for custom analysis
4. **Cloud Sync**: Optional encrypted cloud backup
5. **VS Code Extension**: Alternative to desktop app

## References

- **ccmate**: https://github.com/djyde/ccmate - Inspiration
- **tokscale**: https://github.com/junhoyeo/tokscale - Multi-platform tracker
- **react-activity-calendar**: Heatmap component
- **Claude Code data structures**: https://gist.github.com/samkeen/dc6a9771a78d1ecee7eb9ec1307f1b52
