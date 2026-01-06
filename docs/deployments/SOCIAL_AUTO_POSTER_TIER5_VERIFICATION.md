# Social Auto-Poster Tier 5 Verification Checklist

## A) Tier 5A Checks

### Connection Status Badge
1. **Badge Display**: Connection status badge appears on all pages (Dashboard, Setup, Composer, Queue, Activity)
2. **Status States**: Badge shows correct state (Connected, Limited Mode, API Pending, Disabled, Error) with appropriate color
3. **Status Messages**: Status messages are calm and actionable (no scary error language)
4. **Badge Location**: Badge appears near page title, after navigation

### Honest Metrics
5. **Analytics Panel**: Dashboard shows accurate metrics (scheduled, posted, success rate, platform distribution)
6. **No Inflated Numbers**: Metrics reflect actual queue/activity data, not placeholder values
7. **Empty States**: Metrics show "0" or empty state when no data exists

### Queue Chips
8. **Status Chips**: Queue items display correct status chips (Draft, Approved, Scheduled, Posted, Failed, Skipped, Blocked)
9. **Blocked State**: Items show "Blocked" chip when connection prevents publishing (pending/disabled/error + approved/scheduled)
10. **Chip Colors**: Status chips use appropriate colors (green for Posted, yellow for Scheduled, red for Failed, etc.)

### Bulk Actions
11. **Bulk Action Bar**: Bulk action bar appears when items are selected
12. **Approve Action**: Bulk approve works correctly (sequential, throttled execution)
13. **Schedule Action**: Bulk schedule works correctly (sequential, throttled execution)
14. **Delete Action**: Bulk delete works correctly with confirmation
15. **Progress Feedback**: Bulk actions show progress feedback (toast notifications)
16. **Connection-Aware Copy**: Bulk action bar shows appropriate messaging based on connection status

---

## B) Tier 5B Checks

### Guided Setup
17. **Setup Sections**: Setup page shows guided sections with completion indicators
18. **Required Sections**: Posting Mode, Platforms, Schedule marked as required
19. **Optional Sections**: Brand & Content marked as optional
20. **Progress Indicator**: Setup progress shows "{x} of {y} required sections complete"
21. **Completion States**: Sections show correct completion state (complete/incomplete)

### Sticky Save Bar
22. **Save Bar Visibility**: Sticky save bar appears at bottom of Setup page
23. **Unsaved Changes Detection**: Save bar shows when unsaved changes exist
24. **Validation**: Save bar disabled when form has validation errors
25. **Save Action**: Save button persists settings correctly

### Callouts
26. **Composer Clarity Banner**: Composer shows banner with Posting Mode and Brand source (Brand Kit vs Local Overrides)
27. **First-Run Callouts**: First-run callouts appear on Setup, Queue, and Composer pages (session-dismissable)
28. **Callout Dismissal**: Callouts can be dismissed and don't reappear in same session
29. **Brand Source Flag**: Deterministic brand source flag (`useBrandKit`) works correctly with backward compatibility

### Activity Messages
30. **Human-Readable Messages**: Activity logs show human-readable messages (not raw error codes)
31. **Next Action Labels**: Activity items show appropriate next action labels (will_retry, paused, needs_attention)
32. **Retry Policy Info**: Activity page shows retry policy info box
33. **Message Clarity**: Messages are clear and actionable

---

## C) Tier 5C Checks

### Offers Builder → Social Auto-Poster

34. **Send Action**: From Offers Builder, clicking "Create Social Campaign" writes payload to sessionStorage
35. **Redirect**: Redirects to `/apps/social-auto-poster/composer?handoff=1`
36. **Import Banner**: Import banner appears with source attribution ("From Offers & Promotions")
37. **No Overwrite**: Composer does NOT overwrite existing content (only prefills if topic and details are empty)
38. **Payload Clear**: After import/dismiss, sessionStorage payload is cleared
39. **URL Cleanup**: `?handoff=1` is removed from URL after import

### AI Content Writer → Social Auto-Poster

40. **Send Action**: From AI Content Writer Export Center, clicking "Send to Social Auto-Poster" writes text to sessionStorage
41. **Redirect**: Redirects to `/apps/social-auto-poster/composer?handoff=1`
42. **Import Banner**: Import banner appears with source attribution ("From Content Writer")
43. **Text Import**: Final edited text is imported into composer (topic/details split if long)
44. **No Overwrite**: Composer does NOT overwrite existing content (only prefills if empty)
45. **Payload Clear**: After import/dismiss, sessionStorage payload is cleared
46. **URL Cleanup**: `?handoff=1` is removed from URL after import

### Event Campaign Builder → Social Auto-Poster

47. **Send Action**: From Event Campaign Builder, clicking "Create Event Social Posts" writes event payload to sessionStorage
48. **Redirect**: Redirects to `/apps/social-auto-poster/composer?handoff=1`
49. **Import Banner**: Import banner appears with source attribution ("From Event Campaign Builder")
50. **Variant Selector**: If countdown variants exist, variant dropdown appears in banner
51. **First Variant Prefill**: Composer prefills with first countdown variant if topic/details are empty
52. **Variant Switching**: Selecting different variant updates composer ONLY if content matches original imported text
53. **Edit Protection**: If user has edited content, variant switching silently does nothing (no overwrite)
54. **Event Details**: Event name, date, location, description are included in prefill
55. **No Overwrite**: Composer does NOT overwrite existing content (only prefills if empty)
56. **Payload Clear**: After import/dismiss, sessionStorage payload is cleared
57. **URL Cleanup**: `?handoff=1` is removed from URL after import

### TTL Expiry Behavior

58. **TTL Default**: Default TTL is 10 minutes (600,000ms)
59. **Expired Handoff**: If handoff is expired (>10 minutes old), it is not imported
60. **Expired Clear**: Expired handoffs are automatically cleared from sessionStorage
61. **Expired Error**: Expired handoffs show appropriate error (no import banner)

### URL Cleanup

62. **Param Removal**: `?handoff=1` is removed from URL after import
63. **Other Params Preserved**: Other query parameters (if any) are preserved during cleanup
64. **No Reload**: URL cleanup uses `replaceState` (no page reload)
65. **Dismiss Cleanup**: Dismissing import banner also triggers URL cleanup

### Guardrails

66. **No Auto-Save**: Settings are never automatically saved (user must click Save)
67. **No Auto-Queue**: No queue entries are created automatically (user must manually add to queue)
68. **Prefill Only If Empty**: Composer only prefills if both topic and details are empty
69. **No Overwrite**: Existing content is never overwritten by handoff import
70. **SessionStorage Clear**: Payload is cleared from sessionStorage after import/dismiss
71. **Duplicate Prevention**: Refreshing page does not re-import (payload already cleared)

---

## Verification Notes

- All checks should be verified in both light and dark mode
- Test on mobile viewport to ensure responsive behavior
- Verify sessionStorage operations work correctly (including private browsing mode fallback)
- Test TTL expiry by manually setting old timestamp in sessionStorage
- Verify URL cleanup preserves other query parameters
- Test variant switching with edited content to ensure no overwrite

---

## Automated Verification Commands

The following commands were run and passed prior to Tier 5 lock and maintenance mode:

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run vercel-build`
