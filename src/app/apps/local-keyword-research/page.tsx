"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import OBDFilterBar from "@/components/obd/OBDFilterBar";
import OBDStickyActionBar, {
  OBD_STICKY_ACTION_BAR_OFFSET_CLASS,
} from "@/components/obd/OBDStickyActionBar";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { useOBDTheme } from "@/lib/obd-framework/use-obd-theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";
import { LocalKeywordLegend } from "@/components/obd/LocalKeywordLegend";
import type {
  LocalKeywordRequest,
  LocalKeywordResponse,
  LocalKeywordIdea,
  LocalKeywordCluster,
  RankCheckResult,
  RankHistoryItem,
  LocalKeywordIntent,
} from "@/app/api/local-keyword-research/types";
import { getActiveKeywordResults } from "@/lib/apps/local-keyword-research/getActiveKeywordResults";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";
import { getHandoffHash } from "@/lib/utils/handoff-guard";
import LKRTExportCenterPanel from "./components/LKRTExportCenterPanel";
import {
  LKRT_HANDOFF_TTL_MS,
  buildLkrtToContentWriterSeedsHandoffV1,
  buildLkrtToLocalSeoSuggestionsHandoffV1,
  storeLkrtToContentWriterSeedsHandoff,
  storeLkrtToLocalSeoSuggestionsHandoff,
  type LkrtMetricsMode,
} from "@/lib/apps/local-keyword-research/handoff";

const defaultFormValues: LocalKeywordRequest = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  websiteUrl: undefined,
  primaryGoal: "SEO",
  radiusMiles: 15,
  includeNearMeVariants: true,
  includeZipCodes: true,
  includeNeighborhoods: true,
  maxKeywords: 60,
  personalityStyle: "None",
  brandVoice: "",
  language: "English",
  includeBlogIdeas: true,
  includeFaqIdeas: true,
  includeGmbPostIdeas: true,
};

function AccordionSection({
  isOpen,
  onToggle,
  title,
  summary,
  isDark,
  children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  summary: React.ReactNode;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border ${
        isDark ? "border-slate-700 bg-slate-800/20" : "border-slate-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left px-4 py-3 md:px-6 md:py-4 flex items-start justify-between gap-3 ${
          isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50"
        } rounded-2xl transition-colors`}
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold ${
                isDark ? "text-slate-100" : "text-slate-900"
              }`}
            >
              {title}
            </span>
          </div>
          <div className="mt-1">{summary}</div>
        </div>
        <span
          className={`mt-0.5 text-xs font-semibold ${
            isDark ? "text-slate-300" : "text-slate-600"
          }`}
          aria-hidden="true"
        >
          {isOpen ? "▲" : "▼"}
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4 md:px-6 md:pb-6">{children}</div>}
    </div>
  );
}

export default function LocalKeywordResearchPage() {
  const { theme, isDark, setTheme } = useOBDTheme();
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();
  const businessId = useMemo(() => resolveBusinessId(searchParams), [searchParams]);

  const [form, setForm] = useState<LocalKeywordRequest>(defaultFormValues);
  const [isLoading, setIsLoading] = useState(false);
  // Tier 5A state normalization:
  // - generatedResult: latest generated response from API
  // - editedResult: user-edited response (reserved for future UI; keep null unless editing is introduced)
  const [generatedResult, setGeneratedResult] = useState<LocalKeywordResponse | null>(null);
  const [editedResult, setEditedResult] = useState<LocalKeywordResponse | null>(null);
  // Canonical active results selector (edited > generated)
  const activeResult = useMemo(
    () => getActiveKeywordResults(generatedResult, editedResult),
    [generatedResult, editedResult]
  );
  const [error, setError] = useState<string | null>(null);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<LocalKeywordRequest | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<null | "current-inputs">(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setActionToast(message);
    setTimeout(() => setActionToast(null), 1200);
  };

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<"score" | "volume" | "cpc" | "difficulty" | "intent" | "keyword">("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterDifficulty, setFilterDifficulty] = useState<"all" | "Easy" | "Medium" | "Hard">("all");
  const [filterIntent, setFilterIntent] = useState<"all" | LocalKeywordIntent>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Ref for scrolling to results
  const resultsRef = useRef<HTMLDivElement>(null);
  const exportCenterRef = useRef<HTMLDivElement>(null);

  // Rank check state
  const [rankKeyword, setRankKeyword] = useState("");
  const [rankTargetUrl, setRankTargetUrl] = useState("");
  const [rankIsLoading, setRankIsLoading] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);
  const [rankResult, setRankResult] = useState<RankCheckResult | null>(null);

  // TODO: Once a database is added, populate rankHistory from the backend:
  // - On page load, fetch recent rank history for this business.
  // - After each successful rank check, POST the result to a "rank-history" endpoint
  //   and update this state with the new entry.
  const [rankHistory, setRankHistory] = useState<RankHistoryItem[] | null>(null);

  // Update rankTargetUrl when form.websiteUrl changes (if not already set)
  useEffect(() => {
    if (form.websiteUrl && !rankTargetUrl) {
      setRankTargetUrl(form.websiteUrl);
    }
  }, [form.websiteUrl]); // Removed rankTargetUrl from deps to avoid unnecessary re-runs

  // Tier 5A: Accordion state (input sections)
  const [accordionState, setAccordionState] = useState({
    businessAndServices: true,
    location: true,
    targeting: false,
    strategy: false,
    voice: false,
    extras: false,
  });

  const toggleAccordion = (section: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const collapseAllAccordions = () => {
    setAccordionState({
      businessAndServices: true, // keep the primary section visible
      location: false,
      targeting: false,
      strategy: false,
      voice: false,
      extras: false,
    });
  };

  const expandAllAccordions = () => {
    setAccordionState({
      businessAndServices: true,
      location: true,
      targeting: true,
      strategy: true,
      voice: true,
      extras: true,
    });
  };

  const runBasis: LocalKeywordRequest = lastRequest ?? form;

  const metricsModeLabel = useMemo(() => {
    if (!activeResult) return "—";
    const kws = activeResult.topPriorityKeywords || [];

    const hasGoogleAdsSource = kws.some((k) => k.dataSource === "google-ads");
    const hasMockSource = kws.some((k) => k.dataSource === "mock");

    const hasNumericGoogleAdsMetrics = kws.some(
      (k) =>
        k.dataSource === "google-ads" &&
        (typeof k.monthlySearchesExact === "number" ||
          typeof k.cpcUsd === "number" ||
          typeof k.adsCompetitionIndex === "number")
    );

    if (hasGoogleAdsSource) {
      return hasNumericGoogleAdsMetrics
        ? "Live Google Ads"
        : "Google Ads (Connected — Metrics Pending)";
    }

    if (hasMockSource) return "Mock Data";

    return "Estimated";
  }, [activeResult]);

  const seedKeywordsSummary = useMemo(() => {
    const bt = (runBasis.businessType || "").trim();
    const raw = (runBasis.services || "")
      .split(/[\n,]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const services = raw
      .filter((s) => {
        const key = s.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);

    const parts = [
      bt ? bt : undefined,
      services.length ? services.join(", ") : undefined,
    ].filter(Boolean) as string[];

    return parts.length ? parts.join(" • ") : "—";
  }, [runBasis.businessType, runBasis.services]);

  const locationModifierSummary = useMemo(() => {
    const city = (runBasis.city || "").trim();
    const state = (runBasis.state || "").trim();
    const loc = [city, state].filter(Boolean).join(", ");
    const modifiers: string[] = [];
    if (loc) modifiers.push(loc);
    if (runBasis.includeNearMeVariants) modifiers.push('"near me"');
    return modifiers.length ? modifiers.join(" • ") : "—";
  }, [runBasis.city, runBasis.state, runBasis.includeNearMeVariants]);

  const accordionSummary = useMemo(() => {
    const prefix = lastRequest ? "Last run:" : "Current:";
    return (
      <div className={`text-[11px] leading-snug ${themeClasses.mutedText}`}>
        <span className="font-medium">{prefix}</span>{" "}
        <span className="mr-2">Seed: {seedKeywordsSummary}</span>
        <span className="mr-2">Location: {locationModifierSummary}</span>
        <span>Metrics: {metricsModeLabel}</span>
      </div>
    );
  }, [
    lastRequest,
    seedKeywordsSummary,
    locationModifierSummary,
    metricsModeLabel,
    themeClasses.mutedText,
  ]);

  const updateFormValue = <K extends keyof LocalKeywordRequest>(
    key: K,
    value: LocalKeywordRequest[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const performRequest = async (requestPayload: LocalKeywordRequest, isRegenerate = false) => {
    setError(null);
    setIsLoading(true);
    // Don't clear result on regenerate - preserve current results while loading
    if (!isRegenerate) {
      setGeneratedResult(null);
      // If an edited view ever exists, clear it on fresh generation requests.
      setEditedResult(null);
    }

    try {
      const res = await fetch("/api/local-keyword-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data && typeof data === "object" && "error" in data && typeof data.error === "string")
            ? data.error
            : "There was a problem generating keyword ideas. Please try again."
        );
      }

      const jsonData = await res.json();
      // Handle both { ok: true, data: ... } and direct response formats (backward compatible)
      const data: LocalKeywordResponse = (jsonData && typeof jsonData === "object" && "ok" in jsonData && jsonData.ok === true && "data" in jsonData)
        ? jsonData.data
        : jsonData;
      setGeneratedResult(data);
      setLastRequest(requestPayload);
      
      // Scroll to results after a brief delay
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.businessType.trim()) {
      setError(
        "Please enter your business type (e.g., Massage Spa, Plumber, Restaurant)."
      );
      return;
    }

    if (!form.services.trim()) {
      setError("Please list at least one service or specialty.");
      return;
    }

    await performRequest(form);
  };

  const handleRefreshResults = async () => {
    // UX determinism: refresh is always based on CURRENT form inputs.
    // No background refresh; only user-triggered.
    if (!form.businessType.trim()) {
      setError(
        "Please enter your business type (e.g., Massage Spa, Plumber, Restaurant)."
      );
      return;
    }

    if (!form.services.trim()) {
      setError("Please list at least one service or specialty.");
      return;
    }

    setRefreshNotice("current-inputs");
    try {
      await performRequest(form, true);
    } finally {
      setRefreshNotice(null);
    }
  };

  const canRefresh = !!activeResult && !isLoading;
  const canExport = !!activeResult && !isLoading;
  const canSendHandoff = !!activeResult && !!businessId && !isLoading;

  const secondaryActionButtonClasses =
    `px-4 py-2 text-sm font-medium rounded-xl transition-colors ` +
    (isDark
      ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200");

  const sendHandoff = (target: "local-seo" | "content-writer") => {
    if (!activeResult) return;
    if (!businessId) {
      setError(
        "Business context is required to send handoffs. Open this tool from a business-scoped link."
      );
      return;
    }
    try {
      const createdAt = new Date().toISOString();
      const runId = getHandoffHash({
        businessId,
        lastRequest: lastRequest ?? null,
        createdAt,
      });

      const bt = (form.businessType || "").trim();
      const rawServices = (form.services || "")
        .split(/[\n,]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
      const seedKeywords = [bt, ...rawServices].filter(Boolean).slice(0, 10);

      // Reuse existing badge semantics for context only (no metrics correctness work here).
      const metricsMode = (metricsModeLabel as LkrtMetricsMode) || "—";

      if (target === "local-seo") {
        const payload = buildLkrtToLocalSeoSuggestionsHandoffV1({
          businessId,
          city: form.city,
          state: form.state,
          nearMe: form.includeNearMeVariants,
          seedKeywords,
          metricsMode,
          result: activeResult,
          createdAt,
          runId,
        });
        storeLkrtToLocalSeoSuggestionsHandoff(payload);
        showToast("Sent — ready to apply in Local SEO Page Builder.");
        setTimeout(() => {
          window.location.assign(
            `/apps/local-seo-page-builder?businessId=${encodeURIComponent(businessId)}&handoff=lkrt`
          );
        }, 150);
      } else if (target === "content-writer") {
        const payload = buildLkrtToContentWriterSeedsHandoffV1({
          businessId,
          city: form.city,
          state: form.state,
          nearMe: form.includeNearMeVariants,
          seedKeywords,
          metricsMode,
          result: activeResult,
          createdAt,
          runId,
        });
        storeLkrtToContentWriterSeedsHandoff(payload);
        showToast("Sent — ready to apply in AI Content Writer.");
        setTimeout(() => {
          window.location.assign(
            `/apps/content-writer?businessId=${encodeURIComponent(businessId)}&handoff=lkrt`
          );
        }, 150);
      }
    } catch (e) {
      console.error("Failed to prepare LKRT handoff:", e);
      setError("Failed to prepare handoff. Please try again.");
    }
  };

  const handleCopyText = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedKeyword(id);
        setTimeout(() => setCopiedKeyword(null), 1500);
      }
    } catch {
      // ignore copy errors
    }
  };

  const handleOpenExportCenter = () => {
    exportCenterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Determine metrics mode
  const getMetricsMode = (keywords: LocalKeywordIdea[]): { mode: string; helperText: string } => {
    const hasGoogleAdsSource = keywords.some((k) => k.dataSource === "google-ads");
    const hasMockSource = keywords.some((k) => k.dataSource === "mock");

    const hasAnyNumericMetrics = keywords.some(
      (k) =>
        typeof k.monthlySearchesExact === "number" ||
        typeof k.cpcUsd === "number" ||
        typeof k.adsCompetitionIndex === "number"
    );

    const hasNumericGoogleAdsMetrics = keywords.some(
      (k) =>
        k.dataSource === "google-ads" &&
        (typeof k.monthlySearchesExact === "number" ||
          typeof k.cpcUsd === "number" ||
          typeof k.adsCompetitionIndex === "number")
    );

    // Badge semantics fix (critical):
    // - "Live" → only allowed when numeric Google Ads metrics exist.
    // - "Google Ads (Connected — Metrics Pending)" → Google Ads source present but metrics are null.
    // - "Mock Data" → mock source explicitly labeled.
    if (hasGoogleAdsSource) {
      if (hasNumericGoogleAdsMetrics) {
        return {
          mode: "Live Google Ads",
          helperText: "Numeric metrics are available from Google Ads for at least some keywords.",
        };
      }

      return {
        mode: "Google Ads (Connected — Metrics Pending)",
        helperText: "Google Ads source is selected, but numeric metrics are not available yet.",
      };
    }

    if (hasMockSource) {
      return {
        mode: "Mock Data",
        helperText: "Metrics shown are mock data for testing (not Google Ads).",
      };
    }

    if (hasAnyNumericMetrics) {
      return {
        mode: "Estimated",
        helperText: "Some numeric metrics are available, but they are not from Google Ads.",
      };
    }

    return {
      mode: "No Metrics",
      helperText: "No numeric metrics are available for this run.",
    };
  };

  // Difficulty ordering helper
  const getDifficultyOrder = (difficulty: "Easy" | "Medium" | "Hard"): number => {
    switch (difficulty) {
      case "Easy":
        return 1;
      case "Medium":
        return 2;
      case "Hard":
        return 3;
      default:
        return 0;
    }
  };

  // Filter and sort keywords
  const filteredAndSortedKeywords = useMemo(() => {
    if (!activeResult?.topPriorityKeywords) return [];

    let filtered = [...activeResult.topPriorityKeywords];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((k) =>
        k.keyword.toLowerCase().includes(query)
      );
    }

    // Apply difficulty filter
    if (filterDifficulty !== "all") {
      filtered = filtered.filter((k) => k.difficultyLabel === filterDifficulty);
    }

    // Apply intent filter
    if (filterIntent !== "all") {
      filtered = filtered.filter((k) => k.intent === filterIntent);
    }

      // Apply sorting
      filtered.sort((a, b) => {
        let aVal: number | string;
        let bVal: number | string;
        // Determine effective sort order: for difficulty/intent/keyword, default to asc if user hasn't changed it
        const effectiveOrder =
          sortBy === "difficulty" || sortBy === "intent" || sortBy === "keyword"
            ? sortOrder === "desc"
              ? "desc"
              : "asc" // Default to asc for these
            : sortOrder; // Use user's choice for score/volume/cpc

        switch (sortBy) {
          case "score":
            aVal = a.opportunityScore ?? 0;
            bVal = b.opportunityScore ?? 0;
            break;
          case "volume":
            aVal = a.monthlySearchesExact ?? -1;
            bVal = b.monthlySearchesExact ?? -1;
            break;
          case "cpc":
            aVal = a.cpcUsd ?? -1;
            bVal = b.cpcUsd ?? -1;
            break;
          case "difficulty":
            aVal = getDifficultyOrder(a.difficultyLabel);
            bVal = getDifficultyOrder(b.difficultyLabel);
            break;
          case "intent":
            aVal = a.intent;
            bVal = b.intent;
            break;
          case "keyword":
            aVal = a.keyword.toLowerCase();
            bVal = b.keyword.toLowerCase();
            break;
          default:
            return 0;
        }

        if (typeof aVal === "number" && typeof bVal === "number") {
          return effectiveOrder === "desc" ? bVal - aVal : aVal - bVal;
        } else {
          const comparison = String(aVal).localeCompare(String(bVal));
          return effectiveOrder === "desc" ? -comparison : comparison;
        }
      });

    return filtered;
  }, [activeResult?.topPriorityKeywords, searchQuery, filterDifficulty, filterIntent, sortBy, sortOrder]);

  const renderKeywordTable = (keywords: LocalKeywordIdea[]) => {
    if (!keywords?.length) return null;

    // Separate all keywords (for metadata) from visible keywords (for rendering)
    const allKeywords = keywords;
    const visibleKeywords = filteredAndSortedKeywords;

    // Detect if metrics are present (use allKeywords for metadata)
    const hasVolume = allKeywords.some(
      (k) => typeof k.monthlySearchesExact === "number"
    );
    const hasCpc = allKeywords.some((k) => typeof k.cpcUsd === "number");

    const metricsInfo = getMetricsMode(allKeywords);
    const intentOptions: LocalKeywordIntent[] = [
      "Informational",
      "Transactional",
      "Commercial",
      "Navigational",
      "Local",
      "Mixed",
    ];

    return (
      <OBDPanel isDark={isDark} className="mt-8">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-3 flex-wrap">
              <OBDHeading level={2} isDark={isDark}>
                Top Priority Keywords
              </OBDHeading>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                  isDark
                    ? "bg-slate-800/50 border-slate-600 text-slate-200"
                    : "bg-slate-100 border-slate-300 text-slate-700"
                }`}
              >
                Metrics: {metricsInfo.mode}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => sendHandoff("local-seo")}
                disabled={!canSendHandoff}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                } ${!canSendHandoff ? "opacity-50 cursor-not-allowed" : ""}`}
                title={!businessId ? "Business context required (missing businessId)." : "Send draft suggestions to Local SEO Page Builder"}
              >
                Send → Local SEO
              </button>
              <button
                type="button"
                onClick={() => sendHandoff("content-writer")}
                disabled={!canSendHandoff}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                } ${!canSendHandoff ? "opacity-50 cursor-not-allowed" : ""}`}
                title={!businessId ? "Business context required (missing businessId)." : "Send draft seeds to AI Content Writer"}
              >
                Send → Content Writer
              </button>
            </div>
          </div>
          <p className={`text-xs ${themeClasses.mutedText} mb-4`}>
            {metricsInfo.helperText}
          </p>

          {/* Sorting and filtering controls */}
          <OBDFilterBar sticky={true} isDark={isDark} usePanel={false} className="mb-4">
            <div className="flex items-center gap-2">
              <label className={`text-xs font-medium ${themeClasses.labelText}`}>
                Sort:
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  const newSortBy = e.target.value as
                    | "score"
                    | "volume"
                    | "cpc"
                    | "difficulty"
                    | "intent"
                    | "keyword";
                  setSortBy(newSortBy);
                  // Set default sort order based on field type
                  if (newSortBy === "difficulty" || newSortBy === "intent" || newSortBy === "keyword") {
                    setSortOrder("asc");
                  } else {
                    setSortOrder("desc");
                  }
                }}
                className={getInputClasses(isDark, "text-xs py-1 px-2 w-auto min-w-[140px]")}
              >
                <option value="score">Opportunity Score</option>
                {hasVolume && <option value="volume">Volume</option>}
                {hasCpc && <option value="cpc">CPC</option>}
                <option value="difficulty">Difficulty</option>
                <option value="intent">Intent</option>
                <option value="keyword">Keyword</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                title={sortOrder === "desc" ? "Sort descending" : "Sort ascending"}
              >
                {sortOrder === "desc" ? "↓" : "↑"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className={`text-xs font-medium ${themeClasses.labelText}`}>
                Difficulty:
              </label>
              <select
                value={filterDifficulty}
                onChange={(e) =>
                  setFilterDifficulty(
                    e.target.value as "all" | "Easy" | "Medium" | "Hard"
                  )
                }
                className={getInputClasses(isDark, "text-xs py-1 px-2 w-auto min-w-[100px]")}
              >
                <option value="all">All</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className={`text-xs font-medium ${themeClasses.labelText}`}>
                Intent:
              </label>
              <select
                value={filterIntent}
                onChange={(e) =>
                  setFilterIntent(
                    e.target.value === "all" ? "all" : (e.target.value as LocalKeywordIntent)
                  )
                }
                className={getInputClasses(isDark, "text-xs py-1 px-2 w-auto min-w-[120px]")}
              >
                <option value="all">All</option>
                {intentOptions.map((intent) => (
                  <option key={intent} value={intent}>
                    {intent}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <label className={`text-xs font-medium ${themeClasses.labelText}`}>
                Search:
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter keywords…"
                className={getInputClasses(isDark, "text-xs py-1 px-2 flex-1")}
              />
            </div>
          </OBDFilterBar>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs md:text-sm">
            <thead className={`border-b text-[11px] uppercase tracking-wide ${themeClasses.mutedText} md:text-xs md:sticky md:top-0 md:z-10 ${isDark ? "md:bg-slate-800" : "md:bg-white"}`}>
              <tr>
                <th className="py-2 pr-4">Keyword</th>
                <th className="py-2 pr-4">Intent</th>
                <th className="py-2 pr-4">Suggested Use</th>
                <th className="py-2 pr-4">Difficulty</th>
                <th className="py-2 pr-4">Opportunity</th>
                {hasVolume && <th className="py-2 pr-4">Est. Volume</th>}
                {hasCpc && <th className="py-2 pr-4">Est. CPC</th>}
                <th className="py-2 pr-0 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleKeywords.length === 0 ? (
                <tr>
                  <td colSpan={6 + (hasVolume ? 1 : 0) + (hasCpc ? 1 : 0)} className="py-8 text-center">
                    <div className={`rounded-2xl border p-6 mx-auto max-w-md ${
                      isDark
                        ? "bg-slate-800/50 border-slate-700"
                        : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className={`text-sm font-medium mb-2 ${themeClasses.headingText}`}>
                        No keywords match your filters
                      </p>
                      <p className={`text-xs mb-4 ${themeClasses.mutedText}`}>
                        Try clearing filters or broadening your search.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterDifficulty("all");
                          setFilterIntent("all");
                          setSearchQuery("");
                        }}
                        className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleKeywords.map((k) => (
                  <tr key={k.keyword} className={`border-b ${isDark ? "border-slate-700" : "border-slate-200"} last:border-0`}>
                  <td className={`py-2 pr-4 font-medium ${themeClasses.headingText}`}>{k.keyword}</td>
                  <td className={`py-2 pr-4 ${themeClasses.labelText}`}>{k.intent}</td>
                  <td className={`py-2 pr-4 ${themeClasses.labelText}`}>{k.suggestedPageType}</td>
                  <td
                    className={`py-2 pr-4 font-semibold ${
                      k.difficultyLabel === "Easy"
                        ? "text-emerald-600"
                        : k.difficultyLabel === "Medium"
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {k.difficultyLabel}
                  </td>
                  <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                    {Math.max(1, Math.min(100, k.opportunityScore || 50))}
                  </td>
                  {hasVolume && (
                    <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                      {typeof k.monthlySearchesExact === "number"
                        ? k.monthlySearchesExact.toLocaleString()
                        : "—"}
                    </td>
                  )}
                  {hasCpc && (
                    <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                      {typeof k.cpcUsd === "number" ? `$${k.cpcUsd.toFixed(2)}` : "—"}
                    </td>
                  )}
                  <td className="py-2 pr-0 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRankKeyword(k.keyword)}
                        className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        title="Use this keyword for rank check"
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText(k.keyword, k.keyword)}
                        className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                          isDark
                            ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {copiedKeyword === k.keyword ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </OBDPanel>
    );
  };

  const renderClusterCards = (clusters: LocalKeywordCluster[]) => {
    if (!clusters?.length) return null;

    return (
      <OBDPanel isDark={isDark} className="mt-8">
        <OBDHeading level={2} isDark={isDark} className="mb-4">
          Keyword Clusters
        </OBDHeading>
        <div className="grid gap-4 md:grid-cols-2">
          {clusters.map((cluster) => (
            <div
              key={cluster.name}
              className={`flex flex-col rounded-xl border p-4 md:p-6 ${
                isDark
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="mb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className={`text-base font-semibold md:text-lg ${themeClasses.headingText}`}>
                    {cluster.name}
                  </h3>
                  {cluster.keywords && cluster.keywords.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const clusterText = cluster.keywords
                          .map((k) => `${k.keyword} — ${k.intent} — ${k.difficultyLabel}`)
                          .join("\n");
                        handleCopyText(clusterText, `cluster-${cluster.name}`);
                      }}
                      aria-label={copiedKeyword === `cluster-${cluster.name}` ? "Copied cluster keywords" : `Copy all keywords from ${cluster.name} cluster`}
                      className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      {copiedKeyword === `cluster-${cluster.name}` ? "Copied" : "Copy Cluster"}
                    </button>
                  )}
                </div>
                <p className={`mt-1 text-xs md:text-sm ${themeClasses.mutedText}`}>
                  {cluster.description}
                </p>
                <p className="mt-1 text-xs font-medium text-[#29c4a9] md:text-sm">
                  Recommended use: {cluster.recommendedUse}
                </p>
              </div>
              <div className="flex-1 space-y-2">
                {cluster.keywords && cluster.keywords.length > 0 ? (
                  cluster.keywords.map((k) => (
                  <button
                    key={k.keyword}
                    type="button"
                    onClick={() => handleCopyText(k.keyword, k.keyword)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-xs hover:border-[#29c4a9] transition-colors md:text-sm ${
                      isDark
                        ? "bg-slate-800 border-slate-700 hover:bg-slate-700"
                        : "bg-white border-slate-200 hover:bg-teal-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-medium ${themeClasses.headingText}`}>{k.keyword}</span>
                      <span className={`text-[11px] ${themeClasses.mutedText}`}>
                        {k.intent} · {k.difficultyLabel}
                      </span>
                    </div>
                    {k.notes && (
                      <p className={`mt-1 text-[11px] ${themeClasses.mutedText}`}>
                        {k.notes}
                      </p>
                    )}
                  </button>
                  ))
                ) : (
                  <p className={`text-xs italic ${themeClasses.mutedText}`}>
                    No keywords in this cluster.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </OBDPanel>
    );
  };

  const renderIdeaList = (title: string, items?: string[]) => {
    if (!items || !items.length) return null;
    return (
      <OBDPanel isDark={isDark} className="mt-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <OBDHeading level={2} isDark={isDark}>
            {title}
          </OBDHeading>
          <button
            type="button"
            onClick={() => handleCopyText(items.join("\n"))}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              isDark
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Copy All
          </button>
        </div>
        <ul className={`list-disc space-y-1 pl-4 text-xs md:text-sm ${themeClasses.labelText}`}>
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </OBDPanel>
    );
  };

  const renderFaqIdeas = (
    title: string,
    items?: { question: string; answer: string }[]
  ) => {
    if (!items || !items.length) return null;
    return (
      <OBDPanel isDark={isDark} className="mt-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <OBDHeading level={2} isDark={isDark}>
            {title}
          </OBDHeading>
          <button
            type="button"
            onClick={() =>
              handleCopyText(
                items
                  .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
                  .join("\n\n")
              )
            }
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              isDark
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Copy All
          </button>
        </div>
        <div className={`space-y-3 text-xs md:text-sm ${themeClasses.labelText}`}>
          {items.map((item, idx) => (
            <div key={idx}>
              <p className={`font-semibold ${themeClasses.headingText}`}>Q: {item.question}</p>
              <p className={themeClasses.mutedText}>A: {item.answer}</p>
            </div>
          ))}
        </div>
      </OBDPanel>
    );
  };

  return (
    <OBDPageContainer
      theme={theme}
      onThemeChange={setTheme}
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="OBD Local Keyword Research Tool"
      tagline="Discover exactly what local customers are searching for in Ocala and surrounding areas."
    >
      {/* Toast Feedback */}
      {actionToast && (
        <div
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg ${
            isDark
              ? "bg-slate-800 text-white border border-slate-700"
              : "bg-white text-slate-900 border border-slate-200"
          }`}
        >
          {actionToast}
        </div>
      )}
      <div className={`space-y-6 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
        {/* Status Label */}
        <div className="mt-4 mb-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
            isDark
              ? "bg-slate-800/50 border-slate-600 text-slate-300"
              : "bg-slate-100 border-slate-300 text-slate-700"
          }`}>
            Status: Production Ready (Pre-Google Ads Live Metrics)
          </span>
        </div>
        {/* Form */}
        <OBDPanel isDark={isDark} className="mt-7">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <OBDHeading level={2} isDark={isDark}>
                Step 1 — Tell us about your business
              </OBDHeading>
              <p className={`text-sm ${themeClasses.mutedText}`}>
                We'll use these details to generate local keyword ideas that actually match what you do in Ocala.
              </p>

              {/* Tier 5A: Empty/Education State (non-sales, no automation claims) */}
              <div
                className={`rounded-2xl border p-4 md:p-5 ${
                  isDark
                    ? "bg-slate-800/40 border-slate-700"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <p className={`text-sm font-semibold ${themeClasses.headingText}`}>
                  What this helps with (and what it doesn’t)
                </p>
                <ul className={`mt-2 list-disc space-y-1 pl-4 text-xs md:text-sm ${themeClasses.labelText}`}>
                  <li>
                    <span className="font-medium">Helps with:</span>{" "}
                    choosing page topics, writing service page headings, planning content clusters, and prioritizing local intent terms.
                  </li>
                  <li>
                    <span className="font-medium">Does not guarantee:</span>{" "}
                    rankings, leads, or results. Use this as planning input—not a promise of performance.
                  </li>
                  <li>
                    <span className="font-medium">Important:</span>{" "}
                    Ads competition ≠ organic ranking certainty.
                  </li>
                  <li>
                    <span className="font-medium">No automation:</span>{" "}
                    nothing is published, scheduled, or changed anywhere automatically.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className={`text-[11px] ${themeClasses.mutedText}`}>
                  Collapse sections to review what was run at a glance.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAllAccordions}
                    className={getInputClasses(isDark, "text-xs py-1 px-2 w-auto")}
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllAccordions}
                    className={getInputClasses(isDark, "text-xs py-1 px-2 w-auto")}
                  >
                    Collapse all
                  </button>
                </div>
              </div>

              <AccordionSection
                isOpen={accordionState.businessAndServices}
                onToggle={() => toggleAccordion("businessAndServices")}
                title="Business & services (seed)"
                summary={accordionSummary}
                isDark={isDark}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="businessName" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Business Name
                    </label>
                    <input
                      type="text"
                      id="businessName"
                      value={form.businessName}
                      onChange={(e) =>
                        updateFormValue("businessName", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="Example: Sunshine Massage & Wellness"
                    />
                  </div>
                  <div>
                    <label htmlFor="businessType" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Business Type *
                    </label>
                    <input
                      type="text"
                      id="businessType"
                      value={form.businessType}
                      onChange={(e) =>
                        updateFormValue("businessType", e.target.value)
                      }
                      className={getInputClasses(isDark)}
                      placeholder="Example: Massage spa, plumber, dentist"
                      required
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="services" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Services & specialties *
                  </label>
                  <textarea
                    id="services"
                    value={form.services}
                    onChange={(e) =>
                      updateFormValue("services", e.target.value)
                    }
                    className={getInputClasses(isDark, "resize-none")}
                    placeholder="List your main services, separated by commas or lines (e.g. deep tissue massage, hot stone massage, couples massage, prenatal massage)"
                    rows={3}
                    required
                  />
                </div>
              </AccordionSection>

              <AccordionSection
                isOpen={accordionState.location}
                onToggle={() => toggleAccordion("location")}
                title="Location modifiers"
                summary={accordionSummary}
                isDark={isDark}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="city" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={form.city}
                      onChange={(e) => updateFormValue("city", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Ocala"
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={form.state}
                      onChange={(e) => updateFormValue("state", e.target.value)}
                      className={getInputClasses(isDark)}
                      placeholder="Florida"
                    />
                  </div>
                  <div>
                    <label htmlFor="radiusMiles" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Target Radius (miles)
                    </label>
                    <input
                      type="number"
                      id="radiusMiles"
                      min={1}
                      max={60}
                      value={form.radiusMiles}
                      onChange={(e) =>
                        updateFormValue(
                          "radiusMiles",
                          Number(e.target.value || 0)
                        )
                      }
                      className={getInputClasses(isDark)}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="websiteUrl" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Website URL (optional)
                  </label>
                  <input
                    type="url"
                    id="websiteUrl"
                    value={form.websiteUrl ?? ""}
                    onChange={(e) =>
                      updateFormValue("websiteUrl", e.target.value)
                    }
                      className={getInputClasses(isDark)}
                      placeholder="https://example.com"
                      aria-label="Website URL (optional)"
                    />
                </div>
              </AccordionSection>

              <AccordionSection
                isOpen={accordionState.targeting}
                onToggle={() => toggleAccordion("targeting")}
                title="Local targeting options"
                summary={accordionSummary}
                isDark={isDark}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className={`text-xs font-medium ${themeClasses.labelText}`}>Include "near me"</p>
                      <p className={`text-[11px] ${themeClasses.mutedText}`}>
                        e.g. "massage near me"
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.includeNearMeVariants}
                      onChange={(e) =>
                        updateFormValue("includeNearMeVariants", e.target.checked)
                      }
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                      aria-label="Include near me variants"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className={`text-xs font-medium ${themeClasses.labelText}`}>Include ZIP codes</p>
                      <p className={`text-[11px] ${themeClasses.mutedText}`}>
                        e.g. 34470, 34471, 34474
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.includeZipCodes}
                      onChange={(e) =>
                        updateFormValue("includeZipCodes", e.target.checked)
                      }
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                      aria-label="Include ZIP codes"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className={`text-xs font-medium ${themeClasses.labelText}`}>
                        Include neighborhoods
                      </p>
                      <p className={`text-[11px] ${themeClasses.mutedText}`}>
                        e.g. "near Downtown Ocala"
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.includeNeighborhoods}
                      onChange={(e) =>
                        updateFormValue("includeNeighborhoods", e.target.checked)
                      }
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                      aria-label="Include neighborhoods"
                    />
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                isOpen={accordionState.strategy}
                onToggle={() => toggleAccordion("strategy")}
                title="Strategy & output"
                summary={accordionSummary}
                isDark={isDark}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="primaryGoal" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Primary goal
                    </label>
                    <select
                      id="primaryGoal"
                      value={form.primaryGoal}
                      onChange={(e) =>
                        updateFormValue(
                          "primaryGoal",
                          e.target.value as LocalKeywordRequest["primaryGoal"]
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="SEO">SEO ranking</option>
                      <option value="Content">Content & blog ideas</option>
                      <option value="Ads">Google Ads targeting</option>
                      <option value="Mixed">Mix of all three</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="maxKeywords" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Max keywords
                    </label>
                    <input
                      type="number"
                      id="maxKeywords"
                      min={20}
                      max={150}
                      value={form.maxKeywords}
                      onChange={(e) =>
                        updateFormValue(
                          "maxKeywords",
                          Number(e.target.value || 0)
                        )
                      }
                      className={getInputClasses(isDark)}
                    />
                    <p className={`text-[11px] mt-1 ${themeClasses.mutedText}`}>
                      40–80 is a sweet spot for most local businesses.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="language" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Language
                    </label>
                    <select
                      id="language"
                      value={form.language}
                      onChange={(e) =>
                        updateFormValue(
                          "language",
                          e.target.value as LocalKeywordRequest["language"]
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="Bilingual">Bilingual</option>
                    </select>
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                isOpen={accordionState.voice}
                onToggle={() => toggleAccordion("voice")}
                title="Voice & tone"
                summary={accordionSummary}
                isDark={isDark}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="personalityStyle" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Personality style
                    </label>
                    <select
                      id="personalityStyle"
                      value={form.personalityStyle}
                      onChange={(e) =>
                        updateFormValue(
                          "personalityStyle",
                          e.target.value as LocalKeywordRequest["personalityStyle"]
                        )
                      }
                      className={getInputClasses(isDark)}
                    >
                      <option value="None">None / neutral</option>
                      <option value="Soft">Soft & friendly</option>
                      <option value="Bold">Bold & confident</option>
                      <option value="High-Energy">High-energy & upbeat</option>
                      <option value="Luxury">Luxury & premium</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="brandVoice" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Brand voice (optional)
                    </label>
                    <textarea
                      id="brandVoice"
                      value={form.brandVoice}
                      onChange={(e) =>
                        updateFormValue("brandVoice", e.target.value)
                      }
                      className={getInputClasses(isDark, "resize-none")}
                      rows={3}
                      placeholder="Describe your brand voice in 1–3 sentences. Example: Warm, welcoming, and community-focused with a touch of Ocala charm."
                    />
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection
                isOpen={accordionState.extras}
                onToggle={() => toggleAccordion("extras")}
                title="Extra strategy ideas"
                summary={accordionSummary}
                isDark={isDark}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className={`text-xs font-medium ${themeClasses.labelText}`}>
                        Blog & article ideas
                      </p>
                      <p className={`text-[11px] ${themeClasses.mutedText}`}>
                        Based on your best keyword clusters.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.includeBlogIdeas}
                      onChange={(e) =>
                        updateFormValue("includeBlogIdeas", e.target.checked)
                      }
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                      aria-label="Include blog and article ideas"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className={`text-xs font-medium ${themeClasses.labelText}`}>FAQ ideas</p>
                      <p className={`text-[11px] ${themeClasses.mutedText}`}>
                        Great for service pages and OBD listing.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.includeFaqIdeas}
                      onChange={(e) =>
                        updateFormValue("includeFaqIdeas", e.target.checked)
                      }
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                      aria-label="Include FAQ ideas"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className={`text-xs font-medium ${themeClasses.labelText}`}>
                        Google Business post ideas
                      </p>
                      <p className={`text-[11px] ${themeClasses.mutedText}`}>
                        Quick posts you can publish this week.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.includeGmbPostIdeas}
                      onChange={(e) =>
                        updateFormValue("includeGmbPostIdeas", e.target.checked)
                      }
                      className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                      aria-label="Include Google Business Profile post ideas"
                    />
                  </div>
                </div>
              </AccordionSection>

            {error && (
              <div className={getErrorPanelClasses(isDark)}>
                <p className="font-medium mb-2">Error:</p>
                <p>{error}</p>
              </div>
            )}

              <div className="flex flex-col gap-2 border-t pt-4 md:flex-row md:items-center md:justify-between">
                <p className={`text-[11px] ${themeClasses.mutedText}`}>
                  Tip: The more detail you include about your services, the
                  smarter the keyword suggestions will be.
                </p>
                <button type="submit" disabled={isLoading} className={SUBMIT_BUTTON_CLASSES}>
                  {isLoading
                    ? "Analyzing local searches..."
                    : "Generate local keyword strategy"}
                </button>
              </div>
            </div>
          </form>
        </OBDPanel>

        {/* Results */}
        {activeResult && (
          <div ref={resultsRef} className="space-y-6">
            <OBDPanel isDark={isDark} className="mt-8">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <OBDHeading level={2} isDark={isDark}>
                    Step 2 — Your local keyword strategy
                  </OBDHeading>
                  {refreshNotice === "current-inputs" && isLoading && (
                    <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                      Refreshing from current inputs…
                    </p>
                  )}
                </div>
                {activeResult && (
                  <button
                    type="button"
                    onClick={handleRefreshResults}
                    disabled={isLoading}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                      isLoading
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    } ${
                      isDark
                        ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {isLoading ? "Refreshing…" : "Refresh Results"}
                  </button>
                )}
              </div>
              <p className={`mt-2 text-sm ${themeClasses.labelText}`}>
                {activeResult.summary || "Your keyword strategy has been generated."}
              </p>
              <p className={`mt-2 text-xs ${themeClasses.mutedText}`}>
                Reminder: keyword research is directional. Ads competition is not a guarantee of organic difficulty or ranking outcomes.
              </p>
              {activeResult.overviewNotes && activeResult.overviewNotes.length > 0 && (
                <ul className={`mt-3 list-disc space-y-1 pl-4 text-xs md:text-sm ${themeClasses.mutedText}`}>
                  {activeResult.overviewNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              )}
            </OBDPanel>

          {/* Legend */}
          <LocalKeywordLegend isDark={isDark} />

          {renderKeywordTable(activeResult.topPriorityKeywords)}
          {renderClusterCards(activeResult.keywordClusters)}

          <div className="grid gap-4 md:grid-cols-2">
            {renderIdeaList("Blog & content ideas", activeResult.blogIdeas)}
            {renderFaqIdeas(
              "FAQ ideas for your site & OBD listing",
              activeResult.faqIdeas
            )}
          </div>

          {renderIdeaList(
            "Google Business Profile post ideas",
            activeResult.gmbPostIdeas
          )}

          {/* Rank Check Panel */}
          <OBDPanel isDark={isDark} className="mt-8">
            <OBDHeading level={2} isDark={isDark}>
              Check Your Current Google Ranking
            </OBDHeading>
            <p className={`mt-2 text-sm ${themeClasses.mutedText}`}>
              See where your business appears today for a specific keyword in Google's organic search results.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setRankError(null);
                setRankIsLoading(true);
                setRankResult(null);

                if (!rankKeyword.trim()) {
                  setRankError("Keyword is required.");
                  setRankIsLoading(false);
                  return;
                }

                if (!rankTargetUrl.trim()) {
                  setRankError("Please enter the URL you want to check.");
                  setRankIsLoading(false);
                  return;
                }

                try {
                  const res = await fetch("/api/local-keyword-research/rank-check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      keyword: rankKeyword.trim(),
                      targetUrl: rankTargetUrl.trim(),
                      city: form.city,
                      state: form.state,
                    }),
                  });

                  if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(
                      (data && typeof data === "object" && "error" in data && typeof data.error === "string")
                        ? data.error
                        : "We couldn't retrieve rank data at this time. Please try again shortly."
                    );
                  }

                  const jsonData = await res.json();
                  // Handle both { ok: true, data: { result: ... } } and { result: ... } formats
                  const resultData = (jsonData && typeof jsonData === "object" && "ok" in jsonData && jsonData.ok === true && "data" in jsonData && jsonData.data && typeof jsonData.data === "object" && "result" in jsonData.data)
                    ? jsonData.data.result
                    : (jsonData && typeof jsonData === "object" && "result" in jsonData)
                    ? jsonData.result
                    : null;
                  if (resultData) {
                    setRankResult(resultData);
                  } else {
                    throw new Error("Invalid response format from rank check API.");
                  }
                } catch (err) {
                  console.error(err);
                  setRankError(
                    err instanceof Error
                      ? err.message
                      : "We couldn't retrieve rank data at this time. Please try again shortly."
                  );
                } finally {
                  setRankIsLoading(false);
                }
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="rankKeyword" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Keyword to check
                  </label>
                  <input
                    type="text"
                    id="rankKeyword"
                    value={rankKeyword || ""}
                    onChange={(e) => setRankKeyword(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder='e.g., "massage therapy Ocala"'
                    required
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    Choose a keyword you're actively targeting or testing.
                  </p>
                </div>
                <div>
                  <label htmlFor="rankTargetUrl" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                    Website or OBD listing URL
                  </label>
                  <input
                    type="url"
                    id="rankTargetUrl"
                    value={rankTargetUrl || ""}
                    onChange={(e) => setRankTargetUrl(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder={form.websiteUrl || "https://yourbusiness.com"}
                    required
                  />
                  <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                    This is the page we'll try to locate in the Google results.
                  </p>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Search location
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    id="rankCity"
                    value={form.city}
                    readOnly
                    className={getInputClasses(isDark, "bg-slate-100 dark:bg-slate-800 cursor-not-allowed")}
                  />
                  <input
                    type="text"
                    id="rankState"
                    value={form.state}
                    readOnly
                    className={getInputClasses(isDark, "bg-slate-100 dark:bg-slate-800 cursor-not-allowed")}
                  />
                </div>
                <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                  Used to simulate local search results. Defaults to your business location.
                </p>
              </div>

              {rankError && (
                <div className={getErrorPanelClasses(isDark)}>
                  <p className="font-medium mb-2">Error:</p>
                  <p>{rankError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={rankIsLoading}
                className={SUBMIT_BUTTON_CLASSES}
              >
                {rankIsLoading ? "Checking Google results…" : "Run Rank Check"}
              </button>
            </form>

            {/* Empty state */}
            {!rankResult && !rankError && (
              <p className={`mt-4 text-xs ${themeClasses.mutedText}`}>
                No rank data yet. Enter a keyword above to run your first check.
              </p>
            )}

            {/* Rank Check Results */}
            {rankResult && (
              <div className={`mt-6 rounded-xl border p-4 md:p-6 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                <h3 className={`text-base font-semibold mb-4 ${themeClasses.headingText}`}>
                  Your Ranking Results
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className={`text-sm font-medium ${themeClasses.labelText}`}>
                      Organic position:
                    </p>
                    {rankResult.currentPositionOrganic !== null ? (
                      <>
                        <p className={`text-lg font-bold ${themeClasses.headingText}`}>
                          #{rankResult.currentPositionOrganic}
                        </p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          {rankResult.currentPositionOrganic !== undefined && rankResult.currentPositionOrganic <= 10
                            ? "Appears on page 1."
                            : rankResult.currentPositionOrganic !== undefined && rankResult.currentPositionOrganic <= 20
                            ? "Appears on page 2."
                            : rankResult.currentPositionOrganic !== undefined && rankResult.currentPositionOrganic <= 30
                            ? "Appears on page 3."
                            : rankResult.currentPositionOrganic !== undefined
                            ? "Appears on page 4+."
                            : "Position not available."}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className={`text-lg font-bold ${themeClasses.headingText}`}>
                          Not found in top 100
                        </p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          Your website did not appear in the top 100 organic results. This is common for newer sites or more competitive keywords.
                        </p>
                      </>
                    )}
                  </div>

                  {rankResult.serpSampleUrls && rankResult.serpSampleUrls.length > 0 && (
                    <div>
                      <p className={`text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                        Top results for this search:
                      </p>
                      <ol className={`list-decimal list-inside space-y-1 text-xs md:text-sm ${themeClasses.labelText}`}>
                        {rankResult.serpSampleUrls.slice(0, 10).map((url, idx) => (
                          <li key={idx} className="break-all">
                            {url === rankResult.targetUrl ? (
                              <span className="font-semibold text-[#29c4a9]">{url}</span>
                            ) : (
                              url
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className={`pt-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                      Data source: {rankResult.dataSource ?? "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </OBDPanel>

          {/* Future: wire this table to real rank history stored in the database. */}
          {/* Saved Rank History Panel */}
          <OBDPanel isDark={isDark} className="mt-8">
            <OBDHeading level={2} isDark={isDark}>
              Saved Rank History
            </OBDHeading>
            <p className={`mt-2 text-sm ${themeClasses.mutedText}`}>
              Track how your search visibility changes over time for your most important keywords.
            </p>
            <p className={`mt-2 text-xs ${themeClasses.mutedText} italic`}>
              Coming soon — requires database to save history.
            </p>

            {rankHistory === null || rankHistory.length === 0 ? (
              <p className={`mt-4 text-xs ${themeClasses.mutedText}`}>
                Rank history will appear here once tracking is connected. For now, you can run single checks above to see your current position.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs md:text-sm">
                  <thead className={`border-b text-[11px] uppercase tracking-wide ${themeClasses.mutedText} md:text-xs`}>
                    <tr>
                      <th className="py-2 pr-4">Keyword</th>
                      <th className="py-2 pr-4">Position</th>
                      <th className="py-2 pr-4">Checked</th>
                      <th className="py-2 pr-4">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankHistory.map((item) => (
                      <tr key={item.id} className={`border-b ${isDark ? "border-slate-700 hover:bg-slate-800/50" : "border-slate-200 hover:bg-slate-50"} last:border-0`}>
                        <td className={`py-2 pr-4 font-medium ${themeClasses.headingText}`}>{item.keyword}</td>
                        <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                          {item.positionOrganic != null
                            ? `#${item.positionOrganic}`
                            : "Not found"}
                        </td>
                        <td className={`py-2 pr-4 ${themeClasses.labelText}`}>
                          {new Date(item.checkedAt).toLocaleString()}
                        </td>
                        <td className={`py-2 pr-4 text-xs ${themeClasses.mutedText}`}>
                          {item.dataSource ?? "Unknown"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OBDPanel>
          </div>
        )}

        {/* Tier 5A parity: Unified Export Center (single authoritative export UI) */}
        <div ref={exportCenterRef} />
        <OBDPanel isDark={isDark} className="mt-6">
          <OBDHeading level={2} isDark={isDark}>
            Export Center
          </OBDHeading>
          <div className="mt-3">
            <LKRTExportCenterPanel
              isDark={isDark}
              isLoading={isLoading}
              activeResult={activeResult}
              allKeywords={activeResult?.topPriorityKeywords ?? []}
              visibleKeywords={filteredAndSortedKeywords}
              form={form}
            />
          </div>
        </OBDPanel>

        {/* Empty results education (before first run) */}
        {!activeResult && !error && (
          <OBDPanel isDark={isDark} className="mt-6">
            <OBDHeading level={2} isDark={isDark}>
              What you’ll get after you run this
            </OBDHeading>
            <p className={`mt-2 text-sm ${themeClasses.labelText}`}>
              A local keyword strategy: clusters, priority keywords, intent labels, and optional ideas (blog/FAQ/GBP posts).
            </p>
            <p className={`mt-2 text-xs ${themeClasses.mutedText}`}>
              This tool does not track rankings, scrape Google results, or automatically publish anything.
            </p>
          </OBDPanel>
        )}

      </div>

      {/* Tier 5A: Sticky Action Bar (UI-only) */}
      <OBDStickyActionBar isDark={isDark}>
        <button
          type="button"
          onClick={handleRefreshResults}
          disabled={!canRefresh}
          className={`${SUBMIT_BUTTON_CLASSES} ${!canRefresh ? "opacity-50 cursor-not-allowed" : ""}`}
          title={!activeResult ? "Generate results first to enable refresh." : (isLoading ? "Please wait…" : "Refresh from current inputs")}
        >
          {isLoading ? "Refreshing…" : "Refresh Results"}
        </button>
        <button
          type="button"
          onClick={handleOpenExportCenter}
          disabled={!canExport}
          className={`${secondaryActionButtonClasses} ${!canExport ? "opacity-50 cursor-not-allowed" : ""}`}
          title={!activeResult ? "Generate results first to enable export." : (isLoading ? "Please wait…" : "Open Export Center")}
        >
          Export
        </button>
      </OBDStickyActionBar>
    </OBDPageContainer>
  );
}

