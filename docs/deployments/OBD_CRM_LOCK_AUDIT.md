### OBD_CRM_LOCK_AUDIT — FINAL (LKRT-style lock flip)

Status: **LOCKED** (Maintenance Mode)  
Validated on `main` @ **<TBD_COMMIT_HASH>**

Repo: OBD Premium Apps monorepo  
App: OBD CRM (`/apps/obd-crm`)

Scope: **docs-only lock flip** based on an existing PASS audit report. No runtime, API, DB, or dependency changes in this prompt.

---

## Executive Summary (YES / NO)

**YES — Safe to mark LOCKED (maintenance-mode safe).**

CRM Optional upgrades 1–4 are covered by a **PASS** audit with evidence-backed checks across tenant safety, determinism/canonical view model alignment, export/import integrity, Tier 5C read-only safety, and UI resilience.

---

## Evidence pointers (PASS audit report)

- **PASS audit report:** `docs/deployments/OBD_CRM_LOCK_AUDIT_REPORT.md`
  - Includes: shipped Optional 1–4 summary + A–G scorecard with file+line evidence + punch-list.

---

## LOCK criteria checklist (must remain true in maintenance mode)

- [x] **Tenant safety + auth scoping**
  - All `/api/obd-crm/*` routes require premium access and scope reads/writes to `businessId` (user.id).
- [x] **No automation / no background jobs**
  - No scheduling, no sending, no background jobs added by CRM Optional 1–4.
- [x] **Determinism + canonical view model**
  - `getActiveContacts()` is the canonical selector for list/counters/export inputs and uses a stable today window.
- [x] **Export integrity**
  - Export reflects current view (filters + sort) and aligns follow-up bucket boundaries via UI-provided `todayWindow`.
- [x] **Import integrity (explicit, non-destructive)**
  - CSV import remains explicit/confirm-based; create-only; duplicates skipped; errors surfaced.
- [x] **Tier 5C safety**
  - Cross-app reads (Scheduler) are read-only and tenant-safe, with exact email match filtering.
- [x] **UI resilience + calm messaging**
  - Sticky toolbars, accordion filters, deterministic empty/no-results states; snapshot and timeline are informational and mobile-safe.

---

## Files changed in the upgrade wave (Optional 1–4 + support)

**UI**
- `src/app/apps/obd-crm/page.tsx` (Saved Views, Health Snapshot, CSV Import UX polish, canonical selector wiring, export inputs)
- `src/app/apps/obd-crm/contacts/[id]/page.tsx` (read-only Signals + Timeline rendering)

**Canonical selector / logic**
- `src/lib/apps/obd-crm/selectors/getActiveContacts.ts` (canonical list model, deterministic buckets + normalized filter/sort)
- `src/lib/apps/obd-crm/timeline.ts` (read-only timeline builder)

**Docs / audit**
- `docs/apps/obd-crm.md` (Optional 1–4 descriptions + guarantees)
- `CHANGELOG.md` (Optional 1–4 entry)
- `docs/deployments/OBD_CRM_LOCK_AUDIT_REPORT.md` (PASS audit report with evidence)
- `docs/deployments/OBD_CRM_LOCK_AUDIT.md` (this file; LKRT-style LOCK marker)

---

## Verification (must PASS to stay LOCKED)

Commands:

- `pnpm run typecheck`
- `pnpm run vercel-build`

Result: **PASS** (see latest CI/local verification logs for this lock flip commit).

---

## Commit (filled after commit)

- Message: `docs(obd-crm): mark CRM LOCKED after lock audit pass`
- Hash: `<TBD_COMMIT_HASH>`


