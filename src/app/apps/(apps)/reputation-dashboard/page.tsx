"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import ResultCard from "@/components/obd/ResultCard";
import OBDStickyActionBar, { OBD_STICKY_ACTION_BAR_OFFSET_CLASS } from "@/components/obd/OBDStickyActionBar";
import { getThemeClasses, getInputClasses, getPanelClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from "@/lib/obd-framework/layout-helpers";
import LocalSeoAccordionSection from "@/app/apps/local-seo-page-builder/components/LocalSeoAccordionSection";
import {
  ReputationDashboardRequest,
  ReputationDashboardResponse,
  ReviewInput,
  DateRangeMode,
} from "@/lib/apps/reputation-dashboard/types";
import { filterReviewsByDateRange, getDateRangeBoundaries } from "@/lib/apps/reputation-dashboard/engine";
import { parseCSV, generateCSVTemplate, exportReviewsToCSV, CSVParseResult } from "@/lib/apps/reputation-dashboard/csv-utils";
import {
  addSnapshotAndPrune,
  loadActiveSnapshotId,
  loadSnapshots,
  saveActiveSnapshotId,
  RD_ENGINE_VERSION,
  RD_SNAPSHOT_SCHEMA_VERSION,
  type ReputationSnapshot,
} from "@/lib/apps/reputation-dashboard/snapshot-storage";
import {
  buildRdToReviewResponderDraftHandoffV1,
  getRdReviewStableIdV1,
  storeRdToReviewResponderDraftHandoff,
} from "@/lib/apps/reputation-dashboard/handoff";

// Simple SVG Chart Component with tooltips
function SimpleLineChart({
  data,
  label,
  isDark,
  maxValue,
}: {
  data: { date: string; value: number }[];
  label: string;
  isDark: boolean;
  maxValue?: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className={`h-48 flex items-center justify-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        No data available
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Handle single point case
  if (data.length === 1) {
    const point = data[0];
    const x = padding + chartWidth / 2;
    const y = padding + chartHeight / 2;
    
    return (
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height} className="w-full h-auto">
          <circle
            cx={x}
            cy={y}
            r="6"
            fill={isDark ? "#29c4a9" : "#0d9488"}
          />
          <text
            x={x}
            y={y - 10}
            textAnchor="middle"
            className={`text-xs font-medium ${isDark ? "fill-slate-200" : "fill-slate-700"}`}
          >
            {point.value.toFixed(1)} on {new Date(point.date).toLocaleDateString()}
          </text>
          <text
            x={width / 2}
            y={height - 10}
            textAnchor="middle"
            className={`text-xs ${isDark ? "fill-slate-400" : "fill-slate-600"}`}
          >
            {label}
          </text>
        </svg>
      </div>
    );
  }

  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1; // Prevent division by zero

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="w-full h-auto">
        <polyline
          fill="none"
          stroke={isDark ? "#29c4a9" : "#0d9488"}
          strokeWidth="2"
          points={points}
        />
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1)) * chartWidth;
          const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
          const isHovered = hoveredIndex === i;
          
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? "6" : "4"}
                fill={isDark ? "#29c4a9" : "#0d9488"}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(i)}
                onBlur={() => setHoveredIndex(null)}
                tabIndex={0}
                role="button"
                aria-label={`${label}: ${d.value.toFixed(1)} on ${new Date(d.date).toLocaleDateString()}`}
                className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#29c4a9] focus:ring-offset-2 rounded-full"
              />
              {isHovered && (
                <g>
                  <rect
                    x={x - 30}
                    y={y - 25}
                    width="60"
                    height="20"
                    fill={isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)"}
                    rx="4"
                  />
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    className={`text-xs font-medium ${isDark ? "fill-white" : "fill-slate-900"}`}
                  >
                    {d.value.toFixed(1)}
                  </text>
                  <text
                    x={x}
                    y={y + 20}
                    textAnchor="middle"
                    className={`text-xs ${isDark ? "fill-slate-300" : "fill-slate-600"}`}
                  >
                    {new Date(d.date).toLocaleDateString()}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        <text
          x={width / 2}
          y={height - 10}
          textAnchor="middle"
          className={`text-xs ${isDark ? "fill-slate-400" : "fill-slate-600"}`}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

function SimpleBarChart({
  data,
  label,
  isDark,
  maxValue,
}: {
  data: { date: string; value: number }[];
  label: string;
  isDark: boolean;
  maxValue?: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className={`h-48 flex items-center justify-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        No data available
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Ensure max is at least 1 to prevent division by zero, handle 0 counts gracefully
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  const barWidth = Math.max(4, chartWidth / data.length - 4);

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="w-full h-auto">
        {data.map((d, i) => {
          const x = padding + (i * chartWidth) / data.length + 2;
          const barHeight = max > 0 ? (d.value / max) * chartHeight : 0;
          const y = padding + chartHeight - barHeight;
          const isHovered = hoveredIndex === i;
          
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight || 1} // Show at least 1px for 0 values
                fill={isDark ? "#29c4a9" : "#0d9488"}
                opacity={isHovered ? 0.8 : 1}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(i)}
                onBlur={() => setHoveredIndex(null)}
                tabIndex={0}
                role="button"
                aria-label={`${label}: ${d.value} on ${new Date(d.date).toLocaleDateString()}`}
                className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#29c4a9] focus:ring-offset-2"
              />
              {isHovered && (
                <g>
                  <rect
                    x={x + barWidth / 2 - 30}
                    y={y - 25}
                    width="60"
                    height="20"
                    fill={isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)"}
                    rx="4"
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 10}
                    textAnchor="middle"
                    className={`text-xs font-medium ${isDark ? "fill-white" : "fill-slate-900"}`}
                  >
                    {d.value}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y={y + barHeight + 20}
                    textAnchor="middle"
                    className={`text-xs ${isDark ? "fill-slate-300" : "fill-slate-600"}`}
                  >
                    {new Date(d.date).toLocaleDateString()}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        <text
          x={width / 2}
          y={height - 10}
          textAnchor="middle"
          className={`text-xs ${isDark ? "fill-slate-400" : "fill-slate-600"}`}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

type RdSectionStatus = "good" | "needs-attention" | "no-data";
type RdSnapshotStatus = "live" | "partial" | "no-data";

function StatusChip({
  status,
  isDark,
  title,
}: {
  status: RdSectionStatus;
  isDark: boolean;
  title?: string;
}) {
  const styles: Record<RdSectionStatus, { label: string; bg: string; text: string; border: string }> = {
    good: {
      label: "Good",
      bg: isDark ? "bg-green-900/30" : "bg-green-50",
      text: isDark ? "text-green-300" : "text-green-700",
      border: isDark ? "border-green-700" : "border-green-200",
    },
    "needs-attention": {
      label: "Needs Attention",
      bg: isDark ? "bg-yellow-900/30" : "bg-yellow-50",
      text: isDark ? "text-yellow-300" : "text-yellow-700",
      border: isDark ? "border-yellow-700" : "border-yellow-200",
    },
    "no-data": {
      label: "No Data",
      bg: isDark ? "bg-slate-800" : "bg-slate-100",
      text: isDark ? "text-slate-300" : "text-slate-600",
      border: isDark ? "border-slate-700" : "border-slate-200",
    },
  };

  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${s.bg} ${s.text} ${s.border}`}
      title={title}
    >
      {s.label}
    </span>
  );
}

function SnapshotStatusChip({
  status,
  isDark,
}: {
  status: RdSnapshotStatus;
  isDark: boolean;
}) {
  const styles: Record<RdSnapshotStatus, { label: string; bg: string; text: string; border: string }> = {
    live: {
      label: "Live",
      bg: isDark ? "bg-green-900/30" : "bg-green-50",
      text: isDark ? "text-green-300" : "text-green-700",
      border: isDark ? "border-green-700" : "border-green-200",
    },
    partial: {
      label: "Partial",
      bg: isDark ? "bg-yellow-900/30" : "bg-yellow-50",
      text: isDark ? "text-yellow-300" : "text-yellow-700",
      border: isDark ? "border-yellow-700" : "border-yellow-200",
    },
    "no-data": {
      label: "No Data",
      bg: isDark ? "bg-slate-800" : "bg-slate-100",
      text: isDark ? "text-slate-300" : "text-slate-600",
      border: isDark ? "border-slate-700" : "border-slate-200",
    },
  };

  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${s.bg} ${s.text} ${s.border}`}
    >
      {s.label}
    </span>
  );
}

function TooltipButton({
  isDark,
  disabled,
  tooltip,
  variant = "secondary",
  onClick,
  children,
}: {
  isDark: boolean;
  disabled?: boolean;
  tooltip?: string;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const enabledClass =
    variant === "primary"
      ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
      : variant === "danger"
      ? isDark
        ? "bg-red-900/50 text-red-200 hover:bg-red-900/70"
        : "bg-red-100 text-red-700 hover:bg-red-200"
      : isDark
      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
      : "bg-slate-200 text-slate-700 hover:bg-slate-300";

  const btnClass = `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    disabled ? "opacity-50 cursor-not-allowed" : enabledClass
  }`;

  return (
    <div className="relative group">
      <button type="button" className={btnClass} disabled={disabled} onClick={onClick}>
        {children}
      </button>
      {disabled && tooltip ? (
        <span
          role="tooltip"
          className={`absolute right-0 top-full mt-2 px-2 py-1 rounded text-xs whitespace-nowrap z-50 ${
            isDark
              ? "bg-slate-800 text-slate-200 border border-slate-700"
              : "bg-slate-900 text-slate-100 border border-slate-700"
          } opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none`}
        >
          {tooltip}
        </span>
      ) : null}
    </div>
  );
}

function getDateRangeLabel(mode: DateRangeMode, startDate: string, endDate: string): string {
  if (mode === "30d") return "Last 30 days";
  if (mode === "90d") return "Last 90 days";
  if (!startDate || !endDate) return "Custom range";
  return `${startDate} → ${endDate}`;
}

function safeUuid(): string {
  try {
    // Browser modern API
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `rd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ReputationDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const { data: session, status: sessionStatus } = useSession();

  // Tier 5B tenant scope: align with existing pattern in other apps (businessId == session.user.id)
  const businessId = session?.user?.id || session?.user?.email || "";

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reviews, setReviews] = useState<ReviewInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastComputed, setLastComputed] = useState<string | null>(null);

  // Tier 5A: deterministic “active analytics payload” (frozen until explicit refresh)
  const [activePayload, setActivePayload] = useState<{
    request: ReputationDashboardRequest;
    response: ReputationDashboardResponse;
  } | null>(null);
  const [isDirtySinceCompute, setIsDirtySinceCompute] = useState(false);

  // Tier 5B: localStorage snapshots (immutable)
  const [snapshots, setSnapshots] = useState<ReputationSnapshot[]>([]);
  const [activeSnapshot, setActiveSnapshot] = useState<ReputationSnapshot | null>(null);
  const [showSnapshotPicker, setShowSnapshotPicker] = useState(false);

  // Export Center (placeholder modal)
  const [showExportCenter, setShowExportCenter] = useState(false);

  // Tier 5C: safe ecosystem routing (draft-only handoffs + link-only CTAs)
  const [selectedRecentReviewIds, setSelectedRecentReviewIds] = useState<string[]>([]);
  const [handoffToast, setHandoffToast] = useState<null | { message: string; href: string; linkLabel: string }>(null);

  // Accordion state (results sections)
  type SectionKey =
    | "overall"
    | "ratingDistribution"
    | "recentReviews"
    | "sentimentThemes"
    | "responseCoverage"
    | "platformCoverage";

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    overall: true,
    ratingDistribution: false,
    recentReviews: false,
    sentimentThemes: false,
    responseCoverage: false,
    platformCoverage: false,
  });

  const advisoryRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [newReview, setNewReview] = useState<Partial<ReviewInput>>({
    platform: "Google",
    rating: 5,
    reviewText: "",
    authorName: "",
    reviewDate: "", // Will be set after mount to avoid hydration mismatch
    responded: false,
    responseDate: "",
    responseText: "",
  });

  // CSV import state
  const [csvPreview, setCsvPreview] = useState<CSVParseResult | null>(null);
  const [csvDisplayLimit, setCsvDisplayLimit] = useState(200);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const csvModalRef = useRef<HTMLDivElement>(null);
  const scoreBreakdownRef = useRef<HTMLDivElement>(null);

  // localStorage persistence
  const STORAGE_KEY = "reputation-dashboard-data";

  // Set mounted flag and initialize client-only values after hydration
  useEffect(() => {
    setMounted(true);
    // Set reviewDate only after mount to avoid hydration mismatch
    setNewReview((prev) => ({
      ...prev,
      reviewDate: prev.reviewDate || new Date().toISOString().split("T")[0],
    }));
    
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.businessName) setBusinessName(data.businessName);
        if (data.businessType) setBusinessType(data.businessType);
        if (data.dateRangeMode) setDateRangeMode(data.dateRangeMode);
        if (data.startDate) setStartDate(data.startDate);
        if (data.endDate) setEndDate(data.endDate);
        if (data.reviews && Array.isArray(data.reviews)) setReviews(data.reviews);
        if (data.lastComputed) setLastComputed(data.lastComputed);
      }
    } catch {
      // Silently fail - localStorage may be unavailable or corrupted
    }
  }, []);

  // Auto-dismiss handoff toast (keep long enough to click the link)
  useEffect(() => {
    if (!handoffToast) return;
    const t = window.setTimeout(() => setHandoffToast(null), 8000);
    return () => window.clearTimeout(t);
  }, [handoffToast]);

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

  useEffect(() => {
    // Save to localStorage whenever data changes
    try {
      const data = {
        businessName,
        businessType,
        dateRangeMode,
        startDate,
        endDate,
        reviews,
        lastComputed,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Silently fail - localStorage may be unavailable or quota exceeded
    }
  }, [businessName, businessType, dateRangeMode, startDate, endDate, reviews, lastComputed]);

  // Reset print view after printing (Tier 5A polish)
  useEffect(() => {
    const onAfterPrint = () => setShowPrintView(false);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  // ESC key handler for modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAddReviewModal) setShowAddReviewModal(false);
        if (csvPreview) setCsvPreview(null);
        if (showScoreBreakdown) setShowScoreBreakdown(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showAddReviewModal, csvPreview, showScoreBreakdown]);

  // Focus trap for modals
  useEffect(() => {
    if (showAddReviewModal && modalRef.current) {
      const modal = modalRef.current;
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };
      
      modal.addEventListener("keydown", handleTab);
      firstElement?.focus();
      
      return () => modal.removeEventListener("keydown", handleTab);
    }
  }, [showAddReviewModal]);

  const activeResult = activePayload?.response ?? null;
  const activeRequest = activePayload?.request ?? null;

  const markDirty = () => {
    if (activePayload) setIsDirtySinceCompute(true);
  };

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: true }));
  };

  const activeIncludedReviews = useMemo(() => {
    if (!activeRequest) return [];
    return filterReviewsByDateRange(activeRequest.reviews, activeRequest.dateRange);
  }, [activeRequest]);

  const createSnapshotRecord = (
    request: ReputationDashboardRequest,
    response: ReputationDashboardResponse
  ): ReputationSnapshot => {
    const includedReviews = filterReviewsByDateRange(request.reviews, request.dateRange);
    const platformCountsLocal: Record<ReviewInput["platform"], number> = {
      Google: 0,
      Facebook: 0,
      Yelp: 0,
      Other: 0,
    };
    const ratingDistLocal = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
    let responded = 0;

    for (const r of includedReviews) {
      platformCountsLocal[r.platform] = (platformCountsLocal[r.platform] || 0) + 1;
      const rating = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      ratingDistLocal[rating]++;
      if (r.responded) responded++;
    }

    const total = includedReviews.length;
    const responseRatePct = total > 0 ? Math.round((responded / total) * 100) : 0;

    const { start, end } = getDateRangeBoundaries(request.dateRange);
    const resolvedStart = start.toISOString().split("T")[0];
    const resolvedEnd = end.toISOString().split("T")[0];

    return {
      id: safeUuid(),
      businessId,
      createdAt: new Date().toISOString(),
      dateWindow: {
        mode: request.dateRange.mode,
        startDate: request.dateRange.startDate,
        endDate: request.dateRange.endDate,
        resolvedStart,
        resolvedEnd,
      },
      platformCounts: platformCountsLocal,
      ratingDistribution: ratingDistLocal,
      responseCoverage: {
        total,
        responded,
        responseRatePct,
        hasNoResponses: responded === 0,
      },
      sentimentSummary: {
        positivePct: response.sentimentMix.positive,
        neutralPct: response.sentimentMix.neutral,
        negativePct: response.sentimentMix.negative,
      },
      themesSummary: {
        topThemeNames: (response.topThemes || []).map((t) => t.name).slice(0, 3),
      },
      request,
      response,
      engineVersion: RD_ENGINE_VERSION,
      schemaVersion: RD_SNAPSHOT_SCHEMA_VERSION,
      inputDigest: {
        value: response.snapshotId,
        method: "rd-snapshotId",
      },
    };
  };

  const ratingDistribution = useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
    for (const r of activeIncludedReviews) {
      const rating = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      dist[rating]++;
    }
    return dist;
  }, [activeIncludedReviews]);

  const platformCounts = useMemo(() => {
    const counts: Record<ReviewInput["platform"], number> = {
      Google: 0,
      Facebook: 0,
      Yelp: 0,
      Other: 0,
    };
    for (const r of activeIncludedReviews) {
      counts[r.platform] = (counts[r.platform] || 0) + 1;
    }
    return counts;
  }, [activeIncludedReviews]);

  const recentReviews = useMemo(() => {
    const sorted = [...activeIncludedReviews].sort(
      (a, b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime()
    );
    return sorted.slice(0, 10);
  }, [activeIncludedReviews]);

  const recentReviewsWithIds = useMemo(() => {
    return recentReviews.map((r) => ({ ...r, __stableId: getRdReviewStableIdV1(r) }));
  }, [recentReviews]);

  // Clear selection when switching snapshots / recomputing results.
  useEffect(() => {
    setSelectedRecentReviewIds([]);
  }, [activeSnapshot?.id, activeResult?.snapshotId]);

  const selectedRecentReviews = useMemo(() => {
    const selected = new Set(selectedRecentReviewIds);
    return recentReviewsWithIds.filter((r) => selected.has(r.__stableId));
  }, [recentReviewsWithIds, selectedRecentReviewIds]);

  const unrespondedReviewsCount = useMemo(() => {
    return activeIncludedReviews.filter((r) => !r.responded).length;
  }, [activeIncludedReviews]);

  const uniqueReviewerCount = useMemo(() => {
    const names = activeIncludedReviews
      .map((r) => (r.authorName || "").trim())
      .filter(Boolean);
    if (names.length === 0) return null;
    const uniq = new Set(names.map((n) => n.toLowerCase()));
    return uniq.size;
  }, [activeIncludedReviews]);

  const helpDeskAwareness = useMemo(() => {
    if (!activeResult) return { show: false, reason: "" };
    const corpus = [
      ...activeIncludedReviews.map((r) => r.reviewText || ""),
      ...(activeResult.topThemes || []).map((t) => t.name || ""),
    ]
      .join(" ")
      .toLowerCase();
    const hits = [
      "hours",
      "open",
      "close",
      "pricing",
      "price",
      "cost",
      "refund",
      "return",
      "returns",
      "policy",
      "policies",
      "warranty",
      "appointment",
      "schedule",
      "booking",
      "deposit",
      "fees",
      "insurance",
    ];
    const found = hits.some((k) => corpus.includes(k));
    return {
      show: found,
      reason: found ? "Some reviews/themes mention policies, hours, or pricing questions." : "",
    };
  }, [activeIncludedReviews, activeResult]);

  const seoAwareness = useMemo(() => {
    if (!activeResult) return { show: false, reason: "" };
    const lowVolume = activeResult.metadata.hasLowData || activeResult.kpis.reviewCount < 10;
    const weakResponseCoverage = activeResult.kpis.responseRate < 80;

    const pts = Array.isArray(activeResult.reviewsPerWeek) ? activeResult.reviewsPerWeek : [];
    const values = pts.map((p) => Number(p.value) || 0);
    const hasTrendWindow = values.length >= 8;
    const last4 = hasTrendWindow ? values.slice(-4).reduce((a, b) => a + b, 0) : 0;
    const prev4 = hasTrendWindow ? values.slice(-8, -4).reduce((a, b) => a + b, 0) : 0;
    const declining = hasTrendWindow && prev4 > 0 ? last4 < prev4 * 0.75 : false;

    const show = lowVolume || weakResponseCoverage || declining;
    const reasons: string[] = [];
    if (lowVolume) reasons.push("low recent review volume");
    if (declining) reasons.push("a softer recent trend");
    if (weakResponseCoverage) reasons.push("response coverage could improve");

    return {
      show,
      reason: reasons.length > 0 ? `This snapshot shows ${reasons.join(", ")}.` : "",
    };
  }, [activeResult]);

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      setBusinessName("");
      setBusinessType("");
      setDateRangeMode("30d");
      setStartDate("");
      setEndDate("");
      setReviews([]);
      setActivePayload(null);
      setIsDirtySinceCompute(false);
      setShowExportCenter(false);
      setError(null);
      setLastComputed(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const formatTimestamp = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return isoString;
    }
  };

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reputation-dashboard-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!activeSnapshot) return;
    const exportData = {
      ...activeSnapshot,
      exportedAt: new Date().toISOString(),
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reputation-snapshot-${activeSnapshot.response.snapshotId}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!activeSnapshot) return;
    const included = filterReviewsByDateRange(activeSnapshot.request.reviews, activeSnapshot.request.dateRange);
    if (included.length === 0) return;
    const csv = exportReviewsToCSV(included);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reviews-${activeSnapshot.response.snapshotId}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showHandoffToast = (message: string, href: string, linkLabel: string) => {
    setHandoffToast({ message, href, linkLabel });
  };

  const toggleRecentReviewSelection = (stableId: string) => {
    setSelectedRecentReviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(stableId)) next.delete(stableId);
      else next.add(stableId);
      return Array.from(next);
    });
  };

  const clearRecentReviewSelection = () => setSelectedRecentReviewIds([]);

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

  const handleAddReview = () => {
    if (!newReview.reviewText?.trim() || !newReview.reviewDate) {
      setError("Review text and date are required");
      return;
    }
    if (!newReview.rating || newReview.rating < 1 || newReview.rating > 5) {
      setError("Rating must be between 1 and 5");
      return;
    }

    const review: ReviewInput = {
      platform: newReview.platform || "Google",
      rating: newReview.rating,
      reviewText: newReview.reviewText,
      authorName: newReview.authorName || undefined,
      reviewDate: newReview.reviewDate,
      responded: newReview.responded || false,
      responseDate: newReview.responseDate || undefined,
      responseText: newReview.responseText || undefined,
    };

    setReviews([...reviews, review]);
    markDirty();
    setNewReview({
      platform: "Google",
      rating: 5,
      reviewText: "",
      authorName: "",
      reviewDate: new Date().toISOString().split("T")[0],
      responded: false,
      responseDate: "",
      responseText: "",
    });
    setShowAddReviewModal(false);
    setError(null);
  };

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parseResult = parseCSV(text);
      
      if (parseResult.errors.length > 0 && parseResult.reviews.length === 0) {
        setError(`CSV parsing errors: ${parseResult.errors.map((e) => e.errors.join(", ")).join("; ")}`);
        return;
      }

      // Performance guard: warn if large import
      if (parseResult.reviews.length > 2000) {
        setError("Large import detected — computations may take a moment.");
      }

      setCsvPreview(parseResult);
      setCsvDisplayLimit(200); // Reset display limit
      setError(null);
    };

    reader.readAsText(file);
  };

  const handleConfirmCSVImport = () => {
    if (csvPreview && csvPreview.reviews.length > 0) {
      setReviews([...reviews, ...csvPreview.reviews]);
      markDirty();
      setCsvPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const runCompute = async (opts?: { persistSnapshot?: boolean }) => {
    const persistSnapshot = !!opts?.persistSnapshot;
    setError(null);

    if (!businessName.trim()) {
      setError("Business name is required");
      return;
    }

    if (reviews.length === 0) {
      setError("Please add at least one review");
      return;
    }

    setLoading(true);

    try {
      const dateRange: ReputationDashboardRequest["dateRange"] =
        dateRangeMode === "custom"
          ? {
              mode: "custom",
              startDate: startDate || undefined,
              endDate: endDate || undefined,
            }
          : { mode: dateRangeMode };

      if (dateRangeMode === "custom" && (!startDate || !endDate)) {
        setError("Start date and end date are required for custom date range");
        setLoading(false);
        return;
      }

      const request: ReputationDashboardRequest = {
        businessName: businessName.trim(),
        businessType: businessType.trim() || undefined,
        dateRange,
        reviews: reviews.map((r) => ({ ...r })), // freeze inputs for deterministic display
      };

      const res = await fetch("/api/reputation-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json() as ReputationDashboardResponse;
      setLastComputed(data.computedAt);

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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong processing the dashboard. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runCompute({ persistSnapshot: false });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return isDark ? "text-green-400" : "text-green-600";
    if (score >= 60) return isDark ? "text-yellow-400" : "text-yellow-600";
    return isDark ? "text-red-400" : "text-red-600";
  };

  const snapshotStatus: RdSnapshotStatus = !activeSnapshot
    ? "no-data"
    : isDirtySinceCompute
    ? "partial"
    : "live";

  const isCustomRangeInvalid = dateRangeMode === "custom" && (!startDate || !endDate);
  const canCompute = !!businessName.trim() && reviews.length > 0 && !isCustomRangeInvalid;
  const canCreateSnapshot = canCompute && !!businessId && sessionStatus !== "loading";

  const refreshTooltip = !businessName.trim()
    ? "Add a business name and at least one review to generate the dashboard."
    : reviews.length === 0
    ? "Add at least one review to generate the dashboard."
    : isCustomRangeInvalid
    ? "Select a start and end date to use a custom range."
    : !businessId && sessionStatus !== "loading"
    ? "Sign in to create saved snapshots."
    : loading
    ? "Processing… please wait."
    : undefined;

  const handleRefreshSnapshot = async () => {
    await runCompute({ persistSnapshot: true });
  };

  const handleViewInsights = () => {
    if (!activeResult) return;
    openSection("overall");
    // Let the accordion expand first, then scroll.
    setTimeout(() => {
      advisoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleSelectSnapshot = (snapshotIdToSelect: string) => {
    if (!businessId) return;
    const match = snapshots.find((s) => s.id === snapshotIdToSelect) || null;
    if (!match) return;

    setActiveSnapshot(match);
    setActivePayload({ request: match.request, response: match.response });
    setIsDirtySinceCompute(false);
    setLastComputed(match.response.computedAt || null);

    // Align form with snapshot (viewing is snapshot-derived; edits are explicit)
    setBusinessName(match.request.businessName);
    setBusinessType(match.request.businessType || "");
    setDateRangeMode(match.request.dateRange.mode);
    setStartDate(match.request.dateRange.startDate || "");
    setEndDate(match.request.dateRange.endDate || "");
    setReviews(match.request.reviews || []);

    saveActiveSnapshotId(localStorage, businessId, match.id);
    setShowSnapshotPicker(false);
  };

  const handlePrintSnapshot = () => {
    if (!activeSnapshot) return;
    setOpenSections({
      overall: true,
      ratingDistribution: true,
      recentReviews: true,
      sentimentThemes: true,
      responseCoverage: true,
      platformCoverage: true,
    });
    setShowPrintView(true);
    setTimeout(() => window.print(), 50);
  };

  const activeDateRangeLabel = activeRequest
    ? activeRequest.dateRange.mode === "custom"
      ? `${activeRequest.dateRange.startDate || "—"} → ${activeRequest.dateRange.endDate || "—"}`
      : getDateRangeLabel(activeRequest.dateRange.mode, "", "")
    : "—";

  const overallStatus: RdSectionStatus = !activeResult
    ? "no-data"
    : activeResult.metadata.hasLowData ||
      activeResult.kpis.avgRating < 4.0 ||
      activeResult.kpis.responseRate < 80 ||
      activeResult.sentimentMix.negative >= 20
    ? "needs-attention"
    : "good";

  const overallSummary = !activeResult
    ? "No snapshot yet — click Refresh Snapshot to compute."
    : `${activeResult.snapshotId} • ${activeResult.kpis.reviewCount} reviews • Avg ${activeResult.kpis.avgRating.toFixed(1)} • Response ${activeResult.kpis.responseRate}%`;

  const ratingDistributionStatus: RdSectionStatus = !activeResult
    ? "no-data"
    : ratingDistribution[1] + ratingDistribution[2] > 0 || activeResult.kpis.avgRating < 4.0
    ? "needs-attention"
    : "good";

  const ratingDistributionSummary = !activeResult
    ? "No snapshot yet."
    : `5★ ${ratingDistribution[5]} • 4★ ${ratingDistribution[4]} • 3★ ${ratingDistribution[3]} • 2★ ${ratingDistribution[2]} • 1★ ${ratingDistribution[1]}`;

  const recentReviewsStatus: RdSectionStatus = !activeResult
    ? "no-data"
    : activeIncludedReviews.length === 0
    ? "no-data"
    : recentReviews.some((r) => r.rating <= 2)
    ? "needs-attention"
    : "good";

  const recentReviewsSummary = !activeResult
    ? "No snapshot yet."
    : activeIncludedReviews.length === 0
    ? "No reviews in the selected date range."
    : `Latest ${Math.min(10, activeIncludedReviews.length)} of ${activeIncludedReviews.length} • Most recent ${recentReviews[0]?.reviewDate}`;

  const sentimentThemesStatus: RdSectionStatus = !activeResult
    ? "no-data"
    : activeResult.metadata.hasLowData || activeResult.sentimentMix.negative >= 20
    ? "needs-attention"
    : "good";

  const sentimentThemesSummary = !activeResult
    ? "No snapshot yet."
    : `Positive ${activeResult.sentimentMix.positive}% • Neutral ${activeResult.sentimentMix.neutral}% • Negative ${activeResult.sentimentMix.negative}% • Top theme: ${activeResult.topThemes[0]?.name || "—"}`;

  const responseCoverageStatus: RdSectionStatus = !activeResult
    ? "no-data"
    : activeResult.metadata.hasNoResponses ||
      activeResult.kpis.responseRate < 80 ||
      (activeResult.kpis.medianResponseTime > 0 && activeResult.kpis.medianResponseTime > 48)
    ? "needs-attention"
    : "good";

  const responseCoverageSummary = !activeResult
    ? "No snapshot yet."
    : activeResult.metadata.hasNoResponses
    ? `Response rate ${activeResult.kpis.responseRate}% • No responses yet`
    : `Response rate ${activeResult.kpis.responseRate}% • Median ${activeResult.kpis.medianResponseTime < 24 ? `${Math.round(activeResult.kpis.medianResponseTime)}h` : `${Math.round(activeResult.kpis.medianResponseTime / 24)}d`}`;

  const platformCoverageStatus: RdSectionStatus = !activeResult
    ? "no-data"
    : (() => {
        const activePlatforms = Object.values(platformCounts).filter((c) => c > 0).length;
        return activeIncludedReviews.length === 0
          ? "no-data"
          : activePlatforms <= 1
          ? "needs-attention"
          : "good";
      })();

  const platformCoverageSummary = !activeResult
    ? "No snapshot yet."
    : activeIncludedReviews.length === 0
    ? "No reviews in the selected date range."
    : `Google ${platformCounts.Google} • Facebook ${platformCounts.Facebook} • Yelp ${platformCounts.Yelp} • Other ${platformCounts.Other}`;

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Reputation Dashboard"
      tagline="See all your reviews, trends, and sentiment in one place."
    >
      {/* Tier 5C: confirmation toast (explicit click-only routing) */}
      {handoffToast ? (
        <div
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg border max-w-[92vw] ${
            isDark ? "bg-slate-800 text-white border-slate-700" : "bg-white text-slate-900 border-slate-200"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <div className="text-sm">{handoffToast.message}</div>
            <a
              href={handoffToast.href}
              className={`text-sm font-medium underline ${
                isDark ? "text-[#29c4a9]" : "text-[#0d9488]"
              }`}
            >
              {handoffToast.linkLabel}
            </a>
            <button
              type="button"
              onClick={() => setHandoffToast(null)}
              className={`ml-auto px-2 py-1 rounded ${
                isDark ? "text-slate-200 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-100"
              }`}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

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

        {/* Tier 5B: Snapshot control (localStorage, immutable) */}
        <div
          className={`mt-4 rounded-xl border p-3 ${
            isDark ? "bg-slate-800/40 border-slate-700" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${themeClasses.headingText}`}>
                Snapshot
              </div>
              <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                {activeSnapshot ? (
                  <>You’re viewing a saved snapshot. Numbers won’t change unless you refresh.</>
                ) : (
                  <>Create your first snapshot to lock in a point-in-time view.</>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SnapshotStatusChip status={snapshotStatus} isDark={isDark} />
              <button
                type="button"
                onClick={() => setShowSnapshotPicker(true)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  isDark
                    ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-100"
                }`}
                title={snapshots.length === 0 ? "Create a snapshot with Refresh Snapshot." : "Select a saved snapshot"}
              >
                {activeSnapshot
                  ? `Saved • ${formatTimestamp(activeSnapshot.response.computedAt)}`
                  : snapshots.length > 0
                  ? "Select snapshot"
                  : "View snapshots"}
              </button>
            </div>
          </div>
          {snapshots.length > 0 && !activeSnapshot ? (
            <div className={`mt-2 text-[11px] ${themeClasses.mutedText}`}>
              You have {snapshots.length} saved snapshot{snapshots.length === 1 ? "" : "s"} for this account.
            </div>
          ) : null}
        </div>

        {/* Form card */}
        <OBDPanel isDark={isDark} className="mt-7">
        {!mounted ? (
          <div className="space-y-6">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Business Info */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Business Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="businessName"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="businessName"
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      markDirty();
                    }}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Ocala Coffee Shop"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="businessType"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Business Type (Optional)
                  </label>
                  <input
                    type="text"
                    id="businessType"
                    value={businessType}
                    onChange={(e) => {
                      setBusinessType(e.target.value);
                      markDirty();
                    }}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Restaurant, Retail, Service"
                  />
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Last Computed & Snapshot ID */}
            {(lastComputed || activeResult) && (
              <div className={`flex items-center gap-3 flex-wrap text-xs ${themeClasses.mutedText}`}>
                {lastComputed && (
                  <span>
                    Last computed: {formatTimestamp(lastComputed)}
                  </span>
                )}
                {activeResult?.snapshotId && (
                  <span className={`px-2 py-1 rounded ${
                    isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                  }`}>
                    Snapshot ID: {activeResult.snapshotId}
                  </span>
                )}
              </div>
            )}

            {/* Date Range */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                Date Range
              </h3>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="dateRangeMode"
                    className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                  >
                    Select Range
                  </label>
                  <select
                    id="dateRangeMode"
                    value={dateRangeMode}
                    onChange={(e) => {
                      setDateRangeMode(e.target.value as DateRangeMode);
                      markDirty();
                    }}
                    className={getInputClasses(isDark)}
                  >
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="custom">Custom range</option>
                  </select>
                </div>

                {dateRangeMode === "custom" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="startDate"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        id="startDate"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          markDirty();
                        }}
                        className={getInputClasses(isDark)}
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="endDate"
                        className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}
                      >
                        End Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        id="endDate"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          markDirty();
                        }}
                        className={getInputClasses(isDark)}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Review Management */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                  Reviews ({reviews.length})
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowAddReviewModal(true)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    Add Review
                  </button>
                  <label
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    Import CSV
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleCSVImport}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isDark
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    Download Template
                  </button>
                  {reviews.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isDark
                          ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Export CSV
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClearData}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isDark
                        ? "bg-red-900/50 text-red-300 hover:bg-red-900/70"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    }`}
                  >
                    Clear Data
                  </button>
                </div>
              </div>

              {reviews.length === 0 && (
                <p className={`text-sm ${themeClasses.mutedText} py-4`}>
                  No reviews yet — add or import to begin.
                </p>
              )}

              {reviews.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {reviews.map((review, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-xs ${
                        isDark ? "bg-slate-800" : "bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={themeClasses.labelText}>
                          {review.platform} • {review.rating}⭐ • {review.reviewDate}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setReviews(reviews.filter((_, i) => i !== idx));
                            markDirty();
                          }}
                          className={`text-red-500 hover:text-red-600 ${isDark ? "hover:text-red-400" : ""}`}
                        >
                          Remove
                        </button>
                      </div>
                      <p className={`mt-1 truncate ${themeClasses.mutedText}`}>
                        {review.reviewText}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className={getErrorPanelClasses(isDark)}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || reviews.length === 0}
              className={SUBMIT_BUTTON_CLASSES}
            >
              {loading ? "Processing..." : "Generate Dashboard"}
            </button>
          </div>
        </form>
        )}
        </OBDPanel>

      {/* Add Review Modal */}
      {showAddReviewModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowAddReviewModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-review-title"
        >
          <div
            ref={modalRef}
            className={`${getPanelClasses(isDark)} max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="add-review-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Add Review
              </h2>
              <button
                onClick={() => setShowAddReviewModal(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Platform <span className="text-red-500">*</span>
                </label>
                <select
                  value={newReview.platform}
                  onChange={(e) =>
                    setNewReview({ ...newReview, platform: e.target.value as ReviewInput["platform"] })
                  }
                  className={getInputClasses(isDark)}
                >
                  <option value="Google">Google</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Yelp">Yelp</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Rating <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={newReview.rating}
                  onChange={(e) =>
                    setNewReview({ ...newReview, rating: parseInt(e.target.value, 10) })
                  }
                  className={getInputClasses(isDark)}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Review Text <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newReview.reviewText}
                  onChange={(e) => setNewReview({ ...newReview, reviewText: e.target.value })}
                  className={getInputClasses(isDark, "resize-none")}
                  rows={4}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Author Name (Optional)
                </label>
                <input
                  type="text"
                  value={newReview.authorName}
                  onChange={(e) => setNewReview({ ...newReview, authorName: e.target.value })}
                  className={getInputClasses(isDark)}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                  Review Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newReview.reviewDate}
                  onChange={(e) => setNewReview({ ...newReview, reviewDate: e.target.value })}
                  className={getInputClasses(isDark)}
                  required
                />
              </div>

              <div>
                <label className={`flex items-center gap-2 ${themeClasses.labelText}`}>
                  <input
                    type="checkbox"
                    checked={newReview.responded}
                    onChange={(e) => setNewReview({ ...newReview, responded: e.target.checked })}
                    className="rounded"
                  />
                  Responded?
                </label>
              </div>

              {newReview.responded && (
                <>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Response Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={newReview.responseDate}
                      onChange={(e) => setNewReview({ ...newReview, responseDate: e.target.value })}
                      className={getInputClasses(isDark)}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
                      Response Text (Optional)
                    </label>
                    <textarea
                      value={newReview.responseText}
                      onChange={(e) => setNewReview({ ...newReview, responseText: e.target.value })}
                      className={getInputClasses(isDark, "resize-none")}
                      rows={3}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddReview}
                  className={SUBMIT_BUTTON_CLASSES}
                >
                  Add Review
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddReviewModal(false)}
                  className={`px-6 py-3 rounded-full font-medium transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Preview Modal */}
      {csvPreview && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setCsvPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="csv-preview-title"
        >
          <div
            ref={csvModalRef}
            className={`${getPanelClasses(isDark)} max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="csv-preview-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                CSV Preview ({csvPreview.reviews.length} valid reviews
                {csvPreview.errors.length > 0 && `, ${csvPreview.errors.length} errors`})
              </h2>
              <button
                onClick={() => setCsvPreview(null)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {csvPreview.errors.length > 0 && (
              <div className={`mb-4 p-3 rounded-lg ${isDark ? "bg-yellow-900/20 border border-yellow-700" : "bg-yellow-50 border border-yellow-200"}`}>
                <h3 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>Row Errors:</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {csvPreview.errors.map((error, idx) => (
                    <div key={idx} className={`text-xs ${themeClasses.mutedText}`}>
                      Row {error.rowIndex}: {error.errors.join(", ")}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              {csvPreview.reviews
                .slice(0, csvDisplayLimit)
                .map((review, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded text-xs ${
                      isDark ? "bg-slate-800" : "bg-slate-100"
                    }`}
                  >
                    <span className={themeClasses.labelText}>
                      {review.platform} • {review.rating}⭐ • {review.reviewDate}
                    </span>
                    <p className={`mt-1 truncate ${themeClasses.mutedText}`}>
                      {review.reviewText}
                    </p>
                  </div>
                ))}
            </div>
            
            {csvPreview.reviews.length > csvDisplayLimit && (
              <button
                type="button"
                onClick={() => setCsvDisplayLimit((prev) => prev + 200)}
                className={`w-full mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                Show more ({csvPreview.reviews.length - csvDisplayLimit} remaining)
              </button>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmCSVImport}
                className={SUBMIT_BUTTON_CLASSES}
                disabled={csvPreview.reviews.length === 0}
              >
                Confirm Import ({csvPreview.reviews.length} reviews)
              </button>
              <button
                type="button"
                onClick={() => setCsvPreview(null)}
                className={`px-6 py-3 rounded-full font-medium transition-colors ${
                  isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score Breakdown Drawer */}
      {showScoreBreakdown && activeResult && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowScoreBreakdown(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="score-breakdown-title"
        >
          <div
            ref={scoreBreakdownRef}
            className={`${getPanelClasses(isDark)} max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="score-breakdown-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Reputation Score Breakdown
              </h2>
              <button
                onClick={() => setShowScoreBreakdown(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${isDark ? "bg-slate-800" : "bg-slate-50"}`}>
                <div className="text-center mb-4">
                  <div className={`text-4xl font-bold ${getScoreColor(activeResult.scoreBreakdown.totalScore)}`}>
                    {activeResult.scoreBreakdown.totalScore}
                  </div>
                  <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Total Reputation Score</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-medium ${themeClasses.headingText}`}>Rating Component</span>
                    <span className={`text-lg font-bold ${themeClasses.headingText}`}>
                      {activeResult.scoreBreakdown.ratingComponent.contribution.toFixed(1)} / {activeResult.scoreBreakdown.ratingComponent.weight}
                    </span>
                  </div>
                  <div className={`text-sm ${themeClasses.mutedText} mb-2`}>
                    Average Rating: {activeResult.scoreBreakdown.ratingComponent.avgRating.toFixed(1)} / 5.0
                  </div>
                  <div className={`text-xs ${themeClasses.mutedText}`}>
                    Formula: (Avg Rating / 5) × {activeResult.scoreBreakdown.ratingComponent.weight} = 
                    ({activeResult.scoreBreakdown.ratingComponent.avgRating.toFixed(1)} / 5) × {activeResult.scoreBreakdown.ratingComponent.weight} = 
                    {activeResult.scoreBreakdown.ratingComponent.contribution.toFixed(1)}
                  </div>
                </div>

                <div className={`p-3 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-medium ${themeClasses.headingText}`}>Response Component</span>
                    <span className={`text-lg font-bold ${themeClasses.headingText}`}>
                      {activeResult.scoreBreakdown.responseComponent.contribution.toFixed(1)} / {activeResult.scoreBreakdown.responseComponent.weight}
                    </span>
                  </div>
                  <div className={`text-sm ${themeClasses.mutedText} mb-2`}>
                    Response Rate: {activeResult.scoreBreakdown.responseComponent.responseRate}%
                    {activeResult.metadata.hasNoResponses && (
                      <span
                        className="ml-1 cursor-help"
                        title="No responses yet. Using neutral default (50% = 20 points) for score calculation."
                      >
                        ℹ️
                      </span>
                    )}
                  </div>
                  <div className={`text-xs ${themeClasses.mutedText}`}>
                    {activeResult.metadata.hasNoResponses ? (
                      <>Formula: No responses yet, using neutral default (50% / 100) × {activeResult.scoreBreakdown.responseComponent.weight} = 20.0</>
                    ) : (
                      <>Formula: (Response Rate / 100) × {activeResult.scoreBreakdown.responseComponent.weight} = 
                      ({activeResult.scoreBreakdown.responseComponent.responseRate} / 100) × {activeResult.scoreBreakdown.responseComponent.weight} = 
                      {activeResult.scoreBreakdown.responseComponent.contribution.toFixed(1)}</>
                    )}
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                <h3 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>Raw Inputs</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className={themeClasses.mutedText}>Total Reviews: </span>
                    <span className={themeClasses.headingText}>{activeResult.scoreBreakdown.rawInputs.totalReviews}</span>
                  </div>
                  <div>
                    <span className={themeClasses.mutedText}>Total Ratings Sum: </span>
                    <span className={themeClasses.headingText}>{activeResult.scoreBreakdown.rawInputs.totalRatings}</span>
                  </div>
                  <div>
                    <span className={themeClasses.mutedText}>Average Rating: </span>
                    <span className={themeClasses.headingText}>{activeResult.scoreBreakdown.rawInputs.avgRating.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className={themeClasses.mutedText}>Responded Count: </span>
                    <span className={themeClasses.headingText}>{activeResult.scoreBreakdown.rawInputs.respondedCount}</span>
                  </div>
                  <div className="col-span-2">
                    <span className={themeClasses.mutedText}>Response Rate: </span>
                    <span className={themeClasses.headingText}>{activeResult.scoreBreakdown.rawInputs.totalResponseRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print View Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Results (Tier 5A — accordion layout; deterministic) */}
      <div className={`mt-7 space-y-4 ${showPrintView ? "print-content" : ""}`}>
        {activeResult && activeRequest ? (
          <>
            {/* Snapshot banner */}
            {!showPrintView && (
              <div
                className={`rounded-xl border p-3 text-xs ${themeClasses.mutedText} ${
                  isDark ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-200"
                }`}
              >
                {activeSnapshot ? (
                  <>
                    <span className="font-medium">Viewing saved snapshot:</span>{" "}
                    <span className={themeClasses.labelText}>{activeSnapshot.response.snapshotId}</span>
                    {" "}• Window: {activeSnapshot.dateWindow.resolvedStart} → {activeSnapshot.dateWindow.resolvedEnd}
                    {" "}• Computed: {formatTimestamp(activeSnapshot.response.computedAt)}
                  </>
                ) : (
                  <>
                    <span className="font-medium">Draft preview (not saved):</span>{" "}
                    <span className={themeClasses.labelText}>{activeResult.snapshotId}</span>
                    {" "}• Window: {activeDateRangeLabel}
                    {" "}• Computed: {formatTimestamp(activeResult.computedAt)}
                    {" "}• <span className="font-medium">Refresh Snapshot</span> to save an immutable snapshot.
                  </>
                )}
              </div>
            )}

            {/* Report Header (Print View) */}
            {showPrintView && (
              <div className="mb-4 pb-4 border-b border-slate-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-xl font-bold ${themeClasses.headingText}`}>
                      {activeRequest.businessName} - Reputation Dashboard
                    </h2>
                    {activeRequest.businessType && (
                      <p className={`text-sm ${themeClasses.mutedText}`}>{activeRequest.businessType}</p>
                    )}
                  </div>
                  <div className={`text-xs text-right ${themeClasses.mutedText}`}>
                    <div>Report generated: {activeResult.computedAt ? formatTimestamp(activeResult.computedAt) : "N/A"}</div>
                    {activeResult.snapshotId && <div>Snapshot ID: {activeResult.snapshotId}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Low Data Warning */}
            {activeResult.metadata.hasLowData && (
              <div
                className={`p-4 rounded-lg border ${
                  isDark ? "bg-yellow-900/20 border-yellow-700" : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-yellow-500 text-lg">⚠️</span>
                  <div>
                    <div className={`font-semibold mb-1 ${themeClasses.headingText}`}>
                      Low data: trends and themes may be unreliable.
                    </div>
                    <div className={`text-sm ${themeClasses.mutedText}`}>
                      You have {activeResult.kpis.reviewCount} review{activeResult.kpis.reviewCount !== 1 ? "s" : ""}. Add more reviews (at least 5 recommended) for more reliable summaries.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            className={`rounded-2xl border p-4 ${
              isDark ? "bg-slate-800/40 border-slate-700" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className={`text-sm font-semibold ${themeClasses.headingText}`}>No snapshot yet</div>
            <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
              Add reviews, then click <span className="font-medium">Refresh Snapshot</span>. Viewing the page never recomputes numbers.
            </div>
          </div>
        )}

        <div className="space-y-4">
          <LocalSeoAccordionSection
            isDark={isDark}
            title="Overall Reputation Snapshot"
            summary={overallSummary}
            statusChip={<StatusChip isDark={isDark} status={overallStatus} />}
            isOpen={openSections.overall}
            onToggle={() => toggleSection("overall")}
          >
            {activeResult && activeRequest ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className={`text-xs ${themeClasses.mutedText}`}>
                    Snapshot: {activeResult.snapshotId} • {activeDateRangeLabel}
                  </div>
                  <div className={`text-xs ${themeClasses.mutedText}`}>
                    Computed: {formatTimestamp(activeResult.computedAt)}
                  </div>
                </div>

                {/* KPI Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <OBDPanel isDark={isDark}>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(activeResult.kpis.reputationScore)}`}>
                        {activeResult.kpis.reputationScore}
                      </div>
                      <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Reputation Score</div>
                      <button
                        type="button"
                        onClick={() => setShowScoreBreakdown(true)}
                        className={`text-xs mt-1 ${themeClasses.mutedText} cursor-pointer hover:underline`}
                      >
                        ℹ️ How it’s calculated
                      </button>
                    </div>
                  </OBDPanel>

                  <OBDPanel isDark={isDark}>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                        {activeResult.kpis.avgRating.toFixed(1)}
                      </div>
                      <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Avg Rating</div>
                    </div>
                  </OBDPanel>

                  <OBDPanel isDark={isDark}>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                        {activeResult.kpis.reviewCount}
                      </div>
                      <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Reviews</div>
                    </div>
                  </OBDPanel>

                  <OBDPanel isDark={isDark}>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                        {activeResult.kpis.responseRate}%
                      </div>
                      <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Response Rate</div>
                    </div>
                  </OBDPanel>

                  <OBDPanel isDark={isDark}>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                        {activeResult.metadata.hasNoResponses ? (
                          "N/A"
                        ) : activeResult.kpis.medianResponseTime < 24 ? (
                          `${Math.round(activeResult.kpis.medianResponseTime)}h`
                        ) : (
                          `${Math.round(activeResult.kpis.medianResponseTime / 24)}d`
                        )}
                      </div>
                      <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                        Median Response Time
                        {activeResult.metadata.hasNoResponses && (
                          <span
                            className="ml-1 cursor-help"
                            title="No responses yet. Response time will appear once you respond to reviews."
                          >
                            ℹ️
                          </span>
                        )}
                      </div>
                    </div>
                  </OBDPanel>
                </div>

                {/* Trends (existing charts) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Rating Over Time</h3>
                    <SimpleLineChart data={activeResult.ratingOverTime} label="Rating" isDark={isDark} maxValue={5} />
                  </div>
                  <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Reviews Per Week</h3>
                    <SimpleBarChart data={activeResult.reviewsPerWeek} label="Reviews" isDark={isDark} />
                  </div>
                </div>

                {/* Advisory section (existing signals/actions) */}
                <div ref={advisoryRef} className="space-y-4">
                  {activeResult.qualitySignals.length > 0 && (
                    <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                      <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Advisory Signals</h3>
                      <div className="space-y-3">
                        {activeResult.qualitySignals.map((signal) => {
                          const severityColors = {
                            info: isDark ? "bg-blue-900/20 border-blue-700 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-700",
                            warning: isDark ? "bg-yellow-900/20 border-yellow-700 text-yellow-300" : "bg-yellow-50 border-yellow-200 text-yellow-700",
                            critical: isDark ? "bg-red-900/20 border-red-700 text-red-300" : "bg-red-50 border-red-200 text-red-700",
                          } as const;

                          return (
                            <div key={signal.id} className={`p-3 rounded-lg border ${severityColors[signal.severity]}`}>
                              <div className="flex items-start gap-2 mb-1">
                                <span className="font-semibold">{signal.shortTitle}</span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    signal.severity === "critical"
                                      ? isDark ? "bg-red-900/50" : "bg-red-100"
                                      : signal.severity === "warning"
                                      ? isDark ? "bg-yellow-900/50" : "bg-yellow-100"
                                      : isDark ? "bg-blue-900/50" : "bg-blue-100"
                                  }`}
                                >
                                  {signal.severity}
                                </span>
                              </div>
                              <p className={`text-sm mb-2 ${themeClasses.mutedText}`}>{signal.detail}</p>
                              <p className={`text-xs ${themeClasses.mutedText}`}>
                                <strong>Next step:</strong> {signal.suggestedNextStep}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeResult.priorityActions.length > 0 && (
                    <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                      <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Priority Actions</h3>
                      <div className="space-y-3">
                        {activeResult.priorityActions.map((action) => (
                          <ResultCard
                            key={action.id}
                            title={action.title}
                            isDark={isDark}
                            copyText={action.actionableText}
                          >
                            <p className={`text-sm ${themeClasses.mutedText} mb-2`}>{action.description}</p>
                          </ResultCard>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`text-sm ${themeClasses.mutedText}`}>No snapshot yet.</div>
            )}
          </LocalSeoAccordionSection>

          <LocalSeoAccordionSection
            isDark={isDark}
            title="Rating Distribution"
            summary={ratingDistributionSummary}
            statusChip={<StatusChip isDark={isDark} status={ratingDistributionStatus} />}
            isOpen={openSections.ratingDistribution}
            onToggle={() => toggleSection("ratingDistribution")}
          >
            {activeResult ? (
              <div className="space-y-2">
                {([5, 4, 3, 2, 1] as const).map((stars) => {
                  const total = activeIncludedReviews.length || 1;
                  const count = ratingDistribution[stars];
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={stars} className="flex items-center gap-3">
                      <div className={`w-12 text-xs ${themeClasses.labelText}`}>{stars}★</div>
                      <div className={`flex-1 h-2 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                        <div
                          className="h-2 rounded-full bg-[#29c4a9]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className={`w-20 text-right text-xs ${themeClasses.mutedText}`}>
                        {count} ({pct}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`text-sm ${themeClasses.mutedText}`}>No snapshot yet.</div>
            )}
          </LocalSeoAccordionSection>

          <LocalSeoAccordionSection
            isDark={isDark}
            title="Recent Reviews"
            summary={recentReviewsSummary}
            statusChip={<StatusChip isDark={isDark} status={recentReviewsStatus} />}
            isOpen={openSections.recentReviews}
            onToggle={() => toggleSection("recentReviews")}
          >
            {activeResult ? (
              recentReviews.length === 0 ? (
                <div className={`text-sm ${themeClasses.mutedText}`}>No reviews in the selected date range.</div>
              ) : (
                <div className="space-y-2">
                  <div className={`flex flex-wrap items-center justify-between gap-2 pb-2 border-b ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                    <div className={`text-xs ${themeClasses.mutedText}`}>
                      {selectedRecentReviewIds.length} selected
                      {!activeSnapshot ? " • Save a snapshot to enable draft handoff." : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <TooltipButton
                        isDark={isDark}
                        disabled={selectedRecentReviewIds.length === 0}
                        tooltip="Select at least 1 review."
                        onClick={clearRecentReviewSelection}
                      >
                        Clear selection
                      </TooltipButton>
                      <TooltipButton
                        isDark={isDark}
                        variant="primary"
                        disabled={!activeSnapshot || selectedRecentReviewIds.length === 0}
                        tooltip={
                          !activeSnapshot
                            ? "Save a snapshot first."
                            : selectedRecentReviewIds.length === 0
                            ? "Select at least 1 review."
                            : undefined
                        }
                        onClick={sendSelectedToReviewResponderDraft}
                      >
                        Send selected to Review Responder (Draft)
                      </TooltipButton>
                    </div>
                  </div>

                  {recentReviewsWithIds.map((r) => {
                    const checked = selectedRecentReviewIds.includes(r.__stableId);
                    const checkboxDisabled = !activeSnapshot;
                    return (
                      <div
                        key={r.__stableId}
                        className={`p-3 rounded-lg border ${
                          isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className="pt-0.5"
                              title={checkboxDisabled ? "Save a snapshot first to enable selection." : undefined}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={checkboxDisabled}
                                onChange={() => toggleRecentReviewSelection(r.__stableId)}
                                className="rounded border-gray-300 text-[#29c4a9] focus:ring-[#29c4a9]"
                                aria-label="Select review for draft handoff"
                              />
                            </span>
                            <div className="min-w-0">
                              <div className={`text-xs ${themeClasses.labelText}`}>
                                {r.reviewDate} • {r.platform} • {r.rating}★
                              </div>
                              <p className={`mt-1 text-xs ${themeClasses.mutedText}`}>
                                {r.reviewText.length > 220 ? `${r.reviewText.slice(0, 220)}…` : r.reviewText}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`text-xs whitespace-nowrap ${
                              r.responded ? (isDark ? "text-green-300" : "text-green-700") : themeClasses.mutedText
                            }`}
                            title={r.responded ? "Marked as responded (manual entry)" : "Marked as not responded (manual entry)"}
                          >
                            {r.responded ? "Responded" : "No response"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className={`text-sm ${themeClasses.mutedText}`}>No snapshot yet.</div>
            )}
          </LocalSeoAccordionSection>

          <LocalSeoAccordionSection
            isDark={isDark}
            title="Sentiment Themes"
            summary={sentimentThemesSummary}
            statusChip={<StatusChip isDark={isDark} status={sentimentThemesStatus} />}
            isOpen={openSections.sentimentThemes}
            onToggle={() => toggleSection("sentimentThemes")}
          >
            {activeResult ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Themes */}
                <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Top Themes</h3>
                  <div className="space-y-3">
                    {activeResult.metadata.hasLowData ? (
                      <p className={`text-sm ${themeClasses.mutedText}`}>Needs at least 5 reviews to detect themes.</p>
                    ) : activeResult.topThemes.length === 0 ? (
                      <p className={themeClasses.mutedText}>No themes identified</p>
                    ) : (
                      activeResult.topThemes.map((theme, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg ${isDark ? "bg-slate-900/40" : "bg-white"}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-medium ${themeClasses.headingText}`}>{theme.name}</span>
                            <span className={`text-xs ${themeClasses.mutedText}`}>{theme.count} mentions</span>
                          </div>
                          {theme.exampleSnippet && (
                            <p className={`text-xs ${themeClasses.mutedText}`}>
                              “{theme.exampleSnippet}”
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Sentiment Mix */}
                <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                    Sentiment Mix
                    {activeResult.metadata.hasLowData && (
                      <span
                        className="ml-2 text-xs cursor-help"
                        title="Derived primarily from ratings (limited sample). More reviews improve sentiment accuracy."
                      >
                        ℹ️
                      </span>
                    )}
                  </h3>
                  <div className="space-y-3">
                    {(["positive", "neutral", "negative"] as const).map((key) => {
                      const label = key[0].toUpperCase() + key.slice(1);
                      const value = activeResult.sentimentMix[key];
                      const color =
                        key === "positive" ? "bg-green-500" : key === "neutral" ? "bg-yellow-500" : "bg-red-500";
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={themeClasses.labelText}>{label}</span>
                            <span className={themeClasses.headingText}>{value}%</span>
                          </div>
                          <div className={`w-full rounded-full h-2 ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                            <div className={`${color} h-2 rounded-full`} style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {activeResult.sentimentMix.reviewSentiments && activeResult.sentimentMix.reviewSentiments.length > 0 && (
                      <div className={`mt-2 text-xs ${themeClasses.mutedText} pt-2 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                        <span
                          className="cursor-help"
                          title={`Sentiment derived from: ${activeResult.sentimentMix.reviewSentiments
                            .map((s) => `${s.derivedFrom} (${s.confidence} confidence)`)
                            .join(", ")}`}
                        >
                          ℹ️ Sentiment analysis uses rating baseline with text keyword overrides where applicable.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`text-sm ${themeClasses.mutedText}`}>No snapshot yet.</div>
            )}
          </LocalSeoAccordionSection>

          <LocalSeoAccordionSection
            isDark={isDark}
            title="Response Coverage"
            summary={responseCoverageSummary}
            statusChip={<StatusChip isDark={isDark} status={responseCoverageStatus} />}
            isOpen={openSections.responseCoverage}
            onToggle={() => toggleSection("responseCoverage")}
          >
            {activeResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    <div className={`text-2xl font-bold ${themeClasses.headingText}`}>
                      {activeResult.kpis.responseRate}%
                    </div>
                    <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>Response rate (this window)</div>
                  </div>
                  <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    <div className={`text-2xl font-bold ${themeClasses.headingText}`}>
                      {activeResult.metadata.hasNoResponses ? "N/A" : activeResult.kpis.medianResponseTime < 24 ? `${Math.round(activeResult.kpis.medianResponseTime)}h` : `${Math.round(activeResult.kpis.medianResponseTime / 24)}d`}
                    </div>
                    <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>Median response time</div>
                  </div>
                </div>
                <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>Responses Per Week</h3>
                  <SimpleBarChart data={activeResult.responsesPerWeek} label="Responses" isDark={isDark} />
                </div>
              </div>
            ) : (
              <div className={`text-sm ${themeClasses.mutedText}`}>No snapshot yet.</div>
            )}
          </LocalSeoAccordionSection>

          <LocalSeoAccordionSection
            isDark={isDark}
            title="Platform Coverage"
            summary={platformCoverageSummary}
            statusChip={<StatusChip isDark={isDark} status={platformCoverageStatus} />}
            isOpen={openSections.platformCoverage}
            onToggle={() => toggleSection("platformCoverage")}
          >
            {activeResult ? (
              <div className="space-y-2">
                {(["Google", "Facebook", "Yelp", "Other"] as const).map((p) => {
                  const total = activeIncludedReviews.length || 1;
                  const count = platformCounts[p];
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={p} className={`p-3 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${themeClasses.headingText}`}>{p}</span>
                        <span className={`text-xs ${themeClasses.mutedText}`}>{count} ({pct}%)</span>
                      </div>
                      <div className={`mt-2 w-full rounded-full h-2 ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                        <div className="h-2 rounded-full bg-[#29c4a9]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`text-sm ${themeClasses.mutedText}`}>No snapshot yet.</div>
            )}
          </LocalSeoAccordionSection>
        </div>
      </div>

      {/* Tier 5C: Next Steps (safe ecosystem routing, explicit user action only) */}
      {activeResult ? (
        <OBDPanel isDark={isDark} className="mt-6">
          <h2 className={`text-lg font-semibold ${themeClasses.headingText}`}>Next Steps</h2>
          <p className={`text-sm mt-1 ${themeClasses.mutedText}`}>
            These are optional, safe next steps. Nothing is sent or created automatically.
          </p>

          <div className="mt-4 space-y-4">
            <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-900/40 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className={`text-sm font-semibold ${themeClasses.headingText}`}>Review Responder</div>
              <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                {unrespondedReviewsCount} review{unrespondedReviewsCount === 1 ? "" : "s"} marked “No response” in this snapshot window.
                {selectedRecentReviewIds.length > 0 ? ` • ${selectedRecentReviewIds.length} selected for a draft handoff.` : ""}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <TooltipButton
                  isDark={isDark}
                  variant="primary"
                  disabled={!activeSnapshot || !businessId || (unrespondedReviewsCount === 0 && selectedRecentReviewIds.length === 0)}
                  tooltip={
                    !activeSnapshot
                      ? "Save a snapshot first."
                      : !businessId
                      ? "Business context is required."
                      : unrespondedReviewsCount === 0 && selectedRecentReviewIds.length === 0
                      ? "No unresponded reviews detected. Select reviews to draft responses."
                      : undefined
                  }
                  onClick={() => {
                    if (!businessId) return;
                    window.location.href = `/apps/review-responder?businessId=${encodeURIComponent(businessId)}`;
                  }}
                >
                  Respond in Review Responder
                </TooltipButton>
                <TooltipButton
                  isDark={isDark}
                  disabled={!activeSnapshot || selectedRecentReviewIds.length === 0}
                  tooltip={
                    !activeSnapshot
                      ? "Save a snapshot first."
                      : selectedRecentReviewIds.length === 0
                      ? "Select at least 1 review in Recent Reviews."
                      : undefined
                  }
                  onClick={sendSelectedToReviewResponderDraft}
                >
                  Send selected (Draft)
                </TooltipButton>
              </div>
              <div className={`text-[11px] mt-2 ${themeClasses.mutedText}`}>
                Draft-only: you’ll review and generate responses inside Review Responder.
              </div>
            </div>

            <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-900/40 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className={`text-sm font-semibold ${themeClasses.headingText}`}>AI Help Desk</div>
              <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                Turn repeated questions into Help Desk answers. This can reduce repeated confusion in future reviews.
              </div>
              <div className="mt-3">
                <TooltipButton
                  isDark={isDark}
                  disabled={!businessId || !helpDeskAwareness.show}
                  tooltip={!businessId ? "Business context is required." : "No repeated confusion signals detected in this snapshot."}
                  onClick={() => {
                    if (!businessId) return;
                    window.location.href = `/apps/ai-help-desk?businessId=${encodeURIComponent(businessId)}`;
                  }}
                >
                  Turn repeated questions into Help Desk answers
                </TooltipButton>
              </div>
              {helpDeskAwareness.show && helpDeskAwareness.reason ? (
                <div className={`text-[11px] mt-2 ${themeClasses.mutedText}`}>{helpDeskAwareness.reason}</div>
              ) : null}
            </div>

            <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-900/40 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className={`text-sm font-semibold ${themeClasses.headingText}`}>SEO Audit & Roadmap</div>
              <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                Reputation influences local SEO trust signals.
              </div>
              <div className="mt-3">
                <TooltipButton
                  isDark={isDark}
                  disabled={!businessId || !seoAwareness.show}
                  tooltip={!businessId ? "Business context is required." : "No SEO-related reputation flags detected for this snapshot."}
                  onClick={() => {
                    if (!businessId) return;
                    window.location.href = `/apps/seo-audit-roadmap?businessId=${encodeURIComponent(businessId)}`;
                  }}
                >
                  Open SEO Audit & Roadmap
                </TooltipButton>
              </div>
              {seoAwareness.show && seoAwareness.reason ? (
                <div className={`text-[11px] mt-2 ${themeClasses.mutedText}`}>{seoAwareness.reason}</div>
              ) : null}
            </div>

            <div className={`p-4 rounded-lg border ${isDark ? "bg-slate-900/40 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className={`text-sm font-semibold ${themeClasses.headingText}`}>CRM</div>
              {uniqueReviewerCount !== null ? (
                <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  {uniqueReviewerCount} unique reviewer{uniqueReviewerCount === 1 ? "" : "s"} this snapshot (manual entry).
                </div>
              ) : (
                <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                  Unique reviewers: not available (names not provided).
                </div>
              )}
              <div className={`text-[11px] mt-2 ${themeClasses.mutedText}`}>
                No contacts are created automatically.
              </div>
            </div>
          </div>
        </OBDPanel>
      ) : null}

      {/* Export Center (placeholder modal) */}
      {showExportCenter && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print"
          onClick={() => setShowExportCenter(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-center-title"
        >
          <div
            className={`${getPanelClasses(isDark)} max-w-xl w-full mx-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 id="export-center-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Export Center
              </h2>
              <button
                onClick={() => setShowExportCenter(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                aria-label="Close export center"
              >
                ×
              </button>
            </div>
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
            {activeSnapshot ? (
              <div className={`mt-4 text-[11px] ${themeClasses.mutedText}`}>
                Based on {activeSnapshot.response.snapshotId} • {formatTimestamp(activeSnapshot.response.computedAt)}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Snapshot Picker (Tier 5B) */}
      {showSnapshotPicker && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print"
          onClick={() => setShowSnapshotPicker(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="snapshot-picker-title"
        >
          <div
            className={`${getPanelClasses(isDark)} max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 id="snapshot-picker-title" className={`text-lg font-semibold ${themeClasses.headingText}`}>
                Snapshots
              </h2>
              <button
                onClick={() => setShowSnapshotPicker(false)}
                className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                aria-label="Close snapshot picker"
              >
                ×
              </button>
            </div>
            <p className={`text-xs ${themeClasses.mutedText} mb-4`}>
              Viewing a snapshot never recomputes. Refresh Snapshot creates a new snapshot and keeps older ones unchanged.
            </p>

            {snapshots.length === 0 ? (
              <div className={`text-sm ${themeClasses.mutedText}`}>
                No saved snapshots yet. Click <span className="font-medium">Refresh Snapshot</span> to create your first one.
              </div>
            ) : (
              <div className="space-y-2">
                {snapshots.map((s) => {
                  const isActive = activeSnapshot?.id === s.id;
                  const rowStatus: RdSnapshotStatus = isActive && isDirtySinceCompute ? "partial" : "live";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSnapshot(s.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isDark
                          ? isActive
                            ? "bg-slate-800 border-slate-600"
                            : "bg-slate-900/40 border-slate-700 hover:bg-slate-800/60"
                          : isActive
                          ? "bg-slate-50 border-slate-300"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-sm font-medium ${themeClasses.headingText}`}>
                            {s.response.snapshotId} • {s.request.businessName}
                          </div>
                          <div className={`text-xs mt-0.5 ${themeClasses.mutedText}`}>
                            {formatTimestamp(s.response.computedAt)} • Window: {s.dateWindow.resolvedStart} → {s.dateWindow.resolvedEnd} • {s.response.kpis.reviewCount} reviews
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <SnapshotStatusChip status={rowStatus} isDark={isDark} />
                          {isActive ? (
                            <span className={`text-[11px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                              Active
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      </div>

      <OBDStickyActionBar
        isDark={isDark}
        className="no-print"
        left={
          <div className="flex items-center gap-2 min-w-0">
            <SnapshotStatusChip status={snapshotStatus} isDark={isDark} />
            <div className={`text-xs ${themeClasses.mutedText} truncate`}>
              {activeSnapshot ? `Snapshot ${activeSnapshot.response.snapshotId} • ${formatTimestamp(activeSnapshot.response.computedAt)}` : "No snapshot yet"}
              {isDirtySinceCompute && activeSnapshot ? " • Unsaved changes" : ""}
            </div>
          </div>
        }
      >
        <TooltipButton
          isDark={isDark}
          variant="primary"
          disabled={!canCreateSnapshot || loading}
          tooltip={refreshTooltip}
          onClick={handleRefreshSnapshot}
        >
          Refresh Snapshot
        </TooltipButton>
        <TooltipButton
          isDark={isDark}
          disabled={!activeSnapshot}
          tooltip="Create a snapshot to export."
          onClick={() => setShowExportCenter(true)}
        >
          Export
        </TooltipButton>
        <TooltipButton
          isDark={isDark}
          disabled={!activeResult}
          tooltip="Generate the dashboard to view insights."
          onClick={handleViewInsights}
        >
          View Insights
        </TooltipButton>
      </OBDStickyActionBar>
    </OBDPageContainer>
  );
}


