# Release Checklist

This checklist ensures consistent, high-quality releases for OBD Premium Apps.

## Pre-Commit Checklist

Before committing release changes, verify:

### 1. Build Verification
- [ ] Run `npm run build` — must succeed with zero errors
- [ ] Build is the authoritative release gate (see [Lint Policy](../quality/lint-policy.md))

### 2. Release-Scoped Lint
- [ ] Run `npm run lint` — must pass (release-scoped paths only)
- [ ] No new lint errors introduced in touched files
- [ ] All lint issues resolved in release-scoped paths

### 3. Global Lint (Informational Only)
- [ ] Run `npm run lint:full` — informational tracking only
- [ ] Global lint backlog does NOT block release (see [Lint Policy](../quality/lint-policy.md))
- [ ] If global lint fails, reference `docs/quality/lint-policy.md` — this is expected and non-blocking

### 4. Documentation Completeness
- [ ] `CHANGELOG.md` entry created with version name and date
- [ ] Release note created: `docs/releases/[app-name]-[version].md`
- [ ] Production audit created: `docs/audits/[app-name]-[version]-production-audit.md`
- [ ] Roadmap updated: `docs/roadmap-next-steps.md` (if applicable)

### 5. Version Naming Consistency
- [ ] Same version name used in:
  - CHANGELOG.md
  - Release note (`docs/releases/*.md`)
  - Production audit (`docs/audits/*.md`)
  - Roadmap (if mentioned)
- [ ] Status language consistent:
  - "Production Ready" or specific status
  - Next phase clearly stated (if applicable)

### 6. Content Consistency
- [ ] Features match between:
  - CHANGELOG.md highlights
  - Release note "What Shipped"
  - Production audit "Issues Fixed"
- [ ] No contradictions between documents
- [ ] Technical details align across all docs

## What to Do If Global Lint Fails

**Global lint failures do NOT block releases.**

1. Check if failures are in release-scoped paths:
   - If YES: Fix before release (this is blocking)
   - If NO: Document in `docs/quality/lint-backlog.md` (non-blocking)

2. Reference [Lint Policy](../quality/lint-policy.md):
   - `npm run build` is the release gate
   - `npm run lint` verifies release-scoped quality
   - `npm run lint:full` is for tracking only

3. Proceed with release if:
   - `npm run build` succeeds
   - `npm run lint` passes (release-scoped)
   - Global lint backlog is documented

## Required Files for Each Release

### CHANGELOG.md
- Entry at top with version name, date, and status
- Highlights section with key features
- Notes section with breaking changes, limitations, etc.

### Release Note (`docs/releases/[app]-[version].md`)
- What Shipped
- Security & Access
- Performance
- Reliability
- Code Quality
- Build Safety
- QA Checklist
- Technical Details (files modified, DB changes, env vars)
- Known Limitations
- Next Steps

### Production Audit (`docs/audits/[app]-[version]-production-audit.md`)
- Audit Date
- Audit Result (GO / NO-GO)
- Scope
- Issues Fixed
- Build Verification
- Runtime Verification
- Decision
- Notes

### Roadmap (`docs/roadmap-next-steps.md`)
- Update status in relevant section
- Add "Next Phase" if applicable

## Release Gate Priority

**Explicit release gate order:**

1. **`npm run build`** — MUST succeed (blocking)
2. **`npm run lint`** — MUST pass (release-scoped paths only, blocking)
3. **`npm run lint:full`** — Informational only (non-blocking)

## Post-Release

After release is merged:
- [ ] Verify deployment succeeded
- [ ] Update roadmap if next phase is clear
- [ ] Archive audit result
- [ ] Document any post-release issues

## Related Documentation

- [Lint Quality Policy](../quality/lint-policy.md) — Release gate and lint enforcement
- [Lint Backlog](../quality/lint-backlog.md) — Global lint debt tracking

