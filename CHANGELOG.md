# Changelog

All notable changes to the OBD Premium Apps project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## AI Business Description Writer — V5.0.0 (2025-01-XX)

**Status:** ✅ Production Ready (STABLE / LIVE)

### Added - V4 Features

- **Use Case Tabs**: Tabbed interface for viewing descriptions by use case
  - Directory Listing, Google Business Profile, Website/About Page, Citations/Short Bio
  - Character count display per tab
  - Copy-to-clipboard functionality for each tab
- **SERP Preview**: Visual preview of meta description in search results format
  - Shows how description appears in Google search results
  - Real-time character count feedback
- **Saved Versions Panel**: Save and manage description versions
  - localStorage-based version storage (V4)
  - Export/import JSON functionality
  - Load saved inputs to regenerate descriptions
- **Content Reuse Suggestions**: Panel with actionable reuse options
  - Push to AI Help Desk Knowledge (one-click upsert)
  - Copy CRM Note Pack (formatted for CRM systems)
  - BusinessId resolver utility for dashboard integration
- **Help Desk Integration**: Direct push to AI Help Desk Knowledge base
  - Upsert endpoint integration (`/api/ai-help-desk/knowledge/upsert`)
  - Tenant-safe with businessId validation
  - Tip messaging when businessId unavailable

### Added - V4.5 Features

- **Database-Backed Saved Versions**: Cloud storage with local fallback
  - DB-first approach with automatic localStorage fallback
  - Seamless migration from localStorage to database
  - Graceful degradation when database unavailable
- **CRM Note Pack**: Copy-formatted content for CRM systems
  - Deep link support (no writes, copy-only)
  - Structured format for easy pasting into CRM notes

### Added - V5 Features

- **Description Health Check**: Analysis-only quality assessment
  - Checks for location mentions, service keywords, length optimization
  - Identifies risky claims and SEO opportunities
  - No automatic changes — analysis only
- **Premium Fix Packs**: Deterministic improvement suggestions
  - Diff preview showing before/after changes
  - Apply/Reset functionality (no auto-edits)
  - Save improved version after fixes
  - Push improved content to Help Desk
  - Fix types: Add Location, Trim Length, Service Mentions, Safer Claims, Meta Optimization
- **V5-4 Polish Features**:
  - Apply All Recommended: Batch apply all fix packs with confirmation
  - Undo Stack: History-based undo for fix pack applications
  - Edited Badges: Visual indicators on tabs when content is edited
  - Smooth Scroll: Auto-scroll to preview when expanding fix pack details

### Technical Notes

- **No breaking changes**: All features are additive and backward compatible
- **Feature-flagged**: V4/V4.5/V5 features gated behind `flags.bdwV4`
- **Deterministic fixes**: Fix packs use rule-based transformations (no AI calls)
- **Null-safe**: All operations handle missing data gracefully
- **No API changes**: Existing API endpoints unchanged
- **No DB changes**: Uses existing database schema (no new migrations)

### Documentation

- See [Business Description Writer V5 Release Notes](docs/releases/business-description-writer-v5.md) for detailed release information
- See [Business Description Writer Changelog](docs/changelogs/business-description-writer.md) for version history

## UI Standardization — Shared Components (2025-01-XX)

**Status:** ✅ Production Ready (STABLE / LIVE)

### Added - Shared UI Components

- **Standardized Toolbars**
  - `OBDStickyToolbar`: Sticky toolbar wrapper with backdrop blur for toolbar/controls sections
  - `OBDToolbarRow`: Flex layout helper for left/right toolbar content slots (filters/actions)
  - `OBDFilterBar`: Wrap-friendly filter/control row component for inline filter patterns
  - Supports theme-aware styling (light/dark mode) and responsive layouts

- **Sticky Action Bar for Form Apps**
  - `OBDStickyActionBar`: Sticky bottom action bar for form-based applications
  - Mobile-friendly with safe area support (`pb-[env(safe-area-inset-bottom)]`)
  - Standardized bottom padding offset class (`OBD_STICKY_ACTION_BAR_OFFSET_CLASS = "pb-24"`)
  - Optional `left` prop for left-aligned content

- **Results Panel System**
  - `OBDResultsPanel`: Shared results panel component for generated output
    - Consistent header with title/subtitle and action buttons
    - Integrated loading and empty state support
    - Theme-aware styling
  - `OBDResultsActions`: Helper component for common results actions (Copy, Download .txt, Clear)
    - Standardized button styling and layout
    - Optional `extra` prop for app-specific actions
    - Copy button with visual feedback state

- **Status Blocks**
  - `OBDStatusBlock`: Shared component for empty/loading/error/success states
    - Consistent styling and layout across apps
    - Variants: `empty`, `loading`, `error`, `success`
    - Optional icons, descriptions, and action buttons
    - Integrated into `OBDResultsPanel` for seamless UX

### Changed - Component Enhancements

- **OBDPanel**: Added `variant="toolbar"` prop for tighter padding in toolbar contexts

### Migration Status

**Migrated Apps (Batch 1 & 2):**
- OBD CRM: Standardized toolbar with two-row layout (filters + actions)
- Local Keyword Research: Migrated to `OBDFilterBar` for filter controls
- Content Writer: Migrated to `OBDStickyActionBar` + `OBDResultsPanel` + `OBDStatusBlock`
- FAQ Generator: Migrated to `OBDStickyActionBar` + `OBDResultsPanel` + `OBDResultsActions` + `OBDStatusBlock`
- Offers Builder: Migrated to `OBDStickyActionBar` + `OBDResultsPanel` + `OBDResultsActions`
- Business Description Writer: Migrated to `OBDStickyActionBar` + `OBDResultsPanel` + `OBDStatusBlock`
- Social Media Post Creator: Migrated to `OBDStickyActionBar` + `OBDResultsPanel` + `OBDResultsActions` + `OBDStatusBlock`
- Review Responder: Migrated to `OBDStickyActionBar` + `OBDResultsPanel` + `OBDStatusBlock`
- Image Caption Generator: Migrated to `OBDResultsPanel` + `OBDStatusBlock`

### Technical Notes

- **UI-only changes**: No business logic, API calls, handlers, validation, or state management modified
- **Backward compatible**: All new components are additive and optional
- **Theme-aware**: All components support light/dark mode via `isDark` prop
- **Responsive**: All components use mobile-first responsive design patterns
- **Component location**: `src/components/obd/`

### Documentation

- See [OBD UI System — Shared Components](docs/obd-ui-system-shared-components.md) for detailed component documentation

## OBD Scheduler & Booking — P1/P2 Audit Completion (2026-01-02)

**Status:** ✅ Production Ready (STABLE / LIVE)

### 1) Security & Validation

- **Rate Limiting Hardening**: Enhanced rate limiting with per-endpoint configuration and improved protection against abuse
- **Idempotency**: Request deduplication to prevent duplicate bookings
- **Shared Validators**: Centralized validation logic with reusable validator modules
- **Friendly Validation Errors**: User-friendly error messages with clear guidance for invalid inputs
- **Public Context Protection**: Secure public booking context endpoint with proper access controls

### 2) Workflow Reliability

- **Reactivate Action**: Ability to reactivate declined or completed booking requests
- **BookingRequestAuditLog**: Comprehensive audit logging for all booking request actions with history UI in dashboard
- **Non-Blocking Audit Logging**: Audit log warnings are non-blocking, ensuring system reliability even if logging fails

### 3) Metrics & Monitoring

- **Metrics Endpoint**: New `/metrics` endpoint for system health monitoring
- **Dashboard Metrics Tab**: Metrics visualization in scheduler dashboard for operational insights
- **RateLimitEvent Tracking**: Rate limit events tracked with hashed keys for security and analytics

### 4) Performance & UX

- **Non-Blocking CSV Export**: CSV export operations run asynchronously without blocking the UI
- **Optimistic UI**: Immediate UI feedback for user actions with background sync
- **Cross-Tab Sync**: Real-time synchronization of booking state across browser tabs
- **Namespaced localStorage**: Proper localStorage key namespacing to prevent conflicts

### 5) Accessibility & Quality

- **Skip Links**: Keyboard navigation skip links for improved accessibility
- **ARIA Labels**: Comprehensive ARIA labels for screen reader support
- **Focus-Visible**: Enhanced focus indicators for keyboard navigation
- **Accessibility Tests**: Automated a11y testing integrated into test suite
- **Contrast Notes**: Documentation of color contrast compliance

### 6) Testing & Tooling

- **Vitest Unit Tests**: Comprehensive unit test coverage with Vitest framework
- **Playwright Smoke Tests**: End-to-end smoke tests for critical user flows
- **Visual Regression Snapshots**: Visual regression testing for UI consistency
- **k6 Load Testing**: Performance load testing with k6, including documentation

### Database Migrations

- **BookingRequestAuditLog Migration**: New table for audit log tracking
- **RateLimitEvent Migration**: New table for rate limit event tracking

## OBD Scheduler & Booking — Short Booking Links & UI Polish (2026-01-XX)

**Status:** ✅ Production Ready (STABLE / LIVE)

### Added

- **Short Public Booking Links**: Base62 short codes (8-10 characters) for shareable booking URLs
  - New `BookingPublicLink` model with unique code and optional slug
  - Short URL format: `/book/{code}`
  - Pretty URL format: `/book/{slug}-{code}` (when slug is set)
  - Automatic code generation with collision handling
- **Public Link API Endpoint**: `/api/obd-scheduler/public-link` (GET/PUT) for managing booking links
  - Auto-creates links when first accessed
  - Slug validation and management
- **Settings UI for Booking Links**: Public booking link section restored in Settings tab
  - Displays short URL and optional pretty URL
  - Copy and test link buttons
  - Custom slug input with validation
  - Loading and error states with fallback to legacy bookingKey

### Changed

- **Public Booking Route Resolution**: Enhanced `/book/{param}` route to support multiple formats
  - Short code: `/book/{code}`
  - Pretty URL: `/book/{slug}-{code}`
  - Legacy bookingKey: `/book/{bookingKey}` (backward compatible)
- **Public Context Endpoint**: Updated to resolve short codes, slug-codes, and legacy bookingKeys
- **Services Tab CTA Button**: Improved layout and styling
  - Reduced button height (~25%) with medium border radius
  - Responsive layout (stacks on mobile, aligned right on desktop)
  - Updated CTA text to "Add a Service"
  - Better spacing between heading and action button

### Fixed

- **Settings Tab Booking Link Section**: Restored visibility after BookingPublicLink implementation
  - Section now always visible when settings exist
  - Graceful handling of loading and error states
  - Fallback to legacy bookingKey when publicLink unavailable

### Database Migrations

- **BookingPublicLink Migration**: New table for short booking link codes and slugs

## OBD CRM — V3.1 (Hub + Premium UX + Notes/Activities + Follow-Ups + Queue View)

**Status:** ✅ Production Ready (STABLE / LIVE)

### 1) Reliability / Build Health

- lint PASS, build PASS
- Fixed null handling TypeScript error in `src/lib/apps/obd-crm/crmService.ts`
- Added Suspense boundaries for `useSearchParams` in:
  - `src/app/apps/obd-crm/page.tsx`
  - `src/app/apps/ai-help-desk/page.tsx`
  - `src/app/apps/offers-builder/page.tsx`
  - `src/app/apps/social-auto-poster/composer/page.tsx`
- Fixed ESLint config issue by adding `typescript-eslint` as dev dependency
- Fixed ESLint errors (any types, unescaped entities) in social auto-poster setup/publishers and auth

### 2) CRM Core

- Contacts list + detail drawer UX improvements (sticky header, density toggle, quick actions)
- Notes implemented as activity type "note" (newest-first, skeleton/empty states, inline errors)
- Activities timeline (typed, datetime support, newest-first, skeleton/empty states, inline errors)
- "Last Touch" column and live updates after adding note/activity

### 3) Follow-Ups

- Next Follow-Up field + optional note
- Filters: All / Overdue / Due Today / Upcoming (7 days)
- Badges: Today / Overdue
- Snooze: +1 day / +1 week
- Quick set: Tomorrow / Next week / Next month (client-side)
- Follow-up counters strip (clickable)
- Queue View toggle (Table ↔ Queue), grouped sections and sorting, queue snooze support

### 4) UX / Polish

- Empty + no-results states and microcopy improvements
- Drawer animations, ESC close, click-outside close, scroll restore
- Skeleton loaders (table + drawer + sections)
- Status pills + tag chips with overflow tooltip
- Mobile Quick Add FAB
- Icon consistency + tooltips, subtle drawer gradient accent

### 5) Integrations

- CRM → Review Request Automation (prefill)
- CRM → AI Help Desk (prefill + context indicator)
- CRM → Social Auto-Poster (prefill)
- CRM → Offers Builder (prefill)

## OBD CRM — V3 — 2025-12-30

**Status:** ✅ Production Ready (STABLE / LIVE)

### Core Features

- **Contacts Management:** Create, read, update, and delete contacts with name, email, phone, company, address
- **Status Tracking:** Lead, Active, Past, DoNotContact status management
- **Tagging System:** Many-to-many tags for flexible contact organization
- **Notes & Activity Timeline:** Add timestamped notes to track customer relationships
- **Search & Filtering:** Search by name/email/phone, filter by status or tags with debounced search
- **CSV Export:** Export filtered contacts with all fields (name, email, phone, status, tags, source, company, address, dates)
- **Last Note Preview:** Quick view of most recent note in contacts list table
- **Contact Detail View:** Full contact information with edit mode, copy phone/email actions, and activity timeline

### UX Enhancements

- **Loading States:** Skeleton rows during data loading to prevent layout shift
- **Empty States:** Context-aware empty state messages ("No contacts yet" vs "No results — try clearing filters")
- **Tags Display:** Shows up to 2 tags inline with "+N" indicator for additional tags
- **Status Badges:** Consistent OBD V3 styling for contact status indicators
- **Keyboard Shortcuts:** Cmd/Ctrl+Enter to submit notes in contact detail view
- **Copy Actions:** One-click copy for phone and email with visual feedback

### Integration Hooks

- **Service Module:** `src/lib/apps/obd-crm/crmService.ts` with reusable functions for cross-app integration
- **Upsert Endpoint:** `POST /api/obd-crm/contacts/upsert` for external app integration (Scheduler, Help Desk, Review Automation)
- **Source Tracking:** Supports manual, scheduler, reviews, helpdesk, import sources
- **Automatic Tag Creation:** Tags can be created by name during upsert operations

### Security & Data Integrity

- **Premium Gating:** All API routes require premium access
- **Business Scoping:** All operations scoped to authenticated user's business (businessId = userId in V3)
- **Rate Limiting:** Rate limits applied to create/update/delete operations
- **Validation:** Input validation with Zod schemas, email format validation, required field checks
- **Cascade Rules:** Proper referential integrity with cascade deletes (contacts → activities/tags)

### Technical

- **Database Schema:** New models (CrmContact, CrmTag, CrmContactTag, CrmContactActivity) with proper indexes
- **API Standards:** Consistent error handling and response formats across all routes
- **TypeScript:** Full type safety with shared types in `src/lib/apps/obd-crm/types.ts`
- **Performance:** Debounced search (250ms), efficient queries with proper indexes, last note preview included in list queries

### Dev Tools

- **Seed Demo Data:** Dev-only route `/api/obd-crm/dev/seed-demo-data` for quick test data generation (disabled in production)

### Notes

- All operations are business-scoped (no cross-business access possible)
- Source tracking enables future integrations with Scheduler, Review Automation, and Help Desk
- V3 structure supports future enhancements (pipelines, automations, email sync) while maintaining clear guardrails
- Production-ready with comprehensive testing checklist

## AI Help Desk — V3 — 2025-01-XX

**Status:** ✅ Production Ready (STABLE / LIVE)

### Core Features

- **Knowledge Manager:** Complete CRUD for FAQs, Services, Policies, and Notes with tags, filtering, and search
- **Insights Dashboard:** Question analytics, knowledge gap identification, and "Turn into FAQ" functionality
- **Website Import:** Automated content extraction from websites (max 10 pages, same-domain) with preview and selection
- **Website Chat Widget:** Fully embeddable AI chat widget with iframe and script embed options

### Widget Enhancements

- **Embed Code:** Both iframe (recommended) and script embed options with one-click copy
- **Domain Allowlist:** Warn-only domain management (never blocks widget functionality)
- **Analytics Tracking:** Non-blocking event tracking (`widget_open`, `message_sent`)
- **Live Preview:** Real-time preview of widget appearance with interactive bubble and mini widget window
- **Theme Presets:** Three styling options (Minimal, Bold, Clean) for widget customization
- **Brand Color Auto-Sync:** Toggle to automatically sync widget color with OBD brand color (localStorage-based)
- **Assistant Avatar:** Complete avatar management with tooltip, quick-fill, and initials fallback

### Website Import Polish

- **Drag-and-Drop URLs:** Drop URLs directly into input field
- **Recent URLs:** Last 5 successfully used URLs stored and displayed as chips
- **Autofill:** Automatically fills from business profile website URL (when available)
- **Visual Feedback:** Drag-over highlight, error messages, helper text

### Security & Stability

- **SSRF Protection:** DNS rebinding protection, IP range blocking (IPv4/IPv6), metadata endpoint blocking
- **Non-Blocking Design:** Widget loads and functions even if database/API unavailable
- **Tenant Safety:** Strict business isolation, workspace mapping validation
- **Rate Limiting:** In-memory rate limiting for widget endpoints

### Technical

- **Standardized API Responses:** All routes return consistent `ApiSuccessResponse` or `ApiErrorResponse`
- **Error Handling:** Graceful degradation throughout, errors never block core functionality
- **Accessibility:** Proper ARIA labels, keyboard navigation, screen reader support
- **Database Schema:** Added `AiHelpDeskWidgetEvent` table and `allowedDomains` field (backwards compatible)
- **Dynamic Routes:** Proper use of `force-dynamic` where prerender would be unsafe

### Notes

- All changes are backwards compatible (no breaking changes)
- Empty domain allowlist means widget works everywhere (with optional warning)
- Analytics failures never affect widget functionality
- Production-ready with comprehensive audit completed

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

