# Token Tracker — AI IDE Usage Tracker

**Generated:** 2026-04-10 | **Version:** 0.1.0 | **Package Manager:** pnpm

## QUICK START

```bash
pnpm install          # Install Node dependencies
pnpm tauri:dev        # Start Tauri in dev mode
```

First run creates `~/.token-tracker/tracker.db`. The app auto-detects IDE data at standard locations.

## OVERVIEW

Token Tracker is a cross-platform desktop application that tracks AI coding assistant token usage across Claude Code, OpenCode, and Roo Code. Built with Tauri (Rust backend) and React + TypeScript frontend, it provides real-time statistics, activity heatmaps, and time-based filtering for analyzing your AI assistant usage patterns.

## STRUCTURE

```
token-tracker/
├── src/                      # Frontend (React + TypeScript)
│   ├── App.tsx              # Root component with main layout
│   ├── components/          # React components
│   │   ├── ActivityGraph.tsx    # GitHub-style contribution heatmap
│   │   ├── IDESelector.tsx      # IDE toggle and sync controls
│   │   └── StatsCards.tsx       # Statistics display cards
│   ├── stores/              # Zustand state management
│   │   └── tokenStore.ts    # Global app state and Tauri IPC calls
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts         # Shared types (TokenEvent, Stats, etc.)
│   ├── lib/                 # Utility functions
│   │   └── timeRanges.ts    # Time range calculations
│   ├── test/                # Frontend tests (Vitest)
│   └── main.tsx             # Vite entry point
├── src-tauri/               # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── main.rs          # Tauri app setup and builder
│   │   ├── commands.rs      # Tauri command handlers (IPC endpoints)
│   │   ├── database.rs      # SQLite database operations
│   │   └── parsers/         # IDE-specific data parsers
│   │       ├── claude.rs    # Claude Code JSONL parser
│   │       ├── opencode.rs  # OpenCode SQLite/JSON parser
│   │       └── roo.rs       # Roo Code task JSON parser
│   ├── Cargo.toml           # Rust dependencies
│   └── tauri.conf.json      # Tauri configuration
├── public/                  # Static assets
├── dist/                    # Build output (Vite)
├── package.json             # Node.js dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite bundler config
├── vitest.config.ts         # Test configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── eslint.config.js         # ESLint rules
```

## ARCHITECTURE

### Frontend Stack
| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| State Management | Zustand |
| Styling | TailwindCSS 3.x |
| Build Tool | Vite 5.x |
| Testing | Vitest + Testing Library |
| Icons | Lucide React |
| Charts | react-activity-calendar, recharts |
| Date Utils | date-fns |

### Backend Stack
| Layer | Technology |
|-------|------------|
| Framework | Tauri 2.x |
| Language | Rust |
| Database | SQLite (rusqlite) |
| Serialization | serde, serde_json |
| Time Handling | chrono |

### State Management
Tauri's command handlers run in a multi-threaded async runtime. SQLite connections are not thread-safe, so database access requires synchronization:

```rust
// AppState struct (commands.rs)
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
}

// Database struct (database.rs)
pub struct Database {
    conn: Connection,  // SQLite connection - NOT thread-safe
}
```

**Usage pattern in commands:**
```rust
#[tauri::command]
pub fn get_stats(state: State<AppState>, ...) -> Result<StatsResponse, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    // db is now a MutexGuard<Database> - automatically released when scope ends
    db.get_stats_for_range(...)
}
```

**Key points:**
- `Arc` enables multiple clones across Tauri's async runtime
- `Mutex` ensures exclusive access (SQLite connections are not thread-safe)
- `State<AppState>` is Tauri's dependency injection for managed state
- `MutexGuard` is RAII — lock is released when the guard goes out of scope
- For sync operations with multiple DB calls, acquire/release lock per operation (not held throughout)

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                    Token Tracker Data Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Frontend (React)                                               │
│   ┌─────────────────────────────────────┐                       │
│   │  App.tsx                            │                       │
│   │   ├── StatsCards (time range stats) │                       │
│   │   ├── ActivityGraph (heatmap)       │                       │
│   │   └── IDESelector (IDE toggles)     │                       │
│   └─────────────────┬───────────────────┘                       │
│                     │ Zustand store                             │
│                     │ invoke() Tauri IPC                        │
│                     ▼                                           │
│   Backend (Rust)                                                 │
│   ┌─────────────────────────────────────┐                       │
│   │  commands.rs                        │                       │
│   │   ├── sync_claude_code()            │                       │
│   │   ├── sync_opencode()               │                       │
│   │   ├── sync_roo_code()               │                       │
│   │   ├── get_stats()                   │                       │
│   │   ├── get_contribution_graph()      │                       │
│   │   └── rebuild_aggregates()          │                       │
│   └────────┬────────────────────────────┘                       │
│            │                                                     │
│            ▼                                                     │
│   ┌─────────────────────────────────────┐                       │
│   │  parsers/                           │                       │
│   │   ├── claude.rs → ~/.claude/        │                       │
│   │   ├── opencode.rs → ~/.local/...    │                       │
│   │   └── roo.rs → ~/.config/Code/...   │                       │
│   └────────┬────────────────────────────┘                       │
│            │                                                     │
│            ▼                                                     │
│   ┌─────────────────────────────────────┐                       │
│   │  database.rs (SQLite)               │                       │
│   │   ├── token_events (raw events)     │                       │
│   │   ├── hourly_stats (aggregates)     │                       │
│   │   └── daily_stats (heatmap data)    │                       │
│   └─────────────────────────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## DATABASE SCHEMA

### Core Tables

#### token_events (Source of Truth)
```sql
CREATE TABLE token_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ide TEXT NOT NULL,                    -- 'claude', 'opencode', 'roo'
    session_id TEXT,
    source_event_id TEXT NOT NULL UNIQUE, -- idempotency key
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

#### hourly_stats (Fast Range Queries)
```sql
CREATE TABLE hourly_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

#### daily_stats (Contribution Graph)
```sql
CREATE TABLE daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

#### ingestion_checkpoints (Resume Capability)
```sql
CREATE TABLE ingestion_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_path TEXT NOT NULL,
    last_offset INTEGER DEFAULT 0,
    last_modified INTEGER DEFAULT 0,
    last_event_id TEXT,
    UNIQUE(source_type, source_path)
);
```

#### dirty_ranges (Rollup Invalidation)
```sql
CREATE TABLE dirty_ranges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_hour TEXT NOT NULL,
    end_hour TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

## IDE TOKEN FIELD MAPPINGS

When adding a new IDE parser, map its token fields to the database schema:

| IDE | Input Tokens | Output Tokens | Cache Read | Cache Write | Timestamp Field |
|-----|--------------|---------------|------------|-------------|-----------------|
| Claude Code | `usage.input_tokens` | `usage.output_tokens` | `usage.cache_read_input_tokens` | `usage.cache_creation_input_tokens` | `timestamp` (RFC3339) |
| OpenCode | `tokens.input` | `tokens.output` | `tokens.cache.read` | `tokens.cache.write` | `time_created` (Unix epoch) |
| Roo Code | `tokensIn` | `tokensOut` | `cacheReads` | `cacheWrites` | `ts` (Unix epoch ms) |

### ID Generation (source_event_id)
- **Claude:** `{sessionId}:{timestamp}:{line_hash}`
- **OpenCode:** `message.id` from SQLite
- **Roo:** `{taskId}:{ts}` from history_item.json

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new IDE parser | `src-tauri/src/parsers/` | Follow existing parser pattern (claude.rs, opencode.rs, roo.rs) |
| Add new database query | `src-tauri/src/database.rs` | Add SQL query function, then expose in commands.rs |
| Add new command | `src-tauri/src/commands.rs` | Use `#[tauri::command]` macro, register in main.rs |
| Add new component | `src/components/` | Use functional components with TypeScript |
| Update state management | `src/stores/tokenStore.ts` | Zustand store with async actions |
| Add types | `src/types/index.ts` | Export types for frontend/backend alignment |
| Update UI styles | Tailwind classes | Dark mode via `dark:` prefix |
| Database operations | `src-tauri/src/database.rs` | SQLite via rusqlite crate |

## COMMON TASKS

### Add a New IDE Parser

1. Create parser module in `src-tauri/src/parsers/<ide>.rs`
2. Add to `parsers/mod.rs` exports
3. Add sync command in `commands.rs` (follow existing pattern)
4. Register command in `main.rs` invoke_handler
5. Add frontend toggle in `tokenStore.ts` (IDE_COLORS, IDE_LABELS)

### Fix Sync Resume Bug

Check checkpoint logic in `parsers/<ide>.rs` and `database.rs`:
- Claude: Byte offset stored/retrieved via `get_checkpoint()`, `update_checkpoint()`
- OpenCode: Timestamp stored/retrieved, SQL filters `WHERE time_created > {ts}`
- Roo: No checkpoint — verify `INSERT OR IGNORE` idempotency works

### Add New Stats Query

1. Add query method in `database.rs`
2. Expose via `#[tauri::command]` in `commands.rs`
3. Call from `tokenStore.ts` via `invoke()`
4. Update frontend types in `src/types/index.ts`

### Debug Parser Issues

Add `println!()` statements in parser — output visible in `pnpm tauri:dev` terminal.
Check `DATA SOURCES` section for correct paths and field mappings.

## DATA SOURCES

### Claude Code
- **Location:** `~/.claude/projects/`
- **Format:** JSONL files (`{session-id}.jsonl`)
- **Fields:** `usage.input_tokens`, `usage.output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`
- **Parser:** `src-tauri/src/parsers/claude.rs`
- **Checkpoint:** Byte offset in JSONL files — resumes from last read position via `SeekFrom::Start(offset)`

### OpenCode
- **Location:** `~/.local/share/opencode/opencode.db`
- **Fallback:** `~/.local/share/opencode/storage/message/` (JSON files)
- **Fields:** `tokens.input`, `tokens.output`, `tokens.cache.read`, `tokens.cache.write`
- **Parser:** `src-tauri/src/parsers/opencode.rs`
- **Checkpoint:** File modification timestamp — SQL query filters `WHERE time_created > {timestamp}`

### Roo Code
- **Location:** 
  - macOS: `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks`
  - Linux: `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks`
- **Format:** `history_item.json` in task subdirectories
- **Fields:** `tokensIn`, `tokensOut`, `cacheReads`, `cacheWrites`
- **Parser:** `src-tauri/src/parsers/roo.rs`
- **Checkpoint:** None — full scan every sync, relies on database idempotency (`INSERT OR IGNORE`)

## COMMANDS

```bash
# Development
pnpm dev                   # Start Vite dev server
pnpm tauri:dev             # Run Tauri app in dev mode

# Build
pnpm build                 # Build frontend
pnpm tauri:build           # Build production Tauri app

# Testing
pnpm test                  # Run Vitest tests
pnpm test:watch            # Run tests in watch mode
pnpm test:coverage         # Run tests with coverage

# Linting
pnpm lint                  # Run ESLint
pnpm lint:fix              # Fix ESLint errors
pnpm typecheck             # TypeScript type checking

# Rust (in src-tauri/)
cd src-tauri
cargo build                # Build Rust only
cargo test                 # Run Rust tests
cargo tauri dev            # Run Tauri dev
cargo tauri build          # Build release binary
```

## CONVENTIONS

### Frontend
- **Framework:** React 18 with functional components
- **State:** Zustand for global state, props for component hierarchy
- **Styling:** TailwindCSS with `dark:` prefix for dark mode
- **Types:** Explicit TypeScript interfaces in `src/types/index.ts`
- **File naming:** PascalCase for components, camelCase for utilities
- **Imports:** Group by: React, third-party, local types, local components/utils

### Backend
- **Language:** Rust with strict typing
- **Error handling:** `Result<T, E>` pattern, propagate errors with `?`
- **Database:** Parameterized queries only (prevent SQL injection)
- **Commands:** Async functions returning `Result<T, String>` for Tauri IPC
- **Parsers:** Return `Vec<TokenEvent>`, handle missing fields gracefully

### General
- **Package Manager:** pnpm only (specified in `packageManager` field)
- **Node Version:** 18+
- **Rust Version:** 1.70+
- **Line endings:** LF (enforced by Git)

## ANTI-PATTERNS

| Anti-Pattern | Why It Breaks | Solution |
|--------------|---------------|----------|
| Hold Mutex lock across await points | Blocks other Tauri commands | Release lock before `.await`, re-acquire after |
| Forget to update checkpoint after sync | Next run re-processes all data | Always call `update_checkpoint()` even on error |
| Use `unwrap()` on `dirs::home_dir()` | Returns `None` in some environments | Use `ok_or()` with descriptive error |
| Add field to response struct without `#[serde(rename_all = "camelCase")]` | Frontend expects camelCase, breaks TS types | Follow existing struct pattern |
| Call database without acquiring Mutex | SQLite connection is not thread-safe | Always use `state.db.lock().map_err(...)?` |
| Skip `source_event_id` uniqueness check | Duplicate events inserted | Always set UNIQUE constraint on idempotency key |

**General rules (enforced by linters):**
- Never use `as any` or `@ts-ignore` in TypeScript
- Never use `unwrap()` in production Rust code (handle errors properly)
- Never suppress ESLint/Clippy errors without fixing root cause

## TESTING

### Frontend Tests (Vitest)
- Co-located in `src/test/` or alongside components
- Use `@testing-library/react` for component tests
- Mock Tauri IPC with `vi.mock('@tauri-apps/api')`

### Backend Tests (Rust)
- Unit tests in each `.rs` file under `#[cfg(test)]`
- Integration tests in `src-tauri/tests/`
- Test parsers with sample data files in `test_data/`

## CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| ci.yml | push/PR | Lint, typecheck, test, build |
| release.yml | manual | Build platform binaries, create release |

## NOTES

- Database location: `~/.token-tracker/tracker.db`
- Uses **single-writer pattern**: only Rust backend writes to database
- Incremental sync: Claude (byte offset), OpenCode (timestamp), Roo (none — full scan)
- Activity graph uses 5 intensity levels based on quartiles
- All timestamps stored as UTC, displayed in local time
- Tauri v2 uses capability-based permissions (see `src-tauri/capabilities/`)

## REFERENCES

- **Tauri Docs:** https://tauri.app/
- **React:** https://react.dev/
- **Zustand:** https://docs.pmnd.rs/zustand/
- **TailwindCSS:** https://tailwindcss.com/
- **ccmate (inspiration):** https://github.com/djyde/ccmate
- **Claude Code data structures:** https://gist.github.com/samkeen/dc6a9771a78d1ecee7eb9ec1307f1b52
