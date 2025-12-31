# OBD CRM Documentation

## V3.1 Complete ✅

OBD CRM (V3.1) is **production-ready and LIVE** as part of the OBD Business Suite. It provides comprehensive contact management, notes, activities, follow-up tracking, and premium UX features for local businesses.

### What It Does

OBD CRM is the customer relationship hub inside the OBD Business Suite, providing a unified view of customer interactions across all OBD apps.

**Core Features:**
- **Contacts Management:** Create, update, and manage customer contacts with name, email, phone, company, address
- **Status Tracking:** Track contacts as Lead, Active, Past, or DoNotContact
- **Tagging System:** Many-to-many tags for flexible contact organization
- **Notes:** Add timestamped notes to track customer relationships (implemented via activity type "note")
- **Activities:** Typed activity timeline (CALL, EMAIL, TEXT, MEETING, TASK, OTHER) with summary and optional occurredAt
- **Last Touch Indicator:** Shows most recent activity or note time in contacts list with live updates
- **Next Follow-Up:** Set follow-up dates per contact with optional notes, filters (Due Today, Overdue, Upcoming), badges, snooze (1 day/1 week), quick set buttons (Tomorrow, Next week, Next month), and inline confirmations
- **Follow-Up Counters:** Summary strip showing Overdue/Today/Upcoming counts (clickable to filter)
- **Queue View:** Toggle between Table and Queue views; Queue groups contacts by follow-up urgency (Overdue, Due Today, Upcoming)
- **Search & Filters:** Search by name/email/phone, filter by status, tags, or follow-up status
- **CSV Import/Export:** Import contacts from CSV with column mapping, export filtered contacts
- **Premium UX Polish:** Sticky table header, density toggle (Comfortable/Compact), row quick actions (copy email/phone, open detail), status/tag chips with overflow, skeleton loaders, mobile FAB, drawer animations, tooltips, ESC to close, click outside to close
- **Integrations:** Seamless handoff to Review Request Automation, AI Help Desk, Social Auto-Poster, and Offers Builder with context preservation and return navigation

### What It Does NOT Do (V3 Guardrails)

- ❌ Pipelines/deals
- ❌ Automations
- ❌ Email sync
- ❌ SMS integration
- ❌ Calendar sync

### Migration Commands

Before deploying, run these commands:

```bash
# 1. Create and apply migration
npx prisma migrate dev --name add_obd_crm_models

# 2. Generate Prisma Client (required for TypeScript)
npx prisma generate

# 3. Verify build passes
npm run build
```

**Note:** The build will fail until `npx prisma generate` is run after migration.

### Smoke Test Checklist

See [`docs/releases/obd-crm-v3-release-checklist.md`](../releases/obd-crm-v3-release-checklist.md) for detailed testing steps.

---

## Production Stabilization Note

**Status:** ✅ **STABLE AND PRODUCTION-READY**

OBD CRM V3 has been verified, tested, and is fully operational in production. All core functionality is stable and ready for use.

### Integrated Applications

The following applications are integrated with OBD CRM V3:

- ✅ **Review Request Automation**
  - Automatically creates/updates contacts when review requests are sent
  - Adds activity notes and applies "Review Request" tags
  - Tracks review confirmations with "Review Received" tags

- ✅ **AI Help Desk**
  - Automatically creates contacts from help desk ticket interactions
  - Adds activity notes and applies "Support" and "Help Desk" tags
  - Scoped to business for proper data isolation

### Deferred Integrations

- ⏸️ **Scheduler Integration**
  - Integration is deferred to a future release
  - Service module supports scheduler integration when ready
  - No blocker for current production use

### Production Readiness

- All migrations applied and verified
- Prisma client generated and models available
- API endpoints tested and stable
- UI components functional with error handling
- Database connectivity verified
- Dev self-test helpers in place for troubleshooting

---

## Overview

OBD CRM (V3) is a production-ready CRM experience for local businesses, built as part of the OBD Business Suite. It provides contact management, notes, tagging, and CSV export capabilities.

**Important Naming:**
- The app name everywhere in the UI is **"OBD CRM"** (do NOT call it "Lite" in the product).
- Internally the scope can be "CRM Lite," but users only see "OBD CRM."

## V3 Scope

### Included Features

1. **Contacts Management**
   - Create, read, update, and delete contacts
   - Contact fields: name (required), email, phone, company, address
   - Status tracking: Lead, Active, Past, DoNotContact
   - Source tracking: manual, scheduler, reviews, helpdesk, import

2. **Tagging System**
   - Many-to-many relationship between contacts and tags
   - Create, list, and delete tags
   - Tags can be filtered in contact list

3. **Notes & Activity Timeline**
   - Add notes to contacts
   - View activity timeline (V3 shows notes only, but structure supports future activity types)
   - Notes are timestamped and ordered by creation date (newest first)

4. **Search & Filtering**
   - Search by name, email, or phone
   - Filter by status
   - Filter by tag (single tag filter in V3)

5. **CSV Export**
   - Export contacts with current filters/search applied
   - CSV includes: name, email, phone, status, tags, source, company, address, createdAt, updatedAt
   - Filename format: `obd-crm-contacts-YYYY-MM-DD.csv`

### Out of Scope (DO NOT BUILD)

- Pipelines/deals
- Automations
- Email sync
- SMS
- Calendar sync

## Data Models

### CrmContact

```typescript
interface CrmContact {
  id: string;
  businessId: string; // Scoped to user (userId = businessId in V3)
  name: string; // Required, min 2 characters
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  status: CrmContactStatus; // Lead | Active | Past | DoNotContact
  source: CrmContactSource; // manual | scheduler | reviews | helpdesk | import
  tags: CrmTag[]; // Many-to-many relationship
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}
```

### CrmTag

```typescript
interface CrmTag {
  id: string;
  businessId: string; // Scoped to user
  name: string; // Unique per business
  color: string | null; // Optional color for UI display
  createdAt: string;
  updatedAt: string;
}
```

### CrmContactActivity

```typescript
interface CrmContactActivity {
  id: string;
  contactId: string;
  businessId: string;
  type: "note"; // V3 supports "note" only, structure supports future types
  content: string;
  createdAt: string;
  updatedAt: string;
}
```

## API Endpoints

All API routes require premium access and are scoped to the authenticated user's business (businessId = userId in V3).

### Contacts

#### GET /api/obd-crm/contacts

List contacts with optional search, filters, and pagination.

**Query Parameters:**
- `search` (optional): Search by name, email, or phone
- `status` (optional): Filter by status (Lead | Active | Past | DoNotContact)
- `tagId` (optional): Filter by tag ID
- `sort` (optional): Sort field (updatedAt | createdAt | name), default: updatedAt
- `order` (optional): Sort order (asc | desc), default: desc
- `page` (optional): Page number, default: 1
- `limit` (optional): Items per page, default: 50, max: 100

**Response:**
```json
{
  "ok": true,
  "data": {
    "contacts": [...],
    "total": 100,
    "page": 1,
    "limit": 50,
    "totalPages": 2
  }
}
```

#### POST /api/obd-crm/contacts

Create a new contact.

**Request Body:**
```json
{
  "name": "John Doe", // Required
  "email": "john@example.com", // Optional
  "phone": "555-1234", // Optional
  "company": "Acme Corp", // Optional
  "address": "123 Main St", // Optional
  "status": "Lead", // Optional, default: Lead
  "source": "manual", // Optional, default: manual
  "tagIds": ["tag1", "tag2"] // Optional
}
```

**Response:**
```json
{
  "ok": true,
  "data": { /* CrmContact */ }
}
```

#### GET /api/obd-crm/contacts/[id]

Get a single contact by ID.

**Response:**
```json
{
  "ok": true,
  "data": { /* CrmContact */ }
}
```

#### PATCH /api/obd-crm/contacts/[id]

Update a contact.

**Request Body:**
```json
{
  "name": "John Doe", // Optional
  "email": "john@example.com", // Optional
  "phone": "555-1234", // Optional
  "company": "Acme Corp", // Optional
  "address": "123 Main St", // Optional
  "status": "Active", // Optional
  "tagIds": ["tag1", "tag2"] // Optional, replaces all tags
}
```

**Response:**
```json
{
  "ok": true,
  "data": { /* CrmContact */ }
}
```

#### DELETE /api/obd-crm/contacts/[id]

Delete a contact (cascades to notes and tag relations).

**Response:**
```json
{
  "ok": true,
  "data": { "success": true }
}
```

### Notes

#### GET /api/obd-crm/contacts/[id]/notes

Get all notes for a contact.

**Response:**
```json
{
  "ok": true,
  "data": {
    "notes": [...], // Array of CrmContactActivity (type="note")
    "count": 10
  }
}
```

#### POST /api/obd-crm/contacts/[id]/notes

Add a note to a contact.

**Request Body:**
```json
{
  "content": "Had a great conversation about their project." // Required
}
```

**Response:**
```json
{
  "ok": true,
  "data": { /* CrmContactActivity */ }
}
```

### Tags

#### GET /api/obd-crm/tags

Get all tags for the business.

**Response:**
```json
{
  "ok": true,
  "data": {
    "tags": [...], // Array of CrmTag
    "count": 5
  }
}
```

#### POST /api/obd-crm/tags

Create a new tag.

**Request Body:**
```json
{
  "name": "VIP", // Required, unique per business
  "color": "#29c4a9" // Optional
}
```

**Response:**
```json
{
  "ok": true,
  "data": { /* CrmTag */ }
}
```

#### DELETE /api/obd-crm/tags?id=[tagId]

Delete a tag (cascades to contact tag relations).

**Response:**
```json
{
  "ok": true,
  "data": { "success": true }
}
```

#### POST /api/obd-crm/contacts/upsert

Upsert a contact (find by email/phone or create new). This endpoint is intended for integration with other OBD apps.

**Request Body:**
```json
{
  "name": "John Doe", // Required
  "email": "john@example.com", // Optional (at least email or phone required)
  "phone": "555-1234", // Optional (at least email or phone required)
  "source": "scheduler", // Required: manual | scheduler | reviews | helpdesk | import
  "tagNames": ["VIP", "Follow-up"], // Optional array of tag names (will be created if they don't exist)
  "company": "Acme Corp", // Optional
  "address": "123 Main St" // Optional
}
```

**Response:**
```json
{
  "ok": true,
  "data": { /* CrmContact */ }
}
```

**Behavior:**
- **Requires at least one identifier**: At least one of email or phone must be provided (returns validation error if both are missing)
- **Deduplication matching**:
  - Email: case-insensitive match (e.g., "John@Example.com" matches "john@example.com")
  - Phone: normalized digits match (strips all non-digits, e.g., "(555) 123-4567" matches "5551234567")
- If found, updates contact with new data (preserves existing fields if not provided)
- If not found, creates new contact with provided data
- **Tag normalization**: Tag names are trimmed, whitespace is collapsed to single spaces, and case-insensitive uniqueness is enforced (e.g., "VIP Customer" and "vip customer" are treated as the same tag)
- Tags are created automatically if they don't exist (by normalized name)
- Existing tags are preserved and merged with new tags (deterministic order, no duplicates)

### Export

#### POST /api/obd-crm/export

Export contacts as CSV with optional filters.

**Request Body:**
```json
{
  "search": "john", // Optional
  "status": "Active", // Optional
  "tagId": "tag1" // Optional
}
```

**Response:**
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="obd-crm-contacts-YYYY-MM-DD.csv"`
- CSV columns: name, email, phone, status, tags, source, company, address, createdAt, updatedAt

## Filters & Search Behavior

### Search

- Searches across name, email, and phone fields
- Case-insensitive, partial matching
- Applied to all listed contacts

### Status Filter

- Single-select dropdown
- Options: All Statuses, Lead, Active, Past, DoNotContact
- Filters contacts by exact status match

### Tag Filter

- Single-select dropdown (V3)
- Shows all tags for the business
- Filters contacts that have the selected tag

### Combined Filters

- All filters are AND-combined
- Search works within filtered results
- Export respects all active filters

## Integration Hooks

OBD CRM V3 provides a service module (`src/lib/apps/obd-crm/crmService.ts`) that other apps can use to integrate with CRM contacts. This allows apps like Scheduler, Help Desk, and Review Automation to automatically create and manage contacts.

### Service Module Functions

All service functions are business-scoped (require `businessId`) and do NOT include premium/rate-limit checks (callers should handle those at the API route level).

#### `findContactByEmailOrPhone({ businessId, email?, phone? })`

Find a contact by email or phone (or both) within a business scope.

```typescript
import { findContactByEmailOrPhone } from "@/lib/apps/obd-crm/crmService";

const contact = await findContactByEmailOrPhone({
  businessId: user.id,
  email: "john@example.com",
  phone: "555-1234",
});

// Returns CrmContact | null
```

#### `createContact({ businessId, name, email?, phone?, source, tags?, company?, address?, status? })`

Create a new contact.

```typescript
import { createContact } from "@/lib/apps/obd-crm/crmService";

const contact = await createContact({
  businessId: user.id,
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234",
  source: "helpdesk",
  tags: ["tag-id-1", "tag-id-2"], // Optional array of tag IDs
});
```

#### `upsertContactFromExternalSource({ businessId, source, name, email?, phone?, tagNames?, company?, address? })`

Upsert a contact from an external source. Finds existing contact by email/phone or creates a new one. Optionally creates/assigns tags by name.

**Important:**
- At least one of `email` or `phone` must be provided (throws error if both are missing)
- Phone matching uses normalized digits (strips all non-digits for comparison)
- Tag names are normalized (trimmed, whitespace collapsed, case-insensitive uniqueness)

```typescript
import { upsertContactFromExternalSource } from "@/lib/apps/obd-crm/crmService";

const contact = await upsertContactFromExternalSource({
  businessId: user.id,
  source: "scheduler",
  name: "Jane Smith",
  email: "jane@example.com",
  phone: "555-5678",
  tagNames: ["Appointment", "Follow-up"], // Tags created automatically if needed
});
```

#### `addActivityNote({ businessId, contactId, note, createdByUserId? })`

Add an activity note to a contact.

```typescript
import { addActivityNote } from "@/lib/apps/obd-crm/crmService";

const activity = await addActivityNote({
  businessId: user.id,
  contactId: "contact-id-123",
  note: "Customer called to reschedule appointment",
  createdByUserId: user.id, // Optional, for future tracking
});
```

### Integration Examples

#### Scheduler App Integration

When a customer books an appointment, the Scheduler app can automatically create or update a contact:

```typescript
// In scheduler API route
import { upsertContactFromExternalSource } from "@/lib/apps/obd-crm/crmService";
import { getCurrentUser } from "@/lib/premium";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const { customerName, customerEmail, customerPhone } = await request.json();

  // Upsert contact in CRM
  const contact = await upsertContactFromExternalSource({
    businessId: user.id,
    source: "scheduler",
    name: customerName,
    email: customerEmail,
    phone: customerPhone,
    tagNames: ["Appointment Booked"],
  });

  // Add note about the appointment
  await addActivityNote({
    businessId: user.id,
    contactId: contact.id,
    note: `Appointment scheduled for ${appointmentDate}`,
  });

  // Continue with appointment creation...
}
```

#### Help Desk App Integration

When a customer submits a help desk ticket, create a contact and log the interaction:

```typescript
// In helpdesk API route
import { upsertContactFromExternalSource, addActivityNote } from "@/lib/apps/obd-crm/crmService";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const { customerName, customerEmail, message } = await request.json();

  // Upsert contact
  const contact = await upsertContactFromExternalSource({
    businessId: user.id,
    source: "helpdesk",
    name: customerName,
    email: customerEmail,
    tagNames: ["Help Desk Ticket"],
  });

  // Add note with ticket details
  await addActivityNote({
    businessId: user.id,
    contactId: contact.id,
    note: `Help desk inquiry: ${message.substring(0, 200)}`,
  });

  // Continue with ticket creation...
}
```

#### Review Automation Integration

When processing reviews, create contacts for reviewers and track review activity:

```typescript
// In review automation route
import { upsertContactFromExternalSource, findContactByEmailOrPhone, addActivityNote } from "@/lib/apps/obd-crm/crmService";

export async function processReview(review: Review) {
  const user = await getCurrentUser();

  // Find or create contact for reviewer
  const contact = await upsertContactFromExternalSource({
    businessId: user.id,
    source: "reviews",
    name: review.reviewerName,
    email: review.reviewerEmail,
    tagNames: ["Reviewer", review.rating >= 4 ? "Positive Review" : "Needs Follow-up"],
  });

  // Add note about the review
  await addActivityNote({
    businessId: user.id,
    contactId: contact.id,
    note: `${review.rating}-star review on ${review.platform}: "${review.text.substring(0, 100)}..."`,
  });
}
```

### Using the Upsert API Endpoint

Alternatively, apps can use the API endpoint instead of the service module:

```typescript
// POST /api/obd-crm/contacts/upsert
const response = await fetch("/api/obd-crm/contacts/upsert", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "John Doe",
    email: "john@example.com",
    source: "scheduler",
    tagNames: ["Appointment"],
  }),
});

const { ok, data } = await response.json();
// data is a CrmContact object
```

**When to use the API vs Service:**
- **Service module**: Use when calling from server-side code in the same codebase (API routes, server components)
- **API endpoint**: Use when calling from client-side code or external services

## Debugging CRM Integrations

When developing or testing CRM integrations (e.g., Scheduler, Help Desk, Review Automation), dev-only logging is available to help debug contact upsert operations.

### Dev-Only Logging

The `upsertContactFromExternalSource()` function logs integration activity in development/staging environments (when `NODE_ENV !== "production"`).

**Log Output:**
```javascript
[CRM Integration] upsertContactFromExternalSource: {
  source: "scheduler",
  action: "found", // or "created"
  matchedBy: "email", // or "phone" (indicates which identifier matched)
  hasEmail: true,
  hasPhone: false,
  contactId: "contact-id-123" // or "new" if created
}
```

**What to Look For:**
- `action: "found"` - Contact was matched and updated
- `action: "created"` - New contact was created
- `matchedBy: "email"` or `"phone"` - Which identifier was used to match (if found)
- `contactId` - The contact ID (useful for verifying the correct contact was found/created)

**Viewing Logs:**
- **Local Development**: Check server console output
- **Staging**: Check server logs/deployment logs
- **Production**: Logging is disabled (no performance impact)

**Example Debugging Workflow:**
1. Trigger integration from your app (e.g., book appointment in Scheduler)
2. Check server console for `[CRM Integration]` log entries
3. Verify `action` and `matchedBy` match expectations
4. Use `contactId` to verify contact in CRM UI

### Common Issues

- **"matchedBy: unknown"** - Contact found but match logic unclear (should not happen with current implementation)
- **Always "created"** - Contact matching may be failing (check email/phone normalization)
- **Wrong contact matched** - Verify email/phone values being passed to upsert function

## Export Behavior

### CSV Format

- Header row: `name,email,phone,status,tags,source,company,address,createdAt,updatedAt`
- Tags are semicolon-separated in a single column
- Dates are in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
- Special characters are properly escaped

### Export Process

1. User clicks "Export CSV" button
2. Current filters/search are sent to `/api/obd-crm/export`
3. Server generates CSV with matching contacts
4. Browser downloads file with filename: `obd-crm-contacts-YYYY-MM-DD.csv`

## Business Scoping

Every query MUST be scoped to the logged-in user's business:

- In V3, `businessId = userId` (one user = one business)
- All database queries include `WHERE businessId = user.id`
- No cross-business access is possible
- Tags are unique per business (same tag name can exist for different businesses)

## Validation & Error Handling

### Contact Validation

- **name**: Required, minimum 2 characters, maximum 200 characters
- **email**: Optional, must be valid email format if provided
- **phone**: Optional, loosely validated
- **company**: Optional, maximum 200 characters
- **address**: Optional, maximum 500 characters
- **status**: Must be one of: Lead, Active, Past, DoNotContact
- **source**: Must be one of: manual, scheduler, reviews, helpdesk, import

### Standard API Response Format

**Success:**
```json
{
  "ok": true,
  "data": { /* response data */ }
}
```

**Error:**
```json
{
  "ok": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* optional details */ }
}
```

### Error Codes

- `VALIDATION_ERROR`: Invalid input data
- `UNAUTHORIZED`: Not authenticated
- `PREMIUM_REQUIRED`: Premium access required
- `RATE_LIMITED`: Rate limit exceeded
- `UPSTREAM_NOT_FOUND`: Resource not found (e.g., contact not found)
- `UNKNOWN_ERROR`: Unexpected error

## UI Requirements

### Contacts List Page (`/apps/obd-crm`)

- Header: "OBD CRM" + tagline
- Controls row:
  - Search input (name/email/phone)
  - Status filter dropdown
  - Tag filter dropdown
  - "Add Contact" button
  - "Export CSV" button
- Contacts table columns:
  - Name, Phone, Email, Status, Tags, Updated
- Row click navigates to contact detail
- Empty state: "No contacts yet — add your first contact."

### Contact Detail Page (`/apps/obd-crm/contacts/[id]`)

- Contact info card with Edit button
- Editable fields (name, email, phone, company, address, status, tags)
- Notes composer (textarea + "Add Note" button)
- Activity timeline list (shows notes in reverse chronological order)
- Delete button with confirmation
- Empty state: "No activity yet — add a note to track this relationship."

## V4 Ideas (Future Extensions)

The V3 structure supports future enhancements:

### Pipeline/Deals
- Add `CrmDeal` model
- Link deals to contacts
- Deal stages and values
- Pipeline visualization

### Automations
- Auto-tag contacts based on rules
- Status change notifications
- Scheduled follow-ups

### Integrations
- **Scheduler**: Auto-create contacts from appointments
- **Review Automation**: Auto-create contacts from reviews
- **AI Help Desk**: Auto-create contacts from help desk interactions

### Enhanced Activity Types
- Expand `CrmContactActivity.type` beyond "note"
- Support: email, call, meeting, task, etc.
- Activity templates

### Advanced Features
- Email sync (IMAP/Gmail API)
- SMS integration
- Calendar sync
- Custom fields
- Contact merging
- Import from CSV
- Bulk operations

## Database Schema

See `prisma/schema.prisma` for full schema definitions:

- `CrmContact`: Main contact model
- `CrmTag`: Tag model
- `CrmContactTag`: Join table for many-to-many relationship
- `CrmContactActivity`: Activity/notes model

All models include:
- `businessId` for scoping
- `createdAt` and `updatedAt` timestamps
- Appropriate indexes for performance

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── obd-crm/
│   │       ├── contacts/
│   │       │   ├── route.ts (GET list, POST create)
│   │       │   ├── [id]/
│   │       │   │   ├── route.ts (GET, PATCH, DELETE)
│   │       │   │   └── notes/
│   │       │   │       └── route.ts (GET, POST)
│   │       ├── tags/
│   │       │   └── route.ts (GET, POST, DELETE)
│   │       └── export/
│   │           └── route.ts (POST CSV)
│   └── apps/
│       └── obd-crm/
│           ├── page.tsx (contacts list)
│           └── contacts/
│               └── [id]/
│                   └── page.tsx (contact detail)
└── lib/
    └── apps/
        └── obd-crm/
            └── types.ts (TypeScript interfaces)
```

## Database Migration

### Creating the Migration

**Development (local):**
```bash
# 1. Validate schema
npx prisma validate

# 2. Create and apply migration
npx prisma migrate dev --name add_obd_crm_models

# 3. Generate Prisma Client (required for TypeScript)
npx prisma generate

# 4. Verify build succeeds
npm run build
```

**Production (Railway/hosted DB):**
```bash
# After migration file is created and committed:
# 1. Deploy migration (does not create new migration, only applies existing)
npx prisma migrate deploy

# 2. Generate Prisma Client
npx prisma generate
```

**Important:** Prisma Client must be generated after migration creation for TypeScript compilation to succeed. The build will fail until `npx prisma generate` is run.

See `docs/DB_MIGRATION_WORKFLOW.md` for detailed migration workflow.

### Schema Validation

All models include appropriate indexes:

- **CrmContact**: `businessId`, `businessId + status`, `businessId + updatedAt`, `businessId + name`
- **CrmContactActivity**: `contactId`, `businessId`, `businessId + createdAt`
- **CrmTag**: `businessId`, unique `businessId + name`
- **CrmContactTag**: unique `contactId + tagId`, indexes on `contactId` and `tagId`

All cascade rules ensure referential integrity:
- Contact deletion cascades to activities and tag relations
- Tag deletion cascades to tag relations (contacts remain)
- No orphan records possible

## DB Doctor (Local Fix)

If you encounter "Database Setup Issue" errors in the CRM UI, use the automated DB Doctor to diagnose and fix the problem.

### Quick Fix Command

Run the one-command fixer:

```bash
npm run crm:db:fix
```

This script will:
1. Read and verify your DATABASE_URL configuration
2. Apply any pending database migrations
3. Regenerate the Prisma client
4. Test Prisma model availability
5. Test API endpoints (if dev server is running)
6. Output a clear PASS/FAIL result with next steps

### DB Doctor Endpoint

For detailed diagnostics, visit the dev-only endpoint:

```
http://localhost:3000/api/debug/obd-crm-db-doctor
```

This endpoint returns a comprehensive JSON report including:
- Database connection details (host, database name, schema)
- Prisma model availability status
- Database table existence checks
- Migration status hints
- Recommended fix steps

**Note:** This endpoint returns 404 in production for security.

### What PASS Looks Like

A successful fix will show:
- ✅ All migrations applied
- ✅ Prisma client generated
- ✅ All CRM models available (crmContact, crmTag, crmContactActivity, user)
- ✅ All CRM tables exist in database
- ✅ `/api/obd-crm/contacts` returns 200
- ✅ `/api/obd-crm/tags` returns 200
- ✅ DB Doctor endpoint shows `ok: true`

### What FAIL Means

If the fix script reports FAIL, check:

1. **DATABASE_URL Configuration**
   - Verify `.env.local` has correct DATABASE_URL
   - Ensure it points to the intended database (not localhost if you expect Railway)

2. **Missing Migrations**
   - Run: `npx prisma migrate deploy`
   - Check: `npx prisma migrate status`

3. **Stale Prisma Client**
   - Run: `npx prisma generate`
   - Restart dev server after generating

4. **Database Connection Issues**
   - Verify database server is running and accessible
   - Check network connectivity
   - Verify credentials in DATABASE_URL

5. **Table Existence**
   - Use DB Doctor endpoint to see which tables are missing
   - If tables are missing, migrations may not have been applied

### Next Steps After FAIL

1. Check the DB Doctor endpoint output for specific issues
2. Review the recommended fix steps in the endpoint response
3. Run the suggested commands manually if needed
4. Restart the dev server after making changes
5. Re-run `npm run crm:db:fix` to verify the fix

## Testing Checklist

- [ ] Create contact with all fields
- [ ] Create contact with minimal fields (name only)
- [ ] Update contact
- [ ] Delete contact
- [ ] Search contacts
- [ ] Filter by status
- [ ] Filter by tag
- [ ] Add note to contact
- [ ] View notes timeline
- [ ] Create tag
- [ ] Delete tag
- [ ] Assign tags to contact
- [ ] Export CSV with filters
- [ ] Export CSV without filters
- [ ] Business scoping (ensure no cross-business access)
- [ ] Validation errors display correctly
- [ ] Empty states display correctly

