#!/usr/bin/env node
/**
 * Obsidian Plugin Release Script
 * 
 * Usage:
 *   node release.mjs <version>
 *   node release.mjs 0.1.7
 * 
 * This script:
 * 1. Updates version in manifest.json, package.json, versions.json
 * 2. Commits the changes
 * 3. Creates a git tag
 * 4. Pushes to remote (triggers GitHub Actions release)
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const version = process.argv[2];

if (!version) {
  console.error('Usage: node release.mjs <version>');
  console.error('Example: node release.mjs 0.1.7');
  process.exit(1);
}

// Validate semver format
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version format: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-prerelease');
  process.exit(1);
}

function run(cmd, options = {}) {
  console.log(`$ ${cmd}`);
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'inherit', ...options });
  } catch (e) {
    if (!options.ignoreError) {
      process.exit(1);
    }
  }
}

function readJSON(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
  writeFileSync(file, JSON.stringify(data, null, '\t') + '\n');
}

// Check for uncommitted changes
try {
  execSync('git diff --quiet && git diff --cached --quiet', { stdio: 'pipe' });
} catch {
  console.error('Error: You have uncommitted changes. Please commit or stash them first.');
  process.exit(1);
}

// Check if tag already exists
try {
  execSync(`git rev-parse ${version}`, { stdio: 'pipe' });
  console.error(`Error: Tag ${version} already exists.`);
  console.error(`To delete it: git tag -d ${version} && git push origin :refs/tags/${version}`);
  process.exit(1);
} catch {
  // Tag doesn't exist, good to proceed
}

console.log(`\n📦 Releasing version ${version}\n`);

// 1. Update manifest.json
console.log('Updating manifest.json...');
const manifest = readJSON('manifest.json');
const minAppVersion = manifest.minAppVersion;
manifest.version = version;
writeJSON('manifest.json', manifest);

// 2. Update package.json
console.log('Updating package.json...');
const pkg = readJSON('package.json');
pkg.version = version;
writeJSON('package.json', pkg);

// 3. Update versions.json
console.log('Updating versions.json...');
const versions = readJSON('versions.json');
versions[version] = minAppVersion;
writeJSON('versions.json', versions);

// 4. Commit changes
console.log('\nCommitting version bump...');
run('git add manifest.json package.json versions.json');
run(`git commit -m "Bump version to ${version}"`);

// 5. Create tag
console.log(`\nCreating tag ${version}...`);
run(`git tag ${version}`);

// 6. Push
console.log('\nPushing to remote...');
run('git push');
run(`git push origin ${version}`);

console.log(`\n✅ Released version ${version}`);
console.log('\nGitHub Actions will now build and create the release.');
console.log('Check progress at: https://github.com/$(git remote get-url origin | sed "s/.*github.com[:/]//;s/.git$//")/actions');
