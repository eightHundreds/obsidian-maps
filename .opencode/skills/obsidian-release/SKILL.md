---
name: obsidian-release
description: Release Obsidian plugin to GitHub. Use when user wants to publish, release, bump version, or create a new version of the plugin. Handles version synchronization across manifest.json, package.json, versions.json, git tagging, and GitHub release creation.
---

# Obsidian Plugin Release

Automate the release process for Obsidian plugins with proper version synchronization and GitHub release creation.

## Release Workflow

### Step 1: Determine New Version

Ask user for version number if not provided. Follow SemVer:
- **patch** (0.1.6 → 0.1.7): Bug fixes
- **minor** (0.1.6 → 0.2.0): New features, backward compatible
- **major** (0.1.6 → 1.0.0): Breaking changes

### Step 2: Update Version Files

Three files MUST be synchronized:

```bash
# 1. manifest.json - Plugin metadata (REQUIRED)
# Update "version" field

# 2. package.json - npm metadata (REQUIRED)
# Update "version" field

# 3. versions.json - Version → minAppVersion mapping (REQUIRED)
# Add new entry: "NEW_VERSION": "MIN_APP_VERSION"
```

**Critical**: All three files must have matching version numbers. GitHub Actions will fail if they don't match.

Get `minAppVersion` from current `manifest.json`.

### Step 3: Commit Version Changes

```bash
git add manifest.json package.json versions.json
git commit -m "Bump version to X.Y.Z"
```

### Step 4: Create and Push Tag

```bash
# Tag WITHOUT 'v' prefix (Obsidian convention)
git tag X.Y.Z

# Push commit and tag
git push origin main && git push origin X.Y.Z
```

### Step 5: Verify Release

After pushing, GitHub Actions automatically:
1. Validates version consistency
2. Builds the plugin (`npm run build`)
3. Creates GitHub Release with `main.js`, `manifest.json`, `styles.css`

Check: `https://github.com/OWNER/REPO/actions`

## Quick Reference

| File | Field | Example |
|------|-------|---------|
| manifest.json | `"version"` | `"0.1.7"` |
| package.json | `"version"` | `"0.1.7"` |
| versions.json | `"0.1.7"` | `"1.10.2"` |

## Common Issues

**Version mismatch error**: Ensure all three files have identical version strings.

**Tag already exists**: Delete old tag first: `git tag -d X.Y.Z && git push origin :refs/tags/X.Y.Z`

**Build fails**: Run `npm run build` locally first to catch errors.
