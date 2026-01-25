## Tenant scoping — final sweep (audit-grade)

**Date**: 2026-01-25  
**Scope scanned**: `src/app/api/**`  
**Related hardening commits (Prompt 25–27)**:
- `92a1b04` — Prompt 25 (`LOCAL_KEYWORD_RESEARCH` AppKey)
- `efe83ab` — Prompt 26 (Scheduler core routes hardened)
- `56de28a` — Prompt 27 (LKRT rank-check + read-only routes hardened)

### Final scan results (Part A)

**Unsafe tenant derivation patterns (must be 0 for PASS)**:
- `searchParams.get("businessId")`: **0**
- `new URL(req.url).searchParams.get("businessId")`: **0**
- `.get("businessId")` (any): **0**
- `businessId = user.id`: **0**
- `// V3: userId = businessId`: **0**
- `resolveBusinessIdServer(`: **0**

**Adoption counters**:
- `requireTenant(` occurrences: **76**
- `requireBusinessContext(` occurrences: **11**

**Request-body compatibility signals**:
- `businessId: z.*` occurrences: **13** (across **12** files)
- `tenantId` occurrences: **2** (across **2** files)

### Findings classification (Part B)

**PASS** — No API routes under `src/app/api/**` derive tenant via query string, request body, or `user.id`.

- **High risk (mutations using unsafe tenant derivation)**: **None found**
- **Medium risk (GET-only using unsafe tenant derivation)**: **None found**
- **OK (membership-derived scoping)**: Routes using `requireTenant()` / `requireBusinessContext()`

**Notes on body fields**:
- Some endpoints still accept `businessId` / `tenantId` fields in request schemas for **backwards-compatible shape validation**. Where present in business-app routes, they are **ignored for tenant scoping** (tenant is derived from membership).
- Some endpoints are **public widget endpoints** and accept `businessId` as a public identifier (not membership tenant scoping). These are not used to grant authenticated business access.

### Guarantees (Part C)

- **Tenant is derived server-side via membership** (`requireTenant()` / `requireBusinessContext()`).
- **Query/body `businessId` is ignored for scoping**; retained only for backwards-compatible shape validation where needed.
- **Dev-only warnings exist** via `warnIfBusinessIdParamPresent()`.
- **No automation/background jobs were introduced** by this tenant hardening work.

### Verification

- `pnpm run typecheck`
- `pnpm run vercel-build`

### Vercel deploy confirmation note

`git push` won’t “confirm” a deploy by itself. The reliable confirmation is the Vercel dashboard (Deployments) or deployment logs. If the project is wired to `main`, pushing to `main` should deploy automatically.

