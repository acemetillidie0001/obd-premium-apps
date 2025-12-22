# Event Campaign Builder — Test Suite

## Files

- **`event-campaign-builder.http`** - HTTP test requests for all scenarios
- **`event-campaign-builder-qa.md`** - QA testing guide with verification checklists
- **`event-campaign-builder-review.md`** - Code review findings and recommendations

## Quick Start

1. Start dev server: `npm run dev`
2. Open `event-campaign-builder.http` in VS Code
3. Install REST Client extension if needed
4. Click "Send Request" above any scenario
5. Verify response matches expectations in `event-campaign-builder-qa.md`

## Test Scenarios

1. **Baseline Happy Path** - Full English campaign, all channels ON
2. **Validation Error** - Missing required field (eventName)
3. **All Channels OFF** - Verify toggle enforcement
4. **Spanish-only** - Language = Spanish
5. **Bilingual** - Language = Bilingual with format separation
6. **Last-Minute** - Urgency = "Last-Minute", short duration
7. **Duration Clamping** - Test min (0→3) and max (100→30) bounds

## Review Summary

✅ **Status**: Production Ready

**Key Findings**:
- Response shape matches TypeScript types ✅
- Error handling is consistent ✅
- Channel toggles enforced correctly ✅
- Fixed: Duration validation inconsistency (Zod schema now matches normalization: 3-30)

**Minor Recommendations**:
- Add "at least one channel" validation
- Consider dynamic token limits for bilingual responses
- Add rate limiting for production

See `event-campaign-builder-review.md` for full details.
