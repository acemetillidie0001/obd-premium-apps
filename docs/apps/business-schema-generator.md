# Business Schema Generator

**Route:** `/apps/business-schema-generator`  
**Purpose:** Generate draft-only JSON-LD schema bundles (copy/export) for websites and SEO plugins.  
**Trust boundary:** **Nothing is published or installed automatically**; user copies/exports and installs externally.

---

## Draft-only trust boundaries

The UI explicitly states the tool is draft-only:

- `src/app/apps/business-schema-generator/page.tsx:L1198-L1203`

---

## Canonical schema state (Tier 5B)

The app uses a deterministic `SchemaDraft` model with a strict “Edited > Generated” rule:

- **Canonical selector**: `getActiveSchemaJson(draft)` returns `editedJsonld ?? generatedJsonld ?? ""`.
  - `src/app/apps/business-schema-generator/schemaDraft.ts:L55-L57`
- **Status derivation**: draft vs generated vs edited.
  - `src/app/apps/business-schema-generator/schemaDraft.ts:L59-L63`

### Regenerate behavior (non-destructive)

- Regenerate updates the **generated** layer only (never wipes edits):
  - `applyGeneratedSchema(...)` does not touch `editedJsonld`.
  - `src/app/apps/business-schema-generator/schemaDraft.ts:L75-L84`
  - Generation handler uses it on success:
  - `src/app/apps/business-schema-generator/page.tsx:L554-L575`

### Reset semantics

- **Reset to generated** clears edits only:
  - `src/app/apps/business-schema-generator/schemaDraft.ts:L123-L132`
  - UI handlers:
  - `src/app/apps/business-schema-generator/page.tsx:L1006-L1027`

---

## Inline JSON-LD editing (Tier 5B)

The “Edit JSON-LD” flow validates and preserves safety:

- **Invalid JSON** blocks save and shows inline errors.
- **Valid JSON must be an object or array** (not primitives).

Evidence:
- `src/app/apps/business-schema-generator/page.tsx:L989-L1004`

---

## Export Center (Tier 5B+)

Export Center is authoritative and always derived from the canonical active schema (`activeJson`):

- `activeJson` is computed from `getActiveSchemaJson(draft)`:
  - `src/app/apps/business-schema-generator/page.tsx:L968-L973`
- Export Center receives `activeJson` + `issues`:
  - `src/app/apps/business-schema-generator/page.tsx` (see `ExportCenter` wiring; search for `ExportCenter activeJson`)

### Formats

Export packages are available only when there are **no blocker issues**:

- **Raw JSON-LD** (`schema.jsonld`)
- **Pretty JSON** (`schema.json`)
- **HTML script tag** (`schema.html`)

Evidence:
- Blocker detection + package gating:
  - `src/app/apps/business-schema-generator/exportCenter.ts:L209-L219`
- Format builders:
  - `src/app/apps/business-schema-generator/exportCenter.ts:L169-L203`

### Readiness checks

Blockers include:
- Empty string
- Invalid JSON
- Root not object/array
- `{}` / `[]`
- Empty `@graph`

Evidence:
- `src/app/apps/business-schema-generator/exportCenter.ts:L17-L44`
- `src/app/apps/business-schema-generator/exportCenter.ts:L86-L167`

### Copy/download safety

- Download is guarded for SSR (`typeof window === "undefined"`).
- Clipboard failures are caught and surfaced as UI errors.

Evidence:
- `src/app/apps/business-schema-generator/ExportCenter.tsx:L103-L128`

---

## Tier 5C inbound handoffs (apply/dismiss + TTL + tenant guards)

Business Schema Generator supports **two inbound handoff styles**:

### 1) Tier 5C schema node handoff (sessionStorage payload)

This is the “safe additive receiver” that imports schema nodes into the active JSON-LD bundle.

- **Storage:** sessionStorage key `"obd:schema-handoff"` with TTL.
  - Receiver + TTL enforcement:
  - `src/app/apps/business-schema-generator/handoffReceiver.ts:L69-L91`
- **No auto-apply:** payload is read into UI state only; user must click Apply/Dismiss.
  - Read on mount:
  - `src/app/apps/business-schema-generator/page.tsx:L295-L308`
  - Apply/Dismiss handlers:
  - `src/app/apps/business-schema-generator/page.tsx:L751-L790`
- **Tenant guards:** strict tenant match required; mismatches are cleared.
  - `src/app/apps/business-schema-generator/page.tsx:L310-L320`
  - `src/app/apps/business-schema-generator/page.tsx:L760-L768`
- **Additive merge rules:** ensures `@graph`, prevents duplicates, does not overwrite or reorder existing nodes.
  - `src/app/apps/business-schema-generator/handoffReceiver.ts:L166-L234`
- **Persistence across regenerate:** previously imported nodes are re-merged on each regenerate.
  - `src/app/apps/business-schema-generator/page.tsx:L565-L575`

### 2) Query-based app-to-app handoffs (FAQ Generator / Content Writer)

These are legacy-style “handoff payload in URL” flows and are now **query-only** for tenant safety.

- Business Schema Generator does **not** accept localStorage-backed `handoffId` payloads.
  - `src/lib/apps/business-schema-generator/handoff-parser.ts:L1-L41`

---

## Tenant safety notes (storage)

- Drafts are stored in **sessionStorage** and are keyed by `businessId` when present.
  - `src/app/apps/business-schema-generator/page.tsx:L166-L173`
- The app avoids **localStorage** to prevent cross-tenant persistence.
  - `src/app/apps/business-schema-generator/page.tsx:L59-L61`


