# Reputation Dashboard — Tier 5C Audit Report (Lock-Ready)

**Date:** 2026-01-19  
**Scope:**  
- `src/app/apps/(apps)/reputation-dashboard/page.tsx`  
- `src/lib/apps/reputation-dashboard/snapshot-storage.ts`  
- `src/lib/apps/reputation-dashboard/handoff.ts`  
- `src/app/apps/review-responder/page.tsx` (receiver guard + explicit import)  
- `src/lib/apps/review-responder/handoff.ts` (receiver inbox storage)  
- `src/lib/utils/resolve-business-id.ts` (tenant-safe businessId resolution in receivers)  

---

## 1) Executive Summary

- **Status:** **PASS**
- **Tier status:** **5A + 5B + 5C**
- **Risk level:** **Low** (UI-only routing + browser-only persistence; no cross-app mutation)

### Why PASS

- Tier 5B snapshots are **business-scoped**, **immutable**, and **viewed deterministically** (no recompute on view).
- Tier 5C routing is **explicit click-only** and **draft-only** with **TTL-limited sessionStorage** payloads and **tenant mismatch guards**.
- Export Center and Print view are **snapshot-bound** only.

---

## 2) A–G Scorecard (with Evidence)

### A) Tenant Safety — **PASS**

**A1 — Snapshot storage is business-scoped**

```61:110:src/lib/apps/reputation-dashboard/snapshot-storage.ts
export function getSnapshotsStorageKey(businessId: string) {
  return `reputation:snapshots:${businessId}`;
}

export function getActiveSnapshotIdStorageKey(businessId: string) {
  return `reputation:activeSnapshotId:${businessId}`;
}

export function addSnapshotAndPrune(
  storage: Storage,
  businessId: string,
  snapshot: ReputationSnapshot,
  cap = 20
): ReputationSnapshot[] {
  const existing = loadSnapshots(storage, businessId);
  const merged = [snapshot, ...existing].filter((s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx);
  merged.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const pruned = merged.slice(0, cap);
  saveSnapshots(storage, businessId, pruned);
  saveActiveSnapshotId(storage, businessId, snapshot.id);
  return pruned;
}
```

**A2 — Sender tenant scope derived from session**

```442:481:src/app/apps/(apps)/reputation-dashboard/page.tsx
  const { data: session, status: sessionStatus } = useSession();

  // Tier 5B tenant scope: align with existing pattern in other apps (businessId == session.user.id)
  const businessId = session?.user?.id || session?.user?.email || "";
```

**A3 — Receiver requires route flag, resolves `businessId`, and blocks mismatches**

```213:246:src/app/apps/review-responder/page.tsx
  // Only check for RD handoff when explicitly routed with receiver flag.
  useEffect(() => {
    const handoffFlag = searchParams?.get("handoff");
    const sourceFlag = searchParams?.get("source");
    const isRdRoute = handoffFlag === "rd" || (handoffFlag === "1" && sourceFlag === "rd");
    if (!isRdRoute) return;
    // ...
    // Tenant safety: require a resolvable businessId and match it to the payload.
    if (!businessId) {
      clearRdToReviewResponderDraftHandoff();
      setRdIncoming(null);
      setRdImportError("Business context is required to import drafts. Open this tool from a business-scoped link.");
      return;
    }
    if (payload.from?.businessId !== businessId) {
      clearRdToReviewResponderDraftHandoff();
      setRdIncoming(null);
      setRdImportError("Draft handoff blocked: this draft was created for a different business.");
      return;
    }
    setRdIncoming(payload);
  }, [searchParams, businessId]);
```

**A4 — Receiver businessId resolution prioritizes demo-mode tenant isolation**

```73:96:src/lib/utils/resolve-business-id.ts
export function resolveBusinessId(searchParams: URLSearchParams | null): string | null {
  // PRIORITY 0: Demo mode check (CRITICAL - must happen first for tenant safety)
  // Demo mode must NEVER access real tenants; it always uses the demo businessId
  if (hasDemoCookieClient()) {
    return getDemoBusinessIdClient();
  }
  // Priority 1: URL search params
  if (searchParams) {
    const businessIdFromUrl = searchParams.get("businessId");
    if (businessIdFromUrl && businessIdFromUrl.trim().length > 0) {
      return businessIdFromUrl.trim();
    }
  }
  return null;
}
```

---

### B) Snapshot Determinism — **PASS**

**B1 — Active analytics payload is frozen “until explicit refresh”**

```462:472:src/app/apps/(apps)/reputation-dashboard/page.tsx
  // Tier 5A: deterministic “active analytics payload” (frozen until explicit refresh)
  const [activePayload, setActivePayload] = useState<{
    request: ReputationDashboardRequest;
    response: ReputationDashboardResponse;
  } | null>(null);
```

**B2 — Viewing loads snapshot and sets active payload (no recompute)**

```561:592:src/app/apps/(apps)/reputation-dashboard/page.tsx
  // Tier 5B: load snapshots after auth + mount (viewing never recomputes)
  useEffect(() => {
    if (!mounted) return;
    if (sessionStatus === "loading") return;
    if (!businessId) return;
    try {
      const stored = loadSnapshots(localStorage, businessId);
      const storedActiveId = loadActiveSnapshotId(localStorage, businessId);
      setSnapshots(stored);
      if (storedActiveId) {
        const match = stored.find((s) => s.id === storedActiveId) || null;
        if (match) {
          setActiveSnapshot(match);
          setActivePayload({ request: match.request, response: match.response });
          setIsDirtySinceCompute(false);
          // Keep the form aligned with the snapshot in view (deterministic display)
          setBusinessName(match.request.businessName);
          setBusinessType(match.request.businessType || "");
          setDateRangeMode(match.request.dateRange.mode);
          setStartDate(match.request.dateRange.startDate || "");
          setEndDate(match.request.dateRange.endDate || "");
          setReviews(match.request.reviews || []);
          setLastComputed(match.response.computedAt || null);
        }
      }
    } catch {
      // Silently fail - localStorage may be unavailable/corrupt
    }
  }, [mounted, sessionStatus, businessId]);
```

**B3 — Refresh Snapshot creates immutable snapshot; draft compute does not persist**

```1102:1122:src/app/apps/(apps)/reputation-dashboard/page.tsx
      if (persistSnapshot) {
        if (!businessId) {
          setError("Business context unavailable. Please refresh and try again.");
          setActivePayload({ request, response: data });
          setActiveSnapshot(null);
          setIsDirtySinceCompute(false);
          return;
        }
        const snapshot = createSnapshotRecord(request, data);
        const updated = addSnapshotAndPrune(localStorage, businessId, snapshot, 20);
        setSnapshots(updated);
        setActiveSnapshot(snapshot);
        setActivePayload({ request: snapshot.request, response: snapshot.response });
        setIsDirtySinceCompute(false);
      } else {
        // Draft compute only (no persistence)
        setActiveSnapshot(null);
        setActivePayload({ request, response: data });
        setIsDirtySinceCompute(false);
      }
```

---

### C) No Automation Guarantees — **PASS**

**C1 — No background jobs; all “compute” and “handoff” actions are explicit clicks**

- Snapshot compute only occurs via user actions (`Refresh Snapshot`, form submit), not on view (see B2, B3).
- Draft handoff only occurs via `onClick` handlers and short-lived `sessionStorage` writes:

```954:972:src/app/apps/(apps)/reputation-dashboard/page.tsx
  const sendSelectedToReviewResponderDraft = () => {
    if (!activeSnapshot) return;
    if (!businessId) return;
    if (selectedRecentReviews.length === 0) return;
    const payload = buildRdToReviewResponderDraftHandoffV1({
      businessId,
      snapshotId: activeSnapshot.response.snapshotId,
      selectedReviews: selectedRecentReviews,
    });
    storeRdToReviewResponderDraftHandoff(payload);
    showHandoffToast(
      `Draft prepared (${payload.selectedReviews.length} review${payload.selectedReviews.length === 1 ? "" : "s"}).`,
      `/apps/review-responder?businessId=${encodeURIComponent(businessId)}&handoff=rd`,
      "Open Review Responder"
    );
  };
```

**C2 — Receiver requires explicit import; no auto-apply**

```253:264:src/app/apps/review-responder/page.tsx
  const importRdIncoming = () => {
    if (!rdIncoming) return;
    if (!businessId) return;
    if (rdIncoming.from?.businessId !== businessId) return;
    // Store inbox drafts so a refresh doesn't lose them.
    storeReviewResponderRdDrafts(rdIncoming);
    setRdDrafts(rdIncoming);
    clearRdToReviewResponderDraftHandoff();
    setRdIncoming(null);
    showToast("Drafts imported.");
  };
```

---

### D) Export Integrity — **PASS**

**D1 — Export functions are snapshot-gated**

```909:937:src/app/apps/(apps)/reputation-dashboard/page.tsx
  const handleExportJSON = () => {
    if (!activeSnapshot) return;
    // ...
  };

  const handleExportCSV = () => {
    if (!activeSnapshot) return;
    const included = filterReviewsByDateRange(activeSnapshot.request.reviews, activeSnapshot.request.dateRange);
    if (included.length === 0) return;
    // ...
  };
```

**D2 — Export Center UX is snapshot-bound with disabled-not-hidden tooltips**

```2783:2825:src/app/apps/(apps)/reputation-dashboard/page.tsx
            <p className={`text-xs ${themeClasses.mutedText} mb-4`}>
              Exports are snapshot-bound. They won’t change unless you refresh the snapshot.
            </p>
            <div className="flex flex-wrap gap-2">
              <TooltipButton
                isDark={isDark}
                disabled={!activeSnapshot}
                tooltip="Create a snapshot to export a frozen report."
                onClick={() => {
                  handleExportJSON();
                  setShowExportCenter(false);
                }}
              >
                Export JSON
              </TooltipButton>
              <TooltipButton
                isDark={isDark}
                disabled={!activeSnapshot || filterReviewsByDateRange(activeSnapshot.request.reviews, activeSnapshot.request.dateRange).length === 0}
                tooltip={!activeSnapshot ? "Create a snapshot to export." : "No reviews in the selected date range."}
                onClick={() => {
                  handleExportCSV();
                  setShowExportCenter(false);
                }}
              >
                Export Reviews CSV
              </TooltipButton>
              <TooltipButton
                isDark={isDark}
                disabled={!activeSnapshot}
                tooltip="Create a snapshot to print a frozen report."
                onClick={() => {
                  setShowExportCenter(false);
                  handlePrintSnapshot();
                }}
              >
                Print Report
              </TooltipButton>
            </div>
```

---

### E) Tier 5A UX Parity — **PASS**

**E1 — Trust messaging is explicit and calm (“no automation”)**

```1340:1365:src/app/apps/(apps)/reputation-dashboard/page.tsx
      <div className={OBD_STICKY_ACTION_BAR_OFFSET_CLASS}>
        {/* Tier 5A: Trust messaging (calm, explicit, no automation) */}
        <div
          className={`mt-7 rounded-2xl border p-4 md:p-5 ${
            isDark
              ? "bg-slate-800/40 border-slate-700"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
            What this shows (and what it doesn’t)
          </p>
          <ul className={`mt-2 list-disc space-y-1 pl-4 text-xs md:text-sm ${themeClasses.labelText}`}>
            <li>
              <span className="font-medium">This dashboard reflects reviews exactly as entered.</span>
            </li>
            <li>
              <span className="font-medium">No reviews are filtered, optimized, or auto-responded to.</span>
            </li>
            <li>
              <span className="font-medium">All analytics are computed locally and on-demand.</span>
            </li>
            <li>
              <span className="font-medium">Nothing changes unless you refresh the snapshot.</span>
            </li>
          </ul>
        </div>
```

**E2 — Disabled-not-hidden buttons with tooltips (shared `TooltipButton`)**

```372:421:src/app/apps/(apps)/reputation-dashboard/page.tsx
function TooltipButton({
  isDark,
  disabled,
  tooltip,
  variant = "secondary",
  onClick,
  children,
}: { /* ... */ }) {
  // ...
  return (
    <div className="relative group">
      <button type="button" className={btnClass} disabled={disabled} onClick={onClick}>
        {children}
      </button>
      {disabled && tooltip ? (
        <span role="tooltip" className={`absolute right-0 top-full mt-2 px-2 py-1 rounded text-xs whitespace-nowrap z-50 ...`}>
          {tooltip}
        </span>
      ) : null}
    </div>
  );
}
```

**E3 — Sticky action bar with core actions**

```2912:2950:src/app/apps/(apps)/reputation-dashboard/page.tsx
      <OBDStickyActionBar
        isDark={isDark}
        className="no-print"
        left={/* Snapshot status chip */}
      >
        <TooltipButton variant="primary" disabled={!canCreateSnapshot || loading} tooltip={refreshTooltip} onClick={handleRefreshSnapshot}>
          Refresh Snapshot
        </TooltipButton>
        <TooltipButton disabled={!activeSnapshot} tooltip="Create a snapshot to export." onClick={() => setShowExportCenter(true)}>
          Export
        </TooltipButton>
        <TooltipButton disabled={!activeResult} tooltip="Generate the dashboard to view insights." onClick={handleViewInsights}>
          View Insights
        </TooltipButton>
      </OBDStickyActionBar>
```

---

### F) Tier 5C Routing Safety — **PASS**

**F1 — Handoff storage is session-only, TTL-limited, and versioned**

```15:19:src/lib/apps/reputation-dashboard/handoff.ts
export const RD_HANDOFF_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const RD_TO_REVIEW_RESPONDER_DRAFT_STORAGE_KEY_V1 =
  "obd:handoff:rd:review-responder-draft:v1";
```

**F2 — Receiver requires explicit route flag (`?handoff=rd`)**

```213:219:src/app/apps/review-responder/page.tsx
    const handoffFlag = searchParams?.get("handoff");
    const sourceFlag = searchParams?.get("source");
    const isRdRoute = handoffFlag === "rd" || (handoffFlag === "1" && sourceFlag === "rd");
    if (!isRdRoute) return;
```

**F3 — Receiver uses explicit import and stores an inbox with TTL**

```1:66:src/lib/apps/review-responder/handoff.ts
export const REVIEW_RESPONDER_RD_DRAFTS_STORAGE_KEY_V1 =
  "obd:drafts:review-responder:rd:v1";
// readReviewResponderRdDrafts() enforces expiresAt TTL and clears when expired
```

**F4 — Link-only awareness CTAs (no data transfer) + CRM read-only note**

```2693:2752:src/app/apps/(apps)/reputation-dashboard/page.tsx
            <div>AI Help Desk</div>
            {/* Link-only CTA */}
            <div>SEO Audit & Roadmap</div>
            {/* Link-only CTA */}
            <div>CRM</div>
            <div className={`text-[11px] mt-2 ${themeClasses.mutedText}`}>
              No contacts are created automatically.
            </div>
```

---

### G) Resilience — **PASS**

**G1 — localStorage failures are handled safely (silent fail, no crash)**

```527:552:src/app/apps/(apps)/reputation-dashboard/page.tsx
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        // ...
      }
    } catch {
      // Silently fail - localStorage may be unavailable or corrupted
    }
```

**G2 — Snapshot loading is guarded and safe**

```561:592:src/app/apps/(apps)/reputation-dashboard/page.tsx
  // Tier 5B: load snapshots after auth + mount (viewing never recomputes)
  useEffect(() => {
    if (!mounted) return;
    if (sessionStatus === "loading") return;
    if (!businessId) return;
    try {
      const stored = loadSnapshots(localStorage, businessId);
      // ...
    } catch {
      // Silently fail - localStorage may be unavailable/corrupt
    }
  }, [mounted, sessionStatus, businessId]);
```

**G3 — Empty states are explicit**

- “No snapshot yet” sections, disabled Export Center, and snapshot picker messaging.

```2855:2863:src/app/apps/(apps)/reputation-dashboard/page.tsx
            <p className={`text-xs ${themeClasses.mutedText} mb-4`}>
              Viewing a snapshot never recomputes. Refresh Snapshot creates a new snapshot and keeps older ones unchanged.
            </p>
            {snapshots.length === 0 ? (
              <div className={`text-sm ${themeClasses.mutedText}`}>
                No saved snapshots yet. Click <span className="font-medium">Refresh Snapshot</span> to create your first one.
              </div>
            ) : (
              <div className="space-y-2">
                {/* snapshot rows */}
              </div>
            )}
```

---

## 3) Verification

**Commands run (2026-01-19):**

- `pnpm run typecheck`: **PASS**
- `pnpm run vercel-build`: **PASS**

---

## 4) Notes / Non-goals Confirmed

- No backend writes were added for Tier 5C routing (sender writes only to `sessionStorage`).
- No automation: all cross-app actions remain explicit clicks; handoffs are draft-only.
- No new persistence layers were introduced (no DB schema changes, no background jobs).


