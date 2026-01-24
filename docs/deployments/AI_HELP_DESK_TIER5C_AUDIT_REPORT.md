# AI Help Desk — Tier 5C LOCK Audit Report (A–G)

**Audit target commit:** `5467640` (`54676409afe03a96e1630d68094554f255570e3b`)  
**Scope:** AI Help Desk Tier 5B (guided value discovery) + Tier 5C (ecosystem awareness / safe handoffs)  
**Repo:** OBD Premium Apps

## Executive Summary

AI Help Desk is **LOCK-eligible** based on:

- Tenant-scoped AnythingLLM workspace mapping (`businessId → workspaceSlug`) with tenant-safety guardrails.
- Deterministic, explicit user actions (draft-only edits; explicit apply; no background sync).
- Tier 5B guidance when workspace is connected but empty (0 docs and/or empty prompt), dismissible and scoped.
- Tier 5C apply-only handoffs:
  - FAQ Generator → Help Desk via `sessionStorage` (TTL + tenant guard + additive import + dedupe).
  - Brand Kit voice → Help Desk system prompt draft (editable; explicit apply to AnythingLLM `openAiPrompt`).

## A–G Scorecard

| Category | Status | Notes |
| --- | --- | --- |
| A) Tenant safety | PASS | Mapping + blocked workspace slugs + handoff tenant guard |
| B) Determinism | PASS | Draft-only UI + explicit Apply; additive-only handoff import + dedupe |
| C) No automation/background jobs | PASS | No jobs/cron; all changes are user-triggered |
| D) Export integrity | CONDITIONAL | Help Desk is not an exporter; sender validates + TTL envelope for handoff |
| E) Tier 5A UX parity | PASS | OBD panels/buttons; calm copy; mobile-safe layouts |
| F) Tier 5C routing safety | PASS | TTL enforced; apply/dismiss; dedupe; URL cleanup utilities used where applicable |
| G) Resilience | PASS | Invalid payload clears safely; upstream errors surfaced; empty workspace handled |

## Verification Commands

These commands were run and **PASS** for the shipped code (Tier 5B/5C):

```shell
pnpm run typecheck
pnpm run vercel-build
```

---

## Evidence A — Tenant safety (auth scoping + tenant guard + no cross-tenant import)

### A1) Tenant-scoped workspace mapping + blocked workspace slug values

```11:41:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/lib/integrations/anythingllm/scoping.ts
export class TenantSafetyError extends Error {
  constructor(workspaceSlug: string) {
    super(
      `Tenant safety blocked: workspace slug '${workspaceSlug}' matches a known global/default workspace name. Use a business-specific workspace.`
    );
    this.name = "TenantSafetyError";
  }
}

const BLOCKED_WORKSPACE_SLUGS = ["default", "global", "main", "public"];

export function assertTenantSafe(workspaceSlug: string): void {
  const slugLower = workspaceSlug.toLowerCase().trim();
  
  if (BLOCKED_WORKSPACE_SLUGS.includes(slugLower)) {
    throw new TenantSafetyError(workspaceSlug);
  }
}
```

```63:95:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/lib/integrations/anythingllm/scoping.ts
export async function getWorkspaceSlugForBusiness(
  businessId: string
): Promise<WorkspaceSlugResult> {
  // Validate businessId is provided
  if (!businessId || !businessId.trim()) {
    throw new Error("Business ID is required");
  }

  try {
    const mapping = await prisma.aiWorkspaceMap.findUnique({
      where: { businessId },
      select: { workspaceSlug: true },
    });

    // If mapping exists, validate tenant safety and return it with isFallback=false
    if (mapping?.workspaceSlug) {
      // Tenant safety check: block global/default workspace slugs
      assertTenantSafe(mapping.workspaceSlug);
      
      return {
        workspaceSlug: mapping.workspaceSlug,
        isFallback: false,
      };
    }
```

### A2) Premium gating + server-side scoping before interacting with AnythingLLM

```8:21:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/ai-help-desk/setup/test/route.ts
import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getWorkspaceSlugForBusiness } from "@/lib/integrations/anythingllm/scoping";
import {
  listWorkspaces,
  searchWorkspace,
  chatWorkspace,
  getWorkspaceMeta,
  getWorkspacePromptState,
  setWorkspaceSystemPrompt,
} from "@/lib/integrations/anythingllm/client";
```

### A3) Tier 5C handoff tenant guard (FAQ Generator → Help Desk)

```329:381:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/page.tsx
  // Receiver: detect FAQ Generator sessionStorage handoff (Tier 5C)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!businessId.trim()) {
      setFaqGeneratorEnvelope(null);
      return;
    }
    // ...
      // Tenant/business guard
      if (typeof parsed.businessId !== "string" || parsed.businessId.trim().length === 0) {
        // No tenant marker — refuse per Tier 5C requirements
        shouldClear();
        return;
      }
      if (parsed.businessId.trim() !== businessId.trim()) {
        shouldClear();
        return;
      }
```

---

## Evidence B — Determinism (canonical state, append-only import, no silent overwrite)

### B1) Draft-only prompt editing + local draft storage (no silent overwrite)

```198:318:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/setup/SetupPageClient.tsx
  const getSystemPromptDraftStorageKey = (id: string) =>
    `obd.v3.aiHelpDesk.systemPromptDraft.${id}`;

  const loadSystemPromptDraft = (id: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(getSystemPromptDraftStorageKey(id));
      return typeof stored === "string" ? stored : null;
    } catch {
      return null;
    }
  };

  // Load the currently applied workspace prompt, but never overwrite user edits silently.
  useEffect(() => {
    const id = businessId.trim();
    // ...
    // Prefer a local draft if present (draft-only, tenant-scoped)
    const localDraft = loadSystemPromptDraft(id);
    if (typeof localDraft === "string") {
      setSystemPromptDraft(localDraft);
    } else {
      setSystemPromptDraft("");
    }
```

### B2) Regeneration requires explicit confirmation; apply is explicit (no background sync)

```549:623:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/setup/SetupPageClient.tsx
  const handleGenerateSystemPromptFromBrandKit = () => {
    const id = businessId.trim();
    setSystemPromptError(null);
    // ...
    const shouldConfirm =
      systemPromptDirty ||
      systemPromptDraft.trim().length > 0 ||
      hasAppliedPrompt;

    if (shouldConfirm) {
      const ok = window.confirm(
        "Replace the current draft with a new one generated from your Brand Kit? This will not change AnythingLLM until you click Apply."
      );
      if (!ok) return;
    }
    // ...
  };

  const handleApplySystemPrompt = async () => {
    // ...
    const res = await fetch("/api/ai-help-desk/setup/test", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: id,
        systemPrompt: systemPromptDraft,
      }),
    });
```

### B3) Additive-only handoff import + minimal deterministic de-dupe

```427:509:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/page.tsx
    try {
      // Fetch existing FAQ entries (for duplicate guard)
      const params = new URLSearchParams({
        businessId: businessId.trim(),
        type: "FAQ",
        includeInactive: "true",
      });
      const listRes = await fetch(`/api/ai-help-desk/knowledge/list?${params.toString()}`);
      const listJson = await listRes.json();
      const existing = (listRes.ok && listJson?.ok && Array.isArray(listJson?.data?.entries))
        ? (listJson.data.entries as Array<{ title?: string; tags?: string[] }>)
        : [];

      const normalizeQ = (q: string) => q.trim().toLowerCase();
      const existingImportedQuestions = new Set(
        existing
          .filter((e) => Array.isArray(e.tags) && e.tags.includes("AI FAQ Generator"))
          .map((e) => (typeof e.title === "string" ? normalizeQ(e.title) : ""))
          .filter((q) => q.length > 0)
      );

      // De-dupe within payload too
      const uniqueToImport: Array<{ question: string; answer: string }> = [];
      for (const faq of faqGeneratorEnvelope.faqs) {
        const normalized = normalizeQ(faq.question);
        if (!normalized) continue;
        if (existingImportedQuestions.has(normalized)) continue;
        if (uniqueToImport.some((x) => normalizeQ(x.question) === normalized)) continue;
        uniqueToImport.push({ question: faq.question.trim(), answer: faq.answer.trim() });
      }
```

---

## Evidence C — No automation/background jobs

### C1) Apply-only receiver UI (user action required)

```1043:1082:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/page.tsx
      {/* Receiver: FAQs ready to apply (FAQ Generator handoff) */}
      {canShowMainUI && currentMapping && faqGeneratorEnvelope && (
        <OBDPanel isDark={isDark} className="mt-6">
          <div
            className={`p-4 rounded-xl border ${
              isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleApplyFaqGeneratorHandoff}
                disabled={faqGeneratorApplying}
                className={`${SUBMIT_BUTTON_CLASSES} w-full sm:w-auto`}
              >
                {faqGeneratorApplying ? "Applying…" : "Apply"}
              </button>
              <button
                type="button"
                onClick={handleDismissFaqGeneratorHandoff}
                disabled={faqGeneratorApplying}
                className={`${getSubtleButtonMediumClasses(isDark)} w-full sm:w-auto`}
              >
                Dismiss
              </button>
            </div>
```

### C2) Prompt changes require explicit apply (no silent re-sync)

```1151:1268:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/setup/SetupPageClient.tsx
          {/* Step 5: System Prompt (Brand Voice) */}
          {status.db.hasAiWorkspaceMap && businessId.trim() && currentMapping && (
            <OBDPanel isDark={isDark}>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateSystemPromptFromBrandKit}
                  disabled={
                    !brandKitReady ||
                    brandProfileLoading ||
                    systemPromptLoading ||
                    systemPromptSaving
                  }
                >
                  {hasAppliedPrompt ? "Regenerate from Brand Kit" : "Use Brand Kit voice"}
                </button>
                <button
                  type="button"
                  onClick={handleApplySystemPrompt}
                  disabled={
                    systemPromptSaving ||
                    systemPromptLoading ||
                    !systemPromptDraft.trim()
                  }
                >
                  {systemPromptSaving
                    ? "Applying..."
                    : systemPromptSaved
                      ? "✓ Applied"
                      : "Apply to Workspace"}
                </button>
              </div>
              <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                This is a draft. Nothing changes in AnythingLLM until you click “Apply to Workspace”.
              </p>
```

---

## Evidence D — Export integrity (N/A / sender-side validation)

Help Desk itself does not provide exports. The relevant Tier 5C “export-like” mechanism is the **FAQ Generator sender** handoff, which:

- Validates FAQs before handoff
- Writes a TTL-limited envelope to `sessionStorage` for apply-only import

```177:214:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/components/faq/FAQExportCenterPanel.tsx
  const handleSendToHelpDesk = () => {
    const activeFaqs = getActiveFaqs();
    const validationError = validateFAQsForExport(activeFaqs);
    if (validationError) {
      onValidationError(validationError);
      return;
    }
    // ...
    const now = Date.now();
    const ttlMs = 10 * 60 * 1000; // 10 minutes
    const envelope = {
      v: 1 as const,
      payloadVersion: 1 as const,
      sourceApp: "ai-faq-generator" as const,
      createdAt: now,
      expiresAt: now + ttlMs,
      businessId: resolvedBusinessId,
      faqs: activeFaqs.map((faq, idx) => ({
        id: `faq-${faq.number ?? idx + 1}`,
        question: faq.question,
        answer: faq.answer,
      })),
    };
    try {
      sessionStorage.setItem("obd:ai-help-desk:handoff:faq-generator", JSON.stringify(envelope));
      window.location.href = "/apps/ai-help-desk";
    } catch (error) {
      console.error("Failed to write Help Desk handoff:", error);
      onValidationError("Failed to send to Help Desk. Please try again.");
    }
  };
```

---

## Evidence E — Tier 5A UX parity (mobile-safe, consistent patterns, calm tone)

### E1) First-run guidance is calm, dismissible, and scoped

```23:83:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/components/FirstRunContentGuidancePanel.tsx
function buildDismissKey(businessId: string, workspaceSlug: string): string | null {
  const b = businessId.trim();
  const w = workspaceSlug.trim();
  if (!b || !w) return null;
  // Scoped per business + workspace to avoid cross-workspace bleed.
  return `obd:ai-help-desk:first-run-guidance:dismissed:${b}:${w}`;
}

// ...
  const isEmptyKnowledge = useMemo(() => {
    const emptyByDocs = typeof docsCount === "number" && docsCount === 0;
    const emptyByPrompt = systemPromptIsEmpty === true;
    return emptyByDocs || emptyByPrompt;
  }, [docsCount, systemPromptIsEmpty]);
```

### E2) Guidance panel is shown only when connected-but-empty (no noisy banner on errors)

```1084:1102:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/page.tsx
      {/* First-run guidance: connected workspace has no knowledge yet */}
      {canShowMainUI &&
        currentMapping &&
        connectionStatus !== "checking" &&
        connectionStatus !== "red" &&
        lastTestResult && (
          <FirstRunContentGuidancePanel
            isDark={isDark}
            businessId={businessId}
            workspaceSlug={currentMapping.workspaceSlug}
            anythingLLMWorkspaceUrl={
              setupStatus?.env.baseUrlPreview
                ? `${setupStatus.env.baseUrlPreview}/workspace/${currentMapping.workspaceSlug}`
                : null
            }
            docsCount={lastTestResult.docsCount}
            systemPromptIsEmpty={lastTestResult.systemPromptIsEmpty}
          />
        )}
```

---

## Evidence F — Tier 5C routing safety (TTL, expiry enforcement, apply/dismiss, dedupe)

### F1) Receiver TTL enforcement + invalid payload cleanup

```329:418:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/page.tsx
      // TTL check
      if (typeof parsed.expiresAt !== "number" || !Number.isFinite(parsed.expiresAt) || Date.now() > parsed.expiresAt) {
        shouldClear();
        return;
      }
      // Tenant/business guard
      if (typeof parsed.businessId !== "string" || parsed.businessId.trim().length === 0) {
        // No tenant marker — refuse per Tier 5C requirements
        shouldClear();
        return;
      }
      if (parsed.businessId.trim() !== businessId.trim()) {
        shouldClear();
        return;
      }
```

### F2) Apply-only import creates tenant-scoped knowledge entries (additive)

```473:507:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/page.tsx
      await Promise.all(
        uniqueToImport.map(async (faq) => {
          const res = await fetch("/api/ai-help-desk/knowledge/upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: businessId.trim(),
              type: "FAQ",
              title: faq.question,
              content: faq.answer,
              tags: [
                "AI FAQ Generator",
                `importedAt:${importedAtIso}`,
                "handoff:sessionStorage",
                "handoffV:1",
              ],
              isActive: true,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) {
            throw new Error(json.error || "Failed to import FAQ");
          }
        })
      );
```

### F3) Replay/double-import guard utilities (shared)

```30:117:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/lib/utils/handoff-guard.ts
export function getHandoffHash(payload: unknown): string {
  let payloadString: string;
  
  if (typeof payload === "string") {
    payloadString = payload;
  } else {
    payloadString = JSON.stringify(payload);
  }
  
  return hashString(payloadString);
}

export function wasHandoffAlreadyImported(appKey: string, hash: string): boolean {
  // ...
  const storageKey = `obd_handoff_imported:${appKey}`;
  const stored = sessionStorage.getItem(storageKey);
  // ...
}

export function markHandoffImported(appKey: string, hash: string): void {
  // ...
  // Cap at 25 entries, dropping the oldest
  if (hashes.length > 25) {
    hashes = hashes.slice(-25);
  }
  sessionStorage.setItem(storageKey, JSON.stringify(hashes));
}
```

### F4) URL cleanup utilities (shared)

```31:102:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/lib/utils/clear-handoff-params.ts
export function clearHandoffParamsFromUrl(url: string): string {
  try {
    const urlObj = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    urlObj.searchParams.delete("handoff");
    urlObj.searchParams.delete("handoffId");
    urlObj.searchParams.delete("mode");
    urlObj.searchParams.delete("source");
    // ...
    if (url.startsWith("/") || url.startsWith("?")) {
      return pathname + search + hash;
    }
    return urlObj.toString();
  } catch (error) {
    // fallback
    // ...
    return cleaned;
  }
}

export function replaceUrlWithoutReload(cleanUrl: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.history.replaceState(null, "", cleanUrl);
}
```

---

## Evidence G — Resilience (AnythingLLM down, empty workspace, invalid payload handling)

### G1) Upstream prompt read errors are handled (meta mode returns safe error)

```247:272:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/api/ai-help-desk/setup/test/route.ts
    // Meta-only mode: read system prompt + docs count (no search/chat).
    if (mode === "meta") {
      try {
        const promptState = await getWorkspacePromptState(workspaceSlug);
        return apiSuccessResponse({
          mode: "meta",
          workspaceSlug,
          isFallback,
          docsCount: promptState.docsCount,
          systemPromptIsEmpty: promptState.systemPromptIsEmpty,
          systemPrompt: includeSystemPrompt ? promptState.systemPrompt : "",
        });
      } catch (error) {
        const classified = classifyAnythingLLMError(error);
        return apiErrorResponse(
          classified.message || "Failed to load workspace prompt",
          toApiErrorCode(classified.code),
          502,
          { workspaceSlug, upstream: classified.details ?? null }
        );
      }
    }
```

### G2) Invalid/expired handoff payload clears without breaking the page

```351:418:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/app/apps/ai-help-desk/page.tsx
      const shouldClear = () => {
        try {
          sessionStorage.removeItem(FAQ_GENERATOR_HANDOFF_KEY);
        } catch {
          // ignore
        }
        setFaqGeneratorEnvelope(null);
      };

      // Basic structure + version checks
      if (!parsed || parsed.v !== 1 || parsed.payloadVersion !== 1 || parsed.sourceApp !== "ai-faq-generator") {
        shouldClear();
        return;
      }

      // TTL check
      if (typeof parsed.expiresAt !== "number" || !Number.isFinite(parsed.expiresAt) || Date.now() > parsed.expiresAt) {
        shouldClear();
        return;
      }
```

### G3) Workspace prompt read/write uses minimal upstream payload (reduces blast radius)

```330:372:C:/Users/Scott/OneDrive - Nature Coast EMS/Documents/Ocala Business Directory/cursor-app-build/src/lib/integrations/anythingllm/client.ts
export async function getWorkspacePromptState(
  workspaceSlug: string
): Promise<AnythingLLMWorkspacePromptState> {
  const { data } = await makeRequest<unknown>(
    `/workspace/${encodeURIComponent(workspaceSlug)}`,
    { method: "GET" }
  );
  // ...
}

export async function setWorkspaceSystemPrompt(
  workspaceSlug: string,
  systemPrompt: string
): Promise<void> {
  await makeRequest<unknown>(
    `/workspace/${encodeURIComponent(workspaceSlug)}/update`,
    {
      method: "POST",
      body: JSON.stringify({
        openAiPrompt: systemPrompt,
      }),
    }
  );
}
```

---

## Evidence Anchors (file list)

- `src/app/api/ai-help-desk/setup/test/route.ts`
- `src/app/apps/ai-help-desk/setup/SetupPageClient.tsx`
- `src/app/apps/ai-help-desk/page.tsx`
- `src/app/apps/ai-help-desk/components/FirstRunContentGuidancePanel.tsx`
- `src/lib/integrations/anythingllm/client.ts`
- `src/lib/integrations/anythingllm/scoping.ts`
- `src/components/faq/FAQExportCenterPanel.tsx`
- `src/lib/apps/ai-help-desk/brandKitSystemPrompt.ts`
- `src/lib/utils/handoff-guard.ts`
- `src/lib/utils/clear-handoff-params.ts`
- `src/lib/apps/ai-help-desk/handoff-parser.ts`

