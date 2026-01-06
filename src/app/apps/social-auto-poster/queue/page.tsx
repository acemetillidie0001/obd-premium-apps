"use client";

import { useState, useEffect } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDFilterBar from "@/components/obd/OBDFilterBar";
import SocialAutoPosterNav from "@/components/obd/SocialAutoPosterNav";
import SocialQueueCalendar from "@/components/obd/SocialQueueCalendar";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { getMetaPublishingBannerMessage, isMetaPublishingEnabled } from "@/lib/apps/social-auto-poster/metaConnectionStatus";
import { getConnectionUIModel } from "@/lib/apps/social-auto-poster/connection/connectionState";
import { getQueueStatusChip, type QueueChipTone } from "@/lib/apps/social-auto-poster/queue/queueStatusUI";
import ConnectionStatusBadge from "@/components/obd/ConnectionStatusBadge";
import SessionCallout from "../ui/SessionCallout";
import { DISMISS_KEYS } from "@/lib/apps/social-auto-poster/ui/dismissKeys";
import type { SocialQueueItem, QueueStatus } from "@/lib/apps/social-auto-poster/types";

// Legacy STATUS_COLORS kept for backward compatibility (filter buttons, etc.)
// New status chips use getQueueStatusChip() helper for centralized mapping
const STATUS_COLORS: Record<QueueStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500" },
  approved: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500" },
  scheduled: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500" },
  posted: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500" },
  failed: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500" },
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  googleBusiness: "Google Business",
};

/**
 * Get CSS classes for queue status chip based on tone
 */
function getChipClasses(tone: QueueChipTone, isDark: boolean): { bg: string; text: string; border: string } {
  const toneClasses: Record<QueueChipTone, { bg: string; text: string; border: string }> = {
    neutral: {
      bg: isDark ? "bg-slate-500/20" : "bg-slate-50",
      text: isDark ? "text-slate-400" : "text-slate-600",
      border: isDark ? "border-slate-500" : "border-slate-300",
    },
    success: {
      bg: isDark ? "bg-blue-500/20" : "bg-blue-50",
      text: isDark ? "text-blue-400" : "text-blue-700",
      border: isDark ? "border-blue-500" : "border-blue-300",
    },
    warning: {
      bg: isDark ? "bg-amber-500/20" : "bg-amber-50",
      text: isDark ? "text-amber-400" : "text-amber-700",
      border: isDark ? "border-amber-500" : "border-amber-300",
    },
  };
  return toneClasses[tone];
}

export default function SocialAutoPosterQueuePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SocialQueueItem[]>([]);
  const [filter, setFilter] = useState<QueueStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedItem, setSelectedItem] = useState<SocialQueueItem | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [imageInfoMap, setImageInfoMap] = useState<Record<string, {
    source: "engine" | "legacy";
    image?: {
      requestId?: string;
      status: string;
      url?: string;
      altText?: string;
      provider?: string;
      storage?: string;
      updatedAt?: string;
    };
    events?: Array<{
      type: string;
      ok: boolean;
      messageSafe?: string;
      createdAt: string;
    }>;
  }>>({});
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionProgress, setBulkActionProgress] = useState<{
    action: string;
    current: number;
    total: number;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    loadQueue();
    // Clear selection when filter changes
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

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

  // Load image info for items with imageRequestId
  useEffect(() => {
    const loadImageInfo = async () => {
      const itemsWithRequestId = items.filter((item) => item.imageRequestId);
      if (itemsWithRequestId.length === 0) return;

      // Batch fetch image info for all items with imageRequestId
      const imageInfoPromises = itemsWithRequestId.map(async (item) => {
        try {
          const res = await fetch(`/api/social-auto-poster/queue/image?queueItemId=${item.id}`);
          if (!res.ok) {
            return { itemId: item.id, info: null };
          }
          const data = await res.json();
          return { itemId: item.id, info: data.ok ? { source: data.source, image: data.image, events: data.events } : null };
        } catch (err) {
          console.warn(`Failed to load image info for ${item.id}:`, err);
          return { itemId: item.id, info: null };
        }
      });

      const results = await Promise.all(imageInfoPromises);
      const newMap: Record<string, typeof imageInfoMap[string]> = {};
      results.forEach(({ itemId, info }) => {
        if (info) {
          newMap[itemId] = info;
        }
      });
      setImageInfoMap((prev) => ({ ...prev, ...newMap }));
    };

    if (items.length > 0) {
      loadImageInfo();
    }
  }, [items]);

  // Refresh image info for a specific item
  const refreshImageInfo = async (itemId: string) => {
    try {
      const res = await fetch(`/api/social-auto-poster/queue/image?queueItemId=${itemId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setImageInfoMap((prev) => ({
            ...prev,
            [itemId]: { source: data.source, image: data.image, events: data.events },
          }));
        }
      }
    } catch (err) {
      console.warn(`Failed to refresh image info for ${itemId}:`, err);
    }
  };

  // Handle image regeneration
  const handleRegenerateImage = async (itemId: string) => {
    setRegeneratingIds((prev) => new Set(prev).add(itemId));

    try {
      const res = await fetch("/api/social-auto-poster/queue/image/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueItemId: itemId }),
      });

      const data = await res.json();

      if (data.ok) {
        setToast({ message: "Regenerated", type: "success" });
        // Re-fetch canonical image info for this item
        await refreshImageInfo(itemId);
        // Also refresh the queue to get updated queue item fields
        await loadQueue();
      } else {
        // Show safe error message
        const errorMessage = data.errorCode === "NO_IMAGE_REQUEST"
          ? "No image request found"
          : data.errorCode === "ENGINE_FETCH_FAILED"
          ? "Failed to connect to image engine"
          : data.errorCode === "ENGINE_ERROR"
          ? "Image engine error"
          : data.errorCode || "Failed to regenerate image";
        
        setToast({
          message: errorMessage,
          type: "error",
        });
        // UI remains stable - don't clear existing image info on failure
      }
    } catch (err) {
      // Non-blocking: show error but keep UI stable
      setToast({
        message: "Failed to regenerate image",
        type: "error",
      });
      // UI remains stable - don't clear existing image info on failure
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = filter === "all" ? "/api/social-auto-poster/queue" : `/api/social-auto-poster/queue?status=${filter}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to load queue");
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: QueueStatus, scheduledAt?: Date | null) => {
    try {
      const res = await fetch("/api/social-auto-poster/queue/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: itemId, 
          status: newStatus,
          ...(scheduledAt !== undefined && { scheduledAt: scheduledAt ? scheduledAt.toISOString() : null }),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update status");
      }

      await loadQueue();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleSchedule = async (itemId: string) => {
    const dateStr = prompt("Enter schedule date/time (YYYY-MM-DD HH:MM) or leave empty to schedule now:");
    if (dateStr === null) return; // User cancelled
    
    let scheduledAt: Date | null = null;
    if (dateStr.trim()) {
      try {
        scheduledAt = new Date(dateStr);
        if (isNaN(scheduledAt.getTime())) {
          alert("Invalid date format. Use YYYY-MM-DD HH:MM");
          return;
        }
      } catch {
        alert("Invalid date format. Use YYYY-MM-DD HH:MM");
        return;
      }
    } else {
      scheduledAt = new Date(); // Schedule now
    }
    
    await handleStatusChange(itemId, "scheduled", scheduledAt);
  };

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "Not scheduled";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString();
  };

  const handleItemClick = (item: SocialQueueItem) => {
    setSelectedItem(item);
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    setSelectedItem(null);
  };

  // Selection management
  const toggleSelection = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  // Get visible items (for select all - only selects visible/filtered items)
  const visibleItems = items; // Already filtered by the filter state

  // Bulk action handlers
  const executeBulkAction = async (
    action: "approve" | "schedule" | "delete",
    itemIds: string[]
  ) => {
    if (itemIds.length === 0) return;

    setBulkActionProgress({ action, current: 0, total: itemIds.length });

    const results: { success: string[]; failed: string[] } = {
      success: [],
      failed: [],
    };

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      for (let i = 0; i < itemIds.length; i++) {
        const itemId = itemIds[i];
        setBulkActionProgress({ action, current: i + 1, total: itemIds.length });

        try {
          if (action === "delete") {
            const res = await fetch("/api/social-auto-poster/queue/delete", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: itemId }),
            });
            if (!res.ok) throw new Error("Delete failed");
            results.success.push(itemId);
          } else if (action === "approve") {
            const res = await fetch("/api/social-auto-poster/queue/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: itemId, status: "approved" }),
            });
            if (!res.ok) throw new Error("Approve failed");
            results.success.push(itemId);
          } else if (action === "schedule") {
            const scheduledAt = new Date(); // Schedule now
            const res = await fetch("/api/social-auto-poster/queue/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: itemId,
                status: "scheduled",
                scheduledAt: scheduledAt.toISOString(),
              }),
            });
            if (!res.ok) throw new Error("Schedule failed");
            results.success.push(itemId);
          }

          // Throttle: delay between calls (200ms)
          if (i < itemIds.length - 1) {
            await delay(200);
          }
        } catch (err) {
          results.failed.push(itemId);
        }
      }
    } finally {
      setBulkActionProgress(null);
      setSelectedIds(new Set()); // Clear selection

      // Show completion message
      const actionLabel = action === "approve" ? "Approved" : action === "schedule" ? "Scheduled" : "Deleted";
      if (results.failed.length === 0) {
        setToast({
          message: `${actionLabel} ${results.success.length} post${results.success.length !== 1 ? "s" : ""}`,
          type: "success",
        });
      } else {
        setToast({
          message: `${actionLabel} ${results.success.length} post${results.success.length !== 1 ? "s" : ""}, ${results.failed.length} failed`,
          type: "error",
        });
      }

      // Refresh queue
      await loadQueue();
    }
  };

  const handleBulkApprove = () => {
    const ids = Array.from(selectedIds);
    executeBulkAction("approve", ids);
  };

  const handleBulkSchedule = () => {
    const ids = Array.from(selectedIds);
    executeBulkAction("schedule", ids);
  };

  const handleBulkDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    const ids = Array.from(selectedIds);
    setShowDeleteConfirm(false);
    executeBulkAction("delete", ids);
  };

  // Filter items for calendar (only scheduled items)
  const scheduledItems = items.filter((item) => item.scheduledAt && item.status === "scheduled");

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="OBD Social Auto-Poster"
      tagline="Review and manage your scheduled posts"
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

      {/* First-run Callout: Blocked Status */}
      <SessionCallout
        dismissKey={DISMISS_KEYS.queueBlockedStatus}
        title="About Blocked Status"
        message="Blocked means publishing is temporarily unavailable. Your posts remain queued safely."
        isDark={isDark}
      />

      <div className="mt-7">
        {/* Feature Flag Banner */}
        {(() => {
          const bannerMessage = getMetaPublishingBannerMessage();
          if (!bannerMessage) return null;
          return (
            <div className={`mb-6 p-4 rounded-xl border ${
              isDark 
                ? "border-blue-700/50 bg-blue-900/20 text-blue-400" 
                : "border-blue-200 bg-blue-50 text-blue-800"
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-lg">ℹ️</span>
                <div className="text-sm">
                  <div className="font-medium mb-1">Limited Mode</div>
                  <div>{bannerMessage}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* View Toggle and Filters */}
        <OBDPanel isDark={isDark} className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("list")}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  viewMode === "list"
                    ? "bg-[#29c4a9] text-white"
                    : isDark
                    ? "bg-slate-800 text-slate-300"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  viewMode === "calendar"
                    ? "bg-[#29c4a9] text-white"
                    : isDark
                    ? "bg-slate-800 text-slate-300"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Calendar View
              </button>
            </div>
          </div>
          {viewMode === "list" && (
            <>
              <OBDFilterBar isDark={isDark} usePanel={false}>
                <button
                  onClick={() => setFilter("all")}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    filter === "all"
                      ? "bg-[#29c4a9] text-white"
                      : isDark
                      ? "bg-slate-800 text-slate-300"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  All
                </button>
                {Object.keys(STATUS_COLORS).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status as QueueStatus)}
                    className={`px-4 py-2 rounded-full text-sm transition-colors ${
                      filter === status
                        ? "bg-[#29c4a9] text-white"
                        : isDark
                        ? "bg-slate-800 text-slate-300"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </OBDFilterBar>
              
              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <OBDPanel isDark={isDark} className="mt-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <span className={themeClasses.headingText}>
                        {selectedIds.size} selected
                      </span>
                      {(() => {
                        const publishingEnabled = isMetaPublishingEnabled();
                        const connectionUI = getConnectionUIModel(connectionStatus, undefined, publishingEnabled);
                        if (connectionUI.state === "pending" || connectionUI.state === "disabled" || connectionUI.state === "error") {
                          return (
                            <span className={`text-xs ${themeClasses.mutedText}`}>
                              Publishing will begin once accounts are connected.
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={handleBulkApprove}
                        disabled={!!bulkActionProgress}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          bulkActionProgress
                            ? "bg-slate-400 text-white cursor-not-allowed"
                            : isDark
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        }`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={handleBulkSchedule}
                        disabled={!!bulkActionProgress}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          bulkActionProgress
                            ? "bg-slate-400 text-white cursor-not-allowed"
                            : isDark
                            ? "bg-amber-600 text-white hover:bg-amber-700"
                            : "bg-amber-500 text-white hover:bg-amber-600"
                        }`}
                      >
                        Schedule
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        disabled={!!bulkActionProgress}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                          bulkActionProgress
                            ? "bg-slate-400 text-white cursor-not-allowed"
                            : isDark
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-red-500 text-white hover:bg-red-600"
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {bulkActionProgress && (
                    <div className="mt-3">
                      <div className={`text-sm ${themeClasses.mutedText}`}>
                        {bulkActionProgress.action === "approve" ? "Approving" :
                         bulkActionProgress.action === "schedule" ? "Scheduling" :
                         "Deleting"} {bulkActionProgress.current}/{bulkActionProgress.total}...
                      </div>
                    </div>
                  )}
                </OBDPanel>
              )}
            </>
          )}
        </OBDPanel>

        {/* Calendar View */}
        {viewMode === "calendar" && !loading && (
          <OBDPanel isDark={isDark}>
            <SocialQueueCalendar
              items={scheduledItems}
              isDark={isDark}
              onItemClick={handleItemClick}
            />
          </OBDPanel>
        )}

        {/* Queue Items (List View) */}
        {viewMode === "list" && loading ? (
          <OBDPanel isDark={isDark}>
            <p className={themeClasses.mutedText}>Loading queue...</p>
          </OBDPanel>
        ) : error ? (
          <OBDPanel isDark={isDark}>
            <p className="text-red-500">{error}</p>
          </OBDPanel>
        ) : items.length === 0 ? (
          <OBDPanel isDark={isDark}>
            <div className="text-center py-8">
              <p className={`text-lg mb-2 ${themeClasses.headingText}`}>No posts in queue</p>
              <p className={themeClasses.mutedText}>
                Generate posts in the{" "}
                <a href="/apps/social-auto-poster/composer" className="text-[#29c4a9] hover:underline">
                  Composer
                </a>{" "}
                to get started.
              </p>
            </div>
          </OBDPanel>
        ) : (
          <div className="space-y-4">
            {/* Select All Checkbox (Header) */}
            {items.length > 0 && (
              <OBDPanel isDark={isDark} className="mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4"
                  />
                  <span className={themeClasses.mutedText}>
                    Select all ({items.length} {items.length === 1 ? "item" : "items"})
                  </span>
                </label>
              </OBDPanel>
            )}
            
            {items.map((item) => {
              // Get connection UI model for blocked status determination
              const publishingEnabled = isMetaPublishingEnabled();
              const connectionUI = getConnectionUIModel(connectionStatus, undefined, publishingEnabled);
              
              // Get status chip using centralized helper
              const statusChip = getQueueStatusChip(item, connectionUI);
              const chipClasses = getChipClasses(statusChip.tone, isDark);
              
              return (
                <OBDPanel key={item.id} isDark={isDark}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        {/* Selection Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelection(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4"
                        />
                        <span 
                          className={`px-2 py-1 text-xs rounded-full border ${chipClasses.bg} ${chipClasses.text} ${chipClasses.border}`}
                          title={statusChip.helper || undefined}
                        >
                          {statusChip.label}
                        </span>
                        {statusChip.helper && (
                          <span className={`text-xs ${themeClasses.mutedText}`} title={statusChip.helper}>
                            ℹ️
                          </span>
                        )}
                        <span className={themeClasses.mutedText}>{PLATFORM_LABELS[item.platform] || item.platform}</span>
                        {/* Image Status Badge */}
                        {(() => {
                          const imageInfo = imageInfoMap[item.id];
                          const canonicalStatus = imageInfo?.image?.status;
                          const displayStatus = canonicalStatus || item.imageStatus;
                          const lastEvents = imageInfo?.events?.slice(0, 3) || [];
                          
                          if (!displayStatus) return null;

                          const statusColors = {
                            generated: isDark
                              ? "bg-green-500/20 text-green-400 border-green-500"
                              : "bg-green-50 text-green-700 border-green-300",
                            fallback: isDark
                              ? "bg-amber-500/20 text-amber-400 border-amber-500"
                              : "bg-amber-50 text-amber-700 border-amber-300",
                            skipped: isDark
                              ? "bg-slate-500/20 text-slate-400 border-slate-500"
                              : "bg-slate-50 text-slate-600 border-slate-300",
                            failed: isDark
                              ? "bg-red-500/20 text-red-400 border-red-500"
                              : "bg-red-50 text-red-700 border-red-300",
                            queued: isDark
                              ? "bg-blue-500/20 text-blue-400 border-blue-500"
                              : "bg-blue-50 text-blue-700 border-blue-300",
                          };

                          const statusLabel = {
                            generated: "🖼️ Generated",
                            fallback: "⚠️ Fallback",
                            skipped: "⏭️ Skipped",
                            failed: "❌ Failed",
                            queued: "⏳ Queued",
                          };

                          const tooltipText = lastEvents.length > 0
                            ? `Last events:\n${lastEvents.map((e) => `${e.type} (${e.ok ? "✓" : "✗"}): ${e.messageSafe || "N/A"}`).join("\n")}`
                            : item.imageStatus === "fallback" && item.imageFallbackReason
                            ? item.imageFallbackReason
                            : displayStatus === "generated"
                            ? "Image generated successfully"
                            : displayStatus === "fallback"
                            ? "Image generation fallback"
                            : "Image generation skipped";

                          return (
                            <span
                              className={`px-2 py-1 text-xs rounded-full border ${
                                statusColors[displayStatus as keyof typeof statusColors] || statusColors.skipped
                              }`}
                              title={tooltipText}
                            >
                              {statusLabel[displayStatus as keyof typeof statusLabel] || `⏭️ ${displayStatus}`}
                            </span>
                          );
                        })()}
                      </div>
                      {/* Image Preview and Regenerate Button */}
                      {(() => {
                        const imageInfo = imageInfoMap[item.id];
                        const canonicalUrl = imageInfo?.image?.url;
                        const canonicalAltText = imageInfo?.image?.altText;
                        const displayUrl = canonicalUrl || item.imageUrl;
                        const displayAltText = canonicalAltText || item.imageAltText;
                        // Use canonical status (preferred) or fallback to queue item status
                        const canonicalStatus = imageInfo?.image?.status;
                        const displayStatus = canonicalStatus || item.imageStatus;
                        const hasImageRequestId = !!item.imageRequestId;
                        const isRegenerating = regeneratingIds.has(item.id);
                        // Show regenerate button only when imageRequestId exists AND status is failed/fallback/skipped
                        const shouldShowRegenerate = hasImageRequestId && (
                          displayStatus === "failed" ||
                          displayStatus === "fallback" ||
                          displayStatus === "skipped"
                        );

                        return (
                          <div className="mb-2 flex items-start gap-2">
                            {displayStatus === "generated" && displayUrl && (
                              <img
                                src={displayUrl}
                                alt={displayAltText || "Generated image"}
                                className="max-w-xs max-h-32 rounded-lg border"
                              />
                            )}
                            {shouldShowRegenerate && (
                              <button
                                onClick={() => handleRegenerateImage(item.id)}
                                disabled={isRegenerating}
                                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                                  isRegenerating
                                    ? "bg-slate-400 text-white cursor-not-allowed"
                                    : isDark
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-blue-500 text-white hover:bg-blue-600"
                                }`}
                                title="Regenerate image"
                              >
                                {isRegenerating ? "Regenerating..." : "🔄 Regenerate"}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                      <p className={`${themeClasses.inputText} mb-2 whitespace-pre-wrap`}>{item.content}</p>
                      <div className={`text-xs ${themeClasses.mutedText}`}>
                        <p>Scheduled: {formatDate(item.scheduledAt)}</p>
                        {item.postedAt && <p>Posted: {formatDate(item.postedAt)}</p>}
                        {item.errorMessage && <p className="text-red-400">Error: {item.errorMessage}</p>}
                        <p>Attempts: {item.attemptCount}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {item.status === "draft" && (
                      <button
                        onClick={() => handleStatusChange(item.id, "approved")}
                        className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {item.status === "approved" && (
                      <button
                        onClick={() => handleSchedule(item.id)}
                        className="px-3 py-1 bg-yellow-500 text-white rounded-full text-sm hover:bg-yellow-600 transition-colors"
                      >
                        Schedule
                      </button>
                    )}
                    {item.status === "scheduled" && (
                      <>
                        <button
                          onClick={() => handleStatusChange(item.id, "approved")}
                          className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors"
                        >
                          Pause
                        </button>
                        <button
                          onClick={() => handleStatusChange(item.id, "draft")}
                          className="px-3 py-1 bg-slate-500 text-white rounded-full text-sm hover:bg-slate-600 transition-colors"
                        >
                          Skip
                        </button>
                      </>
                    )}
                  </div>
                </OBDPanel>
              );
            })}
          </div>
        )}

        {/* Drawer/Modal for Item Details */}
        {showDrawer && selectedItem && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center"
            onClick={closeDrawer}
          >
            <div
              className={`w-full md:w-2/3 lg:w-1/2 max-h-[90vh] overflow-y-auto ${
                isDark ? "bg-slate-900" : "bg-white"
              } rounded-t-2xl md:rounded-2xl shadow-xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900">
                <h3 className={`text-lg font-semibold ${themeClasses.headingText}`}>Post Details</h3>
                <button
                  onClick={closeDrawer}
                  className={`text-2xl ${themeClasses.mutedText} hover:${themeClasses.headingText}`}
                >
                  ×
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {(() => {
                      // Get status chip for drawer using centralized helper
                      const publishingEnabled = isMetaPublishingEnabled();
                      const connectionUI = getConnectionUIModel(connectionStatus, undefined, publishingEnabled);
                      const statusChip = getQueueStatusChip(selectedItem, connectionUI);
                      const chipClasses = getChipClasses(statusChip.tone, isDark);
                      return (
                        <>
                          <span 
                            className={`px-2 py-1 text-xs rounded-full border ${chipClasses.bg} ${chipClasses.text} ${chipClasses.border}`}
                            title={statusChip.helper || undefined}
                          >
                            {statusChip.label}
                          </span>
                          {statusChip.helper && (
                            <span className={`text-xs ${themeClasses.mutedText}`} title={statusChip.helper}>
                              ℹ️
                            </span>
                          )}
                        </>
                      );
                    })()}
                    <span className={themeClasses.mutedText}>
                      {PLATFORM_LABELS[selectedItem.platform] || selectedItem.platform}
                    </span>
                  </div>
                  <p className={`${themeClasses.inputText} mb-2 whitespace-pre-wrap`}>{selectedItem.content}</p>
                  <div className={`text-xs ${themeClasses.mutedText}`}>
                    <p>Scheduled: {formatDate(selectedItem.scheduledAt)}</p>
                    {selectedItem.postedAt && <p>Posted: {formatDate(selectedItem.postedAt)}</p>}
                    {selectedItem.errorMessage && <p className="text-red-400">Error: {selectedItem.errorMessage}</p>}
                    <p>Attempts: {selectedItem.attemptCount}</p>
                    {selectedItem.reason && <p className="mt-2">Why: {selectedItem.reason}</p>}
                  </div>
                </div>
                <div className="flex gap-2 pt-4 border-t border-slate-700">
                  {selectedItem.status === "draft" && (
                    <button
                      onClick={async () => {
                        await handleStatusChange(selectedItem.id, "approved");
                        closeDrawer();
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors"
                    >
                      Approve
                    </button>
                  )}
                  {selectedItem.status === "approved" && (
                    <button
                      onClick={async () => {
                        await handleSchedule(selectedItem.id);
                        closeDrawer();
                      }}
                      className="px-3 py-1 bg-yellow-500 text-white rounded-full text-sm hover:bg-yellow-600 transition-colors"
                    >
                      Schedule
                    </button>
                  )}
                  {selectedItem.status === "scheduled" && (
                    <>
                      <button
                        onClick={async () => {
                          await handleStatusChange(selectedItem.id, "approved");
                          closeDrawer();
                        }}
                        className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors"
                      >
                        Pause
                      </button>
                      <button
                        onClick={async () => {
                          await handleStatusChange(selectedItem.id, "draft");
                          closeDrawer();
                        }}
                        className="px-3 py-1 bg-slate-500 text-white rounded-full text-sm hover:bg-slate-600 transition-colors"
                      >
                        Skip
                      </button>
                    </>
                  )}
                  {selectedItem.status === "failed" && (
                    <button
                      onClick={async () => {
                        await handleStatusChange(selectedItem.id, "scheduled");
                        closeDrawer();
                      }}
                      className="px-3 py-1 bg-yellow-500 text-white rounded-full text-sm hover:bg-yellow-600 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className={`w-full max-w-md mx-4 rounded-xl shadow-xl ${
              isDark ? "bg-slate-800" : "bg-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className={`text-lg font-semibold mb-4 ${themeClasses.headingText}`}>
                Delete {selectedIds.size} queued post{selectedIds.size !== 1 ? "s" : ""}?
              </h3>
              <p className={`mb-6 ${themeClasses.mutedText}`}>
                This cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkDelete}
                  className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </OBDPageContainer>
  );
}

