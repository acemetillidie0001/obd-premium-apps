"use client";

import { useState, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import SocialAutoPosterNav from "@/components/obd/SocialAutoPosterNav";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { isMetaPublishingEnabled } from "@/lib/apps/social-auto-poster/metaConnectionStatus";
import { getConnectionUIModel } from "@/lib/apps/social-auto-poster/connection/connectionState";
import { mapActivityToUI } from "@/lib/apps/social-auto-poster/activity/activityMessageMapper";
import ConnectionStatusBadge from "@/components/obd/ConnectionStatusBadge";
import type { ActivityLogItem } from "@/lib/apps/social-auto-poster/types";

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  google_business: "Google Business Profile",
  googleBusiness: "Google Business Profile", // Legacy support
};

export default function SocialAutoPosterActivityPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<{
    ok?: boolean;
    configured?: boolean;
    errorCode?: string;
    errorMessage?: string;
    facebook?: {
      connected?: boolean;
      pagesAccessGranted?: boolean;
    };
    publishing?: {
      enabled?: boolean;
      reasonIfDisabled?: string;
    };
  } | null>(null);

  useEffect(() => {
    loadActivity();
  }, []);

  // Load connection status on mount
  useEffect(() => {
    const loadConnectionStatus = async () => {
      try {
        const res = await fetch("/api/social-connections/meta/status");
        if (res.ok) {
          const data = await res.json();
          setConnectionStatus(data);
        }
      } catch (err) {
        console.error("Failed to load connection status:", err);
      }
    };
    loadConnectionStatus();
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

      {/* Connection Status Badge */}
      {(() => {
        try {
          const publishingEnabled = isMetaPublishingEnabled();
          const uiModel = getConnectionUIModel(connectionStatus, undefined, publishingEnabled);
          return (
            <div className="mt-2 mb-4">
              <ConnectionStatusBadge
                state={uiModel.state}
                label={uiModel.badgeLabel}
                isDark={isDark}
              />
              {uiModel.message && (
                <p className={`text-sm mt-2 ${themeClasses.mutedText}`}>
                  {uiModel.message}
                </p>
              )}
            </div>
          );
        } catch {
          return (
            <div className="mt-2 mb-4">
              <ConnectionStatusBadge
                state="error"
                label="Error"
                isDark={isDark}
              />
              <p className={`text-sm mt-2 ${themeClasses.mutedText}`}>
                We couldn&apos;t verify connection status right now. Try again.
              </p>
            </div>
          );
        }
      })()}

      {/* Retry Policy Info Box */}
      <OBDPanel isDark={isDark} className="mt-4 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-lg">ℹ️</span>
          <div className="flex-1">
            <h3 className={`text-sm font-medium mb-1 ${themeClasses.headingText}`}>
              Retry Policy
            </h3>
            <p className={`text-sm ${themeClasses.mutedText}`}>
              If automatic retries are enabled, we&apos;ll retry failed posts. Otherwise you can retry manually from the queue.
            </p>
          </div>
        </div>
      </OBDPanel>

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
              
              // Get connection UI model for mapper
              const publishingEnabled = isMetaPublishingEnabled();
              const connectionUI = getConnectionUIModel(connectionStatus, undefined, publishingEnabled);
              
              // Map activity to UI message
              const uiMessage = mapActivityToUI(item, connectionUI);
              
              // Determine chip styling based on tone
              const chipClasses = 
                uiMessage.tone === "success"
                  ? "bg-green-500/20 text-green-400 border border-green-500"
                  : uiMessage.tone === "warning"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500"
                  : "bg-slate-500/20 text-slate-400 border border-slate-500";
              
              // Next action labels
              const nextActionLabels: Record<string, string> = {
                will_retry: "Will retry",
                paused: "Paused",
                needs_attention: "Needs attention",
                none: "",
              };
              
              return (
                <OBDPanel key={item.id} isDark={isDark}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${chipClasses}`}>
                          {uiMessage.title}
                        </span>
                        <span className={themeClasses.mutedText}>
                          {PLATFORM_LABELS[item.platform] || item.platform}
                        </span>
                        <span className={`text-xs ${themeClasses.mutedText}`}>
                          {formatDate(item.createdAt)}
                        </span>
                        {uiMessage.nextAction && uiMessage.nextAction !== "none" && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            isDark 
                              ? "bg-slate-700 text-slate-300" 
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            Next: {nextActionLabels[uiMessage.nextAction]}
                          </span>
                        )}
                      </div>
                      <p className={`${themeClasses.inputText} mb-2 whitespace-pre-wrap`}>{item.content}</p>
                      {uiMessage.description && (
                        <p className={`text-sm ${themeClasses.mutedText} mt-2 mb-2`}>
                          {uiMessage.description}
                        </p>
                      )}
                      {item.postedAt && (
                        <p className={`text-xs ${themeClasses.mutedText}`}>
                          Posted: {formatDate(item.postedAt)}
                        </p>
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
                                // Safely extract permalink and post ID
                                const responseData = attempt.responseData;
                                const permalink: string | null = 
                                  responseData && 
                                  typeof responseData === "object" && 
                                  "providerPermalink" in responseData &&
                                  typeof responseData.providerPermalink === "string"
                                    ? responseData.providerPermalink
                                    : null;
                                
                                const postId: string | null =
                                  responseData &&
                                  typeof responseData === "object" &&
                                  "providerPostId" in responseData &&
                                  typeof responseData.providerPostId === "string"
                                    ? responseData.providerPostId
                                    : null;
                                
                                if (permalink) {
                                  return (
                                    <div className="mt-2 space-y-1">
                                      <a
                                        href={permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`text-xs text-blue-600 hover:underline inline-flex items-center gap-1 ${isDark ? "text-blue-400" : ""}`}
                                      >
                                        View Post →
                                      </a>
                                      {postId && (
                                        <p className={`text-xs font-mono ${themeClasses.mutedText}`}>
                                          Post ID: {postId}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
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

