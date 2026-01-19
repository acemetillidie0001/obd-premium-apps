# OBD CRM Upgrade Plan — Baseline Snapshot (Preflight)

Goal: capture the **current** OBD CRM architecture + file map before any UI/state changes.

## Current routes

### UI routes (Next.js App Router)

- **`/apps/obd-crm`** → `src/app/apps/obd-crm/page.tsx`
- **`/apps/obd-crm/contacts/[id]`** → `src/app/apps/obd-crm/contacts/[id]/page.tsx`

### API routes (Next.js route handlers)

- **Contacts**
  - **GET** `/api/obd-crm/contacts` → `src/app/api/obd-crm/contacts/route.ts` (list w/ filters + pagination)
  - **POST** `/api/obd-crm/contacts` → `src/app/api/obd-crm/contacts/route.ts` (create)
  - **GET** `/api/obd-crm/contacts/[id]` → `src/app/api/obd-crm/contacts/[id]/route.ts` (detail)
  - **PATCH** `/api/obd-crm/contacts/[id]` → `src/app/api/obd-crm/contacts/[id]/route.ts` (update + tag replace + follow-up fields)
  - **DELETE** `/api/obd-crm/contacts/[id]` → `src/app/api/obd-crm/contacts/[id]/route.ts` (delete)
  - **GET** `/api/obd-crm/contacts/[id]/summary` → `src/app/api/obd-crm/contacts/[id]/summary/route.ts` (minimal summary for integrations)

- **Notes / Activities**
  - **GET** `/api/obd-crm/contacts/[id]/notes` → `src/app/api/obd-crm/contacts/[id]/notes/route.ts` (notes are stored as `CrmContactActivity` rows where `type="note"`)
  - **POST** `/api/obd-crm/contacts/[id]/notes` → `src/app/api/obd-crm/contacts/[id]/notes/route.ts`
  - **GET** `/api/obd-crm/contacts/[id]/activities` → `src/app/api/obd-crm/contacts/[id]/activities/route.ts` (non-note activities like CALL/EMAIL/TASK)
  - **POST** `/api/obd-crm/contacts/[id]/activities` → `src/app/api/obd-crm/contacts/[id]/activities/route.ts`

- **Tags**
  - **GET** `/api/obd-crm/tags` → `src/app/api/obd-crm/tags/route.ts`
  - **POST** `/api/obd-crm/tags` → `src/app/api/obd-crm/tags/route.ts`
  - **DELETE** `/api/obd-crm/tags?id=...` → `src/app/api/obd-crm/tags/route.ts`

- **Import / Export**
  - **POST** `/api/obd-crm/export` → `src/app/api/obd-crm/export/route.ts` (CSV export)
  - **POST** `/api/obd-crm/contacts/import` → `src/app/api/obd-crm/contacts/import/route.ts` (bulk import)

- **Integrations**
  - **POST** `/api/obd-crm/contacts/upsert` → `src/app/api/obd-crm/contacts/upsert/route.ts` (for other apps to upsert by email/phone)
  - CRM service used by other apps: `src/lib/apps/obd-crm/crmService.ts` (e.g. scheduler/helpdesk/review automation)

- **Dev / Diagnostics**
  - **POST** `/api/obd-crm/dev/seed-demo-data` → `src/app/api/obd-crm/dev/seed-demo-data/route.ts` (dev-only seeder; blocked in production)
  - **GET** `/api/debug/obd-crm-db-doctor` → `src/app/api/debug/obd-crm-db-doctor/route.ts` (diagnostics; production gated to admin allowlist)

## Current major components (and responsibilities)

### CRM UI (main)

- **`src/app/apps/obd-crm/page.tsx`**
  - **`OBDCRMPageContent`**: the entire CRM UI lives here (filters, table/queue views, drawer, modals, bulk ops).
  - **Sticky filters/actions bar**: uses `src/components/obd/OBDStickyToolbar.tsx` + `OBDPanel` toolbar variant.
  - **Contacts table + bulk selection**: uses `src/components/obd/OBDTableWrapper.tsx` and internal helpers for selection + bulk actions.
  - **Contact detail “drawer”**: driven by `selectedContactId`, fetches detail via `/api/obd-crm/contacts/[id]`, and separately loads notes + activities.
  - **Import CSV modal**: parses CSV client-side and posts normalized rows to `/api/obd-crm/contacts/import`.
  - **Export CSV**: posts filters to `/api/obd-crm/export`, downloads CSV via Blob.
  - **DB Doctor panel**: fetches `/api/debug/obd-crm-db-doctor` and shows top failing checks.
  - **Follow-up tooling**: next follow-up fields live on contacts; table/queue view + snooze/mark-done flows patch `nextFollowUpAt/nextFollowUpNote`.
  - **Segments (“saved views”)**: stored in localStorage key `obd_crm_segments_v1`.

### CRM UI (standalone contact page)

- **`src/app/apps/obd-crm/contacts/[id]/page.tsx`**
  - Standalone detail view with Edit/Save/Cancel + notes feed.

### Shared “CRM integration” UI

- **`src/components/crm/CrmIntegrationIndicator.tsx`**
  - Standard “CRM context loaded” pill and “Back to CRM contact” link for other apps launched from CRM context.

## Current export/import utilities used by CRM

- **CSV Import parsing**: `src/lib/utils/csvParser.ts` (used by `src/app/apps/obd-crm/page.tsx`)
- **CSV Export formatting**: implemented inline in API `src/app/api/obd-crm/export/route.ts` (`csvEscape`, tag formatting, blob download triggered by UI)

## Current data model touchpoints (Prisma)

Defined in `prisma/schema.prisma`:

- **`CrmContact`**
  - Key fields: `businessId`, `name`, `email?`, `phone?`, `company?`, `address?`, `status`, `source`,
    `nextFollowUpAt?`, `nextFollowUpNote?`, timestamps.
- **`CrmTag`** + **`CrmContactTag`** (many-to-many)
- **`CrmContactActivity`**
  - Used for both **notes** (`type="note"`, `content`) and **activities** (`type="CALL"|...`, `summary`, optional `occurredAt`).

Primary code touchpoints:

- API routes directly use Prisma via `import { prisma } from "@/lib/prisma"`.
- Integration service uses Prisma in `src/lib/apps/obd-crm/crmService.ts`.

## Current list/query flow (filtering/sorting)

### Server-side (authoritative list)

- **UI →** `GET /api/obd-crm/contacts?search=&status=&tagId=` (built in `loadData` in `src/app/apps/obd-crm/page.tsx`)
- **API →** `src/app/api/obd-crm/contacts/route.ts`
  - Builds a Prisma `where` using **businessId**, plus:
    - **search**: OR on name/email/phone `contains` (insensitive)
    - **status**
    - **tagId**: `where.tags.some({ tagId })`
  - Sorting/paging:
    - supports `sort`/`order`/`page`/`limit` query params, but the current UI only sends search/status/tagId (so defaults apply).
    - includes `activities` (notes only, newest) to compute `lastNote` + `lastTouchAt` for list rows.

### Client-side (additional view-layer filtering)

- Main CRM page applies a **follow-up filter** (`all|dueToday|overdue|upcoming`) on the already-loaded list (not sent to the API).
- Table “density” and follow-up “view mode” are persisted to localStorage (`obd_crm_density`, `obd_crm_followup_view`).

## Current edit flow (save/cancel)

### Drawer-based edit (main CRM page)

- **Open**: row click sets `selectedContactId`; also supports `?contactId=...` in the URL.
- **Load**:
  - Contact detail: `GET /api/obd-crm/contacts/[id]`
  - Notes: `GET /api/obd-crm/contacts/[id]/notes`
  - Activities: `GET /api/obd-crm/contacts/[id]/activities`
- **Save**:
  - `PATCH /api/obd-crm/contacts/[id]` with `editForm` (and separate PATCHes for tag/follow-up bulk flows).
  - On success, list refresh via `loadData()`.
- **Cancel/Close**:
  - ESC key and explicit close both clear drawer state and persist drawer scroll position to localStorage (`obd_crm_drawer_scrollPosition`).

### Create contact (main CRM page)

- `POST /api/obd-crm/contacts` from “Add Contact” modal → reload list.

### Standalone detail page edit

- `src/app/apps/obd-crm/contacts/[id]/page.tsx` uses its own local `isEditing` + `editForm`, and saves via `PATCH /api/obd-crm/contacts/[id]`.

## Existing sticky bar / accordion patterns to reuse

- **Sticky bar**: `src/components/obd/OBDStickyToolbar.tsx`
  - CRM already uses it for the filters/actions bar in `src/app/apps/obd-crm/page.tsx`.
- **Accordion section (simple controlled expand/collapse)**: `src/app/apps/local-seo-page-builder/components/LocalSeoAccordionSection.tsx`
  - Used by:
    - `src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx`
    - `src/app/apps/(apps)/reputation-dashboard/page.tsx`

## Notable inconsistencies (worth resolving during upgrade)

- **Notes payload mismatch**:
  - Notes API expects `{ body: string }` (`src/app/api/obd-crm/contacts/[id]/notes/route.ts`),
  - but `src/lib/apps/obd-crm/types.ts` defines `AddNoteRequest` as `{ content: string }`,
  - and the standalone detail page posts `{ content: ... }` (likely broken today).

