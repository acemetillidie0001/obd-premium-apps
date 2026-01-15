# Business Schema Generator — Tier 5C Final Audit Report
**Date:** 2026-01-15  
**Repo:** `obd-premium-apps`  
**App Route:** `/apps/business-schema-generator`  
**Primary Files Reviewed:**
- `src/app/apps/business-schema-generator/page.tsx`
- `src/app/apps/business-schema-generator/schemaDraft.ts`
- `src/app/apps/business-schema-generator/exportCenter.ts`
- `src/app/apps/business-schema-generator/ExportCenter.tsx`
- `src/app/apps/business-schema-generator/handoffReceiver.ts`
- `src/lib/apps/business-schema-generator/handoff-parser.ts`
- `src/app/api/schema-generator/route.ts`

---

## Executive Summary

**Overall:** ✅ **PASS**  
**Final recommendation:** **LOCKED** (safe to enter maintenance mode)

This audit verified Tier 5C completion is **tenant-safe**, **deterministic/edit-safe**, and **export-correct**. Two audit-hardening fixes were applied (separately committed):
- Removed a server log that could leak DB credentials in `DATABASE_URL` (security).
- Removed `localStorage` usage + disabled localStorage-backed `handoffId` parsing for this app (tenant safety).

---

## PASS/FAIL Table (A–G)

| Section | Result |
|---|---|
| A) Tenant Safety & Auth | ✅ PASS |
| B) Draft-Only & Trust Guarantees | ✅ PASS |
| C) Deterministic Canonical State (Tier 5B) | ✅ PASS |
| D) Export Center Correctness (Tier 5B+) | ✅ PASS |
| E) Tier 5C Handoff Receiver Safety | ✅ PASS |
| F) UI/UX Parity (Tier 5A) | ✅ PASS |
| G) Error Handling & Resilience | ✅ PASS |

---

## Findings with Evidence (A–G)

### A) Tenant Safety & Auth — ✅ PASS

- **Draft persistence is tenant-keyed in sessionStorage**
  - Evidence: `schemaDraftStorageKey` includes `businessId` when present.
  - `src/app/apps/business-schema-generator/page.tsx:L166-L173`

- **Tier 5C schema handoff receiver enforces tenant match and clears mismatches**
  - Evidence: clear-on-seen mismatch:
    - `src/app/apps/business-schema-generator/page.tsx:L295-L320`
  - Evidence: mismatch is also blocked at Apply-time + cleared:
    - `src/app/apps/business-schema-generator/page.tsx:L751-L783`

- **Generator API requires auth**
  - Evidence: authenticated session required in `/api/schema-generator`.
  - `src/app/api/schema-generator/route.ts:L254-L271`

**How verified:** Reviewed app state storage keys, handoff receiver flow, and API route auth gate.

---

### B) Draft-Only & Trust Guarantees — ✅ PASS

- **UI trust microcopy matches behavior (no auto-publish/inject/install)**
  - Evidence:
  - `src/app/apps/business-schema-generator/page.tsx:L1198-L1203`

- **No CMS mutations / no background publishing in generator**
  - Evidence: generator API only returns JSON-LD; no DB writes in this route.
  - `src/app/api/schema-generator/route.ts:L295-L353`

**How verified:** Confirmed no publish/mutation pathways are invoked; exports are explicit user actions only.

---

### C) Deterministic Canonical State (Tier 5B) — ✅ PASS

- **Edited > Generated is enforced**
  - Evidence:
  - `src/app/apps/business-schema-generator/schemaDraft.ts:L55-L63`

- **Regenerate updates generated layer only (never wipes edits)**
  - Evidence:
  - `src/app/apps/business-schema-generator/schemaDraft.ts:L75-L84`
  - Generator submit uses `applyGeneratedSchema(...)`:
  - `src/app/apps/business-schema-generator/page.tsx:L554-L575`

- **Render/export/copy uses `getActiveSchemaJson()`**
  - Evidence: `activeJson` derives from `getActiveSchemaJson(draft)` and is passed to Export Center.
  - `src/app/apps/business-schema-generator/page.tsx:L968-L973`

- **Reset-to-generated clears edits only**
  - Evidence:
  - `src/app/apps/business-schema-generator/schemaDraft.ts:L123-L132`
  - UI reset handlers call `resetToGenerated`:
  - `src/app/apps/business-schema-generator/page.tsx:L1006-L1027`

**How verified:** Followed data flow from draft model → UI render → export center, and regenerate/reset handlers.

---

### D) Export Center Correctness (Tier 5B+) — ✅ PASS

- **Readiness checks: blockers actually block**
  - Evidence: empty/invalid JSON, non-object/array, `{}`, `[]`, empty `@graph` are blockers.
  - `src/app/apps/business-schema-generator/exportCenter.ts:L17-L44`
  - `src/app/apps/business-schema-generator/exportCenter.ts:L86-L167`
  - Export packages suppressed when blockers exist:
  - `src/app/apps/business-schema-generator/exportCenter.ts:L209-L219`

- **Export outputs always match active JSON**
  - Evidence: all export builders accept `activeJson` and derive outputs from it.
  - `src/app/apps/business-schema-generator/exportCenter.ts:L169-L203`

- **Copy/download are client-safe and error-handled**
  - Evidence: guarded by `typeof window` for download, clipboard errors caught and surfaced.
  - `src/app/apps/business-schema-generator/ExportCenter.tsx:L103-L128`

**How verified:** Verified validation gating and confirmed the export surface is fed by `activeJson` only.

---

### E) Tier 5C Handoff Receiver Safety — ✅ PASS

- **TTL enforcement (expired ignored + cleared)**
  - Evidence:
  - `src/app/apps/business-schema-generator/handoffReceiver.ts:L69-L91`

- **Explicit Apply/Dismiss; no auto-apply**
  - Evidence: payload is read into state only; Apply is a user click handler.
  - `src/app/apps/business-schema-generator/page.tsx:L295-L308`
  - `src/app/apps/business-schema-generator/page.tsx:L751-L790`

- **Additive merge semantics**
  - Evidence: ensures `@graph`, prevents duplicates, does not overwrite/reorder existing nodes.
  - `src/app/apps/business-schema-generator/handoffReceiver.ts:L166-L234`

- **Persistence across regenerate**
  - Evidence: previously imported nodes are re-merged into new generator output.
  - `src/app/apps/business-schema-generator/page.tsx:L565-L575`

**How verified:** Reviewed TTL parser, apply/dismiss handlers, merge logic invariants, and regenerate path.

---

### F) UI/UX Parity (Tier 5A) — ✅ PASS

- **Sticky action bar state gating**
  - Evidence: export disabled until ready, reset disabled unless edited.
  - `src/app/apps/business-schema-generator/page.tsx:L2218-L2267`

- **Trust microcopy present**
  - Evidence:
  - `src/app/apps/business-schema-generator/page.tsx:L1198-L1203`

**How verified:** Confirmed presence and wiring of Tier 5A sticky action controls and trust layer.

---

### G) Error Handling & Resilience — ✅ PASS

- **Invalid JSON edits show inline errors and do not overwrite draft**
  - Evidence: save is blocked until JSON parses and is object/array.
  - `src/app/apps/business-schema-generator/page.tsx:L989-L1004`

- **SSR guards for sessionStorage/handoff receiver**
  - Evidence:
  - `src/app/apps/business-schema-generator/handoffReceiver.ts:L69-L107`

**How verified:** Followed invalid JSON path and checked `window` guards around browser-only APIs.

---

## Fixes Applied (Audit Hardening)

### 1) Security fix — remove `DATABASE_URL` logging
- **Issue:** `DATABASE_URL` contained an API key in query params; logging it could leak secrets.
- **Fix:** Removed module-load debug log in `src/app/api/brand-profile/route.ts`.
- **Commit:** `49428f2` — `Security: remove DATABASE_URL debug log from brand-profile API`

### 2) Tenant-safety fix — remove Business Schema Generator `localStorage` usage
- **Issue:** localStorage persists across tenants/sessions; localStorage-backed `handoffId` parsing is a cross-tenant leakage vector.
- **Fix:** Business Schema Generator no longer uses localStorage; parser supports query-only `?handoff=` and rejects localStorage-backed `handoffId`.
- **Commit:** `fb1022b` — `Tenant safety: remove localStorage usage from business schema generator`
- **Evidence:** Parser is query-only:
  - `src/lib/apps/business-schema-generator/handoff-parser.ts:L1-L41`

---

## Verification Results (Commands)

Run from repo root:

- `pnpm typecheck` → ✅ PASS
- `pnpm lint` → ✅ PASS (0 errors; warnings present in other areas of repo)
- `pnpm run vercel-build` → ✅ PASS

Targeted searches run:
- `inject`, `publish`, `webhook`, `cron`, `background`, `wordpress`, `postMessage`, `localStorage`
- **Result:** No `postMessage` usage in this app; Business Schema Generator no longer uses localStorage (post-fix).

---

## Final Recommendation

✅ **LOCKED** — The Business Schema Generator is reference-quality for Tier 5C and safe to enter maintenance mode.


