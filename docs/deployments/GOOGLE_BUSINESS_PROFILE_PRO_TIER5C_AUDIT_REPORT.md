# Google Business Profile Pro — Tier 5C Audit Report (Tier 5A–5B+ coverage)

Date: 2026-01-20

## Executive summary

Status: **CONDITIONAL PASS (LOCK-ready with noted constraint)**

GBP Pro meets the Tier 5A, Tier 5B, and Tier 5B+ requirements for a reference-quality draft-only workspace, and implements Tier 5C ecosystem awareness with safe apply-only receivers and additive-only merges. The single material constraint is that GBP Pro handoff payloads are **not tenant/businessId-scoped** today (the sender explicitly documents this), so “tenant mismatch protections” are limited to TTL + explicit routing + apply-only UX rather than an enforceable businessId guard.

## Evidence-based checklist (A–G)

### A) Tenant safety and scoping

- **PASS (bounded, but not businessId-guarded)**:
  - Sender payloads are versioned and include `sourceApp`, `createdAt`, `expiresAt`, and TTL seconds.
  - Transport is `sessionStorage` only (tab/session scoped), not durable storage.
  - Receivers only activate when explicitly routed (requires `?handoff=gbp` or legacy flags).
- **CONSTRAINT (why conditional)**:
  - Sender states there is no stable tenant/businessId in GBP Pro, so there is no receiver-side mismatch block (unlike LKRT → Content Writer).

Evidence:

- Sender comment + TTL constants + payload shape: `src/lib/apps/google-business-pro/handoff.ts`
- Receiver explicit routing flags:
  - Content Writer: `src/app/apps/content-writer/page.tsx` (requires `handoff=gbp`)
  - Schema Generator: `src/app/apps/business-schema-generator/page.tsx` (requires `handoff=gbp`)

### B) Draft-only guarantees + trust microcopy alignment

- **PASS**:
  - Persistent, non-dismissable “Draft-only tool” copy states no connection to or updates of a live GBP.
  - Export Center footer reiterates exports are draft-only and there are no Google API connections.

Evidence:

- Trust microcopy panel: `src/app/apps/google-business-pro/page.tsx`
- Export Center footer note: `src/app/apps/google-business-pro/components/GbpExportCenterPanel.tsx`

### C) Determinism: canonical model + edited-over-generated + regenerate semantics

- **PASS**:
  - Canonical draft model is `GoogleBusinessDraft` with `generatedContent` and `editedContent`.
  - `getActiveGbpDraft()` is the canonical selector and returns **edited** snapshot when present; otherwise generated.
  - Regenerate actions upsert generated audit/wizard while preserving edits (`preserveEdits: true`).
  - Reset behavior clears edits only; “Clear All” clears both generated and edits.

Evidence:

- Canonical model + rules + selector: `src/app/apps/google-business-pro/draft.ts`
- Reducer semantics: `src/app/apps/google-business-pro/draft-reducer.ts`
- Dispatches preserve edits on regenerate: `src/app/apps/google-business-pro/page.tsx` (`preserveEdits: true`)
- Reset/Clear wiring: `src/app/apps/google-business-pro/page.tsx`

### D) Export integrity: exports reflect active draft + blockers work + copy/download correctness

- **PASS**:
  - Export Center builds all outputs from `getActiveGbpDraft(draft)` (authoritative).
  - “Pack” exports are blocked until core required blocks exist (description/services/about).
  - Optional blocks (FAQs, posts) are warnings-only and are independently enabled/disabled for copy.
  - Copy uses `navigator.clipboard.writeText`; download uses Blob + object URL + anchor click.

Evidence:

- Export Center implementation: `src/app/apps/google-business-pro/components/GbpExportCenterPanel.tsx`
- Export Center placement + “authoritative exports” note: `src/app/apps/google-business-pro/page.tsx`

### E) Tier 5C receiver safety (TTL, Apply/Dismiss, additive-only, never overwrite)

- **PASS** for apply-only behavior and additive-only merging (with the businessId constraint noted in section A).

**GBP Pro → AI Content Writer**

- Receiver only checks when routed with `?handoff=gbp`.
- Dismiss sets a session key and clears receiver URL params; Apply is additive-only:
  - Fills empty business fields; only replaces default placeholders (Ocala/Florida) when incoming differs
  - Appends missing services lines (deduped)
  - Adds source material to template notes (append-only; never overwrites)
  - No auto-generation is triggered by import

Evidence:

- Receiver read + Apply/Dismiss handlers: `src/app/apps/content-writer/page.tsx`
- Apply-only banner microcopy: `src/app/apps/content-writer/components/GbpProImportBanner.tsx`

**GBP Pro → Schema Generator**

- Receiver only checks when routed with `?handoff=gbp`.
- Review banner + modal + explicit Apply; Dismiss clears payload and URL.
- Additive-only merge + dedupe:
  - Services appended with case-insensitive dedupe
  - FAQs appended with dedupe by question (case-insensitive trim)
  - Business context fills empty fields and avoids overwriting existing values

Evidence:

- Receiver read + Apply/Dismiss handlers + merge logic: `src/app/apps/business-schema-generator/page.tsx`
- Import banner + modal UX: 
  - `src/app/apps/business-schema-generator/components/GbpProImportReadyBanner.tsx`
  - `src/app/apps/business-schema-generator/components/GbpProImportModal.tsx`

**TTL enforcement**

- Sender writes `expiresAt` into payload; receiver-side read clears expired payloads.

Evidence:

- TTL + read/clear logic: `src/lib/apps/google-business-pro/handoff.ts`
- Receiver expiry handling:
  - `src/app/apps/content-writer/page.tsx`
  - `src/app/apps/business-schema-generator/page.tsx`

### F) No automation risk (no publish, no background jobs)

- **PASS**:
  - No publish actions exist in the app UI.
  - Cross-app interactions are either link-only CTAs or explicit Apply-only handoffs.
  - API routes are request/response and do not schedule background work.

Evidence:

- Link-only CTAs + handoff send buttons: `src/app/apps/google-business-pro/page.tsx`
- Generation API routes (OpenAI-backed, draft-only):
  - `src/app/api/google-business/audit/route.ts`
  - `src/app/api/google-business/wizard/route.ts`
  - `src/app/api/google-business/pro/route.ts`
- Pro exports:
  - `src/app/api/google-business/pro/report/route.ts`
  - `src/app/api/google-business/pro/csv/route.ts`

### G) LOCK readiness (maintenance-mode safe)

- **PASS (with noted constraint)**:
  - The shipped behavior is stable and documented: canonical draft selector, deterministic edit precedence, and exports derived from a single source of truth.
  - Tier 5C integrations are safe-by-default: explicit receiver routing, TTL clearing, Apply/Dismiss only, additive-only merges.
- **Constraint**:
  - Handoff payloads are not businessId-scoped; this is acceptable only because receivers are apply-only and transport is session-only with TTL. If future tenant scoping is added to GBP Pro, a businessId guard should be introduced for parity with LKRT/other Tier 5C handoffs.

## Key files (shipped work surface area)

- App + canonical draft:
  - `src/app/apps/google-business-pro/page.tsx`
  - `src/app/apps/google-business-pro/draft.ts`
  - `src/app/apps/google-business-pro/draft-reducer.ts`
  - `src/app/apps/google-business-pro/components/GbpExportCenterPanel.tsx`
- Tier 5C transport:
  - `src/lib/apps/google-business-pro/handoff.ts`
- Receivers:
  - `src/app/apps/content-writer/page.tsx`
  - `src/app/apps/content-writer/components/GbpProImportBanner.tsx`
  - `src/app/apps/business-schema-generator/page.tsx`
  - `src/app/apps/business-schema-generator/components/GbpProImportReadyBanner.tsx`
  - `src/app/apps/business-schema-generator/components/GbpProImportModal.tsx`
- API routes (draft generation + exports):
  - `src/app/api/google-business/audit/route.ts`
  - `src/app/api/google-business/wizard/route.ts`
  - `src/app/api/google-business/pro/route.ts`
  - `src/app/api/google-business/pro/report/route.ts`
  - `src/app/api/google-business/pro/csv/route.ts`

