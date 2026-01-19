### LOCAL_KEYWORD_RESEARCH_TIER_AUDIT (LKRT)

Scope: **final evidence-based audit** of LKRT as shipped (Tier 5A / 5C / Tier 6 readiness).

This audit compares LKRT against established Tier 5C / Tier 6 patterns already present in the OBD Premium Apps monorepo.

---

## Final Tier 6 audit scorecard (PASS / FAIL)

| Section | Status | Notes |
|---|---:|---|
| **A) Determinism & canonical selector** | **PASS** | Canonical `getActiveKeywordResults()` used for active results; no recompute/mutation. |
| **B) Tier 5A UX consistency** | **PASS** | Accordion inputs, sticky action bar, disabled-not-hidden, truthful metrics badge semantics, explicit empty/loading/error states. |
| **C) Export integrity** | **PASS** | Unified Export Center; deterministic CSV schema (no comment lines); TXT is deterministic by default (timestamps are opt-in). |
| **D) Tier 5C ecosystem handoffs** | **PASS** | TTL’d + tenant-safe + Apply/Dismiss + additive-only to Local SEO + Content Writer. |
| **E) Trust & guardrails** | **PASS** | Explicit “no automation”; explicit “ads competition ≠ organic ranking guarantee”; no silent background calls. |
| **F) Google Ads metrics correctness** | **PASS** | Real Keyword Planner historical metrics; null-safe; best-effort targeting; no false “Live” without numeric metrics. |
| **G) Reliability & safety** | **PASS** | Hard per-batch timeouts + deterministic single retry; partial failures handled without dropping rows; user-visible notice. |

---

## Evidence notes (brief, code-truth)

### A) Determinism & canonical selector — PASS

- Canonical selector: `src/lib/apps/local-keyword-research/getActiveKeywordResults.ts`
- LKRT uses selector for render/export/handoff decisions: `src/app/apps/local-keyword-research/page.tsx`

### B) Tier 5A UX consistency — PASS

- Accordion input parity: `src/app/apps/local-keyword-research/page.tsx` (`AccordionSection` + section state)
- Sticky action bar + disabled-not-hidden actions: `src/app/apps/local-keyword-research/page.tsx` + `src/components/obd/OBDStickyActionBar.tsx`
- Badge truthfulness (“Live” only when numeric Google Ads metrics exist): `src/app/apps/local-keyword-research/page.tsx` (`getMetricsMode`)
- Empty/loading/error states: `src/app/apps/local-keyword-research/page.tsx`

### C) Export integrity — PASS

- Unified Export Center: `src/app/apps/local-keyword-research/components/LKRTExportCenterPanel.tsx` + `src/app/apps/local-keyword-research/page.tsx` (“Export Center” panel)
- Deterministic CSV schema (fixed columns; no comment lines; empty cells for missing metrics): `src/lib/exports/local-keyword-exports.ts` (`generateKeywordsCsv`)
- TXT report format stability (structured sections; deterministic by default; timestamps opt-in): `src/lib/exports/local-keyword-exports.ts` (`generateFullReportTxt`) + `src/app/apps/local-keyword-research/components/LKRTExportCenterPanel.tsx` (timestamp toggle)

### D) Tier 5C ecosystem handoffs — PASS

- TTL + tenant safety + Apply/Dismiss + additive-only payloads: `src/lib/apps/local-keyword-research/handoff.ts`
- Receiver (Local SEO Page Builder): `src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx` + `src/app/apps/local-seo-page-builder/components/LKRTImportBanner.tsx`
- Receiver (AI Content Writer): `src/app/apps/content-writer/page.tsx`

### E) Trust & guardrails — PASS

- “No automation” statement: `src/app/apps/local-keyword-research/page.tsx` (education copy)
- “Ads competition ≠ organic ranking guarantee” disclaimers: `src/app/apps/local-keyword-research/page.tsx` (education + post-results reminder)
- No silent background calls: LKRT API calls are user-triggered (`src/app/apps/local-keyword-research/page.tsx`)

### F) Google Ads metrics correctness — PASS

- Metrics dispatcher + safe fallbacks + diagnostics: `src/lib/local-keyword-metrics.ts` (`fetchKeywordMetricsWithDiagnostics`)
- Google Ads REST wrapper + MCC `login-customer-id` header support: `src/lib/google-ads/googleAdsRest.ts`
- Keyword Planner historical metrics ingestion + mapping (avg monthly searches, competition index, bid ranges): `src/lib/google-ads/keywordPlanner.ts`
- LKRT API merges authoritative metrics into final response (avoids relying on model echo): `src/app/api/local-keyword-research/route.ts`

### G) Reliability & safety — PASS

- Hard per-request timeout + stable timeout code: `src/lib/google-ads/googleAdsRest.ts`
- Deterministic single retry for transient failures + no row dropping: `src/lib/google-ads/keywordPlanner.ts`
- User-visible notice via `overviewNotes` on partial failures/timeouts: `src/app/api/local-keyword-research/route.ts`

---

## Known Constraints (production-truth)

- **Geo targeting is best-effort**:
  - City/state are resolved via Google Ads geo target suggestions when possible; otherwise LKRT falls back to **United States** targeting.
  - Some locations may resolve ambiguously or not at all, which can affect metric availability and precision.
- **Google Ads “Basic Access” limitations / availability**:
  - Keyword Planner fields may be restricted, quota-limited, or partially missing depending on account status and Google Ads data availability.
- **Metrics can be null even with `google-ads` enabled**:
  - Low-volume/rare keywords, upstream coverage gaps, or partial failures (timeouts/429/5xx) can yield missing metrics for some or all keywords.
  - LKRT preserves all keywords and exports empty metric cells rather than dropping rows.
- **Core strategy text remains LLM-generated**:
  - LKRT normalizes output shape, but regenerated content is not guaranteed to be identical between runs.

---

## Maintenance Mode Guarantees (stable contract)

- **Draft-only ecosystem integration**:
  - Handoffs are Apply/Dismiss only; additive-only; never overwrite; TTL’d; tenant-safe.
- **No background jobs / no scheduled pulls**:
  - Keyword metrics and generation are user-triggered only.
- **No auto-publish / no auto-apply**:
  - LKRT never publishes/schedules/changes anything automatically.
- **Deterministic, parser-safe exports**:
  - CSV schema is fixed; missing metrics export as empty cells; TXT is deterministic by default (optional opt-in timestamps).


