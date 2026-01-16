"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDAccordionSection from "@/components/obd/OBDAccordionSection";
import OBDStickyActionBar, {
  OBD_STICKY_ACTION_BAR_OFFSET_CLASS,
} from "@/components/obd/OBDStickyActionBar";
import ResultCard from "@/components/obd/ResultCard";
import SEOAuditExportCenter from "./ExportCenter";
import FixWithOBD from "./FixWithOBD";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from "@/lib/obd-framework/layout-helpers";
import {
  SEOAuditRoadmapRequest,
  SEOAuditRoadmapResponse,
} from "./types";
import {
  SEO_AUDIT_SECTION_DEFS,
  type Tier5SectionId,
  type Tier5SectionStatus,
} from "./sections";

const defaultFormValues: SEOAuditRoadmapRequest = {
  pageUrl: "",
  pageContent: "",
  primaryService: "",
  city: "Ocala",
  state: "Florida",
  businessType: "",
  targetAudience: "Both",
};

export default function SEOAuditRoadmapPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();
  const businessId = useMemo(() => resolveBusinessId(searchParams), [searchParams]);
  const formElRef = useRef<HTMLFormElement | null>(null);
  const isFixtureToggleAllowed = process.env.NODE_ENV !== "production";
  const [fixtureMode, setFixtureMode] = useState(false);
  const [fixtureLoadedAt, setFixtureLoadedAt] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<SEOAuditRoadmapRequest>(defaultFormValues);
  const [loading, setLoading] = useState(false);
  const [loadingActiveAudit, setLoadingActiveAudit] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<SEOAuditRoadmapResponse | null>(null);
  const [previousAudit, setPreviousAudit] = useState<SEOAuditRoadmapResponse | null>(null);
  const [activeSourceInput, setActiveSourceInput] = useState<SEOAuditRoadmapRequest | null>(null);
  const [activeBusinessName, setActiveBusinessName] = useState<string | null>(null);
  const [roadmapView, setRoadmapView] = useState<"roadmap" | "compare">("roadmap");
  const [roadmapBucket, setRoadmapBucket] = useState<"all" | "quick-wins" | "big-bets">("all");
  const [compareExpandedSections, setCompareExpandedSections] = useState<Record<string, boolean>>({});
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [shareTokenId, setShareTokenId] = useState<string | null>(null);
  const [revokingShare, setRevokingShare] = useState(false);

  // Tier 5B: load canonical "activeAudit" (latest COMPLETED) snapshot from DB.
  // Viewing uses the stored snapshot only (no recompute on refresh).
  useEffect(() => {
    let cancelled = false;

    const loadActive = async () => {
      if (fixtureMode) return;
      setLoadingActiveAudit(true);
      try {
        const res = await fetch("/api/seo-audit-roadmap", { method: "GET" });
        const responseData = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            responseData?.error?.message ||
            responseData?.message ||
            `Server error: ${res.status}`;
          throw new Error(msg);
        }

        if (cancelled) return;

        if (responseData?.ok && responseData?.data?.audit) {
          setResult(responseData.data.audit as SEOAuditRoadmapResponse);
          setPreviousAudit(
            responseData.data.previousAudit ? (responseData.data.previousAudit as SEOAuditRoadmapResponse) : null
          );
          if (responseData.data.sourceInput) {
            setFormValues(responseData.data.sourceInput as SEOAuditRoadmapRequest);
            setActiveSourceInput(responseData.data.sourceInput as SEOAuditRoadmapRequest);
          }
          setActiveBusinessName(
            typeof responseData.data.businessName === "string" ? responseData.data.businessName : null
          );
        }
      } catch (e) {
        if (cancelled) return;
        // Non-fatal: page should still be usable (user can run a new audit).
        setError(e instanceof Error ? e.message : "Failed to load saved audit.");
      } finally {
        if (!cancelled) setLoadingActiveAudit(false);
      }
    };

    loadActive();

    return () => {
      cancelled = true;
    };
  }, [fixtureMode]);

  const loadFixture = async () => {
    if (!isFixtureToggleAllowed) return;
    setError(null);
    setFieldErrors({});
    setLoading(false);
    setLoadingActiveAudit(false);

    try {
      const mod: any = await import("@/fixtures/seo-audit-report.fixture.json");
      const fixture = (mod?.default ?? mod) as any;
      const audit = fixture?.audit ?? null;
      const sourceInput = fixture?.sourceInput ?? null;

      if (!audit || !sourceInput) {
        throw new Error("Fixture file is missing audit/sourceInput.");
      }

      setFixtureMode(true);
      setFixtureLoadedAt(new Date().toISOString());
      setResult(audit);
      setPreviousAudit(null);
      setActiveSourceInput(sourceInput);
      setFormValues(sourceInput);
      setActiveBusinessName("Fixture (Dev)");
      setRoadmapView("roadmap");
      setRoadmapBucket("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fixture.");
      setFixtureMode(false);
      setFixtureLoadedAt(null);
    }
  };

  const exitFixtureMode = () => {
    // Simple, repeatable: reload into normal mode (re-enables API fetch and avoids drift).
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const updateFormValue = <K extends keyof SEOAuditRoadmapRequest>(
    key: K,
    value: SEOAuditRoadmapRequest[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    // Clear field error when user types
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const processRequest = async (payload: SEOAuditRoadmapRequest) => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    // Keep the last completed snapshot in-memory so Compare works immediately after a re-run.
    setPreviousAudit(result);
    setResult(null);

    try {
      // Validate that at least one source is provided
      const hasUrl = !!payload.pageUrl?.trim();
      const hasContent = !!payload.pageContent?.trim();
      
      if (!hasUrl && !hasContent) {
        setError("Please provide either a page URL or page content.");
        return;
      }

      if (!payload.primaryService?.trim()) {
        setError("Primary service is required.");
        return;
      }

      // If both provided, prefer URL
      let apiPayload: SEOAuditRoadmapRequest;
      if (hasUrl && hasContent) {
        apiPayload = {
          pageUrl: payload.pageUrl!.trim(),
          pageContent: undefined,
          primaryService: payload.primaryService.trim(),
          city: payload.city?.trim() || "Ocala",
          state: payload.state?.trim() || "Florida",
          businessType: payload.businessType?.trim() || undefined,
          targetAudience: payload.targetAudience || undefined,
        };
      } else {
        apiPayload = {
          pageUrl: payload.pageUrl?.trim() || undefined,
          pageContent: payload.pageContent?.trim() || undefined,
          primaryService: payload.primaryService.trim(),
          city: payload.city?.trim() || "Ocala",
          state: payload.state?.trim() || "Florida",
          businessType: payload.businessType?.trim() || undefined,
          targetAudience: payload.targetAudience || undefined,
        };
      }

      const res = await fetch("/api/seo-audit-roadmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
      });

      const responseData = await res.json();

      if (!res.ok) {
        if (responseData.error?.fieldErrors) {
          setFieldErrors(responseData.error.fieldErrors);
        }
        throw new Error(responseData.error?.message || `Server error: ${res.status}`);
      }

      if (responseData.ok && responseData.data?.audit) {
        setResult(responseData.data.audit);
        if (responseData.data.sourceInput) {
          setFormValues(responseData.data.sourceInput);
          setActiveSourceInput(responseData.data.sourceInput);
        }
        setActiveBusinessName(
          typeof responseData.data.businessName === "string" ? responseData.data.businessName : null
        );
      } else if (responseData.ok === false && responseData.error) {
        throw new Error(responseData.error.message || "An error occurred");
      } else {
        setResult(responseData);
      }
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred while running the SEO audit. Please try again."
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fixtureMode) {
      await loadFixture();
      return;
    }
    await processRequest(formValues);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return isDark ? "text-green-400" : "text-green-600";
    if (score >= 60) return isDark ? "text-yellow-400" : "text-yellow-600";
    return isDark ? "text-red-400" : "text-red-600";
  };

  const getBandColor = (band: string) => {
    const lower = band.toLowerCase();
    if (lower.includes("excellent") || lower.includes("strong")) {
      return isDark ? "bg-green-900/30 border-green-700" : "bg-green-50 border-green-200";
    }
    if (lower.includes("needs") || lower.includes("improvement")) {
      return isDark ? "bg-yellow-900/30 border-yellow-700" : "bg-yellow-50 border-yellow-200";
    }
    return isDark ? "bg-red-900/30 border-red-700" : "bg-red-50 border-red-200";
  };

  const [openSections, setOpenSections] = useState<Record<Tier5SectionId, boolean>>({
    technical: true,
    "on-page": true,
    local: false,
    content: false,
    trust: false,
    schema: false,
  });

  const getTier5StatusFromCategoryStatus = (
    status: "pass" | "needs-improvement" | "missing"
  ): Tier5SectionStatus => {
    if (status === "pass") return "good";
    if (status === "needs-improvement") return "needs-work";
    return "missing";
  };

  const getTier5StatusChip = (status: Tier5SectionStatus) => {
    const label =
      status === "good" ? "Good" : status === "needs-work" ? "Needs Work" : "Missing";

    const classes =
      status === "good"
        ? isDark
          ? "bg-green-900/30 text-green-300"
          : "bg-green-100 text-green-700"
        : status === "needs-work"
          ? isDark
            ? "bg-yellow-900/30 text-yellow-300"
            : "bg-yellow-100 text-yellow-700"
          : isDark
            ? "bg-red-900/30 text-red-300"
            : "bg-red-100 text-red-700";

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${classes}`}>
        {label}
      </span>
    );
  };

  const getConfidenceChip = (confidence: "HIGH" | "MEDIUM" | "LOW") => {
    const label = confidence === "HIGH" ? "High" : confidence === "MEDIUM" ? "Medium" : "Low";
    const classes =
      confidence === "HIGH"
        ? isDark
          ? "bg-emerald-900/30 text-emerald-300"
          : "bg-emerald-100 text-emerald-800"
        : confidence === "MEDIUM"
          ? isDark
            ? "bg-amber-900/30 text-amber-300"
            : "bg-amber-100 text-amber-800"
          : isDark
            ? "bg-slate-800 text-slate-300"
            : "bg-slate-200 text-slate-800";

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
        Confidence: {label}
      </span>
    );
  };

  const compareBySection = useMemo(() => {
    if (!result || !previousAudit) return null;

    const prevById = new Map<string, any>();
    const prevByFallback = new Map<string, any>();
    for (const p of previousAudit.categoryResults || []) {
      const pid = typeof (p as any).findingId === "string" ? (p as any).findingId.trim() : "";
      if (pid) prevById.set(pid, p);
      const fallback = `${(p as any).key ?? ""}::${(p as any).label ?? ""}`;
      prevByFallback.set(fallback, p);
    }

    const findPrevFor = (cur: any) => {
      const cid = typeof cur?.findingId === "string" ? cur.findingId.trim() : "";
      if (cid && prevById.has(cid)) return prevById.get(cid) ?? null;
      const fallback = `${cur?.key ?? ""}::${cur?.label ?? ""}`;
      return prevByFallback.get(fallback) ?? null;
    };

    type Change = {
      key: string;
      label: string;
      fromPoints: number;
      toPoints: number;
      delta: number;
      direction: "improved" | "worsened" | "unchanged";
    };

    return SEO_AUDIT_SECTION_DEFS.map((def) => {
      const changes: Change[] = [];
      let improved = 0;
      let worsened = 0;
      let unchanged = 0;

      for (const categoryKey of def.categoryKeys) {
        const cur = result.categoryResults?.find((c) => c.key === categoryKey) ?? null;
        if (!cur) continue;

        const prev = findPrevFor(cur);
        const fromPoints = typeof prev?.pointsEarned === "number" ? prev.pointsEarned : cur.pointsEarned;
        const toPoints = cur.pointsEarned;
        const delta = toPoints - fromPoints;

        const direction: Change["direction"] =
          delta > 0 ? "improved" : delta < 0 ? "worsened" : "unchanged";

        if (direction === "improved") improved += 1;
        else if (direction === "worsened") worsened += 1;
        else unchanged += 1;

        if (direction !== "unchanged") {
          changes.push({
            key: cur.key,
            label: cur.label,
            fromPoints,
            toPoints,
            delta,
            direction,
          });
        }
      }

      changes.sort((a, b) => {
        const absDiff = Math.abs(b.delta) - Math.abs(a.delta);
        if (absDiff !== 0) return absDiff;
        return a.label.localeCompare(b.label);
      });

      return {
        id: def.id,
        title: def.title,
        improved,
        worsened,
        unchanged,
        changes,
      };
    });
  }, [result, previousAudit]);

  const bucketCounts = useMemo(() => {
    const items = result?.roadmap ?? [];
    const isQuickWin = (item: (typeof items)[number]) =>
      (item.priority === "HIGH" || item.priority === "MEDIUM") && item.estimatedEffort === "Low";
    const isBigBet = (item: (typeof items)[number]) =>
      item.priority === "HIGH" && (item.estimatedEffort === "Medium" || item.estimatedEffort === "High");

    const quickWins = items.filter(isQuickWin).length;
    const bigBets = items.filter(isBigBet).length;
    return {
      all: items.length,
      quickWins,
      bigBets,
    };
  }, [result?.roadmap]);

  const roadmapItemsForBucket = useMemo(() => {
    const items = result?.roadmap ?? [];
    if (roadmapBucket === "all") return items;

    const isQuickWin = (item: (typeof items)[number]) =>
      (item.priority === "HIGH" || item.priority === "MEDIUM") && item.estimatedEffort === "Low";
    const isBigBet = (item: (typeof items)[number]) =>
      item.priority === "HIGH" && (item.estimatedEffort === "Medium" || item.estimatedEffort === "High");

    return items.filter((item) => (roadmapBucket === "quick-wins" ? isQuickWin(item) : isBigBet(item)));
  }, [result?.roadmap, roadmapBucket]);

  const getAppCompletionChip = (state: "draft" | "completed") => {
    const label = state === "draft" ? "Draft" : "Completed";
    const classes =
      state === "completed"
        ? isDark
          ? "bg-green-900/30 text-green-300 border-green-800/40"
          : "bg-green-50 text-green-700 border-green-200"
        : isDark
          ? "bg-slate-800 text-slate-300 border-slate-700"
          : "bg-slate-50 text-slate-700 border-slate-200";

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${classes}`}>
        {label}
      </span>
    );
  };

  const sections = useMemo(() => {
    const byKey = new Map(result?.categoryResults.map((c) => [c.key, c]) ?? []);

    return SEO_AUDIT_SECTION_DEFS.map((def) => {
      const categories = def.categoryKeys
        .map((k) => byKey.get(k))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      if (!categories.length) {
        return {
          ...def,
          categories: [] as NonNullable<(typeof categories)[number]>[],
          status: def.emptyState?.status ?? "missing",
          summary: def.emptyState?.summary ?? "No checks available",
          detail: def.emptyState?.detail ?? "No checks are available for this section yet.",
        };
      }

      const pointsAvailable = categories.reduce(
        (sum, c) => sum + (c.pointsMax - c.pointsEarned),
        0
      );
      const missingCount = categories.filter((c) => c.status === "missing").length;
      const needsWorkCount = categories.filter((c) => c.status === "needs-improvement").length;

      const status: Tier5SectionStatus =
        missingCount > 0
          ? "missing"
          : needsWorkCount > 0
            ? "needs-work"
            : "good";

      const summary =
        status === "good"
          ? "All checks look good"
          : status === "needs-work"
            ? `${needsWorkCount} need work • +${pointsAvailable} pts available`
            : `${missingCount} missing • ${needsWorkCount} need work • +${pointsAvailable} pts available`;

      return {
        ...def,
        categories,
        status,
        summary,
        detail: "",
      };
    });
  }, [result?.categoryResults, isDark]);

  const scrollToRoadmap = () => {
    setRoadmapView("roadmap");
    const el = document.getElementById("seo-roadmap");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToCompare = () => {
    setRoadmapView("compare");
    const el = document.getElementById("seo-roadmap");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToExportCenter = () => {
    const el = document.getElementById("export-center");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openShareModal = () => {
    setShareModalOpen(true);
    setShareError(null);
  };

  const createShareLink = async () => {
    if (typeof window === "undefined") return;
    setCreatingShare(true);
    setShareError(null);
    setShareUrl(null);
    setShareExpiresAt(null);
    setShareTokenId(null);

    try {
      const res = await fetch("/api/seo-audit-roadmap/share", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = json?.error?.message || `Failed to create share link (${res.status}).`;
        throw new Error(msg);
      }

      const sharePath = typeof json?.data?.sharePath === "string" ? json.data.sharePath : "";
      const expiresAt = typeof json?.data?.expiresAt === "string" ? json.data.expiresAt : null;
      const tokenId = typeof json?.data?.tokenId === "string" ? json.data.tokenId : null;

      if (!sharePath) throw new Error("Share link missing from response.");

      setShareUrl(`${window.location.origin}${sharePath}`);
      setShareExpiresAt(expiresAt);
      setShareTokenId(tokenId);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Failed to create share link.");
    } finally {
      setCreatingShare(false);
    }
  };

  const revokeShareLink = async () => {
    if (!shareTokenId) return;
    setRevokingShare(true);
    setShareError(null);
    try {
      const res = await fetch("/api/seo-audit-roadmap/share/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: shareTokenId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = json?.error?.message || `Failed to revoke (${res.status}).`;
        throw new Error(msg);
      }
      setShareUrl(null);
      setShareExpiresAt(null);
      setShareTokenId(null);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Failed to revoke share link.");
    } finally {
      setRevokingShare(false);
    }
  };

  const StickyActionButton = ({
    children,
    disabled,
    title,
    onClick,
    variant = "secondary",
    type = "button",
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    title?: string;
    onClick?: () => void;
    variant?: "primary" | "secondary";
    type?: "button" | "submit";
  }) => {
    const base =
      variant === "primary"
        ? SUBMIT_BUTTON_CLASSES
        : `text-sm px-4 py-2 rounded-lg transition-colors ${
            disabled
              ? isDark
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
              : isDark
                ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
          }`;

    const button = (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={base}
      >
        {children}
      </button>
    );

    // Disabled buttons don't reliably show native tooltips; wrap to keep tooltip visible.
    return disabled && title ? (
      <span title={title} className="inline-flex">
        {button}
      </span>
    ) : (
      button
    );
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="SEO Audit & Roadmap"
      tagline="Audit a local page and get a prioritized SEO improvement plan."
    >
      <form ref={formElRef} onSubmit={handleSubmit}>
        <div className={`space-y-6 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
          {/* Trust microcopy (Tier 5A) */}
          <OBDPanel isDark={isDark} className="mt-7">
            <div
              className={`rounded-lg border p-4 ${
                isDark
                  ? "bg-slate-800/40 border-slate-700 text-slate-200"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              {/* Maintenance lock indicator (Reference-Quality) */}
              <div className="mb-3">
                <p className="text-sm font-semibold">
                  Maintenance Mode (Reference-Quality)
                </p>
                <p className={`text-sm ${themeClasses.mutedText}`}>
                  Advisory-only. Draft outputs. No automatic changes.
                </p>
              </div>

              <p className="text-sm font-semibold mb-2">Before you run this audit</p>
              <ul className={`text-sm space-y-1 ${themeClasses.mutedText}`}>
                <li>Advisory only. Nothing is changed automatically.</li>
                <li>Draft-only outputs. You choose what to apply.</li>
              </ul>

              {isFixtureToggleAllowed && (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className={`text-xs ${themeClasses.mutedText}`}>
                    Dev fixtures: load a deterministic snapshot (no API calls, no DB writes).
                    {fixtureMode && fixtureLoadedAt ? (
                      <span className="ml-2">
                        <span className="font-medium">Fixture mode</span> · loaded{" "}
                        {new Date(fixtureLoadedAt).toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    {!fixtureMode ? (
                      <button
                        type="button"
                        onClick={loadFixture}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                          isDark
                            ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        Load Fixture
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={exitFixtureMode}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                          isDark
                            ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        Exit Fixture Mode
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </OBDPanel>

          {/* Form card */}
          <OBDPanel isDark={isDark}>
            {/* Audit Source Section */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Audit Source <span className="text-red-500">*</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="pageUrl" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Page URL
                  </label>
                  <input
                    type="url"
                    id="pageUrl"
                    value={formValues.pageUrl || ""}
                    onChange={(e) => updateFormValue("pageUrl", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="https://example.com/service-page"
                    aria-describedby="pageUrl-help"
                  />
                  {fieldErrors.pageUrl && (
                    <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                      {fieldErrors.pageUrl[0]}
                    </p>
                  )}
                  <p id="pageUrl-help" className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Enter the full URL of the page to audit
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className={getDividerClass(isDark)}></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className={`px-2 ${isDark ? "bg-slate-900 text-slate-400" : "bg-white text-slate-500"}`}>
                      Or
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="pageContent" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Page Content
                  </label>
                  <textarea
                    id="pageContent"
                    value={formValues.pageContent || ""}
                    onChange={(e) => updateFormValue("pageContent", e.target.value)}
                    rows={8}
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="Paste the HTML content or text content of the page here..."
                    aria-describedby="pageContent-help"
                  />
                  {fieldErrors.pageContent && (
                    <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                      {fieldErrors.pageContent[0]}
                    </p>
                  )}
                  <p id="pageContent-help" className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Paste the HTML or text content directly
                  </p>
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Context Section */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Context
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="primaryService" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Primary Service <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="primaryService"
                    value={formValues.primaryService || ""}
                    onChange={(e) => updateFormValue("primaryService", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Plumbing, HVAC, Legal Services"
                    required
                  />
                  {fieldErrors.primaryService && (
                    <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                      {fieldErrors.primaryService[0]}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={formValues.city || ""}
                      onChange={(e) => updateFormValue("city", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Ocala"
                      required
                    />
                    {fieldErrors.city && (
                      <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                        {fieldErrors.city[0]}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="state" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={formValues.state || ""}
                      onChange={(e) => updateFormValue("state", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Florida"
                      required
                    />
                    {fieldErrors.state && (
                      <p className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}>
                        {fieldErrors.state[0]}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Business Type
                  </label>
                  <input
                    type="text"
                    id="businessType"
                    value={formValues.businessType || ""}
                    onChange={(e) => updateFormValue("businessType", e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Service Business, Retail, Restaurant"
                  />
                </div>

                <div>
                  <label htmlFor="targetAudience" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Target Audience
                  </label>
                  <select
                    id="targetAudience"
                    value={formValues.targetAudience || "Both"}
                    onChange={(e) => updateFormValue("targetAudience", e.target.value as "Residential" | "Commercial" | "Both")}
                    className={getInputClasses(isDark)}
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              </div>
            </div>
          </OBDPanel>

          {/* Error Display */}
          {error && (
            <OBDPanel isDark={isDark}>
              <div className={getErrorPanelClasses(isDark)}>
                <p className="font-medium mb-2">Error:</p>
                <p>{error}</p>
              </div>
            </OBDPanel>
          )}

          {/* Results section */}
          {result && (
            <OBDPanel isDark={isDark} id="seo-audit-results">
              <OBDHeading level={2} isDark={isDark}>
                SEO Audit Results
              </OBDHeading>

              {/* Single-page audit clarification */}
              <div
                className={`mt-4 p-3 rounded-lg border ${
                  isDark ? "bg-slate-800/50 border-slate-700" : "bg-blue-50 border-blue-200"
                }`}
              >
                <p className={`text-xs ${isDark ? "text-slate-300" : "text-blue-700"}`}>
                  <span className="font-medium">Note:</span> This audit analyzes a single page only.
                  For a complete site-wide SEO assessment, audit multiple pages individually.
                </p>
              </div>

              {/* Overall Score */}
              <div className="mt-6">
                <ResultCard
                  title="Overall SEO Score"
                  isDark={isDark}
                  copyText={`SEO Score: ${result.score}/100 (${result.band})\n${result.summary}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className={`text-5xl font-bold ${getScoreColor(result.score)}`}>
                        {result.score}
                      </div>
                      <div className="flex-1">
                        <div className={`px-4 py-2 rounded-lg border ${getBandColor(result.band)}`}>
                          <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {result.band}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className={`text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                      {result.summary}
                    </p>
                    {result.auditedUrl && (
                      <p className={`text-xs ${themeClasses.mutedText}`}>
                        Audited:{" "}
                        <a
                          href={result.auditedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {result.auditedUrl}
                        </a>
                      </p>
                    )}
                    <div className={`text-xs ${themeClasses.mutedText}`}>
                      Request ID: {result.meta.requestId} · Audited:{" "}
                      {new Date(result.meta.auditedAtISO).toLocaleString()}
                    </div>
                  </div>
                </ResultCard>
              </div>

              {/* Tier 5A accordion sections */}
              <div className="mt-7 space-y-3">
                {sections.map((section) => (
                  <OBDAccordionSection
                    key={section.id}
                    isDark={isDark}
                    title={section.title}
                    titleRight={getTier5StatusChip(section.status)}
                    summary={section.summary}
                    isOpen={!!openSections[section.id]}
                    onToggle={() =>
                      setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
                    }
                  >
                    {section.categories.length ? (
                      <div className="space-y-3">
                        {section.categories.map((category) => {
                          const tier5Status = getTier5StatusFromCategoryStatus(category.status);
                          const confidence = (category as any)?.confidence ?? "LOW";
                          const evidence = (category as any)?.evidence ?? null;
                          return (
                            <div
                              key={category.key}
                              className={`rounded-lg border p-4 ${
                                isDark ? "border-slate-700 bg-slate-900/30" : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                    {category.label}{" "}
                                    <span className={`text-xs font-normal ${themeClasses.mutedText}`}>
                                      ({category.pointsEarned}/{category.pointsMax})
                                    </span>
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {getTier5StatusChip(tier5Status)}
                                  {getConfidenceChip(confidence)}
                                </div>
                              </div>
                              <p className={`mt-2 text-sm ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                                {category.shortExplanation}
                              </p>
                              <p className={`mt-2 text-sm ${themeClasses.mutedText}`}>
                                <span className="font-medium">Fix:</span> {category.fixRecommendation}
                              </p>

                              {/* Tier 5B+ Trust: Evidence (collapsed by default) */}
                              <details className="mt-3">
                                <summary
                                  className={`cursor-pointer select-none text-xs font-semibold ${
                                    isDark ? "text-slate-200" : "text-slate-800"
                                  }`}
                                >
                                  Evidence
                                </summary>
                                <div className={`mt-2 rounded-lg border p-3 text-xs ${
                                  isDark ? "border-slate-700 bg-slate-950/30 text-slate-300" : "border-slate-200 bg-white text-slate-700"
                                }`}>
                                  {evidence ? (
                                    <div className="space-y-2">
                                      {Array.isArray(evidence.checked) && evidence.checked.length > 0 && (
                                        <div>
                                          <div className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                                            Checked
                                          </div>
                                          <ul className="mt-1 space-y-1 list-disc pl-5">
                                            {evidence.checked.map((c: string, idx: number) => (
                                              <li key={`${category.key}-checked-${idx}`}>{c}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {Array.isArray(evidence.observed) && evidence.observed.length > 0 && (
                                        <div>
                                          <div className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                                            Observed
                                          </div>
                                          <ul className="mt-1 space-y-1 list-disc pl-5">
                                            {evidence.observed.map((o: string, idx: number) => (
                                              <li key={`${category.key}-observed-${idx}`}>{o}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {typeof evidence.notes === "string" && evidence.notes.trim().length > 0 && (
                                        <div>
                                          <div className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                                            Notes
                                          </div>
                                          <div className="mt-1">{evidence.notes}</div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className={themeClasses.mutedText}>
                                      No evidence captured for this finding in this audit snapshot.
                                    </div>
                                  )}
                                </div>
                              </details>

                              {/* Tier 5C: link-only ecosystem awareness (deterministic) */}
                              <FixWithOBD
                                isDark={isDark}
                                sectionId={section.id}
                                categoryKey={category.key}
                                categoryLabel={category.label}
                                status={category.status}
                                businessId={businessId}
                                sourceInputs={
                                  activeSourceInput
                                    ? {
                                        primaryService: activeSourceInput.primaryService,
                                        city: activeSourceInput.city,
                                        state: activeSourceInput.state,
                                      }
                                    : null
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`text-sm ${themeClasses.mutedText}`}>
                        {section.detail || "No audit results available for this section yet."}
                      </div>
                    )}
                  </OBDAccordionSection>
                ))}
              </div>

              {/* Roadmap */}
              <div id="seo-roadmap" className="mt-8">
                <OBDHeading level={2} isDark={isDark}>
                  Prioritized Roadmap
                </OBDHeading>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRoadmapView("roadmap")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      roadmapView === "roadmap"
                        ? isDark
                          ? "bg-slate-800 border-slate-600 text-slate-100"
                          : "bg-slate-900 border-slate-900 text-white"
                        : isDark
                          ? "bg-slate-950/30 border-slate-700 text-slate-300 hover:bg-slate-900/50"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Roadmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoadmapView("compare")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      roadmapView === "compare"
                        ? isDark
                          ? "bg-slate-800 border-slate-600 text-slate-100"
                          : "bg-slate-900 border-slate-900 text-white"
                        : isDark
                          ? "bg-slate-950/30 border-slate-700 text-slate-300 hover:bg-slate-900/50"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Compare
                  </button>
                </div>

                {roadmapView === "roadmap" ? (
                  result.roadmap.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {/* Buckets: computed from snapshot (no persistence) */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRoadmapBucket("all")}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            roadmapBucket === "all"
                              ? isDark
                                ? "bg-slate-800 border-slate-600 text-slate-100"
                                : "bg-slate-900 border-slate-900 text-white"
                              : isDark
                                ? "bg-slate-950/30 border-slate-700 text-slate-300 hover:bg-slate-900/50"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          All ({bucketCounts.all})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoadmapBucket("quick-wins")}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            roadmapBucket === "quick-wins"
                              ? isDark
                                ? "bg-slate-800 border-slate-600 text-slate-100"
                                : "bg-slate-900 border-slate-900 text-white"
                              : isDark
                                ? "bg-slate-950/30 border-slate-700 text-slate-300 hover:bg-slate-900/50"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Quick Wins ({bucketCounts.quickWins})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoadmapBucket("big-bets")}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            roadmapBucket === "big-bets"
                              ? isDark
                                ? "bg-slate-800 border-slate-600 text-slate-100"
                                : "bg-slate-900 border-slate-900 text-white"
                              : isDark
                                ? "bg-slate-950/30 border-slate-700 text-slate-300 hover:bg-slate-900/50"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Big Bets ({bucketCounts.bigBets})
                        </button>
                      </div>

                      {(() => {
                        const idToTitle = new Map<string, string>();
                        const dependedOnCounts = new Map<string, number>();

                        for (const r of result.roadmap) {
                          idToTitle.set(r.id, r.title);
                        }
                        for (const r of result.roadmap) {
                          for (const depId of r.dependsOnRoadmapIds ?? []) {
                            dependedOnCounts.set(depId, (dependedOnCounts.get(depId) ?? 0) + 1);
                          }
                        }

                        const getAfterLabel = (item: (typeof result.roadmap)[number]): string | null => {
                          const deps = item.dependsOnRoadmapIds ?? [];
                          if (deps.length === 0) return null;
                          const titles = deps
                            .map((id) => idToTitle.get(id))
                            .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
                          if (titles.length === 0) return null;
                          const short = titles.slice(0, 2).join(", ");
                          const suffix = titles.length > 2 ? ` +${titles.length - 2}` : "";
                          return `${short}${suffix}`;
                        };

                        const isPrerequisiteForTwoOrMore = (id: string): boolean =>
                          (dependedOnCounts.get(id) ?? 0) >= 2;

                        return (
                          <>
                            {(() => {
                              const priorityColors = {
                                HIGH: isDark ? "border-red-700 bg-red-900/20" : "border-red-200 bg-red-50",
                                MEDIUM: isDark ? "border-yellow-700 bg-yellow-900/20" : "border-yellow-200 bg-yellow-50",
                                OPTIONAL: isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50",
                              } as const;

                              const priorityLabels = {
                                HIGH: "High Priority",
                                MEDIUM: "Medium Priority",
                                OPTIONAL: "Optional",
                              } as const;

                              const blocks: ReactNode[] = [];
                              let lastPriority: "HIGH" | "MEDIUM" | "OPTIONAL" | null = null;

                              for (const item of roadmapItemsForBucket) {
                                if (item.priority !== lastPriority) {
                                  lastPriority = item.priority;
                                  blocks.push(
                                    <h4
                                      key={`hdr-${item.priority}`}
                                      className={`text-sm font-semibold ${themeClasses.headingText}`}
                                    >
                                      {priorityLabels[item.priority]}
                                    </h4>
                                  );
                                }

                                blocks.push(
                                  <div
                                    key={item.id}
                                    className={`rounded-lg border p-4 ${priorityColors[item.priority]}`}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <h5
                                          className={`font-semibold text-sm mb-1 ${
                                            isDark ? "text-white" : "text-slate-900"
                                          }`}
                                        >
                                          {item.title}
                                        </h5>
                                        {getAfterLabel(item) && (
                                          <div className={`text-xs mb-2 ${themeClasses.mutedText}`}>
                                            Do this after: {getAfterLabel(item)}
                                          </div>
                                        )}
                                        <p className={`text-xs mb-2 ${themeClasses.mutedText}`}>
                                          {item.pointsAvailable} points available
                                        </p>
                                      </div>
                                      <div className="flex gap-2 ml-4">
                                        {isPrerequisiteForTwoOrMore(item.id) && (
                                          <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${
                                              isDark
                                                ? "bg-blue-900/50 text-blue-200"
                                                : "bg-blue-100 text-blue-800"
                                            }`}
                                          >
                                            Do this first
                                          </span>
                                        )}
                                        <span
                                          className={`px-2 py-1 rounded text-xs ${
                                            item.estimatedEffort === "Low"
                                              ? isDark
                                                ? "bg-green-900/50 text-green-300"
                                                : "bg-green-100 text-green-700"
                                              : item.estimatedEffort === "Medium"
                                                ? isDark
                                                  ? "bg-yellow-900/50 text-yellow-300"
                                                  : "bg-yellow-100 text-yellow-700"
                                                : isDark
                                                  ? "bg-red-900/50 text-red-300"
                                                  : "bg-red-100 text-red-700"
                                          }`}
                                        >
                                          {item.estimatedEffort} Effort
                                        </span>
                                      </div>
                                    </div>
                                    <p className={`text-sm mb-2 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                                      <span className="font-medium">Issue:</span> {item.whatIsWrong}
                                    </p>
                                    <p className={`text-sm mb-3 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                                      <span className="font-medium">Why it matters:</span> {item.whyItMatters}
                                    </p>
                                    {item.nextSteps.length > 0 && (
                                      <div className="mb-3">
                                        <p className={`text-xs font-medium mb-2 ${themeClasses.mutedText}`}>
                                          Next Steps:
                                        </p>
                                        <ul className="list-disc list-inside space-y-1 text-sm">
                                          {item.nextSteps.map((step, idx) => (
                                            <li
                                              key={idx}
                                              className={isDark ? "text-slate-300" : "text-slate-600"}
                                            >
                                              {step}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {item.relatedApp && (
                                      <div className="pt-2 border-t border-slate-300 dark:border-slate-600">
                                        <Link
                                          href={item.relatedApp.href}
                                          className={`text-xs font-medium underline ${
                                            isDark
                                              ? "text-[#29c4a9] hover:text-[#1EB9A7]"
                                              : "text-[#29c4a9] hover:text-[#1EB9A7]"
                                          }`}
                                        >
                                          → Use {item.relatedApp.name} to help with this
                                        </Link>
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              if (blocks.length === 0) {
                                return (
                                  <p className={`italic obd-soft-text text-center py-6 ${themeClasses.mutedText}`}>
                                    No steps match this bucket.
                                  </p>
                                );
                              }

                              return <div className="space-y-3">{blocks}</div>;
                            })()}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className={`italic obd-soft-text text-center py-8 ${themeClasses.mutedText}`}>
                      No roadmap items available.
                    </p>
                  )
                ) : (
                  <div className="mt-4">
                    {!previousAudit ? (
                      <p className={`italic obd-soft-text text-center py-8 ${themeClasses.mutedText}`}>
                        Run at least two audits to compare.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {(compareBySection ?? []).map((sec) => {
                          const expanded = !!compareExpandedSections[sec.id];
                          const visible = expanded ? sec.changes : sec.changes.slice(0, 5);
                          const hasMore = sec.changes.length > 5;

                          return (
                            <div
                              key={sec.id}
                              className={`rounded-lg border p-4 ${
                                isDark ? "border-slate-700 bg-slate-900/30" : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                    {sec.title}
                                  </div>
                                  <div className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                                    Improved: {sec.improved} · Worsened: {sec.worsened} · Unchanged: {sec.unchanged}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3">
                                <div className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                                  What changed
                                </div>

                                {sec.changes.length === 0 ? (
                                  <div className={`mt-2 text-xs ${themeClasses.mutedText}`}>
                                    No changes detected in this section.
                                  </div>
                                ) : (
                                  <>
                                    <ul className="mt-2 space-y-1 text-sm">
                                      {visible.map((c) => (
                                        <li key={`${sec.id}-${c.key}`} className={isDark ? "text-slate-300" : "text-slate-700"}>
                                          <span className="font-medium">{c.label}:</span>{" "}
                                          <span className={themeClasses.mutedText}>
                                            {c.fromPoints} → {c.toPoints}
                                          </span>
                                          <span className="ml-2 text-xs">
                                            {c.direction === "improved" ? (
                                              <span className={isDark ? "text-emerald-300" : "text-emerald-700"}>
                                                (+{c.delta})
                                              </span>
                                            ) : (
                                              <span className={isDark ? "text-red-300" : "text-red-700"}>
                                                ({c.delta})
                                              </span>
                                            )}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>

                                    {hasMore && (
                                      <button
                                        type="button"
                                        className={`mt-2 text-xs font-medium underline ${
                                          isDark ? "text-slate-200 hover:text-slate-100" : "text-slate-700 hover:text-slate-900"
                                        }`}
                                        onClick={() =>
                                          setCompareExpandedSections((prev) => ({
                                            ...prev,
                                            [sec.id]: !expanded,
                                          }))
                                        }
                                      >
                                        {expanded ? "View less" : "View all"}
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {result.roadmap.length === 0 && result.categoryResults.length === 0 ? (
                <p className={`italic obd-soft-text text-center py-8 ${themeClasses.mutedText}`}>
                  No audit results available.
                </p>
              ) : null}
            </OBDPanel>
          )}

          {!result && !loading && !error ? (
            <OBDPanel isDark={isDark}>
              {loadingActiveAudit ? (
                <p className={`italic obd-soft-text text-center py-8 ${themeClasses.mutedText}`}>
                  Loading your latest audit…
                </p>
              ) : (
                <div
                  className={`rounded-lg border p-5 ${
                    isDark ? "border-slate-700 bg-slate-900/30" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className={`text-sm font-semibold ${themeClasses.headingText}`}>
                    First run: here’s what to expect
                  </div>
                  <div className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Advisory only. Nothing is changed automatically.
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className={`text-xs font-semibold ${themeClasses.headingText}`}>
                        What this won’t do
                      </div>
                      <ul className={`mt-2 text-sm space-y-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        <li>• No auto-fixes</li>
                        <li>• No publishing</li>
                        <li>• No schema injection</li>
                      </ul>
                    </div>

                    <div>
                      <div className={`text-xs font-semibold ${themeClasses.headingText}`}>
                        What you get
                      </div>
                      <ul className={`mt-2 text-sm space-y-1 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        <li>• Clear issues + why they matter</li>
                        <li>• Ordered roadmap</li>
                        <li>• Next-step links to OBD tools</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={() => formElRef.current?.requestSubmit()}
                      className={SUBMIT_BUTTON_CLASSES}
                    >
                      Run Audit
                    </button>
                    <details className="rounded-lg border px-3 py-2 text-sm">
                      <summary
                        className={`cursor-pointer select-none text-sm font-medium ${
                          isDark ? "text-slate-200" : "text-slate-700"
                        }`}
                      >
                        How it works
                      </summary>
                      <div className={`mt-2 text-sm ${themeClasses.mutedText}`}>
                        <ul className="space-y-1">
                          <li>• Provide a page URL (or paste content) + your service + city/state.</li>
                          <li>• We run a deterministic checklist (no AI crawling) and score the page.</li>
                          <li>• You get a prioritized roadmap and optional next-step links to OBD tools.</li>
                        </ul>
                      </div>
                    </details>
                  </div>
                </div>
              )}
            </OBDPanel>
          ) : null}

          {/* Export Center (authoritative; exports only from activeAudit snapshot) */}
          <SEOAuditExportCenter
            isDark={isDark}
            audit={result}
            sourceInput={activeSourceInput}
            businessName={activeBusinessName}
          />
        </div>

        {/* Sticky Action Bar (Tier 5A) */}
        <OBDStickyActionBar
          isDark={isDark}
          left={<div className="flex items-center gap-2 min-w-0">{getAppCompletionChip(result ? "completed" : "draft")}</div>}
        >
          <StickyActionButton variant="primary" type="submit" disabled={loading}>
            {loading ? "Running Audit..." : result ? "Re-Run Audit" : "Run Audit"}
          </StickyActionButton>

          <StickyActionButton
            disabled={!result}
            title={!result ? "Run an audit first to view the roadmap" : "Scroll to roadmap"}
            onClick={scrollToRoadmap}
          >
            View Roadmap
          </StickyActionButton>

          <StickyActionButton
            disabled={!result}
            title={!result ? "Run an audit first to compare" : "Compare latest vs previous completed audit"}
            onClick={scrollToCompare}
          >
            Compare
          </StickyActionButton>

          <StickyActionButton
            disabled={!result || fixtureMode}
            title={
              !result
                ? "Run an audit first to share"
                : fixtureMode
                  ? "Disabled in fixture mode (no DB writes)."
                  : "Create a tokenized, expiring read-only share link"
            }
            onClick={openShareModal}
          >
            Create share link
          </StickyActionButton>

          <StickyActionButton
            disabled={!result}
            title={!result ? "Run an audit first to export" : "Open Export Center"}
            onClick={scrollToExportCenter}
          >
            Export
          </StickyActionButton>
        </OBDStickyActionBar>
      </form>

      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShareModalOpen(false)}
          />
          <div
            className={`relative w-full max-w-lg rounded-xl border p-5 shadow-xl ${
              isDark ? "bg-slate-950 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              Share read-only report
            </div>
            <div className={`mt-1 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              Read-only snapshot. Expires on{" "}
              <span className="font-medium">
                {shareExpiresAt ? new Date(shareExpiresAt).toLocaleString() : "7 days from creation"}
              </span>
              . No businessId is included in the URL.
            </div>

            {shareError && (
              <div
                className={`mt-3 rounded-lg border p-3 text-sm ${
                  isDark ? "border-red-800/60 bg-red-900/20 text-red-200" : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {shareError}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={creatingShare}
                onClick={createShareLink}
                className={`w-full rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDark ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {creatingShare ? "Creating…" : "Create share link"}
              </button>

              {shareUrl && (
                <div className={`rounded-lg border p-3 text-xs ${isDark ? "border-slate-700 bg-slate-950/30 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
                  <div className="font-semibold">Share URL</div>
                  <div className={`mt-1 break-all ${isDark ? "text-slate-200" : "text-slate-700"}`}>{shareUrl}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                        isDark ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled={!shareTokenId || revokingShare}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDark ? "border-red-800/60 bg-red-900/20 text-red-200 hover:bg-red-900/30" : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                      }`}
                      onClick={revokeShareLink}
                    >
                      {revokingShare ? "Revoking…" : "Revoke"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  isDark ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => setShareModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </OBDPageContainer>
  );
}
