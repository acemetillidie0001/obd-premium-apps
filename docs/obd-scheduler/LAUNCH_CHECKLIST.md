# OBD Scheduler — V1 Launch Checklist

This checklist ensures a safe, repeatable V1 rollout for OBD Scheduler. Follow each section in order.

---

## 1) Pre-Launch Verification

### Environment Variables
Confirm required env vars are set:
- `DATABASE_URL` — PostgreSQL connection string
- `OBD_SCHEDULER_PILOT_MODE` — Set to `"true"` or `"1"` to enable pilot restrictions
- `OBD_SCHEDULER_PILOT_BUSINESS_IDS` — Comma-separated list of allowed business IDs (e.g., `"id1,id2,id3"`)

### Health Endpoint Verification
Test the health endpoint:
```bash
GET /api/obd-scheduler/health
```

**Expected response:**
```json
{
  "ok": true,
  "scheduler": "up",
  "pilotMode": false
}
```

If `pilotMode` is `true`, verify `OBD_SCHEDULER_PILOT_MODE` is set correctly.

### Smoke Test (Allowed Business)
For a business ID that will be in the pilot allowlist:

1. **Public booking page loads**
   - Navigate to: `/book/{bookingKey}`
   - Verify page renders without errors
   - Verify business name/logo displays

2. **Services load**
   - Verify service dropdown populates
   - Verify service names and durations display

3. **Slots load** (if instant booking enabled)
   - Select a date and service
   - Verify available time slots appear
   - Verify no console errors

4. **Request submission succeeds**
   - Fill out booking form
   - Submit request
   - Verify success message appears
   - Verify no error responses

5. **Admin dashboard loads without errors**
   - Navigate to: `/apps/obd-scheduler`
   - Verify all tabs load (Requests, Services, Availability, etc.)
   - Verify V1 Scope Banner displays
   - Verify no console errors or failed API calls

---

## 2) Pilot Enablement

### Step 1: Enable Pilot Mode
Set environment variable:
```bash
OBD_SCHEDULER_PILOT_MODE="true"
```

### Step 2: Populate Allowlist
Set environment variable with 2–3 business IDs for initial pilot:
```bash
OBD_SCHEDULER_PILOT_BUSINESS_IDS="business-id-1,business-id-2,business-id-3"
```

**Note:** Business IDs must match the authenticated user's `userId` (V3: `userId = businessId`).

### Step 3: Verify Access Control
Test the following scenarios:

1. **Allowed business (in allowlist)**
   - Navigate to `/apps/obd-scheduler`
   - Verify admin dashboard loads normally
   - Verify all tabs are accessible
   - Verify V1 Scope Banner shows: "Pilot rollout is in progress."

2. **Non-allowed business (not in allowlist)**
   - Log in as a business not in the allowlist
   - Navigate to `/apps/obd-scheduler`
   - Verify pilot message displays: "Scheduler is in pilot rollout. Your account will be enabled soon."
   - Verify all tabs are hidden
   - Verify API calls return `403` with code `"PILOT_ONLY"`

3. **Public booking (allowed business)**
   - Use booking link for an allowed business
   - Verify public booking page loads normally
   - Verify booking submission works
   - **Important:** Public booking routes are NOT restricted by pilot mode

---

## 3) Monitoring (First 72 Hours)

### Key Endpoints to Monitor

Watch these endpoints for errors and response times:

1. **Health Check**
   - `GET /api/obd-scheduler/health`
   - Expected: `200` with `{ ok: true, scheduler: "up" }`
   - Alert if: `503` (DB_UNAVAILABLE) or `500` errors

2. **Public Context**
   - `GET /api/obd-scheduler/public/context?bookingKey=...`
   - Expected: `200` with booking context
   - Alert if: `503` (DB_UNAVAILABLE) or `404` (invalid bookingKey)

3. **Slots**
   - `GET /api/obd-scheduler/slots?bookingKey=...&date=...&serviceId=...`
   - Expected: `200` with available slots
   - Alert if: `503` (DB_UNAVAILABLE) or `400` (validation errors)

4. **Requests**
   - `GET /api/obd-scheduler/requests`
   - `POST /api/obd-scheduler/requests`
   - Expected: `200` with requests data or success
   - Alert if: `503` (DB_UNAVAILABLE), `403` (PILOT_ONLY), or `500` errors

### Error Codes to Watch

Monitor logs for these error codes:

- **`DB_UNAVAILABLE`** (HTTP 503)
  - Indicates `DATABASE_URL` is missing or database is unreachable
  - Action: Check database connection and env vars

- **`PILOT_ONLY`** (HTTP 403)
  - Indicates business is not in pilot allowlist
  - Action: Normal for non-pilot businesses; add to allowlist if needed

- **`INVALID_BOOKING_KEY`** (HTTP 404)
  - Indicates invalid or expired booking link
  - Action: Normal for invalid links; verify bookingKey format if frequent

- **`INVALID_SERVICE`** (HTTP 400)
  - Indicates service not found or inactive
  - Action: Verify service exists and is active

- **`DUPLICATE_SUBMISSION_BLOCKED`** (HTTP 200 with warning)
  - Indicates duplicate booking request detected
  - Action: Normal behavior; no action needed

### Expected Benign Logs

These logs are expected and do not require action:

- **`AbortError`** during rapid date/service changes on public booking page
  - Normal: Client-side request cancellation when user changes inputs quickly
  - No action needed

- **`INVALID_BOOKING_KEY`** events for invalid booking links
  - Normal: Users may try invalid or expired links
  - No action needed unless frequency is unusually high

---

## 4) Rollback Plan

### Immediate Admin Shutdown

If issues occur with the admin dashboard or API routes:

1. **Enable pilot mode with empty allowlist** (fail-safe deny):
   ```bash
   OBD_SCHEDULER_PILOT_MODE="true"
   OBD_SCHEDULER_PILOT_BUSINESS_IDS=""
   ```
   This will deny all admin access while keeping public booking functional.

2. **Verify shutdown**:
   - All businesses see pilot message when accessing `/apps/obd-scheduler`
   - All admin API routes return `403` with code `"PILOT_ONLY"`
   - Public booking pages remain functional (not affected by pilot mode)

### Full Feature Pause

If a complete pause is needed:

1. **Hide Scheduler entry points in UI** (manual step)
   - Remove or hide navigation links to `/apps/obd-scheduler`
   - This prevents new users from discovering the feature

2. **Leave public booking links intact** (if needed)
   - Public booking routes are independent of admin access
   - Existing booking links will continue to work
   - Consider adding a maintenance message if needed

3. **Monitor public booking usage**
   - If public booking must be disabled, add a maintenance check in the public booking page component

---

## 5) Support Response Snippets

Use these exact phrases when responding to support requests.

### Business: "I can't access Scheduler"

**Response:**
> Scheduler is currently in a pilot rollout. Your account will be enabled soon. If you need access sooner, please contact support.

**When to use:**
- Business sees pilot message on admin dashboard
- Business receives `403` error with code `"PILOT_ONLY"` from API

**Next steps:**
- If business should have access, add their business ID to `OBD_SCHEDULER_PILOT_BUSINESS_IDS`
- If business should wait, confirm they're on the rollout list

---

### Customer: "Booking page says temporarily unavailable"

**Response:**
> Booking is temporarily unavailable right now. Please try again in a few minutes or contact the business directly for assistance.

**When to use:**
- Customer sees "Booking is temporarily unavailable" message
- Customer receives `503` error with code `"DB_UNAVAILABLE"`

**Next steps:**
- Check `/api/obd-scheduler/health` endpoint
- Verify `DATABASE_URL` is set correctly
- Check database connection status
- Review error logs for root cause

---

### Business: "What happens after a customer submits a request?"

**Response:**
> When a customer submits a booking request, you'll see it in your Scheduler dashboard where you can approve or follow up. You'll receive email notifications for new requests, and you can manage all requests from the Requests tab in your dashboard.

**When to use:**
- Business asks about the booking workflow
- Business wants to understand request management

**Additional context:**
- Requests appear in the "Needs Action" view by default
- Businesses can filter by status (needs-action, upcoming, completed, etc.)
- Businesses can approve, decline, or propose alternative times

---

### Business: "I don't see my booking requests"

**Response:**
> Please check the following:
> 1. Make sure you're logged in to the correct account
> 2. Check the "All" view in the Requests tab to see all requests
> 3. Verify your public booking link is active in the Settings tab
> 
> If requests still don't appear, please contact support with your business ID.

**When to use:**
- Business reports missing requests
- Business can't find submitted bookings

**Next steps:**
- Verify business ID matches the booking requests' `businessId`
- Check database for requests with that `businessId`
- Verify booking link is active and matches the business

---

### Customer: "I submitted a booking but didn't get confirmation"

**Response:**
> Your booking request has been submitted successfully. The business will review your request and follow up with you. If you need to contact them directly, please use the contact information on their booking page.

**When to use:**
- Customer reports no confirmation email
- Customer is unsure if booking was submitted

**Additional context:**
- V1 includes email notifications, but delivery may vary
- Customer should see a success message on the booking page after submission
- Business will see the request in their dashboard

---

## 6) Post-Launch (After 72 Hours)

### Review Metrics

After the first 72 hours, review:

1. **Error rates**
   - Check frequency of `DB_UNAVAILABLE` errors
   - Check frequency of `PILOT_ONLY` errors (expected for non-pilot businesses)
   - Check frequency of `INVALID_BOOKING_KEY` errors

2. **Usage patterns**
   - Number of booking requests submitted
   - Number of businesses actively using Scheduler
   - Public booking page load times

3. **Support requests**
   - Categorize support issues
   - Identify common questions or problems
   - Update support snippets if needed

### Gradual Rollout

If pilot is successful:

1. **Expand allowlist gradually**
   - Add 5–10 businesses at a time
   - Monitor error rates after each expansion
   - Wait 24–48 hours between expansions

2. **Remove pilot restrictions** (when ready for full launch)
   - Set `OBD_SCHEDULER_PILOT_MODE="false"` or remove the env var
   - All businesses will have access
   - V1 Scope Banner will no longer show "Pilot rollout is in progress."

---

## Quick Reference

### Environment Variables
- `DATABASE_URL` — Required for all Scheduler functionality
- `OBD_SCHEDULER_PILOT_MODE` — Set to `"true"` or `"1"` to enable pilot restrictions
- `OBD_SCHEDULER_PILOT_BUSINESS_IDS` — Comma-separated list of allowed business IDs

### Key Endpoints
- `GET /api/obd-scheduler/health` — Health check
- `GET /api/obd-scheduler/public/context` — Public booking context
- `GET /api/obd-scheduler/slots` — Available booking slots
- `GET /api/obd-scheduler/requests` — List booking requests (admin)
- `POST /api/obd-scheduler/requests` — Create booking request

### Error Codes
- `DB_UNAVAILABLE` (503) — Database unavailable
- `PILOT_ONLY` (403) — Business not in pilot allowlist
- `INVALID_BOOKING_KEY` (404) — Invalid booking link
- `INVALID_SERVICE` (400) — Service not found or inactive

---

**Last Updated:** V1 Launch
**Maintained By:** OBD Operations Team

