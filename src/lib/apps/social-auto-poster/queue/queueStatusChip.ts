/**
 * Queue Status Chip Helper (Tier 5A)
 * 
 * Centralized mapping for queue item status chips including "Blocked" state.
 * Provides calm, neutral styling and clear status labels.
 */

import type { SocialQueueItem, QueueStatus } from "../types";
import type { ConnectionUIState } from "../connection/connectionState";

export type QueueItemDisplayStatus = QueueStatus | "blocked" | "skipped";

export interface QueueStatusChip {
  label: string;
  bg: string;
  text: string;
  border: string;
  tooltip?: string;
}

/**
 * Determines if a queue item should be displayed as "Blocked"
 * 
 * An item is blocked when:
 * - It's scheduled or approved AND
 * - Publishing cannot occur due to platform/API state (pending, disabled, or error connection state)
 */
function isItemBlocked(
  item: SocialQueueItem,
  connectionUIState: ConnectionUIState
): boolean {
  // Only scheduled or approved items can be blocked
  if (item.status !== "scheduled" && item.status !== "approved") {
    return false;
  }

  // Blocked if connection state prevents publishing
  return (
    connectionUIState === "pending" ||
    connectionUIState === "disabled" ||
    connectionUIState === "error"
  );
}

/**
 * Get display status for a queue item
 * 
 * Returns the effective status to display, which may be "blocked" even if
 * the item's actual status is "scheduled" or "approved".
 */
export function getQueueItemDisplayStatus(
  item: SocialQueueItem,
  connectionUIState: ConnectionUIState
): QueueItemDisplayStatus {
  if (isItemBlocked(item, connectionUIState)) {
    return "blocked";
  }
  return item.status;
}

/**
 * Get status chip styling and label for a queue item
 * 
 * Centralized function that maps queue items to status chip appearance.
 * Uses calm, neutral styling (gray/amber), no red unless item failed.
 */
export function getQueueStatusChip(
  item: SocialQueueItem,
  connectionUIState: ConnectionUIState,
  isDark: boolean
): QueueStatusChip {
  const displayStatus = getQueueItemDisplayStatus(item, connectionUIState);

  // Status chip definitions (Tier 5A - calm, neutral styling)
  const chipDefinitions: Record<QueueItemDisplayStatus, QueueStatusChip> = {
    draft: {
      label: "Draft",
      bg: isDark ? "bg-slate-500/20" : "bg-slate-50",
      text: isDark ? "text-slate-400" : "text-slate-600",
      border: isDark ? "border-slate-500" : "border-slate-300",
    },
    approved: {
      label: "Approved",
      bg: isDark ? "bg-blue-500/20" : "bg-blue-50",
      text: isDark ? "text-blue-400" : "text-blue-700",
      border: isDark ? "border-blue-500" : "border-blue-300",
    },
    scheduled: {
      label: "Scheduled",
      bg: isDark ? "bg-amber-500/20" : "bg-amber-50",
      text: isDark ? "text-amber-400" : "text-amber-700",
      border: isDark ? "border-amber-500" : "border-amber-300",
    },
    posted: {
      label: "Posted",
      bg: isDark ? "bg-green-500/20" : "bg-green-50",
      text: isDark ? "text-green-400" : "text-green-700",
      border: isDark ? "border-green-500" : "border-green-300",
    },
    failed: {
      label: "Failed",
      bg: isDark ? "bg-red-500/20" : "bg-red-50",
      text: isDark ? "text-red-400" : "text-red-700",
      border: isDark ? "border-red-500" : "border-red-300",
    },
    blocked: {
      label: "Blocked",
      bg: isDark ? "bg-slate-500/20" : "bg-slate-50",
      text: isDark ? "text-slate-400" : "text-slate-600",
      border: isDark ? "border-slate-500" : "border-slate-300",
      tooltip: "Blocked: publishing unavailable until accounts are connected.",
    },
    skipped: {
      label: "Skipped",
      bg: isDark ? "bg-slate-500/20" : "bg-slate-50",
      text: isDark ? "text-slate-400" : "text-slate-600",
      border: isDark ? "border-slate-500" : "border-slate-300",
    },
  };

  return chipDefinitions[displayStatus];
}

