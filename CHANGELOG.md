# Changelog

All notable changes to the OBD Premium Apps project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## AI Help Desk — V3 — 2025-01-XX

**Status:** Production Ready

### Enhancements

- **Widget Live Preview:** Real-time preview of widget appearance with interactive bubble and mini widget window
- **Widget Theme Presets:** Three styling options (Minimal, Bold, Clean) for widget customization
- **Brand Color Auto-Sync:** Toggle to automatically sync widget color with OBD brand color
- **Assistant Avatar Enhancements:** Complete avatar management with tooltip, quick-fill, and initials fallback
- **Website Import Polish:** Drag-and-drop URLs, recent URLs storage, autofill from business profile
- **UX Copy Updates:** Friendlier messaging for business connection warnings and CTAs

### Technical

- Fixed TypeScript error in business profile API route
- Improved preview window mobile responsiveness
- Enhanced accessibility with proper ARIA labels and keyboard navigation
- All changes backwards compatible (no breaking changes)

## Local Keyword Research Tool — V3.1 — 2025-12-29

**Status:** Production Ready (Pre-Google Ads Live Metrics) — Google Ads Basic Access Pending

### Polish

- **Metrics Badge Micro-Copy Clarity**: Updated badge text from "Mixed/Estimated" to "Estimated" with clearer helper text explaining Google Ads Basic Access pending status
- **Optional Sticky Table Header (Desktop Only)**: Top Priority Keywords table header now sticks to top of scroll container on desktop (≥ md breakpoint) for better usability
- **Cluster Cards "Copy Cluster" Button**: Added button to each Keyword Cluster card header that copies all keywords in format: `keyword — intent — difficulty` (one per line)

### Notes

- No backend/API changes — all improvements are frontend-only polish
- No schema changes
- Google Ads Basic Access still pending — live metrics will be enabled once approved
- No breaking changes
- All features are additive

## Local Keyword Research Tool — V3 — 2025-01-XX

**Status:** Production Ready (Pre-Google Ads Live Metrics) — Google Basic Access Pending

### Highlights

- **Keyword Generation & Strategy**: AI-powered local keyword discovery with smart clustering and priority scoring
- **Export Functionality**: CSV and TXT exports with metadata headers and safe filename generation
- **Sorting & Filtering**: Comprehensive table controls for difficulty, intent, and keyword search
- **Metrics Status Badge**: Clear indication of metrics source (Live Google Ads, Mixed/Estimated, or Estimates)
- **Rate Limiting**: Per-IP rate limiting (20 requests per 10 minutes) to prevent abuse
- **Empty State Handling**: Helpful UI when filters return no results

### Technical Improvements

- Safe filename sanitization (max 60 chars, cross-platform compatible)
- Export metadata headers with business info, location, goal, and timestamps
- In-memory rate limiting with automatic pruning
- Strict TypeScript with no `any` types
- V3 styling patterns (OBDPanel, OBDHeading, getThemeClasses)

### Notes

- Metrics currently use estimated/mock data until Google Ads Basic Access approval
- Saved Rank History requires database integration (coming soon)
- No breaking changes
- All features are additive

## Social Auto-Poster — V3A++ — 2025-12-25

**Status:** Production Ready (Pre-Images)

### Highlights

- Premium access enforced on all Social Auto-Poster API routes (403 on non-premium)
- Activity route N+1 query eliminated (bulk fetch)
- Runtime-safe Prisma JSON access via type guards
- AI output schema validated with Zod (422 on invalid responses)
- QueueStatus imports unified to single source of truth
- Content similarity hash upgraded to SHA-256
- Composer defaults correctly initialized from saved settings
- Build-blocking TypeScript issues resolved via safe type narrowing

### Notes

- No breaking changes
- No schema changes
- Ready for Images (V3+++)

### Quality & Process

- Introduced formal lint quality tracking policy
- Release-scoped lint enforcement added
- Global lint backlog documented (non-blocking)

## [3.6.0] - 2025-01-XX

### Added - Review Request Automation (Email Sending)

#### Email Sending via Resend

- **Manual Email Sending**: Added email sending functionality using Resend API
  - "Send Emails Now" button in Queue tab sends all pending EMAIL queue items (max 25 per batch)
  - Per-row "Send" button for individual EMAIL queue items
  - Requires campaign to be saved to database
  - Rate limiting: Maximum 25 emails per batch to prevent abuse
  - **Note**: Sending is manual only; no automatic scheduled sending yet

- **Signed Token-Based Click Tracking**: Review links in emails are replaced with secure tracking URLs
  - Tracking URL: `/api/review-request-automation/click?token=...`
  - Automatically updates queue item status to CLICKED when clicked
  - Redirects to actual review link (Google, Facebook, etc.)
  - Uses HMAC-SHA256 signed tokens with AUTH_SECRET/NEXTAUTH_SECRET (no login required)
  - Constant-time comparison prevents timing attacks

- **Self-Confirmed Review Tracking**: "I left a review" confirmation link in emails
  - Confirmation URL: `/api/review-request-automation/reviewed?token=...`
  - Updates queue item status to REVIEWED when clicked
  - Redirects to Reputation Dashboard with `from=rra` parameter
  - **Important**: This is self-confirmed tracking only. We cannot detect actual Google/Facebook review submission.

- **Status Updates**: Queue items automatically update when emails are sent/clicked/reviewed
  - Status progression: PENDING → SENT → CLICKED → REVIEWED
  - Timestamps recorded: `sentAt`, `clickedAt`, `reviewedAt`
  - Updates persist to database automatically

- **Error Handling**: Robust error handling with partial success support
  - Detailed error reporting per queue item
  - Success/failure summary banner in UI
  - Failed items remain PENDING status for retry

- **Reputation Dashboard Integration**: Email sending metrics automatically update Reputation Dashboard
  - `sentCount`, `clickedCount`, `reviewedCount` computed dynamically from queue items
  - `totalsJson` aggregation updated in real-time
  - Funnel metrics (sent → clicked → reviewed) reflect live queue status

#### Technical Implementation

- **Resend Helper**: `src/lib/email/resend.ts` - Safe wrapper around Resend API with validation
- **Token Signing**: `src/lib/apps/review-request-automation/token.ts` - HMAC-SHA256 signed tokens for secure tracking
- **API Routes**:
  - `POST /api/review-request-automation/send-email` - Send emails for queue items (requires auth)
  - `GET /api/review-request-automation/click` - Click tracking redirect (token-based, no auth)
  - `GET /api/review-request-automation/reviewed` - Reviewed confirmation redirect (token-based, no auth)

#### Environment Variables

- `RESEND_API_KEY` - Resend API key (required)
- `EMAIL_FROM` - Verified sender email address (required)
- `AUTH_SECRET` or `NEXTAUTH_SECRET` - For token signing (required, 32+ characters)

#### Limitations

- **Manual Sending Only**: No automatic scheduled sending yet (manual "Send Now" only)
- **Email Only**: SMS templates are generated but SMS sending is not implemented (manual copy/paste workflow)
- **Self-Confirmed Reviews**: Review confirmations are self-reported by customers clicking "I left a review" link. We cannot verify actual Google/Facebook review submission.

### Changed

- Updated Reputation Dashboard "Review Requests Performance" panel to reflect live queue status from email sending
- Enhanced `getLatestDatasetForUser()` to compute funnel metrics dynamically from queue items

### Technical Notes

- All changes are additive; no breaking changes
- No database schema changes required
- Uses existing Prisma models and enums
- Token-based tracking allows click/review tracking without requiring customer login

### BREAKING CHANGES

**None** - This is an additive feature only. Existing functionality remains unchanged.

## [3.5.0] - 2025-12-24

### Added - Reputation Intelligence & Cross-App Integration (V3.5)

#### Reputation Dashboard Enhancements

- **Insights & Recommendations Panel**
  - New panel displaying actionable insights based on Review Request Automation dataset analysis
  - Severity-based display (Critical, Warning, Info) with color-coded indicators
  - Insight types include:
    - Missing review link detection
    - Customer contact information validation
    - Follow-up timing recommendations
    - SMS message length warnings
    - Queue skip rate analysis
    - Click-through rate optimization suggestions
    - Review conversion rate improvements
    - Opt-out rate monitoring
    - Performance health indicators
  - Each insight includes actionable buttons with deep links to Review Request Automation
  - Empty state shows "No issues detected. Your review request strategy looks healthy."

- **Two-Way Awareness Features**
  - "Current" badge indicator showing latest campaign dataset
  - "Newer campaign exists" callout for superseded datasets (future-proofed for dataset browsing)
  - Improved dataset freshness detection using `computedAt` timestamp
  - Visual indicators for dataset status and recency

#### Review Request Automation Enhancements

- **Cross-App State Memory**
  - Deep linking support via query parameters (`tab`, `focus`, `from=rd`)
  - Automatic tab switching when navigating from Reputation Dashboard
  - Field highlighting with smooth scroll-to behavior and 2-second highlight animation
  - Context banner: "Tip: Fixing this will improve your review request conversion" when arriving from RD
  - Session-based banner dismissal (persists across page reloads in same session)

- **Query Parameter Support**
  - `tab`: Automatically switches to specified tab (campaign, customers, templates, queue, results)
  - `focus`: Highlights specific field/section (reviewLinkUrl, followUpDelayDays, frequencyCapDays, timing, contacts, sms, cta, skips)
  - `from=rd`: Triggers context banner indicating navigation from Reputation Dashboard

#### Database Layer Enhancements

- **New Helper Functions**
  - `getLatestDatasetForCampaign()`: Retrieves latest dataset for a specific campaign
  - `getDatasetById()`: Retrieves a specific dataset by ID with full metrics
  - Both functions include strict `userId` scoping for security

- **API Improvements**
  - Enhanced `/api/review-request-automation/latest` endpoint
  - Returns `isCurrent` and `isCurrentForCampaign` flags
  - Improved dataset ordering using `computedAt` with `createdAt` tie-breaker

#### Technical Improvements

- **Insight Engine**
  - New `src/lib/reputation/insights.ts` module for generating insights from dataset data
  - Type-safe insight generation with severity classification
  - Configurable deep links with query parameter support
  - Handles edge cases gracefully (no data, healthy states, etc.)

### Changed

- Updated Reputation Dashboard "Review Requests Performance" panel to include "Current" badge
- Enhanced deep links in insights to include `tab`, `focus`, and `from=rd` parameters
- Improved user flow from insights to actionable fixes in Review Request Automation

### Technical Notes

- All changes maintain backward compatibility
- No database schema changes required for V3.5 features
- Uses existing `totalsJson` and `warningsJson` from ReviewRequestDataset
- Session storage used for banner dismissal (no localStorage dependency)
- Type-safe implementation throughout (no `any` types)

## [3.4.0] - 2024-12-XX

### Added - Database Integration & Shared Datasets

- Initial integration between Review Request Automation and Reputation Dashboard
- Prisma schema with Review Request Automation models
- Database persistence for campaigns, customers, queue items, and datasets
- DB status pills in both applications
- Enum types for type safety (ReviewRequestChannel, ReviewRequestVariant, ReviewRequestStatus)

---

## Version History

- **3.5.0** (2025-12-24): Reputation Intelligence & Cross-App Integration
- **3.4.0** (2024-12-XX): Database Integration & Shared Datasets

---

For detailed feature documentation, see:
- [Reputation Dashboard V3 Documentation](docs/apps/reputation-dashboard-v3.md)
- [Review Request Automation V3 Documentation](docs/apps/review-request-automation-v3.md)

