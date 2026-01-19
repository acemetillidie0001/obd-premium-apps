### LOCAL_KEYWORD_RESEARCH_LOCK_AUDIT (LKRT) — FINAL (after fixes 7A–7E)

Status: **LOCKED**  
Validated on `main` @ **38b3bf0**

Scope: **code-truth audit only** (no runtime changes, no dependency changes, no API/DB changes in this prompt).

Repo: OBD Premium Apps monorepo  
App: Local Keyword Research Tool (LKRT)

---

## LKRT entry points + relevant files (enumerated)

- **UI**
  - `src/app/apps/local-keyword-research/page.tsx` (LKRT app UI; canonical selector, refresh UX, badge semantics, exports/handoffs entry points)
  - `src/app/apps/local-keyword-research/components/LKRTExportCenterPanel.tsx` (unified export center actions)
- **API**
  - `src/app/api/local-keyword-research/route.ts` (main generation endpoint: OpenAI + metrics)
  - `src/app/api/local-keyword-research/rank-check/route.ts` (rank-check endpoint with explicit timeout + SSRF hardening)
  - `src/app/api/local-keyword-research/types.ts` (request/response/types)
- **Metrics**
  - `src/lib/local-keyword-metrics.ts` (metrics dispatcher, mock fallback, diagnostics)
  - `src/lib/google-ads/googleAdsRest.ts` (OAuth + REST wrapper; timeout + stable error codes)
  - `src/lib/google-ads/keywordPlanner.ts` (Keyword Planner historical metrics; batching; retry; null-safe behavior)
- **Exports**
  - `src/lib/exports/local-keyword-exports.ts` (CSV fixed schema; TXT report)
- **Canonical selector**
  - `src/lib/apps/local-keyword-research/getActiveKeywordResults.ts` (edited > generated selector)
- **Tier 5C handoffs (sender + receiver)**
  - Sender payload/TTL/sessionStorage: `src/lib/apps/local-keyword-research/handoff.ts`
  - Receiver (Local SEO): `src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx` + `src/app/apps/local-seo-page-builder/components/LKRTImportBanner.tsx`
  - Receiver (Content Writer): `src/app/apps/content-writer/page.tsx`
- **Auth middleware scope**
  - `src/middleware.ts` (protects `/` and `/apps/*`, not `/api/*`)

---

## Executive Summary (YES / NO)

**YES — Safe to mark LOCKED (maintenance-mode safe).**

LKRT now meets the lock criteria after fixes **7A–7E**: tenant-safe API scoping, safe logging, hard OpenAI timeouts, production-truth rank-check messaging, and deterministic exports (TXT deterministic by default; timestamps are opt-in).

---

## Scorecard (A–G)

| Area | Status | Rationale (short) |
|---|---:|---|
| **A) Tenant Safety + Auth Scoping** | **PASS** | LKRT API routes require auth and enforce business scoping; override attempts are rejected. Middleware still excludes `/api/*` but routes self-enforce. |
| **B) Determinism + Canonical State** | **PASS** | Canonical `getActiveKeywordResults()` used for active results; refresh is user-triggered; no background recompute/mutation. |
| **C) Google Ads Metrics Correctness + Fallback** | **PASS** | Default mock; google-ads best-effort; null-safe; does not drop keywords; badge semantics are numeric-driven; deterministic retry/timeout present. |
| **D) Reliability + Timeouts + Error Surfaces** | **PASS** | Google Ads + rank-check have explicit timeouts; LKRT main OpenAI calls are guarded with `withOpenAITimeout` and return a stable 504 TIMEOUT envelope. |
| **E) Export Integrity (Export Center + CSV/TXT)** | **PASS** | Unified Export Center; deterministic CSV schema; TXT export is deterministic by default with optional opt-in timestamps toggle. |
| **F) Tier 5C Ecosystem Handoffs (Draft-only)** | **PASS** | TTL enforced; tenant mismatch blocks Apply; Apply/Dismiss with additive-only merges; payloads versioned + minimal. |
| **G) Trust + Guardrails** | **PASS** | UI + docs now match production truth: no automation, no ranking guarantees, no ongoing tracking; rank-check is a one-time check (mock by default) and LKRT does not run a first‑party SERP scraper. |

---

## Evidence by section (brief; no large code)

## Resolved Blockers (7A–7E)

- **7A — Auth + tenant/business scoping**
  - `src/app/api/local-keyword-research/route.ts`: requires `requireUserSession()` and returns `UNAUTHORIZED` 401 when missing session (L325–L333); rejects query/body override attempts for `businessId`/`tenantId` (L337–L354, L378–L390); success response includes `scope: { businessId }` (L708–L712).
  - `src/app/api/local-keyword-research/rank-check/route.ts`: requires `requireUserSession()` and returns `UNAUTHORIZED` 401 when missing session (L169–L177); rejects body override attempts (L186–L197); success response includes `scope: { businessId }` (L274–L277).

- **7B — Remove raw model output logging**
  - `src/app/api/local-keyword-research/route.ts`: parse-failure logs include only metadata (requestId, businessId, lengths/counts) and do not print model text (ideas parse log L499–L504; final parse log L693–L700).

- **7C — Hard timeout wrapper for main OpenAI generation**
  - `src/app/api/local-keyword-research/route.ts`: both OpenAI calls are wrapped with `withOpenAITimeout` (ideas L456–L485; final L532–L553).
  - Timeout returns stable `{ ok:false, code:"TIMEOUT" }` with 504 via `apiErrorResponse` (L714–L720).

- **7D — Rank-check guardrail mismatch resolved (copy/docs)**
  - LKRT UI rank-check copy is explicit: one-time, not tracking, not a guarantee, no first‑party SERP scraper; mock by default / third‑party provider only if enabled (`src/app/apps/local-keyword-research/page.tsx` rank-check helper text, L1666–L1668; empty-state education copy L1969–L1971).
  - LKRT docs reflect “no first‑party SERP scraping” and “no ongoing tracking”: `docs/apps/local-keyword-research.md` (Guardrails + Rank Check section).

- **7E — TXT export determinism enforced**
  - `src/lib/exports/local-keyword-exports.ts`: TXT timestamps are opt-in via `options.includeTimestamps` (header emits `Generated:` only when enabled; L172–L210).
  - `src/app/apps/local-keyword-research/components/LKRTExportCenterPanel.tsx`: UI toggle exists and defaults OFF (`includeTxtTimestamps` state L32–L35; checkbox L146–L160); exporter passes timestamps only when toggle is enabled (L103–L123).

### A) Tenant Safety + Auth Scoping — PASS

- **Middleware does not protect API routes**
  - `src/middleware.ts` matcher only covers `"/", "/apps", "/apps/:path*"` (`config.matcher`, L240–L247).
- **LKRT routes self-enforce auth + business scoping**
  - `src/app/api/local-keyword-research/route.ts` requires session via `requireUserSession()` (L325–L335) and rejects query override attempts (`businessId`/`tenantId`) (L337–L354). Body override attempts are rejected (see inline checks after body parse).
  - `src/app/api/local-keyword-research/rank-check/route.ts` requires session via `requireUserSession()` (near top of `POST`) and rejects body override attempts (`businessId`/`tenantId`).
- **Rate limiting exists but is per-instance**
  - `src/app/api/local-keyword-research/route.ts` uses a module-scope in-memory `Map` (`rateLimitMap`, L23–L26). This is **per-process/per-instance** (acceptable for maintenance mode, but not a strict global quota).
- **No raw model output is logged**
  - `src/app/api/local-keyword-research/route.ts` logs parse failures using metadata only (requestId + businessId + lengths) (e.g., L499–L505 and L692–L700).
- **Handoffs are tenant-safe (positive evidence)**
  - Sender enforces businessId required: `src/lib/apps/local-keyword-research/handoff.ts` (throws if missing businessId, L119–L123)
  - Receivers block Apply on mismatch:
    - Local SEO receiver checks `lkrtImport.from.businessId !== businessId` (see `applyLkrtImport`, `src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx`, L171–L176)
    - Content Writer receiver computes mismatch and disables Apply (see `readLkrtToContentWriterSeedsHandoff` effect, `src/app/apps/content-writer/page.tsx`, around L552–L571; Apply handler blocks when mismatch).

### B) Determinism + Canonical State — PASS

- Canonical selector exists and is used for active results:
  - `src/lib/apps/local-keyword-research/getActiveKeywordResults.ts` (edited > generated)
  - `src/app/apps/local-keyword-research/page.tsx` uses it to compute `activeResult` (L122–L131).
- Refresh is user-triggered (no background recompute) and uses current inputs:
  - `src/app/apps/local-keyword-research/page.tsx` `handleRefreshResults` (L365–L386): explicitly user-triggered; calls `performRequest(form, true)`; no background refresh loop.

### C) Google Ads Metrics Correctness + Fallback — PASS

- Dispatcher defaults to mock; google-ads only when selected + credentials present:
  - `src/lib/local-keyword-metrics.ts` `fetchKeywordMetricsWithDiagnostics` (starts L195+)
  - Missing creds → mock fallback with stable code `LKRT_GOOGLE_ADS_CONFIG_MISSING` (L216–L226).
- google-ads populates numeric metrics where available, and preserves keyword rows:
  - `src/lib/google-ads/keywordPlanner.ts` builds output for every input keyword and returns null metrics when missing (see mapping into `metrics` list around L249+).
- Badge semantics “Live Google Ads” only when numeric Google Ads metrics exist:
  - `src/app/apps/local-keyword-research/page.tsx` badge logic uses `dataSource` + numeric presence (see `metricsModeLabel` and `getMetricsMode`).
- Rate limiting / timeouts / retry:
  - Timeouts + stable timeout code: `src/lib/google-ads/googleAdsRest.ts` (AbortController + `LKRT_GOOGLE_ADS_TIMEOUT`, L118–L142)
  - Deterministic single retry on transient errors: `src/lib/google-ads/keywordPlanner.ts` (`shouldRetryGoogleAdsError`, and retry path in batch loop, L88–L205)

### D) Reliability + Timeouts + Error Surfaces — PASS

- **Timeouts present**
  - Rank-check: explicit Promise.race timeout (15s) → `TIMEOUT` 504: `src/app/api/local-keyword-research/rank-check/route.ts` (L221–L253)
  - Google Ads metrics: per-request timeout + retry (see C evidence).
- **Timeouts present**
  - LKRT OpenAI calls are wrapped with `withOpenAITimeout` (ideas: `src/app/api/local-keyword-research/route.ts` L456–L485; final: L532–L553).
  - Timeout maps to a stable `{ ok:false, code:"TIMEOUT" }` 504 response (L714–L720).
- **Error envelopes**
  - Both routes use `apiErrorResponse` / `apiSuccessResponse` (`src/app/api/local-keyword-research/route.ts`, `src/app/api/local-keyword-research/rank-check/route.ts`)
- **UI error surfacing**
  - LKRT UI stores and displays error strings and has explicit empty-state guidance: `src/app/apps/local-keyword-research/page.tsx` (error panels + education copy).

### E) Export Integrity (Export Center + CSV/TXT) — PASS

- Unified Export Center exists and is the authoritative download surface:
  - `src/app/apps/local-keyword-research/components/LKRTExportCenterPanel.tsx`
  - `src/app/apps/local-keyword-research/page.tsx` renders “Export Center” panel and sticky Export scrolls to it.
- CSV deterministic schema:
  - `src/lib/exports/local-keyword-exports.ts` `generateKeywordsCsv` fixed header order and no comment lines (L87–L149).
  - Null metrics export as empty cells (same function).
- TXT report determinism:
  - Default TXT is deterministic (no timestamps in output): `src/lib/exports/local-keyword-exports.ts` `generateFullReportTxt` only prints timestamps when `includeTimestamps` is true (L172–L210).
  - Export Center toggle is opt-in and defaults OFF: `src/app/apps/local-keyword-research/components/LKRTExportCenterPanel.tsx` (toggle state L32–L35; checkbox L146–L160; callsite passes `includeTimestamps` L120–L122).
- Exports read from canonical active results:
  - Export Center uses `activeResult` (which is derived via `getActiveKeywordResults()` in the page) and uses visible keywords derived from that active result (see LKRT UI + export center).

### F) Tier 5C Ecosystem Handoffs (Draft-only) — PASS

- Sender payload guarantees:
  - Versioned payload types, TTL enforced and expired cleared: `src/lib/apps/local-keyword-research/handoff.ts` (TTL constant L14–L16; expiry enforcement in `readHandoffPayloadFromKey`, L219–L238)
  - Tenant safety: businessId required in payload `from` (L119–L123)
  - sessionStorage keys are versioned (L17–L22)
- Receivers:
  - Local SEO: import only on `?handoff=lkrt`, TTL expired clears, Apply guarded by businessId match and additive-only merge (see `LocalSeoPageBuilderClient.tsx` LKRT useEffect + `applyLkrtImport`, L134–L242 shown above)
  - Content Writer: expired clears and mismatch blocks Apply; additive-only apply (see `src/app/apps/content-writer/page.tsx` around L522–L800 shown above)
  - Import UI clearly states “Nothing is applied automatically” (banner): `src/app/apps/local-seo-page-builder/components/LKRTImportBanner.tsx` (L35–L76)

### G) Trust + Guardrails — PASS (with A caveat)

- Explicit “no automation” statement in LKRT UI:
  - `src/app/apps/local-keyword-research/page.tsx` education copy includes “No automation: nothing is published, scheduled, or changed anywhere automatically.” (L1159–L1161)
- Explicit “ads competition ≠ organic ranking guarantee” statement:
  - `src/app/apps/local-keyword-research/page.tsx` includes “Keyword Planner ads competition ≠ organic ranking guarantee.” (L1155–L1157) and a post-results reminder (L1630–L1632).
- Rank-check messaging is now aligned to production truth:
  - Rank check is **one-time and user-triggered** (no background jobs; no saved history) and is **not a ranking guarantee** (`src/app/apps/local-keyword-research/page.tsx`, Rank Check helper text).
  - LKRT does **not** run a first‑party SERP scraper; rank-check results are **mock by default** (`src/lib/local-rank-check.ts`, `LOCAL_RANK_PROVIDER` default `"mock"`, L238–L253).
  - Optional third‑party SERP API mode is documented as an environment configuration (not first‑party scraping) (`src/lib/local-rank-check.ts`, provider docs L9–L18).
- Caveat: none known that blocks LOCK; see “Known constraints” below for non-blocking limitations.

---

## Known constraints (non-blocking; production-truth)

- **Per-instance rate limiting**
  - `src/app/api/local-keyword-research/route.ts` uses an in-memory `Map` for rate limiting (L23–L26). In serverless/multi-instance deployments, this is not a strict global quota.
- **LLM output is non-deterministic across runs**
  - Strategy text, clusters, and ideas are model-generated and can vary between runs even with the same inputs (by design; no background jobs).

---

## Lock Criteria Confirmation (must be true to mark LKRT LOCKED)

- [x] `/api/local-keyword-research` and `/api/local-keyword-research/rank-check` require authenticated session and enforce tenant/business scoping.
- [x] No server logs include raw model output or sensitive request payload content.
- [x] Exports remain unified and deterministic where claimed (CSV fixed schema; no comment lines; TXT deterministic by default with opt-in timestamps).
- [x] google-ads path remains best-effort with timeouts + deterministic retry and never drops keyword rows.
- [x] Tier 5C handoffs remain draft-only, TTL’d, tenant-safe, and additive-only.
- [x] UI messaging remains production-truth (no automation; no ranking guarantees; no ongoing tracking).

---

## Golden Flow manual test plan (<= 8 steps)

1) Open LKRT under `/apps/local-keyword-research?businessId=<id>` and run once in **mock mode** (unset `LOCAL_KEYWORD_METRICS_SOURCE`).
2) Verify metrics badge shows **Mock Data** (or non–Google Ads mode) and results render (top keywords + clusters).
3) In Export Center, export **CSV** and confirm header is fixed and contains no comment lines; confirm empty metric cells exist when expected.
4) Export **TXT** and confirm report structure is readable and **deterministic by default** (no timestamps). Optional: enable the TXT timestamp toggle and confirm `Generated:` appears.
5) Enable **google-ads** env vars and set `LOCAL_KEYWORD_METRICS_SOURCE=google-ads`; run LKRT again.
6) Verify numeric metrics appear for at least some keywords and badge becomes **Live Google Ads** only when numeric metrics exist.
7) Simulate partial failure (bad `GOOGLE_ADS_LOGIN_CUSTOMER_ID` or nonsensical location); rerun and verify keywords are not dropped and a metrics notice appears in `overviewNotes`.
8) Verify Tier 5C handoffs:
   - Send to Local SEO and Content Writer; confirm Apply is additive-only.
   - Confirm tenant mismatch blocks Apply; confirm TTL expiry clears payload.

---

## Lock flip decision

**YES — Safe to mark LOCKED (maintenance-mode safe).**
