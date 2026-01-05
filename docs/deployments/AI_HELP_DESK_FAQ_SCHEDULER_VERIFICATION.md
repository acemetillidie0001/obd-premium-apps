# AI Help Desk Integration Verification Checklist

## A) AI Help Desk → FAQ Generator Handoff

1. **Import Flow**: From AI Help Desk Insights, select filtered questions and click "Convert to FAQs" → FAQ Generator opens with Imported Questions panel visible
2. **Panel Display**: Imported Questions panel shows correct count, subtitle "From AI Help Desk Insights", and list of questions
3. **Apply to Inputs**: Click "Apply to Inputs" → Questions append to services field with format "Customer questions to answer:\n- Q1\n- Q2..." (does not overwrite existing text)
4. **Clear Function**: Click "Clear" → Imported Questions panel disappears, state cleared
5. **URL Cleanup & Guard**: After import, URL params (`handoff`, `handoffId`) are cleared; refreshing page does not re-import (duplicate import guarded)
6. **Topic Auto-Fill**: If topic field is empty, it auto-fills to `importedTopic || "Customer Questions"`

## B) Scheduler Awareness (AI Help Desk Chat)

7. **Booking Intent Detection**: Ask "How do I book an appointment?" → Booking card appears under assistant answer (after sources, before no-sources indicator)
8. **Public Link Fetch**: Booking link loads via `/api/obd-scheduler/public-link` and button opens `/book/{code}` or `prettyUrl` (if available)
9. **Fallback Behavior**: Simulate API error (block network or invalid response) → Button shows fallback label "Open Scheduler & Booking" and links to `/apps/obd-scheduler`
10. **No Availability Language**: Verify card text contains no claims like "we have openings", "available times", etc. (only guidance: "Use the booking page to request a time.")
11. **Non-Booking Questions**: Ask "What are your hours?" → No booking card appears
12. **Dark Mode + Mobile**: Toggle dark mode and test on mobile viewport → Booking card and Imported Questions panel render correctly with appropriate styling
