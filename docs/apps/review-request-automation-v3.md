# Review Request Automation V3 - Documentation

## Overview

Review Request Automation is a V3 OBD Premium App for planning, queuing, and managing review request messages. It follows a **snapshot-first** workflow: templates, queue items, and results are computed **once** when the user explicitly creates a snapshot. There is no live recomputation, no background scheduling, and no implied “set-and-forget” behavior.

**Status:** Live (V3.6)  
**Route:** `/apps/review-request-automation`  
**Category:** Reputation

## What this app IS

- A **draft → snapshot** workflow for review request messaging.
- A place to configure:
  - business info
  - review platform + review link
  - delivery rules (quiet hours, frequency caps, delays, follow-ups)
  - customer list (manual entry or CSV import)
- A **snapshot-backed** Templates / Queue / Results experience:
  - deterministic outputs
  - stable exports
  - no silent recalculation

## What this app is NOT

- Not an autonomous “automation engine”.
- Not background scheduling or unattended sending.
- Not a CRM sync tool:
  - customers remain independent of CRM unless manually imported
  - no background syncing / no auto-creation
- Not a delivery guarantee (deliverability depends on channel availability and recipient eligibility).

## Snapshot-based behavior (canonical)

- **Create New Snapshot** is the only action that computes templates, queue state, and results.
- Viewing Templates / Queue / Results **never recomputes** anything.
- Status changes (Sent / Clicked / Reviewed / Opted Out) update the snapshot state directly (no hidden recalculation).
- Storage:
  - **Draft edits** are saved locally (draft-only).
  - **Active snapshot** is stored locally (local-first acceptable).
  - Optional database persistence is explicit and user-initiated (Save to database toggle + Create New Snapshot).

## V3 Scope (Production Polish)

### What's Included

- **Quick Start Banner**: Interactive guide on first load with clickable steps
- **Campaign Builder**: Configure business info, review platform, message settings, and delivery rules
- **Customer Management**: 
  - Manual customer entry via modal
  - CSV import with tolerant parsing and row-level validation
  - CSV template download button
  - Customer table with status tracking (queued/sent/clicked/reviewed/optedOut)
  - Export customers to CSV
- **Message Template Generator**: 
  - Generates 3 templates + 1 follow-up (SMS Short, SMS Standard, Email, Follow-Up SMS)
  - Includes business name and review link
  - Includes STOP opt-out line for SMS templates
  - Includes personalization tokens like {firstName}
  - Shows character count + segment warning for SMS (160/320/480…)
  - "Create New Snapshot" computes templates and queue once
- **Queue (Snapshot-derived)**: 
  - Queue is computed deterministically at snapshot creation time
  - Respects quiet hours, frequency caps, and follow-up rules
  - **Bulk Actions**: Select multiple items and mark as sent/clicked/reviewed
  - Copy button per row (fills tokens)
  - Manual status tracking: "Mark Sent", "Mark Clicked", "Mark Reviewed", "Mark Opted Out"
  - **Email Sending (V3.6)**: manual, user-triggered sending for EMAIL queue items via Resend (no background sending)
  - Status changes update snapshot state (no hidden recomputation)
  - Export queue to CSV
- **Results + Insights (Snapshot)**: 
  - Funnel counters: loaded, ready, queued, sent, clicked, reviewed, optedOut
  - Quality checks insights (invalid review link, SMS too long, follow-up too aggressive, etc.)
  - Next actions checklist with copy buttons
- **Export Functionality**:
  - Export customers to CSV
  - Export send queue to CSV
  - Export snapshot JSON (includes the active snapshot + exportedAt)
- **Data Persistence**: 
  - Draft edits saved locally (localStorage)
  - Active snapshot saved locally (localStorage)
  - Optional database persistence is explicit (Save to database + Create New Snapshot)
  - Reputation Dashboard awareness is link-only (no silent integration)
- **Accessibility**:
  - All buttons have tooltips and aria-labels
  - Keyboard support (Enter/Space for button activation)
  - Focus management in modals
- **Pure Engine Module**: All computations refactored into testable `engine.ts` module
- **Unit Tests**: Comprehensive test coverage for engine functions
- **CSV Utilities**: Tolerant parsing with column mapping and error reporting

### Email Sending (V3.6)

**Status:** ✅ **NEW** - Email sending via Resend is now available

Review Request Automation V3.6 includes optional, manual email sending functionality using Resend, with click tracking and self-confirmed review tracking. Sending is always user-triggered (no background sending).

**Features:**
- **Manual Email Sending**: "Send Pending Emails" button in Queue tab sends pending EMAIL queue items (max 25 per batch)
- **Per-Item Send**: Optional "Send" button for individual EMAIL queue items
- **Click Tracking**: Review links in emails are replaced with secure tracking URLs that update queue item status to CLICKED
- **Self-Confirmed Review Tracking**: "I left a review" confirmation link allows customers to confirm they left a review
- **Status Updates**: Queue items automatically update to SENT, CLICKED, and REVIEWED statuses with timestamps
- **Rate Limiting**: Maximum 25 emails per batch to prevent abuse
- **Error Handling**: Partial success handling with detailed error reporting per item

**Requirements:**
- Campaign must be saved to database (enable "Save to Database" toggle)
- `RESEND_API_KEY` and `EMAIL_FROM` environment variables must be configured in Vercel
- Queue items must have `channel=EMAIL` and `status=PENDING`

**How Tracking Works:**
- **Clicked**: When a customer clicks the review link in the email, the tracking URL updates the queue item status to CLICKED and redirects them to the actual review page (Google, Facebook, etc.)
- **Confirmed Reviewed**: When a customer clicks "I left a review" confirmation link, the queue item status updates to REVIEWED and redirects to Reputation Dashboard
- **Important**: Review confirmations are self-reported by customers. We cannot verify actual Google/Facebook review submission.

**Limitations:**
- **Manual Sending Only**: Emails are sent manually via "Send Pending Emails" button. No automatic scheduled sending.
- **Self-Confirmed Reviews**: Review tracking relies on customer clicking "I left a review" confirmation link. We cannot detect actual Google/Facebook review submission.
- **SMS Not Supported**: Email sending only. SMS templates are generated but SMS sending is not implemented (manual copy/paste workflow remains)

### What's NOT Included (V4 Roadmap)

**V3 Limitations:**
- **External SMS Sending**: SMS templates are generated but not sent automatically (manual copy/paste workflow)
- **Automatic Scheduling**: No cron jobs or scheduled sending yet (manual "Send Now" only)
- **Advanced Personalization**: Basic {firstName} token replacement only (no AI-generated custom messages)
- **Multi-user Support**: Single-session campaigns (no saved campaigns per user, no user accounts)
- **Integration APIs**: No connections to SMS providers, POS systems, or booking platforms

**V4 Planned Enhancements:**
- External SMS sending (Twilio, etc.)
- Automatic scheduled sending (cron jobs)
- Advanced personalization (AI-generated custom messages)
- Real-time automation (webhooks)
- Multi-user support (saved campaigns per user)
- Integration APIs (connect to POS systems, booking platforms)

## Campaign Configuration

### Business Information

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `businessName` | Yes | `string` | Business name |
| `businessType` | No | `string` | Business type (e.g., Restaurant, Retail, Service) |
| `platform` | Yes | `"Google" \| "Facebook" \| "Yelp" \| "Other"` | Review platform |
| `reviewLink` | Yes | `string` | Valid URL to review page |

### Message Settings

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `language` | Yes | `"English" \| "Spanish" \| "Bilingual"` | Message language |
| `toneStyle` | Yes | `"Friendly" \| "Professional" \| "Bold" \| "Luxury"` | Message tone |
| `brandVoice` | No | `string` | Optional brand voice description |

### Delivery Rules

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `triggerType` | Yes | `"manual" \| "after_service" \| "after_payment"` | When queue timing is computed (at snapshot creation) |
| `sendDelayHours` | Yes | `0-168` | Hours to wait before sending |
| `followUpEnabled` | Yes | `boolean` | Enable follow-up messages |
| `followUpDelayDays` | Yes (if enabled) | `1-30` | Days to wait before follow-up |
| `frequencyCapDays` | Yes | `30 \| 60 \| 90` | Days between sends to same customer |
| `quietHours` | Yes | `{ start: "HH:mm", end: "HH:mm" }` | Hours when queue items should not be scheduled (default: 09:00-19:00) |

### Inline "Why this matters" Micro-Education

Small info icons (ℹ️) appear next to key settings in the Campaign tab with expandable panels:

**Fields with Micro-Education:**
- **Follow-Up Delay**: Explains why 2-7 day delay is optimal (gives customers time to review naturally while staying top of mind)
- **Quiet Hours**: Explains that 9am-7pm prevents scheduling during sleep/busy times; queue items are planned for the next allowed window
- **Frequency Cap**: Explains how 30-90 days prevents over-messaging and protects reputation

**Behavior:**
- Panels are collapsed by default
- Click info icon to expand/collapse
- Content is short, practical, and non-technical
- Fully accessible: keyboard operable (Enter/Space), `aria-expanded` attribute, focus management

### Smart Defaults (Business Type Recommendations)

If a business type is provided, the app suggests recommended settings based on industry best practices. **All recommendations are opt-in only** - they never auto-override user settings.

**Supported Business Types & Recommendations:**
- **Restaurant/Food**: Send delay 2-4 hours (recommended: 4), follow-up 2-4 days (recommended: 2), tone: Friendly
- **Home Services**: Send delay 12-24 hours (recommended: 18), follow-up 3-5 days (recommended: 3), tone: Professional
- **Beauty/Wellness**: Send delay 6-12 hours (recommended: 8), follow-up 3-5 days (recommended: 3), tone: Friendly or Luxury
- **Auto/Trades**: Send delay 12-24 hours (recommended: 18), follow-up 4-7 days (recommended: 4), tone: Professional or Bold
- **Medical/Healthcare**: Send delay 24-48 hours (recommended: 36), follow-up 5-7 days (recommended: 5), tone: Professional
- **Retail**: Send delay 4-12 hours (recommended: 6), follow-up 2-4 days (recommended: 3), tone: Friendly or Professional

**Recommendation Display:**
- Appears below business type input when a recognized type is entered and templates are generated
- Shows explanation of why these settings are recommended for the industry
- Displays recommended values and acceptable ranges
- "Apply" button to accept recommendations (does not auto-apply)
- Only suggests tone style; does not override if user has already set it
- Uses deterministic mapping table in `engine.ts` (no external data)

## Customer Management

### Manual Customer Entry

When adding a customer manually, the following fields are available:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `customerName` | Yes | `string` | Customer name |
| `phone` | No* | `string` | Phone number (at least phone or email required) |
| `email` | No* | `string` | Email address (at least phone or email required) |
| `tags` | No | `string[]` | Optional tags for filtering |
| `lastVisitDate` | No | `YYYY-MM-DD` | Last visit date (used for after_service/after_payment triggers) |
| `serviceType` | No | `string` | Service type |
| `jobId` | No | `string` | Job ID |

### CSV Import Format

The CSV import features **tolerant parsing** and **automatic column mapping**:

**Required Columns** (auto-detected):
- `customerName` (or `Customer Name`, `Name`, `Customer`) - Customer name
- At least one of: `phone` (or `Phone`, `Mobile`, `Cell`) OR `email` (or `Email`, `E-mail`)

**Optional Columns** (auto-detected):
- `tags` (or `Tags`, `Label`, `Category`) - Comma or semicolon separated
- `lastVisitDate` (or `Last Visit Date`, `Last Visit`, `Visit Date`, `Last Service Date`) - Accepts ISO format or common date formats
- `serviceType` (or `Service Type`, `Service`, `Job Type`)
- `jobId` (or `Job ID`, `Job`, `Work Order`, `Invoice`)

**Features:**
- **Column Mapping**: Automatically detects columns even with different header names (e.g., "Customer Name" → `customerName`, "Phone" → `phone`)
- **Tolerant Parsing**: Handles various formats for dates (ISO, MM/DD/YYYY, etc.) and phone numbers (with/without dashes, parentheses, etc.)
- **Row Validation**: Shows per-row errors in preview modal with specific error messages (missing required field, invalid date format, etc.)
- **Template Download**: "Download CSV Template" button provides sample CSV with example data and correct column headers
- **Error Handling**: Invalid rows are shown in preview but do not block import of valid rows
- **Formula Safety**: CSV parser treats all values as plain text (no formula execution)

**Example CSV:**
```csv
customerName,phone,email,tags,lastVisitDate,serviceType,jobId
John Doe,5551234567,john@example.com,"VIP,Regular",2024-01-15,Plumbing,JO-12345
Jane Smith,5559876543,jane@example.com,Regular,2024-01-20,Electrical,JO-12346
Bob Johnson,,bob@example.com,"New Customer",2024-01-25,HVAC,JO-12347
```

## Message Templates

### Template Variants

1. **SMS Short** (≤240 chars target)
   - Concise message for quick review requests
   - Includes business name, review link, and STOP opt-out

2. **SMS Standard** (≤420 chars target)
   - More detailed message with context
   - Includes business name, review link, and STOP opt-out

3. **Email** (subject + body)
   - Professional email format
   - Includes business name and review link
   - Full body with context

4. **Follow-Up SMS** (soft nudge)
   - Gentle reminder for customers who haven't reviewed
   - Only sent if follow-up is enabled and customer hasn't reviewed

### Personalization Tokens

- `{firstName}` - Replaced with customer's first name (extracted from customerName)

### Character Count & Segments

SMS templates show:
- Character count
- Number of segments (160 chars per segment)
- Warning if template exceeds recommended length

### Template Quality Score

Each template (SMS Short, SMS Standard, Follow-Up SMS, Email) receives a quality assessment:

**Quality Labels:**
- **Good**: Template meets all quality criteria
- **Too Long**: Template exceeds target length thresholds (warning)
- **Missing Opt-out**: SMS template missing STOP opt-out line (critical)
- **Link Issue**: Review link missing from template (critical)
- **Needs Review**: Link placement or subject length could be improved (warning)

**Quality Rules:**
- **SMS Templates**: Must include STOP/opt-out line → Missing Opt-out (critical)
- **Length Thresholds**: 
  - SMS Short: ≤240 chars → Too Long (warning if exceeded)
  - SMS Standard: ≤420 chars → Too Long (warning if exceeded)
  - Follow-Up SMS: ≤320 chars → Too Long (warning if exceeded)
- **Link Placement**: Must include reviewLink → Link Issue (critical if missing)
- **Link Context**: If link appears only at end without CTA language → Needs Review (warning)
- **Email Subject**: >60 chars → Needs Review (warning)

**Quality Badges:**
- Small badge appears above each template card in Templates tab
- Color-coded by severity (green=info, yellow=warning, red=critical)
- Hover tooltip shows detailed quality analysis, specific issues, and actionable suggestions
- Segment counter guidance for SMS templates ties to quality details

## Campaign Health Score

The Campaign Health Score provides a quick, at-a-glance assessment of your campaign's readiness. It's calculated deterministically from your campaign configuration, customer data, and templates.

### Health Status Levels

- **Good** (80-100): Campaign is well-configured and ready to send
- **Needs Attention** (60-79): Some issues should be addressed before sending
- **At Risk** (0-59): Critical issues need immediate attention

### Health Signals

The score considers:
- **Review Link**: Missing or invalid review links reduce score significantly
- **Customer Contact Info**: Percentage of customers with phone or email
- **Follow-Up Delay**: Follow-ups scheduled too soon (< 2 days) reduce score
- **Quiet Hours**: Misconfigured quiet hours reduce score
- **SMS STOP Line**: Missing STOP opt-out line in SMS templates is critical
- **SMS Length**: Templates exceeding target lengths reduce score

### Display

The Campaign Health badge appears in the Results tab with:
- Status badge (Good/Needs Attention/At Risk) with score
- Hover tooltip showing "How it's calculated" with detailed reasons

## Send Timeline

The Send Timeline provides a visual, read-only representation of your campaign's send schedule. It appears above the Send Queue panel in the Queue tab.

**Timeline Events:**
- **Now**: Current time (always shown)
- **Initial Send**: Earliest scheduled initial send (based on sendDelayHours + quiet hours adjustment)
- **Follow-Up**: Earliest scheduled follow-up (if enabled, based on followUpDelayDays)

**Display Behavior:**
- Uses actual computed times from the send queue (not estimates)
- Shows date and time for each event
- Visual timeline with connecting lines between events
- If no customers are queued, shows empty state: "Timeline appears after customers are queued"
- If follow-up is disabled, shows only Now → Initial Send

## Send Queue

### Queue Computation

Queue items are computed deterministically based on:
- **Trigger Type**: 
  - `manual`: Queue immediately (respecting quiet hours)
  - `after_service` / `after_payment`: Use `lastVisitDate` + `sendDelayHours` (if available)
- **Quiet Hours**: Messages scheduled outside quiet hours (default: 09:00-19:00)
- **Frequency Cap**: Don't queue if last sent within `frequencyCapDays`
- **Follow-Up Rules**: Only queue follow-up if customer hasn't reviewed and follow-up is enabled

### Queue Item Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `customerId` | `string` | Customer ID |
| `scheduledAt` | `ISO date string` | Scheduled send time |
| `variant` | `"smsShort" \| "smsStandard" \| "email" \| "followUpSms"` | Message variant |
| `channel` | `"sms" \| "email"` | Send channel (based on customer contact info) |
| `status` | `"pending" \| "sent" \| "skipped"` | Queue status |
| `skippedReason` | `string?` | Reason if skipped (e.g., frequency cap) |

### Manual Status Tracking

For each queue item, operators can:
- **Copy**: Copy personalized message text to clipboard
- **Send** (EMAIL items only): Send email via Resend (V3.6) - updates status to SENT automatically
- **Mark Sent**: Mark as sent manually (creates "sent" event)
- **Mark Clicked**: Mark as clicked manually (creates "clicked" event)
- **Mark Reviewed**: Mark as reviewed manually (creates "reviewed" event, removes follow-ups)
- **Opt Out**: Mark customer as opted out (creates "optedOut" event)

**Email Sending (V3.6):**
- "Send Emails Now" button in Queue tab header sends all pending EMAIL items (max 25 per batch)
- Per-row "Send" button for individual EMAIL items
- **Manual Trigger Only**: Emails are sent manually via button click. No automatic scheduling.
- Emails include click tracking URLs that automatically update status to CLICKED when clicked
- Emails include "I left a review" confirmation link that updates status to REVIEWED (self-confirmed)
- Status updates are persisted to database automatically
- **Note**: Review confirmations are self-reported by customers clicking the confirmation link. We cannot verify actual Google/Facebook review submission.

### Bulk Actions

Operators can select multiple queue items and perform bulk actions:
- **Select All**: Checkbox to select/deselect all pending items at once
- **Individual Selection**: Checkbox per queue item to select individually
- **Mark Selected as Sent**: Bulk mark all selected items as sent (creates "sent" events for all)
- **Mark Selected as Clicked**: Bulk mark all selected items as clicked (creates "clicked" events for all)
- **Mark Selected as Reviewed**: Bulk mark all selected items as reviewed (creates "reviewed" events, removes follow-ups)
- Selected items are highlighted with a ring border
- Bulk actions update metrics and queue state immediately

## Results & Insights

### Funnel Metrics

- **Loaded**: Total customers loaded
- **Ready**: Customers ready to send (has phone or email, not opted out)
- **Queued**: Items in send queue
- **Sent**: Items marked as sent
- **Clicked**: Items marked as clicked
- **Reviewed**: Items marked as reviewed
- **Opted Out**: Customers who opted out

### Quality Checks

Deterministic insights with severity levels:

- **Invalid Review Link**: Review link is not a valid URL (error)
- **SMS Too Long**: SMS template exceeds recommended length (warning)
- **Follow-Up Too Aggressive**: Follow-up delay is less than 3 days (warning)
- **Quiet Hours Misconfigured**: Quiet hours may be incorrectly configured (warning)
- **Missing Contact Info**: Customers missing both phone and email (warning/error based on percentage)

### Next Actions

Actionable checklist with copy buttons:
- Fix quality issues
- Add more customers
- Review templates
- Test send queue

### Best-Practice Guidance

The Results tab includes a "Best-Practice Guidance" section that provides non-binding recommendations using careful wording like "recommended range" and "common best practice" (no claims of real market averages or "similar businesses").

**Guidance Categories:**
- **Follow-Up Timing**: "A soft follow-up 2–4 days later is a common best practice."
- **Quiet Hours**: "9am–7pm tends to reduce complaint risk."
- **Frequency Cap**: "30–90 days helps prevent over-messaging."

**Display:**
- Shows current value vs. recommended range
- Highlights items outside recommended range with yellow border
- Shows "Consider adjusting" note for out-of-range settings (non-blocking)
- Shows checkmark (✓) for settings within recommended range
- Non-blocking suggestions (does not prevent sending)

## Export Functionality

### Export Customers CSV
- Exports all customers to CSV format
- Includes all customer fields (name, phone, email, tags, lastVisitDate, serviceType, jobId)
- Available from Customers tab when customers exist

### Export Queue CSV
- Exports send queue to CSV format
- Includes: customerId, customerName, scheduledAt, variant, channel, status, skippedReason
- Available from Queue tab when queue exists
- Filename format: `send-queue-{businessName}-{date}.csv`

### Export Snapshot JSON
- Exports the active snapshot to JSON
- Includes: campaign configuration, customers, events, computed response, and `exportedAt` timestamp (ISO format)
- Available from Queue tab when an active snapshot exists
- Filename format: `campaign-snapshot-{businessName}-{date}.json`
- Useful for backup, migration, or analysis

## Database Persistence

The Review Request Automation app now supports database persistence via Prisma and PostgreSQL with strict type safety using Prisma enums.

### Storage Options

- **Active snapshot (local-first)**: The canonical computed snapshot is stored in localStorage for deterministic viewing and exports.
- **Draft edits (local-first)**: Campaign/customers/events drafts are stored in localStorage for convenience.
- **Database (optional)**: Saving to Postgres is explicit and user-initiated (Save to database + Create New Snapshot).

### Save to Database Toggle

- Location: Campaign tab, "Storage Options" section
- Default: **ON** (enabled)
- When enabled: Snapshot data is saved to the database after "Create New Snapshot" completes
- When disabled: Data is only stored in localStorage (local-only mode), DB status pill shows "Local Only"

### Database Schema

**Enums (Type-Safe):**
- `ReviewRequestChannel`: `EMAIL`, `SMS`
- `ReviewRequestVariant`: `SMS_SHORT`, `SMS_STANDARD`, `EMAIL`, `FOLLOW_UP_SMS`, `FOLLOW_UP_EMAIL`
- `ReviewRequestStatus`: `PENDING`, `SENT`, `CLICKED`, `REVIEWED`, `OPTED_OUT`, `SKIPPED`

**Dataset Warnings (warningsJson):**
The system automatically computes lightweight warnings when saving campaigns:
- `missingReviewLink`: Review link URL is empty or missing
- `noCustomerContacts`: All customers are missing both email and phone
- `smsTooLong`: Any SMS template exceeds 300 characters
- `followUpTooSoon`: Follow-up delay is less than 2 days
- `highQueueSkipRate`: More than 25% of queue items are skipped

Warnings are informational only and do not block saving. They are stored in `ReviewRequestDataset.warningsJson` for reference.

### DB Status Pill

A small status indicator shows the current database connection state:
- **✓ Connected**: Save to DB toggle ON and save succeeded
- **⚠ Fallback (Local)**: Save failed but local results exist (localStorage fallback)
- **○ Local Only**: Save to DB toggle OFF (local storage only)
- **○ Checking...**: Initial connection check in progress

The pill appears in the top-right area of the app, providing clear visibility into data persistence status.

### Saved Data Structure

When saved to the database, the following data is stored:

- **Campaign**: Business info, platform, review link, message settings, automation rules
- **Customers**: Name, contact info (email/phone), tags, visit dates, service info
- **Queue Items**: Scheduled sends with status tracking (uses enum types: `PENDING`, `SENT`, `CLICKED`, `REVIEWED`, `OPTED_OUT`, `SKIPPED`)
- **Dataset**: Snapshot with computed metrics (`totalsJson`) and warnings (`warningsJson`)

### API Endpoints

#### POST `/api/review-request-automation/save`

Saves a complete campaign to the database.

**Request:**
```typescript
{
  campaign: Campaign;
  customers: Customer[];
  queue: SendQueueItem[];
  results: ReviewRequestAutomationResponse;
}
```

**Response:**
```typescript
{
  success: true;
  campaignId: string;
  datasetId: string;
  computedAt: string; // ISO date string
}
```

**Authentication:** Required (returns 401 if not logged in)

#### GET `/api/review-request-automation/latest`

Retrieves the latest dataset for the logged-in user, ordered by `computedAt` descending (tie-breaker: `createdAt` descending).

**Response (when dataset exists):**
```typescript
{
  ok: true;
  empty: false;
  dataset: {
    datasetId: string;
    campaignId: string;
    businessName: string;
    computedAt: string; // ISO date string
    metrics: {
      sent: number;
      clicked: number;
      reviewed: number;
      clickedRate: number; // percentage
      reviewedRate: number; // percentage
    };
    totalsJson: Record<string, unknown>; // Full metrics object
    warningsJson: Record<string, boolean> | null; // Warnings if any
  };
}
```

**Response (when no dataset exists):**
```typescript
{
  ok: true;
  empty: true;
  dataset: null;
}
```

**Authentication:** Required (returns 401 if not logged in)

**Latest Dataset Logic:**
- Orders by `computedAt DESC` (primary)
- Tie-breaker: `createdAt DESC`
- Returns empty state (not error) when no datasets exist for user

**Response Includes:**
- `isCurrent`: Always `true` for latest overall dataset
- `isCurrentForCampaign`: `true` if this is the latest dataset for its campaign

### Integration with Reputation Dashboard

Saved campaigns are automatically visible in the Reputation Dashboard's "Review Requests Performance" panel, which displays:

- Sent count
- Clicked count
- Reviewed count
- Conversion rates (clicked/sent, reviewed/sent)
- Last computed timestamp (from `computedAt` field, not campaign `createdAt`)
- Dataset ID badge
- "Current" badge for latest dataset
- Deep link button to Review Request Automation app

Additionally, the Reputation Dashboard's "Insights & Recommendations" panel provides actionable insights based on your campaign data, with deep links that automatically open the correct tab and highlight relevant fields in Review Request Automation.

### Latest Dataset Definition

The "latest" dataset is determined strictly by:
1. Maximum `computedAt` timestamp (primary sort)
2. Maximum `createdAt` timestamp (tie-breaker)

This ensures deterministic ordering regardless of campaign creation order.

### Data Scoping

All database records are strictly scoped to the logged-in user (`userId`). Users can only access their own campaigns and datasets. All queries include `userId` in the WHERE clause.

## Deep Linking & Cross-App State Memory (V3.5)

Review Request Automation now supports deep linking from Reputation Dashboard with automatic tab switching, field highlighting, and context awareness.

### Query Parameters

The app accepts the following query parameters:

- **`tab`**: Switches to the specified tab
  - Valid values: `"campaign"`, `"customers"`, `"templates"`, `"queue"`, `"results"`
  - Example: `/apps/review-request-automation?tab=templates`

- **`focus`**: Highlights and scrolls to a specific field/section
  - Valid values:
    - `"reviewLinkUrl"`: Review link input field
    - `"followUpDelayDays"`: Follow-up delay field
    - `"frequencyCapDays"`: Frequency cap field
    - `"timing"`: Send delay field
    - `"contacts"`: Customers tab (contact information section)
    - `"sms"`: Templates tab (SMS templates section)
    - `"cta"`: Templates tab (call-to-action section)
    - `"skips"`: Queue tab (skipped items section)
  - Example: `/apps/review-request-automation?tab=campaign&focus=reviewLinkUrl`

- **`from=rd`**: Indicates navigation from Reputation Dashboard
  - Triggers context banner: "Tip: Fixing this will improve your review request conversion."
  - Banner is dismissible and persists dismissal in session storage

### Field Highlighting Behavior

When a `focus` parameter is provided:
- Automatically scrolls the target field/section into view (smooth scrolling)
- Applies a highlight ring animation (2 seconds, then fades)
- Works even if the target field is not found (graceful fallback)
- Waits for tab switching to complete before scrolling

### Context Banner

When `from=rd` is present in the URL:
- Shows a dismissible banner at the top of the page
- Provides context: "Tip: Fixing this will improve your review request conversion."
- Dismissal persists in session storage (survives page reloads in same session)
- Banner uses OBD V3 design system styling (consistent with other panels)

### Usage Examples

**From Reputation Dashboard Insights:**
- Missing review link → `/apps/review-request-automation?tab=campaign&focus=reviewLinkUrl&from=rd`
- Follow-up too soon → `/apps/review-request-automation?tab=campaign&focus=followUpDelayDays&from=rd`
- Low click rate → `/apps/review-request-automation?tab=templates&focus=cta&from=rd`

**Manual Navigation:**
- Open Templates tab: `/apps/review-request-automation?tab=templates`
- Focus on SMS section: `/apps/review-request-automation?tab=templates&focus=sms`

### Technical Implementation

- Uses Next.js `useSearchParams` hook for client-side parameter reading
- Tab switching updates `activeTab` state
- Field highlighting uses React refs and CSS classes
- Smooth scrolling via `element.scrollIntoView({ behavior: "smooth" })`
- Highlight animation uses Tailwind ring utilities with timeout cleanup
- Session storage for banner dismissal state

## OBD CRM Integration

Review Request Automation automatically syncs customer contacts and activity to OBD CRM (best-effort, non-blocking).

### Integration Behavior

**Best-Effort & Non-Blocking:**
- CRM integration failures do not block review request sending or tracking
- All CRM operations are wrapped in try/catch with error logging (dev-only)
- Review request workflow continues even if CRM sync fails

### Events That Trigger CRM Writes

#### 1. Review Request Sent

**Trigger:** When a review request email is successfully sent (via `/api/review-request-automation/send-email`)

**CRM Actions:**
- Upserts contact with:
  - Source: `"reviews"`
  - Tag: `"Review Request"`
  - Name, email, phone from customer data
- Adds activity note:
  - Format: `"Review request sent via email on YYYY-MM-DD | Campaign: {campaign name}"`
  - Includes campaign name if available

**Skip Conditions:**
- Contact is NOT created if:
  - Name is missing, OR
  - Both email and phone are missing

#### 2. Review Received/Confirmed

**Trigger:** When a customer confirms they left a review (via `/api/review-request-automation/reviewed`)

**CRM Actions:**
- Upserts contact with:
  - Source: `"reviews"`
  - Tag: `"Review Received"`
  - Name, email, phone from customer data
- Adds activity note:
  - Format: `"Review received (confirmed by customer)"`
  - Note: Rating and review text are not available at confirmation time

**Skip Conditions:**
- Contact is NOT created if:
  - Name is missing, OR
  - Both email and phone are missing

### Tags Used

- **`"Review Request"`**: Applied when a review request is sent
- **`"Review Received"`**: Applied when a customer confirms they left a review

### Note Formats

**Review Request Sent:**
```
Review request sent via email on 2025-12-30 | Campaign: Acme Plumbing Services
```

**Review Received:**
```
Review received (confirmed by customer)
```

### Business Scoping

- All CRM operations use the same `userId` as the review request automation app
- Contacts are scoped to the authenticated user's business
- No cross-business data leakage possible

### Error Handling

- CRM integration errors are logged only in development (`NODE_ENV !== "production"`)
- Errors do not affect the review request workflow
- Failed CRM syncs are silently skipped (best-effort pattern)

### Technical Details

**Service Module Used:**
- `upsertContactFromExternalSource()` - Creates or updates contact
- `addActivityNote()` - Adds activity timeline entry

**Integration Points:**
- `POST /api/review-request-automation/send-email` - After email sent successfully
- `GET /api/review-request-automation/reviewed` - After review confirmation

## API

### POST `/api/review-request-automation`

**Request:**
```typescript
{
  campaign: Campaign;
  customers: Customer[];
  events: Event[];
}
```

**Response:**
```typescript
{
  templates: MessageTemplate;
  sendQueue: SendQueueItem[];
  metrics: FunnelMetrics;
  qualityChecks: QualityCheck[];
  nextActions: NextAction[];
  validationErrors: string[];
  campaignHealth: CampaignHealth;        // Status, score (0-100), reasons
  sendTimeline: SendTimeline;            // Events array with timestamps
  templateQuality: TemplateQuality[];    // Per-template quality assessment
  businessTypeRecommendation?: BusinessTypeRecommendation;  // If businessType provided
  guidanceBenchmarks: GuidanceBenchmark[];  // Best-practice recommendations
}
```

## File Structure

```
src/
  app/
    apps/
      (apps)/
        review-request-automation/
          page.tsx                    # Main app page
    api/
      review-request-automation/
        route.ts                      # API route
  lib/
    apps/
      review-request-automation/
        types.ts                      # Type definitions
        engine.ts                     # Pure calculation functions
        engine.test.ts                # Unit tests
        csv-utils.ts                  # CSV import/export utilities
```

## Testing

Run unit tests:
```bash
npm test
# or
vitest
```

Test file: `src/lib/apps/review-request-automation/engine.test.ts`

## Future Enhancements (V4)

- Database persistence (Prisma integration)
- External SMS/email sending (Twilio, SendGrid, etc.)
- Advanced personalization (AI-generated custom messages)
- Real-time automation (cron jobs, webhooks)
- Multi-user support (saved campaigns per user)
- Integration APIs (connect to POS systems, booking platforms)
- Analytics dashboard (open rates, click rates, conversion rates)

