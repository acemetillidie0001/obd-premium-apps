# AI Help Desk Tier 5B Regression Checklist

**Scope:** Steps A–C (Knowledge Coverage, Search→Chat Bridge, Question Clustering)  
**Estimated Time:** <10 minutes  
**Files Changed:** See bottom of checklist

---

## Knowledge Tab (Step A)

- [ ] Knowledge Coverage badge appears in header with progress bar + status text ("Strong"/"Partial"/"Needs improvement"/"Unknown")
- [ ] Badge tooltip shows on hover; works in light/dark mode

---

## Help Desk Tab - Search (Step B)

- [ ] "Ask this as a question →" CTA appears below search results and in empty state
- [ ] CTA transitions to chat with query pre-filled; toast "Sent to chat" appears
- [ ] "Use this in chat" button uses subtle styling, disabled when no result selected, shows toast on click

---

## Insights Tab (Step C)

- [ ] Question Clusters section appears above "Top Questions" (only when topQuestions.length > 0)
- [ ] Maximum 6 cluster chips displayed, sorted by count (descending), format "Name (count)"
- [ ] "Other" cluster only shown if count > 0
- [ ] Clicking cluster chip filters questions; active cluster highlighted; "Clear filter" button appears and works
- [ ] Filtered count displays: "Top Questions (X of Y)"

---

## Empty States & Visual

- [ ] Knowledge tab: Badge shows "Unknown" when no entries; Insights clusters hidden when no questions
- [ ] Dark mode: Badge, clusters, and active highlighting render correctly
- [ ] Mobile: Badge header layout intact; cluster chips wrap; Search CTA tappable

---

## Tenant Safety

- [ ] Switch business context/businessId and confirm no data leaks: coverage badge, insights clusters, and search results are correctly scoped per business

---

## Files Changed (Tier 5B Steps A–C)

**Step A (Knowledge Coverage Indicator):**
- `src/app/apps/ai-help-desk/knowledge/components/KnowledgeCoverageBadge.tsx` (NEW)
- `src/app/apps/ai-help-desk/knowledge/utils/coverage-helper.ts` (NEW)
- `src/app/apps/ai-help-desk/knowledge/components/KnowledgeList.tsx`

**Step B (Search → Chat Bridge):**
- `src/app/apps/ai-help-desk/page.tsx`

**Step C (Question Clustering):**
- `src/app/apps/ai-help-desk/insights/components/InsightsPanel.tsx`

**Total:** 5 files (2 new, 3 modified)

