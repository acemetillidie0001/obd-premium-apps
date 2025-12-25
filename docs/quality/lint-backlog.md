# Global Lint Backlog

## Overview

This document tracks the global lint backlog for files outside the release-scoped paths. **This backlog does NOT block releases.**

## Current State

### Pre-Existing Legacy Debt

The current global lint backlog consists of pre-existing lint issues in files that are not part of the active release scope. These issues existed before the implementation of scoped lint enforcement and are being addressed incrementally.

### Release-Scoped Paths (Clean)

The following paths are part of the release scope and are maintained lint-free:

- `src/app/api/social-auto-poster`
- `src/app/apps/social-auto-poster`
- `src/lib/apps/social-auto-poster`
- `src/lib/premium.ts`
- `src/lib/auth.ts`
- `src/app/api/auth/[...nextauth]`

All files in these paths must pass lint checks before release.

## Backlog Tracking

### Legacy Files with Lint Issues

The following table tracks files outside release scope that have known lint issues. These are documented for reference and incremental cleanup:

| File Path | Issue Type | Priority | Status | Notes |
|-----------|------------|----------|--------|-------|
| *To be populated as issues are discovered* | | | | |

### Cleanup Progress

As files are touched during development work, any lint issues should be resolved at that time. This ensures the backlog shrinks incrementally without requiring dedicated cleanup sprints.

## When to Fix Lint

### Fix Immediately (Release-Scoped Paths)

Lint issues must be fixed immediately when:
- Working on files within release-scoped paths
- Introducing new code in release-scoped paths
- Modifying existing files in release-scoped paths

### Fix When Touched (Global Backlog)

Lint issues can be deferred when:
- Working on files outside release-scoped paths
- The file is part of the global lint backlog
- The issue does not affect functionality

**However**, it is recommended to fix lint issues when you're already modifying a file, as this prevents the backlog from growing.

### Never Required for Release

You are never required to:
- Fix lint issues in untouched files for a release
- Clean up the entire global lint backlog before releasing
- Block a release due to global lint backlog

## Backlog Measurement

### How to Check Backlog Size

Run the full lint command to see current state:

```bash
npm run lint:full
```

This command is informational only and does not affect the build or release process.

### Tracking Backlog Growth

Periodically review the lint backlog to ensure:
- New issues are not introduced in release-scoped paths
- Legacy issues are resolved when files are touched
- Backlog size is trending downward over time

## Policy Reference

For the complete lint quality policy, see:
- [Lint Policy](lint-policy.md) — Full policy documentation

## Notes

- This backlog is a living document and should be updated as issues are discovered or resolved
- The goal is incremental improvement, not perfection
- Releases are never blocked by global lint backlog

