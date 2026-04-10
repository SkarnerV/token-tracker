#!/usr/bin/env node
/**
 * Prepare release: bump, test, commit, tag
 * Usage: node scripts/release-prepare.cjs 0.2.0
 */

const { execSync } = require('child_process');

const VERSION = process.argv[2];
if (!VERSION) {
  console.error('Usage: pnpm run release:prepare <semver>');
  console.error('Example: pnpm run release:prepare 0.2.0');
  process.exit(1);
}

try {
  // 1. Check we're on main
  const branch = execSync('git branch --show-current').toString().trim();
  if (branch !== 'main') {
    console.error(`Error: Must be on main branch (currently on ${branch})`);
    process.exit(1);
  }

  // 2. Check for uncommitted changes
  try {
    execSync('git diff-index --quiet HEAD --');
  } catch {
    console.error('Error: Uncommitted changes detected. Commit or stash first.');
    process.exit(1);
  }

  // 3. Run version bump
  console.log(`\n📦 Bumping version to ${VERSION}...`);
  execSync(`node ${__dirname}/version-bump.cjs ${VERSION}`, { stdio: 'inherit' });

  // 4. Verify
  console.log('\n🔍 Verifying version consistency...');
  execSync(`node ${__dirname}/version-verify.cjs`, { stdio: 'inherit' });

  // 5. Run tests
  console.log('\n🧪 Running tests...');
  execSync('pnpm test', { stdio: 'inherit' });

  // 6. Run lint
  console.log('\n🔬 Running lint...');
  execSync('pnpm lint', { stdio: 'inherit' });

  // 7. Run typecheck
  console.log('\n📝 Running typecheck...');
  execSync('pnpm typecheck', { stdio: 'inherit' });

  // 8. Commit
  console.log('\n💾 Committing changes...');
  execSync('git add -A');
  execSync(`git commit -m "chore: bump version to ${VERSION}"`);

  // 9. Create tag
  console.log('\n🏷️  Creating tag...');
  execSync(`git tag v${VERSION}`);

  console.log(`\n✅ Release v${VERSION} prepared!`);
  console.log('\nNext steps:');
  console.log(`  git push origin main`);
  console.log(`  git push origin v${VERSION}`);
  console.log('  gh release create v' + VERSION + ' --generate-notes');

} catch (error) {
  console.error('\n❌ Release preparation failed');
  process.exit(1);
}