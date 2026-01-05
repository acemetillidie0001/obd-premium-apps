# Tier 5B Git Commit Commands

## Step 1: Check Status
```bash
git status
```

## Step 2: Commit 1 - Feature Implementation

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

## Step 3: Commit 2 - Documentation

```bash
git add TIER_5B_REGRESSION_CHECKLIST.md
git add CHANGELOG.md
git add docs/apps/ai-help-desk-v3.md

git commit -m "docs: add tier 5b checklist and notes

- Add Tier 5B regression checklist
- Add Tier 5B entry to CHANGELOG.md
- Add Tier 5B Enhancements section to ai-help-desk-v3.md"
```

## Step 4: Push

```bash
git push
```

---

**Note:** The following temporary files should NOT be committed:
- `TIER_5B_DOC_UPDATES.md`
- `TIER_5B_COMMIT_PLAN.md`
- `TIER_5B_CHANGELOG_ENTRY.md`
- `TIER_5B_GIT_COMMANDS.md` (this file)

