---
name: tech-debt
description:
  Review code for technical debt and simplification opportunities, then fix them
allowed-tools:
  Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(cargo:*), Bash(npm:*)
argument-hint: [file or directory | --branch | --branch <base>]
---

# Technical Debt Review

Target: $ARGUMENTS

## Determining scope

Resolve what to review based on the argument:

| Argument                 | Files to review                                                                 |
| ------------------------ | ------------------------------------------------------------------------------- |
| `--branch`               | Files changed on this branch vs `main` (`git diff main...HEAD --name-only`)     |
| `--branch <base>`        | Files changed on this branch vs `<base>` (`git diff <base>...HEAD --name-only`) |
| A file or directory path | That path only                                                                  |
| _(none)_                 | Files changed since the last commit (`git diff HEAD --name-only`)               |

For `--branch`, first run `git diff <base>...HEAD --name-only` to get the file
list, then read each file in full. Focus the review on the changed code but flag
any debt in surrounding context that is clearly related.

## What to look for

### General

- Dead code: unused variables, functions, imports, exports
- Duplication: copy-pasted logic that should be a shared function or utility
- Premature abstractions: helpers or utilities used only once; over-engineered
  generics
- Unnecessary complexity: conditionals that can be simplified, nested logic that
  can be flattened
- Magic numbers / strings that should be named constants
- Inconsistent naming that obscures intent
- Missing or out-of-date documentation

### Svelte / Frontend

- Legacy Svelte 4 patterns (`export let`, `$:`, writable stores) — migrate to
  Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props()`)
- Custom components that duplicate shadcn-svelte functionality — replace with
  the standard component
- `any` types — replace with proper TypeScript types
- Unused Svelte stores or derived values
- Overly verbose event handlers that can be inlined

### Rust

- Unwrap / expect calls that should use proper error propagation with `?`
- Clippy warnings or style issues (`cargo clippy`)
- Functions doing too much — identify single-responsibility violations
- Repeated `match` arms or `if let` chains that could use combinators

## Process

1. **Read** the target files carefully before suggesting anything
2. **List** every debt item found, grouped by category, with file:line
   references
3. **Prioritise** — mark each item High / Medium / Low based on impact and risk
4. **Fix** High and Medium items directly; note Low items for the user to decide
5. **Verify** — after edits, run the relevant checks:
   - Rust: `cargo clippy -- -D warnings` and `cargo test --workspace`
   - Frontend: `npm run lint`, `npm run check`, `npm run test`
6. **Summarise** what was changed and what (if anything) was left for the user

> If a fix requires a non-trivial refactor that could break behaviour, stop and
> ask the user before proceeding.
