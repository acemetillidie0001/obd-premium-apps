# AI Help Desk — Tier 5C LOCK Audit Report (Final)

Status: LOCKED (maintenance-mode safe)
Validated on main @ b2fd2470438ef897538c397fde791199a899088c
Audit date: 2026-01-24
Repo: OBD (Cursor build)

## Executive summary

**PASS** — The AI Help Desk meets Tier 5C LOCK expectations for tenant safety, routing safety, deterministic UI guardrails, and “no automation” posture. User-facing trust microcopy is present in both the app and the widget, and all cross-app movement is either **link-only** or **apply-only** with **session-only** transport and TTL/tenant guards.

## A–G Scorecard (LOCK)

### A) Tenant safety — **PASS**

**Why**: Requests are tenant-scoped by `businessId → workspaceSlug` mapping, with explicit blocked-slug guards against global/default workspaces.

**Evidence**
- **Blocked global/default workspace slugs + tenant safety error**: `src/lib/integrations/anythingllm/scoping.ts` (L11–L41)
- **Production requires mapping; dev fallback requires explicit env; both are tenant-safe**: `src/lib/integrations/anythingllm/scoping.ts` (L51–L119)
- **Search requires `businessId` and uses tenant-scoped workspace slug**: `src/app/api/ai-help-desk/search/route.ts` (L20–L76)
- **Chat requires `businessId` and uses tenant-scoped workspace slug**: `src/app/api/ai-help-desk/chat/route.ts` (L21–L67)

### B) Determinism (UI + state) — **PASS**

**Why**: Key safety indicators and dismissals are deterministic, derived from existing values only, and do not mutate data unless the user explicitly performs an action.

**Evidence**
- **Knowledge status indicator is deterministic (Empty/Partial/Ready)**: `src/app/apps/ai-help-desk/page.tsx` (L258–L289)
- **Knowledge status derives from existing connection test data only**: `src/app/apps/ai-help-desk/page.tsx` (L327–L335)
- **Session-only TTL envelope read/write is deterministic and defensive**: `src/app/apps/ai-help-desk/page.tsx` (L106–L163)

**Explicit note (required)**  
- **Knowledge status indicator logic is deterministic and derived from existing data only**: `src/app/apps/ai-help-desk/page.tsx` (L258–L268, L327–L335)

### C) No automation / no background execution — **PASS**

**Why**: No auto-publishing, no background jobs. All write operations require explicit user action (“Apply”, “Confirm import”, “Save Settings”, etc.). Cross-app “Next Steps” is navigation only.

**Evidence**
- **Next Steps panel is link-only navigation**: `src/app/apps/ai-help-desk/page.tsx` (L165–L255)
- **FAQ Generator handoff is apply-only; import is initiated by explicit handler**: `src/app/apps/ai-help-desk/page.tsx` (L618–L715)
- **Widget settings handoff is apply-only and requires explicit “Save Settings” to publish**: `src/app/apps/ai-help-desk/widget/components/WidgetSettings.tsx` (L531–L547)

### D) Export / handoff integrity (where applicable) — **PASS**

**Why**: Tier 5C handoffs use **sessionStorage**, include TTL and tenant guards, validate payload shape, and clear handoff state after use. Imports are additive and de-duplicated.

**Evidence**
- **Tier 5C TTL guard + URL cleanup for query-param handoff**: `src/app/apps/ai-help-desk/page.tsx` (L467–L481)
- **Tier 5C tenant/business guard for query-param handoff**: `src/app/apps/ai-help-desk/page.tsx` (L505–L525)
- **Tier 5C sessionStorage handoff receiver: version/TTL/tenant + payload validation + clearing**: `src/app/apps/ai-help-desk/page.tsx` (L527–L616)
- **Additive import + de-dupe + “already imported” guard + sessionStorage clear after apply**: `src/app/apps/ai-help-desk/page.tsx` (L625–L707)

### E) UX parity & trust clarity — **PASS**

**Why**: Draft-only trust messaging exists in both the app and the widget. Insights UI uses a copy-only subtitle (does not change behavior). “Next Steps” is link-only and dismisses session-only.

**Evidence**
- **Draft-only trust microcopy (Search panel)**: `src/app/apps/ai-help-desk/page.tsx` (L2336–L2339)
- **Draft-only trust microcopy (Chat panel)**: `src/app/apps/ai-help-desk/page.tsx` (L2988–L2991)
- **Draft-only trust microcopy (Widget)**: `src/app/widget/ai-help-desk/page.tsx` (L443–L446)
- **“Customer Questions (Insights)” label is copy-only**: `src/app/apps/ai-help-desk/insights/components/InsightsPanel.tsx` (L304–L310)

**Explicit notes (required)**
- **Draft-only trust microcopy exists in app + widget**: `src/app/apps/ai-help-desk/page.tsx` (L2336–L2339, L2988–L2991), `src/app/widget/ai-help-desk/page.tsx` (L443–L446)
- **“Customer Questions (Insights)” label is copy-only**: `src/app/apps/ai-help-desk/insights/components/InsightsPanel.tsx` (L304–L310)

### F) Tier 5C routing safety — **PASS**

**Why**: Cross-app flows use safe routing patterns: session-only handoffs, TTL enforcement, tenant guards, and URL parameter cleanup. No automatic cross-app payload application.

**Evidence**
- **FAQ Generator sessionStorage receiver: TTL + tenant guard + payload validation + clear**: `src/app/apps/ai-help-desk/page.tsx` (L527–L616)
- **Query-param handoff TTL guard + cleanup**: `src/app/apps/ai-help-desk/page.tsx` (L467–L481)
- **Next Steps panel is link-only (no payload transfer)**: `src/app/apps/ai-help-desk/page.tsx` (L165–L255)

**Explicit note (required)**  
- **Next Steps panel is link-only and dismissal is session-only TTL**: `src/app/apps/ai-help-desk/page.tsx` (L165–L207, L228–L253)

### G) Resilience & failure safety — **PASS**

**Why**: Session storage and handoff parsing are wrapped in `try/catch` with safe fallbacks. Invalid/expired/mismatched payloads are cleared and do not break core UI.

**Evidence**
- **Defensive session TTL flag parsing (invalid JSON/shape clears safely)**: `src/app/apps/ai-help-desk/page.tsx` (L120–L147)
- **FAQ Generator sessionStorage receiver safely clears on invalid payloads / exceptions**: `src/app/apps/ai-help-desk/page.tsx` (L547–L616)
- **API routes use schema validation + centralized error handling**: `src/app/api/ai-help-desk/search/route.ts` (L20–L80), `src/app/api/ai-help-desk/chat/route.ts` (L21–L132)

## Dismiss key standardization (session-only + legacy migration)

**Explicit note (required)**  
Dismiss key standardization uses `sessionStorage` for dismissals and legacy migration is session-only.

**Evidence**
- **Next Steps dismissal uses session-only TTL envelope + migrates legacy key**: `src/app/apps/ai-help-desk/page.tsx` (L106–L184, L203–L208)
- **First-run guidance dismissal is session-scoped and per business+workspace**: `src/app/apps/ai-help-desk/components/FirstRunContentGuidancePanel.tsx` (L23–L83)
- **Content Writer “Import Ready” dismissal migrates legacy key to tier5c key (session-only)**: `src/app/apps/ai-help-desk/page.tsx` (L796–L814)

## Notes / non-goals verified

- **No AI behavior changes introduced by this audit**: This report is evidence-based against current code and UI copy only.
- **No schema changes / no new routes / no background jobs required for LOCK**: Changes for this prompt were documentation + audit only.

