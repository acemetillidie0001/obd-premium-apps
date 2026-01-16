# SEO Audit & Roadmap

**Route:** `/apps/seo-audit-roadmap`  
**Purpose:** Deterministic (non-AI) single-page SEO audit + prioritized roadmap.  
**Trust boundary:** **Advisory-only, draft-only**. Nothing is changed automatically.

---

## Status (Maintenance Mode)

- **Status:** ✅ **LOCKED** — Maintenance Mode (Reference-Quality)
- **Risk:** **Very Low**
- **Automation:** **None**
- **Role:** SEO diagnostics + prioritization + safe routing to OBD tools
- **Non-negotiables (trust constraints):**
  - No auto-fix, auto-apply, or background mutations
  - No publishing, scheduling, or background jobs
  - No schema injection / installation into CMS/plugins
  - No crawling beyond the single provided URL/content input
  - No cross-app changes without explicit user **Apply**

---

## What it does (advisory-only)

- Audits **one page at a time** (URL fetch or pasted HTML/text) and returns:
  - Overall score/band/summary
  - 10 deterministic category checks (scored)
  - Ordered roadmap items (HIGH / MEDIUM / OPTIONAL)
- Persists a canonical **snapshot report** (Tier 5B) so refresh/viewing is stable and non-recomputing.
- Provides an authoritative Export Center (Tier 5B+) derived from **activeAudit only**.
- Provides Tier 5C+ optional “Fix with OBD” apply-to-inputs handoffs per finding (**session-scoped**, **TTL-guarded**, **user-initiated**).

---

## What it never does

- **No auto-fix**: does not modify page content, CMS settings, or site files.
- **No publish**: no deployments, no scheduled tasks, no background jobs.
- **No schema injection**: does not install JSON-LD or write to any external service/plugin.
- **No cross-app mutation**: handoffs never auto-apply and never auto-run generation. Other apps’ drafts change only after the user clicks **Apply**.
- **No AI prompt logic**: this app is deterministic/rule-based (not LLM-generated).

---

## Deterministic state rules (Tier 5B)

### Canonical report model

The canonical persistence model is `SeoAuditReport`:

- `prisma/schema.prisma` → `model SeoAuditReport`
- Fields: `businessId`, `status` (`DRAFT|COMPLETED`), `sourceInput` (JSON), `findings` (JSON), `roadmap` (JSON), timestamps.

### Active audit selection

- **activeAudit = most recent COMPLETED audit** for the current tenant (`businessId`)
- Viewing loads from DB snapshot only (no recompute on refresh)
- Re-run always creates a **new** report row (never overwrite)

Evidence:
- API (persistence + selection): `src/app/api/seo-audit-roadmap/route.ts`
  - `POST`: create `DRAFT` → compute → update `COMPLETED`
  - `GET`: select latest `COMPLETED` by `(completedAt desc, createdAt desc)`

---

## Exports overview (Tier 5B+)

Exports are generated **only from activeAudit snapshot** (no recompute).

**Export Center UI:** `src/app/apps/seo-audit-roadmap/ExportCenter.tsx`

Supported export formats:

- **Full report**
  - Plain text
  - Markdown
  - PDF-ready HTML (self-contained; copy/paste into a converter)
- **Roadmap only**
  - Plain text
  - Markdown
- **Category-specific**
  - One accordion section only (Plain / Markdown / HTML)

Headers include:
- Business name (if available)
- Generated date
- Version id (canonical snapshot id)

---

## Evidence + Confidence (Tier 5B+ trust upgrade)

Each finding (category result) may include optional:

- `evidence?: { checked?: string[]; observed?: string[]; notes?: string }`
- `confidence?: "HIGH" | "MEDIUM" | "LOW"`

Rules:
- Evidence is derived only from the **provided URL/content** and deterministic extraction (no crawling).
- If evidence is unknown, it is omitted and confidence is `LOW`.
- The UI renders an **Evidence** subpanel (collapsed by default) and a **Confidence** chip.

Evidence pointers:
- Types: `src/app/apps/seo-audit-roadmap/types.ts`
- Generation: `src/app/api/seo-audit-roadmap/route.ts` (evidence/confidence attached before persisting snapshot)
- UI: `src/app/apps/seo-audit-roadmap/page.tsx`

---

## Dependency-aware roadmap (Tier 5B+)

Roadmap items support simple dependencies:

- `dependsOnFindingIds?: string[]`
- `dependsOnRoadmapIds?: string[]`

Rules:
- Base ordering remains impact → effort.
- If a step depends on another, it is ordered **after** its dependency.
- Ordering is saved in the completed report snapshot (no live recompute during viewing).

UI:
- Dependent steps show “Do this after: X”
- Steps that are prerequisites for 2+ others show “Do this first”

Evidence pointers:
- Types: `src/app/apps/seo-audit-roadmap/types.ts`
- Server ordering: `src/app/api/seo-audit-roadmap/route.ts`
- UI labels: `src/app/apps/seo-audit-roadmap/page.tsx`

---

## Version Compare (Latest vs Previous Completed)

The app can compare the latest completed audit against the previous completed audit:

- Backend returns `previousAudit` alongside `audit` (both snapshots).
- Matching is by `findingId` when present, else `(category + title)` fallback.
- Computes improved/worsened/unchanged counts per section and a “What changed” list per section (max 5 with “view all”).

Evidence pointers:
- API: `src/app/api/seo-audit-roadmap/route.ts`
- UI: `src/app/apps/seo-audit-roadmap/page.tsx`

---

## Roadmap buckets (Quick Wins / Big Bets)

The Roadmap view includes UI-only buckets computed from the saved snapshot (not persisted):

- **Quick Wins**: impact ∈ {HIGH, MEDIUM} and effort === LOW
- **Big Bets**: impact === HIGH and effort ∈ {MEDIUM, HIGH}
- Everything else remains in “All Steps”

Evidence pointers:
- UI: `src/app/apps/seo-audit-roadmap/page.tsx`

---

## Tier 5C+ apply-to-inputs integrations (“Fix with OBD”)

For each non-good finding, the UI may show 0–4 deterministic “Fix with OBD” suggestions:

- Local SEO Page Builder
- Business Schema Generator
- AI Content Writer
- AI FAQ Generator

Rules:
- Session-scoped handoff payload (sessionStorage)
- TTL-guarded (10 minutes)
- User-initiated **Apply / Dismiss** in the receiving app
- Apply fills inputs only (no generation, no publish)
- Deterministic mapping based on `sectionId + categoryKey + status`
- Schema-related findings prioritize Schema Generator
- Content gaps prioritize Content Writer / FAQ Generator

Templates (deterministic, structured only):
- `SERVICE_AREA_PAGE`
- `FAQ_CLUSTER`
- `SCHEMA_FIX_PACK`
- `ONPAGE_REWRITE_BRIEF`

CTA labels are template-specific (e.g., “Create Service Area Page Draft”) and include tooltip copy:
“Prefills draft inputs only.”

Evidence:
- Suggestion engine: `src/app/apps/seo-audit-roadmap/fix-with-obd.ts`
- Sender UI block: `src/app/apps/seo-audit-roadmap/FixWithOBD.tsx`
- Rendered under each finding: `src/app/apps/seo-audit-roadmap/page.tsx`
- Shared handoff contract: `src/lib/apps/seo-audit-roadmap/apply-to-inputs-handoff.ts`
- Shared handoff utils: `src/lib/handoff/handoff.ts`
- Shared guard modal: `src/components/handoff/HandoffGuardModal.tsx`

---

## Tenant safety notes

- Tenant identity is enforced server-side for DB reads/writes:
  - `resolveBusinessIdServer(...)` with demo-cookie safety
  - Tenant mismatch blocks cross-tenant access
- Demo mode blocks writes:
  - `src/lib/demo/assert-not-demo.ts`

Primary evidence:
- `src/app/api/seo-audit-roadmap/route.ts`
- `src/lib/utils/resolve-business-id.server.ts`

---

## Shareable read-only report links (tokenized, expiring)

SEO Audit reports can optionally be shared via a **tokenized, expiring, read-only** link.

- **Token**: high-entropy random token (URL does **not** include `businessId`)
- **TTL**: 7 days by default
- **Revocation**: tokens can be revoked (`revokedAt`)
- **Scope**: token resolves to **exactly one** completed audit snapshot (no other audits)
- **Robots**: public share page sets `noindex,nofollow`
- **Trust microcopy**: “Read-only snapshot. Expires on DATE.”

Threat model (high-level):
- If the URL is leaked, anyone with the token can view **that one snapshot** until expiry/revocation.
- Tokens are unguessable; short TTL reduces exposure.
- The share page is read-only and does not expose tenant context or mutation actions.

---

## Dev fixtures harness (deterministic UI)

A lightweight dev-only fixtures mode exists to verify deterministic UI rendering without calling APIs:

- Fixture file: `src/fixtures/seo-audit-report.fixture.json`
- Dev-only toggle: only when `NODE_ENV !== "production"` in `src/app/apps/seo-audit-roadmap/page.tsx`
- Fixture mode avoids API calls and blocks DB-write actions (e.g. share link creation).

---

## Key files map

### App UI
- `src/app/apps/seo-audit-roadmap/page.tsx`
- `src/app/apps/seo-audit-roadmap/sections.ts` (canonical section mapping)
- `src/app/apps/seo-audit-roadmap/ExportCenter.tsx` (authoritative exports)
- `src/app/apps/seo-audit-roadmap/FixWithOBD.tsx` (Tier 5C+ apply-to-inputs sender)
- `src/lib/apps/seo-audit-roadmap/apply-to-inputs-handoff.ts` (Tier 5C+ handoff contract + TTL transport)

### API + persistence
- `src/app/api/seo-audit-roadmap/route.ts`
- `prisma/schema.prisma` (model + enum)
- `prisma/migrations/20260115220000_add_seo_audit_report/migration.sql` (manual migration; see audit report)

---

## Verification commands

```bash
pnpm -s typecheck
pnpm -s lint
pnpm -s build
```


