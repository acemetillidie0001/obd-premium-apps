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

#### What “Google Ads” currently means (important)

- The `fetchKeywordMetricsGoogleAds` implementation is currently a **stub**:
  - It returns `dataSource: "google-ads"` but all metrics fields are `null`.
  - Evidence: `src/lib/local-keyword-metrics.ts` `fetchKeywordMetricsGoogleAds`, ~L117–L190.

**Implication**: “Live Google Ads Keyword Planner metrics” are **not currently implemented** in the codebase, even if env vars are present.

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

- **Single authoritative Export Center**: ❌ MISSING
  - Tier reference: `LocalSeoExportCenterPanel` centralizes exports with blockers/warnings and “Active Content” semantics.
  - LKRT exports are embedded as buttons inside the results panel.
- **Snapshot-only exports**: ⚠️ PARTIAL
  - LKRT exports reflect current UI-derived arrays at click time (e.g., filtered/sorted).
- **CSV safety & schema stability**: ⚠️ PARTIAL
  - LKRT CSV includes a metadata header block (`# ...`) and conditionally includes columns, which can reduce importer compatibility and schema stability.

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

- **Clear “no automation” messaging**: ❌ MISSING (LKRT does not explicitly state no publishing/automation).
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
  - Only label “Live” when numeric metrics are present; otherwise label as “Mock” or “No metrics”.
  - Avoid implying Google Ads live metrics while the source is stubbed.

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

## Red flags (code-truth mismatches to intended claims)

- **Google Ads “live metrics” are not implemented** (Google Ads path returns null metrics; UI can still show a “Live Google Ads” mode based on `dataSource`).
  - Evidence: `src/lib/local-keyword-metrics.ts`, ~L117–L190; `src/app/apps/local-keyword-research/page.tsx`, `getMetricsMode`, ~L217–L239.
- **Main generation API has no explicit timeout wrapper**, unlike other routes that use `withOpenAITimeout` patterns or explicit timeouts.
  - Evidence: `src/app/api/local-keyword-research/route.ts` OpenAI calls; `src/lib/openai-timeout.ts`, ~L25–L51.


