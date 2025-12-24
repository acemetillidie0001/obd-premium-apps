# Review Request Automation V3 - Documentation

## Overview

The Review Request Automation is a V3 production-ready OBD Premium App that generates review request templates and manages a send queue for automated review request campaigns. V3 does NOT send SMS/email externally; instead, it generates templates and produces a "Send Queue" with copy buttons and manual status tracking.

**Status:** Live (V3)  
**Route:** `/apps/review-request-automation`  
**Category:** Reputation

## V3 Scope (Production Polish)

### What's Included

- **Quick Start Banner**: Interactive guide on first load with clickable steps
- **Campaign Builder**: Configure business info, review platform, message settings, and automation rules
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
  - "Generate again" button for regeneration
- **Send Queue (V3 "automation simulation")**: 
  - Computes queue items deterministically based on trigger rules
  - Respects quiet hours, frequency caps, and follow-up rules
  - **Bulk Actions**: Select multiple items and mark as sent/clicked/reviewed
  - Copy button per row (fills tokens)
  - Manual status tracking: "Mark Sent", "Mark Clicked", "Mark Reviewed", "Mark Opted Out"
  - Status changes update metrics and remove/advance follow-up items
  - Export queue to CSV
- **Results + Insights**: 
  - Funnel counters: loaded, ready, queued, sent, clicked, reviewed, optedOut
  - Quality checks insights (invalid review link, SMS too long, follow-up too aggressive, etc.)
  - Next actions checklist with copy buttons
- **Export Functionality**:
  - Export customers to CSV
  - Export send queue to CSV
  - Export campaign JSON (includes campaign, customers, events, and results)
- **Data Persistence**: 
  - Automatic localStorage save/restore
  - Clear data functionality
- **Accessibility**:
  - All buttons have tooltips and aria-labels
  - Keyboard support (Enter/Space for button activation)
  - Focus management in modals
- **Pure Engine Module**: All computations refactored into testable `engine.ts` module
- **Unit Tests**: Comprehensive test coverage for engine functions
- **CSV Utilities**: Tolerant parsing with column mapping and error reporting

### What's NOT Included (V4 Roadmap)

**V3 Limitations:**
- **External SMS/Email Sending**: V3 generates templates only; no actual sending via Twilio, SendGrid, etc.
- **Database Persistence**: Campaigns and customers are stored in localStorage only (no Prisma/DB integration)
- **Real-time Automation**: No actual automated sending; manual queue management with copy buttons
- **Advanced Personalization**: Basic {firstName} token replacement only (no AI-generated custom messages)
- **Multi-user Support**: Single-session campaigns (no saved campaigns per user, no user accounts)
- **Integration APIs**: No connections to SMS/email providers, POS systems, or booking platforms

**V4 Planned Enhancements:**
- Database persistence (Prisma integration)
- External SMS/email sending (Twilio, SendGrid, etc.)
- Advanced personalization (AI-generated custom messages)
- Real-time automation (cron jobs, webhooks)
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

### Automation Rules

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `triggerType` | Yes | `"manual" \| "after_service" \| "after_payment"` | When to trigger send |
| `sendDelayHours` | Yes | `0-168` | Hours to wait before sending |
| `followUpEnabled` | Yes | `boolean` | Enable follow-up messages |
| `followUpDelayDays` | Yes (if enabled) | `1-30` | Days to wait before follow-up |
| `frequencyCapDays` | Yes | `30 \| 60 \| 90` | Days between sends to same customer |
| `quietHours` | Yes | `{ start: "HH:mm", end: "HH:mm" }` | Hours when messages should not be sent (default: 09:00-19:00) |

### Inline "Why this matters" Micro-Education

Small info icons (ℹ️) appear next to key settings in the Campaign tab with expandable panels:

**Fields with Micro-Education:**
- **Follow-Up Delay**: Explains why 2-7 day delay is optimal (gives customers time to review naturally while staying top of mind)
- **Quiet Hours**: Explains that 9am-7pm prevents sending during sleep/busy times, messages auto-scheduled for next allowed window
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
- **Mark Sent**: Mark as sent (creates "sent" event)
- **Mark Clicked**: Mark as clicked (creates "clicked" event)
- **Mark Reviewed**: Mark as reviewed (creates "reviewed" event, removes follow-ups)
- **Opt Out**: Mark customer as opted out (creates "optedOut" event)

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

### Export Campaign JSON
- Exports complete campaign data to JSON
- Includes: campaign configuration, customers, events, results, and `exportedAt` timestamp (ISO format)
- Available from Queue tab
- Filename format: `campaign-{businessName}-{date}.json`
- Useful for backup, migration, or analysis

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

