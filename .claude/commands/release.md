---
name: release
description:
  Bump version and publish a new release of the addon (patch, minor, or major)
allowed-tools:
  Read, Edit, Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git
  push:*), Bash(git log:*), Bash(node:*), AskUserQuestion
---

## Context

- Current versions:
  !`node -e "const p=require('./package.json');const m=require('./manifest.json');console.log('package.json: '+p.version+'\nmanifest.json: '+m.version)"`
- Current branch: !`git branch --show-current`
- Git status: !`git status --short`

## Your task

The user wants to publish a new release. The bump type is provided as an
argument: `patch`, `minor`, or `major`. If no argument was given, ask the user
which bump type they want.

### 1. Calculate new version

Given the current version from `package.json`, compute the new version by
bumping the appropriate segment:

- `patch` — increment the third number (e.g. 0.1.1 → 0.1.2)
- `minor` — increment the second number, reset patch to 0 (e.g. 0.1.1 → 0.2.0)
- `major` — increment the first number, reset minor and patch to 0 (e.g. 0.1.1 →
  1.0.0)

### 2. Confirm with the user

Before making any changes, present a summary and ask for confirmation:

```
Ready to release:
  Bump type : <patch|minor|major>
  Version   : <current> → <new>
  Files     : package.json, manifest.json
  Actions   : commit "chore: bump version to <new>" → push to main → push to release branch

Proceed? (yes/no)
```

Only continue if the user confirms.

### 3. Check for uncommitted changes

If `git status` shows uncommitted changes, warn the user and ask whether to
proceed anyway or abort.

### 4. Update version files

Using the Edit tool, update the `"version"` field in both:

- `package.json`
- `manifest.json`

Both must be set to exactly the same new version string.

### 5. Commit and push

```bash
git add package.json manifest.json
git commit -m "chore: bump version to <new>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
git push origin main:release
```

### 6. Confirm completion

Report the new version and confirm that the release CI has been triggered on the
`release` branch.

## Important

- Never skip the user confirmation step
- Ensure `package.json` and `manifest.json` versions are always identical
- Do not push if the commit fails
- Do not bump the version if the working tree has uncommitted changes unless the
  user explicitly approves
