# Local Keyword Research Tool — V3.1 — Release Notes

**Release Date:** December 29, 2025  
**Version:** V3.1  
**Status:** ✅ Production Ready (Pre–Google Ads Live Metrics)

## Overview

Local Keyword Research Tool V3.1 introduces polish improvements focused on UX clarity and usability enhancements. This release improves metrics badge messaging, adds desktop table header stickiness, and introduces cluster-level copy functionality. **Google Ads Basic Access is still pending** — live metrics will be enabled once approved.

## What's New in V3.1

### Polish Improvements

- **Metrics Badge Micro-Copy Clarity**: Updated badge text from "Mixed/Estimated" to "Estimated" with clearer helper text: "Google Ads live metrics will appear once Basic Access is approved." This provides better transparency about the metrics source and what users can expect.

- **Optional Sticky Table Header (Desktop Only)**: The Top Priority Keywords table header now sticks to the top of the scroll container on desktop (≥ md breakpoint) for better usability when scrolling through long keyword lists. Mobile behavior remains unchanged.

- **Cluster Cards "Copy Cluster" Button**: Added a "Copy Cluster" button to each Keyword Cluster card header (top-right). Copies all keywords in the cluster with format: `keyword — intent — difficulty` (one per line). Uses existing clipboard helper and shows temporary "Copied" feedback. Button is hidden for empty clusters.

## What Did NOT Change

- **No Backend/API Changes**: All improvements are frontend-only polish enhancements
- **No Schema Changes**: No data structure or type changes
- **Google Ads Live Metrics Still Pending**: Google Ads Basic Access approval is still required before live metrics can be enabled
- **Core Functionality Unchanged**: All existing features work exactly as before

## QA Checklist

- ✅ Verify metrics badge shows "Metrics: Estimated" (not "Mixed/Estimated") when Google Ads data is not live
- ✅ Verify helper text below badge reads: "Google Ads live metrics will appear once Basic Access is approved."
- ✅ Verify sticky header works on desktop (≥ md breakpoint) — header sticks to top when scrolling table
- ✅ Verify sticky header does not affect mobile behavior
- ✅ Verify "Copy Cluster" button appears in top-right of each cluster card header
- ✅ Verify "Copy Cluster" copies correct format: `keyword — intent — difficulty` (one per line)
- ✅ Verify clipboard functionality works correctly
- ✅ Verify "Copied" feedback appears and disappears after 1.5 seconds
- ✅ Verify button is hidden for empty clusters
- ✅ Verify mobile UX unchanged (no sticky header, buttons still functional)

## Next Steps (When Google Approves Basic Access)

- [ ] Enable Google Ads Keyword Planner live metrics ingestion
- [ ] Confirm `dataSource` becomes `"google-ads"` for keywords with live data
- [ ] Update badge to show "Live Google Ads" when applicable
- [ ] Verify metrics badge helper text updates to: "Metrics are pulled from Google Ads Keyword Planner."

## Technical Notes

- All changes are CSS-only (sticky header) or additive UI enhancements
- No new dependencies introduced
- No breaking changes
- TypeScript + ESLint clean
- Matches existing V3 patterns and styling

