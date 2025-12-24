# Reputation Dashboard V3 - Documentation

## Overview

The Reputation Dashboard is a V3 production-ready OBD Premium App that provides comprehensive reputation analytics for local businesses. It computes KPIs, visualizes trends, analyzes sentiment, and identifies themes from manually entered or CSV-imported reviews.

**Status:** Live (V3)  
**Route:** `/reputation-dashboard`  
**Category:** Reputation

## V3 Scope (Production Polish)

### What's Included

- **Manual Review Entry**: Add reviews one-by-one via a modal form
- **Enhanced CSV Import**: 
  - Tolerant parsing (handles various date/rating/boolean formats)
  - Row-level validation with error reporting
  - Automatic column mapping for flexible headers
  - CSV template download
- **Score Breakdown UI**: Detailed modal showing sub-scores, weights, contributions, and raw inputs
- **KPI Dashboard**: Real-time calculation of reputation metrics
- **Time Series Charts**: Visualize rating trends, review volume, and response activity
- **Theme Extraction**: Simple keyword-based clustering to identify common topics
- **Sentiment Analysis**: Heuristic-based sentiment classification (positive/neutral/negative)
- **Priority Actions**: AI-generated actionable recommendations
- **Export Functionality**:
  - Export computed dashboard as JSON
  - Export normalized reviews as CSV
  - Print-friendly report view
- **Data Persistence**: 
  - Automatic localStorage save/restore
  - Clear Data button with confirmation
- **Pure Engine Module**: All calculations refactored into testable `engine.ts` module
- **Unit Tests**: Comprehensive test coverage for engine functions
- **Low-Data Gating**: Smart warnings and guarded states for insufficient data
- **Explainability**: Confidence metadata for sentiment and theme analysis
- **Quality Signals**: Deterministic insights panel with severity levels
- **Performance Guards**: Pagination for large imports, warnings for 2000+ reviews
- **Chart Robustness**: Handles sparse data, single points, tooltips with accessibility
- **Future-Proof Hooks**: Dataset metadata structure ready for V4 persistence

### What's NOT Included (V4 Roadmap)

- **External Platform Integrations**: No automatic syncing with Google, Facebook, Yelp APIs
- **Database Persistence**: Reviews are processed in-memory only (no DB storage yet)
- **Advanced NLP**: Theme extraction uses keyword matching, not LLM-based analysis
- **Real-time Monitoring**: No automated review fetching or alerts
- **Multi-user Support**: Single-session dashboard (no saved dashboards per user)

## Data Format

### Manual Review Entry

When adding a review manually, the following fields are available:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `platform` | Yes | `"Google" \| "Facebook" \| "Yelp" \| "Other"` | Review platform |
| `rating` | Yes | `1-5` | Star rating |
| `reviewText` | Yes | `string` | Review content |
| `authorName` | No | `string` | Reviewer name |
| `reviewDate` | Yes | `YYYY-MM-DD` | Date of review |
| `responded` | Yes | `boolean` | Whether business responded |
| `responseDate` | No | `YYYY-MM-DD` | Date of response (if responded) |
| `responseText` | No | `string` | Response content (if responded) |

### CSV Import Format (Enhanced V3)

The CSV import now features **tolerant parsing** and **automatic column mapping**:

**Required Columns** (auto-detected):
- `platform` (or `Platform`, `Source`) - Accepts: Google, Facebook, Yelp, Other
- `rating` (or `Rating`, `Stars`, `Score`) - Accepts: 1-5, "5 stars", "4/5", etc.
- `reviewText` (or `review text`, `Review Text`, `Comment`, `Text`)
- `reviewDate` (or `review date`, `Review Date`, `Date`, `Reviewed`) - Accepts: ISO format, common date formats

**Optional Columns** (auto-detected):
- `authorName` (or `author name`, `Author Name`, `Reviewer`, `Customer`)
- `responded` (or `Responded`, `Response`, `Replied`) - Accepts: yes, true, 1, y, no, false, 0, n
- `responseDate` (or `response date`, `Response Date`, `Replied Date`)
- `responseText` (or `response text`, `Response Text`, `Reply`, `Response Comment`)

**Features:**
- **Column Mapping**: Automatically detects columns even with different header names
- **Tolerant Parsing**: Handles various formats for ratings, dates, and booleans
- **Row Validation**: Shows per-row errors in preview modal with row index and specific error messages
- **Template Download**: "Download Template" button provides sample CSV with correct format and example data
- **CSV Template Rules**: 
  - Headers must include: `platform`, `rating`, `reviewText`, `reviewDate` (required)
  - Optional headers: `authorName`, `responded`, `responseDate`, `responseText`
  - Dates must be in ISO format (YYYY-MM-DD) or common formats (auto-converted)
  - Ratings must be 1-5 (accepts "5", "5 stars", "4/5", etc.)
  - Responded field accepts: "yes", "true", "1", "y" for true; "no", "false", "0", "n" for false
  - Text fields with commas must be quoted

**Example CSV:**
```csv
platform,rating,reviewText,authorName,reviewDate,responded,responseDate,responseText
Google,5,"Great service! Very professional.",John Doe,2024-01-15,yes,2024-01-16,"Thank you for the kind words!"
Facebook,4,"Good experience overall.",Jane Smith,2024-01-20,no,,
Yelp,3,"Average service, could be better.",Bob Johnson,2024-01-25,yes,2024-01-26,"We appreciate your feedback."
```

## Scoring Formula

### Reputation Score (0-100)

The reputation score is calculated using a weighted formula:

```
Reputation Score = (Average Rating / 5) × 60 + (Response Rate / 100) × 40
```

**Components:**
- **Rating Component (0-60 points)**: Based on average star rating across all reviews
- **Response Component (0-40 points)**: Based on percentage of reviews that received a response

**Example:**
- Average Rating: 4.5/5 → Rating Component = (4.5/5) × 60 = 54 points
- Response Rate: 75% → Response Component = 0.75 × 40 = 30 points
- **Total Score: 54 + 30 = 84**

### Score Breakdown UI

Click the "ℹ️ How it's calculated" link on the Reputation Score tile to view a detailed breakdown modal showing:
- **Total Score**: Final calculated score (0-100)
- **Rating Component**: 
  - Contribution points (0-60)
  - Average rating used
  - Formula breakdown
- **Response Component**:
  - Contribution points (0-40)
  - Response rate percentage
  - Formula breakdown
- **Raw Inputs**: 
  - Total reviews count
  - Total ratings sum
  - Average rating
  - Responded count
  - Response rate percentage

### Other KPIs

- **Average Rating**: Simple mean of all ratings (rounded to 1 decimal)
- **Review Count**: Total number of reviews in the selected date range
- **Response Rate**: Percentage of reviews with `responded = true` (0-100%)
- **Median Response Time**: Median time difference between `reviewDate` and `responseDate` (in hours)

## Sentiment Analysis

V3 uses a **heuristic-based sentiment classifier**:

1. **Rating-based primary classification:**
   - Rating 4-5 → Positive
   - Rating 1-2 → Negative
   - Rating 3 → Proceed to keyword analysis

2. **Keyword-based secondary classification (for rating 3):**
   - Positive keywords: `great`, `excellent`, `good`, `love`, `amazing`, `wonderful`, `perfect`, `best`, `recommend`, `happy`, `satisfied`, `pleased`
   - Negative keywords: `terrible`, `awful`, `horrible`, `bad`, `worst`, `disappointed`, `poor`, `unhappy`, `dissatisfied`, `hate`, `never`, `avoid`
   - If positive count > negative count → Positive
   - If negative count > positive count → Negative
   - Otherwise → Neutral

**Note:** For V4, this can be enhanced with LLM-based sentiment analysis for more nuanced classification.

## Theme Extraction

V3 uses **simple keyword clustering** to identify themes:

**Predefined Theme Keywords:**
- **Customer Service**: service, staff, employee, helpful, friendly, customer, support
- **Quality**: quality, excellent, great, good, amazing, perfect, best
- **Price**: price, affordable, expensive, cost, value, worth, cheap, budget
- **Speed**: fast, quick, slow, timely, efficient, wait, time
- **Cleanliness**: clean, dirty, messy, organized, tidy, hygiene
- **Location**: location, convenient, close, near, parking, access
- **Communication**: communication, respond, call, email, contact, reach
- **Product/Service**: product, service, work, job, result, outcome

**Process:**
1. Scan each review text for theme keywords
2. Count matches per theme
3. Extract example snippets (first 100 chars) for each theme
4. Return top 5 themes by count

**Note:** For V4, this can be enhanced with LLM-based topic modeling for more sophisticated theme discovery.

## Priority Actions

The dashboard generates 3-5 priority actions based on current KPIs:

**Action Triggers:**
- **Response Rate < 80%**: Suggests improving response rate
- **Median Response Time > 48 hours**: Suggests reducing response time
- **Negative Sentiment > 20%**: Suggests addressing negative reviews
- **Review Count < 10**: Suggests increasing review volume
- **Average Rating < 4.0**: Suggests improving average rating

Each action includes:
- **Title**: Short action name
- **Description**: Context about why this matters
- **Actionable Text**: Copy-ready text with specific steps

## API Endpoint

**POST** `/api/reputation-dashboard`

### Request Body

```typescript
{
  businessName: string; // Required
  businessType?: string;
  dateRange: {
    mode: "30d" | "90d" | "custom";
    startDate?: string; // Required if mode is "custom"
    endDate?: string;   // Required if mode is "custom"
  };
  reviews: ReviewInput[]; // Array of review objects
}
```

### Response

```typescript
{
  kpis: {
    reputationScore: number;      // 0-100
    avgRating: number;            // 1-5
    reviewCount: number;
    responseRate: number;         // 0-100
    medianResponseTime: number;   // hours (0 if no responses, but metadata.hasNoResponses = true)
  };
  scoreBreakdown: {
    totalScore: number;           // 0-100
    ratingComponent: {
      value: number;              // 0-60
      weight: number;             // 60
      avgRating: number;          // 1-5
      contribution: number;       // calculated points
    };
    responseComponent: {
      value: number;              // 0-40
      weight: number;             // 40
      responseRate: number;       // 0-100 percentage (50 if no responses)
      contribution: number;       // calculated points
    };
    rawInputs: {
      totalReviews: number;
      totalRatings: number;
      avgRating: number;
      respondedCount: number;
      totalResponseRate: number;
    };
  };
  ratingOverTime: Array<{ date: string; value: number }>;
  reviewsPerWeek: Array<{ date: string; value: number }>;
  responsesPerWeek: Array<{ date: string; value: number }>;
  topThemes: Array<{
    name: string;
    count: number;
    exampleSnippet: string;
    matchedKeywords: string[];   // top 3 keyword hits
    themeConfidence: "low" | "medium" | "high";
  }>; // Top 5
  sentimentMix: {
    positive: number;            // percentage
    neutral: number;              // percentage
    negative: number;             // percentage
    reviewSentiments?: Array<{   // per-review sentiment metadata
      sentiment: "positive" | "neutral" | "negative";
      derivedFrom: "rating" | "textOverride" | "mixed";
      confidence: "low" | "medium" | "high";
    }>;
  };
  priorityActions: Array<{
    id: string;
    title: string;
    description: string;
    actionableText: string;
  }>; // 3-5 items
  qualitySignals: Array<{
    id: string;
    severity: "info" | "warning" | "critical";
    shortTitle: string;
    detail: string;
    suggestedNextStep: string;
  }>; // 3-5 deterministic insights
  datasetInfo?: {
    datasetId: string;           // UUID format
    createdAt: string;           // ISO date
    businessName: string;
    businessType?: string;
    dateRange: DateRange;
    reviewsNormalizedCount: number;
  };
  snapshotId: string;            // Deterministic snapshot ID (RD-XXXXXXXX format)
  computedAt: string;            // ISO date string of when dashboard was computed
  metadata: {
    hasLowData: boolean;         // reviewCount < 5
    hasNoResponses: boolean;      // respondedReviews === 0
    totalReviewsInDataset: number; // before date filtering
  };
}
```

## Future V4 Integrations Roadmap

### Phase 1: External Platform Integrations
- **Google Business Profile API**: Auto-sync reviews from GBP
- **Facebook Graph API**: Import reviews from Facebook Pages
- **Yelp Fusion API**: Sync Yelp reviews (if available)
- **Webhook Support**: Real-time review notifications

### Phase 2: Database Persistence
- **User Dashboards**: Save dashboards per user account
- **Review History**: Store review data in database
- **Historical Trends**: Compare metrics across time periods
- **Export Functionality**: Download reports as PDF/CSV

### Phase 3: Advanced Analytics
- **LLM-based Sentiment**: More nuanced sentiment classification
- **Topic Modeling**: Advanced theme extraction using NLP
- **Competitive Analysis**: Compare against industry benchmarks
- **Predictive Insights**: Forecast reputation trends

### Phase 4: Automation
- **Auto-response Suggestions**: AI-generated response recommendations
- **Review Request Automation**: Automated follow-up emails/SMS
- **Alert System**: Notifications for negative reviews or low scores
- **Scheduled Reports**: Weekly/monthly email summaries

## Export & Persistence

### Export Options

1. **Export JSON**: Downloads the complete dashboard response as JSON (includes all KPIs, charts data, themes, sentiment, actions, `computedAt`, `snapshotId`)
2. **Export Reviews CSV**: Downloads all reviews in normalized CSV format
3. **Print Report**: Opens print-friendly view (hides UI controls, shows only dashboard content with report header)

### Export & Print Guards

- **Empty State Protection**: Export and Print buttons are disabled when:
  - No reviews have been added (`reviews.length === 0`)
  - Dashboard has not been computed yet (`result === null`)
- **Tooltips**: Disabled buttons show tooltips on hover/focus: "Add reviews and generate the dashboard to export a report."
- **API Validation**: API route returns 400 error with friendly message if `reviews.length === 0`
- **Accessibility**: Disabled buttons remain keyboard-focusable with `aria-describedby` linking to help text

### Data Persistence

- **Automatic Save**: All form data (business name, type, date range, reviews, `lastComputed` timestamp) is automatically saved to localStorage
- **Auto-restore**: Data is restored when you return to the page, including last computed timestamp
- **Clear Data**: Button to clear all data with confirmation dialog (also clears `lastComputed`)

## Low-Data & Edge-Case Gating

The dashboard includes intelligent gating to prevent misleading insights when data is insufficient:

### Review Count Thresholds

- **0 Reviews**: 
  - All KPI tiles disabled except "0 reviews" message
  - Strong empty state: "No reviews yet — add reviews to begin."
  - All analysis panels show empty states

- **< 5 Reviews**:
  - Warning banner: "Low data: trends and themes may be unreliable."
  - Theme extraction panel shows: "Needs at least 5 reviews to detect themes."
  - Sentiment mix still displays with note: "Derived primarily from ratings (limited sample)."
  - Charts and KPIs still function but with reduced reliability

- **≥ 5 Reviews**: Full analysis enabled

### Response Time Edge Cases

- **No Responses** (`respondedReviews === 0`):
  - Median Response Time tile displays "N/A" (not 0)
  - Score breakdown uses neutral default (50% response rate = 20 points)
  - Tooltip explains: "No responses yet. Using neutral default for score calculation."

## Explainability & Confidence Metadata

### Sentiment Analysis

Each review's sentiment includes metadata:

- **`sentimentDerivedFrom`**: 
  - `"rating"`: Classification based solely on rating (1-2 = negative, 4-5 = positive, 3 = neutral)
  - `"textOverride"`: Rating 3 with keyword analysis overriding rating
  - `"mixed"`: Rating 4-5 with positive keywords, or rating 1-2 with negative keywords

- **`sentimentConfidence`**:
  - `"high"`: Rating 5/1, or rating 4/2 with matching keywords
  - `"medium"`: Rating 4/2 without keywords, or rating 3 with 2+ keyword matches
  - `"low"`: Rating 3 with minimal/no keyword matches

**UI Display**: Tooltip on Sentiment Mix panel explains derivation method.

### Theme Extraction

Each theme includes:

- **`matchedKeywords`**: Array of top 3 keyword hits used to identify the theme
- **`themeConfidence`**:
  - `"high"`: 5+ mentions AND 30%+ review coverage
  - `"medium"**: 3+ mentions AND 15%+ review coverage
  - `"low"**: Fewer mentions or lower coverage

**UI Display**: Confidence badge on each theme with tooltip showing matched keywords.

## Performance & Scalability Guards

### CSV Import Performance

- **Preview Pagination**: Only first 200 rows shown by default
- **"Show More" Button**: Loads next 200 rows incrementally
- **Large Import Warning**: If reviews > 2000, shows banner: "Large import detected — computations may take a moment."

### Chart Performance

- **Sparse Data Handling**: Charts gracefully handle:
  - Empty arrays (shows "No data available")
  - Single point (shows dot with label)
  - Zero values (bars show 1px minimum for visibility)
  - Flatline data (proper axis scaling)

- **Tooltips**: Interactive hover/focus tooltips on chart points/bars with:
  - Value display
  - Date labels
  - Keyboard accessibility (tab navigation, aria-labels)

## Chart Robustness

### Line Charts

- **Single Point**: Displays as centered dot with value and date label
- **Empty Data**: Shows "No data available" message
- **Sparse Data**: Proper scaling even with gaps in time series
- **Tooltips**: Hover/focus shows value and date for each point

### Bar Charts

- **Zero Values**: Shows 1px minimum height (not collapsed)
- **Empty Data**: Shows "No data available" message
- **Sparse Data**: Maintains readable bar width even with few data points
- **Tooltips**: Hover/focus shows count and date for each bar

## Quality Signals Panel

A new "Quality Signals" panel provides deterministic, at-a-glance insights:

### Signal Types

1. **Response Time**: "You respond slower than similar businesses (goal: <24h)"
2. **Negative Review Concentration**: "Negative reviews are concentrated around: [theme]"
3. **Review Velocity**: "Review velocity is low for the selected window"
4. **Response Rate Gap**: "Response rate below target"
5. **Rating Trend**: "Rating trend declining" (if ≥10 reviews)

### Signal Severity

- **`info`**: Informational insights (blue styling)
- **`warning`**: Issues that need attention (yellow styling)
- **`critical`**: Urgent issues requiring immediate action (red styling)

Each signal includes:
- Short title
- Detailed explanation
- Suggested next step (ties into Priority Actions)

## Last Computed Timestamp & Snapshot ID

### Last Computed Timestamp

- **Storage**: Timestamp is stored in state and persisted via localStorage
- **Display**: Shown prominently but subtly in the dashboard header area (near date range / business name)
- **Format**: Formatted in user's local timezone using browser locale (e.g., "Jan 15, 2024, 2:30 PM EST")
- **Export**: Included in exported JSON as `computedAt` (ISO string)
- **Print View**: Shown in print view header as "Report generated: [timestamp]"

### Deterministic Snapshot ID

- **Format**: `RD-XXXXXXXX` where XXXXXXXX is 8 uppercase hexadecimal characters
- **Generation**: Computed deterministically from:
  - Normalized reviews (stable ordering by date, platform, rating)
  - Business name
  - Date range selection (mode + resolved start/end dates)
- **Hash Algorithm**: FNV-1a 32-bit hash (no external dependencies)
- **Stability**: Identical inputs produce identical snapshot IDs across sessions
- **Display**: Shown as small chip/badge near Last Computed timestamp: "Snapshot ID: RD-XXXXXXXX"
- **Export**: Included in API response, exported JSON, and print view header
- **Use Case**: Enables report-grade identification and comparison of dashboard snapshots

### Implementation Details

- **Hash Utility**: `src/lib/apps/reputation-dashboard/hash.ts` contains FNV-1a implementation
- **Normalization**: Reviews are sorted by date, platform, rating for stable hashing
- **Date Range Resolution**: Custom date ranges are resolved to ISO strings for consistency

## Future-Proof Dataset Hooks

### Dataset Metadata Structure

The response includes optional `datasetInfo`:

```typescript
{
  datasetId: string; // UUID format
  createdAt: string; // ISO date
  businessName: string;
  businessType?: string;
  dateRange: DateRange;
  reviewsNormalizedCount: number;
}
```

### Current Implementation (V3)

- **Dataset ID**: Auto-generated UUID on each compute
- **UI Display**: Small "Dataset: [shortId]" chip shown after compute
- **Save Button**: Disabled button "Save dataset" with tooltip "Coming in V4"
- **No Persistence**: Dataset info is computed but not stored

### V4 Integration Path

The structure is ready for:
- Database storage of datasets
- User account association
- Historical comparison
- Export/import of saved datasets

The API accepts optional `datasetId` in requests but does not persist it yet.

## Technical Notes

- **Client-side CSV Parsing**: CSV files are parsed entirely in the browser (no server upload)
- **Pure Engine Module**: All calculations refactored into `src/lib/apps/reputation-dashboard/engine.ts` for testability
- **In-memory Processing**: All calculations happen server-side in a single request
- **No External Dependencies**: Charts use simple SVG (no chart library required)
- **Type-safe**: Full TypeScript coverage with strict types (no `any`)
- **Accessible**: ARIA labels, keyboard navigation, modal focus management, chart tooltips
- **Unit Tests**: Comprehensive test coverage in `engine.test.ts` (vitest)
- **Performance Optimized**: Pagination, memoization, and guards for large datasets

## Testing

### Manual Test Scenarios

1. **Empty State**: Submit with no reviews → Should show error
2. **Single Review**: Add one review → Should calculate KPIs correctly
3. **CSV Import**: Import 10+ reviews → Should preview and import correctly
4. **Date Range Filtering**: Use custom date range → Should filter reviews correctly
5. **Response Time Calculation**: Add reviews with responses → Should calculate median correctly
6. **Sentiment Mix**: Mix of positive/negative reviews → Should calculate percentages correctly
7. **Theme Extraction**: Reviews with common keywords → Should identify top themes

### Edge Cases

- Reviews outside date range should be filtered out
- Empty review text should be rejected
- Invalid dates should be handled gracefully
- CSV with missing columns should show helpful error
- Response time > 1 year should be ignored (sanity check)

## Support

For issues or feature requests, contact the OBD development team.

## Architecture

### Engine Module (`engine.ts`)

All calculation logic is in a pure, testable module:

- `calculateReputationScoreWithBreakdown()`: Detailed score calculation
- `calculateAvgRating()`: Average rating calculation
- `calculateResponseRate()`: Response rate percentage
- `calculateMedianResponseTime()`: Median response time in hours
- `analyzeSentiment()`: Sentiment classification
- `calculateSentimentMix()`: Sentiment distribution
- `extractThemes()`: Theme extraction via keyword clustering
- `generateRatingOverTime()`: Time series for ratings
- `generateReviewsPerWeek()`: Time series for review volume
- `generateResponsesPerWeek()`: Time series for response activity
- `generatePriorityActions()`: Actionable recommendations
- `processReputationDashboard()`: Main processing function

### CSV Utilities (`csv-utils.ts`)

- `detectColumnMapping()`: Auto-detect CSV column mapping
- `parseCSV()`: Tolerant CSV parsing with validation
- `generateCSVTemplate()`: Generate sample CSV template
- `exportReviewsToCSV()`: Export reviews to CSV format

### Hash Utility (`hash.ts`)

- `generateSnapshotId()`: Deterministic snapshot ID generation using FNV-1a 32-bit hash
- `fnv1a32()`: FNV-1a hash function implementation
- `normalizeReviewForHash()`: Stable review normalization for consistent hashing

### Testing

Run unit tests with:
```bash
npm test
# or
vitest
```

Tests cover all engine functions with edge cases and validation.

---

**Version:** 3.1.0 (Production Polish)  
**Last Updated:** 2024  
**Maintainer:** OBD Development Team


