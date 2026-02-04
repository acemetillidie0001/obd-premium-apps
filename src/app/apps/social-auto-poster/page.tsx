"use client";

import { useState, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import SocialAutoPosterNav from "@/components/obd/SocialAutoPosterNav";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { isMetaPublishingEnabled } from "@/lib/apps/social-auto-poster/metaConnectionStatus";
import { getConnectionUIModel } from "@/lib/apps/social-auto-poster/connection/connectionState";
import ConnectionStatusBadge from "@/components/obd/ConnectionStatusBadge";
import Link from "next/link";
import type { AnalyticsSummary, SocialPlatform } from "@/lib/apps/social-auto-poster/types";

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  googleBusiness: "Google Business",
};

export default function SocialAutoPosterDashboardPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [queueItems, setQueueItems] = useState<Array<{
    id: string;
    status: string;
    scheduledAt?: Date | null;
    postedAt?: Date | null;
  }>>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<{
    ok?: boolean;
    configured?: boolean;
    metaReviewMode?: boolean;
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

  const reviewModeEnabled = connectionStatus?.metaReviewMode === true;

  useEffect(() => {
    loadAnalytics();
    loadQueue();
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

  const loadQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await fetch("/api/social-auto-poster/queue");
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load queue:", err);
    } finally {
      setQueueLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/social-auto-poster/analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="OBD Social Auto-Poster"
      tagline="Generate, approve, schedule, and auto-publish platform-optimized social posts for your local business."
    >
      <SocialAutoPosterNav isDark={isDark} />

      {reviewModeEnabled && (
        <div
          className={`mt-3 mb-4 p-3 rounded-xl border text-sm ${
            isDark
              ? "border-amber-700/50 bg-amber-900/10 text-amber-200"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          Review Mode enabled: Scheduling/automation disabled. Manual publish only.
        </div>
      )}

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

      <div className="mt-7 space-y-6">
        {/* Analytics Panel */}
        <OBDPanel isDark={isDark}>
          <div className="flex items-center justify-between mb-4">
            <OBDHeading level={2} isDark={isDark}>
              Analytics
            </OBDHeading>
            <Link
              href="/apps/social-auto-poster/activity"
              className={`text-sm ${themeClasses.mutedText} hover:${themeClasses.headingText} transition-colors`}
            >
              View Activity →
            </Link>
          </div>
          {loading || queueLoading ? (
            <div className="text-center py-8">
              <p className={themeClasses.mutedText}>Loading analytics...</p>
            </div>
          ) : (() => {
            // Determine if we have meaningful analytics (not all zeros)
            const hasRealActivity = analytics && (
              analytics.totalPosted > 0 ||
              analytics.totalFailed > 0 ||
              analytics.totalScheduled > 0
            );

            // Get queue counts
            const queueCount = queueItems.length;
            const scheduledCount = queueItems.filter(item => item.status === "scheduled").length;
            const draftCount = queueItems.filter(item => item.status === "draft").length;
            const approvedCount = queueItems.filter(item => item.status === "approved").length;

            // Check connection status
            const publishingEnabled = isMetaPublishingEnabled();
            const statusUI = getConnectionUIModel(connectionStatus, undefined, publishingEnabled);
            const isConnected = statusUI.state === "connected";
            const isDisabled = statusUI.state === "disabled";

            // If no real activity, show honest messaging
            if (!hasRealActivity && queueCount === 0) {
              return (
                <div className="space-y-4">
                  <div className={`p-6 rounded-xl border text-center ${
                    isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                  }`}>
                    <p className={`text-lg font-semibold mb-2 ${themeClasses.headingText}`}>
                      No activity yet
                    </p>
                    <p className={`text-sm ${themeClasses.mutedText}`}>
                      {isDisabled
                        ? "Posting will begin once accounts are connected."
                        : "Generate posts in the Composer to get started."}
                    </p>
                  </div>
                </div>
              );
            }

            // Show metrics with honest messaging for zeros
            return (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`p-4 rounded-xl border text-center ${
                    isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                  }`}>
                    {analytics && analytics.scheduledLast7Days > 0 ? (
                      <>
                        <p className={`text-3xl font-bold ${themeClasses.headingText}`}>
                          {analytics.scheduledLast7Days}
                        </p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Scheduled (7d)</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-sm ${themeClasses.mutedText}`}>No activity yet</p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Scheduled (7d)</p>
                      </>
                    )}
                  </div>
                  <div className={`p-4 rounded-xl border text-center ${
                    isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                  }`}>
                    {analytics && analytics.scheduledLast30Days > 0 ? (
                      <>
                        <p className={`text-3xl font-bold ${themeClasses.headingText}`}>
                          {analytics.scheduledLast30Days}
                        </p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Scheduled (30d)</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-sm ${themeClasses.mutedText}`}>No activity yet</p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Scheduled (30d)</p>
                      </>
                    )}
                  </div>
                  <div className={`p-4 rounded-xl border text-center ${
                    isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                  }`}>
                    {analytics && analytics.totalPosted > 0 ? (
                      <>
                        <p className={`text-3xl font-bold text-green-400`}>
                          {analytics.postedSuccessRate}%
                        </p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Success Rate</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-sm ${themeClasses.mutedText}`}>No posts yet</p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Success Rate</p>
                      </>
                    )}
                  </div>
                  <div className={`p-4 rounded-xl border text-center ${
                    isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                  }`}>
                    {analytics && analytics.totalFailed > 0 ? (
                      <>
                        <p className={`text-3xl font-bold ${themeClasses.headingText}`}>
                          {analytics.failureRate}%
                        </p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Failure Rate</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-sm ${themeClasses.mutedText}`}>No failures</p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Failure Rate</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Queue Status */}
                {queueCount > 0 && (
                  <div className={`p-4 rounded-xl border ${
                    isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                  }`}>
                    <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                      Queue Status
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center">
                        <p className={`text-2xl font-bold ${themeClasses.headingText}`}>{queueCount}</p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                          {queueCount === 1 ? "Post in queue" : "Posts in queue"}
                        </p>
                      </div>
                      {scheduledCount > 0 && (
                        <div className="text-center">
                          <p className={`text-2xl font-bold text-yellow-400`}>{scheduledCount}</p>
                          <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Scheduled</p>
                        </div>
                      )}
                      {approvedCount > 0 && (
                        <div className="text-center">
                          <p className={`text-2xl font-bold text-blue-400`}>{approvedCount}</p>
                          <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Approved</p>
                        </div>
                      )}
                      {draftCount > 0 && (
                        <div className="text-center">
                          <p className={`text-2xl font-bold ${themeClasses.headingText}`}>{draftCount}</p>
                          <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Draft</p>
                        </div>
                      )}
                    </div>
                    {!hasRealActivity && isDisabled && (
                      <p className={`text-xs mt-3 text-center ${themeClasses.mutedText}`}>
                        Posting will begin once accounts are connected.
                      </p>
                    )}
                  </div>
                )}

                {/* Platform Distribution - only show if there's real data */}
                {analytics && Object.values(analytics.platformDistribution).some(count => count > 0) && (
                  <div>
                    <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
                      Platform Distribution
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(analytics.platformDistribution)
                        .filter(([_, count]) => count > 0)
                        .map(([platform, count]) => (
                          <div
                            key={platform}
                            className={`p-3 rounded-xl border text-center ${
                              isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <p className={`text-2xl font-bold ${themeClasses.headingText}`}>{count}</p>
                            <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                              {PLATFORM_LABELS[platform as SocialPlatform] || platform}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Totals - only show if there's real activity */}
                {hasRealActivity && analytics && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-600">
                    <div className="text-center">
                      <p className={`text-xl font-semibold ${themeClasses.headingText}`}>
                        {analytics.totalQueueItems}
                      </p>
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Total Queue Items</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-xl font-semibold ${themeClasses.headingText}`}>
                        {analytics.totalScheduled}
                      </p>
                      <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Total Scheduled</p>
                    </div>
                    {analytics.totalPosted > 0 && (
                      <div className="text-center">
                        <p className={`text-xl font-semibold text-green-400`}>{analytics.totalPosted}</p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Total Posted</p>
                      </div>
                    )}
                    {analytics.totalFailed > 0 && (
                      <div className="text-center">
                        <p className={`text-xl font-semibold text-red-400`}>{analytics.totalFailed}</p>
                        <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>Total Failed</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </OBDPanel>

        {/* Quick Actions */}
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark} className="mb-4">
            Quick Actions
          </OBDHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/apps/social-auto-poster/setup"
              className={`p-4 rounded-xl border transition-colors ${
                isDark
                  ? "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <h3 className={`font-semibold mb-1 ${themeClasses.headingText}`}>⚙️ Setup</h3>
              <p className={`text-sm ${themeClasses.mutedText}`}>
                Configure your brand voice, posting schedule, and platform preferences.
              </p>
            </Link>
            <Link
              href="/apps/social-auto-poster/composer"
              className={`p-4 rounded-xl border transition-colors ${
                isDark
                  ? "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <h3 className={`font-semibold mb-1 ${themeClasses.headingText}`}>✍️ Create Posts</h3>
              <p className={`text-sm ${themeClasses.mutedText}`}>
                Generate platform-optimized social media posts using AI.
              </p>
            </Link>
            <Link
              href="/apps/social-auto-poster/queue"
              className={`p-4 rounded-xl border transition-colors ${
                isDark
                  ? "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <h3 className={`font-semibold mb-1 ${themeClasses.headingText}`}>📋 Queue</h3>
              <p className={`text-sm ${themeClasses.mutedText}`}>
                Review, approve, and schedule your generated posts.
              </p>
            </Link>
            <Link
              href="/apps/social-auto-poster/activity"
              className={`p-4 rounded-xl border transition-colors ${
                isDark
                  ? "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <h3 className={`font-semibold mb-1 ${themeClasses.headingText}`}>📊 Activity</h3>
              <p className={`text-sm ${themeClasses.mutedText}`}>
                View posting history, success rates, and error logs.
              </p>
            </Link>
          </div>
        </OBDPanel>

        {/* Getting Started */}
        <OBDPanel isDark={isDark}>
          <OBDHeading level={2} isDark={isDark} className="mb-4">
            Getting Started
          </OBDHeading>
          <div className={`space-y-3 ${themeClasses.mutedText} text-sm`}>
            <p>
              <strong className={themeClasses.headingText}>1. Setup:</strong> Configure your brand voice, posting preferences, and schedule.
            </p>
            <p>
              <strong className={themeClasses.headingText}>2. Generate:</strong> Use the Composer to create platform-optimized posts.
            </p>
            <p>
              <strong className={themeClasses.headingText}>3. Review:</strong> Approve posts in the Queue before they go live.
            </p>
            <p>
              <strong className={themeClasses.headingText}>4. Monitor:</strong> Track performance in the Activity page.
            </p>
          </div>
        </OBDPanel>
      </div>
    </OBDPageContainer>
  );
}

