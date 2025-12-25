"use client";

import { useState, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import SocialAutoPosterNav from "@/components/obd/SocialAutoPosterNav";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import type { ActivityLogItem } from "@/lib/apps/social-auto-poster/types";

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  googleBusiness: "Google Business",
};

export default function SocialAutoPosterActivityPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social-auto-poster/activity");
      if (!res.ok) {
        throw new Error("Failed to load activity");
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString();
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="OBD Social Auto-Poster"
      tagline="View posting history and delivery attempts"
    >
      <SocialAutoPosterNav isDark={isDark} />

      <div className="mt-7">
        {loading ? (
          <OBDPanel isDark={isDark}>
            <p className={themeClasses.mutedText}>Loading activity...</p>
          </OBDPanel>
        ) : error ? (
          <OBDPanel isDark={isDark}>
            <p className="text-red-500">{error}</p>
          </OBDPanel>
        ) : items.length === 0 ? (
          <OBDPanel isDark={isDark}>
            <div className="text-center py-8">
              <p className={`text-lg mb-2 ${themeClasses.headingText}`}>No activity yet</p>
              <p className={themeClasses.mutedText}>
                Posts that have been published or failed will appear here.
              </p>
            </div>
          </OBDPanel>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const isSuccess = item.status === "posted";
              const isFailed = item.status === "failed";
              return (
                <OBDPanel key={item.id} isDark={isDark}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            isSuccess
                              ? "bg-green-500/20 text-green-400 border border-green-500"
                              : isFailed
                              ? "bg-red-500/20 text-red-400 border border-red-500"
                              : "bg-slate-500/20 text-slate-400 border border-slate-500"
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className={themeClasses.mutedText}>
                          {PLATFORM_LABELS[item.platform] || item.platform}
                        </span>
                        <span className={`text-xs ${themeClasses.mutedText}`}>
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      <p className={`${themeClasses.inputText} mb-2 whitespace-pre-wrap`}>{item.content}</p>
                      {item.postedAt && (
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          Posted: {formatDate(item.postedAt)}
                        </p>
                      )}
                      {item.errorMessage && (
                        <p className={`text-xs text-red-400 mt-1`}>Error: {item.errorMessage}</p>
                      )}
                      <p className={`text-xs ${themeClasses.mutedText} mt-1`}>
                        Attempts: {item.attemptCount}
                      </p>
                    </div>
                  </div>
                  {item.attempts.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className={`text-sm ${themeClasses.mutedText} hover:${themeClasses.headingText} transition-colors`}
                      >
                        {isExpanded ? "Hide" : "Show"} Delivery Attempts ({item.attempts.length})
                      </button>
                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          {item.attempts.map((attempt) => (
                            <div
                              key={attempt.id}
                              className={`p-3 rounded-xl ${
                                isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-50 border border-slate-200"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs ${attempt.success ? "text-green-400" : "text-red-400"}`}>
                                  {attempt.success ? "✓ Success" : "✗ Failed"}
                                </span>
                                <span className={`text-xs ${themeClasses.mutedText}`}>
                                  {formatDate(attempt.attemptedAt)}
                                </span>
                              </div>
                              {attempt.responseData && typeof attempt.responseData === "object" && "imageSource" in attempt.responseData && (
                                <p className={`text-xs ${themeClasses.mutedText} mt-1`}>
                                  Image: {attempt.responseData.imageSource as string}
                                </p>
                              )}
                              {(() => {
                                const permalink = attempt.responseData && typeof attempt.responseData === "object" && "providerPermalink" in attempt.responseData
                                  ? (attempt.responseData.providerPermalink as string)
                                  : null;
                                return permalink ? (
                                  <div className="mt-2">
                                    <a
                                      href={permalink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`text-xs text-blue-600 hover:underline ${isDark ? "text-blue-400" : ""}`}
                                    >
                                      View Post →
                                    </a>
                                  </div>
                                ) : null;
                              })()}
                              {attempt.errorMessage && (
                                <p className={`text-xs text-red-400 mt-1`}>{attempt.errorMessage}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </OBDPanel>
              );
            })}
          </div>
        )}
      </div>
    </OBDPageContainer>
  );
}

