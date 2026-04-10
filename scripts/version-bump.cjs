#!/usr/bin/env node
/**
 * Bump version across all files
 * Usage: node scripts/version-bump.cjs 0.2.0
 */

const fs = require('fs');
const path = require('path');

const NEW_VERSION = process.argv[2];
if (!NEW_VERSION) {
  console.error('Usage: pnpm run version:bump <semver>');
  process.exit(1);
}

const files = [
  { path: 'package.json', pattern: /"version": "\d+\.\d+\.\d+"/, replacement: `"version": "${NEW_VERSION}"` },
  { path: 'src-tauri/Cargo.toml', pattern: /^version = "\d+\.\d+\.\d+"/m, replacement: `version = "${NEW_VERSION}"` },
  { path: 'src-tauri/tauri.conf.json', pattern: /"version": "\d+\.\d+\.\d+"/, replacement: `"version": "${NEW_VERSION}"` },
];

console.log(`Bumping version to ${NEW_VERSION}...\n`);

files.forEach(({ path: filePath, pattern, replacement }) => {
  const fullPath = path.join(__dirname, '..', filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const newContent = content.replace(pattern, replacement);
    fs.writeFileSync(fullPath, newContent);
    console.log(`✓ ${filePath}`);
  } catch (err) {
    console.error(`✗ ${filePath} - ${err.message}`);
  }
});

console.log(`\nVersion bumped to ${NEW_VERSION}`);
console.log('Run `pnpm run version:verify` to confirm.');