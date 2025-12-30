"use client";

import { useState, useRef, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import ResultCard from "@/components/obd/ResultCard";
import { getThemeClasses, getInputClasses, getPanelClasses } from "@/lib/obd-framework/theme";
import {
  SUBMIT_BUTTON_CLASSES,
  getErrorPanelClasses,
  getDividerClass,
} from "@/lib/obd-framework/layout-helpers";
import {
  ReputationDashboardRequest,
  ReputationDashboardResponse,
  ReviewInput,
  DateRangeMode,
} from "@/lib/apps/reputation-dashboard/types";
import { parseCSV, generateCSVTemplate, exportReviewsToCSV, CSVParseResult } from "@/lib/apps/reputation-dashboard/csv-utils";
import { generateInsights, type Insight } from "@/lib/reputation/insights";

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

export default function ReputationDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reviews, setReviews] = useState<ReviewInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReputationDashboardResponse | null>(null);
  const [lastComputed, setLastComputed] = useState<string | null>(null);
  
  // Review Request Automation integration state
  const [reviewRequestData, setReviewRequestData] = useState<{
    datasetId: string;
    campaignId: string;
    businessName: string;
    computedAt: string;
    isCurrent?: boolean;
    isCurrentForCampaign?: boolean;
    metrics: {
      sent: number;
      clicked: number;
      reviewed: number;
      clickedRate: number;
      reviewedRate: number;
    };
    totalsJson?: Record<string, unknown> | null;
    warningsJson?: Record<string, unknown> | null;
  } | null>(null);
  const [loadingReviewRequest, setLoadingReviewRequest] = useState(false);
  const [reviewRequestDbStatus, setReviewRequestDbStatus] = useState<"connected" | "fallback" | "empty" | "checking">("checking");

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
    } catch (err) {
      // Silently fail - localStorage may be unavailable or corrupted
    }
  }, []);

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
    } catch (err) {
      // Silently fail - localStorage may be unavailable or quota exceeded
    }
  }, [businessName, businessType, dateRangeMode, startDate, endDate, reviews, lastComputed]);

  // Fetch Review Request Automation data on mount and when businessName changes
  useEffect(() => {
    const fetchReviewRequestData = async () => {
      setLoadingReviewRequest(true);
      setReviewRequestDbStatus("checking");
      try {
        const res = await fetch("/api/review-request-automation/latest");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && !data.empty && data.dataset) {
            setReviewRequestData(data.dataset);
            setReviewRequestDbStatus("connected");
          } else {
            setReviewRequestData(null);
            setReviewRequestDbStatus("empty");
          }
        } else {
          // If 401, user not logged in - treat as empty
          if (res.status === 401) {
            setReviewRequestData(null);
            setReviewRequestDbStatus("empty");
          } else {
            // Other errors suggest DB/migration issues
            setReviewRequestData(null);
            setReviewRequestDbStatus("fallback");
          }
        }
      } catch (err) {
        console.error("Error fetching review request data:", err);
        setReviewRequestData(null);
        setReviewRequestDbStatus("fallback");
      } finally {
        setLoadingReviewRequest(false);
      }
    };

    fetchReviewRequestData();
  }, [businessName]); // Re-fetch when business name changes (optional matching)

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

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      setBusinessName("");
      setBusinessType("");
      setDateRangeMode("30d");
      setStartDate("");
      setEndDate("");
      setReviews([]);
      setResult(null);
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
    if (!result || reviews.length === 0) return;
    // Ensure computedAt and snapshotId are included
    const exportData = {
      ...result,
      computedAt: result.computedAt || new Date().toISOString(),
      snapshotId: result.snapshotId || "RD-00000000",
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reputation-dashboard-${businessName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (reviews.length === 0) return;
    const csv = exportReviewsToCSV(reviews);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reviews-${businessName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      setCsvPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

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
        reviews,
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
      setResult(data);
      setLastComputed(data.computedAt);
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

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      } catch (err) {
        // Silently fail - clipboard API may be unavailable
      }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return isDark ? "text-green-400" : "text-green-600";
    if (score >= 60) return isDark ? "text-yellow-400" : "text-yellow-600";
    return isDark ? "text-red-400" : "text-red-600";
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Reputation Dashboard"
      tagline="See all your reviews, trends, and sentiment in one place."
    >
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
                    onChange={(e) => setBusinessName(e.target.value)}
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
                    onChange={(e) => setBusinessType(e.target.value)}
                    className={getInputClasses(isDark)}
                    placeholder="e.g., Restaurant, Retail, Service"
                  />
                </div>
              </div>
            </div>

            <div className={getDividerClass(isDark)}></div>

            {/* Last Computed & Snapshot ID */}
            {(lastComputed || result) && (
              <div className={`flex items-center gap-3 flex-wrap text-xs ${themeClasses.mutedText}`}>
                {lastComputed && (
                  <span>
                    Last computed: {formatTimestamp(lastComputed)}
                  </span>
                )}
                {result?.snapshotId && (
                  <span className={`px-2 py-1 rounded ${
                    isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                  }`}>
                    Snapshot ID: {result.snapshotId}
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
                    onChange={(e) => setDateRangeMode(e.target.value as DateRangeMode)}
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
                        onChange={(e) => setStartDate(e.target.value)}
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
                        onChange={(e) => setEndDate(e.target.value)}
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
                          onClick={() => setReviews(reviews.filter((_, i) => i !== idx))}
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
      {showScoreBreakdown && result && (
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
                  <div className={`text-4xl font-bold ${getScoreColor(result.scoreBreakdown.totalScore)}`}>
                    {result.scoreBreakdown.totalScore}
                  </div>
                  <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Total Reputation Score</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-medium ${themeClasses.headingText}`}>Rating Component</span>
                    <span className={`text-lg font-bold ${themeClasses.headingText}`}>
                      {result.scoreBreakdown.ratingComponent.contribution.toFixed(1)} / {result.scoreBreakdown.ratingComponent.weight}
                    </span>
                  </div>
                  <div className={`text-sm ${themeClasses.mutedText} mb-2`}>
                    Average Rating: {result.scoreBreakdown.ratingComponent.avgRating.toFixed(1)} / 5.0
                  </div>
                  <div className={`text-xs ${themeClasses.mutedText}`}>
                    Formula: (Avg Rating / 5) × {result.scoreBreakdown.ratingComponent.weight} = 
                    ({result.scoreBreakdown.ratingComponent.avgRating.toFixed(1)} / 5) × {result.scoreBreakdown.ratingComponent.weight} = 
                    {result.scoreBreakdown.ratingComponent.contribution.toFixed(1)}
                  </div>
                </div>

                <div className={`p-3 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-medium ${themeClasses.headingText}`}>Response Component</span>
                    <span className={`text-lg font-bold ${themeClasses.headingText}`}>
                      {result.scoreBreakdown.responseComponent.contribution.toFixed(1)} / {result.scoreBreakdown.responseComponent.weight}
                    </span>
                  </div>
                  <div className={`text-sm ${themeClasses.mutedText} mb-2`}>
                    Response Rate: {result.scoreBreakdown.responseComponent.responseRate}%
                    {result.metadata.hasNoResponses && (
                      <span
                        className="ml-1 cursor-help"
                        title="No responses yet. Using neutral default (50% = 20 points) for score calculation."
                      >
                        ℹ️
                      </span>
                    )}
                  </div>
                  <div className={`text-xs ${themeClasses.mutedText}`}>
                    {result.metadata.hasNoResponses ? (
                      <>Formula: No responses yet, using neutral default (50% / 100) × {result.scoreBreakdown.responseComponent.weight} = 20.0</>
                    ) : (
                      <>Formula: (Response Rate / 100) × {result.scoreBreakdown.responseComponent.weight} = 
                      ({result.scoreBreakdown.responseComponent.responseRate} / 100) × {result.scoreBreakdown.responseComponent.weight} = 
                      {result.scoreBreakdown.responseComponent.contribution.toFixed(1)}</>
                    )}
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                <h3 className={`text-sm font-semibold mb-2 ${themeClasses.headingText}`}>Raw Inputs</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className={themeClasses.mutedText}>Total Reviews: </span>
                    <span className={themeClasses.headingText}>{result.scoreBreakdown.rawInputs.totalReviews}</span>
                  </div>
                  <div>
                    <span className={themeClasses.mutedText}>Total Ratings Sum: </span>
                    <span className={themeClasses.headingText}>{result.scoreBreakdown.rawInputs.totalRatings}</span>
                  </div>
                  <div>
                    <span className={themeClasses.mutedText}>Average Rating: </span>
                    <span className={themeClasses.headingText}>{result.scoreBreakdown.rawInputs.avgRating.toFixed(1)}</span>
                  </div>
                  <div>
                    <span className={themeClasses.mutedText}>Responded Count: </span>
                    <span className={themeClasses.headingText}>{result.scoreBreakdown.rawInputs.respondedCount}</span>
                  </div>
                  <div className="col-span-2">
                    <span className={themeClasses.mutedText}>Response Rate: </span>
                    <span className={themeClasses.headingText}>{result.scoreBreakdown.rawInputs.totalResponseRate}%</span>
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

      {/* Results */}
      {result && (
        <div className={`mt-7 space-y-7 ${showPrintView ? "print-content" : ""}`}>
          {/* Report Header (Print View) */}
          {showPrintView && result && (
            <div className="mb-4 pb-4 border-b border-slate-300">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-xl font-bold ${themeClasses.headingText}`}>
                    {businessName} - Reputation Dashboard
                  </h2>
                  {businessType && (
                    <p className={`text-sm ${themeClasses.mutedText}`}>{businessType}</p>
                  )}
                </div>
                <div className={`text-xs text-right ${themeClasses.mutedText}`}>
                  <div>Report generated: {result.computedAt ? formatTimestamp(result.computedAt) : "N/A"}</div>
                  {result.snapshotId && <div>Snapshot ID: {result.snapshotId}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Export Actions */}
          <div className={`flex gap-2 flex-wrap items-center ${showPrintView ? "no-print" : ""}`}>
            <div className="relative group">
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={!result || reviews.length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !result || reviews.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                aria-describedby="export-json-help"
              >
                Export JSON
              </button>
              {(!result || reviews.length === 0) && (
                <span
                  id="export-json-help"
                  role="tooltip"
                  className={`absolute left-0 top-full mt-2 px-2 py-1 rounded text-xs whitespace-nowrap z-50 ${
                    isDark
                      ? "bg-slate-800 text-slate-200 border border-slate-700"
                      : "bg-slate-900 text-slate-100 border border-slate-700"
                  } opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none`}
                >
                  Add reviews and generate the dashboard to export a report.
                </span>
              )}
            </div>
            <div className="relative group">
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={reviews.length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  reviews.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                aria-describedby="export-csv-help"
              >
                Export Reviews CSV
              </button>
              {reviews.length === 0 && (
                <span
                  id="export-csv-help"
                  role="tooltip"
                  className={`absolute left-0 top-full mt-2 px-2 py-1 rounded text-xs whitespace-nowrap z-50 ${
                    isDark
                      ? "bg-slate-800 text-slate-200 border border-slate-700"
                      : "bg-slate-900 text-slate-100 border border-slate-700"
                  } opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none`}
                >
                  Add reviews to export.
                </span>
              )}
            </div>
            <div className="relative group">
              <button
                type="button"
                onClick={() => {
                  setShowPrintView(true);
                  window.print();
                }}
                disabled={!result || reviews.length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !result || reviews.length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : isDark
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
                aria-describedby="print-help"
              >
                Print Report
              </button>
              {(!result || reviews.length === 0) && (
                <span
                  id="print-help"
                  role="tooltip"
                  className={`absolute left-0 top-full mt-2 px-2 py-1 rounded text-xs whitespace-nowrap z-50 ${
                    isDark
                      ? "bg-slate-800 text-slate-200 border border-slate-700"
                      : "bg-slate-900 text-slate-100 border border-slate-700"
                  } opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none`}
                >
                  Add reviews and generate the dashboard to export a report.
                </span>
              )}
            </div>
          </div>
          {/* Low Data Warning */}
          {result.metadata.hasLowData && (
            <div className={`p-4 rounded-lg border ${
              isDark 
                ? "bg-yellow-900/20 border-yellow-700" 
                : "bg-yellow-50 border-yellow-200"
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-yellow-500 text-lg">⚠️</span>
                <div>
                  <div className={`font-semibold mb-1 ${themeClasses.headingText}`}>
                    Low data: trends and themes may be unreliable.
                  </div>
                  <div className={`text-sm ${themeClasses.mutedText}`}>
                    You have {result.kpis.reviewCount} review{result.kpis.reviewCount !== 1 ? "s" : ""}. 
                    Add more reviews (at least 5 recommended) for more reliable insights.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dataset Info */}
          {result.datasetInfo && (
            <div className={`flex items-center gap-2 ${showPrintView ? "no-print" : ""}`}>
              <span className={`text-xs px-2 py-1 rounded ${
                isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
              }`}>
                Dataset: {result.datasetInfo.datasetId.substring(0, 8)}...
              </span>
              <button
                type="button"
                disabled
                className={`text-xs px-2 py-1 rounded opacity-50 cursor-not-allowed ${
                  isDark ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"
                }`}
                title="Coming in V4"
              >
                Save dataset
              </button>
            </div>
          )}

          {/* KPI Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {result.kpis.reviewCount === 0 ? (
              <OBDPanel isDark={isDark} className="col-span-5">
                <div className="text-center py-8">
                  <div className={`text-2xl font-bold ${themeClasses.headingText} mb-2`}>
                    No reviews yet
                  </div>
                  <div className={`text-sm ${themeClasses.mutedText}`}>
                    Add reviews to begin analyzing your reputation.
                  </div>
                </div>
              </OBDPanel>
            ) : (
              <>
                <OBDPanel isDark={isDark}>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getScoreColor(result.kpis.reputationScore)}`}>
                      {result.kpis.reputationScore}
                    </div>
                    <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                      Reputation Score
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowScoreBreakdown(true)}
                      className={`text-xs mt-1 ${themeClasses.mutedText} cursor-pointer hover:underline`}
                    >
                      ℹ️ How it's calculated
                    </button>
                  </div>
                </OBDPanel>

                <OBDPanel isDark={isDark}>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                      {result.kpis.avgRating.toFixed(1)}
                    </div>
                    <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Avg Rating</div>
                  </div>
                </OBDPanel>

                <OBDPanel isDark={isDark}>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                      {result.kpis.reviewCount}
                    </div>
                    <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Review Count</div>
                  </div>
                </OBDPanel>

                <OBDPanel isDark={isDark}>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                      {result.kpis.responseRate}%
                    </div>
                    <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>Response Rate</div>
                  </div>
                </OBDPanel>

                <OBDPanel isDark={isDark}>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${themeClasses.headingText}`}>
                      {result.metadata.hasNoResponses ? (
                        "N/A"
                      ) : result.kpis.medianResponseTime < 24 ? (
                        `${Math.round(result.kpis.medianResponseTime)}h`
                      ) : (
                        `${Math.round(result.kpis.medianResponseTime / 24)}d`
                      )}
                    </div>
                    <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                      Median Response Time
                      {result.metadata.hasNoResponses && (
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
              </>
            )}
          </div>

          {/* Review Requests Performance Panel */}
          <OBDPanel isDark={isDark}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className={`text-sm font-semibold ${themeClasses.headingText}`}>
                  Review Requests Performance
                </h3>
                {/* DB Status Pill */}
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    reviewRequestDbStatus === "connected"
                      ? isDark
                        ? "bg-green-900/50 text-green-300 border border-green-700"
                        : "bg-green-50 text-green-700 border border-green-200"
                      : reviewRequestDbStatus === "fallback"
                      ? isDark
                        ? "bg-yellow-900/50 text-yellow-300 border border-yellow-700"
                        : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                      : reviewRequestDbStatus === "empty"
                      ? isDark
                        ? "bg-slate-800 text-slate-400 border border-slate-700"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                      : isDark
                      ? "bg-slate-800 text-slate-400 border border-slate-700"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                  title={
                    reviewRequestDbStatus === "connected"
                      ? "Connected to database"
                      : reviewRequestDbStatus === "fallback"
                      ? "Database unavailable. Run prisma migrate deploy and confirm DATABASE_URL is set."
                      : reviewRequestDbStatus === "empty"
                      ? "No review request campaigns saved yet"
                      : "Checking connection..."
                  }
                >
                  {reviewRequestDbStatus === "connected"
                    ? "✓ Connected"
                    : reviewRequestDbStatus === "fallback"
                    ? "⚠ Fallback / Not Connected"
                    : reviewRequestDbStatus === "empty"
                    ? "○ No campaigns"
                    : "○ Checking..."}
                </span>
              </div>
              {reviewRequestData && (
                <div className="flex items-center gap-2">
                  {/* Current badge */}
                  {reviewRequestData.isCurrent !== false && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        isDark
                          ? "bg-blue-900/50 text-blue-300 border border-blue-700"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                      title="This is your latest campaign run"
                    >
                      Current
                    </span>
                  )}
                  <a
                    href="/apps/review-request-automation"
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      isDark
                        ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                        : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                    }`}
                    title="Open Review Request Automation"
                  >
                    Open Review Request Automation
                  </a>
                </div>
              )}
            </div>
            {/* Newer campaign exists notice (for future dataset browsing) */}
            {reviewRequestData && reviewRequestData.isCurrent === false && (
              <div className={`mb-4 p-3 rounded-lg border ${
                isDark
                  ? "bg-blue-900/20 border-blue-700"
                  : "bg-blue-50 border-blue-200"
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`text-sm ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                    A newer campaign run exists — view latest
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Reload latest dataset
                      window.location.reload();
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      isDark
                        ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                        : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                    }`}
                  >
                    View latest
                  </button>
                </div>
              </div>
            )}
            {loadingReviewRequest ? (
              <div className={`text-sm ${themeClasses.mutedText} py-4 text-center`}>
                Loading...
              </div>
            ) : reviewRequestData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className={`text-2xl font-bold ${themeClasses.headingText}`}>
                      {reviewRequestData.metrics.sent}
                    </div>
                    <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>Sent</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${themeClasses.headingText}`}>
                      {reviewRequestData.metrics.clicked}
                    </div>
                    <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>Clicked</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${themeClasses.headingText}`}>
                      {reviewRequestData.metrics.reviewed}
                    </div>
                    <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>Reviewed</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${themeClasses.headingText}`}>
                      {reviewRequestData.metrics.clickedRate.toFixed(1)}%
                    </div>
                    <div className={`text-xs mt-1 ${themeClasses.mutedText}`}>Click Rate</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-300 dark:border-slate-700">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className={`text-xs ${themeClasses.mutedText}`}>
                      Conversion: {reviewRequestData.metrics.reviewedRate.toFixed(1)}% ({reviewRequestData.metrics.reviewed} reviewed / {reviewRequestData.metrics.sent} sent)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${themeClasses.mutedText}`}>
                        Last computed: {formatTimestamp(reviewRequestData.computedAt)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                      }`}>
                        {reviewRequestData.datasetId.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`text-sm ${themeClasses.mutedText} py-4 text-center`}>
                No review request campaigns saved yet.{" "}
                <a
                  href="/apps/review-request-automation"
                  className="text-[#29c4a9] hover:underline font-medium"
                >
                  Create your first campaign
                </a>
                {" "}to see performance metrics here.
              </div>
            )}
          </OBDPanel>

          {/* Insights & Recommendations Panel */}
          {reviewRequestData && reviewRequestData.totalsJson && (
            <OBDPanel isDark={isDark}>
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Insights & Recommendations
              </h3>
              {(() => {
                const insights = generateInsights({
                  totalsJson: reviewRequestData.totalsJson || null,
                  warningsJson: reviewRequestData.warningsJson || null,
                });

                if (insights.length === 0) {
                  return (
                    <div className={`text-sm ${themeClasses.mutedText} py-4 text-center`}>
                      No issues detected. Your review request strategy looks healthy.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {insights.map((insight) => {
                      const severityConfig = {
                        critical: {
                          icon: "🔴",
                          bg: isDark
                            ? "bg-red-900/20 border-red-700"
                            : "bg-red-50 border-red-200",
                          text: isDark ? "text-red-300" : "text-red-700",
                          title: isDark ? "text-red-200" : "text-red-800",
                        },
                        warning: {
                          icon: "⚠️",
                          bg: isDark
                            ? "bg-yellow-900/20 border-yellow-700"
                            : "bg-yellow-50 border-yellow-200",
                          text: isDark ? "text-yellow-300" : "text-yellow-700",
                          title: isDark ? "text-yellow-200" : "text-yellow-800",
                        },
                        info: {
                          icon: "ℹ️",
                          bg: isDark
                            ? "bg-blue-900/20 border-blue-700"
                            : "bg-blue-50 border-blue-200",
                          text: isDark ? "text-blue-300" : "text-blue-700",
                          title: isDark ? "text-blue-200" : "text-blue-800",
                        },
                      };

                      const config = severityConfig[insight.severity];

                      return (
                        <div
                          key={insight.id}
                          className={`p-4 rounded-lg border ${config.bg}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-lg flex-shrink-0">{config.icon}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-semibold mb-1 ${config.title}`}>
                                {insight.title}
                              </h4>
                              <p className={`text-sm ${config.text} mb-2`}>
                                {insight.message}
                              </p>
                              {insight.recommendedAction && (
                                <a
                                  href={insight.recommendedAction.deepLink}
                                  className={`inline-block text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                                    isDark
                                      ? "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                                      : "bg-[#29c4a9] text-white hover:bg-[#25b09a]"
                                  }`}
                                >
                                  {insight.recommendedAction.label}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </OBDPanel>
          )}

          {/* Quality Signals Panel */}
          {result.qualitySignals.length > 0 && (
            <OBDPanel isDark={isDark}>
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Quality Signals
              </h3>
              <div className="space-y-3">
                {result.qualitySignals.map((signal) => {
                  const severityColors = {
                    info: isDark ? "bg-blue-900/20 border-blue-700 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-700",
                    warning: isDark ? "bg-yellow-900/20 border-yellow-700 text-yellow-300" : "bg-yellow-50 border-yellow-200 text-yellow-700",
                    critical: isDark ? "bg-red-900/20 border-red-700 text-red-300" : "bg-red-50 border-red-200 text-red-700",
                  };
                  
                  return (
                    <div
                      key={signal.id}
                      className={`p-3 rounded-lg border ${severityColors[signal.severity]}`}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className="font-semibold">{signal.shortTitle}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          signal.severity === "critical" 
                            ? isDark ? "bg-red-900/50" : "bg-red-100"
                            : signal.severity === "warning"
                            ? isDark ? "bg-yellow-900/50" : "bg-yellow-100"
                            : isDark ? "bg-blue-900/50" : "bg-blue-100"
                        }`}>
                          {signal.severity}
                        </span>
                      </div>
                      <p className={`text-sm mb-2 ${themeClasses.mutedText}`}>
                        {signal.detail}
                      </p>
                      <p className={`text-xs ${themeClasses.mutedText}`}>
                        <strong>Next step:</strong> {signal.suggestedNextStep}
                      </p>
                    </div>
                  );
                })}
              </div>
            </OBDPanel>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
            <OBDPanel isDark={isDark}>
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Rating Over Time
              </h3>
              <SimpleLineChart
                data={result.ratingOverTime}
                label="Rating"
                isDark={isDark}
                maxValue={5}
              />
            </OBDPanel>

            <OBDPanel isDark={isDark}>
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Reviews Per Week
              </h3>
              <SimpleBarChart
                data={result.reviewsPerWeek}
                label="Reviews"
                isDark={isDark}
              />
            </OBDPanel>

            <OBDPanel isDark={isDark} className="lg:col-span-2">
              <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
                Responses Per Week
              </h3>
              <SimpleBarChart
                data={result.responsesPerWeek}
                label="Responses"
                isDark={isDark}
              />
            </OBDPanel>
          </div>

          {/* Top Themes */}
          <OBDPanel isDark={isDark}>
            <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
              Top Themes
            </h3>
            <div className="space-y-3">
              {result.metadata.hasLowData ? (
                <div className={`p-4 rounded-lg border ${
                  isDark 
                    ? "bg-slate-800 border-slate-700" 
                    : "bg-slate-50 border-slate-200"
                }`}>
                  <p className={`text-sm ${themeClasses.mutedText}`}>
                    Needs at least 5 reviews to detect themes.
                  </p>
                </div>
              ) : result.topThemes.length === 0 ? (
                <p className={themeClasses.mutedText}>No themes identified</p>
              ) : (
                result.topThemes.map((theme, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg ${
                      isDark ? "bg-slate-800" : "bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${themeClasses.headingText}`}>
                        {theme.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${themeClasses.mutedText}`}>
                          {theme.count} mentions
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded cursor-help ${
                            theme.themeConfidence === "high"
                              ? isDark ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-700"
                              : theme.themeConfidence === "medium"
                              ? isDark ? "bg-yellow-900/50 text-yellow-300" : "bg-yellow-100 text-yellow-700"
                              : isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
                          }`}
                          title={`Confidence: ${theme.themeConfidence}. Matched keywords: ${theme.matchedKeywords.join(", ")}`}
                        >
                          {theme.themeConfidence}
                        </span>
                      </div>
                    </div>
                    {theme.exampleSnippet && (
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                        "{theme.exampleSnippet}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </OBDPanel>

          {/* Sentiment Mix */}
          <OBDPanel isDark={isDark}>
            <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
              Sentiment Mix
              {result.metadata.hasLowData && (
                <span
                  className="ml-2 text-xs cursor-help"
                  title="Derived primarily from ratings (limited sample). More reviews improve sentiment accuracy."
                >
                  ℹ️
                </span>
              )}
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={themeClasses.labelText}>Positive</span>
                  <span className={themeClasses.headingText}>{result.sentimentMix.positive}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${result.sentimentMix.positive}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={themeClasses.labelText}>Neutral</span>
                  <span className={themeClasses.headingText}>{result.sentimentMix.neutral}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{ width: `${result.sentimentMix.neutral}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={themeClasses.labelText}>Negative</span>
                  <span className={themeClasses.headingText}>{result.sentimentMix.negative}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${result.sentimentMix.negative}%` }}
                  />
                </div>
              </div>
              {result.sentimentMix.reviewSentiments && result.sentimentMix.reviewSentiments.length > 0 && (
                <div className={`mt-2 text-xs ${themeClasses.mutedText} pt-2 border-t ${
                  isDark ? "border-slate-700" : "border-slate-200"
                }`}>
                  <span
                    className="cursor-help"
                    title={`Sentiment derived from: ${result.sentimentMix.reviewSentiments
                      .map((s) => `${s.derivedFrom} (${s.confidence} confidence)`)
                      .join(", ")}`}
                  >
                    ℹ️ Sentiment analysis uses rating baseline with text keyword overrides where applicable.
                  </span>
                </div>
              )}
            </div>
          </OBDPanel>

          {/* Priority Actions */}
          <OBDPanel isDark={isDark}>
            <h3 className={`text-sm font-semibold mb-4 ${themeClasses.headingText}`}>
              Priority Actions
            </h3>
            <div className="space-y-3">
              {result.priorityActions.map((action) => (
                <ResultCard
                  key={action.id}
                  title={action.title}
                  isDark={isDark}
                  copyText={action.actionableText}
                >
                  <p className={`text-sm ${themeClasses.mutedText} mb-2`}>
                    {action.description}
                  </p>
                </ResultCard>
              ))}
            </div>
          </OBDPanel>
        </div>
      )}
    </OBDPageContainer>
  );
}


