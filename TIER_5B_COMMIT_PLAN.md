# AI Help Desk Tier 5B Commit Plan

## 1. Suggested Commit Messages

### Commit A: Feature Implementation
```
feat(ai-help-desk): tier 5b UX + insights polish

- Add Knowledge Coverage indicator with progress bar in Knowledge tab header
- Add Search→Chat bridge CTA with toast notification
- Add Insights question clustering with filter capability
- All changes are UI-only, no API/schema changes
```

### Commit B: Documentation Updates
```
docs(ai-help-desk): update AI Help Desk Tier 5B notes

- Add Tier 5B entry to CHANGELOG.md
- Add Tier 5B Enhancements section to ai-help-desk-v3.md
```

---

## 2. Exact Git Commands

### Step 1: Check current status
```bash
git status
```

### Step 2: Commit A - Feature Implementation
```bash
git add src/app/apps/ai-help-desk/knowledge/components/KnowledgeCoverageBadge.tsx
git add src/app/apps/ai-help-desk/knowledge/utils/coverage-helper.ts
git add src/app/apps/ai-help-desk/knowledge/components/KnowledgeList.tsx
git add src/app/apps/ai-help-desk/page.tsx
git add src/app/apps/ai-help-desk/insights/components/InsightsPanel.tsx

git commit -m "feat(ai-help-desk): tier 5b UX + insights polish

- Add Knowledge Coverage indicator with progress bar in Knowledge tab header
- Add Search→Chat bridge CTA with toast notification
- Add Insights question clustering with filter capability
- All changes are UI-only, no API/schema changes"
```

### Step 3: Commit B - Documentation (after adding changelog/docs)
```bash
git add CHANGELOG.md
git add docs/apps/ai-help-desk-v3.md

git commit -m "docs(ai-help-desk): update AI Help Desk Tier 5B notes

- Add Tier 5B entry to CHANGELOG.md
- Add Tier 5B Enhancements section to ai-help-desk-v3.md"
```

### Step 4: Push (after both commits)
```bash
git push
```

**Note:** Do NOT commit the temporary files:
- `TIER_5B_CHANGELOG_ENTRY.md`
- `TIER_5B_REGRESSION_CHECKLIST.md`

---

## 3. Safety Confirmation

✅ **No API changes**
- All changes are client-side only
- No new API routes or endpoints
- No modifications to existing API routes

✅ **No schema changes**
- No database schema modifications
- No Prisma model changes
- No new database tables or columns

✅ **No new dependencies**
- All imports use existing dependencies
- No new packages added to package.json
- Only React hooks and existing OBD components used

---

## Files Changed Summary

**Feature Files (Commit A):**
1. `src/app/apps/ai-help-desk/knowledge/components/KnowledgeCoverageBadge.tsx` (NEW)
2. `src/app/apps/ai-help-desk/knowledge/utils/coverage-helper.ts` (NEW)
3. `src/app/apps/ai-help-desk/knowledge/components/KnowledgeList.tsx` (MODIFIED)
4. `src/app/apps/ai-help-desk/page.tsx` (MODIFIED)
5. `src/app/apps/ai-help-desk/insights/components/InsightsPanel.tsx` (MODIFIED)

**Documentation Files (Commit B - to be added):**
1. `CHANGELOG.md` (MODIFIED - after adding Tier 5B entry)
2. `docs/apps/ai-help-desk-v3.md` (MODIFIED - after adding Tier 5B section)

**Total:** 5 feature files (2 new, 3 modified) + 2 documentation files

