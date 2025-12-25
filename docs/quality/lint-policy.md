# Lint Quality Policy

## Purpose

This document defines the lint quality tracking process for the OBD Premium Apps monorepo. Scoped lint enforcement ensures that releases are never blocked by legacy lint debt while maintaining code quality standards for new work.

## Definitions

### Release-Scoped Lint (Blocking)

**Release-scoped lint** refers to linting only the files and directories that are touched in the current release cycle. This is enforced via the `npm run lint` command, which targets specific scoped paths:

- `src/app/api/social-auto-poster`
- `src/app/apps/social-auto-poster`
- `src/lib/apps/social-auto-poster`
- `src/lib/premium.ts`
- `src/lib/auth.ts`
- `src/app/api/auth/[...nextauth]`

**Release-scoped lint is blocking**: All files in these paths must pass lint checks before a release can proceed.

### Global Lint Backlog (Non-Blocking)

**Global lint backlog** refers to lint issues in files outside the release-scoped paths. These are tracked via `npm run lint:full`, which lints the entire `src` directory.

**Global lint backlog is non-blocking**: Pre-existing lint issues in untouched files do not prevent releases. This backlog is cleaned up incrementally over time.

## Prior ENOENT Confusion Explanation

### What Happened

In the past, there was confusion about "missing" documentation paths (ENOENT errors) that appeared to be build or lint failures.

### Root Cause

These ENOENT errors were caused by:
- Missing documentation directories (e.g., `docs/quality/`)
- Documentation tools attempting to read files that didn't exist
- No build or lint failures—simply missing file paths

### Resolution

This confusion has been resolved by:
- Ensuring all required documentation directories exist
- Using `.gitkeep` files to preserve directory structure in version control
- Clear separation between build failures (blocking) and missing docs (informational)

## Policy Rules

### 1. No New Lint Debt in Touched Files

When working on files within release-scoped paths:
- **All lint issues must be resolved before release**
- New code must pass lint checks
- Modifications to existing files must not introduce new lint errors

### 2. Global Lint Cleanup is Incremental

For files outside release-scoped paths:
- Pre-existing lint issues do not block releases
- Cleanup is handled incrementally as files are touched
- No rush to fix legacy debt in untouched code

### 3. Builds are the Source of Truth for Release Readiness

- `npm run build` is the authoritative release gate
- If the build succeeds, the release is ready
- Lint is a quality tool, not a build blocker (except for release-scoped paths)

## Release Gate

### Explicit Statement

**`npm run build` is the release gate.**

- A successful build indicates release readiness
- `npm run lint` verifies release-scoped code quality
- `npm run lint:full` is for tracking global lint debt only—it does not block releases

### Release Checklist

1. ✅ Run `npm run build` — must succeed
2. ✅ Run `npm run lint` — must pass (release-scoped paths only)
3. ⚠️ Run `npm run lint:full` — informational only (does not block)

## Enforcement

### Development Workflow

- Developers should run `npm run lint` before committing changes to release-scoped paths
- Pre-commit hooks or CI checks should verify release-scoped lint passes
- Global lint backlog tracking is optional and incremental

### Release Process

- Build must succeed (`npm run build`)
- Release-scoped lint must pass (`npm run lint`)
- Global lint backlog is informational (`npm run lint:full`)

## Related Documentation

- [Lint Backlog Tracking](lint-backlog.md) — Current state of global lint debt
- [CHANGELOG.md](../../CHANGELOG.md) — Release history

