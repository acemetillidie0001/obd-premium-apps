# OBD Scheduler & Booking - P1/P2 Production Audit Report

**Date**: 2024-12-XX  
**Scope**: OBD Scheduler & Booking app only  
**Source**: `docs/obd-scheduler/AUDIT.md`  
**Verification**: Code inspection of current repository state

---

## OPEN P1 ITEMS (High Priority)

### P1-1: Client-Side Email Validation Only
- **Evidence**: `src/app/(public)/book/[bookingKey]/page.tsx:300,385`
- **Issue**: Email format validation occurs only client-side using regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Server validates via Zod `email()` but client regex is simpler.
- **Recommendation**: Ensure server-side validation matches or is stricter. Consider using a shared validation utility.

### P1-2: Missing Preferred Time Validation (Client-Side)
- **Evidence**: `src/app/(public)/book/[bookingKey]/page.tsx:395-419`
- **Issue**: Preferred start time is normalized to 15-minute increments on submit, but no validation ensures it's in the future or within `maxDaysOut`. Server normalizes but doesn't validate business rules.
- **Recommendation**: Add client-side validation for: `preferredStart >= now + minNoticeHours` and `preferredStart <= now + maxDaysOut`. Display helpful error messages if validation fails.

### P1-3: Service Selection Not Validated
- **Evidence**: `src/app/(public)/book/[bookingKey]/page.tsx:63-70,734-736`
- **Issue**: Form allows `serviceId: null`, but if a service is selected, client doesn't verify it's active/valid before submission.
- **Recommendation**: Validate selected service exists in `context.services` and is `active: true` before submission.

### P1-4: Bulk Decline Error Handling Incomplete
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:664-738`
- **Issue**: If one request fails during bulk decline, error is logged but user sees summary notification (e.g., "3 failed"). No way to identify which specific request failed.
- **Recommendation**: Collect failed request IDs and show detailed error in notification (e.g., "Failed: Request #123, #456"). Optionally, keep failed requests selected after bulk operation.

### P1-5: Missing Optimistic Updates
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:530-590`
- **Issue**: `performRequestAction` updates local state only after API success. No optimistic UI updates.
- **Recommendation**: Update local state optimistically, rollback on error. Improves perceived performance.

### P1-6: Archive State Not Synced Across Tabs/Devices
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:79-109`
- **Issue**: Archive state is client-only (`localStorage`). If user opens dashboard in multiple tabs, archive state may desync.
- **Recommendation**: Use `storage` event listener to sync across tabs. Consider server-side archive support if needed for multi-device use.

### P1-9: CRM Sync Failure Silent
- **Evidence**: `src/app/api/obd-scheduler/requests/route.ts:458-468`
- **Issue**: CRM sync failures are logged but user has no visibility. No warnings array entry for CRM failures.
- **Recommendation**: Consider adding a dashboard indicator or audit log for CRM sync status (optional, as CRM is non-blocking).

### P1-11: Decline Action No Undo
- **Evidence**: `src/app/api/obd-scheduler/requests/[id]/action/route.ts:213-214`
- **Issue**: Once declined, request cannot be reactivated. Accidental declines require manual database fix.
- **Recommendation**: Add "Reactivate" action (changes status back to `REQUESTED`). Or add confirmation dialog with "Are you sure?" message (already present in UI, but not enforced server-side if API is called directly).

### P1-12: Inconsistent Validation Patterns
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:611-627` (propose), `src/app/(public)/book/[bookingKey]/page.tsx:300,385` (public form)
- **Issue**: Propose modal validates datetime-local inputs. Public form validates email with regex. No shared validation utilities.
- **Recommendation**: Extract validation logic to shared utilities (`src/lib/apps/obd-scheduler/validation.ts`) for consistency and reusability.

### P1-13: Phone Number Validation Missing
- **Evidence**: `src/app/(public)/book/[bookingKey]/page.tsx:67`, `src/app/api/obd-scheduler/requests/route.ts:206`
- **Issue**: Phone number is optional and unvalidated. Accepts any string up to 50 chars. No format validation client or server-side (Zod allows `max(50)` only).
- **Recommendation**: Add optional phone validation (E.164 or basic US format) with clear error messages.

### P1-15: Loading States Not Disabled on Error
- **Evidence**: Multiple fetch handlers in `src/app/apps/obd-scheduler/page.tsx`
- **Issue**: If error occurs, `loading` state may remain `true` if `finally` block doesn't reset it properly.
- **Recommendation**: Audit all async functions to ensure `finally` blocks always reset loading states. (Note: Most handlers appear to have `finally` blocks, but should be verified systematically.)

### P1-16: Public BookingKey Enumeration Risk
- **Evidence**: `src/app/api/obd-scheduler/public/context/route.ts:19-49`
- **Issue**: Booking keys are generated using `randomBytes(32).toString("hex")` (verified in `src/lib/apps/obd-scheduler/bookingKey.ts:22`). However, public context endpoint has no rate limiting by IP. Failed booking key lookups are not logged for monitoring.
- **Recommendation**: Consider rate limiting public context endpoint by IP. Log failed booking key lookups for monitoring.

### P1-17: Service Access Control on Public Form
- **Evidence**: `src/app/api/obd-scheduler/requests/route.ts:425-435`
- **Issue**: Public form can submit `serviceId`, but validation checks service belongs to business. Good, but if service is inactive, error may reveal service exists for another business (if error message is too specific).
- **Status**: ✅ **VERIFIED** - Returns generic "Service not found or inactive" message (line 434).

### P1-18: CSV Export Blocks UI
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:897-976`
- **Issue**: CSV generation is synchronous and blocks main thread for large lists. Iterates over all `sortedRequests` client-side.
- **Recommendation**: Use `Web Workers` for CSV generation. Or show progress indicator and chunk processing.

### P1-19: Image Loading in Public Booking
- **Evidence**: `src/app/(public)/book/[bookingKey]/page.tsx:477-480`
- **Issue**: Logo image uses `<img>` tag without `loading="lazy"` or Next.js `Image` component optimization.
- **Recommendation**: Add Next.js `Image` component with lazy loading and optimization.

### P1-20: Form Label Associations
- **Evidence**: `src/app/(public)/book/[bookingKey]/page.tsx` (form inputs)
- **Issue**: Some inputs may not have associated `<label>` elements or `aria-labelledby`. Need to verify all form inputs have proper label associations.
- **Recommendation**: Ensure all form inputs have `<label htmlFor={inputId}>` or `aria-labelledby`. Add `aria-describedby` for error messages.

### P1-21: Color Contrast
- **Evidence**: Error messages, button states throughout
- **Issue**: Error text colors may not meet WCAG AA contrast ratios (4.5:1 for normal text).
- **Recommendation**: Audit color contrast using tool (e.g., axe DevTools). Ensure error states have sufficient contrast in light and dark modes.

### P1-22: Public Booking Page Style Isolation
- **Evidence**: `src/app/(public)/book/[bookingKey]/page.tsx:8-12`
- **Issue**: Public booking page uses hardcoded classes instead of OBD design system utilities. Intentional for isolation, but may drift from design system over time.
- **Recommendation**: Document this intentional isolation. Consider creating a "public booking" variant of OBD components if design system evolves.

### P1-23: Toast Component Inconsistency
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:200,465`, `src/components/obd/OBDToast.tsx`
- **Issue**: Custom toast implementation may not match OBD design system patterns.
- **Recommendation**: Audit `OBDToast` component against design system. Ensure consistent styling with other OBD notifications.

### P1-24: Missing Business Metrics
- **Evidence**: No tracking currently
- **Issue**: No tracking of: booking request conversion rates, average time to approve/decline, peak booking times, service popularity.
- **Recommendation**: Add analytics events for key actions (request created, approved, declined). Consider privacy-compliant analytics (e.g., Plausible, PostHog).

### P1-25: Rate Limit Monitoring
- **Evidence**: `src/app/api/obd-scheduler/requests/route.ts:80-141`
- **Issue**: Rate limit violations are logged but not tracked as metrics.
- **Recommendation**: Track rate limit hits as metrics (e.g., `booking_rate_limit_exceeded`). Alert if rate limit hits exceed threshold.

### P1-26: Critical Paths Untested
- **Evidence**: No test files detected
- **Issue**: No tests for: multi-tenant isolation (critical for security), rate limiting accuracy, email/SMS notification triggering, CRM sync logic.
- **Recommendation**: Prioritize tests for security-critical paths (multi-tenant, rate limiting).

### P1-27: No Load Testing
- **Evidence**: No load tests found
- **Issue**: No performance tests for: large request lists (100+), concurrent booking submissions, rate limiting under load.
- **Recommendation**: Add load tests (e.g., k6, Artillery). Test with 1000+ concurrent requests.

---

## OPEN P2 ITEMS (Medium Priority)

### P2-1: Error Recovery in Context Loading
- **Evidence**: `src/app/(public)/book/[bookingKey]/page.tsx:95-198`
- **Issue**: On context load failure, form renders with `defaultContext` (minimal data). This may cause confusing UX if booking key is invalid but form still appears.
- **Recommendation**: Show a clear error message when `contextError === true` and disable form submission.

### P2-2: Phone Number Format Validation Missing
- **Evidence**: `src/app/(public)/book/[bookingKey]/page.tsx:67`, `src/app/api/obd-scheduler/requests/route.ts:206`
- **Issue**: Phone number is optional and has no format validation client or server-side (Zod allows `max(50)` only).
- **Recommendation**: Add optional phone format validation (e.g., E.164 or basic US format) with helpful error messages.

### P2-3: CSV Export Performance
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:897-976`
- **Issue**: CSV generation iterates over all visible requests client-side. May be slow for large lists.
- **Recommendation**: For 100+ requests, consider server-side CSV generation or streaming.

### P2-4: Filter/Sort State Not Persisted
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:77-79`
- **Issue**: `activeView` is persisted to `localStorage` (line 88), but `sortBy` is not. User preferences are lost on refresh.
- **Recommendation**: Persist `sortBy` to `localStorage` (e.g., `obd:scheduler:sortBy`).

### P2-5: No Request IDempotency
- **Evidence**: `src/app/api/obd-scheduler/requests/route.ts:373-454`
- **Issue**: Duplicate submissions (e.g., double-click) can create multiple identical requests.
- **Recommendation**: Add idempotency key support (client-generated UUID) or deduplication logic (e.g., same email + bookingKey + preferredStart within 5 seconds = duplicate).

### P2-6: Service Validation on Update
- **Evidence**: `src/app/api/obd-scheduler/requests/route.ts:425-435`
- **Issue**: Service validation checks `active: true` but doesn't verify service wasn't deleted/archived after request creation.
- **Recommendation**: Allow requests with inactive services (for historical data), but show warning in dashboard if service is inactive.

### P2-7: Status Change Audit Trail Missing
- **Evidence**: All action routes (`src/app/api/obd-scheduler/requests/[id]/action/route.ts`)
- **Issue**: No audit log of who changed status when (except `updatedAt` timestamp, which doesn't track user/action).
- **Recommendation**: Consider adding audit log table for status changes (optional, based on compliance needs).

### P2-8: Validation Error Messages Not User-Friendly
- **Evidence**: `src/lib/api/validationError.ts:24-36`
- **Issue**: Zod validation errors may expose internal field names or technical details. Returns raw Zod error messages in `details` array.
- **Recommendation**: Map Zod errors to user-friendly messages (e.g., "Customer name is required" instead of "String must contain at least 1 character(s)").

### P2-9: Error Messages Too Technical
- **Evidence**: API error responses throughout
- **Issue**: Some errors return raw Zod validation messages or database errors.
- **Recommendation**: Map technical errors to user-friendly messages before returning to client.

### P2-10: Archive State Isolation
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:79-109`
- **Issue**: Archive state is client-only. If two users share a business account, archive preferences may conflict.
- **Recommendation**: If multi-user support is needed, move archive to server-side with per-user preferences.

### P2-11: Unnecessary Re-renders
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:1034-1042`
- **Issue**: Large component with many state variables. `visibleSelectableRequests`, `allVisibleSelected`, `someVisibleSelected` are calculated inline (not memoized). Changes to one state may trigger re-renders of entire tree.
- **Recommendation**: Memoize `visibleSelectableRequests`, `allVisibleSelected`, `someVisibleSelected` with proper dependencies. Use `useMemo` for expensive calculations.

### P2-12: Focus Indicators
- **Evidence**: All interactive elements
- **Issue**: Custom focus styles may be insufficient or missing.
- **Recommendation**: Ensure visible focus indicators on all interactive elements (2px outline, high contrast).

### P2-13: Skip Links Missing
- **Evidence**: Public booking page, dashboard
- **Issue**: No skip-to-main-content link for keyboard users.
- **Recommendation**: Add skip link at top of page (hidden until focused).

### P2-14: Modal Patterns
- **Evidence**: Propose modal, decline confirm, complete modal
- **Issue**: Modals use custom implementation. May not match OBD modal patterns (if design system has modal component).
- **Recommendation**: Check if OBD design system has modal component. Migrate to shared component if available.

### P2-15: Button Variants
- **Evidence**: Throughout dashboard
- **Issue**: Buttons use inline styles. May not use OBD button variants consistently.
- **Recommendation**: Audit button usage against design system. Extract button variants to shared utilities if needed.

### P2-16: Audit Trail Logging
- **Evidence**: Status change actions
- **Issue**: Status changes are not logged with user context (who, when, what changed).
- **Recommendation**: Add audit log entries for status changes (optional, based on compliance needs).

### P2-17: Accessibility Testing
- **Evidence**: No automated accessibility tests
- **Issue**: No automated accessibility tests.
- **Recommendation**: Add `@axe-core/react` for automated a11y tests. Run in CI pipeline.

### P2-18: Visual Regression Testing
- **Evidence**: No visual regression tests
- **Issue**: No visual regression tests for UI changes.
- **Recommendation**: Consider tools like Percy, Chromatic for visual testing. Optional, but helpful for catching unintended UI changes.

---

## FIXED (VERIFIED)

### P1-7: Rate Limiting Key Collision Risk ✅
- **Evidence**: `src/app/api/obd-scheduler/requests/route.ts:88-105`
- **Status**: FIXED - Added user agent hash fallback when IP is unavailable. Rate limit key format: `${bookingKey}:ua:${hash}` when IP is null. Added logging when IP extraction fails.

### P1-8: Email Notification Failures Silent ✅
- **Evidence**: `src/app/api/obd-scheduler/requests/route.ts:512,530`
- **Status**: FIXED - Both customer email failures (line 512) and business notification failures (line 530) add to `warnings` array. Warnings are returned to client (lines 570-575).

### P1-10: Approve Action Time Calculation ✅
- **Evidence**: `src/app/api/obd-scheduler/requests/[id]/action/route.ts:202-215`
- **Status**: FIXED - Added validation check for `preferredStart < now` with warning log. Added warning log when using default 30-minute duration without service duration.

### P1-14: Toast Notification Management ✅
- **Evidence**: `src/app/apps/obd-scheduler/page.tsx:465`
- **Status**: FIXED - Toast array uses `.slice(-2)` which keeps max 3 toasts (keeps last 2, adds new one = max 3). Auto-dismiss after 3 seconds (line 468).

### P1-17: Service Access Control on Public Form ✅
- **Evidence**: `src/app/api/obd-scheduler/requests/route.ts:434`
- **Status**: VERIFIED - Returns generic "Service not found or inactive" message. No information leakage.

---

## MISSING/AMBIGUOUS

### Items Not Found in Code
- **P0-4: Selection State Persistence Not Implemented** - Listed in audit but `selectedRequestIds` is not persisted to localStorage. No evidence of fix attempt.
- **P0-6: No Request Size Limits** - No evidence of request body size limits in `src/app/api/obd-scheduler/requests/route.ts:270` or Next.js config.
- **P0-9: Zod Schema Gaps** - `customerName` has `max(200)` (verified line 204), but `message` sanitization and `preferredStart` date range validation not verified.
- **P0-7: Status Transition Validation Missing Edge Cases** - Status transitions validated (lines 128-146), but no optimistic locking (version field or `updatedAt` check) found.
- **P0-8: Proposed Time End Validation Logic Gap** - Only validates `proposedEnd > proposedStart` (line 171). No validation for future dates, availability windows, or reasonable duration.

### Items Requiring Further Investigation
- **P1-15: Loading States Not Disabled on Error** - Most handlers have `finally` blocks, but systematic audit needed to verify all cases.
- **P1-20: Form Label Associations** - Requires manual inspection of all form inputs in public booking page.
- **P1-21: Color Contrast** - Requires automated tool testing (axe DevTools) to verify WCAG compliance.

---

## NEXT STEP

**Recommended First Fix: P1-2 (Missing Preferred Time Validation - Client-Side)**

**Why**: 
- High impact on user experience (prevents invalid bookings)
- Relatively straightforward to implement (client-side validation)
- Prevents unnecessary API calls with invalid data
- Improves data quality

**Implementation**:
1. Add validation in `src/app/(public)/book/[bookingKey]/page.tsx` before form submission
2. Check `preferredStart >= now + minNoticeHours` (from context)
3. Check `preferredStart <= now + maxDaysOut` (from context)
4. Display clear error messages if validation fails
5. Use existing `context.minNoticeHours` and `context.maxDaysOut` values

**Estimated Effort**: Low (30-60 minutes)  
**Risk**: Low (client-side only, server validation already exists)

---

**End of Report**

