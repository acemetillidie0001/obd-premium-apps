# Offers & Promotions Builder — Production Verification Checklist

**Date:** 2024-12-19  
**Version:** Tier 5B + Tier 5C  
**Environment:** Vercel Production

---

## Pre-Deployment Verification

- [ ] All TypeScript errors resolved (`pnpm run typecheck`)
- [ ] All linting warnings reviewed (`pnpm run lint`)
- [ ] Build succeeds locally (`pnpm run vercel-build`)
- [ ] Git working tree clean
- [ ] CHANGELOG.md updated
- [ ] Audit report reviewed (`docs/deployments/OFFERS_PROMOTIONS_TIER5_AUDIT_REPORT.md`)

---

## Post-Deployment Verification (Vercel Production)

### Tier 5B Core Features

- [ ] **Lifecycle State:**
  - Create offer without required fields → verify "Draft" status pill appears
  - Fill required fields → verify "Active" status pill appears
  - Set expiration date in past → verify "Expired" status pill appears
  - Click archive toggle → verify "Archived" status pill appears

- [ ] **Expiration Awareness:**
  - Set expiration date 3 days in future → verify "Expires in 3 days" appears in form
  - Set expiration date in past → verify "This offer is expired" warning appears
  - Verify expiration status shown in preview cards (Facebook, GBP)

- [ ] **Regenerate with Constraints:**
  - Generate offer with "20% off" and expiration date
  - Click "Regenerate" → verify locked facts preserved (value, expiration, CTA)
  - Verify drift detector toast appears if drift detected
  - Verify no drift toast if no changes needed

- [ ] **Inline Editing:**
  - Edit a social post headline → click "Save" → verify "Edited" badge appears
  - Click "Reset to last generated" → verify original restored
  - Verify toast messages appear correctly

- [ ] **Export/Copy Uses Edits:**
  - Generate offer → edit a social post → click "Copy" → verify edited version copied
  - Verify `getAuthoritativeOutput()` returns edited version

### Tier 5C Handoffs

- [ ] **Social Auto-Poster Handoff:**
  - Generate offer with social posts
  - Click "Send to Social Auto-Poster"
  - Verify new tab opens to `/apps/social-auto-poster/composer?handoff=1`
  - Verify draft campaign appears with posts from offer
  - Verify expiration date included if present
  - Verify suggested posting window hint appears (if expiration within 10 days)
  - Verify URL param removed after Apply/Dismiss

- [ ] **AI Content Writer Handoff:**
  - Generate offer
  - Click "Turn this offer into a landing page"
  - Verify new tab opens to `/apps/content-writer?handoff=1`
  - Verify import banner appears at top with offer summary
  - Click "Apply to inputs" → verify form populated with offer details
  - Verify `contentGoal` includes offer context
  - Verify `topic` includes offer headline
  - Verify `notesForAI` includes offer facts
  - Click "Dismiss" → verify banner removed, URL param removed
  - Verify duplicate send modal appears if same hash sent within 30 minutes

- [ ] **Event Campaign Builder Handoff:**
  - Generate offer with startDate and endDate (or event-like language)
  - Verify contextual suggestion appears (if event-like)
  - Click "Create an Event Campaign"
  - Verify new tab opens to `/apps/event-campaign-builder?handoff=1`
  - Verify import banner appears at top with event details
  - Click "Apply to inputs" → verify additive apply (only empty fields filled)
  - Verify `eventName` populated from `promoTitle`
  - Verify `eventDate` populated from `startDate` or `endDate`
  - Verify `notesForAI` appended with primaryCTA and promoCopy
  - Verify date formatting correct (uses `formatEventDateRange()`)
  - Click "Dismiss" → verify banner removed, URL param removed
  - Verify suggestion can be dismissed (sessionStorage)

- [ ] **AI Help Desk Awareness:**
  - Generate offer
  - Verify awareness callout appears (if not dismissed)
  - Click dismiss → verify callout hidden, sessionStorage set
  - Verify callout reappears on new page load if not dismissed

### URL & Session Management

- [ ] **URL Cleanup:**
  - After Apply/Dismiss in any receiver → verify `?handoff=1` removed from URL
  - Verify no page reload occurs (uses `replaceUrlWithoutReload()`)

- [ ] **SessionStorage TTL:**
  - Send handoff → wait 10+ minutes → verify handoff expired message appears
  - Verify expired handoffs are cleared automatically

- [ ] **Duplicate Send Guard:**
  - Send same offer to ACW twice within 30 minutes → verify modal appears
  - Verify modal allows override or cancel

### Event Campaign Builder Utilities

- [ ] **Date Parsing:**
  - Verify `safeParseDate()` handles ISO strings, date strings, timestamps
  - Verify invalid dates return null gracefully

- [ ] **Date Formatting:**
  - Verify `formatEventDateRange()` formats single dates correctly
  - Verify range formatting (same month vs different months)
  - Verify null handling for invalid dates

- [ ] **Payload Validation:**
  - Verify `validateEventHandoffPayload()` checks for eventName/title
  - Verify date field validation works correctly

---

## Performance Checks

- [ ] Page load time acceptable (< 3s)
- [ ] No console errors in browser DevTools
- [ ] No network errors in browser DevTools
- [ ] Handoff operations complete within 1 second

---

## Cross-Browser Testing

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, if available)

---

## Mobile Responsiveness

- [ ] Form sections stack correctly on mobile
- [ ] Handoff buttons accessible on mobile
- [ ] Import banners display correctly on mobile
- [ ] Toast messages visible on mobile

---

## Notes

- All handoffs use sessionStorage with 10-minute TTL
- All receivers use additive apply (only fill empty fields)
- URL cleanup happens after Apply/Dismiss in all receivers
- Event Campaign Builder uses new handoff utilities for date handling

---

**Verification Completed By:** _________________  
**Date:** _________________  
**Status:** ☐ Pass  ☐ Fail (notes below)

**Notes:**

