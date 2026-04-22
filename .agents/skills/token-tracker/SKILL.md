```markdown
# token-tracker Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you how to contribute to the `token-tracker` project, a Rust backend and Vite-based frontend application for tracking tokens (such as for IDE plugins or session management). You'll learn the project's coding conventions, how to perform common maintenance and feature tasks, and how to follow established workflows for CI/CD, versioning, backend updates, and documentation.

## Coding Conventions

- **File Naming:**  
  Use `camelCase` for file names.  
  _Example:_  
  ```
  src-tauri/src/parsers/claude.rs
  src-tauri/src/database.rs
  ```

- **Import Style:**  
  Use **relative imports** in Rust and JavaScript/TypeScript files.  
  _Example (Rust):_  
  ```rust
  mod parsers;
  use crate::parsers::claude::parse_tokens;
  ```
  _Example (JS/TS):_  
  ```js
  import { someUtil } from './utils/someUtil';
  ```

- **Export Style:**  
  Mixed export styles are used (both named and default exports).  
  _Example (JS/TS):_  
  ```js
  export default MyComponent;
  export function helper() { ... }
  ```

- **Commit Messages:**  
  - Prefixes: `docs`, `chore`, `fix`
  - Freeform, average length ~48 characters  
  _Example:_  
  ```
  fix: handle edge case in parser for empty input
  docs: update AGENTS.md with new agent details
  ```

## Workflows

### ci-cd-pipeline-update
**Trigger:** When you need to add, fix, or update CI/CD automation for testing, building, or releasing the app.  
**Command:** `/update-ci-cd`

1. Edit `.github/workflows/ci.yml` and/or `.github/workflows/release.yml` to add or fix jobs, dependencies, or steps.
2. Optionally update related configuration files (e.g., `package.json`, `pnpm-lock.yaml`) if needed for the pipeline.
3. Commit with a message referencing CI, release, or workflow.

_Example:_  
```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: pnpm install
      - name: Run tests
        run: pnpm test
```

---

### tauri-version-or-config-upgrade
**Trigger:** When you want to upgrade Tauri or change its configuration for new features or compatibility.  
**Command:** `/upgrade-tauri`

1. Update `src-tauri/Cargo.toml` to change the Tauri version.
2. Update `src-tauri/tauri.conf.json` for new config format or settings.
3. Update `package.json` and `pnpm-lock.yaml` for `@tauri-apps` dependencies.
4. Optionally update `src-tauri/Cargo.lock` and related Rust files.
5. Update CI/CD workflows if new dependencies or build steps are needed.

_Example:_  
```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = "1.5"
```
```json
// src-tauri/tauri.conf.json
{
  "tauri": {
    "bundle": { ... }
  }
}
```

---

### parser-or-backend-feature-update
**Trigger:** When you want to add features or fix bugs in the backend logic for token parsing or session tracking.  
**Command:** `/update-parser`

1. Edit or add Rust source files in `src-tauri/src/parsers/` (e.g., `claude.rs`, `opencode.rs`, `roo.rs`) or `src-tauri/src/database.rs`.
2. Optionally update `src-tauri/src/commands.rs` to expose new or changed functionality.
3. Commit with a message referencing parser, backend, or database.

_Example:_  
```rust
// src-tauri/src/parsers/claude.rs
pub fn parse_tokens(input: &str) -> usize {
    input.split_whitespace().count()
}
```

---

### version-bump-and-release-prep
**Trigger:** When you want to prepare for a new release by bumping the version.  
**Command:** `/bump-version`

1. Update version in `package.json`.
2. Update version in `src-tauri/Cargo.toml`.
3. Update version in `src-tauri/tauri.conf.json`.
4. Optionally update or run release scripts in `scripts/`.
5. Commit with a message referencing version bump or release.

_Example:_  
```json
// package.json
{
  "version": "1.2.0"
}
```
```toml
# src-tauri/Cargo.toml
version = "1.2.0"
```

---

### documentation-update
**Trigger:** When you want to document new features, fixes, or release processes.  
**Command:** `/update-docs`

1. Edit or add Markdown files in `docs/` or root (e.g., `README.md`, `AGENTS.md`, `docs/release-pipeline-debugging.md`).
2. Commit with a message referencing docs or documentation.

_Example:_  
```markdown
# AGENTS.md

## Claude Agent
Details about the Claude token parser agent...
```

---

## Testing Patterns

- **Test File Pattern:**  
  Test files follow the `*.test.*` pattern (e.g., `parser.test.rs`, `utils.test.ts`).

- **Testing Framework:**  
  The specific framework is unknown, but tests are likely colocated with source files or in a `tests/` directory.

_Example:_  
```rust
// src-tauri/src/parsers/claude.test.rs
#[test]
fn test_parse_tokens() {
    assert_eq!(parse_tokens("a b c"), 3);
}
```

---

## Commands

| Command         | Purpose                                                         |
|-----------------|-----------------------------------------------------------------|
| /update-ci-cd   | Update or fix CI/CD pipeline, including lint, test, build, release |
| /upgrade-tauri  | Upgrade Tauri version or update Tauri configuration             |
| /update-parser  | Add or fix backend logic, especially Rust parsers or database   |
| /bump-version   | Bump the project version and update related files for release   |
| /update-docs    | Add or update documentation files                              |
```
