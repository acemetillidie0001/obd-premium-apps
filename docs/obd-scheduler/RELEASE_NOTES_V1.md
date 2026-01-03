# OBD Scheduler — V1 Release Notes

## Overview
OBD Scheduler V1 delivers a reliable, business-focused booking system designed for local businesses. V1 emphasizes stability, clarity, and controlled rollout.

---

## Shipped in V1

### Core Features
- **Public booking links** (bookingKey-based)
  - Secure, shareable booking URLs
  - Supports short codes, slug-codes, and legacy bookingKey formats
  - Public booking page with business branding

- **Service selection**
  - Customers can choose from active services
  - Service names, descriptions, and durations
  - Service-level availability configuration

- **Availability windows and exceptions**
  - Business hours configuration
  - Date-specific exceptions (blocked dates)
  - Time slot generation based on availability

- **Request-based booking**
  - Customers submit booking requests for business approval
  - Businesses manage requests from admin dashboard
  - Request status tracking (needs-action, upcoming, completed, declined)

- **Instant booking mode** (when enabled)
  - Customers can book immediately without approval
  - Real-time slot availability
  - Automatic booking confirmation

- **Admin Scheduler dashboard**
  - Request management (view, filter, sort, export)
  - Service management (create, update, activate/deactivate)
  - Availability configuration
  - Branding and theme customization
  - Settings management
  - Metrics and verification tools

- **Confirmation messaging**
  - Email notifications for booking requests
  - Customer confirmation messages
  - Business alerts for new requests

- **Pilot rollout controls**
  - Environment-based feature flag (`OBD_SCHEDULER_PILOT_MODE`)
  - Business allowlist (`OBD_SCHEDULER_PILOT_BUSINESS_IDS`)
  - Admin access restrictions for controlled rollout

- **Health monitoring endpoint**
  - `GET /api/obd-scheduler/health`
  - Database connection verification
  - Pilot mode status reporting

---

## Reliability & Safety Improvements

### Runtime Isolation
- **Resolver scripts fully isolated from runtime**
  - Migration resolver scripts (`tools/resolve-all-failed-migrations.cjs`, `tools/resolve-failed-migration.cjs`) never execute during normal runtime
  - Fingerprint logs confirm script execution only when explicitly invoked
  - Vercel build guards prevent resolver execution during builds

### Database Safety
- **Lazy Prisma initialization with safe DB failure handling**
  - `getPrisma()` function ensures Prisma client is only instantiated when needed
  - `requireDatabaseUrl()` guard prevents connection attempts without `DATABASE_URL`
  - No module-scope Prisma initialization

- **DB_UNAVAILABLE mapped to HTTP 503**
  - Missing `DATABASE_URL` returns `503` with code `"DB_UNAVAILABLE"`
  - User-friendly error messages on public booking page
  - No stack traces or technical errors exposed to users

### Client-Side Stability
- **AbortController + requestId guards for slot loading**
  - Prevents race conditions during rapid date/service changes
  - Stale responses are ignored
  - Clean request cancellation on dependency changes

- **Duplicate submission protection**
  - Detects duplicate booking requests within 5-minute window
  - Returns existing request with warning message
  - Prevents accidental duplicate bookings

### Observability
- **Structured, non-PII Scheduler event logging**
  - Event tags: `DB_UNAVAILABLE`, `INVALID_BOOKING_KEY`, `INVALID_SERVICE`, `DUPLICATE_SUBMISSION_BLOCKED`
  - Hashed business IDs (no raw PII)
  - Route paths and error context (no names, emails, phones, or request bodies)
  - Centralized logging via `logSchedulerEvent()` and `logSchedulerEventWithBusiness()`

---

## Known Limitations (Not in V1)

The following features are explicitly excluded from V1:

- **Payment processing**
  - No payment collection or deposits
  - No payment gateway integration

- **SMS notifications**
  - Email-only notifications in V1
  - SMS functionality not implemented

- **Calendar sync** (Google / Microsoft)
  - No Google Calendar integration
  - No Microsoft Outlook integration
  - No bidirectional calendar sync

- **Automated reminders**
  - No automated follow-up emails
  - No drip sequences or reminder campaigns

- **Client login/accounts**
  - Customers do not create accounts
  - No customer booking history view
  - No customer dashboard

- **Multi-staff routing**
  - Single-staff booking model in V1
  - No staff assignment or availability per staff member

---

## Technical Details

### API Endpoints

**Public Endpoints:**
- `GET /api/obd-scheduler/public/context` — Get booking context for public page
- `GET /api/obd-scheduler/slots` — Get available booking slots
- `POST /api/obd-scheduler/requests` — Create booking request (public)
- `POST /api/obd-scheduler/bookings/instant` — Create instant booking (public)

**Admin Endpoints:**
- `GET /api/obd-scheduler/health` — Health check and pilot mode status
- `GET /api/obd-scheduler/requests` — List booking requests (admin)
- `GET /api/obd-scheduler/services` — List booking services
- `POST /api/obd-scheduler/services` — Create booking service
- `GET /api/obd-scheduler/availability` — Get availability windows
- `POST /api/obd-scheduler/availability` — Update availability
- `GET /api/obd-scheduler/theme` — Get booking theme
- `POST /api/obd-scheduler/theme` — Update booking theme
- `GET /api/obd-scheduler/settings` — Get booking settings
- `POST /api/obd-scheduler/settings` — Update booking settings
- `GET /api/obd-scheduler/public-link` — Get public booking link
- `POST /api/obd-scheduler/public-link` — Update public booking link
- `GET /api/obd-scheduler/metrics` — Get booking metrics
- `GET /api/obd-scheduler/verification` — Run verification checks

### Error Codes

- `DB_UNAVAILABLE` (503) — Database unavailable
- `PILOT_ONLY` (403) — Business not in pilot allowlist
- `INVALID_BOOKING_KEY` (404) — Invalid booking link
- `INVALID_SERVICE` (400) — Service not found or inactive
- `SLOT_UNAVAILABLE` (400) — Requested slot no longer available
- `INSTANT_BOOKING_DISABLED` (400) — Instant booking not enabled
- `VALIDATION_ERROR` (400) — Request validation failed
- `RATE_LIMITED` (429) — Rate limit exceeded

### Environment Variables

- `DATABASE_URL` — Required for all Scheduler functionality
- `OBD_SCHEDULER_PILOT_MODE` — Set to `"true"` or `"1"` to enable pilot restrictions
- `OBD_SCHEDULER_PILOT_BUSINESS_IDS` — Comma-separated list of allowed business IDs

---

## What's Next

Phase 3 will focus on:
- Calendar sync (Google Calendar, Microsoft Outlook)
- SMS notifications
- Payment processing
- Deeper CRM automation

No dates or commitments are implied.

---

## Documentation

- **User Guide:** `docs/obd-scheduler/README.md`
- **Launch Checklist:** `docs/obd-scheduler/LAUNCH_CHECKLIST.md`
- **Architecture:** `docs/apps/obd-scheduler-v3.md`

---

**Release Date:** V1 Launch
**Version:** 1.0.0
**Status:** Stable

