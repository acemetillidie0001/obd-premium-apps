# Reputation Dashboard V3 - Release Notes

**Release Date:** December 24, 2024  
**Version:** 3.0.0  
**Status:** Production Ready

## Overview

Reputation Dashboard V3 is a production-ready OBD Premium App that provides comprehensive reputation analytics for local businesses. It computes KPIs, visualizes trends, analyzes sentiment, and identifies themes from manually entered or CSV-imported reviews. All calculations are performed server-side using a pure, testable engine module, ensuring consistent and reliable results.

## What's New in V3

### Dashboard UI
- **Manual Review Entry**: Add reviews one-by-one via an accessible modal form with validation
- **KPI Dashboard**: Real-time calculation and display of reputation metrics (score, rating, count, response rate, response time)
- **Time Series Charts**: SVG-based charts visualize rating trends, review volume, and response activity over time
- **Theme Extraction Panel**: Displays top 5 themes identified from review keywords with confidence indicators
- **Sentiment Mix Panel**: Shows percentage breakdown of positive/neutral/negative reviews with derivation tooltips
- **Quality Signals Panel**: Deterministic insights panel with severity levels (info/warning/critical)
- **Priority Actions Panel**: 3-5 actionable recommendations based on current KPIs
- **Low-Data Warnings**: Smart banners and guarded states when review count < 5
- **Empty State Handling**: Clear messaging and disabled states when no reviews exist

### Scoring & Breakdown
- **Reputation Score Calculation**: Weighted formula `(Avg Rating / 5) × 60 + (Response Rate / 100) × 40`
- **Score Breakdown Drawer**: Detailed modal accessible via "ℹ️ How it's calculated" link showing:
  - Total score (0-100)
  - Rating component (0-60 points) with contribution, weight, and formula
  - Response component (0-40 points) with contribution, weight, and formula
  - Raw inputs (total reviews, ratings sum, average, responded count, response rate)
- **Neutral Default Handling**: When no responses exist, uses 50% response rate (20 points) with explanatory tooltip
- **Median Response Time**: Displays "N/A" when no responses, with tooltip explanation

### CSV Import
- **Tolerant Parsing**: Handles various formats for:
  - Ratings: "5", "5 stars", "4/5", etc.
  - Dates: ISO format, common date formats (auto-converted to ISO)
  - Booleans: "yes", "true", "1", "y" for responded field
- **Automatic Column Mapping**: Detects columns even with different header names:
  - Platform: `platform`, `Platform`, `Source`
  - Rating: `rating`, `Rating`, `Stars`, `Score`
  - Review Text: `reviewText`, `review text`, `Review Text`, `Comment`, `Text`
  - Review Date: `reviewDate`, `review date`, `Review Date`, `Date`, `Reviewed`
  - And more for optional fields
- **Row-Level Validation**: Shows per-row errors in preview modal with row index and specific error messages
- **CSV Template Download**: "Download Template" button provides sample CSV with correct format and example data
- **Preview Pagination**: Shows first 200 rows by default with "Show more" button (increments by 200)
- **Large Import Warning**: Banner displayed when reviews > 2000: "Large import detected — computations may take a moment."
- **Safe Parsing**: Handles quoted fields correctly and prevents formula injection (all values treated as plain text)

### Insights
- **Sentiment Analysis with Confidence**: Heuristic-based classification with metadata:
  - `sentimentDerivedFrom`: "rating" | "textOverride" | "mixed"
  - `sentimentConfidence`: "low" | "medium" | "high"
  - Tooltip explains derivation method
- **Theme Extraction with Keywords**: Each theme includes:
  - `matchedKeywords`: Top 3 keyword hits used to identify theme
  - `themeConfidence`: "low" | "medium" | "high" (based on hit counts + review coverage)
  - Tooltip shows matched keywords and confidence level
- **Quality Signals**: Deterministic insights derived from KPIs:
  - Response time warnings (goal: <24h)
  - Negative review concentration by theme
  - Review velocity analysis
  - Response rate gap identification
  - Rating trend detection (if ≥10 reviews)
- **Priority Actions**: Context-aware recommendations with actionable text

### Export & Print
- **Export JSON**: Downloads complete dashboard response including:
  - All KPIs, charts data, themes, sentiment, actions
  - `computedAt` (ISO timestamp)
  - `snapshotId` (RD-XXXXXXXX format)
- **Export Reviews CSV**: Downloads all reviews in normalized CSV format
- **Print Report**: Print-friendly view with:
  - Report header showing business name, type, generated timestamp, snapshot ID
  - All dashboard content (KPIs, charts, themes, sentiment, signals, actions)
  - UI controls hidden in print view
- **Export/Print Guards**: Buttons disabled until:
  - Reviews have been added (`reviews.length > 0`)
  - Dashboard has been computed (`result !== null`)
  - Tooltips on disabled buttons: "Add reviews and generate the dashboard to export a report."
  - API validation: Returns 400 error if `reviews.length === 0`

### Persistence
- **Automatic localStorage Save**: All form data automatically saved:
  - Business name and type
  - Date range selection
  - All reviews
  - Last computed timestamp
- **Auto-restore on Page Load**: Data restored when returning to page
- **Clear Data Button**: Confirmation dialog clears all data including:
  - Form fields
  - Reviews
  - Computed results
  - Last computed timestamp
  - localStorage entry

## Technical Notes

### Engine Module
- **Pure Functions**: All calculations in `src/lib/apps/reputation-dashboard/engine.ts`
- **Deterministic**: Same inputs produce same outputs
- **Testable**: Unit tests cover all functions with edge cases
- **No Side Effects**: Functions are pure (no external dependencies or mutations)
- **Type-Safe**: Full TypeScript coverage with strict types

### Deterministic Snapshot ID Hashing
- **Format**: `RD-XXXXXXXX` (8 uppercase hex characters)
- **Algorithm**: FNV-1a 32-bit hash (no external dependencies)
- **Inputs**: Normalized reviews (sorted by date, platform, rating), business name, business type, date range
- **Stability**: Identical inputs produce identical snapshot IDs across sessions
- **Implementation**: `src/lib/apps/reputation-dashboard/hash.ts`
- **Use Case**: Report-grade identification for comparing dashboard snapshots

### ComputedAt Timestamp
- **Storage**: ISO date string stored in response and state
- **Persistence**: Saved to localStorage with form data
- **Display**: Formatted in user's local timezone (browser locale)
- **Export**: Included in JSON export and print view header
- **Format Example**: "Jan 15, 2024, 2:30 PM EST"

## V3 Limitations

### Data Sources
- **No External Platform Integrations**: Reviews must be manually entered or imported via CSV
  - No Google Business Profile API integration
  - No Facebook Graph API integration
  - No Yelp Fusion API integration
- **Manual/CSV Only**: No automated review fetching or syncing

### Analysis Methods
- **Heuristic Sentiment**: Rule-based classification (not LLM-powered)
  - Rating-based primary classification
  - Keyword-based secondary classification for rating 3
  - Limited nuance compared to LLM analysis
- **Simple Theme Extraction**: Keyword matching (not LLM-based topic modeling)
  - Predefined theme keywords only
  - No dynamic theme discovery
  - Limited to 8 predefined themes

### Features
- **No Database Persistence**: Reviews processed in-memory only
  - No saved dashboards per user
  - No historical comparison across time periods
  - Data lost on page refresh (unless in localStorage)
- **No Real-time Monitoring**: No automated review fetching or alerts
- **No Multi-user Support**: Single-session dashboard
- **No PDF Export**: Print view only (no PDF generation library)

## V4 Roadmap

### Connectors & External Integrations
- **Google Business Profile API**: Auto-sync reviews from GBP
- **Facebook Graph API**: Import reviews from Facebook Pages
- **Yelp Fusion API**: Sync Yelp reviews (if available)
- **Webhook Support**: Real-time review notifications
- **Multi-platform Aggregation**: Unified view across all platforms

### Database Persistence
- **User Dashboards**: Save dashboards per user account
- **Review History**: Store review data in database
- **Historical Trends**: Compare metrics across time periods
- **Dataset Management**: Save, load, and compare saved datasets
- **Export/Import**: Share datasets between users

### Advanced Analytics
- **LLM-based Sentiment**: More nuanced sentiment classification using AI
- **Topic Modeling**: Advanced theme extraction using NLP
- **Competitive Analysis**: Compare against industry benchmarks
- **Predictive Insights**: Forecast reputation trends
- **Custom Themes**: User-defined theme keywords

### Automations
- **Auto-response Suggestions**: AI-generated response recommendations
- **Review Request Automation**: Automated follow-up emails/SMS
- **Alert System**: Notifications for negative reviews or low scores
- **Scheduled Reports**: Weekly/monthly email summaries
- **Dashboard Sharing**: Share dashboards with team members

## QA Checklist

### Functional Testing
- [ ] Empty state (no reviews) shows proper message
- [ ] Single review calculates correctly
- [ ] Low data warning (< 5 reviews) displays
- [ ] No responses shows "N/A" for median response time
- [ ] CSV import with various formats works
- [ ] CSV import with errors shows row-level validation
- [ ] Large imports (500+, 2000+) show performance warning
- [ ] Export/Print buttons disabled until compute
- [ ] localStorage restore works correctly
- [ ] Clear Data resets everything
- [ ] Score breakdown shows correct weights and contributions
- [ ] Charts handle single point and sparse data
- [ ] Modals close with ESC key
- [ ] Focus trap works in modals
- [ ] Keyboard navigation for charts works

### Edge Cases
- [ ] Reviews outside date range are filtered
- [ ] Invalid dates are handled gracefully
- [ ] Response time > 1 year is ignored (sanity check)
- [ ] Empty review text is rejected
- [ ] CSV with missing columns shows helpful error
- [ ] Formula injection in CSV is prevented

### Accessibility
- [ ] All modals have ARIA labels
- [ ] Modal focus trap works
- [ ] ESC key closes modals
- [ ] Chart points/bars are keyboard accessible
- [ ] Tooltips work with keyboard focus
- [ ] Disabled buttons have aria-describedby

### Performance
- [ ] Large CSV imports don't lock UI
- [ ] CSV preview pagination works
- [ ] Charts render quickly
- [ ] No expensive recomputation on re-renders

### Security
- [ ] API input validation rejects malformed payloads
- [ ] No PII in logs
- [ ] CSV parsing doesn't execute formulas
- [ ] Error messages don't expose sensitive data

## Deploy Checklist

### Pre-Deploy Commands
```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build

# Test (if available)
npm test
```

### Post-Deploy Smoke Test
1. Navigate to `/apps/reputation-dashboard`
2. Verify empty state message displays
3. Add a single review manually (click "Add Review", fill form, submit)
4. Click "Generate Dashboard" and verify results appear
5. Click "ℹ️ How it's calculated" on Reputation Score tile, verify breakdown modal opens
6. Click "Download Template", verify CSV downloads
7. Import CSV (use template or test data), verify preview modal shows
8. Click "Export JSON", verify file downloads with `computedAt` and `snapshotId`
9. Click "Print Report", verify print view shows header with timestamp and snapshot ID
10. Refresh page, verify data is restored from localStorage
11. Click "Clear Data", confirm dialog, verify everything resets

### Monitoring
- Check error logs for any 500 errors
- Monitor API response times
- Verify localStorage is working in production
- Check for any console errors in browser

---

**Maintainer:** OBD Development Team  
**Support:** Contact OBD development team for issues or feature requests
