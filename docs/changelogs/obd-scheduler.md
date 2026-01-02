# OBD Scheduler & Booking - Changelog

All notable changes to the OBD Scheduler & Booking app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Tier 5.7

### Added
- **Smart Views (5.7A)**: Dashboard view filters for booking requests
  - Needs Action: Shows REQUESTED and PROPOSED_TIME status requests
  - Upcoming: Shows APPROVED requests with future proposed start times
  - Past Due: Shows APPROVED requests with past proposed start times
  - Completed: Shows COMPLETED status requests
  - Declined: Shows DECLINED status requests
  - All: Shows all requests
  - Active view persisted to localStorage key: `obd:scheduler:activeView` (Saved Filters functionality)
  - Location: Dashboard (Requests tab)

- **Request Detail Layout Polish**: Improved request detail modal/drawer UI
  - Status indicators with colored dots (green for approved, red for declined, amber for proposed, blue for completed)
  - Organized sections for customer info, service details, time windows, and status timeline
  - Clear action buttons grouped by request status
  - Improved spacing and visual hierarchy
  - Archive/unarchive buttons for completed and declined requests
  - Location: Dashboard (Requests tab - detail view)

- **Sorting Controls (5.7C)**: Request sorting options
  - Newest First: Sort by creation date (descending)
  - Oldest First: Sort by creation date (ascending)
  - Soonest Appointment: Sort by proposed start time (ascending, nulls last)
  - Recently Updated: Sort by last updated time (descending)
  - Location: Dashboard (Requests tab)

- **Bulk Actions (5.7E)**: Bulk decline functionality
  - Checkbox selection for multiple requests
  - Bulk decline confirmation modal
  - Filters out already-declined requests from bulk operation
  - Sequential processing with error handling
  - Location: Dashboard (Requests tab)

- **Archive/Hide (5.7F)**: Archive and unarchive requests
  - Archive button to hide requests from default view
  - Unarchive button to restore archived requests
  - Toggle to show/hide archived requests
  - Archived request IDs persisted to localStorage key: `obd:scheduler:archivedIds` (stored as JSON array)
  - Location: Dashboard (Requests tab)

- **CSV Export (5.7I)**: Export booking requests to CSV
  - Export button on Requests tab
  - Includes columns: customerName, email, phone, service, status, preferredStart, proposedStart, createdAt
  - Proper CSV escaping for commas, quotes, and newlines
  - Filename format: `obd-booking-requests-YYYY-MM-DD.csv`
  - Exports currently visible/sorted requests
  - Location: Dashboard (Requests tab)

## Tier 5.6

### Added
- **Clean Public Booking URL**: New route `/book/[bookingKey]`
  - Replaces legacy route `/apps/obd-scheduler/public?key=...`
  - Clean URL format: `https://apps.ocalabusinessdirectory.com/book/{bookingKey}`
  - Legacy route remains functional with redirect notice
  - Public route metadata: `robots: { index: false, follow: false }`
  - Location: Public booking form

- **Service Selection in Public Form**: Dropdown for selecting services
  - Services loaded from `/api/obd-scheduler/public/context?key=...`
  - Dropdown only visible when services exist
  - Service selection is optional (form works without services)
  - Format: `{serviceName} ({durationMinutes} min)`
  - Server-side validation ensures service belongs to business and is active
  - Location: Public booking form (`/book/[bookingKey]` and legacy route)

- **Time Normalization**: 15-minute increment rounding
  - Preferred start times normalized to 15-minute increments (0, 15, 30, 45)
  - Round down behavior (user-friendly, doesn't push time forward)
  - Applied in public form client-side and API server-side
  - Location: Public booking form and `/api/obd-scheduler/requests` POST endpoint

- **Public Booking Rate Limiting**: Anti-spam protection
  - In-memory rate limiter for public booking requests
  - Limit: 5 requests per 10-minute window per bookingKey:IP combination
  - Automatic cleanup of expired entries (max 10,000 entries)
  - Fail-open behavior (allows requests if rate limit check fails)
  - Location: `/api/obd-scheduler/requests` POST endpoint

## Tier 5.5

### Added
- **CRM Integration**: Automatic sync of booking requests to CRM
  - Booking requests automatically create/update CRM contacts
  - Contact matching by email (fallback to phone)
  - Automatic activity note creation with booking details
  - Tags requests with "Booking Request" tag
  - Non-blocking (fails gracefully if CRM unavailable)
  - Location: `/api/obd-scheduler/requests` POST endpoint (`src/lib/apps/obd-scheduler/integrations/crm.ts`)

## Tier 5.4

### Added
- **SMS Notifications (5.4A)**: SMS notifications for booking requests
  - Twilio integration for sending SMS
  - SMS templates: REQUEST_RECEIVED, CONFIRMED, PROPOSED, DECLINED
  - All messages ≤ 160 characters with "Reply STOP to opt out" footer
  - Quiet hours enforcement (default: 9pm - 8am, configurable)
  - Rate limiting per businessId:phone combination
  - STOP/HELP command handling via webhook (`/api/sms/twilio/webhook`)
  - Non-blocking SMS sending (fails gracefully, doesn't block booking creation)
  - SMS sending triggered when booking request has customer phone number
  - Location: `/api/obd-scheduler/requests` POST endpoint
  - Files: `src/lib/sms/*` (twilioClient.ts, sendSms.ts, smsTemplates.ts, smsRateLimit.ts, quietHours.ts, smsTypes.ts)

- **Twilio Client Wrapper**: Safe Twilio client initialization
  - Lazy instantiation to prevent crashes when env vars missing
  - Safe error handling without exposing secrets
  - Environment variable checks: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
  - Location: `src/lib/sms/twilioClient.ts`

- **SMS Rate Limiting**: Per-businessId:phone rate limiting
  - In-memory rate limiter (best-effort, serverless-safe)
  - Prevents SMS spam
  - Location: `src/lib/sms/smsRateLimit.ts`

- **Quiet Hours Check**: Time-based SMS sending restrictions
  - Prevents SMS sending during quiet hours (default: 9pm - 8am)
  - Configurable via environment variables
  - Location: `src/lib/sms/quietHours.ts`

---

