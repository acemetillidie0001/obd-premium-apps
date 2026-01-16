# SEO Audit & Roadmap — Tier 6 Audit Report (Reference-Quality Re-Verification)

**Date:** 2026-01-16  
**Scope (post Tier 6):**
- UI: `src/app/apps/seo-audit-roadmap/**`
- API: `src/app/api/seo-audit-roadmap/**`
- Shared handoff: `src/lib/apps/seo-audit-roadmap/apply-to-inputs-handoff.ts`, `src/lib/handoff/handoff.ts`
- DB models: `prisma/schema.prisma` (`SeoAuditReport`, `SeoAuditShareToken`)

---

## 1) Executive Summary

- **Status:** **CONDITIONAL PASS**
- **Tier status:** **5A + 5B + 5B+ + 5C+ + Tier 6-1..6-4**
- **Risk level:** **Low safety risk / Medium operational risk**

### Why CONDITIONAL PASS

- **Safety posture is strong (PASS):** advisory-only, draft-only, no auto-fix/publish/scheduling, strict tenant guards for DB reads/writes, token-scoped read-only share links.
- **Operational caveat (CONDITIONAL):** local/dev Prisma migration generation may require a shadow DB workflow workaround (P3006) in this repo (pre-existing constraint; addressed via documented safe scripts).

---

## 2) A–G checklist (evidence-based)

| Area | Result | Notes / Evidence pointers |
|---|---:|---|
| **A) Tenant safety** | PASS | Tenant-scoped DB access in API routes; share token resolves to one report scoped to one `businessId`. Evidence: `src/app/api/seo-audit-roadmap/route.ts`, `src/app/api/seo-audit-roadmap/share/route.ts`, `src/app/share/seo-audit/[token]/page.tsx`, `prisma/schema.prisma` |
| **B) Determinism** | PASS | Snapshot-only viewing: UI renders `activeAudit` from DB snapshot (no recompute on refresh). Evidence: `GET` in `src/app/api/seo-audit-roadmap/route.ts`, load-on-mount in `src/app/apps/seo-audit-roadmap/page.tsx` |
| **C) Draft-only / advisory-only** | PASS | Clear trust microcopy + maintenance mode indicator; no background tasks; all cross-app is user-initiated Apply/Dismiss. Evidence: `src/app/apps/seo-audit-roadmap/page.tsx`, `docs/apps/seo-audit-roadmap.md` |
| **D) Exports integrity** | PASS | Export Center uses `activeAudit` snapshot only; HTML export embeds print CSS (no UI junk). Evidence: `src/app/apps/seo-audit-roadmap/ExportCenter.tsx` |
| **E) Handoff safety** | PASS | Session-scoped, TTL-guarded, tenant-guarded payloads; explicit Apply/Dismiss on receivers; no auto-apply. Evidence: `src/lib/apps/seo-audit-roadmap/apply-to-inputs-handoff.ts`, `src/lib/handoff/handoff.ts`, receiver pages (`/apps/*`) |
| **F) Share links safety** | PASS | Tokenized, expiring, revocable, `noindex`; no `businessId` in URL; query is token-only; report is fetched by `auditReportId + businessId`. Evidence: `src/app/api/seo-audit-roadmap/share/*`, `src/app/share/seo-audit/[token]/page.tsx`, `prisma/schema.prisma` |
| **G) UI parity + Tier 6 trust-first copy** | PASS | Tier 6 additions are UI-only and snapshot-derived; copy is accurate and does not promise automation. Evidence: `src/app/apps/seo-audit-roadmap/page.tsx`, `src/components/obd/OBDAccordionSection.tsx`, `docs/apps/seo-audit-roadmap.md` |

---

## 3) Evidence pointers (key components / functions)

### UI (snapshot rendering + Tier 6)

- `src/app/apps/seo-audit-roadmap/page.tsx`
  - Loads canonical `activeAudit` via `fetch("/api/seo-audit-roadmap", { method: "GET" })` (snapshot-only viewing)
  - Tier 6-1: audit confidence meter (snapshot-derived from `categoryResults[].confidence`)
  - Tier 6-2: “Why this matters” expanders (static copy; UI-only)
  - Tier 6-4: “Next review recommended” hint (informational only; derived from saved snapshot timestamp)

### API (canonical snapshot state + selection)

- `src/app/api/seo-audit-roadmap/route.ts`
  - `buildAuditFromReport(report)` → maps DB snapshot into UI response; uses `(report.completedAt ?? report.updatedAt)` for `meta.auditedAtISO`
  - `GET` → loads latest two completed reports (active + previous) using deterministic ordering `(completedAt desc, createdAt desc)`
  - `POST` → creates `DRAFT`, computes deterministic findings, persists `COMPLETED` snapshot (no overwrite)

### Export integrity + print CSS (Tier 6-3)

- `src/app/apps/seo-audit-roadmap/ExportCenter.tsx`
  - Builds Text/Markdown/HTML exports exclusively from `audit` (snapshot) + `sourceInput` props
  - HTML export uses `buildHtmlDocument()` with embedded `<style>` including `@media print { ... }`
  - Major sections wrapped in `.print-section` to enforce page breaks for PDF printing

### Tier 5C+ apply-to-inputs handoffs (safety)

- `src/lib/apps/seo-audit-roadmap/apply-to-inputs-handoff.ts`
  - `SEO_AUDIT_APPLY_INPUTS_TTL_MS = 10 * 60 * 1000`
  - Session keys are per receiver app (`SEO_AUDIT_ROADMAP_APPLY_INPUTS_SESSION_KEYS_V1`)
  - `writeSeoAuditRoadmapApplyToInputsHandoff()` uses `createHandoff()` (adds TTL)
  - `readSeoAuditRoadmapApplyToInputsHandoff()` validates payload shape; missing/invalid payloads are ignored

- `src/lib/handoff/handoff.ts`
  - `createHandoff()` writes `createdAt/expiresAt` into `sessionStorage`
  - `readHandoff()` enforces TTL and clears expired payloads
  - `validateHandoff()` enforces tenant match (`payload.businessId` must match current `businessId`)

### Share links (tokenized, expiring, revocable, noindex)

- `src/app/api/seo-audit-roadmap/share/route.ts`
  - Token is 256-bit random (`crypto.randomBytes(32).toString("base64url")`)
  - `expiresAt = now + 7 days`; revokes existing active token(s) for the same audit
  - Returns `/share/seo-audit/{token}` (no `businessId` in URL)

- `src/app/api/seo-audit-roadmap/share/revoke/route.ts`
  - Revokes by `tokenId` (preferred) or revokes active token(s) for current active audit

- `src/app/share/seo-audit/[token]/page.tsx`
  - `generateMetadata()` sets `robots: { index:false, follow:false, nocache:true }`
  - Token lookup is `findUnique({ where: { token } })`
  - Report lookup is scoped to `id + businessId + status:"COMPLETED"` (resolves exactly one snapshot)

---

## 4) Audit focus points (post Tier 6)

### 4.1 activeAudit snapshot-only rendering (no recompute) — PASS

- UI loads via `GET /api/seo-audit-roadmap` and renders the returned snapshot.
- Exports are derived from `activeAudit` snapshot only.
- Tier 6 additions (confidence meter, next review hint) are derived only from the snapshot payload.

### 4.2 Handoff TTL + tenant guard + Apply/Dismiss correctness — PASS

- TTL enforced in shared handoff utils (`readHandoff()` clears expired payloads).
- Tenant mismatch is detectable via `validateHandoff()` and receivers implement Apply/Dismiss review UX (no auto-apply).
- Handoff payload is session-scoped and receiver-specific.

### 4.3 Share tokens safety — PASS

- Tokenized URL (no `businessId`), expiring, revocable; share page is read-only and `noindex`.
- Share token resolves to exactly one snapshot and is business-scoped at query time.

### 4.4 Export integrity + print CSS (no UI junk) — PASS

- Export Center content is `activeAudit` snapshot only.
- Print CSS is embedded into exported HTML; hides chips/buttons/tooltips conservatively and enforces page breaks.

### 4.5 Tier 6 copy remains trust-first and accurate — PASS

- “Audit confidence” helper text explains limitation (data-verification strength).
- “Next review recommended” is explicitly a hint (no scheduling).
- “Why this matters” is static educational copy; no claims of automation.

---

## 5) Known constraints (operational)

### Prisma shadow DB migration workflow (CONDITIONAL)

In this repo, `prisma migrate dev` may require a configured shadow database due to a pre-existing migration/shadow-db issue (P3006).

Mitigations / references:
- `docs/dev/prisma-migrations.md`
- `tools/prisma-migrate-safe.cjs`
- Prior audit context: `docs/deployments/SEO_AUDIT_ROADMAP_TIER5_AUDIT_REPORT.md`

---

## 6) Verification commands + outputs (paste)

Run from repo root:

### `pnpm -s typecheck`

```bash
pnpm -s typecheck
```

```

```

### `pnpm -s lint`

```bash
pnpm -s lint
```

```

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\app\api\social-auto-poster\queue\image\regenerate\route.ts
  152:14  warning  'fetchError' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\app\apps\social-auto-poster\composer\page.tsx
    15:10  warning  'getMetaPublishingBannerMessage' is defined but never used                                                                                                                                                                                                                               @typescript-eslint/no-unused-vars
   419:6   warning  React Hook useEffect has a missing dependency: 'isLocalHiringAssistantHandoff'. Either include it or remove the dependency array                                                                                                                                                         react-hooks/exhaustive-deps
   560:6   warning  React Hook useEffect has missing dependencies: 'aiLogoHandoff' and 'lhaDraftHandoff'. Either include them or remove the dependency array                                                                                                                                                 react-hooks/exhaustive-deps
  2346:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\app\apps\social-auto-poster\page.tsx
  181:19  warning  'isConnected' is assigned a value but never used  @typescript-eslint/no-unused-vars
  329:35  warning  '_' is defined but never used                     @typescript-eslint/no-unused-vars

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\app\apps\social-auto-poster\queue\page.tsx
  225:14  warning  'err' is defined but never used                                                                                                                                                                                                                                                          @typescript-eslint/no-unused-vars
  351:9   warning  'visibleItems' is assigned a value but never used                                                                                                                                                                                                                                        @typescript-eslint/no-unused-vars
  410:18  warning  'err' is defined but never used                                                                                                                                                                                                                                                          @typescript-eslint/no-unused-vars
  839:31  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\app\apps\social-auto-poster\setup\page.tsx
   10:10  warning  'SUBMIT_BUTTON_CLASSES' is defined but never used     @typescript-eslint/no-unused-vars
   29:7   warning  'DAYS_OF_WEEK' is assigned a value but never used     @typescript-eslint/no-unused-vars
  157:10  warning  'googleLocations' is assigned a value but never used  @typescript-eslint/no-unused-vars
  325:9   warning  'toggleDay' is assigned a value but never used        @typescript-eslint/no-unused-vars
  739:18  warning  'err' is defined but never used                       @typescript-eslint/no-unused-vars

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\lib\apps\social-auto-poster\connectionStatusUI.ts
  32:3  warning  'googleStatus' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\lib\apps\social-auto-poster\getBaseUrl.ts
  71:12  warning  'error' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\lib\apps\social-auto-poster\handoff\parseSocialHandoff.ts
  252:16  warning  'error' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\lib\apps\social-auto-poster\imageCategoryMap.ts
  9:15  warning  'ContentTheme' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\lib\apps\social-auto-poster\imageEngineClient.ts
  88:12  warning  'error' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\lib\apps\social-auto-poster\setup\setupValidation.ts
  27:3  warning  'connectionUI' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build\src\lib\auth.ts
  39:7  warning  'getEnvVar' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 23 problems (0 errors, 23 warnings)


```

### `pnpm -s build`

```bash
pnpm -s build
```

```
▲ Next.js 16.1.1 (Turbopack)
- Environments: .env.local, .env.production, .env

⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
  Creating an optimized production build ...
✓ Compiled successfully in 22.6s
  Running TypeScript ...
  Collecting page data using 15 workers ...
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
[AUTH WARNING] Email delivery disabled — console fallback active
⚠ Using edge runtime on a page currently disables static generation for that page
[AUTH WARNING] Email delivery disabled — console fallback active
  Generating static pages using 15 workers (0/174) ...
[AUTH WARNING] Email delivery disabled — console fallback active
  Generating static pages using 15 workers (43/174) 
  Generating static pages using 15 workers (86/174) 
  Generating static pages using 15 workers (130/174) 
[LoginPage] Auth check failed, treating as unauthenticated: Dynamic server usage: Route /login couldn't be rendered statically because it used `headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
✓ Generating static pages using 15 workers (174/174) in 808.2ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /ai-logo-generator
├ ƒ /api/admin/db-fingerprint
├ ƒ /api/ai-help-desk/business-profile
├ ƒ /api/ai-help-desk/chat
├ ƒ /api/ai-help-desk/diagnostics/production-check
├ ƒ /api/ai-help-desk/import/commit
├ ƒ /api/ai-help-desk/import/preview
├ ƒ /api/ai-help-desk/insights/summary
├ ƒ /api/ai-help-desk/knowledge/delete
├ ƒ /api/ai-help-desk/knowledge/list
├ ƒ /api/ai-help-desk/knowledge/upsert
├ ƒ /api/ai-help-desk/search
├ ƒ /api/ai-help-desk/setup/admin
├ ƒ /api/ai-help-desk/setup/mapping
├ ƒ /api/ai-help-desk/setup/status
├ ƒ /api/ai-help-desk/setup/test
├ ƒ /api/ai-help-desk/widget/chat
├ ƒ /api/ai-help-desk/widget/events
├ ƒ /api/ai-help-desk/widget/rotate-key
├ ƒ /api/ai-help-desk/widget/settings
├ ƒ /api/ai-help-desk/widget/validate-domain
├ ƒ /api/ai-logo-generator
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/brand-kit-builder
├ ƒ /api/brand-kit-builder/pdf
├ ƒ /api/brand-profile
├ ƒ /api/business-description-writer
├ ƒ /api/business-description-writer/saved-versions
├ ƒ /api/content-writer
├ ƒ /api/debug/auth
├ ƒ /api/debug/auth-email
├ ƒ /api/debug/auth-env
├ ƒ /api/debug/auth-test
├ ƒ /api/debug/db-info
├ ƒ /api/debug/env-check
├ ƒ /api/debug/obd-crm-db-doctor
├ ƒ /api/debug/prisma-sanity
├ ƒ /api/debug/session
├ ƒ /api/event-campaign-builder
├ ƒ /api/example-premium
├ ƒ /api/faq-generator
├ ƒ /api/google-business/audit
├ ƒ /api/google-business/pro
├ ƒ /api/google-business/pro/cleanup
├ ƒ /api/google-business/pro/competitors
├ ƒ /api/google-business/pro/csv
├ ƒ /api/google-business/pro/photos
├ ƒ /api/google-business/pro/report
├ ƒ /api/google-business/pro/report/[id]
├ ƒ /api/google-business/pro/rewrites
├ ƒ /api/google-business/wizard
├ ƒ /api/health
├ ƒ /api/health/auth
├ ƒ /api/image-caption-generator
├ ƒ /api/image-engine/decision
├ ƒ /api/image-engine/generate
├ ƒ /api/image-engine/regenerate
├ ƒ /api/local-hiring-assistant
├ ƒ /api/local-keyword-research
├ ƒ /api/local-keyword-research/rank-check
├ ƒ /api/local-seo-page-builder
├ ƒ /api/obd-crm/contacts
├ ƒ /api/obd-crm/contacts/[id]
├ ƒ /api/obd-crm/contacts/[id]/activities
├ ƒ /api/obd-crm/contacts/[id]/notes
├ ƒ /api/obd-crm/contacts/[id]/summary
├ ƒ /api/obd-crm/contacts/import
├ ƒ /api/obd-crm/contacts/upsert
├ ƒ /api/obd-crm/dev/seed-demo-data
├ ƒ /api/obd-crm/export
├ ƒ /api/obd-crm/tags
├ ƒ /api/obd-scheduler/availability
├ ƒ /api/obd-scheduler/bookings/instant
├ ƒ /api/obd-scheduler/busy-blocks
├ ƒ /api/obd-scheduler/busy-blocks/[id]
├ ƒ /api/obd-scheduler/calendar/callback/google
├ ƒ /api/obd-scheduler/calendar/callback/microsoft
├ ƒ /api/obd-scheduler/calendar/connect
├ ƒ /api/obd-scheduler/calendar/connect/google
├ ƒ /api/obd-scheduler/calendar/connect/microsoft
├ ƒ /api/obd-scheduler/calendar/disconnect
├ ƒ /api/obd-scheduler/calendar/freebusy
├ ƒ /api/obd-scheduler/calendar/ics
├ ƒ /api/obd-scheduler/calendar/status
├ ƒ /api/obd-scheduler/calendar/sync
├ ƒ /api/obd-scheduler/calendar/toggle
├ ƒ /api/obd-scheduler/health
├ ƒ /api/obd-scheduler/metrics
├ ƒ /api/obd-scheduler/public-link
├ ƒ /api/obd-scheduler/public/context
├ ƒ /api/obd-scheduler/requests
├ ƒ /api/obd-scheduler/requests/[id]
├ ƒ /api/obd-scheduler/requests/[id]/action
├ ƒ /api/obd-scheduler/requests/[id]/audit
├ ƒ /api/obd-scheduler/services
├ ƒ /api/obd-scheduler/services/[id]
├ ƒ /api/obd-scheduler/settings
├ ƒ /api/obd-scheduler/slots
├ ƒ /api/obd-scheduler/theme
├ ƒ /api/obd-scheduler/verification
├ ƒ /api/offers-builder
├ ƒ /api/reputation-dashboard
├ ƒ /api/review-request-automation
├ ƒ /api/review-request-automation/click
├ ƒ /api/review-request-automation/latest
├ ƒ /api/review-request-automation/reviewed
├ ƒ /api/review-request-automation/save
├ ƒ /api/review-request-automation/send-email
├ ƒ /api/review-responder
├ ƒ /api/schema-generator
├ ƒ /api/seo-audit-roadmap
├ ƒ /api/seo-audit-roadmap/share
├ ƒ /api/seo-audit-roadmap/share/revoke
├ ƒ /api/sms/twilio/webhook
├ ƒ /api/social-auto-poster/activity
├ ƒ /api/social-auto-poster/analytics
├ ƒ /api/social-auto-poster/cron
├ ƒ /api/social-auto-poster/generate
├ ƒ /api/social-auto-poster/queue
├ ƒ /api/social-auto-poster/queue/approve
├ ƒ /api/social-auto-poster/queue/create
├ ƒ /api/social-auto-poster/queue/delete
├ ƒ /api/social-auto-poster/queue/image
├ ƒ /api/social-auto-poster/queue/image/regenerate
├ ƒ /api/social-auto-poster/queue/simulate-run
├ ƒ /api/social-auto-poster/runner
├ ƒ /api/social-auto-poster/settings
├ ƒ /api/social-connections/google/callback
├ ƒ /api/social-connections/google/connect
├ ƒ /api/social-connections/google/disconnect
├ ƒ /api/social-connections/google/select-location
├ ƒ /api/social-connections/google/status
├ ƒ /api/social-connections/google/test-post
├ ƒ /api/social-connections/meta/callback
├ ƒ /api/social-connections/meta/connect
├ ƒ /api/social-connections/meta/disconnect
├ ƒ /api/social-connections/meta/request-pages-access
├ ƒ /api/social-connections/meta/status
├ ƒ /api/social-connections/meta/test-post
├ ƒ /api/social-media-post-creator
├ ƒ /api/test-db
├ ƒ /api/test-resend
├ ƒ /apps
├ ƒ /apps/ai-help-desk
├ ƒ /apps/ai-help-desk/setup
├ ƒ /apps/ai-logo-generator
├ ƒ /apps/brand-kit-builder
├ ƒ /apps/brand-profile
├ ƒ /apps/business-description-writer
├ ƒ /apps/business-schema-generator
├ ƒ /apps/content-writer
├ ƒ /apps/demo
├ ƒ /apps/demo/exit
├ ƒ /apps/demo/proof
├ ƒ /apps/demo/status
├ ƒ /apps/event-campaign-builder
├ ƒ /apps/faq-generator
├ ƒ /apps/google-business-pro
├ ƒ /apps/google-business-pro/report/[id]
├ ƒ /apps/image-caption-generator
├ ƒ /apps/image-generator
├ ƒ /apps/local-hiring-assistant
├ ƒ /apps/local-keyword-research
├ ƒ /apps/local-seo-page-builder
├ ƒ /apps/obd-crm
├ ƒ /apps/obd-crm/contacts/[id]
├ ƒ /apps/obd-scheduler
├ ƒ /apps/obd-scheduler/public
├ ƒ /apps/offers-builder
├ ƒ /apps/reputation-dashboard
├ ƒ /apps/review-request-automation
├ ƒ /apps/review-responder
├ ƒ /apps/seo-audit-roadmap
├ ƒ /apps/social-auto-poster
├ ƒ /apps/social-auto-poster/activity
├ ƒ /apps/social-auto-poster/composer
├ ƒ /apps/social-auto-poster/queue
├ ƒ /apps/social-auto-poster/setup
├ ƒ /apps/social-media-post-creator
├ ƒ /apps/website-draft-import
├ ƒ /book/[bookingKey]
├ ƒ /data-deletion
├ ƒ /help
├ ƒ /local-hiring-assistant
├ ƒ /login
├ ƒ /login/error
├ ƒ /login/verify
├ ƒ /reputation-dashboard
├ ƒ /share/seo-audit/[token]
├ ƒ /unlock
├ ƒ /widget/ai-help-desk
└ ƒ /widget/ai-help-desk.js


ƒ Proxy (Middleware)

ƒ  (Dynamic)  server-rendered on demand


```

---

## 7) Critical bugs found

None found during this audit.


