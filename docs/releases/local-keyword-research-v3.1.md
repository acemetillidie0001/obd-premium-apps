# Local Keyword Research Tool — V3.1 — Release Notes

**Release Date:** December 29, 2025  
**Version:** V3.1  
**Status:** ✅ Production Ready (Live Google Ads metrics supported via Keyword Planner Basic Access)

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

- ✅ Enable Google Ads Keyword Planner historical metrics ingestion (Basic Access)
- ✅ Confirm `dataSource` becomes `"google-ads"` for keywords with live data (UI badge flips to Live)
- ✅ Keep mock fallback when credentials are missing or API calls fail

## Enabling LIVE Google Ads metrics (Basic Access)

Set `LOCAL_KEYWORD_METRICS_SOURCE=google-ads` and provide all required Google Ads env vars.

### Required env vars

- `LOCAL_KEYWORD_METRICS_SOURCE=google-ads`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CLIENT_CUSTOMER_ID`
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (optional, recommended when using a Manager/MCC account)

### Example `.env.local`

```bash
LOCAL_KEYWORD_METRICS_SOURCE=google-ads
GOOGLE_ADS_DEVELOPER_TOKEN=your_dev_token
GOOGLE_ADS_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_CLIENT_CUSTOMER_ID=2386063507
GOOGLE_ADS_LOGIN_CUSTOMER_ID=2386063507
```

### Notes

- Uses Keyword Planner **historical metrics** (avg monthly searches, competition, CPC).
- Uses **USA-only** geo targeting for now (`geoTargetConstants/2840`) and **English** (`languageConstants/1000`).
- Requests are batched (100 keywords per request) with a 15s timeout per batch.
- Customer IDs should be **numbers only** (no dashes):
  - `GOOGLE_ADS_LOGIN_CUSTOMER_ID`: the **manager (MCC) account ID** (numbers only). Optional, but recommended when accessing a client account via an MCC.
  - `GOOGLE_ADS_CLIENT_CUSTOMER_ID`: the **account being queried** (numbers only).

## Technical Notes

- All changes are CSS-only (sticky header) or additive UI enhancements
- No new dependencies introduced
- No breaking changes
- TypeScript + ESLint clean
- Matches existing V3 patterns and styling

