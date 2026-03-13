---
name: gh-issue-implement
description: Work on a GitHub issue end-to-end
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(cargo:*), Bash(node:*)
---

# Issue Workflow

Work on issue: $ARGUMENTS

## Instructions

### 1. Read the issue

Use `gh issue view` to:
- Get issue details (title, description, acceptance criteria)
- Check linked issues/PRs
- Review any comments or attachments
- Check if an implementation plan has already been added in the comments

Assign yourself to the issue, then summarize:
- What needs to be done
- Acceptance criteria
- Any blockers or dependencies

### 2. Explore the codebase

Before coding:
- Reference the existing plan if available
- Search for related code
- Understand the current implementation
- Identify files that need changes

### 3. Create a branch

```bash
git checkout -b {change-type}/{issue-id}-{brief-description}
```

### 4. Implement the changes

- Write tests first (TDD)
- Follow project patterns
- Make incremental commits
- Conduct a technical debt and code simplification review

> **If you discover an unrelated bug:** create a new issue, link it to the current one, note it in the PR description, and continue with the original task.

### 5. Run tests and checks

Before opening a PR, verify everything passes:

```bash
# Rust
cargo fmt --check
cargo clippy -- -D warnings
cargo test --workspace

# Frontend
npm run lint
npm run check
npm run test
```

### 6. Update the issue

Add a comment with a progress update and note any blockers or questions.

### 7. Create PR and link

```bash
gh pr create
```

- Link the PR to the issue
- Use `feat(#N): description` format for the PR title

## Example Workflow

```
Me: /gh-issue-implement 7

Claude:
1. Fetching issue #7 from GitHub...
   Title: Add user profile avatar upload
   Description: Users should be able to upload a profile picture...
   Acceptance Criteria:
   - [ ] Upload button on profile page
   - [ ] Support JPG/PNG up to 5MB
   - [ ] Show loading state during upload

2. Searching codebase for profile-related code...
   Found: src/screens/Profile/ProfileScreen.tsx
   Found: src/components/Avatar/Avatar.tsx

3. Creating branch: feature/7-avatar-upload

4. [Implements feature following project standard practices]

5. All tests and checks pass.

6. Updating issue status...
   Adding comment: "Implementation complete, PR ready for review"

7. Creating PR and linking to #7...
   PR #456 created: feat(#7): add avatar upload to profile
```
