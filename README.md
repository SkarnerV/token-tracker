# Token Tracker

A cross-platform desktop application for tracking AI coding assistant token usage across Claude Code, OpenCode, and Roo Code.

## Features

- **Multi-IDE Support**: Track usage from Claude Code, OpenCode, and Roo Code in one unified view
- **Real-time Statistics**: Monitor input/output tokens, cache reads/writes, and session counts
- **Activity Heatmap**: Visualize your coding activity over time with a contribution-style graph
- **Time Range Filtering**: View stats by hour, day, week, month, year, or all time
- **IDE Filtering**: Select specific IDEs to compare usage patterns
- **Dark Mode**: Clean, modern dark theme interface

## Screenshots

The app displays:
- **Stats Cards**: Total tokens, input/output breakdown, cache statistics, session count
- **Activity Graph**: GitHub-style contribution heatmap showing daily activity
- **IDE Selector**: Toggle which IDE sources to include in statistics

## Installation

### Prerequisites

- Rust 1.70+ 
- Node.js 18+ 
- pnpm (recommended) or npm

### Build from Source

```bash
# Clone the repository
git clone https://github.com/SkarnerV/token-tracker.git
cd token-tracker

# Install dependencies
pnpm install

# Build frontend
pnpm build

# Build and run the Tauri app
cd src-tauri
cargo tauri dev
```

### Development

```bash
# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Data Sources

The app automatically detects and reads usage data from:

### Claude Code
- Location: `~/.claude/projects/`
- Format: JSONL files containing session events
- Fields: `usage.input_tokens`, `usage.output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`

### OpenCode
- Location: `~/.local/share/opencode/opencode.db` (SQLite database)
- Legacy: `~/.local/share/opencode/storage/message/` (JSON files)
- Fields: `tokens.input`, `tokens.output`, `tokens.cache.read`, `tokens.cache.write`

### Roo Code (Cline)
- Location: 
  - macOS: `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks`
  - Linux: `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks`
- Format: `history_item.json` in each task subdirectory
- Fields: `tokensIn`, `tokensOut`, `cacheReads`, `cacheWrites`

## Architecture

### Frontend
- **React + TypeScript**: UI components
- **Zustand**: State management
- **TailwindCSS**: Styling
- **Tauri API**: IPC communication with backend

### Backend (Tauri/Rust)
- **SQLite**: Local database for aggregated statistics
- **Parsers**: Custom parsers for each IDE's data format
- **Incremental Sync**: Checkpoint-based syncing to avoid reprocessing

### Database Schema

```sql
-- Raw token events
token_events (
  ide, session_id, source_event_id, model,
  input_tokens, output_tokens, 
  cache_read_tokens, cache_write_tokens,
  timestamp_utc, project_path, source_file
)

-- Hourly aggregates
hourly_stats (hour, ide, totals, session_count)

-- Daily aggregates  
daily_stats (date, ide, totals, session_count)

-- Sync checkpoints
ingestion_checkpoints (source_type, source_path, last_offset, last_modified)
```

## Usage

1. **Sync Data**: Click "Sync All" to fetch latest usage from all IDEs
2. **Filter by IDE**: Select/deselect IDEs in the sidebar to compare usage
3. **Filter by Time**: Use the time range selector to view specific periods
4. **View Activity**: The heatmap shows your coding activity intensity

## Configuration

No configuration required. The app automatically:
- Detects your home directory
- Finds IDE data locations
- Creates the local database at `~/.token-tracker/tracker.db`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, TailwindCSS |
| State | Zustand |
| Desktop | Tauri 1.x |
| Backend | Rust |
| Database | SQLite (rusqlite) |
| Parsing | serde_json, chrono |

## Development Notes

### Adding a New IDE Parser

1. Create `src-tauri/src/parsers/<ide>.rs`
2. Implement parsing logic returning `TokenEvent` structs
3. Add sync command in `commands.rs`
4. Add IDE to frontend constants (`IDE_COLORS`, `IDE_LABELS`)

### Database Queries

The app uses:
- `get_stats_for_range`: Returns aggregated stats with session counts
- `get_daily_stats`: Returns daily aggregates for heatmap
- `rebuild_aggregates`: Recalculates hourly/daily stats from raw events

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR for:
- Bug fixes
- New IDE support
- UI improvements
- Performance optimizations