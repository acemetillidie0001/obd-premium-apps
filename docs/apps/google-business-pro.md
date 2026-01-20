# Google Business Profile Pro (GBP Pro)

Google Business Profile Pro is a **draft-only** workspace for producing:

- A GBP **audit** (issues, strengths, quick wins, priority fixes)
- A GBP **content pack** (descriptions, services/about, FAQs, posts, keywords)
- An **Export Center** that produces authoritative copy/download outputs for pasting into Google Business Profile or using in downstream tools

It is intentionally **not** a Google integration: it does not connect to, fetch from, or update a live Google Business Profile.

## What the app does

- **Audit Mode**: collects business context and generates a structured GBP audit.
- **Wizard Mode**: collects content/voice settings and generates a complete GBP content pack.
- **Pro Mode**: combines the Audit + Wizard outputs into one “Pro” view and enables Pro exports (report/CSV).
- **Export Center (authoritative)**: all export outputs are computed from the **active canonical draft** (edited-over-generated) and gated by readiness blockers.

## Tier 5A (UX parity)

GBP Pro implements Tier 5A UX consistency patterns:

- **Accordion inputs**: Audit, Wizard, and Pro forms are grouped into accordion sections (first open by default; others collapsed).
- **Sticky action bar**: key actions remain visible with disabled-not-hidden behavior and clear tooltips.
- **Persistent trust microcopy**: “Draft-only tool” messaging is always visible (non-dismissable).

Primary implementation: `src/app/apps/google-business-pro/page.tsx`.

## Tier 5B (canonical draft + determinism)

GBP Pro uses a canonical draft model to keep rendering and exports deterministic:

- **Canonical model**: `GoogleBusinessDraft` (`src/app/apps/google-business-pro/draft.ts`)
- **Selector (single source of truth)**: `getActiveGbpDraft(draft)` returns **edited** content when present, otherwise generated.
- **Edited-over-generated**: edits are stored as an explicit snapshot (`editedContent`) and always win.
- **Regenerate never wipes edits**: generation actions upsert into `generatedContent` while preserving `editedContent`.
- **No implicit merge at read-time**: the selector returns either the edited snapshot or the generated snapshot; it does not “blend” them.

Key files:

- `src/app/apps/google-business-pro/draft.ts`
- `src/app/apps/google-business-pro/draft-reducer.ts`
- `src/app/apps/google-business-pro/page.tsx`

## Tier 5B+ (Export Center)

GBP Pro’s Export Center is the authoritative export surface and is designed to be “copy/paste safe”:

- **Authoritative source**: exports are built from the active canonical draft via `getActiveGbpDraft()`.
- **Validation gating**:
  - Blockers prevent exports when required Wizard content is missing (e.g., missing description/services/about).
  - Warnings communicate optional gaps (e.g., missing FAQs/posts) without blocking.
- **Copy + download correctness**: “Copy” uses the clipboard API; “Download” generates a Blob and triggers a browser download.

Primary implementation: `src/app/apps/google-business-pro/components/GbpExportCenterPanel.tsx`.

### Export list

**Quick Exports (packs)**

- Copy Plain Text pack
- Copy Markdown pack
- Download `.txt`
- Download `.md`

**GBP formatted blocks**

- Business Description (copy)
- Services (copy)
- FAQs (copy; only enabled if present)
- Posts (copy; only enabled if present)

**Pro exports (advanced, still draft-only)**

- Pro Report (HTML / PDF) export
- CSV Export (agency tools)

## Tier 5C (ecosystem awareness)

GBP Pro includes safe, ecosystem-aware “Next Steps” integrations.

### AI Content Writer handoff (apply-only)

- **Sender**: stores a TTL’d payload in `sessionStorage` and opens Content Writer with `?handoff=gbp`.
- **Receiver** (`/apps/content-writer`):
  - Shows an **Import** banner with **Apply** / **Dismiss**
  - **Apply is additive-only** (fill empty fields, append where safe; never overwrite user-authored text)
  - Nothing is generated automatically

Key files:

- Sender transport: `src/lib/apps/google-business-pro/handoff.ts`
- Sender wiring: `src/app/apps/google-business-pro/page.tsx`
- Receiver read/apply: `src/app/apps/content-writer/page.tsx`
- Receiver UI: `src/app/apps/content-writer/components/GbpProImportBanner.tsx`

### Business Schema Generator handoff (apply-only, additive + dedupe)

- **Sender**: stores a TTL’d payload in `sessionStorage` and opens Schema Generator with `?handoff=gbp`.
- **Receiver** (`/apps/business-schema-generator`):
  - Shows “Import Ready” banner → modal review → explicit **Apply**
  - **Additive-only merge**:
    - Fills business context fields only when empty (or default placeholders for city/state)
    - Appends services (deduped case-insensitively)
    - Appends FAQs (deduped by question; existing preserved)
  - Never overwrites existing services/FAQs

Key files:

- Sender transport: `src/lib/apps/google-business-pro/handoff.ts`
- Receiver wiring/merge: `src/app/apps/business-schema-generator/page.tsx`
- Receiver UI: `src/app/apps/business-schema-generator/components/GbpProImportReadyBanner.tsx`
- Receiver modal: `src/app/apps/business-schema-generator/components/GbpProImportModal.tsx`

### Link-only CTAs (no handoff writes)

- **Local SEO Page Builder**: link-only CTA
- **SEO Audit & Roadmap**: link-only CTA

## Safety guarantees

- **No Google API connections**: GBP Pro does not connect to Google or fetch/update any live GBP. It generates draft guidance and copy.
- **No auto-publish**: there is no publish action and no integration that writes to GBP.
- **No background jobs**: there are no scheduled/queued tasks triggered by GBP Pro usage.
- **Draft-only guarantees are repeated in UI**: persistent trust microcopy (“Draft-only tool”) and Export Center footer note.
- **Handoff safety**:
  - sessionStorage transport (ephemeral per-browser-tab session)
  - TTL enforced; expired payloads are cleared
  - Receivers require explicit Apply/Dismiss; no auto-apply, no auto-generation, no overwrite

Note: unlike some other Tier 5C handoffs in the ecosystem, GBP Pro handoff payloads do not currently carry a stable `businessId`/tenant identifier (see `src/lib/apps/google-business-pro/handoff.ts`). Safety relies on TTL + explicit receiver routing + apply-only UX and additive-only merge behavior.

## How to use (quick flow)

1. **Audit Mode**: enter business basics and GBP details → Generate audit.
2. **Wizard Mode**: enter content/voice settings → Generate content pack.
3. **(Optional) Pro Mode**: review combined outputs (read-only) and enable Pro exports.
4. **Export Center**:
   - Copy or download the pack (plain text / markdown)
   - Copy individual blocks (description/services/FAQs/posts)
5. **Next steps**:
   - Send draft source material to **AI Content Writer** (Apply-only)
   - Send services/FAQs to **Schema Generator** (Review + Apply; additive + dedupe)
   - Open **Local SEO Page Builder** or **SEO Audit & Roadmap** (link-only)

