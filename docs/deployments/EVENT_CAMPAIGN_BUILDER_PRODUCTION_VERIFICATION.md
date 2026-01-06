# Event Campaign Builder — Production Verification

**Date:** TBD  
**Version:** Tier 5A + Tier 5B + Tier 5C  
**Environment:** Vercel Production  
**Status:** Production Ready

---

## 1. Purpose + Scope

**Purpose:**  
Event Campaign Builder is a campaign orchestration planner for time-bound events. It generates structured, multi-channel campaign drafts (text, copy, suggestions) that users can manually review, edit, and use elsewhere.

**Scope:**  
- Multi-channel campaign content generation (Facebook, Instagram, X, Google Business, Email, SMS, Image Captions)
- Canonical output state management with inline editing
- Countdown variant selector with lock-after-edit protection
- Tier 5C link-only integrations to Content Writer, Image Caption Generator, and Social Auto-Poster
- AI Help Desk awareness (read-only, informational)

**Out of Scope (Explicit):**  
- ❌ Auto-publishing to any platform
- ❌ Auto-scheduling posts or messages
- ❌ Background jobs or cron tasks
- ❌ CRM writes or customer data persistence
- ❌ Calendar mutations or ICS file generation
- ❌ Ticketing logic or reservation systems
- ❌ Payment processing
- ❌ SMS sending (content generation only)
- ❌ Email sending (content generation only)

---

## 2. Current Status

**Status:** Production Ready / Reference-Quality

**Architecture Compliance:**  
✅ All architectural guardrails enforced  
✅ No trust & safety violations  
✅ Canonical state model implemented  
✅ Tier 5C integrations follow suite patterns

---

## 3. Deployment Notes

### Pre-Deployment Checklist
- [ ] All TypeScript errors resolved (`pnpm run typecheck`)
- [ ] All linting warnings reviewed (`pnpm run lint`)
- [ ] Build succeeds locally (`pnpm run vercel-build`)
- [ ] Git working tree clean
- [ ] Trust & Safety audit passed (no auto-publish, no schedule, no background jobs)

### Post-Deployment Verification
- [ ] App loads at `/apps/event-campaign-builder`
- [ ] Form validation works correctly
- [ ] Campaign generation succeeds
- [ ] All Tier 5C handoffs function correctly
- [ ] No console errors in production

---

## 4. Verification Checklist

### A) App Access & Load States

- [ ] **App Loads:** Navigate to `/apps/event-campaign-builder` → page loads without errors
- [ ] **Form Initialization:** All form fields initialize with default values
- [ ] **Loading State:** Click "Generate Campaign" → loading spinner appears, button disabled
- [ ] **Error Handling:** Submit with invalid data → error message displays correctly
- [ ] **Success State:** After successful generation → success toast appears, results section visible
- [ ] **Empty State:** Before generation → results section not visible, status chip shows "Draft"

### B) Tier 5A UX (Accordion Sections, Sticky Action Bar, Counters)

- [ ] **Accordion Sections:** Form organized into 7 accordion sections:
  - [ ] Business Basics (collapsed by default)
  - [ ] Event Details (expanded by default)
  - [ ] Audience & Strategy (collapsed)
  - [ ] Brand & Style (collapsed)
  - [ ] Channels (collapsed)
  - [ ] Campaign Timing (collapsed)
  - [ ] Advanced Notes (collapsed)
- [ ] **Accordion Summaries:** Collapsed sections show live summary lines (e.g., "Spring Open House • Mar 15 • In-Person")
- [ ] **Sticky Action Bar:** Action bar appears at bottom of viewport, stays visible on scroll
- [ ] **Status Chip:** Shows "Draft" | "Generated" | "Edited" based on campaign state
- [ ] **Action Buttons:** "Generate Campaign" (primary), "Reset", "Export / Next Steps" buttons present
- [ ] **Disabled States:** Buttons show tooltips when disabled (e.g., "Generate Campaign" disabled when loading)
- [ ] **Character Counters (Soft):** 
  - [ ] Event description shows character count (warning-only, non-blocking)
  - [ ] SMS blasts show character count with 140-char guidance
  - [ ] Google Business posts show character count with 1500-char guidance
  - [ ] X (Twitter) posts show character count with 280-char guidance
  - [ ] Counters display subtle warning text when exceeded (no validation errors)

### C) Tier 5B Canonical Output State

- [ ] **CampaignItem[] Structure:** Generated content stored as `CampaignItem[]` with stable IDs
- [ ] **Active Campaign Selector:** `getActiveCampaignList()` returns edited campaign if present, else generated
- [ ] **No Result Rendering:** Results section renders exclusively from `activeCampaign`, never from `result` object
- [ ] **Selectors Work:** Helper selectors extract items correctly:
  - [ ] `getItemsForChannel()` returns platform-specific items
  - [ ] `getItemsByType()` returns items by type
  - [ ] `getMetaItem()` returns meta items (tagline, CTA, etc.)
  - [ ] `getSingleAsset()` returns single assets (longDescription, imageCaption)
- [ ] **Character Counters Use Active Content:** Counters display length of edited content if present, else generated
- [ ] **Exports Use Active Campaign:** Export/Next Steps use `activeCampaign` as source, not `result`
- [ ] **Handoffs Use Active Campaign:** All Tier 5C handoffs build payloads from `activeCampaign` selectors

### D) Inline Editing

- [ ] **Edit Button:** Each channel output (Facebook, Instagram, X, Google Business, Email, SMS, Image Caption) has "Edit" button
- [ ] **Edit Mode:** Click "Edit" → textarea appears with current content, "Save" and "Cancel" buttons visible
- [ ] **Save Edit:** 
  - [ ] Enter edited text → click "Save" → edit saved to `editedCampaign` state
  - [ ] Empty content → "Save" disabled, validation message appears
  - [ ] Toast message "Edit saved" appears
- [ ] **Cancel Edit:** Click "Cancel" → edit discarded, returns to view mode
- [ ] **Edited Badge:** After saving edit → "Edited" badge appears next to item
- [ ] **Reset to Generated:** 
  - [ ] Click "Reset" on edited item → reverts to generated version
  - [ ] Toast message "Reset to generated version" appears
  - [ ] If all items reset → `editedCampaign` cleared, status chip returns to "Generated"
- [ ] **Status Chip Updates:** 
  - [ ] No items → "Draft"
  - [ ] Items exist, no edits → "Generated"
  - [ ] Items exist + any edit → "Edited"
- [ ] **Edit Persistence:** Edits persist across rerenders (stable IDs used)

### E) Variant Selector + Lock After Edit

- [ ] **Variant Selector:** Dropdown appears in Social Media Posts section header (when X/SMS/GBP posts present)
- [ ] **Variant Options:** Dropdown shows "7 days out" | "3 days out" | "Day-of"
- [ ] **Variant Persistence:** Selected variant persists in `sessionStorage` across page reloads
- [ ] **Variant Content:** Switching variants updates countdown text in X/SMS/GBP posts (for non-edited items)
- [ ] **Lock After Edit:** 
  - [ ] Edit any item → variant selector becomes disabled
  - [ ] Tooltip appears on hover: "Variant switching is locked after editing to prevent content loss"
- [ ] **Reset All Edits Button:** 
  - [ ] When locked, "Reset all edits" button appears next to variant selector
  - [ ] Click "Reset all edits" → all edits cleared, variant selector unlocked
  - [ ] Toast message "All edits reset - variant switching unlocked" appears
- [ ] **Edited Items Exempt:** Edited items do not change when variant switches (preserves user edits)

### F) Tier 5C Integrations

#### F1) Event Campaign Builder → AI Content Writer (Landing Page Mode)

- [ ] **CTA Button:** "Turn this event into a landing page" button appears in Results section
- [ ] **Button Styling:** Uses standard Tier 5C CTA styling (`SUBMIT_BUTTON_CLASSES`)
- [ ] **Payload Building:** 
  - [ ] Builds from canonical state (`activeCampaign` selectors)
  - [ ] Includes: event facts, description, agenda bullets, CTA, FAQ seeds
- [ ] **Navigation:** Click button → new tab opens to `/apps/content-writer?handoff=1`
- [ ] **Receiver Behavior:** 
  - [ ] Import banner appears with event summary
  - [ ] Click "Apply to inputs" → form populated (additive, empty fields only)
  - [ ] `contentType` set to "LandingPage"
  - [ ] Custom outline built with description, agenda, FAQ seeds
  - [ ] No auto-generation occurs
  - [ ] Click "Dismiss" → banner removed, URL param cleared

#### F2) Event Campaign Builder → AI Image Caption Generator

- [x] **VERIFIED** — All checks passed

**Verification Evidence:**

The Tier 5C link-only integration from Event Campaign Builder to AI Image Caption Generator is implemented and meets all requirements.

**Sender (Event Campaign Builder) — verified:**
- CTA button: "Generate image captions for this event" (line 3760)
- Styling: Uses `SUBMIT_BUTTON_CLASSES` (line 3830)
- Payload from canonical state:
  - Uses `longDescription?.content` or `shortDescriptions[0]?.content` (lines 3780-3783)
  - Extracts hashtags from `hashtagBundles` (lines 3790-3801)
  - Includes event facts, tone, urgency (lines 3767-3787)
- SessionStorage: Uses `writeHandoff()` with TTL (line 3818)
- Navigation: Opens new tab with `?handoff=1` (line 3821)

**Receiver (AI Image Caption Generator) — verified:**
- EventImportBanner component: Exists and matches Offers/ACW pattern
- Summary line: Shows event name + date + type (lines 45-67)
- Buttons: "Apply to inputs" and "Dismiss" (lines 94-105)
- Apply-to-inputs:
  - Fills empty fields only (all checks use `!prev.field.trim()`) (lines 340-398)
  - Does not auto-generate (no calls to `generateCaptions` or `handleSubmit`)
  - Non-destructive (only updates empty fields)
- Dismiss:
  - Clears payload: `clearHandoff()` (line 425)
  - Removes URL param: `clearHandoffParamsFromUrl()` (line 426)
  - Updates URL: `replaceUrlWithoutReload()` (line 427)
- Handoff guard: Uses `getHandoffHash()` and `wasHandoffAlreadyImported()` to prevent duplicates (lines 311-316)

**Non-negotiables — verified:**
- No auto-generation: Apply only fills form fields
- No mutation across apps: Link-only via sessionStorage
- User-confirmed apply: Requires clicking "Apply to inputs"
- Draft-only transport: Uses sessionStorage with TTL

**Conclusion:** The integration is complete and compliant with Tier 5C requirements. No changes needed.

#### F3) Social Auto-Poster Handoff

- [ ] **CTA Button:** "Create Event Social Posts" button appears in Social Posts section
- [ ] **Payload Building:** 
  - [ ] Builds handoff payload from `activeCampaign`
  - [ ] Includes: event name, date, location, description, countdown variants
- [ ] **Navigation:** Click button → new tab opens to `/apps/social-auto-poster/composer?handoff=1`
- [ ] **Receiver Behavior:** 
  - [ ] Draft campaign created with event posts
  - [ ] Countdown variants included as suggestions
  - [ ] Link-only, draft-only transport (no auto-publish)

#### F4) AI Help Desk Awareness Banner

- [ ] **Banner Display:** Dismissible informational callout appears: "This event can be answered by your AI Help Desk once published."
- [ ] **Dismissal:** Click dismiss → banner hidden, `sessionStorage` set
- [ ] **Persistence:** Banner does not reappear if dismissed (sessionStorage check)
- [ ] **Read-Only:** Banner is informational only (no syncing, mutation, or generation)

### G) Trust & Safety Guardrails

- [ ] **No Auto-Publishing:** Verify no API calls to social media platforms (Facebook, Instagram, X, Google Business)
- [ ] **No Auto-Scheduling:** Verify no scheduling logic, cron jobs, or background tasks
- [ ] **No Background Jobs:** Verify no workers, queues, or scheduled operations
- [ ] **No CRM Writes:** Verify no database operations or CRM integrations
- [ ] **No Calendar Mutations:** Verify no calendar API calls or ICS file generation
- [ ] **No Ticketing Logic:** Verify no ticket sales or reservation systems
- [ ] **No Payments:** Verify no payment processing or financial transactions
- [ ] **No SMS Sending:** Verify SMS content generated but never sent (no Twilio/SendGrid calls)
- [ ] **No Email Sending:** Verify email content generated but never sent

---

## 5. How to Test Tier 5C Handoffs

### Step-by-Step Verification Process

1. **Generate Campaign:**
   - Fill out Event Campaign Builder form
   - Click "Generate Campaign"
   - Wait for results to appear

2. **Test Content Writer Handoff:**
   - Click "Turn this event into a landing page"
   - Verify new tab opens with `?handoff=1` in URL
   - Verify import banner appears at top with event summary
   - Click "Apply to inputs"
   - Verify form fields populated (additive, empty fields only)
   - Verify `contentType` set to "LandingPage"
   - Verify no auto-generation occurs (must click "Write Content" manually)
   - Click "Dismiss" → verify banner removed, URL param removed
   - Refresh page → verify banner does not reappear (duplicate guard)

3. **Test Image Caption Generator Handoff:**
   - Return to Event Campaign Builder
   - Click "Generate image captions for this event"
   - Verify new tab opens with `?handoff=1` in URL
   - Verify import banner appears with event summary
   - Click "Apply to inputs"
   - Verify form fields populated (additive, empty fields only)
   - Verify `imageContext` and `imageDetails` filled
   - Verify no auto-generation occurs (must click "Write Captions" manually)
   - Click "Dismiss" → verify banner removed, URL param removed
   - Refresh page → verify banner does not reappear (duplicate guard)

4. **Test Social Auto-Poster Handoff:**
   - Return to Event Campaign Builder
   - Click "Create Event Social Posts"
   - Verify new tab opens with `?handoff=1` in URL
   - Verify draft campaign created with event posts
   - Verify countdown variants included
   - Verify posts are drafts (not auto-published)

5. **Test Duplicate Guard:**
   - Send same handoff twice within 30 minutes
   - Verify second send shows duplicate warning (if implemented) or silently ignores

---

## 6. Known Limitations / Out of Scope

### Explicit Limitations

- **No Persistence:** Campaigns are not saved to database (session-only)
- **No Regeneration:** Cannot regenerate individual channels (must regenerate entire campaign)
- **No Template System:** No saved templates or campaign presets
- **No Collaboration:** No multi-user editing or sharing
- **No Version History:** No tracking of edit history or rollback
- **No Analytics:** No tracking of campaign performance or engagement
- **No A/B Testing:** No variant testing or comparison tools
- **No Preview:** No live preview of posts on actual platforms
- **No Media Upload:** No image or video upload for campaign assets
- **No Multi-Language Variants:** Language selection applies to all content (no per-channel language)

### Platform-Specific Limitations

- **Email:** HTML email body is basic (no rich formatting or templates)
- **SMS:** Character limits are guidance only (no hard enforcement)
- **Hashtags:** Bundles are suggestions only (no validation against platform limits)
- **Schedule Ideas:** Suggestions only (no actual scheduling integration)

---

## 7. Verification Complete

### Final Checklist

- [ ] All A) App Access & Load States verified
- [ ] All B) Tier 5A UX features verified
- [ ] All C) Tier 5B Canonical Output State verified
- [ ] All D) Inline Editing features verified
- [ ] All E) Variant Selector + Lock After Edit verified
- [ ] All F) Tier 5C Integrations verified
- [ ] All G) Trust & Safety Guardrails verified
- [ ] No console errors in production
- [ ] Mobile responsiveness verified
- [ ] Dark mode styling verified

### Verification Details

**Date Verified:** [DATE]  
**Verified By:** _______________  
**Environment:** Production / Staging  
**Browser(s) Tested:** _______________  
**Mobile Device(s) Tested:** _______________

**Verification Complete:** [DATE]

### Notes

**Issues Found:**
- 

**Workarounds:**
- 

**Follow-up Actions:**
- 

### Final Status

- [ ] ✅ **VERIFIED** — All checks passed, ready for production use
- [ ] ⚠️ **VERIFIED WITH NOTES** — All critical checks passed, minor issues documented above
- [ ] ❌ **BLOCKED** — Critical issues found, deployment should be rolled back

**Signature:** _______________  
**Date:** _______________

---

## Appendix: Quick Reference

### Key Files
- Main Page: `src/app/apps/event-campaign-builder/page.tsx`
- API Route: `src/app/api/event-campaign-builder/route.ts`
- Types: `src/app/apps/event-campaign-builder/types.ts`
- Canonical State: `src/lib/apps/event-campaign-builder/getActiveCampaign.ts`
- Campaign Mapper: `src/lib/apps/event-campaign-builder/campaign-mapper.ts`
- Campaign Selectors: `src/lib/apps/event-campaign-builder/campaign-selectors.ts`
- Variant Generator: `src/lib/apps/event-campaign-builder/variant-generator.ts`
- Handoff Builder: `src/lib/apps/event-campaign-builder/handoff-builder.ts`

### Handoff Sources
- Content Writer: `event-campaign-builder-to-content-writer`
- Image Caption Generator: `event-campaign-builder-to-image-caption-generator`
- Social Auto-Poster: Uses `buildSocialAutoPosterHandoff()` function

### SessionStorage Keys
- Variant Selection: `event-campaign-builder.selected-variant`
- Help Desk Banner: `event-campaign-builder.help-desk-banner-dismissed`
- Handoff Transport: `obd:social-auto-poster:handoff` (shared key)

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-19

