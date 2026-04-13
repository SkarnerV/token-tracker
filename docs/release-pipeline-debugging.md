# Release Pipeline Bug Fix

## Problem

After upgrading from Tauri v1 to v2, the GitHub release pipeline failed with:
```
No artifacts were found.
```

This occurred during initial release attempts after the Tauri v2 upgrade, while the earlier v0.1.0 release (Tauri v1) succeeded.

## Root Cause

The bug was caused by a **behavioral change in Tauri v2** that was not clearly documented.

### Tauri v1 vs v2 Bundler Behavior

| Version | Command | Behavior |
|---------|---------|----------|
| Tauri v1 | `tauri build` | Automatically runs bundler when `bundle.active: true` |
| Tauri v2 | `tauri build` | Only compiles binary, **bundler is opt-in via CLI args** |

In Tauri v2, the `bundle.active` configuration field was removed, and the bundler must be explicitly invoked with `--bundles` arguments. The `targets: "all"` setting in `tauri.conf.json` is effectively decorative unless paired with CLI arguments.

### What Went Wrong

The CI workflow ran:
```bash
pnpm tauri build --target x86_64-apple-darwin
```

This command in Tauri v2 only produces the binary executable, not any bundled installers (dmg, msi, nsis, etc.). The logs showed:
```
Finished `release` profile [optimized] target(s) in 2m 10s
Built application at: .../release/token-tracker
Looking for artifacts in: .../bundle/dmg/Token Tracker_0.1.7_x64.dmg
[error]No artifacts were found.
```

Notice: **No "Bundling" output between build and artifact lookup** - the bundler never ran.

### Why It Was Hard to Diagnose

1. **Misleading similarity to v0.1.0** - The working v0.1.0 used Tauri v1, while current code was Tauri v2. Diffing against v0.1.0 config didn't reveal the behavioral change.

2. **Ambiguous error message** - "No artifacts were found" suggests many causes (wrong path, missing tools, config errors) but doesn't indicate bundling was never attempted.

3. **CI environment obscured behavior** - Without local testing, the missing "Bundling" phase output wasn't noticed.

## Solution

Added explicit `--bundles` arguments to the tauri-action workflow for each platform:

```yaml
matrix:
  include:
    - os: ubuntu-22.04
      target: x86_64-unknown-linux-gnu
      bundles: --bundles deb --bundles appimage
    - os: macos-latest
      target: x86_64-apple-darwin
      bundles: --bundles dmg --bundles app
    - os: macos-latest
      target: aarch64-apple-darwin
      bundles: --bundles dmg --bundles app
    - os: windows-latest
      target: x86_64-pc-windows-msvc
      bundles: --bundles msi --bundles nsis
args: --target ${{ matrix.target }} ${{ matrix.bundles }}
```

Also added Windows bundling tool installation:
```yaml
- name: Install Windows dependencies
  if: matrix.os == 'windows-latest'
  run: |
    choco install nsis
    choco install wixtoolset
```

## Files Changed

1. `.github/workflows/release.yml` - Added platform-specific bundle arguments and Windows tool installation

## Lessons Learned

1. **Test locally before CI** - Running `pnpm tauri build` locally revealed the bundler wasn't running. `pnpm tauri build --bundles msi` showed it worked with explicit args. This would have been discovered in minutes, not hours.

2. **Check for framework behavioral changes** - When comparing against a working reference, check for version/framework upgrades first. v0.1.0 used Tauri v1, the failing releases used Tauri v2.

3. **Read CLI help output** - `pnpm tauri build --help` shows `--bundles [<BUNDLES>...]` as an optional argument, indicating bundling is opt-in.

4. **Look for missing output, not just errors** - The logs showed "Built application" → "Looking for artifacts" with nothing between. The missing "Bundling" phase was the key evidence.

5. **Error messages can be misleading** - "No artifacts were found" suggested the bundler ran and failed, but the actual issue was the bundler never ran at all.