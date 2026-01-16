# SEO Audit & Roadmap — Tier 5 Audit Report (Reference-Quality)

**Date:** 2026-01-15  
**Scope:**
- `src/app/apps/seo-audit-roadmap/**`
- `src/app/api/seo-audit-roadmap/route.ts`
- `prisma/schema.prisma` (+ migration artifact)

## 1) Executive Summary

- **Status:** **CONDITIONAL PASS**
- **Tier status:** **5A + 5B + 5B+ + 5C (link-only)**
- **Risk level:** **Low safety risk / Medium operational risk**

### Why CONDITIONAL PASS

- **Safety posture is strong (PASS):** advisory-only, no auto-fix, no cross-app mutation, strict tenant guards for DB reads/writes.
- **Operational caveat (CONDITIONAL):** `prisma migrate dev --create-only` currently fails in this repo due to a pre-existing shadow DB migration issue (P3006) related to migration `20251214014402_add_expires_at` and relation `ProReport`.
  - The Tier 5B DB model is correct, but migration generation is not clean in this environment until the existing migration issue is resolved.

---

## 2) PASS/CONDITIONAL PASS table

| Area | Result | Notes / Evidence |
|------|--------|------------------|
| Tier 5A UX parity scaffold | PASS | `src/app/apps/seo-audit-roadmap/page.tsx` (accordion sections + sticky action bar + trust microcopy) |
| Tier 5B canonical report state | PASS | `prisma/schema.prisma` (`SeoAuditReport`), `src/app/api/seo-audit-roadmap/route.ts` (draft→completed snapshot) |
| Determinism (no recompute while viewing) | PASS | UI loads activeAudit via `GET` and renders snapshot only |
| Exports integrity (activeAudit only) | PASS | `src/app/apps/seo-audit-roadmap/ExportCenter.tsx` consumes `audit` prop only |
| Tier 5C ecosystem awareness (links only) | PASS | `FixWithOBD` is deterministic + internal links only |
| Tenant safety (business-scoped DB access) | PASS | `resolveBusinessIdServer(...)` + tenant mismatch guard in API |
| “Maintenance mode” posture | PASS | Snapshot-based viewing; no background work; follow-ups should be small and safety-first |
| Migration generation in this repo | CONDITIONAL PASS | P3006 shadow DB issue; manual migration added |

---

## 3) Architecture & key paths (PASS)

### App entry
- Page: `src/app/apps/seo-audit-roadmap/page.tsx`

### API
- Route: `src/app/api/seo-audit-roadmap/route.ts`
  - `POST`: create report row, compute deterministic audit, persist snapshot
  - `GET`: fetch activeAudit (latest completed) from DB

### Persistence model
- Prisma model + enum: `prisma/schema.prisma`
  - `SeoAuditReport`, `SeoAuditReportStatus`

---

## 4) Trust boundaries (PASS)

The tool is advisory-only and draft-only:

- No website changes, no publishing, no background jobs.
- Demo mode blocks writes (mutation routes):
  - Evidence: `src/lib/demo/assert-not-demo.ts` (used by `POST` route)

---

## 5) Tier 5B determinism & canonical report selection (PASS)

### Rules implemented

- **activeAudit = most recent COMPLETED audit**
- **Re-run creates a NEW row** (never overwrite)
- **Viewing uses stored snapshot** only (no recompute)

Evidence:
- `src/app/api/seo-audit-roadmap/route.ts`
  - `POST`: `create({ status: "DRAFT" })` → compute → `update({ status: "COMPLETED", findings, roadmap, completedAt })`
  - `GET`: `findFirst({ where: { businessId, status: "COMPLETED" }, orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }] })`
- UI snapshot usage:
  - `src/app/apps/seo-audit-roadmap/page.tsx` loads activeAudit via `GET` on mount.

---

## 6) Tenant safety verification (PASS)

### Requirements

- All DB reads/writes must be tenant-scoped (business-scoped).
- URL `businessId` must not allow cross-tenant access.
- Demo mode must remain safe.

### Implemented controls

- Server-side tenant resolution uses:
  - `src/lib/utils/resolve-business-id.server.ts` (`resolveBusinessIdServer`)
- API guards:
  - `src/app/api/seo-audit-roadmap/route.ts` enforces tenant match (non-demo)
- Demo read-only enforcement:
  - `src/lib/demo/assert-not-demo.ts` blocks `POST` writes in demo mode

Result: **No cross-tenant leakage** via exports or links (exports use activeAudit only; Fix with OBD uses internal routes only).

---

## 7) Export Center integrity guarantees (PASS)

### Rules implemented

- Export buttons disabled if no `activeAudit` exists.
- Export output must match `activeAudit` exactly (no recompute).
- Supported formats:
  - Full report (text/markdown/html)
  - Roadmap only (text/markdown)
  - Category-specific (one section) (text/markdown/html)
- Header metadata:
  - Business name (when available)
  - Generated date
  - Version id

Evidence:
- `src/app/apps/seo-audit-roadmap/ExportCenter.tsx`
  - Builds export content from `audit` + `sourceInput` props only.
  - Clipboard/download guarded (`typeof window` / `typeof navigator`).
- Section mapping is canonical and shared:
  - `src/app/apps/seo-audit-roadmap/sections.ts`

---

## 8) Tier 5C “Fix with OBD” (link-only) (PASS)

### Rules implemented

- Links only (no payload transfer, no auto apply).
- Deterministic mapping based on `sectionId + categoryKey + status`.
- Schema-related findings prioritize Schema Generator (future-proof; current deterministic audit doesn’t score schema yet).
- Content gaps prioritize Content Writer / FAQ Generator.

Evidence:
- Deterministic mapping: `src/app/apps/seo-audit-roadmap/fix-with-obd.ts`
- UI rendering: `src/app/apps/seo-audit-roadmap/FixWithOBD.tsx` + `page.tsx`
- Links are internal and contain no tenant params (no cross-tenant leakage).

---

## 9) Maintenance mode lock (PASS — doc/guardrail level)

This repo does not have an app-registry “maintenance” status (only `live|in-progress|coming-soon`), so we interpret “maintenance mode” as:

- **Snapshot-based viewing** (no recompute while viewing)
- **No auto-fix / no background tasks**
- **Small, safety-first follow-ups only**

Evidence:
- Canonical snapshot model + active selection (`SeoAuditReport`, `GET` activeAudit).
- Export Center derived from snapshot only.

---

## 10) Migration note (CONDITIONAL)

### Issue

`pnpm prisma migrate dev --create-only` fails with:

- `P3006` — shadow database apply failure
- `ERROR: relation "ProReport" already exists`

This appears to be a pre-existing migration/shadow-db issue unrelated to the SEO audit model changes.

### Mitigation applied

A manual migration SQL artifact was added for production deploy pipelines that use `prisma migrate deploy`:

- `prisma/migrations/20260115220000_add_seo_audit_report/migration.sql`

---

## 11) Verification checklist

- [ ] Auth required: signed-out requests to `/api/seo-audit-roadmap` return 401.
- [ ] Demo mode: `POST /api/seo-audit-roadmap` returns `403 DEMO_READ_ONLY`.
- [ ] Tenant guard: mismatched `businessId` query param is blocked (403).
- [ ] Determinism: run an audit, refresh `/apps/seo-audit-roadmap`, confirm the same report loads (activeAudit snapshot).
- [ ] Re-run: run twice, confirm a new `SeoAuditReport` row is created and activeAudit advances to the latest completed.
- [ ] Exports disabled when no activeAudit.
- [ ] Exports match snapshot (no recompute) and include header metadata.
- [ ] Fix with OBD links route correctly and do not carry tenant params.

---

## 12) Preflight commands

```bash
pnpm -s typecheck
pnpm -s lint
pnpm -s build
```


