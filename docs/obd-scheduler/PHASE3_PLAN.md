# OBD Scheduler — Phase 3 Planning

## ⚠️ Important: SMS Execution Deferred

**SMS execution is deferred until business verification and provider setup are complete.**

- No SMS migrations or sends occur before Twilio approval
- Calendar groundwork is provider-agnostic and can proceed independently
- See recommended build order below for updated sequencing

## Overview

Phase 2 (V1) is complete and tagged. This document defines the decision tree, recommended build order, and MVP definitions for Phase 3 features: Calendar Sync, SMS Notifications, and Payments.

---

## Phase 3 Decision Tree

### Track A: Calendar Sync (Google / Microsoft)

**Primary Business Benefit:**
- Eliminates double-booking risk
- Reduces manual calendar management overhead
- Provides real-time availability based on actual calendar state
- Increases trust: customers see "real" availability, not just configured windows

**Dependencies:**
- ✅ V1 pilot must have 5+ active businesses (prove demand)
- ✅ OAuth2 flow infrastructure (already exists for other OBD apps)
- ✅ Calendar API credentials (Google Calendar API, Microsoft Graph API)
- ✅ Rate limiting strategy (calendar APIs have strict quotas)
- ⚠️ Business must have active calendar (Google/Microsoft account)

**External APIs/Services Required:**
- Google Calendar API v3
  - OAuth2 scopes: `https://www.googleapis.com/auth/calendar.readonly` (read), `https://www.googleapis.com/auth/calendar.events` (write)
  - Rate limits: 1,000,000 queries/day, 10 queries/second/user
- Microsoft Graph API (Calendar)
  - OAuth2 scopes: `Calendars.Read`, `Calendars.ReadWrite`
  - Rate limits: 10,000 requests/10 minutes per app

**Risk Level: MEDIUM**
- **What could break:**
  - OAuth token expiration/revocation (requires re-authentication flow)
  - Calendar API downtime (Google/Microsoft outages)
  - Rate limit exhaustion (if many businesses sync simultaneously)
  - Timezone mismatches (calendar vs. booking system)
  - Sync conflicts (booking created in Scheduler but calendar event deleted externally)

**Minimum "First Shippable Slice" (V3.0):**
- **One-way sync: Calendar → Scheduler**
  - Read-only calendar integration
  - Automatically block booked times in Scheduler availability
  - Show "busy" slots as unavailable
  - No write-back to calendar (simpler, lower risk)
- **Single provider: Google Calendar only** (Microsoft in V3.1)
- **Manual sync trigger** (button in admin dashboard, not automatic polling)
- **Clear UI indicators:** "Synced from Google Calendar" badge on blocked slots

**Estimated Complexity:** Medium-High
- OAuth2 flow: 2-3 days
- Calendar API integration: 3-4 days
- Sync logic + conflict resolution: 2-3 days
- UI/UX: 1-2 days
- **Total: ~10-12 days**

---

### Track B: SMS Notifications

**Primary Business Benefit:**
- Higher open/response rates than email (SMS: ~98% open, email: ~20%)
- Faster customer response (SMS: minutes, email: hours/days)
- Reduces no-shows (immediate reminders)
- Better for time-sensitive bookings (same-day, urgent)

**Dependencies:**
- ✅ V1 pilot must have 10+ booking requests submitted (prove usage)
- ✅ SMS provider account (Twilio, AWS SNS, or similar)
- ✅ Phone number validation (already in V1 booking form)
- ✅ Cost management (SMS costs ~$0.01-0.05 per message)
- ⚠️ Business must provide phone numbers (optional in V1)

**External APIs/Services Required:**
- Twilio API (recommended)
  - Programmable SMS API
  - Cost: ~$0.0075 per SMS (US), $0.02-0.05 (international)
  - Rate limits: 1 message/second per number (can request higher)
- Alternative: AWS SNS
  - Cost: ~$0.00645 per SMS (US)
  - More complex setup (requires AWS account)

**Risk Level: LOW-MEDIUM**
- **What could break:**
  - SMS delivery failures (carrier issues, invalid numbers)
  - Cost overruns (if sending too many messages)
  - Spam/opt-out compliance (TCPA regulations)
  - International number formatting (must handle +country code)

**Minimum "First Shippable Slice" (V3.0):**
- **One-way SMS: Scheduler → Customer**
  - Send SMS when booking request is submitted (confirmation)
  - Send SMS when business approves/declines request
  - Send SMS reminder 24 hours before appointment (if instant booking)
  - No two-way SMS (no replies, no conversation)
- **Single provider: Twilio** (others in V3.1)
- **Opt-out handling:** Simple "STOP" keyword support
- **Cost tracking:** Show SMS usage in admin dashboard (count, estimated cost)

**Estimated Complexity:** Low-Medium
- Twilio integration: 1-2 days
- SMS sending logic: 1-2 days
- Opt-out handling: 1 day
- Cost tracking: 1 day
- **Total: ~4-6 days**

---

### Track C: Payments (Deposit / Full)

**Primary Business Benefit:**
- Reduces no-shows (financial commitment)
- Generates revenue (transaction fees)
- Enables deposit-based bookings (common for services)
- Professional appearance (paid bookings feel more "real")

**Dependencies:**
- ✅ V1 pilot must have 20+ completed bookings (prove demand)
- ✅ Payment processor account (Stripe, Square, PayPal)
- ✅ PCI compliance considerations (no card storage, use processor tokens)
- ✅ Refund/cancellation policy (legal + operational)
- ⚠️ Business must have payment account (Stripe Connect or similar)
- ⚠️ Tax handling (may need to integrate tax calculation)

**External APIs/Services Required:**
- Stripe (recommended)
  - Payment Intents API (for deposits)
  - Connect API (for multi-business support)
  - Cost: 2.9% + $0.30 per transaction (standard), 0.8% + $0.30 (Stripe Connect)
  - Rate limits: 100 requests/second (plenty for Scheduler)
- Alternative: Square
  - Cost: 2.6% + $0.10 per transaction
  - More complex API (less common)

**Risk Level: HIGH**
- **What could break:**
  - Payment failures (card declined, insufficient funds)
  - Refund disputes (chargebacks, customer complaints)
  - Tax calculation errors (wrong amounts, missing taxes)
  - PCI compliance violations (storing card data incorrectly)
  - Currency conversion (if international businesses)
  - Fraud (stolen cards, chargeback abuse)

**Minimum "First Shippable Slice" (V3.0):**
- **Deposit-only payments** (not full payment)
  - Business sets deposit amount per service (e.g., "$50 deposit required")
  - Customer pays deposit when booking (Stripe Checkout or embedded form)
  - Deposit is held until appointment (no immediate capture)
  - Refund policy: Full refund if cancelled 24+ hours before, 50% if <24 hours
- **Single provider: Stripe** (others in V3.1)
- **US-only** (no international currencies initially)
- **No tax calculation** (business responsible for tax, shown as separate line item)
- **Simple refund flow:** Business can refund from admin dashboard

**Estimated Complexity:** High
- Stripe integration: 3-4 days
- Payment flow (deposit capture, refunds): 3-4 days
- Tax handling (basic): 1-2 days
- Refund/cancellation logic: 2-3 days
- UI/UX (payment forms, receipts): 2-3 days
- **Total: ~11-16 days**

---

## Recommended Phase 3 Build Order

### **Phase 3A: Calendar Groundwork (Internal) — V3.0**

**Why First:**
- **Provider-agnostic:** Calendar groundwork is internal infrastructure, independent of external provider setup
- **Medium risk:** OAuth complexity, but one-way sync reduces risk
- **High value:** Eliminates double-booking, increases trust
- **No external dependencies:** Can proceed without Twilio or payment processor approval
- **Natural foundation:** Establishes sync patterns that can inform other integrations

**When to Start:**
- ✅ V1 pilot has 5+ active businesses
- ✅ OAuth infrastructure exists (already in place for other OBD apps)
- ✅ No critical V1 bugs blocking rollout

**MVP Definition (V3.0):**
- Google Calendar one-way sync (read-only)
- Block booked calendar times in Scheduler availability
- Manual sync trigger (button in admin)
- "Synced from Google Calendar" UI indicators
- Microsoft Calendar in V3.1

---

### **Phase 3B: SMS Notifications (Twilio) — V3.1**

**Why Second:**
- **Deferred until Twilio + LLC setup complete:** No SMS migrations or sends occur before Twilio approval
- **Lowest risk (once approved):** Simple one-way communication, no complex state management
- **Fastest to ship (once approved):** ~4-6 days vs. 11-16 (Payments)
- **Immediate value:** Reduces no-shows, improves customer experience
- **Requires business verification:** Twilio account setup and LLC verification must be complete

**When to Start:**
- ✅ V1 pilot has 10+ booking requests submitted
- ✅ At least 3 businesses are actively managing requests
- ✅ **Twilio account approved and configured**
- ✅ **Business verification and LLC setup complete**
- ✅ Calendar groundwork (V3.0) is stable
- ✅ No critical V1 bugs blocking rollout

**MVP Definition (V3.1):**
- Twilio integration
- Send SMS on: booking submission, approval/decline, 24h reminder
- Opt-out handling ("STOP" keyword)
- Cost tracking in admin dashboard
- No two-way SMS, no conversation threads

**⚠️ Blocking Condition:**
- **DO NOT START** until Twilio approval and business verification are complete
- **DO NOT** run SMS migrations or send any SMS messages before provider setup

---

### **Phase 3C: Payments — V3.2**

**Why Last:**
- **Highest risk:** Payment processing, refunds, compliance, fraud
- **Highest complexity:** 11-16 days, multiple edge cases
- **Requires proven demand:** Need 20+ completed bookings to justify payment complexity
- **Legal/operational overhead:** Refund policies, tax handling, PCI compliance

**When to Start:**
- ✅ V1 pilot has 20+ completed bookings
- ✅ Calendar groundwork (V3.0) is stable
- ✅ SMS Notifications (V3.1) is stable (if implemented)
- ✅ Business demand is clear (businesses asking for payments)
- ✅ Legal/compliance review completed

**MVP Definition (V3.2):**
- Stripe deposit-only payments
- Business sets deposit amount per service
- Customer pays deposit at booking
- Simple refund flow (business-initiated)
- US-only, no tax calculation
- Full payment in V3.3

---

## STOP/WAIT Conditions

### **Pause Phase 3 Work If:**

1. **V1 Critical Issues:**
   - `DB_UNAVAILABLE` errors > 5% of requests
   - `PILOT_ONLY` errors for businesses that should have access
   - Public booking page failures > 2% of page loads
   - Data loss or corruption incidents

2. **Pilot Expansion Blockers:**
   - Support requests > 10 per week (indicates UX issues)
   - Booking submission failure rate > 3%
   - Admin dashboard errors > 1% of page loads

3. **Infrastructure Issues:**
   - Database connection instability
   - API rate limiting issues
   - Deployment failures

### **Expand Pilot If:**

1. **V1 Stability:**
   - Zero critical bugs for 7+ days
   - Health endpoint shows 99%+ uptime
   - Error rates < 1% across all endpoints

2. **Business Engagement:**
   - 3+ businesses actively using Scheduler (submitting/managing requests)
   - 10+ booking requests submitted in pilot
   - Positive feedback from pilot businesses

3. **Support Capacity:**
   - Support team can handle 2x current load
   - Documentation is complete and tested

---

## Phase 3 MVP: Calendar Groundwork (V3.0)

### **Scope**

**Included:**
- Google Calendar OAuth2 integration
- One-way calendar sync (Calendar → Scheduler)
- Block booked calendar times in Scheduler availability
- Manual sync trigger (button in admin dashboard)
- "Synced from Google Calendar" UI indicators
- Admin toggle: Enable/disable calendar sync per business

**Excluded (V3.1+):**
- Two-way sync (write-back to calendar)
- Automatic polling (manual trigger only)
- Microsoft Calendar (V3.1)
- Calendar event creation from bookings
- Multi-calendar support

### **Technical Requirements**

1. **OAuth2 Integration:**
   - Google Calendar API OAuth2 scopes: `https://www.googleapis.com/auth/calendar.readonly`
   - Reuse existing OAuth infrastructure from other OBD apps
   - Token refresh handling

2. **Database Schema:**
   - Add `calendarEnabled: boolean` to `BookingSettings`
   - Add `calendarProvider: 'google' | 'microsoft' | null` to `BookingSettings`
   - Add `CalendarSync` table (optional, for tracking):
     - `id`, `businessId`, `lastSyncedAt`, `syncedEventCount`, `error`

3. **API Routes:**
   - `POST /api/obd-scheduler/calendar/sync` (internal, triggered by admin button)
   - `GET /api/obd-scheduler/calendar/oauth/callback` (public, OAuth callback)

4. **Admin UI:**
   - Calendar sync toggle in Settings tab
   - Manual sync button in Settings tab
   - Sync status indicator (last synced time, event count)

### **Success Criteria**

- ✅ OAuth2 flow completes successfully
- ✅ Calendar events are read and blocked in Scheduler availability
- ✅ Manual sync trigger works (button in admin)
- ✅ "Synced from Google Calendar" indicators display correctly
- ✅ No SMS dependencies (calendar groundwork is provider-agnostic)
- ✅ Error handling: Failed syncs don't block booking flow

---

## Phase 3B MVP: SMS Notifications (V3.1) — Deferred Until Twilio Approval

### **Scope**

**Included:**
- Twilio SMS integration
- Send SMS on booking submission (customer confirmation)
- Send SMS on business approval/decline (customer notification)
- Send SMS 24 hours before appointment (reminder)
- Opt-out handling ("STOP" keyword)
- Cost tracking in admin dashboard (SMS count, estimated cost)
- Admin toggle: Enable/disable SMS per business

**Excluded (V3.2+):**
- Two-way SMS (customer replies)
- SMS conversation threads
- Custom SMS templates (use default templates)
- International SMS (US/Canada only)
- SMS scheduling (beyond 24h reminder)
- Multiple SMS providers

**⚠️ Important:**
- **DO NOT START** until Twilio approval and business verification are complete
- **DO NOT** run SMS migrations or send any SMS messages before provider setup

### **Technical Requirements**

1. **Twilio Integration:**
   - Environment variable: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
   - Twilio SDK integration in `src/lib/integrations/twilio/`
   - Error handling for delivery failures

2. **Database Schema:**
   - Add `smsEnabled: boolean` to `BookingSettings`
   - Add `SmsLog` table (optional, for tracking):
     - `id`, `businessId`, `bookingRequestId`, `phoneNumber`, `message`, `status`, `sentAt`, `error`

3. **API Routes:**
   - `POST /api/obd-scheduler/sms/send` (internal, called by booking flow)
   - `POST /api/obd-scheduler/sms/opt-out` (public, handles "STOP" keyword)

4. **Admin UI:**
   - SMS toggle in Settings tab
   - SMS usage/cost display in Metrics tab

### **Success Criteria**

- ✅ SMS sent on booking submission (within 5 seconds)
- ✅ SMS sent on approval/decline (within 5 seconds)
- ✅ SMS reminder sent 24h before appointment (within 1 hour window)
- ✅ Opt-out works ("STOP" keyword prevents future SMS)
- ✅ Cost tracking accurate (within 10% of actual Twilio costs)
- ✅ No SMS sent if business disabled SMS
- ✅ Error handling: Failed SMS don't block booking flow

---

## Phase 3A Completed (V3.0) — Calendar Groundwork

Phase 3A (Calendar Groundwork V3.0) is complete. This phase established the internal foundation for calendar blocking without external calendar provider integrations.

### What Shipped

**Data Model:**
- `SchedulerBusyBlock` Prisma model with fields: `id`, `businessId`, `start`, `end`, `reason`, `source` (defaults to "manual")
- Database migration: `20260103090912_add_scheduler_busy_blocks`
- Indexes for efficient queries by business and date range

**API Routes:**
- `GET /api/obd-scheduler/busy-blocks` — List busy blocks (with optional date filtering)
- `POST /api/obd-scheduler/busy-blocks` — Create busy block
- `GET /api/obd-scheduler/busy-blocks/[id]` — Get busy block by ID
- `PUT /api/obd-scheduler/busy-blocks/[id]` — Update busy block
- `DELETE /api/obd-scheduler/busy-blocks/[id]` — Delete busy block
- All routes include PILOT_ONLY gating and DB_UNAVAILABLE handling (503)
- Validation prevents overlapping time ranges

**Availability Logic:**
- Updated `generateSlots()` to accept `busyBlocks` parameter
- Slot generation excludes slots that overlap with busy blocks
- Integrated into both `/api/obd-scheduler/slots` and `/api/obd-scheduler/bookings/instant` routes
- Works alongside existing booking conflicts and buffer logic

**Admin UI:**
- "Blocked Time" management section in Availability tab
- Features:
  - Add blocked time (date/time range + optional reason)
  - View upcoming blocks (sorted by start time, only future/present blocks shown)
  - Delete manual blocks (calendar-synced blocks are read-only)
  - Source indicator shows "Manual block" vs future "From google/microsoft"
- Modal form with validation
- Error handling and loading states

### Operator Notes

- **Scope:** Busy blocks affect all services. When a time is blocked, it is excluded from available slots across all booking services.
- **Manual vs Synced:** Manual blocks (source="manual") can be created, edited, and deleted by admins. Future calendar-synced blocks (source="google" or "microsoft") will be read-only in the admin UI to prevent conflicts with external calendar data.
- **Public Booking Impact:** When busy blocks exist, the public booking page shows fewer available slots. Blocked times are automatically excluded from slot generation, so customers cannot book during blocked periods.
- **No Breaking Changes:** All existing V1 booking behavior remains unchanged. Busy blocks are additive and do not affect existing bookings or availability windows.

---

## Phase 3B Skeleton Complete — Calendar Sync Scaffolding (No OAuth)

Phase 3B skeleton (Calendar Sync scaffolding V3.1) is complete. This phase established the data model, API structure, and admin UI foundation for calendar sync, but **OAuth and actual sync logic are NOT implemented**.

### What Shipped

**Data Model:**
- `SchedulerCalendarIntegration` Prisma model with fields:
  - `id`, `businessId`, `provider` ("google" | "microsoft")
  - `status` ("disabled" | "connected" | "error")
  - `lastSyncAt`, `calendarId`, `tokenRef` (reference to encrypted token storage)
  - `errorMessage` (for error tracking)
- Database migration: `20260103092000_add_scheduler_calendar_integration`
- Unique constraint on `[businessId, provider]` (one integration per provider per business)
- Indexes for efficient queries by business, provider, and status

**TypeScript Types:**
- Provider-agnostic types in `src/lib/apps/obd-scheduler/types.ts`:
  - `CalendarProvider` ("google" | "microsoft")
  - `CalendarIntegrationStatus` ("disabled" | "connected" | "error")
  - `SchedulerCalendarIntegration` interface
  - `CalendarIntegrationStatusResponse` interface

**API Routes (Pilot-Gated, DB-Safe Stubs):**
- `GET /api/obd-scheduler/calendar/status` — Returns integration status and OAuth configuration check
- `POST /api/obd-scheduler/calendar/connect` — Stub (returns 501 NOT_IMPLEMENTED until OAuth is wired)
- `POST /api/obd-scheduler/calendar/sync` — Stub (returns 501 NOT_IMPLEMENTED until sync logic is implemented)
- All routes include PILOT_ONLY gating and DB_UNAVAILABLE handling (503)
- All routes use `handleApiError()` for consistent error handling

**Admin UI:**
- "Calendar Sync (Coming Soon)" panel in Calendar tab
- Features:
  - Status display (disabled/connected/error)
  - Last sync time (if available)
  - Error message display (if status="error")
  - OAuth configuration check (shows warning if env vars missing)
  - Connect button (disabled until OAuth is wired)
  - Sync button (disabled until sync logic is implemented)
- Loading and error states
- Clear messaging that features are "coming soon"

### What Is NOT Shipped

**OAuth Flow:**
- No OAuth authorization URL generation
- No OAuth state token management
- No OAuth callback handling
- No token exchange logic

**Token Storage:**
- No token encryption/decryption usage
- No token refresh logic
- `tokenRef` field exists but is not populated or used

**External API Calls:**
- No Google Calendar API calls
- No Microsoft Graph API calls
- No calendar event fetching
- No freeBusy queries

**Event Ingestion:**
- No calendar event parsing
- No timezone conversion logic
- No event-to-busy-block mapping

**Busy Block Creation:**
- No automatic creation of `SchedulerBusyBlock` records from calendar events
- No sync logic to create blocks with `source="google"` or `source="microsoft"`
- No deletion of stale synced blocks

### Next Implementation Steps

**OAuth Connect + Callback:**
- Implement state token generation and storage (CSRF protection)
- Complete `POST /api/obd-scheduler/calendar/connect` handler to generate OAuth URL
- Implement `GET /api/obd-scheduler/calendar/callback/google` to handle OAuth callback
- Exchange authorization code for access/refresh tokens
- Store tokens (encrypted) and create/update `SchedulerCalendarIntegration` record

**Token Storage + Encryption:**
- Integrate with existing token encryption layer (or implement if not ready)
- Store encrypted tokens in `SchedulerCalendarConnection` (existing model) or new storage
- Update `tokenRef` in `SchedulerCalendarIntegration` to reference stored tokens
- Implement token refresh logic for expired tokens

**Sync Implementation:**
- Complete `POST /api/obd-scheduler/calendar/sync` handler
- Fetch calendar events from Google Calendar API (freeBusy endpoint)
- Parse busy intervals from calendar events
- Delete existing synced blocks for the provider (cleanup stale data)
- Create new `SchedulerBusyBlock` records with `source="google"` (or "microsoft" in future)
- Update `lastSyncAt` timestamp
- Handle errors and update `status="error"` with error message if sync fails

---

## Next Steps: Calendar Sync Integration (V3.1+)

Phase 3A foundation and Phase 3B skeleton are complete. Next phase will wire OAuth flow and implement actual sync logic to create busy blocks from calendar events.

**Note:** SMS Notifications (V3.1) are deferred until Twilio approval and business verification are complete.

---

**Last Updated:** Phase 3B Skeleton Complete (V3.1 Scaffolding)
**Next Milestone:** V3.1 (OAuth + Sync Implementation)

