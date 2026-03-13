---
name: gh-issue-plan
description: Create a plan for a GitHub issue
allowed-tools: Read, Glob, Grep, Bash(gh:*)
---

# Issue Workflow

Create a plan for issue: $ARGUMENTS

## Instructions

### 1. Enter plan mode

If you are not already, enter "plan mode".
- You are only allowed to analyze the codebase, read files, and suggest plans.
- You must not use any tools that modify files (like Edit or Write).
- Your response should be a plan for how a developer could implement the issue.
- Do not attempt to implement it yourself.

### 2. Read the issue

If a number is provided as the argument:

- Use `gh issue view` to get issue details (title, description, acceptance criteria), check linked issues/PRs, and review any comments.

If a textual description is provided instead:

- Ask follow-up questions if the description is unclear.
- Enhance the description to make it clearer and more detailed.
- Use `gh issue create` to create a new issue from the description.

### 3. Explore the codebase

- Search for related code.
- Understand the current implementation.
- Identify files that need changes.

### 4. Create and post the plan

Assign yourself to the issue, then post a detailed plan as an issue comment using `gh issue comment`. Include:

- What needs to be done.
- Acceptance criteria.
- Files to change and how.
- Any blockers or dependencies.
- Docs to update.
- Final technical debt and code simplification review

**IMPORTANT:** Post the complete, unabridged plan — do not summarize.

## Example Workflow

```
Me: /gh-issue-plan 7

Claude:
1. Fetching issue #7 from GitHub...
   `gh issue view 7`
   Title: Add user profile avatar upload
   Description: Users should be able to upload a profile picture...
   Acceptance Criteria:
   - [ ] Upload button on profile page
   - [ ] Support JPG/PNG up to 5MB
   - [ ] Show loading state during upload

2. Searching codebase for profile-related code...
   Found: src/screens/Profile/ProfileScreen.tsx
   Found: src/components/Avatar/Avatar.tsx

3. Posting plan as issue comment...
   `gh issue comment 7 --body "..."`
```
