### LOCAL_KEYWORD_RESEARCH_TIER_AUDIT (LKRT)

Scope: **analysis and documentation only** (no runtime changes, no API changes, no new dependencies).

This audit compares LKRT against established Tier 5C / Tier 6 patterns already present in the OBD Premium Apps monorepo.

---

## PASS / PARTIAL / MISSING scorecard

### A) Determinism & State

- **Single canonical active-results selector equivalent**: ❌ MISSING
- **Regenerate results stable**: ⚠️ PARTIAL (shape stable; content not guaranteed stable)
- **Edited state protected**: ✅ PASS (not applicable; LKRT does not support edits)

### B) UX Consistency (Tier 5A)

- **Accordion input parity**: ❌ MISSING
- **Canonical sticky action bar**: ❌ MISSING
- **Disabled-not-hidden actions**: ⚠️ PARTIAL
- **Error/loading/empty states**: ✅ PASS
- **Badge semantics (Live vs Mock)**: ⚠️ PARTIAL

### C) Export Integrity

- **Single authoritative Export Center**: ❌ MISSING
- **Snapshot-only export**: ⚠️ PARTIAL
- **CSV safety & schema stability**: ⚠️ PARTIAL

### D) Ecosystem Awareness (Tier 5C)

- **Safe handoff to Local SEO Page Builder**: ❌ MISSING
- **Safe handoff to AI Content Writer**: ❌ MISSING
- **Safe handoff to SEO Audit & Roadmap**: ❌ MISSING
- **Tenant-safe + TTL-protected + additive-only**: ❌ MISSING

### E) Trust & Guardrails

- **Clear “no automation” messaging**: ❌ MISSING
- **Clear “ad data ≠ ranking guarantee” disclaimer**: ⚠️ PARTIAL
- **No background jobs**: ✅ PASS
- **No silent API calls**: ✅ PASS

---

## Evidence-based findings (code-truth)

### Versioning

- LKRT exports are version-stamped **v3.1** in filenames.
  - Evidence:
    - `src/lib/exports/local-keyword-exports.ts` (`getCsvFilename`, ~L145–L149)
    - `src/lib/exports/local-keyword-exports.ts` (`getTxtFilename`, ~L327–L331)

### Metrics source selection & fallback

- Dispatcher uses `LOCAL_KEYWORD_METRICS_SOURCE` defaulting to `"mock"`.
  - Evidence: `src/lib/local-keyword-metrics.ts` `fetchKeywordMetrics`, ~L204–L232.
- If `LOCAL_KEYWORD_METRICS_SOURCE="google-ads"` but required env vars are missing, it falls back to mock.
  - Evidence: `src/lib/local-keyword-metrics.ts`, ~L126–L144 and ~L211–L227.

### Google Ads metrics status (implementation state)

- “Google Ads” metrics fetcher is currently a stub returning `null` metrics while labeling `dataSource: "google-ads"`.
  - Evidence: `src/lib/local-keyword-metrics.ts`, `fetchKeywordMetricsGoogleAds`, ~L117–L190.

### API envelope and deterministic output shape

- API envelope standard is `{ ok: true, data }` / `{ ok: false, error, code }`.
  - Evidence: `src/lib/api/errorHandler.ts`, ~L78–L165.
- LKRT route normalizes/clamps the parsed model response into a stable shape.
  - Evidence: `src/app/api/local-keyword-research/route.ts`, ~L479–L558.
- Client is backward-compatible with both wrapped and direct response formats.
  - Evidence: `src/app/apps/local-keyword-research/page.tsx`, response extraction, ~L122–L127.

### Timeout protections

- Rank check endpoint has explicit timeout protection (15s) and returns TIMEOUT (504).
  - Evidence: `src/app/api/local-keyword-research/rank-check/route.ts`, ~L221–L253.
- Main LKRT generation endpoint does not use the repo’s OpenAI timeout wrapper.
  - Evidence:
    - `src/app/api/local-keyword-research/route.ts` OpenAI calls are direct (no `withOpenAITimeout`)
    - `src/lib/openai-timeout.ts` exists as a standard wrapper (~L25–L51)

### Tier 5C reference patterns (what “good” looks like in this repo)

- Local SEO Page Builder Tier 5C foundations:
  - TTL + versioned storage keys + “active content only” payload semantics.
  - Evidence: `src/app/apps/local-seo-page-builder/handoffs/builders.ts`, header comments + TTL/keys near top (~L11–L29).
- Canonical selector pattern exists in suite (edited-over-generated).
  - Evidence: `src/lib/apps/event-campaign-builder/getActiveCampaign.ts`, ~L22–L27.

---

## Risk assessment (production-grade, conservative)

### Overall risk: **Low-to-Moderate**

- **Low** in terms of external-integration blast radius:
  - Google Ads and SerpAPI “real” paths are not implemented (reduces risk of quota burn / external coupling).
- **Moderate** in terms of user trust + operational behavior:
  - **Metrics labeling risk**: UI can present “Live Google Ads” mode while metrics are null (because `dataSource` can be `"google-ads"` even when data isn’t populated).
    - Risk: user misinterpretation; support burden; trust erosion.
  - **Timeout risk**: main generation route lacks explicit OpenAI timeout handling; could hang under upstream slowness.
    - Risk: perceived outages; request pileups; poor UX.
  - **Export risk**: CSV contains comment metadata lines and conditional columns; can break strict CSV consumers and downstream automation expectations.

---

## Hard guardrails (explicit non-goals)

These must NOT be built as part of Tier upgrades:

- **❌ Rank tracking** (no persisted rank history; no longitudinal tracking)
- **❌ SERP scraping** (no headless scraping, no custom scrapers)
- **❌ Keyword difficulty scores that imply ranking certainty** (no predictive guarantees)
- **❌ Auto-publishing / auto-application** (no automatic pushes into other apps; Apply/Dismiss only)
- **❌ Scheduled re-pulling of Ads data** (no cron/background jobs; user-triggered only)
- **❌ Cross-tenant sharing** (no shared payloads/caches across tenants)


