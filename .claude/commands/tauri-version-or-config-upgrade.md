---
name: tauri-version-or-config-upgrade
description: Workflow command scaffold for tauri-version-or-config-upgrade in token-tracker.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /tauri-version-or-config-upgrade

Use this workflow when working on **tauri-version-or-config-upgrade** in `token-tracker`.

## Goal

Upgrade Tauri version or update Tauri configuration, including related Rust and frontend dependencies.

## Common Files

- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `package.json`
- `pnpm-lock.yaml`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Update src-tauri/Cargo.toml to change Tauri version.
- Update src-tauri/tauri.conf.json for new config format or settings.
- Update package.json and pnpm-lock.yaml for @tauri-apps dependencies.
- Optionally update src-tauri/Cargo.lock and related Rust files.
- Update CI/CD workflows if new dependencies or build steps are needed.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.