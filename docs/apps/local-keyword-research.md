### Local Keyword Research Tool (LKRT) — Implementation Notes (V3.1)

This document reflects **current shipped behavior** (code-truth), including Tier 5A UX parity and Tier 5C draft-only handoffs.

---

## Current behavior (authoritative, code-truth)

### App version

- **V3.1** (export filenames are version-stamped).
  - Evidence:
    - `src/lib/exports/local-keyword-exports.ts` (`getCsvFilename` includes `-v3.1-`, ~L145–L149)
    - `src/lib/exports/local-keyword-exports.ts` (`getTxtFilename` includes `-v3.1-`, ~L327–L331)

### Primary routes / entrypoints

- **UI**: `src/app/apps/local-keyword-research/page.tsx`
- **API**: `src/app/api/local-keyword-research/route.ts`
- **Rank check API**: `src/app/api/local-keyword-research/rank-check/route.ts`
- **Types**: `src/app/api/local-keyword-research/types.ts`
- **Metrics helper**: `src/lib/local-keyword-metrics.ts`

### Operational mode (keyword metrics)

#### Data source dispatcher

- Metrics source is chosen by `LOCAL_KEYWORD_METRICS_SOURCE` with default `"mock"`.
  - Evidence: `src/lib/local-keyword-metrics.ts` dispatcher `fetchKeywordMetrics`, ~L204–L232.

#### Env-gated safety model (metrics)

- If `LOCAL_KEYWORD_METRICS_SOURCE="google-ads"`:
  - If required Google Ads env vars are missing, it **falls back to mock metrics**.
  - Evidence:
    - `src/lib/local-keyword-metrics.ts` required env list + missing-vars fallback, ~L126–L144
    - `src/lib/local-keyword-metrics.ts` credential check + warn + fallback, ~L211–L227

#### What “Google Ads” currently means (production-truth)

- If `LOCAL_KEYWORD_METRICS_SOURCE="google-ads"` and credentials are present, LKRT will fetch **Google Ads Keyword Planner historical metrics** (best-effort).
  - Evidence:
    - `src/lib/local-keyword-metrics.ts` (`fetchKeywordMetricsWithDiagnostics` + `fetchKeywordMetricsGoogleAds`)
    - `src/lib/google-ads/keywordPlanner.ts` (`fetchKeywordHistoricalMetricsGoogleAds`)
- Safety model is preserved:
  - Missing/invalid creds → falls back to **mock** metrics (no crash).
  - Request failures/timeouts → best-effort partial results (null metrics for affected keywords) and/or safe fallback to mock, with a user-visible notice in `overviewNotes`.

##### Metrics fields (exact)

When Google Ads metrics are available, LKRT normalizes into these existing keyword fields:

- `monthlySearchesExact`: from Keyword Planner **avg monthly searches** (historical)
- `adsCompetitionIndex`: normalized competition index (0–1)
- `lowTopOfPageBidUsd`: low top-of-page bid (USD, from micros)
- `highTopOfPageBidUsd`: high top-of-page bid (USD, from micros)
- `cpcUsd`: derived from average CPC when available; otherwise a conservative midpoint of low/high top-of-page bids when both exist
- `dataSource`: `"google-ads"` for Google Ads sourced metrics; `"mock"` when mock fallback is used

##### Targeting + network (production-truth)

- **Network**: Google Search
- **Language**: defaults to English
- **Geo targeting**: best-effort City/State resolution; falls back to **United States** targeting when geo suggestions fail

##### Timeouts + retries (safety)

- Each Keyword Planner batch request uses a **hard timeout (~15s)**.
- A single deterministic retry is attempted for transient failures (timeout/network/429/5xx). No infinite retries.

### API behavior (generation)

#### Output envelope + backward aware client parsing

- API success is returned as `{ ok: true, data }` via `apiSuccessResponse`.
  - Evidence: `src/lib/api/errorHandler.ts`, `apiSuccessResponse`, ~L154–L165.
- The LKRT UI is backward-compatible and accepts either:
  - `{ ok: true, data: LocalKeywordResponse }`, or
  - a direct `LocalKeywordResponse` object.
  - Evidence: `src/app/apps/local-keyword-research/page.tsx`, response parsing, ~L122–L127.

#### Deterministic output shape (normalized server-side)

- The API parses model JSON and then **normalizes** the response shape:
  - Ensures `summary` exists
  - Ensures arrays exist for `overviewNotes`, `keywordClusters`, `topPriorityKeywords`
  - Clamps `opportunityScore` to 1–100
  - Validates and normalizes `intent`, `difficultyLabel`, `dataSource`
  - Evidence: `src/app/api/local-keyword-research/route.ts`, ~L479–L558.

#### Graceful degradation (errors are explicit)

- Invalid request bodies / missing required fields return explicit errors.
  - Evidence: `src/app/api/local-keyword-research/route.ts`, ~L319–L332.
- If model output is invalid JSON at either stage, API returns a user-safe error message.
  - Evidence:
    - ideas parse failure: `src/app/api/local-keyword-research/route.ts`, ~L420–L429
    - final parse failure: `src/app/api/local-keyword-research/route.ts`, ~L559–L565
- UI surfaces server error text (no hidden failures).
  - Evidence: `src/app/apps/local-keyword-research/page.tsx`, ~L113–L140.

#### Timeouts

- **Rank check** route has an explicit 15s timeout using `Promise.race`, returning a 504 TIMEOUT error code.
  - Evidence: `src/app/api/local-keyword-research/rank-check/route.ts`, ~L221–L253.
- **Main keyword generation** route does **not** use the repo’s `withOpenAITimeout` wrapper and does not implement per-chunk timeouts.
  - Evidence:
    - `src/app/api/local-keyword-research/route.ts` calls `openai.chat.completions.create(...)` directly (no timeout wrapper).
    - `src/lib/openai-timeout.ts` exists as a pattern (30s AbortController wrapper), ~L25–L51.

### UI semantics

- A top-level status chip exists:
  - “Status: Production Ready (Pre-Google Ads Live Metrics)”
  - Evidence: `src/app/apps/local-keyword-research/page.tsx`, ~L809–L818.
- Metrics label in results:
  - “Metrics: Live Google Ads / Estimated / Estimates” determined from `dataSource` + presence of numeric metrics.
  - Evidence: `src/app/apps/local-keyword-research/page.tsx`, `getMetricsMode`, ~L217–L239; badge rendering ~L363–L371.

### Export Center (Tier 5A parity)

- LKRT now exposes a **single authoritative Export Center** panel (instead of scattered export buttons).
  - Evidence:
    - `src/app/apps/local-keyword-research/page.tsx` (renders “Export Center” panel)
    - `src/app/apps/local-keyword-research/components/LKRTExportCenterPanel.tsx` (export UI + actions)
- Export actions are **disabled-not-hidden** when results are unavailable.
  - Evidence: `src/app/apps/local-keyword-research/page.tsx` (sticky bar “Export” disabled when no active results)
- **Active results semantics**:
  - Exports operate from LKRT’s canonical selector `getActiveKeywordResults()` (edited wins over generated).
  - Evidence: `src/lib/apps/local-keyword-research/getActiveKeywordResults.ts`

### CSV export schema (deterministic + parser-safe)

LKRT CSV exports are **schema-stable**:

- **No comment lines**: CSV output contains only a header row + data rows (no `# ...` metadata block).
- **Fixed column order** (always present, always in this order):
  1. `keyword`
  2. `location`
  3. `nearMe`
  4. `dataSource`
  5. `avgMonthlySearches`
  6. `competition`
  7. `lowTopOfPageBid`
  8. `highTopOfPageBid`
  9. `notes`
- **Null metrics behavior**:
  - When Google Ads metrics are `null` (or metrics are absent), the CSV exports **empty cells** for metric columns (columns are never dropped).

Evidence: `src/lib/exports/local-keyword-exports.ts` (`generateKeywordsCsv` fixed-schema implementation and inline schema comment).

---

## Tier gap analysis (Tier 5C / Tier 6 reference parity)

### A) Determinism & State — ✅ PASS

- **Single canonical active-results selector**: ✅ PASS
  - Evidence: `src/lib/apps/local-keyword-research/getActiveKeywordResults.ts` (edited wins over generated; no recompute/mutation).
- **Regenerate stability**: ⚠️ PARTIAL
  - Shape is normalized server-side, but content is LLM-generated and not guaranteed stable between regenerations.
- **Edited state protection**: ✅ PASS (not applicable)
  - LKRT does not implement editable output state (unlike Local SEO Page Builder draft/edit model).

### B) UX Consistency (Tier 5A) — ✅ PASS

- **Accordion input parity**: ✅ PASS
  - Evidence: `src/app/apps/local-keyword-research/page.tsx` (accordion sections with collapsed summaries).
- **Sticky action bar**: ✅ PASS
  - Evidence: `src/app/apps/local-keyword-research/page.tsx` (`OBDStickyActionBar` Refresh/Export actions; disabled-not-hidden).
- **Disabled-not-hidden actions**: ✅ PASS
  - Evidence: LKRT action buttons remain visible but disabled when unavailable (export/refresh/handoff).
- **Error/loading/empty states**: ✅ PASS
  - LKRT shows explicit error panels and a “no results match filters” empty state with clear-filters action.
- **Badge semantics (Live vs Mock)**: ✅ PASS
  - “Live” only when numeric metrics exist; otherwise “Google Ads (Connected — Metrics Pending)” or “Mock Data”.

### C) Export Integrity — ⚠️ PARTIAL

- **Single authoritative Export Center**: ✅ PASS
  - Evidence:
    - `src/app/apps/local-keyword-research/page.tsx` (Export Center panel)
    - `src/app/apps/local-keyword-research/components/LKRTExportCenterPanel.tsx`
- **Snapshot-only exports**: ⚠️ PARTIAL
  - LKRT exports reflect current UI-derived arrays at click time (e.g., filtered/sorted).
- **CSV safety & schema stability**: ✅ PASS
  - Deterministic fixed CSV columns; no comment lines; null metrics export as empty cells.
  - Evidence: `src/lib/exports/local-keyword-exports.ts` (`generateKeywordsCsv`)

### D) Ecosystem Awareness (Tier 5C) — ✅ PASS

Implemented two safe, draft-only handoffs (Apply/Dismiss receivers; no auto-apply):

- **LKRT → Local SEO Page Builder** (draft input suggestions)
  - Evidence:
    - Sender UI: `src/app/apps/local-keyword-research/page.tsx` (“Send → Local SEO”)
    - Payload/types/storage: `src/lib/apps/local-keyword-research/handoff.ts` (`lkrt:local-seo-suggestions:v1`, TTL, sessionStorage key)
    - Receiver panel + additive apply: `src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx`
- **LKRT → AI Content Writer** (topic + keyword seeds)
  - Evidence:
    - Sender UI: `src/app/apps/local-keyword-research/page.tsx` (“Send → Content Writer”)
    - Payload/types/storage: `src/lib/apps/local-keyword-research/handoff.ts` (`lkrt:content-seeds:v1`, TTL, sessionStorage key)
    - Receiver panel + additive apply: `src/app/apps/content-writer/page.tsx`

Guardrails enforced in receivers:

- **Tenant-safe**: Apply disabled on business mismatch with warning: “This handoff was created for a different business.”
- **TTL enforced**: expired payload is cleared and user sees “Expired” toast
- **Draft-only + explicit Apply/Dismiss**: nothing is applied automatically; no auto-generation; no background work
- **Additive-only**: receivers fill-empty or append safely; never overwrite existing user text

### E) Trust & Guardrails — ⚠️ PARTIAL

- **Clear “no automation” messaging**: ✅ PASS (LKRT explicitly states nothing is published/scheduled automatically).
- **Clear “ad data ≠ ranking guarantee” disclaimer**: ⚠️ PARTIAL (some “estimates” messaging exists, but not a strong disclaimer).
- **No background jobs**: ✅ PASS (user-triggered only).
- **No silent API calls**: ✅ PASS (explicit user actions initiate requests).

---

## Upgrade roadmap (Tier-safe, non-breaking)

### Tier 5A — UX Consistency (UI-only)

- **Canonical sticky action bar**
  - Add `OBDStickyActionBar` to keep Generate / Regenerate / Export / Copy actions consistently accessible.
  - Ensure actions are **disabled-not-hidden** with short “why disabled” helper text.

- **Deterministic refresh UX**
  - Display a “Generated from:” summary using `lastRequest` (city/state, goal, toggles, maxKeywords).
  - Add conservative notice: “Regenerate may change results.”

- **Empty-state education**
  - Pre-run guidance panel (“How to use your keyword strategy” + what metrics mean).
  - Filter-empty state: keep “Clear filters” plus 1–2 lines explaining how to broaden.

- **Input accordion with summaries**
  - Split form into accordion sections with summary lines (business/location/targeting/strategy/voice/extras).

- **Badge semantics tightening**
  - Only label “Live” when numeric Google Ads Keyword Planner metrics are present; otherwise label as “Google Ads (Connected — Metrics Pending)”, “Mock Data”, or “No metrics”.

### Tier 5C — Ecosystem Integration (Draft-only, explicit Apply/Dismiss)

Use existing repo conventions:

- TTL + sessionStorage transport (`src/lib/obd-framework/social-handoff-transport.ts`)
- Import guard (`src/lib/utils/handoff-guard.ts`)
- URL/localStorage parsing utilities (`src/lib/utils/parse-handoff.ts`)
- Zod validation patterns where available (`src/lib/handoff/validators.ts`)

Planned draft-only handoffs:

- **LKRT → Local SEO Page Builder (draft input suggestions)**
  - Payload contains: location, business type/services, and a curated keyword set (e.g., topPriorityKeywords).
  - Receiver shows an import banner with **Apply / Dismiss** only; no auto-apply; no auto-generate.

- **LKRT → Content Writer (topic/keyword seeding)**
  - Payload contains: suggested topics/angles and keywords; additive only.
  - Receiver uses Apply/Dismiss and respects payload size caps.

Design constraints:

- **Tenant-safe** (no cross-tenant share), **TTL-protected**, **additive-only**, **review-first**.

---

## Tier 5C handoffs (implemented)

### Overview (shared guarantees)

- **Draft-only**: no automatic application across apps; user must click **Apply**.
- **TTL’d**: sessionStorage payloads expire after ~10 minutes and are cleared on read if expired.
- **Tenant-safe**: payload includes `businessId`; receivers disable Apply if mismatch and show: **“This handoff was created for a different business.”**
- **Apply/Dismiss**: both receivers provide explicit **Apply** (primary) and **Dismiss** (secondary).
- **Cleanup**: payload cleared on **Dismiss**, **successful Apply**, and **TTL expiry**.

### LKRT → Local SEO Page Builder

- **Transport**: sessionStorage key `obd:handoff:lkrt:local-seo-suggestions:v1` (versioned payload `lkrt:local-seo-suggestions:v1`)
- **Receiver flag**: navigates with `?handoff=lkrt`
- **Apply semantics (additive only)**:
  - Fills empty location fields (city/state)
  - If `primaryService` is empty, fills from top suggested keyword
  - Appends remaining keyword suggestions into `secondaryServices` (deduped; never overwrites)

### LKRT → AI Content Writer

- **Transport**: sessionStorage key `obd:handoff:lkrt:content-seeds:v1` (versioned payload `lkrt:content-seeds:v1`)
- **Receiver flag**: navigates with `?handoff=lkrt`
- **Apply semantics (additive only)**:
  - If `topic` is empty, fills from first suggested topic
  - Appends keyword suggestions into the `keywords` input (comma-separated; deduped)
  - If the “ideas” textarea (`customOutline`) is empty, inserts a bullet list of topic ideas (fill-empty-only; does not append)
  - **No auto-generation**; user-triggered generation only

### Tier 6 — Advisory Enhancements (non-predictive)

- **Intent explanation UI**
  - Tooltips and filters that explain “informational / transactional / local”, without guaranteeing outcomes.

- **Local modifier detection**
  - UI-only tagging (city/state/near-me/zip/neighborhood patterns), described as advisory.

- **Competitive density interpretation**
  - If `adsCompetitionIndex` present, label as **ad-market competition**, not SEO ranking predictiveness.

---

## Guardrails (hard non-goals)

This list is mandatory and must be treated as hard constraints:

- **❌ Rank tracking**
- **❌ SERP scraping**
- **❌ Keyword difficulty scores that imply ranking certainty**
- **❌ Auto-publishing / auto-application into other apps**
- **❌ Scheduled/automatic re-pulling of Ads data**
- **❌ Cross-tenant sharing**

---

## Red flags (production-truth)

- Google Ads Keyword Planner metrics are **best-effort** and can be partially missing (per-keyword) due to upstream data availability, targeting constraints, or transient API failures.
  - LKRT preserves shape and does not drop keywords; missing metrics export as empty cells.
- **Main generation API has no explicit timeout wrapper**, unlike other routes that use `withOpenAITimeout` patterns or explicit timeouts.
  - Evidence: `src/app/api/local-keyword-research/route.ts` OpenAI calls; `src/lib/openai-timeout.ts`, ~L25–L51.


---

## Environment & Diagnostics (production-truth)

### Required env vars (Google Ads Keyword Planner historical metrics)

- `LOCAL_KEYWORD_METRICS_SOURCE=google-ads`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CLIENT_CUSTOMER_ID` (numbers only; the **account being queried**)
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`

Helper:
- A helper script exists to obtain `GOOGLE_ADS_REFRESH_TOKEN`: `scripts/get-google-ads-refresh-token.js`

### Optional MCC (Manager account support)

- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (numbers only; **MCC/manager** account ID)

Meaning:
- `GOOGLE_ADS_CLIENT_CUSTOMER_ID` = the **client** account you want metrics for.
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` = the **manager/MCC** account used for access (sent as the `login-customer-id` header).

### Fallback + failure behavior

- **Creds missing / invalid**: LKRT falls back to **mock** metrics (no crash).
- **Timeouts / 429 / partial failures**:
  - LKRT uses **best-effort** Keyword Planner calls.
  - Metrics may be `null` for some/all keywords, but **keywords are not dropped**.
  - A user-visible metrics notice is surfaced via `overviewNotes` when relevant.
- **Exports**:
  - CSV schema stays fixed; missing metrics export as **empty cells** (no comment lines).

### Confirming mode in the UI + exports

- **UI badge**:
  - “Live Google Ads” only when numeric metrics exist for at least some keywords.
  - “Google Ads (Connected — Metrics Pending)” when Google Ads is selected but no numeric metrics were returned.
  - “Mock Data” when mock metrics are in use.
- **CSV export**:
  - `dataSource` column reflects `"google-ads"` vs `"mock"`.
  - Metric columns (`avgMonthlySearches`, `competition`, `lowTopOfPageBid`, `highTopOfPageBid`) will be blank when not available.

### Troubleshooting (quick)

- **Badge shows “Google Ads (Connected — Metrics Pending)”**
  - Common causes: keywords have no available data for the current targeting, upstream partial failures/timeouts, or access limitations.
  - Check for a metrics notice in `overviewNotes`.
- **401 / 403 errors (common causes)**
  - Invalid/expired refresh token, incorrect OAuth client id/secret, missing/invalid developer token, or account permission issues.
  - If using an MCC, verify `GOOGLE_ADS_LOGIN_CUSTOMER_ID` and `GOOGLE_ADS_CLIENT_CUSTOMER_ID` are correct and numbers-only.
- **429 rate limiting**
  - LKRT performs a single deterministic retry for transient failures.
  - If still rate-limited, metrics may remain null for some/all keywords in that run (rows retained).

---

## Golden Flow Verification Checklist (Operator Ready, <5 minutes)

### 1) Mock mode run (no Google Ads env vars)

- Ensure `LOCAL_KEYWORD_METRICS_SOURCE` is unset or set to `mock`, and no `GOOGLE_ADS_*` vars are present.
- Run LKRT once with normal inputs.
- Verify:
  - Metrics badge shows **Mock Data** (or non–Google Ads mode), and the app does not crash.
  - Results render (top keywords + clusters).
  - Export Center: TXT and CSV buttons are present and disabled-not-hidden before results exist.

### 2) Google Ads mode run (env vars configured)

- Set `LOCAL_KEYWORD_METRICS_SOURCE=google-ads` and configure required env vars (`GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CLIENT_CUSTOMER_ID`).
  - Optional (MCC): `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
- Run LKRT once.
- Verify:
  - At least some keywords show numeric metrics (volume/competition/bids where available).
  - Metrics badge shows **Live Google Ads** only when numeric Google Ads metrics are present.

### 3) Partial failure simulation (must be null-safe; no row drops)

- Simulate a transient/targeting failure:
  - Set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to an invalid value (or use a deliberately nonsensical location input in the LKRT form).
- Run LKRT once.
- Verify:
  - App still returns results (no crash).
  - Keywords remain present; metrics may be empty for some/all keywords but **rows are not dropped**.
  - A clear metrics notice surfaces in the UI (via `overviewNotes`) when partial failures/timeouts occur.

### 4) Export Center checks (TXT + CSV)

- Export TXT and CSV from the Export Center.
- Verify CSV is parser-safe:
  - First line is the header row with fixed columns (no `#` comment lines anywhere):
    - `keyword,location,nearMe,dataSource,avgMonthlySearches,competition,lowTopOfPageBid,highTopOfPageBid,notes`
  - When metrics are missing, cells are empty (columns still present).

### 5) Tier 5C handoff checks (Apply/Dismiss + tenant safety + TTL)

- From LKRT, send to:
  - **Local SEO Page Builder** → Apply is **additive-only** (fill empty + append; never overwrite).
  - **AI Content Writer** → Apply is **additive-only** (fill empty + append; never overwrite; no auto-generation).
- Tenant mismatch:
  - Open receiver under a different `businessId` and confirm **Apply is blocked** with a clear warning.
- TTL expiry:
  - Wait past TTL (or simulate by adjusting `createdAt/expiresAt`) and confirm payload is cleared and user sees an expired/cleared behavior.
