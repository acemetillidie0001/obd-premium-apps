# SEO Audit & Roadmap — Status Snapshot (Maintenance Mode / Reference-Quality)

**App:** SEO Audit & Roadmap  
**Route:** `/apps/seo-audit-roadmap`  
**Status:** ✅ **LOCKED** — Maintenance Mode (Reference-Quality)  
**Automation:** None (advisory-only, draft-only)  
**Risk:** Very Low  
**Snapshot Date:** 2026-01-16  

---

## 1) Current State Summary

SEO Audit & Roadmap is a deterministic, trust-first SEO diagnostics tool that:

- Audits a **single page** (provided URL or pasted content)
- Produces a **prioritized roadmap** (dependency-aware, stable ordering saved in snapshot)
- Persists a **canonical completed snapshot** to the database and renders from that snapshot only
- Offers **optional cross-app routing** (“Fix with OBD”) as **intent-only, apply-to-inputs** suggestions (no auto-apply)
- Supports **read-only share links** to a completed snapshot (tokenized, expiring, revocable, `noindex`)

This app is locked to maintenance mode to preserve safety guarantees and prevent scope creep into automation.

---

## 2) Shipped Upgrades (Prompts 1–16 Rollup — Condensed)

**Tier 5A (UX + trust layer):**
- Accordion findings + status chips + consistent empty/loading/error handling
- Sticky action bar and clear expectation-setting trust microcopy

**Tier 5B (Canonical snapshot state):**
- DB-backed `SeoAuditReport` snapshot model with `DRAFT → COMPLETED` lifecycle
- `activeAudit = latest COMPLETED` per tenant; viewing is snapshot-only (no recompute on refresh)

**Tier 5B+ (Roadmap intelligence + trust):**
- Evidence + Confidence per finding (deterministic; derived from provided inputs; no crawling)
- Dependency-aware roadmap with stable ordering saved in the completed snapshot
- Roadmap UI buckets: Quick Wins / Big Bets (computed UI-only from snapshot)
- Version Compare (latest vs previous completed) with per-section improved/worsened/unchanged summaries
- Authoritative Export Center exporting from `activeAudit` only (full/roadmap/section, text/markdown/HTML)

**Tier 5C / 5C+ (Ecosystem, safe handoffs):**
- “Fix with OBD” links upgraded to **intent-only prefill** workflows with **Apply/Dismiss** (no auto-apply, no generation, no publish)
- Tier 5C+ apply-to-inputs handoff transport (session-scoped, 10-minute TTL, tenant-guarded, user-initiated)
- Shared Apply/Dismiss modal + standardized handoff utilities across apps
- Deterministic prefill templates:
  - Service Area Page
  - FAQ Cluster
  - Schema Fix Pack
  - On-Page Rewrite Brief

**Operational hardening + determinism:**
- Prisma shadow-DB workaround documented + safe migration scripts included
- Dev-only fixtures harness for deterministic UI verification (no API calls, no DB writes)

---

## 3) Key Safety Guarantees (Non-Negotiables)

- **Advisory-only**: no automatic site changes or “fix” actions
- **Draft-only outputs**: any downstream work is created as drafts; user must explicitly apply/save
- **No automation**: no crawlers, no background jobs, no publishing, no scheduling
- **Deterministic**: rule-based logic; stable ordering preserved in persisted snapshots
- **Tenant-safe**:
  - DB reads/writes are tenant-scoped
  - Handoffs are tenant-guarded and session-scoped with TTL
- **Share links are read-only**:
  - tokenized, expiring, revocable
  - no tenant metadata exposed
  - `noindex,nofollow` on the share page

---

## 4) Verification (Fill in Results)

Run from repo root:

```bash
pnpm -s typecheck
pnpm -s lint
pnpm -s build
```

Results:
- `pnpm -s typecheck` → ✅ PASS / ❌ FAIL: ________________________
- `pnpm -s lint` → ✅ PASS (0 errors; warnings allowed) / ❌ FAIL: ________________________
- `pnpm -s build` → ✅ PASS / ❌ FAIL: ________________________

---

## 5) Known Constraints / Operational Notes

### Prisma migrations (shadow DB workflow)

Local/dev Prisma migrations may require a shadow database configuration depending on your environment.

Primary references:
- `docs/dev/prisma-migrations.md`
- `tools/prisma-migrate-safe.cjs`

---

## 6) Evidence Pointers (Key Files)

- App UI: `src/app/apps/seo-audit-roadmap/page.tsx`
- API + snapshot persistence: `src/app/api/seo-audit-roadmap/route.ts`
- Share routes: `src/app/api/seo-audit-roadmap/share/route.ts`, `src/app/api/seo-audit-roadmap/share/revoke/route.ts`
- Share page (read-only, noindex): `src/app/share/seo-audit/[token]/page.tsx`
- Handoff contract (TTL, session scope): `src/lib/apps/seo-audit-roadmap/apply-to-inputs-handoff.ts`
- Shared handoff utilities + guard modal: `src/lib/handoff/handoff.ts`, `src/components/handoff/HandoffGuardModal.tsx`


