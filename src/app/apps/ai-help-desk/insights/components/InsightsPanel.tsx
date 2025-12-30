"use client";

import { useState, useEffect } from "react";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";

interface InsightsSummary {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  stats: {
    totalQuestions: number;
    questionsWithSources: number;
    questionsWithoutSources: number;
    knowledgeGapCount: number;
  };
  topQuestions: Array<{
    question: string;
    count: number;
    hasSources: boolean;
    sourcesCount: number;
    responseQuality: "GOOD" | "WEAK" | "NONE" | null;
    lastAsked: string;
  }>;
  knowledgeGaps: Array<{
    id: string;
    question: string;
    createdAt: string;
    sourcesCount: number;
    responseQuality: "GOOD" | "WEAK" | "NONE" | null;
  }>;
}

interface InsightsPanelProps {
  isDark: boolean;
  businessId: string;
  onTurnIntoFAQ: (question: string) => void;
}

export default function InsightsPanel({
  isDark,
  businessId,
  onTurnIntoFAQ,
}: InsightsPanelProps) {
  const themeClasses = getThemeClasses(isDark);

  const [insights, setInsights] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  // Load insights
  const loadInsights = async () => {
    if (!businessId.trim()) {
      setInsights(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        businessId: businessId.trim(),
        days: days.toString(),
        limit: "20",
      });

      const res = await fetch(`/api/ai-help-desk/insights/summary?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load insights");
      }

      setInsights(json.data);
    } catch (err) {
      console.error("Load insights error:", err);
      setError(err instanceof Error ? err.message : "Failed to load insights");
      setInsights(null);
    } finally {
      setLoading(false);
    }
  };

  // Load insights when filters change
  useEffect(() => {
    if (businessId.trim()) {
      loadInsights();
    }
  }, [businessId, days]);

  const getQualityLabel = (quality: "GOOD" | "WEAK" | "NONE" | null) => {
    switch (quality) {
      case "GOOD":
        return "Good";
      case "WEAK":
        return "Weak";
      case "NONE":
        return "No Sources";
      default:
        return "Unknown";
    }
  };

  const getQualityColor = (quality: "GOOD" | "WEAK" | "NONE" | null) => {
    switch (quality) {
      case "GOOD":
        return isDark ? "text-green-400" : "text-green-700";
      case "WEAK":
        return isDark ? "text-yellow-400" : "text-yellow-700";
      case "NONE":
        return isDark ? "text-red-400" : "text-red-700";
      default:
        return themeClasses.mutedText;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <OBDPanel isDark={isDark}>
        <div className="flex items-center justify-between mb-4">
          <OBDHeading level={2} isDark={isDark}>
            Help Desk Insights
          </OBDHeading>
          <div className="flex items-center gap-3">
            <label className={`text-sm ${themeClasses.labelText}`}>
              Last
            </label>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className={getInputClasses(isDark, "w-24")}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        {insights && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
            }`}>
              <div className={`text-2xl font-bold ${themeClasses.headingText}`}>
                {insights.stats.totalQuestions}
              </div>
              <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                Total Questions
              </div>
            </div>
            <div className={`p-4 rounded-lg border ${
              isDark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"
            }`}>
              <div className={`text-2xl font-bold ${isDark ? "text-green-400" : "text-green-700"}`}>
                {insights.stats.questionsWithSources}
              </div>
              <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                With Sources
              </div>
            </div>
            <div className={`p-4 rounded-lg border ${
              isDark ? "bg-red-900/20 border-red-700" : "bg-red-50 border-red-200"
            }`}>
              <div className={`text-2xl font-bold ${isDark ? "text-red-400" : "text-red-700"}`}>
                {insights.stats.questionsWithoutSources}
              </div>
              <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                Knowledge Gaps
              </div>
            </div>
            <div className={`p-4 rounded-lg border ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
            }`}>
              <div className={`text-2xl font-bold ${themeClasses.headingText}`}>
                {insights.stats.questionsWithSources > 0
                  ? Math.round((insights.stats.questionsWithSources / insights.stats.totalQuestions) * 100)
                  : 0}%
              </div>
              <div className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                Coverage Rate
              </div>
            </div>
          </div>
        )}
      </OBDPanel>

      {/* Error Display */}
      {error && (
        <div className={getErrorPanelClasses(isDark)}>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <OBDPanel isDark={isDark}>
          <div className={`text-center py-8 ${themeClasses.mutedText}`}>
            <p>Loading insights...</p>
          </div>
        </OBDPanel>
      )}

      {/* Empty State */}
      {!loading && !insights && businessId.trim() && (
        <OBDPanel isDark={isDark}>
          <div className={`text-center py-12 ${themeClasses.mutedText}`}>
            <p className="text-base mb-2">No insights available</p>
            <p className="text-sm">Start asking questions in the Help Desk tab to see insights.</p>
          </div>
        </OBDPanel>
      )}

      {/* Knowledge Gaps */}
      {!loading && insights && insights.knowledgeGaps.length > 0 && (
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark} className="mb-4">
            Knowledge Gaps ({insights.knowledgeGaps.length})
          </OBDHeading>
          <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
            Questions that couldn't be answered from your knowledge base
          </p>
          <div className="space-y-3">
            {insights.knowledgeGaps.map((gap) => (
              <div
                key={gap.id}
                className={`p-4 rounded-lg border ${
                  isDark ? "bg-red-900/20 border-red-700" : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className={`font-medium ${themeClasses.headingText}`}>
                      {gap.question}
                    </p>
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      Asked {new Date(gap.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTurnIntoFAQ(gap.question)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      isDark
                        ? "border-[#29c4a9] bg-[#29c4a9]/20 text-[#29c4a9] hover:bg-[#29c4a9]/30"
                        : "border-[#29c4a9] bg-[#29c4a9]/10 text-[#29c4a9] hover:bg-[#29c4a9]/20"
                    }`}
                  >
                    Turn into FAQ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </OBDPanel>
      )}

      {/* Top Questions */}
      {!loading && insights && insights.topQuestions.length > 0 && (
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark} className="mb-4">
            Top Questions ({insights.topQuestions.length})
          </OBDHeading>
          <p className={`text-sm mb-4 ${themeClasses.mutedText}`}>
            Most frequently asked questions
          </p>
          <div className="space-y-3">
            {insights.topQuestions.map((q, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"
                      }`}>
                        Asked {q.count} {q.count === 1 ? "time" : "times"}
                      </span>
                      <span className={`text-xs font-medium ${getQualityColor(q.responseQuality)}`}>
                        {getQualityLabel(q.responseQuality)}
                      </span>
                    </div>
                    <p className={`font-medium ${themeClasses.headingText}`}>
                      {q.question}
                    </p>
                    <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                      Last asked {new Date(q.lastAsked).toLocaleDateString()}
                      {q.sourcesCount > 0 && ` • ${q.sourcesCount} source${q.sourcesCount === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {!q.hasSources && (
                    <button
                      type="button"
                      onClick={() => onTurnIntoFAQ(q.question)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
                        isDark
                          ? "border-[#29c4a9] bg-[#29c4a9]/20 text-[#29c4a9] hover:bg-[#29c4a9]/30"
                          : "border-[#29c4a9] bg-[#29c4a9]/10 text-[#29c4a9] hover:bg-[#29c4a9]/20"
                      }`}
                    >
                      Turn into FAQ
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </OBDPanel>
      )}

      {/* No Data State */}
      {!loading && insights && insights.knowledgeGaps.length === 0 && insights.topQuestions.length === 0 && (
        <OBDPanel isDark={isDark}>
          <div className={`text-center py-12 ${themeClasses.mutedText}`}>
            <p className="text-base mb-2">No questions found</p>
            <p className="text-sm">Start asking questions in the Help Desk tab to see insights.</p>
          </div>
        </OBDPanel>
      )}
    </div>
  );
}

