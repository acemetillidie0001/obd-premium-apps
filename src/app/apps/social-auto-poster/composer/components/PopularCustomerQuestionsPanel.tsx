"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { getSubtleButtonSmallClasses } from "@/lib/obd-framework/layout-helpers";
import { resolveBusinessId } from "@/lib/utils/resolve-business-id";

interface TopQuestion {
  question: string;
  count: number;
  hasSources: boolean;
  sourcesCount: number;
  responseQuality: "GOOD" | "WEAK" | "NONE" | null;
  lastAsked: string;
}

interface PopularCustomerQuestionsPanelProps {
  isDark: boolean;
  onUseAsPostIdea: (question: string) => void;
}

export default function PopularCustomerQuestionsPanel({
  isDark,
  onUseAsPostIdea,
}: PopularCustomerQuestionsPanelProps) {
  const themeClasses = getThemeClasses(isDark);
  const searchParams = useSearchParams();
  const [questions, setQuestions] = useState<TopQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      setError(null);

      try {
        // Resolve business ID
        const businessId = resolveBusinessId(searchParams);
        if (!businessId) {
          setError("Business ID not found");
          setLoading(false);
          return;
        }

        // Fetch top questions from AI Help Desk Insights
        const params = new URLSearchParams({
          businessId: businessId,
          days: "30", // Last 30 days
          limit: "5", // Top 5 questions
        });

        const res = await fetch(`/api/ai-help-desk/insights/summary?${params.toString()}`);
        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load questions");
        }

        // Extract top questions (limit to 3-5)
        const topQuestions = json.data?.topQuestions || [];
        setQuestions(topQuestions.slice(0, 5)); // Top 5 max
      } catch (err) {
        console.error("Failed to load customer questions:", err);
        setError(err instanceof Error ? err.message : "Failed to load questions");
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [searchParams]);

  if (loading) {
    return (
      <OBDPanel isDark={isDark}>
        <OBDHeading level={2} isDark={isDark} className="mb-3">
          Popular Customer Questions
        </OBDHeading>
        <p className={`text-sm ${themeClasses.mutedText}`}>Loading questions...</p>
      </OBDPanel>
    );
  }

  if (error || questions.length === 0) {
    // Don't show panel if there are no questions or error
    return null;
  }

  return (
    <OBDPanel isDark={isDark}>
      <OBDHeading level={2} isDark={isDark} className="mb-3">
        Popular Customer Questions
      </OBDHeading>
      <p className={`text-xs mb-4 ${themeClasses.mutedText}`}>
        Top questions from your AI Help Desk (last 30 days)
      </p>
      <div className="space-y-3">
        {questions.map((q, idx) => (
          <div
            key={idx}
            className={`p-3 rounded border ${
              isDark
                ? "bg-slate-800/50 border-slate-700"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <p className={`text-sm mb-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>{q.question}</p>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs ${themeClasses.mutedText}`}>
                Asked {q.count} time{q.count !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => onUseAsPostIdea(q.question)}
                className={getSubtleButtonSmallClasses(isDark)}
              >
                Use as post idea
              </button>
            </div>
          </div>
        ))}
      </div>
    </OBDPanel>
  );
}

