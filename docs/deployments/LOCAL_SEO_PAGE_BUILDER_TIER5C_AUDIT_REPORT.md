# Local SEO Page Builder — Tier 5C Audit Report (Reference-Quality)

**Date:** 2026-01-15  
**Scope:**  
- `src/app/apps/local-seo-page-builder/**`  
- `src/app/apps/content-writer/components/FAQImportBanner.tsx`  
- `src/app/apps/ai-help-desk/knowledge/components/FAQImportBanner.tsx`  
- Shared handoff utilities **used by Local SEO handoffs** (none; Local SEO uses a local `sessionStorage` transport)

## 1) Executive Summary

- **Status:** **CONDITIONAL PASS**
- **Tier status:** **5B+ + 5C** (also includes Tier 5A UX parity patterns)
- **Risk level:** **Low safety risk / Medium functional completeness risk**

### Key outcomes

- **Safety posture (PASS):** Tier 5C handoffs are **draft-only**, **user-initiated**, and do **not** mutate destination apps automatically.
- **Functional completeness (CONDITIONAL):** In this repo version, the destination apps do not appear to read the Local SEO `sessionStorage` handoff keys (no receiver wiring found). This preserves safety but limits usefulness until receivers are wired.

## 2) Architecture & determinism (PASS)

### Canonical `LocalSEODraft` present

The app uses a canonical draft model with separate **generated baseline** and **edits**, plus selector-style “active” getters.

Evidence (canonical selectors; edited > generated):

```42:60:src/app/apps/local-seo-page-builder/draft.ts
export function getActiveSeoPack(draft: LocalSEODraft): SEOPack | undefined {
  return draft.edits.seoPack ?? draft.generated?.seoPack;
}

export function getActivePageCopy(draft: LocalSEODraft): string {
  return draft.edits.pageCopy ?? draft.generated?.pageCopy ?? "";
}

export function getActiveFaqs(draft: LocalSEODraft): FAQItem[] {
  return draft.edits.faqs ?? draft.generated?.faqs ?? [];
}

export function getActivePageSections(draft: LocalSEODraft): PageSections | undefined {
  return draft.edits.pageSections ?? draft.generated?.pageSections;
}

export function getActiveSchemaJsonLd(draft: LocalSEODraft): string | undefined {
  return draft.edits.schemaJsonLd ?? draft.generated?.schemaJsonLd;
}
```

### Selectors enforce edited > generated for render + exports

The main client derives all “active” content via the selectors above and uses those values for exports, Export Center, and handoffs.

Evidence (active values used for Export Center + handoffs; “edited wins” messaging):

```120:125:src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx
  const activeSeoPack = useMemo(() => getActiveSeoPack(draft), [draft]);
  const activePageCopy = useMemo(() => getActivePageCopy(draft), [draft]);
  const activeFaqs = useMemo(() => getActiveFaqs(draft), [draft]);
  const activePageSections = useMemo(() => getActivePageSections(draft), [draft]);
  const activeSchemaJsonLd = useMemo(() => getActiveSchemaJsonLd(draft), [draft]);
```

### Regenerate behavior preserves edits

- Generate sets `preserveEdits: false` (fresh baseline).
- Regenerate sets `preserveEdits: true` (protects edits).

Evidence:

```486:552:src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx
      if (response.ok && response.data) {
        dispatch({
          type: "GENERATE_SUCCESS",
          payloadUsed: apiPayload,
          response: response.data,
          preserveEdits: false,
        });
        setUndoStack([]);
        // ...
      }
// ...
      if (response.ok && response.data) {
        dispatch({
          type: "GENERATE_SUCCESS",
          payloadUsed: lastPayload,
          response: response.data,
          preserveEdits: true,
        });
        recordGeneration("lseo-analytics");
        // ...
      }
```

Reducer support:

```74:85:src/app/apps/local-seo-page-builder/draft-reducer.ts
    case "GENERATE_SUCCESS": {
      const next: LocalSEODraft = {
        ...state,
        generated: action.response,
        error: null,
        sourceInputs: {
          ...state.sourceInputs,
          lastPayload: action.payloadUsed,
        },
        edits: action.preserveEdits ? state.edits : {},
      };
      return { ...next, status: recomputeStatus(next) };
    }
```

### Reset semantics correct (section + all)

- **Per-section reset**: `RESET_SECTION`
- **Global reset edits**: `RESET_ALL_EDITS`

Evidence (reducer):

```114:124:src/app/apps/local-seo-page-builder/draft-reducer.ts
    case "RESET_SECTION": {
      const edits: LocalSEOEdits = { ...state.edits };
      delete edits[action.key];
      const next: LocalSEODraft = { ...state, edits };
      return { ...next, status: recomputeStatus(next) };
    }

    case "RESET_ALL_EDITS": {
      const next: LocalSEODraft = { ...state, edits: {}, error: null };
      return { ...next, status: recomputeStatus(next) };
    }
```

## 3) UX parity (Tier 5A/5B) (PASS)

### Accordion inputs + summaries

The main form is broken into accordion sections with expand/collapse and summary helpers (Tier 5A parity).

Evidence (accordion state + expand/collapse helpers exist):

```148:185:src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx
  const [accordionState, setAccordionState] = useState({
    pageBasics: true,
    businessInfo: true,
    locationTargeting: true,
    onPageSeoTone: false,
    contentAndCtas: false,
    schemaAndOutput: false,
    export: false,
  });
// ...
  const expandAll = () => {
    setAccordionState({
      pageBasics: true,
      businessInfo: true,
      locationTargeting: true,
      onPageSeoTone: true,
      contentAndCtas: true,
      schemaAndOutput: true,
      export: true,
    });
  };
```

### Sticky action bar + status chip

The bottom sticky action bar includes Generate/Regenerate/Reset/Reset edits/Export actions and a status chip.

Evidence:

```1351:1409:src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx
          <OBDStickyActionBar isDark={isDark} left={statusChip}>
            <button type="submit" disabled={loading} className={SUBMIT_BUTTON_CLASSES}>
              {loading ? "Generating…" : "Generate"}
            </button>
            <button type="button" onClick={handleRegenerate} disabled={loading || !lastPayload}>Regenerate</button>
            <button type="button" onClick={handleReset} disabled={loading}>Reset</button>
            <button type="button" onClick={handleResetAllEdits} disabled={loading || !hasEdits(draft.edits)}>Reset edits</button>
            <button type="button" onClick={handleExportTxt} disabled={!result}>Export .txt</button>
            {/* ... */}
          </OBDStickyActionBar>
```

### Empty/error/success states

- Empty state is shown via `OBDResultsPanel` empty props.
- Error state includes Retry and Reset actions.
- Success toast appears after downloads.

Evidence (results panel configured for empty state + draft-only subtitle):

```1756:1765:src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx
      <OBDResultsPanel
        title="Your SEO Page Content"
        subtitle="Draft-only output. Export when ready."
        isDark={isDark}
        className="mt-8"
        loading={loading}
        loadingText="Generating your local SEO page pack…"
        emptyTitle="No page yet"
        emptyDescription="Fill out the inputs above and click Generate to create your local landing page pack."
      >
```

## 4) Export integrity (PASS)

### Inline export guards preserved

Inline Export buttons are guarded:

- `.txt` requires `result`
- `.html` requires `result` and `outputFormat === "HTML"`
- schema `.json` requires `result` and `activeSchemaJsonLd`

Evidence:

```1296:1344:src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx
                      <button ... onClick={handleExportTxt} disabled={!result}>Export .txt</button>
                      <button ... onClick={handleExportHtml} disabled={!result || form.outputFormat !== "HTML"}>Export .html</button>
                      <button ... onClick={handleExportJson} disabled={!result || !activeSchemaJsonLd}>Export schema .json</button>
```

### Export Center uses active selectors + readiness blockers/warnings

The Export Center panel takes active content and applies a readiness blocker when no active content exists.

Evidence:

```189:211:src/app/apps/local-seo-page-builder/components/LocalSeoExportCenterPanel.tsx
  const hasActiveContent = useMemo(() => {
    return (
      (activeSeoPack !== undefined) ||
      (activePageCopy && activePageCopy.trim().length > 0) ||
      (activeFaqs && activeFaqs.length > 0)
    );
  }, [activeSeoPack, activePageCopy, activeFaqs]);

  const blockers = useMemo(() => {
    const b: string[] = [];
    if (!hasActiveContent) b.push("Generate content to enable exports.");
    return b;
  }, [hasActiveContent]);
```

Schema download in Export Center is guarded (`disabled || !activeSchemaJsonLd`), so schema exports only occur when schema exists.

## 5) Tier 5C handoffs (most important)

### Payload builders: JSON-serializable, draft-only, active selectors (PASS)

Builders are plain JSON objects, include ISO timestamps, and use active selectors.

Evidence (Tier 5C foundations + TTL + per-destination sessionStorage keys):

```11:29:src/app/apps/local-seo-page-builder/handoffs/builders.ts
/**
 * Tier 5C foundations — Local SEO Page Builder cross-app handoff payload builders.
 *
 * Notes:
 * - Draft-only: these payloads are designed for review-first import in target apps.
 * - JSON-safe: plain objects/arrays + ISO timestamps (no Date objects).
 * - Active content only: edited output overrides generated output via selectors.
 * - Transport is intentionally NOT wired here (sessionStorage + TTL handled by sender UI later).
 */

export const LOCAL_SEO_HANDOFF_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Tier 5C per-sender sessionStorage keys (sender writes; receiver reads + validates TTL).
export const LOCAL_SEO_TO_CONTENT_WRITER_HANDOFF_STORAGE_KEY_V1 =
  "obd:handoff:local-seo-page-builder:content-writer:v1";
export const LOCAL_SEO_TO_FAQ_GENERATOR_HANDOFF_STORAGE_KEY_V1 =
  "obd:handoff:local-seo-page-builder:faq-generator:v1";
export const LOCAL_SEO_TO_AI_HELP_DESK_HANDOFF_STORAGE_KEY_V1 =
  "obd:handoff:local-seo-page-builder:ai-help-desk:v1";
```

### sessionStorage keys + TTL enforcement (PASS)

- Sender stores JSON via `sessionStorage.setItem`.
- Reader enforces TTL by parsing `expiresAt` and clearing expired payloads.
- Helpers exist: `store*`, `read*`, `clear*`.

Evidence (store + TTL-enforced read):

```354:408:src/app/apps/local-seo-page-builder/handoffs/builders.ts
function safeSessionStorageSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to write handoff payload to sessionStorage:", error);
  }
}

function readHandoffPayloadFromKey<T extends { expiresAt: string }>(key: string):
  | { payload: T; expired: false }
  | { payload: null; expired: true }
  | { payload: null; expired: false } {
  if (typeof window === "undefined") return { payload: null, expired: false };
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { payload: null, expired: false };
    const parsed = JSON.parse(raw) as Partial<T>;
    const expiresAt = typeof parsed.expiresAt === "string" ? parsed.expiresAt : "";
    const expires = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expires || Number.isNaN(expires) || Date.now() > expires) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
      return { payload: null, expired: true };
    }
    return { payload: parsed as T, expired: false };
  } catch (error) {
    console.warn("Failed to read handoff payload from sessionStorage:", error);
    return { payload: null, expired: false };
  }
}
```

### Next Steps panel: disabled-until-ready, confirm modals, cancel no side effects (PASS)

Evidence (disabled-until-ready, explicit “Nothing is applied automatically”, confirm modal):

```1545:1615:src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx
      {/* Next Steps (Tier 5C): user-initiated draft-only handoffs */}
      <OBDPanel isDark={isDark} className="mt-7 sm:mt-8">
        {/* ... */}
        <p className={`text-xs ${themeClasses.mutedText}`}>
          Send your draft content to other OBD tools. Nothing is applied automatically.
        </p>
        {/* ... */}
        <button ... disabled={!canSendPageCopy}>Send Page Copy → AI Content Writer</button>
        <button ... disabled={!canSendFaqSeedQuestions}>Send FAQs → AI FAQ Generator</button>
        <button ... disabled={!canSuggestHelpDeskQa}>Suggest Q&A → AI Help Desk</button>
        {/* ... */}
        <p className={`text-xs mt-3 ${themeClasses.mutedText}`}>
          Draft only. We store a handoff payload in your browser for about{" "}
          {Math.round(LOCAL_SEO_HANDOFF_TTL_MS / 60000)} minutes.
        </p>
      </OBDPanel>
```

Confirm writes payload + navigates; cancel closes modal only:

```201:224:src/app/apps/local-seo-page-builder/LocalSeoPageBuilderClient.tsx
  const confirmHandoff = () => {
    if (typeof window === "undefined") return;

    try {
      if (handoffTarget === "content-writer") {
        const payload = buildContentWriterDraftPayload(draft);
        storeLocalSeoToContentWriterDraftHandoff(payload);
        window.location.assign("/apps/content-writer");
      } else if (handoffTarget === "faq-generator") {
        const payload = buildFaqGeneratorPayload(draft);
        storeLocalSeoToFaqGeneratorSeedHandoff(payload);
        window.location.assign("/apps/faq-generator");
      } else if (handoffTarget === "ai-help-desk") {
        const payload = buildHelpDeskSuggestionPayload(draft);
        storeLocalSeoToHelpDeskFaqSuggestionHandoff(payload);
        window.location.assign("/apps/ai-help-desk");
      }
    } catch (error) {
      console.error("Failed to prepare handoff:", error);
      showToast("Failed to prepare handoff. Please try again.");
    } finally {
      closeHandoffModal();
    }
  };
```

### Destination-side behavior: no auto-apply; explicit user action required (PASS / NOTES)

- **PASS (safety):** Local SEO handoff performs **no** destination-side mutation (it only writes a `sessionStorage` payload and navigates).
- **NOTES (completeness):** A repo-wide search did not find any code that reads the Local SEO handoff storage keys or payload `type` strings outside `builders.ts`. That suggests **receiver wiring is not yet implemented**, which prevents auto-apply by definition but also prevents a receiver banner/import UX.

### Labels: “Draft only / nothing auto-applies” present (PASS)

In addition to Local SEO’s Next Steps messaging, receiver banners in the ecosystem emphasize draft-only behavior:

Content Writer FAQ import banner:

```63:69:src/app/apps/content-writer/components/FAQImportBanner.tsx
        <p className={`text-xs mt-1 ${isDark ? "text-blue-400/80" : "text-blue-700/80"}`}>
          Draft only — nothing is applied automatically.
          {hasExistingContent
            ? " Add as New Draft replaces your current draft; Append adds to your current draft."
            : ""}
        </p>
```

AI Help Desk FAQ import banner:

```40:47:src/app/apps/ai-help-desk/knowledge/components/FAQImportBanner.tsx
            {faqCount} FAQ{faqCount !== 1 ? "s" : ""} ready to import
            {isAlreadyImported && (
              <span className="ml-2">
                • This handoff was already imported in this session.
              </span>
            )}
            <span className="ml-2">• Draft only — nothing is imported until you confirm.</span>
```

## 6) Tenant safety & privacy (PASS / NOTES)

### Authentication + server safety (PASS)

The Local SEO generator API requires authentication.

Evidence:

```757:766:src/app/api/local-seo-page-builder/route.ts
    // Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return errorResponse(
        "Authentication required. Please log in to use this tool.",
        401,
        { requestId }
      );
    }
```

### No server writes during handoff (PASS)

The Tier 5C handoff path:

- builds payload client-side
- writes to `sessionStorage`
- navigates to a destination route

There are **no API calls** or server writes performed as part of the handoff itself (see `confirmHandoff` evidence above).

### No background tasks (PASS)

Within scope, there are no background jobs / cron / worker behaviors required for Local SEO usage; actions are user-driven.

### Notes / potential improvements (not required for safety)

- Local SEO handoff payloads do not include a `businessId`. If/when receivers are implemented, they should include and validate tenant identity (consistent with ecosystem tenant-safe patterns).

## 7) Verification evidence

### Commands run

- `pnpm -s typecheck`: **PASS** (exit code 0; no output)
- `pnpm -s build`: **PASS** (see excerpt below)
- `pnpm -s lint`: **PASS with warnings** (scoped lint script)
- `pnpm -s lint:repo`: **FAIL** (repo-wide lint failures pre-existing outside Local SEO scope)

### Build output excerpt (PASS)

```
▲ Next.js 16.1.1 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 41s
  Running TypeScript ...
  Collecting page data using 15 workers ...
✓ Generating static pages using 15 workers (172/172)
  Finalizing page optimization ...
```

### Lint notes

- `lint:repo` currently fails due to unrelated repo issues (e.g. `no-explicit-any`, `react/no-unescaped-entities`) in other apps; this audit did not introduce or modify those areas.

## Manual verification checklist (Tier 5C focused)

### Core app

- [ ] Navigate to `/apps/local-seo-page-builder` (authenticated).
- [ ] Confirm initial state shows **Draft** and empty Results panel.
- [ ] Generate with required inputs; confirm status changes to **Generated** and outputs render.
- [ ] Edit one section (e.g., Page Copy); save; confirm status changes to **Edited**.
- [ ] Click **Regenerate**; confirm outputs regenerate while edits remain in effect (edited > generated).
- [ ] Use **Reset edits**; confirm edits clear and status returns to **Generated** (if generated baseline exists).
- [ ] Confirm accordion sections expand/collapse and summaries remain correct.

### Export integrity

- [ ] Confirm inline Export buttons are disabled until generation.
- [ ] Confirm `.html` export is disabled unless Output Format is **HTML**.
- [ ] Confirm schema export is disabled unless schema exists.
- [ ] In Export Center, confirm “Generate content to enable exports.” appears when empty; exports become available when active content exists.

### Tier 5C Next Steps handoffs (sender-side)

- [ ] With no outputs, confirm Next Steps buttons are disabled with helpful titles.
- [ ] Generate content; confirm Next Steps buttons enable according to readiness rules:
  - Page copy → Content Writer requires non-empty page copy
  - FAQs → FAQ Generator requires at least one question
  - Suggest Q&A → Help Desk requires at least one complete Q&A
- [ ] Click a Next Steps action; confirm **confirmation modal** appears.
- [ ] Click **Cancel**; confirm no navigation occurs and no side effects are observed.
- [ ] Click **Confirm & Continue**; confirm navigation occurs.

## Follow-up recommendations (optional, high-value only)

1. **Wire receiver-side import UX for Local SEO handoff keys** (Content Writer / FAQ Generator / Help Desk) using the existing `readLocalSeoTo*` helpers and TTL semantics.
2. **Add tenant identity to payloads** (e.g., `businessId`) and enforce match in receivers before enabling Apply/Import actions.
3. **Align comments with shipped behavior:** `builders.ts` contains “not wired to UI yet” notes that are now outdated (safe to update in a later refactor-only commit).
4. **Consider standardizing on shared handoff utilities** (URL/localStorage + duplicate guard + URL cleanup) if consistency across apps is desired; current Local SEO approach is safe but bespoke.

## Maintenance mode statement

**Conditional maintenance mode:** the Local SEO Page Builder is safe and stable for draft generation/edit/export. Tier 5C sender-side handoff scaffolding is complete and safe, but receiver-side import UX should be implemented before treating the end-to-end integrations as “fully shipped.”


