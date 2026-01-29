# Help Center — LOCK Audit (Public, Read-Only)

Status: LOCKED (maintenance-mode safe)
Validated on main @ cf181d50595e7c5dfeff1d0bcb14aa0cfa177012

## Executive summary

- Help Center is **public-safe** and **tenant-safe by design** (global workspace only; no business context).
- The UI and API are **read-only** (query-only surface; no publishing; no uploads; no account actions).
- UX is **search-first and deterministic**, with explicit empty/loading/success/error states and a clear reset path.
- Resilience is intentionally simple: **IP rate limiting**, strict request validation, and safe upstream parsing.
- Operationally, seed docs live in `docs/help-center/**` and must be ingested into the global workspace outside the app.

## A–G scorecard (LOCK)

| Category | Result | Notes |
|---|---|---|
| A) Tenant safety: global-only, no business context/auth required, no client-supplied workspace | PASS | Workspace slug is forced from env and the request schema rejects extra fields; no tenant/business resolution occurs. |
| B) Determinism: request -> answer text only; clear empty/loading/success/error states | PASS | The API returns answer text only, and the UI renders explicit states with predictable reset and follow-up behavior. |
| C) No automation/mutation: read-only UI + query-only API; no background jobs | PASS | No write endpoints or background jobs are used by Help Center; it is a pure query surface. |
| D) Export integrity: NA (Help Center has no exports) | NA | Help Center does not export, publish, apply, or hand off payloads. |
| E) Tier 5A UX parity: calm tone, accessible controls, mobile-safe, consistent components | PASS | Calm microcopy, keyboard-reachable controls, and mobile-safe layout patterns are used throughout. |
| F) Ecosystem safety: NA (no apply/handoff receivers; query-only surface) | NA | Help Center is not a receiver and does not accept cross-app handoff payloads. |
| G) Resilience: rate limiting, fail-closed config, version-aware client, non-JSON+SSE safe parsing | PASS | Public endpoint is IP rate-limited; config is server-controlled; AnythingLLM client is version-aware and parsing is guarded. |

## Evidence (paths only)

- `src/app/api/help-center/query/route.ts`
- `src/lib/integrations/anythingllm/client.ts`
- `src/app/help-center/HelpCenterClient.tsx`
- `docs/help-center/**` seed pack

