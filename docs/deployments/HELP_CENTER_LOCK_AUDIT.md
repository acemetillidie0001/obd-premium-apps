# Help Center — LOCK Audit (Public, Read-Only)

Status: LOCKED (maintenance-mode safe)
Validated on main @ <COMMIT_HASH_PLACEHOLDER>

## Executive summary

- **PASS** — Help Center is public-safe and tenant-safe by design (global workspace only; no identity; no `businessId` accepted).
- **PASS** — Read-only posture: no uploads, no account actions, no publishing, no automation.
- **PASS** — Deterministic, calm UX with explicit Empty/Loading/Success/Error states and a visible reset path (“Clear search”).
- **PASS** — Resilience: IP rate limiting, strict request validation, upstream non-JSON guard, and safe error responses.
- **Operational note** — Seed docs (`docs/help-center/*`) must be ingested into the global AnythingLLM workspace (outside the app).

## A–G scorecard (LOCK)

| Category | Result | Notes |
|---|---|---|
| A) Tenant safety (global-only, no `businessId` accepted, forced workspace slug) | PASS | API request schema is strict (rejects extra fields) and workspace slug is forced from env (client cannot choose). |
| B) Determinism (clear UI states; no hidden recompute beyond query; reset works) | PASS | UI is explicit and state-driven; queries run only on submit/chip click; “Clear search” resets to empty state without reload. |
| C) No automation / no mutation (read-only UI + API) | PASS | No write surfaces exist in Help Center UI; API exposes only `POST /api/help-center/query` and returns answers only. |
| D) Export integrity | PASS | **N/A —** Help Center has no export actions and no “apply”/handoff receivers. |
| E) Tier 5A UX parity (calm empty/loading/error; accessible controls; mobile-safe) | PASS | Search-first layout with calm helper copy, accessible buttons/labels, and mobile-safe spacing; prompt chips remain clickable and de-emphasize after first query. |
| F) Tier 5C routing safety | PASS | **N/A —** Help Center is a sink/query-only surface and does not accept cross-app handoffs or routing payloads. |
| G) Resilience (rate limiting; upstream non-JSON/HTML guard; safe errors) | PASS | Public endpoint is IP rate-limited; JSON parsing guarded; errors return safe messages (no stack traces / secrets). |

## Evidence (paths + best-effort line ranges)

### UI (page + client)

- **Route wrapper + metadata**: `src/app/help-center/page.tsx` (L1–L11)
- **Trust microcopy (header)**: `src/app/help-center/HelpCenterClient.tsx` (L188–L198)
- **Search input + submit flow**: `src/app/help-center/HelpCenterClient.tsx` (L201–L228)
- **Empty-state guidance + calm helper copy**: `src/app/help-center/HelpCenterClient.tsx` (L269–L278, L312–L322)
- **Explicit UI states (Loading / Error / Success)**: `src/app/help-center/HelpCenterClient.tsx` (L324–L405)
- **Chips dim after first query** (`hasSearched` + `chipClassName`): `src/app/help-center/HelpCenterClient.tsx` (L34–L35, L74–L83, L178–L183, L285–L295)
- **Clear search reset** (UI-only reset to empty state): `src/app/help-center/HelpCenterClient.tsx` (L141–L151, L339–L348)
- **Answer card trust footer**: `src/app/help-center/HelpCenterClient.tsx` (L362–L366)
- **“Search tips” non-modal popover** (tap/hover/focus, dismiss on outside/Escape): `src/app/help-center/HelpCenterClient.tsx` (L153–L176, L230–L267)

### API (public read-only query contract)

- **Strict request validation (no extra fields)**: `src/app/api/help-center/query/route.ts` (L11–L21)
- **IP rate limiting + retry-after**: `src/app/api/help-center/query/route.ts` (L22–L59, L66–L80)
- **Workspace slug forced from env (client cannot choose)**: `src/app/api/help-center/query/route.ts` (L61–L64, L100–L103)
- **Upstream non-JSON/HTML guard (AnythingLLM content-type detection)**: `src/lib/integrations/anythingllm/client.ts` (L165–L225)
- **Client/API response JSON guard** (handles HTML/non-JSON responses safely): `src/app/help-center/HelpCenterClient.tsx` (L96–L102)
- **Safe logging (no query text logged)**: `src/app/api/help-center/query/route.ts` (L101–L112)
- **Safe error handling (no upstream leakage)**: `src/app/api/help-center/query/route.ts` (L118–L135)

### Routing / navigation safety

- **/help redirects to /help-center**: `src/app/(public)/help/page.tsx` (L1–L9)
- **Footer link to Help Center**: `src/app/layout.tsx` (L122–L138)

### Seed knowledge pack (operational ingestion into global workspace)

- **Seed docs directory (to ingest into AnythingLLM global Help Center workspace)**: `docs/help-center/*` (multiple files)
  - `docs/help-center/trust-safety-principles.md`
  - `docs/help-center/getting-started-with-obd-premium.md`
  - `docs/help-center/help-center-scope.md`
  - `docs/help-center/common-questions.md`
  - `docs/help-center/apps/*`
  - `docs/help-center/answer-style-guide.md`

