#!/usr/bin/env node
/**
 * Verify version consistency across all files
 */

const fs = require('fs');
const path = require('path');

const files = [
  'package.json',
  'src-tauri/Cargo.toml',
  'src-tauri/tauri.conf.json',
];

const extractVersion = (content, file) => {
  if (file.endsWith('Cargo.toml')) {
    const match = content.match(/^version = "(\d+\.\d+\.\d+)"/m);
    return match?.[1];
  }
  if (file.endsWith('.json')) {
    const match = content.match(/"version": "(\d+\.\d+\.\d+)"/);
    return match?.[1];
  }
  return null;
};

console.log('Checking version consistency...\n');

const versions = new Map();

files.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const version = extractVersion(content, file);
    versions.set(file, version);
    console.log(`${version || 'NOT FOUND'} — ${file}`);
  } catch (err) {
    versions.set(file, null);
    console.log(`ERROR — ${file} (${err.message})`);
  }
});

const uniqueVersions = [...new Set(versions.values())];
if (uniqueVersions.length === 1 && uniqueVersions[0]) {
  console.log(`\n✓ All files consistent at version ${uniqueVersions[0]}`);
  process.exit(0);
} else {
  console.log(`\n✗ Version mismatch detected!`);
  process.exit(1);
}