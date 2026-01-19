# OBD CRM Lock Readiness Audit Report

**Repo:** OBD Premium Apps (`cursor-app-build`)  
**Date:** 2026-01-19  
**Scope (explicit):**
- UI: `src/app/apps/obd-crm/page.tsx`, `src/app/apps/obd-crm/contacts/[id]/page.tsx`
- API: `src/app/api/obd-crm/**`
- Lib: `src/lib/apps/obd-crm/**` (including selectors)
- Shared component: `src/components/crm/CrmIntegrationIndicator.tsx`
- CSV utility: `src/lib/utils/csvParser.ts`
- Prisma models: `prisma/schema.prisma` (`CrmContact`, `CrmTag`, `CrmContactTag`, `CrmContactActivity`)

## 1) Executive Summary

**Verdict: PASS** (LOCK-ready for maintenance mode).

**Why:** CRM reads/writes are consistently authenticated + business-scoped, the UI uses a canonical deterministic selector for all list rendering/counts/export parameters, export/import behavior is non-destructive, and cross-app integrations are link-only/read-only from CRM.

## 2) What shipped in this upgrade wave (Optional 1–4)

### Optional 1 — Activity Timeline (read-only)
- Timeline entries are derived from existing CRM notes/activities + read-only Scheduler “booking completed” awareness + review signals derived from canonical CRM note content.

### Optional 2 — Saved Views
- Saved Views store filter + sort presets only, and are persisted per-business in localStorage.

### Optional 3 — CRM Health Snapshot
- Small advisory panel derived from selector counts (follow-up buckets + notes coverage), dismissible, and suppressed when DB Doctor reports failures.

### Optional 4 — CSV Import UX micro-polish
- Multi-step import flow (upload → preview → map/confirm → results) with pre-import estimate and explicit confirmation.

## 3) Evidence-based Lock Scorecard (A–G)

> Each section includes **Verified by** references with approximate line ranges.

### A) Tenant safety + auth scoping — **A**

**Findings**
- All `src/app/api/obd-crm/**` routes require premium access and verify authenticated user, then scope data to `businessId = user.id`.
- CRM schema embeds `businessId` on all relevant CRM models and indexes it.
- Cross-app “Signals” lookups are read-only and/or link-only from CRM.

**Verified by**
- `prisma/schema.prisma` (business-scoped models): `CrmContact` `businessId` + indexes (L348–L370), `CrmTag` (L372–L383), `CrmContactActivity` (L398–L414).
- `src/app/api/obd-crm/contacts/route.ts`:
  - Premium/auth gating + business scoping for list queries (L93–L176).
  - Query-param validation (status/sort/order) to avoid unsafe/unexpected Prisma ordering (L125–L138).
  - Mutations blocked in demo mode (POST) (L238–L247) and tag IDs validated to belong to business (L276–L290).
- `src/app/api/obd-crm/contacts/[id]/route.ts`:
  - Contact lookup is `id + businessId` scoped for GET/PATCH/DELETE (GET: L141–L161; PATCH: L221–L231; DELETE: L357–L367).
- `src/app/api/obd-crm/tags/route.ts`:
  - Tags are `businessId` scoped (GET: L66–L73; POST uniqueness via `businessId_name`: L134–L142; DELETE verifies `id + businessId`: L213–L223).
- `src/app/apps/obd-crm/contacts/[id]/page.tsx` (cross-app read-only lookup):
  - Reads Scheduler requests via GET only and filters by **exact email match** (L120–L175).
- `src/app/apps/obd-crm/page.tsx` (cross-app link-only):
  - Bulk “Send Review Request” **navigates** to Review Request Automation (no sending from CRM) (L789–L804).
- `src/components/crm/CrmIntegrationIndicator.tsx` + `src/lib/utils/crm-integration-helpers.ts`:
  - Return URL validation prevents open redirects; only internal `/apps/*` allowed (indicator: L44–L62; helper: L10–L23).

### B) Draft-only / Non-automation guarantees — **A**

**Findings**
- No background jobs/cron/queue runners exist in OBD CRM scope; CRM routes are synchronous request/response only.
- CRM does not send email/SMS. “EMAIL/TEXT” activity types are **record types**, not delivery actions.
- Review Request Automation integration is **navigation-only** from CRM; no cross-app mutation triggered by CRM automatically.

**Verified by**
- `src/app/api/obd-crm/contacts/[id]/activities/route.ts` (activity logging only; creates DB record): schema + POST creates `crmContactActivity` (L20–L32, L180–L194).
- `src/app/apps/obd-crm/page.tsx`:
  - Bulk review request action is `router.push(...)` (L789–L804).
  - SMS channel is explicitly disabled in CRM bulk modal (“coming soon”) (L7091–L7120).

### C) Determinism / canonical view model — **A**

**Findings**
- `getActiveContacts()` is the authoritative selector for list rendering + counts + normalized filters/sort, with a stable reference timestamp and deterministic tie-breaking by `id`.
- Follow-up buckets use a stable “today window” derived from `referenceTime`.
- Saved Views apply filters/sort deterministically by storing and reapplying state (preset semantics, not “saved results”).

**Verified by**
- `src/lib/apps/obd-crm/selectors/getActiveContacts.ts`:
  - Stable `referenceTime`, deterministic “today window”, deterministic sorting + tie-breaker (L104–L267).
- `src/app/apps/obd-crm/page.tsx`:
  - Stable reference time memoized per filter set; selector used as canonical source (L909–L942).
  - Saved Views are tenant-scoped and persisted (L40–L87).
  - Saved Views UI uses accordion summary and deterministic presets (L2347–L2451).

### D) Export + Import integrity — **A**

**Findings**
- Export reflects the UI’s **current view** by sending normalized selector filters/sort and “today window” boundaries; export applies those constraints server-side and sorts deterministically (including `lastTouchAt`).
- CSV import shows an estimate/preview and uses create-only semantics; duplicates are skipped (no silent destructive updates).

**Verified by**
- `src/app/apps/obd-crm/page.tsx`:
  - Export request uses selector-normalized filters/sort + `todayWindow` boundaries + notes filter (L1892–L1947).
  - Import estimate mirrors import-route dedupe semantics (exact-string, trimmed) (L1954–L2031).
  - CSV parsing uses shared parser and blocks empty/invalid files (L2033–L2066).
  - Import preview is limited to first 10 rows and is explicit about mapping/confirm steps (L2068–L2103).
  - Import submission is explicit, then reloads contacts (L2105–L2169).
- `src/app/api/obd-crm/export/route.ts`:
  - Request validation includes follow-up + notes + sort/order + `todayWindow` (L24–L40).
  - Notes filter uses `activities.some(type="note")` (L195–L203).
  - Follow-up filter uses client-provided day boundaries (L211–L246).
  - Deterministic in-process sort supports `lastTouchAt` safely (L269–L292).
- `src/app/api/obd-crm/contacts/import/route.ts`:
  - Validates rows, resolves tags by business, and **skips duplicates** (L19–L195).
  - Creates contacts in a transaction; does not update existing contacts (L197–L224).
- `src/lib/utils/csvParser.ts`:
  - Header-required parser, trims fields, supports quoted fields; returns structured errors (L22–L66, L71–L109).

### E) UX parity + resilience — **A-**

**Findings**
- Sticky toolbars exist for both list controls and edit flows; “disabled-not-hidden” guidance is used for edit actions.
- Accordion filters include summary lines when collapsed.
- Empty states exist for timeline/notes/no-saved-views, and layouts use responsive classes for mobile safety.

**Verified by**
- `src/app/apps/obd-crm/page.tsx`:
  - Sticky toolbar wrapper around controls/actions (L2182–L2197).
  - Accordion Saved Views summary + empty state (L2347–L2449).
- `src/app/apps/obd-crm/contacts/[id]/page.tsx`:
  - Sticky edit toolbar with Save disabled (not hidden) and explanatory title; header shows “Editing” disabled state (L441–L505).
  - Timeline empty state (“No activity yet.”) (L887–L911).
  - Notes empty state (“No activity yet — add a note…”) (L914–L950).

### F) Error handling + observability — **A**

**Findings**
- CRM API routes use shared error helpers and include CRM-specific DB error handler patterns.
- The CRM UI has a safe JSON parsing fetch wrapper and surfaces actionable guidance.
- “DB Doctor” diagnostic report is optional and guarded; errors do not leak secrets.

**Verified by**
- `src/lib/apps/obd-crm/dbErrorHandler.ts` (friendly database errors; no stack leakage): (L59–L95).
- `src/lib/apps/obd-crm/devSelfTest.ts` (dev-only self-test; production bypass): (L32–L42, L44–L92).
- `src/app/apps/obd-crm/page.tsx`:
  - `safeFetch()` avoids JSON parsing crashes and returns actionable messages (L943–L984).
  - DB Doctor report fetch is optional and dev-warn-only (L1124–L1155).
  - UI surfaces doctor report failures with top failing checks and expandable details (L2792–L2857).
- `src/app/api/debug/obd-crm-db-doctor/route.ts`:
  - Production access control requires authenticated admin allowlist; otherwise 403 (L115–L147).
  - Cache disabled for diagnostics responses (L419–L424).

### G) Security + privacy checks — **A-**

**Findings**
- No cross-tenant leakage found in CRM routes: reads/writes are business-scoped and IDs are verified against business where needed.
- Return URL handling is validated to avoid open redirects.
- Dev-only endpoints are gated; production disables CRM demo seed route.
- Dev-only logging avoids printing PII (emails/phones) and is gated behind non-production checks.

**Verified by**
- `src/lib/utils/crm-integration-helpers.ts` (returnUrl validation): (L10–L23).
- `src/app/api/obd-crm/dev/seed-demo-data/route.ts` (disabled in production): (L37–L44).
- `src/lib/apps/obd-crm/crmService.ts` (dev-only logging; no PII fields): (L302–L322).

## Punch-list (if any)

### P0 — Must-fix before LOCK
- None found in scope.

### P1 — Should-fix soon
- None found in scope.

### P2 — Nice-to-have
- Consider improving tag lookups in CSV import to be case-insensitive at the DB query level for better UX consistency (`src/app/api/obd-crm/contacts/import/route.ts` around tag lookup at L112–L136).

# OBD CRM Lock-Readiness Audit Report

**Date:** 2026-01-19  
**Repo:** OBD Premium Apps  
**Scope:** OBD CRM only (UI + API + lib + shared CRM component + Prisma models)

## Executive Summary — **CONDITIONAL PASS**

OBD CRM is **lock-ready** for the Optional 1–4 upgrade wave with clear tenant scoping on all CRM API routes, deterministic list rendering via the canonical selector, and no schema changes.  

**Condition(s):**
- OBD CRM includes **user-initiated** cross-app actions (e.g., “Send Review Request”) which can trigger email sending via other apps’ endpoints. This is not background automation, but it is “sending” when initiated from CRM. See **Scorecard B** and **Punch-list P1**.

## What shipped in this upgrade wave (Optional 1–4)

### 1) Activity Timeline (read-only)
- Adds a **Timeline** section on the contact detail page.
- New helper aggregates existing CRM/Scheduler/Reviews signals into a strict chronological list (no inference).

**Verified by**
- `src/app/apps/obd-crm/contacts/[id]/page.tsx` (scheduler read + timeline UI): `L120-L191`, `L758-L916`  
- `src/lib/apps/obd-crm/timeline.ts` (timeline aggregation rules): `L1-L163`

### 2) Saved Views (filters + sort presets only)
- Users can save current filters + sort as a named view.
- Views are not snapshots; they reapply the selector inputs and results update naturally.
- Storage is tenant-scoped localStorage using businessId.

**Verified by**
- `src/app/apps/obd-crm/page.tsx` (storage key + saved view state): `L40-L87`, `L301-L386`, `L403-L423`  
- `src/lib/apps/obd-crm/selectors/getActiveContacts.ts` (canonical filters/sort): `L9-L55`, `L123-L140`, `L221-L268`

### 3) CRM Health Snapshot (advisory only)
- Adds a calm “CRM Health Snapshot” panel above the list.
- Dismissible, no CTAs, and uses **only canonical selector counts**.

**Verified by**
- `src/lib/apps/obd-crm/selectors/getActiveContacts.ts` (notes counts + follow-up buckets): `L185-L203`, `L257-L262`  
- `src/app/apps/obd-crm/page.tsx` (panel rendering + dismiss localStorage): `L314-L333`, `L2739-L2793`

### 4) CSV Import UX micro-polish (UI-only)
- Adds a pre-import summary and mapping recap; confirmation copy clarified; post-import CTA improved.
- No changes to parsing logic; `parseCSV` is unchanged and used read-only.

**Verified by**
- `src/app/apps/obd-crm/page.tsx` (import estimate + confirm copy): `L1954-L2034`, `L6231-L6462`  
- `src/lib/utils/csvParser.ts` (parser unchanged; utility only): `L1-L112`  
- `src/app/api/obd-crm/contacts/import/route.ts` (import behavior: create + skip duplicates): `L151-L187`, `L197-L224`

---

## Evidence-Based Scorecard (A–G)

### A) Tenant safety + auth scoping — **PASS**

**Findings**
- All CRM API routes enforce premium access and derive `businessId` from the authenticated user, then scope DB queries by `businessId`.
- Contact detail page performs **read-only** scheduler awareness via `/api/obd-scheduler/requests` and then filters client-side via **exact email match**.

**Verified by**
- `src/app/api/obd-crm/contacts/route.ts`: `requirePremiumAccess()` + `getCurrentUser()` + `businessId`: `L93-L137`  
- `src/app/api/obd-crm/contacts/[id]/route.ts`: `businessId` scoping in `findFirst`: `L117-L175`  
- `src/app/api/obd-crm/contacts/[id]/notes/route.ts`: contact ownership check: `L67-L81`  
- `src/app/api/obd-crm/contacts/[id]/activities/route.ts`: contact ownership check: `L74-L88`  
- `src/app/api/obd-crm/tags/route.ts`: `businessId` scoping for GET/POST/DELETE: `L48-L90`, `L95-L172`, `L178-L241`  
- `src/app/apps/obd-crm/contacts/[id]/page.tsx`: scheduler awareness fetch + exact-email filter: `L120-L160`  
- `src/app/api/obd-scheduler/requests/route.ts` (tenant-scoped scheduler list; used by CRM read-only awareness): `businessId` where clause: `L271-L310`

### B) Draft-only / Non-automation guarantees — **CONDITIONAL PASS**

**Findings**
- The Optional 1–4 changes add **no scheduled jobs** and **no background processing** within the CRM codepaths.
- However, CRM contains **user-initiated** actions that can invoke other apps (e.g., review request sending). This is not “CRM brain,” but it is not strictly “no email/SMS sending” when initiated from CRM UI.

**Verified by**
- `src/app/apps/obd-crm/contacts/[id]/page.tsx`: new Timeline + Signals are read-only lists/links (no write endpoints): `L720-L916`  
- `src/lib/apps/obd-crm/timeline.ts`: pure aggregation; no fetch/write: `L71-L163`  
- `src/app/api/obd-crm/**`: all routes are request/response handlers; no scheduling primitives present (see routes list in **A**)

### C) Determinism / canonical view model — **PASS**

**Findings**
- The contacts list uses `getActiveContacts()` as the single source of truth for:
  - list rendering order
  - follow-up buckets
  - counts (including the new notes counts)
  - Saved Views inputs (filters + sort)
- Follow-up buckets are computed from a stable “today window” derived from a reference timestamp.

**Verified by**
- `src/app/apps/obd-crm/page.tsx`: canonical selector call + stable reference time: `L835-L863` (see also export usage below)  
- `src/lib/apps/obd-crm/selectors/getActiveContacts.ts`: `todayWindow` + bucket rules: `L144-L147`, `L112-L121`, `L177-L203`  
- `src/app/apps/obd-crm/page.tsx`: Saved Views apply filters + sort deterministically: `L403-L423`

### D) Export + Import integrity — **PASS (with noted limits)**

**Findings**
- Export reflects current view (filters + sort) by using normalized selector outputs.
- CSV import is **create-only** and skips duplicates; UI preview uses best-effort estimation aligned to backend’s dedupe behavior (exact string match on email/phone).
- No silent destructive behavior: imports do not delete; existing matches are skipped.

**Verified by**
- `src/app/apps/obd-crm/page.tsx`: export request body uses `selector.normalizedFilters` + `selector.normalizedSort`: `L1892-L1908`  
- `src/app/api/obd-crm/export/route.ts`: business-scoped export + follow-up filter alignment: `L66-L156`, `L158-L183`  
- `src/app/api/obd-crm/contacts/import/route.ts`: dedupe + skip duplicates, create contacts transaction: `L151-L187`, `L197-L224`  
- `src/app/apps/obd-crm/page.tsx`: import estimate (UI-only) + mapping recap: `L1954-L2034`, `L6441-L6462`

### E) UX parity + resilience — **PASS**

**Findings**
- Sticky toolbars and disabled-not-hidden patterns are used.
- Calm empty states are present (e.g., Timeline “No activity yet.”).
- Mobile-safe patterns exist (mobile FAB, responsive layout).

**Verified by**
- `src/app/apps/obd-crm/page.tsx`: `OBDStickyToolbar` wrapper: `L2169-L2737`  
- `src/app/apps/obd-crm/page.tsx`: CRM Health Snapshot is informational and optional: `L2739-L2793`  
- `src/app/apps/obd-crm/contacts/[id]/page.tsx`: Timeline empty state: `L887-L916`

### F) Error handling + observability — **PASS**

**Findings**
- CRM routes use shared API error helpers and DB-specific error handlers to avoid leaking internals while keeping guidance actionable.
- Dev-only self-test exists and is bypassed in production/Vercel.

**Verified by**
- `src/lib/apps/obd-crm/dbErrorHandler.ts`: friendly DB error mapping: `L59-L95`  
- `src/lib/apps/obd-crm/devSelfTest.ts`: dev-only DB checks + structured guidance: `L32-L92`, `L100-L112`  
- `src/app/api/obd-crm/contacts/route.ts`: self-test + `handleCrmDatabaseError` usage: `L97-L115`, `L224-L231`

### G) Security + privacy checks — **CONDITIONAL PASS**

**Findings**
- No cross-tenant leakage found in CRM API routes reviewed (scoped by `businessId`).
- Dev-only seed route is blocked in production.
- Some UI flows log errors to console (acceptable in dev; ensure no PII-heavy logs in production paths).

**Verified by**
- `src/app/api/obd-crm/dev/seed-demo-data/route.ts`: production block: `L37-L44`  
- `src/app/api/obd-crm/contacts/[id]/notes/route.ts`: contact ownership enforced: `L70-L80`  
- `src/components/crm/CrmIntegrationIndicator.tsx`: return URL validation helper used: `L11-L46`

---

## Punch-list (before LOCK)

### P0 — Must-fix before LOCK
- None found in the Optional 1–4 wave scoped changes.

### P1 — Should-fix soon
- **Non-automation messaging consistency**: CRM includes user-triggered actions that can initiate sending (review requests) via other apps. If “no email/SMS sending from CRM” is a hard policy for lock, those entry points should be moved/disabled in CRM UI.
  - **Evidence**: CRM bulk action “Send Review Request” exists in `src/app/apps/obd-crm/page.tsx` (`L2715-L2729`).

### P2 — Nice-to-have
- Consider documenting/importing backend email-case sensitivity for imports and contact matching to avoid confusion; current UI preview matches backend exact-string behavior, but users may expect case-insensitive email matching.
  - **Evidence**: import dedupe uses exact `email in [...]` / `phone in [...]` in `src/app/api/obd-crm/contacts/import/route.ts` (`L151-L167`).

---

## Build / Verification Evidence

### Preflight (required)
- `pnpm run typecheck` — PASS
- `pnpm run vercel-build` — PASS


