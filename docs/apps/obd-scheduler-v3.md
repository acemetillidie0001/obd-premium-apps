# OBD Scheduler & Booking V3 Documentation

## Overview

OBD Scheduler & Booking (V3) is a request-based booking system for OBD Premium Apps. This is **NOT** a real-time calendar sync system. Instead, customers submit booking requests, business owners review and respond (approve/decline/propose time), and the system sends email notifications.

## Recent Improvements (Tiers 5.4-5.7)

### Dashboard Enhancements (Tier 5.7)
- **Smart Views & Saved Filters**: Filter requests by status (Needs Action, Upcoming, Past Due, Completed, Declined, All). Your selected view is automatically saved and restored when you return.
- **Sorting Controls**: Sort by newest/oldest, appointment time, or recently updated
- **Request Detail Layout Polish**: Improved request detail view with status indicators, organized sections, and clearer action buttons
- **Bulk Actions**: Select multiple requests and decline them at once
- **Archive/Hide**: Archive completed requests to keep your dashboard clean
- **CSV Export**: Download all visible requests as a CSV file for reporting

### Public Booking Improvements (Tier 5.6)
- **Clean Booking URLs**: New `/book/[bookingKey]` format for simpler, shareable links
- **Service Selection**: Customers can choose from your active services when booking
- **Time Normalization**: Preferred times automatically round to 15-minute increments
- **Rate Limiting**: Enhanced spam protection for public booking forms

### CRM Integration (Tier 5.5)
- **Automatic Contact Sync**: Booking requests automatically create or update CRM contacts
- **Activity Tracking**: Each booking request generates a CRM activity note with full details

### SMS Notifications (Tier 5.4)
- **SMS Alerts**: Customers receive SMS confirmations when booking requests are received (if phone number provided)
- **Quiet Hours**: SMS sending respects quiet hours (9pm-8am by default)
- **Rate Limiting**: SMS sending is rate-limited to prevent spam

## V3 Principle

**REQUEST-BASED BOOKING** - This is the core principle of V3:

- Users submit booking requests
- Owners approve/decline/propose a time
- System sends email notifications
- **NO** live slot locking
- **NO** calendar sync
- **NO** payments
- **NO** SMS
- **NO** staff scheduling

**Note:** SMS notifications (Tier 5.4) were added after initial V3 release.

## Data Model

### BookingService

Represents a bookable service offered by the business.

```typescript
{
  id: string;
  businessId: string;
  name: string;
  durationMinutes: number;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### BookingSettings

Business-level booking configuration.

```typescript
{
  id: string;
  businessId: string;
  timezone: string; // Default: "America/New_York"
  bufferMinutes: number; // Default: 15
  minNoticeHours: number; // Default: 24
  maxDaysOut: number; // Default: 90
  policyText: string | null;
  bookingKey: string; // Random key for public booking link
  createdAt: string;
  updatedAt: string;
}
```

### BookingRequest

A customer booking request.

```typescript
{
  id: string;
  businessId: string;
  serviceId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  preferredStart: string | null; // ISO datetime
  preferredEnd: string | null; // ISO datetime
  message: string | null;
  status: BookingStatus;
  proposedStart: string | null; // ISO datetime (set by owner)
  proposedEnd: string | null; // ISO datetime (set by owner)
  internalNotes: string | null; // Owner-only notes
  createdAt: string;
  updatedAt: string;
  service?: BookingService | null;
}
```

### BookingStatus Enum

```typescript
enum BookingStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  DECLINED = "DECLINED",
  PROPOSED_TIME = "PROPOSED_TIME",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED",
}
```

## Status Flow

```
REQUESTED
  ├─> APPROVED ──> COMPLETED
  ├─> DECLINED (terminal)
  ├─> PROPOSED_TIME
  │     ├─> APPROVED ──> COMPLETED
  │     ├─> DECLINED (terminal)
  │     └─> CANCELED (terminal)
  └─> CANCELED (terminal)
```

### Valid Status Transitions

- `REQUESTED` → `APPROVED`, `DECLINED`, `PROPOSED_TIME`, `CANCELED`
- `PROPOSED_TIME` → `APPROVED`, `DECLINED`, `CANCELED`
- `APPROVED` → `COMPLETED`, `CANCELED`
- `DECLINED`, `COMPLETED`, `CANCELED` are terminal states

## Public Booking Link Strategy

### BookingKey

Each business has a unique `bookingKey` stored in `BookingSettings`. This is a random 64-character hex string generated on first creation.

### Public Booking URL

```
/apps/obd-scheduler/public?key={bookingKey}
```

### Security

- The `bookingKey` is not easily guessable (64 hex characters = 256 bits of entropy)
- Public form requires `bookingKey` query parameter
- Business owners can regenerate the key by updating settings (future enhancement)

## Email Notification Templates

### Request Received

Sent to business owner when a new booking request is submitted.

**Status**: Not implemented in V3 (requires business owner email lookup)

### Request Approved

Sent to customer when their booking request is approved.

**Template**: `sendRequestApprovedEmail()`

### Request Declined

Sent to customer when their booking request is declined.

**Template**: `sendRequestDeclinedEmail()`

### Proposed Time

Sent to customer when business owner proposes a new time.

**Template**: `sendProposedTimeEmail()`

**Requirements**: `proposedStart` and `proposedEnd` must be set

### Booking Completed

Sent to customer when booking is marked as completed.

**Template**: `sendBookingCompletedEmail()`

## API Routes

### Requests

- `GET /api/obd-scheduler/requests` - List requests (scoped to business)
- `POST /api/obd-scheduler/requests` - Create request (public or authenticated)
- `GET /api/obd-scheduler/requests/[id]` - Get one request
- `PATCH /api/obd-scheduler/requests/[id]` - Update request status
- `DELETE /api/obd-scheduler/requests/[id]` - Delete request (admin only)

### Services

- `GET /api/obd-scheduler/services` - List services (scoped to business)
- `POST /api/obd-scheduler/services` - Create service
- `PATCH /api/obd-scheduler/services/[id]` - Update service
- `DELETE /api/obd-scheduler/services/[id]` - Delete service

### Settings

- `GET /api/obd-scheduler/settings` - Get booking settings (creates default if not exists)
- `POST /api/obd-scheduler/settings` - Save booking settings (upsert)
- `PATCH /api/obd-scheduler/settings` - Alias for POST

## Business Scoping

**CRITICAL**: Every query must be tenant-scoped to the current business.

In V3, `businessId = userId` (one user = one business).

```typescript
const user = await getCurrentUser();
const businessId = user.id; // V3: userId = businessId
```

All database queries must include:

```typescript
where: {
  businessId,
  // ... other filters
}
```

## Validation Rules

### Booking Request

- `customerName`: Required, 1-200 characters
- `customerEmail`: Required, valid email format
- `customerPhone`: Optional, max 50 characters
- `preferredStart` / `preferredEnd`: If both provided, `preferredEnd > preferredStart`

### Service

- `name`: Required, 1-200 characters
- `durationMinutes`: Required, 1-1440 (max 24 hours)
- `description`: Optional, max 2000 characters
- `active`: Boolean, default true

### Settings

- `timezone`: String, max 100 characters
- `bufferMinutes`: Integer, 0-1440
- `minNoticeHours`: Integer, 0-168 (max 1 week)
- `maxDaysOut`: Integer, 1-365
- `policyText`: Optional, max 5000 characters

## UI/UX Requirements

### Requests Tab

- Table/list with: Customer, Service, Preferred Window, Status, Created, Actions
- Actions per status:
  - `REQUESTED`: Approve, Decline, Propose New Time
  - `APPROVED`: Mark Complete
  - `PROPOSED_TIME`: Approve, Decline
- Detail drawer/modal showing full request + internal notes
- Filter by status

### Services Tab

- List of services with name, duration, description, active status
- Add/Edit service modal
- Toggle active/inactive
- Delete service (only if no active requests)

### Availability Tab

- Timezone selector
- Buffer minutes
- Min notice hours
- Max days out
- Business hours (future enhancement)

### Settings Tab

- Booking policies textarea
- Show "Public Booking Link" + copy button (uses bookingKey)
- Notification preferences (future enhancement)

## Empty States

All tabs should show helpful empty states:

- **Requests**: "No booking requests found."
- **Services**: "No services found. Add your first service to get started."
- **Availability**: Show default values
- **Settings**: Show default values

## Loading States

All data fetching should show loading indicators:

- "Loading requests..."
- "Loading services..."
- "Loading settings..."

## Error Handling

All API calls should handle errors gracefully:

- Show user-friendly error messages
- Log errors to console for debugging
- Use standardized error response format: `{ ok: false, error: string, code: string }`

## V4 Roadmap

Future enhancements planned for V4:

1. **Calendar Sync**
   - Google Calendar integration
   - Outlook Calendar integration
   - Real-time availability checking

2. **Payments**
   - Stripe integration
   - Deposit requirements
   - Full payment at booking

3. **SMS Notifications**
   - Twilio integration
   - SMS reminders
   - SMS confirmations

4. **Staff Scheduling**
   - Multiple staff members
   - Staff availability
   - Staff assignment

5. **Embed Widget**
   - Embeddable booking form
   - Customizable styling
   - Website integration

6. **Live Slot Locking**
   - Real-time availability
   - Slot reservation
   - Conflict prevention

## Migration Notes

### Prisma Migration

After adding the models to `schema.prisma`, run:

```bash
npx prisma migrate dev --name add_obd_scheduler_models
```

Or for production:

```bash
npx prisma migrate deploy
```

### Database / Migration Notes (V3.1)

**V3.1 Upgrade #3 - notificationEmail field:**

The `notificationEmail` field was added to `BookingSettings` model in V3.1.

**P3018 Migration Error Resolution:**

On initial production deployment, the migration `20260101002629_add_booking_settings_notification_email` failed with error:
- **Error**: `P3018 / 42701: column "notificationEmail" already exists on "BookingSettings"`
- **Cause**: The column was added to production via `prisma db push` during local development/testing, but Prisma's migration tracking table (`_prisma_migrations`) did not have a record of the migration being applied.
- **Resolution**: Used `npx prisma migrate resolve --applied 20260101002629_add_booking_settings_notification_email` to mark the migration as applied without running the SQL (since the column already existed).
- **Result**: Migration tracking is now in sync with the actual database state. No schema rollback occurred - the column remained intact.
- **Verification**: After resolving, `npx prisma migrate deploy` completed successfully with "No pending migrations to apply."

**Local Development:**
- If `npx prisma migrate dev` fails due to shadow database issues, use:
  ```bash
  npx prisma db push
  npx prisma generate
  ```
  ⚠️ **Note**: `db push` is safe for local development only. Do NOT use in production.

**Production:**
- Use standard migration workflow:
  ```bash
  npx prisma migrate deploy
  ```

**Schema Change:**
- Field: `notificationEmail String?` (nullable, optional)
- Default: `null`
- Purpose: Email address for booking request notifications

**Production Migration Procedure:**

**Migration Deployment Method:** This repo uses **automated migrations via Vercel CI/CD**. The `vercel-build` script (defined in `package.json`) automatically runs `prisma:generate && prisma:migrate:deploy && build` during deployment.

**Step-by-Step Production Checklist:**

1. **Pre-Deploy: Verify Schema Change**
   - [ ] Confirm `notificationEmail` field exists in `prisma/schema.prisma`
   - [ ] Field should be: `notificationEmail String?` (nullable, optional)
   - Command: `grep -A 2 "notificationEmail" prisma/schema.prisma`

2. **Pre-Deploy: Create Migration File (If Needed)**
   - [ ] Check if migration file exists: `prisma/migrations/*add_notification_email_to_booking_settings*/migration.sql`
   - [ ] If missing, create it (since local dev used `db push`):
     ```bash
     npx prisma migrate dev --name add_notification_email_to_booking_settings --create-only
     ```
   - [ ] Review migration file - should contain:
     ```sql
     ALTER TABLE "BookingSettings" ADD COLUMN "notificationEmail" TEXT;
     ```

3. **Deploy to Production**
   - [ ] Commit and push code to `main` branch
   - [ ] Vercel automatically triggers deployment
   - [ ] Migration runs automatically during build via `vercel-build` script:
     - Runs: `pnpm run prisma:generate && pnpm run prisma:migrate:deploy && pnpm run build`
     - Migration applies before build completes

4. **Post-Deploy: Verify Migration Applied**
   - [ ] Check Vercel build logs - verify migration step completed successfully
   - [ ] Verify migration status (optional, requires DATABASE_URL):
     ```bash
     # Set production DATABASE_URL
     $env:DATABASE_URL="your-production-database-url"
     npx prisma migrate status
     # Should show all migrations as applied
     ```
   - [ ] Verify column exists (optional, via Prisma Studio):
     ```bash
     npx prisma studio
     # Navigate to BookingSettings table, verify notificationEmail column exists
     ```

5. **Post-Deploy: Smoke Tests**
   - [ ] Navigate to OBD Scheduler & Booking app (`/apps/obd-scheduler`)
   - [ ] Go to Settings tab
   - [ ] Verify "Notification Email" input field is visible
   - [ ] Enter a test email and save settings
   - [ ] Verify settings save successfully (no errors in UI or console)
   - [ ] Create a test booking request via public form (`/book/{bookingKey}`)
   - [ ] Verify booking request is created successfully
   - [ ] Verify customer receives confirmation email
   - [ ] Verify business receives notification email (if notificationEmail was set)
   - [ ] Check Vercel function logs for any errors

**Manual Migration (If Needed):**

If automated migration fails or you need to run manually:

1. Set production DATABASE_URL:
   ```powershell
   $env:DATABASE_URL="your-production-database-url"
   ```

2. Run migration:
   ```bash
   npm run migrate:deploy
   # or
   npx prisma migrate deploy
   ```

3. Verify:
   ```bash
   npx prisma migrate status
   ```

**Rollback Plan:**

If migration causes issues (unlikely - field is nullable/optional):

1. The field is optional, so existing functionality will continue to work
2. To remove the column manually (if needed):
   ```sql
   ALTER TABLE "BookingSettings" DROP COLUMN "notificationEmail";
   ```
3. Revert code changes and redeploy

**Safety Notes:**

- Field is **nullable/optional** - safe to add to existing tables
- No data loss risk - existing records will have `null` value
- Backward compatible - code handles missing field gracefully
- Migration is **non-breaking** - existing functionality continues to work

### Database Indexes

The schema includes indexes for:
- `businessId` on all models
- `status` on `BookingRequest`
- `bookingKey` on `BookingSettings`
- Composite indexes for common query patterns

### Default Settings

When a business first accesses settings, default values are created:
- `timezone`: "America/New_York"
- `bufferMinutes`: 15
- `minNoticeHours`: 24
- `maxDaysOut`: 90
- `bookingKey`: Random 64-character hex string

## Testing

### Manual Testing Checklist

- [ ] Create a service
- [ ] Edit a service
- [ ] Delete a service (with and without active requests)
- [ ] Submit a booking request (public form)
- [ ] Submit a booking request (authenticated)
- [ ] View booking requests list
- [ ] Filter requests by status
- [ ] View request details
- [ ] Approve a request
- [ ] Decline a request
- [ ] Propose a new time
- [ ] Mark request as completed
- [ ] Add internal notes
- [ ] Update availability settings
- [ ] Update booking policies
- [ ] Copy public booking link
- [ ] Test public booking form with valid key
- [ ] Test public booking form with invalid key
- [ ] Verify email notifications are sent

## V3.1 Upgrades Verification

### V3.1 Upgrade #1 Verification

### Clean Public Booking Route

✅ **Verified**: The following items have been checked and confirmed:

- [x] **New route `/book/[bookingKey]`**:
  - Valid `bookingKey` loads business context and services correctly
  - Invalid `bookingKey` shows friendly error message
  - Form submission succeeds and displays success state
  - Page includes service selection dropdown when services exist

- [x] **Layout metadata**:
  - `src/app/book/[bookingKey]/layout.tsx` sets `robots: { index: false, follow: false }`
  - Page is properly excluded from search engine indexing

- [x] **Legacy route compatibility**:
  - `/apps/obd-scheduler/public?key=...` still works
  - Legacy route displays note with link to new clean URL format

- [x] **Settings tab**:
  - Public Booking Link displays as `https://apps.ocalabusinessdirectory.com/book/{bookingKey}`
  - Copy button successfully copies link to clipboard
  - Test Link button opens `/book/{bookingKey}` in new tab

- [x] **API endpoint**:
  - `/api/obd-scheduler/public/context` validates bookingKey format
  - Returns `ok: false` with appropriate error code for invalid keys
  - Returns business context and active services for valid keys

### Manual QA Checklist

- [ ] Navigate to `/book/{validBookingKey}` - form loads correctly
- [ ] Navigate to `/book/{invalidKey}` - shows error message
- [ ] Submit booking request via new route - success state appears
- [ ] Test legacy route `/apps/obd-scheduler/public?key=...` - still works
- [ ] Verify Settings tab displays clean URL format
- [ ] Test Copy button - link copies to clipboard
- [ ] Test Test Link button - opens in new tab
- [ ] Verify noindex metadata in page source (robots meta tag)

### V3.1 Upgrade #2 Verification

✅ **Verified**: Service selection in public booking forms

- [x] **Public pages load services**:
  - `/book/[bookingKey]` loads services via `/api/obd-scheduler/public/context?key=...`
  - `/apps/obd-scheduler/public?key=...` loads services via same endpoint
  - Services loaded in `useEffect` on component mount

- [x] **Service dropdown behavior**:
  - Dropdown only visible when `services.length > 0` (conditional rendering)
  - Service selection is optional (form works without services)
  - Dropdown shows service name and duration: `{name} ({durationMinutes} min)`
  - Form submission works whether service is selected or not

- [x] **Server-side validation**:
  - POST `/api/obd-scheduler/requests` validates `serviceId` if provided
  - Checks service belongs to resolved `businessId` (via bookingKey lookup)
  - Checks service is `active: true`
  - Returns `400` status with code `INVALID_SERVICE` for invalid services
  - Error message: "Service not found or inactive"

- [x] **Tenant safety**:
  - No `businessId` accepted in public requests (only `bookingKey`)
  - `CreateBookingRequestRequest` interface only includes `bookingKey` (no businessId)
  - Server resolves `businessId` from `bookingKey` via `BookingSettings` lookup
  - Service validation scoped to resolved `businessId`

- [x] **UX polish**:
  - Submit button disabled during `loading` state (while services fetch)
  - Submit button disabled during `submitting` state (during form submission)
  - Loading state shows "Loading..." text
  - Server validation errors displayed in error panel above submit button
  - Form gracefully handles service loading failures (form still works)

### Manual QA Checklist (V3.1 Upgrade #2)

- [ ] Navigate to `/book/{validKey}` with services - dropdown appears
- [ ] Navigate to `/book/{validKey}` without services - no dropdown, form works
- [ ] Select a service and submit - booking created with serviceId
- [ ] Submit without selecting service - booking created without serviceId
- [ ] Submit with invalid serviceId (modified in devtools) - shows INVALID_SERVICE error
- [ ] Verify legacy route also shows service dropdown when services exist
- [ ] Test form submission while services are loading - button disabled
- [ ] Verify server returns 400 with INVALID_SERVICE code for invalid service

### V3.1 Upgrade #3 Verification

✅ **Verified**: Request received email notifications

- [x] **BookingSettings.notificationEmail field**:
  - Present in `BookingSettings` interface as `notificationEmail: string | null`
  - Included in `UpdateBookingSettingsRequest` interface
  - Validated in settings API with Zod schema: `z.string().email("Invalid email format").optional().nullable()`
  - Editable in Settings UI with email input field
  - Help text: "Where booking request alerts should be sent."

- [x] **Non-blocking email sending**:
  - Customer confirmation email always attempted (wrapped in try-catch)
  - Business notification email only sent if `notificationEmail` exists
  - All email sending failures wrapped in try-catch blocks
  - Request creation always succeeds even if emails fail
  - Error logging includes requestId and businessId for debugging

- [x] **Business name resolution**:
  - Attempts to fetch `businessName` from `BrandProfile` table
  - Falls back to `"Business"` if BrandProfile lookup fails or name is missing
  - Resolution wrapped in try-catch (non-blocking)

- [x] **Observability and logging**:
  - Warning logged when `notificationEmail` is not configured (includes businessId and requestId)
  - Email send failures log error message with requestId and businessId
  - All logging uses consistent `[OBD Scheduler]` prefix
  - No email failures will crash request creation

- [x] **Settings API behavior**:
  - GET returns `notificationEmail` in settings response
  - POST/PATCH accepts `notificationEmail` in request body
  - Email format validated before saving
  - Null/empty values allowed (field is optional)

### Email Notifications (V3.1)

#### Configuration

To receive booking request notifications:

1. Navigate to the **Settings** tab in OBD Scheduler & Booking
2. Enter your email address in the **Notification Email** field
3. Click **Save Settings**
4. All new booking requests will trigger email notifications to this address

**Note**: The notification email field is optional. Booking requests will still be created successfully even if no notification email is configured. However, you will only receive email alerts if a notification email is set.

#### Expected Behavior

**When a booking request is created:**

1. **Customer Confirmation Email** (Always sent):
   - Sent to the customer's email address (`customerEmail`)
   - Subject: "Booking Request Received - {businessName}"
   - Confirms the request was received
   - Includes service details (if selected) and preferred time window

2. **Business Notification Email** (Only if `notificationEmail` is configured):
   - Sent to the email address in BookingSettings.notificationEmail
   - Subject: "New Booking Request Received - {businessName}"
   - Contains full request details including customer info, service, preferred times, and message
   - Includes link to log in to OBD dashboard

**Error Handling:**

- All email sending is **non-blocking** - booking requests are created successfully even if emails fail
- Email failures are logged to the server console with requestId for debugging
- If `notificationEmail` is not configured, a warning is logged but the request still succeeds
- Customer confirmation email failures are logged but don't prevent request creation

**Business Name Resolution:**

- System attempts to use `businessName` from BrandProfile
- Falls back to "Business" if BrandProfile is not available
- Resolution failures are non-blocking (request still succeeds)

### Manual QA Checklist (V3.1 Upgrade #3)

- [ ] Create booking request with notificationEmail configured - both emails sent
- [ ] Create booking request without notificationEmail - customer email sent, warning logged
- [ ] Verify customer receives confirmation email
- [ ] Verify business receives notification email (when configured)
- [ ] Check server logs for email failures (should include requestId)
- [ ] Check server logs for missing notificationEmail warning
- [ ] Verify request creation succeeds even if email sending fails
- [ ] Test with invalid email format in settings - validation error shown
- [ ] Test with valid email format - saves successfully
- [ ] Verify businessName appears correctly in emails (from BrandProfile or fallback)

## Known Limitations (V3)

1. ~~**No business owner email lookup**: Request received notifications are not sent (requires User table lookup)~~ ✅ **Fixed in V3.1 Upgrade #3**
2. ~~**No service selection in public form**: Services are not loaded in public form (requires endpoint enhancement)~~ ✅ **Fixed in V3.1 Upgrade #2**
3. **No business hours UI**: Availability tab only shows basic settings
4. **No calendar view**: Requests are shown in list format only
5. **No email templates customization**: Email templates are hardcoded

## Support

For issues or questions, contact the OBD development team.

