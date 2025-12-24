# Review Request Automation V3 - Smoke Test Checklist

## Pre-Test Setup

- [ ] Navigate to `/apps/review-request-automation`
- [ ] Verify page loads without errors
- [ ] Verify theme toggle works (light/dark)
- [ ] Verify all tabs are visible: Campaign, Customers, Templates, Queue, Results

## Campaign Builder (Setup)

### Business Information
- [ ] Enter business name (required field)
- [ ] Enter optional business type (e.g., "Restaurant", "Home Services", "Beauty Salon")
- [ ] Generate templates (recommendations only appear after generation)
- [ ] If business type is recognized, verify recommendation panel appears below input
- [ ] Verify panel shows explanation of why settings are recommended
- [ ] Verify panel shows recommended values and ranges
- [ ] Verify "Apply" button is present
- [ ] Click "Apply" button
- [ ] Verify settings are updated (send delay, follow-up delay, tone style)
- [ ] Verify recommendations are opt-in only (do not auto-apply)
- [ ] Select review platform (Google/Facebook/Yelp/Other)
- [ ] Enter valid review link URL (e.g., https://g.page/r/test)
- [ ] Verify invalid URL shows validation error

### Message Settings
- [ ] Select language (English/Spanish/Bilingual)
- [ ] Select tone style (Friendly/Professional/Bold/Luxury)
- [ ] Enter optional brand voice
- [ ] Verify all fields save correctly

### Automation Rules
- [ ] Select trigger type (manual/after_service/after_payment)
- [ ] Set send delay hours (0-168)
- [ ] Toggle follow-up enabled
- [ ] Set follow-up delay days (1-30, only if enabled)
- [ ] Verify info icon (ℹ️) appears next to follow-up delay field
- [ ] Click info icon to expand micro-education panel
- [ ] Verify panel explains why follow-up delay matters
- [ ] Click info icon again to collapse panel
- [ ] Select frequency cap (30/60/90 days)
- [ ] Verify info icon appears next to frequency cap field
- [ ] Click info icon to expand micro-education panel
- [ ] Verify panel explains frequency cap
- [ ] Set quiet hours start/end (default: 09:00-19:00)
- [ ] Verify info icon appears next to quiet hours label
- [ ] Click info icon to expand micro-education panel
- [ ] Verify panel explains quiet hours
- [ ] Verify all panels are keyboard accessible (Enter/Space to toggle)
- [ ] Verify all rules save correctly

## Customer Management

### Manual Add Customer
- [ ] Click "Add Customer" button
- [ ] Enter customer name (required)
- [ ] Enter phone OR email (at least one required)
- [ ] Enter optional fields (tags, lastVisitDate, serviceType, jobId)
- [ ] Submit customer
- [ ] Verify customer appears in list
- [ ] Verify customer status shows as "queued"

### CSV Import
- [ ] Click "Download Template" button
- [ ] Verify CSV template downloads correctly
- [ ] Open template and verify format
- [ ] Click "Import CSV" button
- [ ] Select valid CSV file
- [ ] Verify CSV preview modal appears
- [ ] Verify valid customers are shown
- [ ] Verify errors are shown for invalid rows
- [ ] Click "Confirm Import"
- [ ] Verify customers are added to list

### CSV Export
- [ ] Add at least one customer
- [ ] Click "Export CSV" button
- [ ] Verify CSV file downloads
- [ ] Open CSV and verify data is correct

### Customer Filters (if implemented)
- [ ] Filter by hasPhone
- [ ] Filter by hasEmail
- [ ] Filter by optedOut
- [ ] Filter by status (queued/sent/clicked/reviewed)
- [ ] Filter by needsFollowUp

## Message Template Generator

- [ ] Fill out campaign form
- [ ] Add at least one customer
- [ ] Click "Generate Templates & Queue" button
- [ ] Verify loading state appears
- [ ] Navigate to "Templates" tab
- [ ] Verify all 4 templates are generated:
  - [ ] SMS Short
  - [ ] SMS Standard
  - [ ] Email (subject + body)
  - [ ] Follow-Up SMS
- [ ] Verify Template Quality badges appear above each template card
- [ ] Verify badges are color-coded (green=info, yellow=warning, red=critical)
- [ ] Hover over each quality badge
- [ ] Verify tooltip shows quality details, specific issues, and suggestions
- [ ] Verify templates include business name
- [ ] Verify templates include review link
- [ ] Verify SMS templates include STOP opt-out line
- [ ] Verify templates include {firstName} token
- [ ] Verify character count is shown for SMS templates
- [ ] Verify segment count is shown for SMS templates
- [ ] Verify segment counter ties to quality details (if template is "Too Long")
- [ ] Click "Copy" button on each template
- [ ] Verify text is copied to clipboard
- [ ] Click "Generate Again" button
- [ ] Verify templates are regenerated

## Send Queue

- [ ] Generate templates and queue
- [ ] Navigate to "Queue" tab
- [ ] Verify Send Timeline appears above queue panel
- [ ] Verify timeline shows "Now" event
- [ ] Verify timeline shows "Initial Send" event with date and time
- [ ] If follow-up enabled, verify timeline shows "Follow-Up" event
- [ ] Verify timeline uses actual computed times (not estimates)
- [ ] Verify queue items are listed
- [ ] Verify each item shows:
  - [ ] Customer name
  - [ ] Scheduled time
  - [ ] Variant (smsShort/smsStandard/email/followUpSms)
  - [ ] Channel (sms/email)
  - [ ] Status (pending/sent/skipped)
- [ ] Click "Copy" button on a queue item
- [ ] Verify personalized message (with {firstName} replaced) is copied
- [ ] Click "Mark Sent" on a pending item
- [ ] Verify item status updates
- [ ] Verify metrics update (sent count increases)
- [ ] Click "Mark Clicked" on a sent item
- [ ] Verify status updates to "clicked"
- [ ] Click "Mark Reviewed" on a clicked item
- [ ] Verify status updates to "reviewed"
- [ ] Verify follow-up items are removed for reviewed customers
- [ ] Click "Opt Out" on a customer
- [ ] Verify customer is marked as opted out
- [ ] Verify queue items for opted-out customer are removed
- [ ] Verify bulk selection checkboxes appear for pending items
- [ ] Select multiple queue items using checkboxes
- [ ] Verify selected items show ring border highlight
- [ ] Click "Mark Selected as Sent" button
- [ ] Verify all selected items are marked as sent
- [ ] Verify metrics update (sent count increases by number of selected items)
- [ ] Select multiple items again
- [ ] Click "Mark Selected as Clicked" button
- [ ] Verify all selected items are marked as clicked
- [ ] Click "Export Queue CSV" button
- [ ] Verify CSV file downloads with queue data
- [ ] Click "Export Campaign JSON" button
- [ ] Verify JSON file downloads
- [ ] Open JSON and verify it includes campaign, customers, events, results, and exportedAt timestamp

## Results & Insights

- [ ] Generate templates and queue
- [ ] Navigate to "Results" tab
- [ ] Verify Campaign Health badge appears with status (Good/Needs Attention/At Risk) and score
- [ ] Hover over Campaign Health badge
- [ ] Verify tooltip shows "How it's calculated" with detailed reasons list
- [ ] Verify funnel metrics are displayed:
  - [ ] Loaded count
  - [ ] Ready count
  - [ ] Queued count
  - [ ] Sent count
  - [ ] Clicked count
  - [ ] Reviewed count
  - [ ] Opted Out count
- [ ] Verify Best-Practice Guidance section appears
- [ ] Verify guidance shows current values vs. recommended ranges
- [ ] Verify out-of-range settings show yellow border and "Consider adjusting" note
- [ ] Verify in-range settings show checkmark (✓)
- [ ] Verify guidance wording uses "recommended range" / "common best practice" (no market data claims)
- [ ] Verify quality checks are shown (if any issues)
- [ ] Verify next actions are shown
- [ ] Click copy button on next actions (if available)
- [ ] Verify text is copied

## Quality Checks

### Invalid Review Link
- [ ] Enter invalid review link (e.g., "not-a-url")
- [ ] Generate templates
- [ ] Verify error quality check appears

### SMS Too Long
- [ ] Use a campaign that generates long SMS templates
- [ ] Verify warning quality check appears for long SMS

### Follow-Up Too Aggressive
- [ ] Enable follow-up with delay < 3 days
- [ ] Generate templates
- [ ] Verify warning quality check appears

### Missing Contact Info
- [ ] Add customer without phone or email
- [ ] Generate templates
- [ ] Verify warning/error quality check appears

## Data Persistence

- [ ] Fill out campaign form
- [ ] Add customers
- [ ] Generate templates
- [ ] Refresh page
- [ ] Verify data is restored from localStorage
- [ ] Verify campaign settings are restored
- [ ] Verify customers are restored
- [ ] Verify events are restored

## Edge Cases

- [ ] Test with empty customer list
- [ ] Test with all customers opted out
- [ ] Test with all customers already reviewed
- [ ] Test with customer missing both phone and email
- [ ] Test with customer having both phone and email
- [ ] Test quiet hours spanning midnight
- [ ] Test frequency cap preventing queue
- [ ] Test follow-up not queued for reviewed customers
- [ ] Test manual trigger type (queues immediately)
- [ ] Test after_service trigger with lastVisitDate
- [ ] Test after_service trigger without lastVisitDate

## Accessibility

- [ ] Verify all form fields have labels
- [ ] Verify all buttons have accessible names
- [ ] Verify modals have focus trap
- [ ] Verify ESC key closes modals
- [ ] Verify keyboard navigation works
- [ ] Verify screen reader compatibility (if testing with screen reader)

## Browser Compatibility

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test in Edge
- [ ] Verify localStorage works in all browsers
- [ ] Verify clipboard API works in all browsers

## Performance

- [ ] Test with 10 customers (should be fast)
- [ ] Test with 100 customers (should be acceptable)
- [ ] Test with 1000 customers (should show performance warning if applicable)
- [ ] Verify CSV import handles large files gracefully

## Error Handling

- [ ] Test with invalid API response
- [ ] Test with network error
- [ ] Test with malformed CSV
- [ ] Test with missing required fields
- [ ] Verify error messages are user-friendly
- [ ] Verify errors don't crash the app

## Final Checklist

- [ ] All tabs work correctly
- [ ] All forms validate correctly
- [ ] All buttons work correctly
- [ ] All modals open/close correctly
- [ ] All copy buttons work correctly
- [ ] All status updates work correctly
- [ ] All metrics calculate correctly
- [ ] All quality checks appear correctly
- [ ] All next actions appear correctly
- [ ] Data persists correctly
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No linting errors

## Notes

- V3 does NOT send SMS/email externally
- All sending is simulated via manual status tracking
- Templates are generated deterministically (not AI-generated in V3)
- Data is stored in localStorage only (no database)

