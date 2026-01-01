# OBD Scheduler & Booking — Tier 1 QA Checklist

**Version:** Tier 1.1  
**Date:** [Current Date]  
**Tester:** [Name]

---

## Pre-Testing Setup

- [ ] Run `pnpm run ci` — Should complete without errors
  - [ ] Lint passes (no ESLint errors)
  - [ ] TypeScript compiles (no type errors)
  - [ ] Build succeeds (Next.js build completes)

---

## Tier 1: Structural Hardening Tests

### CI Pipeline Validation
- [ ] **Test:** Run `pnpm run ci` command
  - [ ] Expected: All three steps complete successfully
  - [ ] No errors in console output
  - [ ] Build artifacts generated correctly

### Tab Navigation & Type Safety
- [ ] **Test:** Navigate to each tab (Requests, Services, Availability, Branding, Settings)
  - [ ] Expected: Each tab loads without console errors
  - [ ] Expected: No TypeScript errors in browser console
  - [ ] Expected: Tab content renders correctly

### Tab Boundary Integrity
- [ ] **Test:** Switch between Branding → Settings tabs rapidly
  - [ ] Expected: No JSX parse errors
  - [ ] Expected: No render breaks or blank screens
  - [ ] Expected: Both tabs render correctly

### Theme & Tab Persistence
- [ ] **Test:** Toggle theme to Dark mode, refresh page
  - [ ] Expected: Theme remains Dark after refresh
  - [ ] Expected: No flash of light theme
- [ ] **Test:** Switch to Settings tab, refresh page
  - [ ] Expected: Settings tab is active after refresh
  - [ ] Expected: Tab content loads correctly

---

## Tier 1.1: UX Upgrade Tests

### Optimistic UI + Disabled States

#### Save Settings Button
- [ ] **Test:** Click "Save Settings" button
  - [ ] Expected: Button immediately disables
  - [ ] Expected: Button text changes to "Saving..."
  - [ ] Expected: Button opacity reduces (visual feedback)
  - [ ] Expected: Button re-enables after save completes
  - [ ] Expected: Cannot click button multiple times during save

#### Save Availability Button
- [ ] **Test:** Click "Save Availability" button
  - [ ] Expected: Same behavior as Settings (disabled, "Saving...", re-enables)
  - [ ] Expected: No double-submit possible

#### Save Branding Button
- [ ] **Test:** Click "Save Branding" button
  - [ ] Expected: Same behavior as Settings (disabled, "Saving...", re-enables)
  - [ ] Expected: No double-submit possible

#### Service Create/Update Button
- [ ] **Test:** Open Service modal, click "Create" or "Update"
  - [ ] Expected: Button disables during save
  - [ ] Expected: Button shows "Saving..." text
  - [ ] Expected: Button re-enables after completion
  - [ ] Expected: Modal closes on success

### Inline Field Validation

#### Notification Email Validation
- [ ] **Test:** Enter invalid email (e.g., "notanemail")
  - [ ] Expected: No immediate error (validation on save)
- [ ] **Test:** Enter invalid email, click "Save Settings"
  - [ ] Expected: Red error message appears below email field
  - [ ] Expected: Error message: "Please enter a valid email address"
  - [ ] Expected: Save does not proceed
  - [ ] Expected: Error clears when valid email entered
- [ ] **Test:** Enter valid email (e.g., "test@example.com")
  - [ ] Expected: No error message
  - [ ] Expected: Save proceeds normally

#### Policy Text Validation
- [ ] **Test:** Enter policy text > 5000 characters, click "Save Settings"
  - [ ] Expected: Red error message appears below textarea
  - [ ] Expected: Error message: "Policy text must be 5000 characters or less"
  - [ ] Expected: Save does not proceed
- [ ] **Test:** Reduce to ≤ 5000 characters
  - [ ] Expected: Error clears
  - [ ] Expected: Save proceeds normally

#### Headline Text Validation (Branding Tab)
- [ ] **Test:** Enter headline > 200 characters, click "Save Branding"
  - [ ] Expected: Red error message appears below input
  - [ ] Expected: Error message: "Headline must be 200 characters or less"
  - [ ] Expected: Save does not proceed
- [ ] **Test:** Reduce to ≤ 200 characters
  - [ ] Expected: Error clears
  - [ ] Expected: Save proceeds normally

#### Introduction Text Validation (Branding Tab)
- [ ] **Test:** Enter intro text > 1000 characters, click "Save Branding"
  - [ ] Expected: Red error message appears below textarea
  - [ ] Expected: Error message: "Introduction text must be 1000 characters or less"
  - [ ] Expected: Save does not proceed
- [ ] **Test:** Reduce to ≤ 1000 characters
  - [ ] Expected: Error clears
  - [ ] Expected: Save proceeds normally

#### Logo URL Validation (Branding Tab)
- [ ] **Test:** Enter invalid URL (e.g., "notaurl"), click "Save Branding"
  - [ ] Expected: Red error message appears below input
  - [ ] Expected: Error message: "Please enter a valid URL starting with http:// or https://"
  - [ ] Expected: Save does not proceed
- [ ] **Test:** Enter valid URL (e.g., "https://example.com/logo.png")
  - [ ] Expected: No error message
  - [ ] Expected: Save proceeds normally

### Toast Notification System

#### Success Notifications
- [ ] **Test:** Save Settings successfully
  - [ ] Expected: Green toast appears top-right
  - [ ] Expected: Message: "Settings saved successfully"
  - [ ] Expected: Toast auto-dismisses after 3 seconds
  - [ ] Expected: No browser alert() dialog
- [ ] **Test:** Save Availability successfully
  - [ ] Expected: Green toast: "Availability saved successfully"
  - [ ] Expected: Auto-dismisses after 3 seconds
- [ ] **Test:** Save Branding successfully
  - [ ] Expected: Green toast: "Theme saved successfully"
  - [ ] Expected: Auto-dismisses after 3 seconds
- [ ] **Test:** Copy booking link
  - [ ] Expected: Green toast: "Link copied to clipboard!"
  - [ ] Expected: Auto-dismisses after 3 seconds

#### Error Notifications
- [ ] **Test:** Trigger save error (e.g., network error or invalid data)
  - [ ] Expected: Red toast appears top-right
  - [ ] Expected: Error message displayed
  - [ ] Expected: Toast auto-dismisses after 3 seconds
  - [ ] Expected: No browser alert() dialog

#### Toast Queue (Multiple Notifications)
- [ ] **Test:** Rapidly trigger multiple saves (e.g., Settings → Availability → Branding)
  - [ ] Expected: Up to 3 toasts stack vertically
  - [ ] Expected: Each toast has its own 3-second timer
  - [ ] Expected: Toasts dismiss independently
  - [ ] Expected: No flicker or collision
  - [ ] Expected: Oldest toast removed if 4th appears

#### No Alert() Usage
- [ ] **Test:** Perform all save operations
  - [ ] Expected: Zero browser alert() dialogs appear
  - [ ] Expected: All feedback via toast notifications

---

## Regression Tests

### Core Functionality
- [ ] **Test:** Create a new service
  - [ ] Expected: Service appears in list
  - [ ] Expected: Can edit service
  - [ ] Expected: Can save changes
- [ ] **Test:** Update booking request status
  - [ ] Expected: Status updates correctly
  - [ ] Expected: Request list refreshes
  - [ ] Expected: Toast notification appears
- [ ] **Test:** Configure availability windows
  - [ ] Expected: Can enable/disable days
  - [ ] Expected: Can set time ranges
  - [ ] Expected: Saves correctly
- [ ] **Test:** Update branding settings
  - [ ] Expected: All fields save correctly
  - [ ] Expected: Validation works
  - [ ] Expected: Toast appears on save

### Build & Deploy
- [ ] **Test:** Run `pnpm run vercel-build`
  - [ ] Expected: Build completes successfully
  - [ ] Expected: No TypeScript errors
  - [ ] Expected: No build warnings
- [ ] **Test:** Deploy to Vercel (if applicable)
  - [ ] Expected: Deployment succeeds
  - [ ] Expected: Page loads correctly in production
  - [ ] Expected: All features work in production

### Browser Compatibility
- [ ] **Test:** Chrome/Edge (latest)
  - [ ] Expected: All features work
  - [ ] Expected: localStorage persists correctly
- [ ] **Test:** Firefox (latest)
  - [ ] Expected: All features work
  - [ ] Expected: localStorage persists correctly
- [ ] **Test:** Safari (latest)
  - [ ] Expected: All features work
  - [ ] Expected: localStorage persists correctly

---

## Known Limitations (Expected Behavior)

- [ ] **Calendar sync:** Placeholder UI shows "coming soon" message
  - [ ] Expected: No error, just informational message
- [ ] **Rate limiting:** Public booking endpoint has no throttling
  - [ ] Expected: No error, feature not yet implemented
- [ ] **Audit logs:** No server-side action logging
  - [ ] Expected: No error, feature not yet implemented
- [ ] **Request filters:** Filter state not persisted
  - [ ] Expected: Filter resets on refresh (will be added in future)

---

## Test Results Summary

**Total Tests:** [Count]  
**Passed:** [Count]  
**Failed:** [Count]  
**Blocked:** [Count]

**Notes:**
- [Any issues found]
- [Any unexpected behavior]
- [Any recommendations]

**Sign-off:**
- [ ] All critical tests passed
- [ ] Ready for production deployment
- [ ] Rollback plan reviewed

**Tester Signature:** _________________  
**Date:** _________________

