# Local SEO Page Builder

**Status:** ✅ Production Ready (Template-Based v1 + Tier 5A UX patterns + Tier 5C draft-only handoffs)  
**Last Updated:** 2026-01-15

## Overview

The Local SEO Page Builder generates a **draft-only local landing page content pack** for a service-based business targeting a specific **service + city** combination.

This tool is **template-based** (not AI-generated). It produces structured outputs that are designed to be **reviewed, edited, and exported** for manual use on a website.

## What the app does

- Generates:
  - SEO Pack (meta title, meta description, slug, H1)
  - Full Page Copy (combined) + Page Sections (hero/intro/services/why/areas/cta)
  - FAQs (deterministic, template-based)
  - Optional Schema JSON-LD (WebPage + FAQPage)
- Supports draft-only editing and exports (copy/download) in multiple formats.

## Determinism & draft model

### Canonical state: `LocalSEODraft`

The app uses a canonical draft model:

- **Generated baseline**: `draft.generated` (server response from `/api/local-seo-page-builder`)
- **Edits**: `draft.edits` (client-side overrides)
- **Active content**: derived via selectors in `src/app/apps/local-seo-page-builder/draft.ts`:
  - `getActivePageCopy()` → `edits.pageCopy ?? generated.pageCopy ?? ""`
  - `getActiveSeoPack()` → `edits.seoPack ?? generated.seoPack`
  - `getActiveFaqs()` → `edits.faqs ?? generated.faqs ?? []`
  - `getActivePageSections()` → `edits.pageSections ?? generated.pageSections`
  - `getActiveSchemaJsonLd()` → `edits.schemaJsonLd ?? generated.schemaJsonLd`

**Rule:** edited output always overrides generated output (edited > generated).

### Regenerate behavior (protect edits)

- **Generate** clears prior edits (fresh baseline).
- **Regenerate** re-generates from the last successful payload and **preserves edits** (`preserveEdits: true`).

### Deterministic “Edited” state

The reducer drops no-op edits that exactly match the generated baseline (so “Edited” is truthful and stable).

## Export Center: outputs & destinations

There are two export surfaces:

### 1) Inline Export section + sticky export buttons (legacy, still supported)

- Download `.txt`
- Download `.html` (only when Output Format is HTML)
- Download schema `.json` (only when schema exists)

### 2) Export Center panel (canonical, active-content based)

The Export Center always uses **active content** (edited wins).

- **Quick Exports (copy)**:
  - Copy Plain Text
  - Copy Markdown
  - Copy HTML
- **Downloads**:
  - Download `.txt`
  - Download `.md`
  - Download `.html`
  - Download schema `.json` (when available)
- **Destination Exports (Reuse Kit)**:
  - Copy for GBP
  - Copy for Divi
  - Copy for Directory

## Tier 5C: Next Steps handoffs (draft-only)

The Local SEO app includes a **Next Steps** panel with three **user-initiated** handoff buttons:

1. **Send Page Copy → AI Content Writer**
2. **Send FAQs → AI FAQ Generator**
3. **Suggest Q&A → AI Help Desk**

### Transport & TTL

Handoffs are sent via **sessionStorage** using per-destination keys:

- `obd:handoff:local-seo-page-builder:content-writer:v1`
- `obd:handoff:local-seo-page-builder:faq-generator:v1`
- `obd:handoff:local-seo-page-builder:ai-help-desk:v1`

Each payload includes:

- `createdAt` (ISO)
- `expiresAt` (ISO)

The TTL is **10 minutes** (`LOCAL_SEO_HANDOFF_TTL_MS = 10 * 60 * 1000`).

### Confirmation + disabled-until-ready behavior

- Each Next Steps button is **disabled until the relevant active content exists**:
  - Content Writer: requires non-empty active page copy
  - FAQ Generator: requires at least one non-empty FAQ question
  - AI Help Desk: requires at least one FAQ with both question and answer
- Clicking a button opens a **confirmation modal**.
- **Confirm** stores the payload to `sessionStorage` and navigates to the destination app.
- **Cancel / close** has **no side effects** (no payload written).

### What each button does (and does not do)

#### Send Page Copy → AI Content Writer

- **Does**: builds a draft payload from the **active** Local SEO draft and stores it in `sessionStorage` for the Content Writer to consume.
- **Does not**:
  - Auto-import or auto-apply anything in Content Writer
  - Create content automatically or publish anywhere

#### Send FAQs → AI FAQ Generator

- **Does**: sends your **active FAQ questions** as seed questions for FAQ generation/refinement.
- **Does not**:
  - Auto-generate FAQs in the destination app
  - Overwrite any existing FAQ Generator state

#### Suggest Q&A → AI Help Desk

- **Does**: sends your **active FAQ Q&A pairs** as a **suggestion** for review-first import into Help Desk Knowledge.
- **Does not**:
  - Write to the Help Desk knowledge base automatically
  - Sync or mutate content across apps

## Trust & safety guarantees

- **Draft-only**: this app never publishes or updates a website.
- **No automation**: no background jobs, no scheduled actions, no auto-handoffs.
- **User-initiated only**: exports and handoffs occur only after explicit user actions.
- **No cross-app mutation**: the Local SEO app only writes handoff payloads to the browser session; receivers must explicitly import/apply.

## Key files map

### App UI

- `src/app/apps/local-seo-page-builder/page.tsx`: app entrypoint
- `src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx`: main client implementation (draft model, Export Center, Next Steps)

### Draft model + determinism

- `src/app/apps/local-seo-page-builder/draft.ts`: `LocalSEODraft` types + active selectors
- `src/app/apps/local-seo-page-builder/draft-reducer.ts`: reducer (preserve edits on regenerate, drop no-op edits)
- `src/app/apps/local-seo-page-builder/types.ts`: request/response/types

### Editors (inline edits)

- `src/app/apps/local-seo-page-builder/editors/SeoPackEditor.tsx`
- `src/app/apps/local-seo-page-builder/editors/PageCopyEditor.tsx`
- `src/app/apps/local-seo-page-builder/editors/FaqsEditor.tsx`
- `src/app/apps/local-seo-page-builder/editors/PageSectionsEditor.tsx`

### Export Center

- `src/app/apps/local-seo-page-builder/components/LocalSeoExportCenterPanel.tsx`

### Tier 5C handoffs

- `src/app/apps/local-seo-page-builder/handoffs/builders.ts`: payload builders + `sessionStorage` key helpers + TTL enforcement

### API

- `src/app/api/local-seo-page-builder/route.ts`: deterministic, template-based generator (SEO pack, copy, FAQs, optional schema)

## Verification commands

```bash
pnpm -s typecheck
pnpm -s lint:repo
pnpm -s build
```


