/**
 * Queue Status UI Helper (Tier 5A)
 * 
 * Centralized mapping for queue item status chips including "Blocked" state.
 * Provides calm, neutral styling and clear status labels with tone-based styling.
 */

import type { SocialQueueItem, QueueStatus } from "../types";
import type { ConnectionUIModel } from "../connection/connectionState";

export type QueueChipTone = "neutral" | "success" | "warning";

export interface QueueStatusChip {
  label: string;
  tone: QueueChipTone;
  helper?: string;
}

/**
 * Determines if a queue item should be displayed as "Blocked"
 * 
 * An item is blocked when:
 * - It's scheduled or approved AND
 * - Publishing cannot occur due to platform/API state (pending, disabled, or error connection state)
 * 
 * Note: "limited" connection state does NOT block items (limited mode still allows queueing).
 */
function isItemBlocked(
  item: SocialQueueItem,
  connectionUI: ConnectionUIModel
): boolean {
  // Only scheduled or approved items can be blocked
  if (item.status !== "scheduled" && item.status !== "approved") {
    return false;
  }

  // Blocked if connection state prevents publishing
  // Note: "limited" does NOT block (per requirements)
  return (
    connectionUI.state === "pending" ||
    connectionUI.state === "disabled" ||
    connectionUI.state === "error"
  );
}

/**
 * Get status chip for a queue item
 * 
 * Maps queue item status to a chip with label, tone, and optional helper text.
 * Derives "Blocked" state when publishing cannot occur due to connection issues.
 * 
 * @param item - The queue item
 * @param connectionUI - The connection UI model (from getConnectionUIModel)
 * @returns QueueStatusChip with label, tone, and optional helper text
 */
export function getQueueStatusChip(
  item: SocialQueueItem,
  connectionUI: ConnectionUIModel
): QueueStatusChip {
  // Check for blocked state first (derived from connection + item status)
  if (isItemBlocked(item, connectionUI)) {
    return {
      label: "Blocked",
      tone: "warning",
      helper: "Blocked: publishing unavailable until accounts are connected.",
    };
  }

  // Base chip from item status
  const statusChips: Record<QueueStatus, QueueStatusChip> = {
    draft: {
      label: "Draft",
      tone: "neutral",
    },
    approved: {
      label: "Approved",
      tone: "success", // Using success tone for approved (can be styled as blue if preferred)
    },
    scheduled: {
      label: "Scheduled",
      tone: "warning",
    },
    posted: {
      label: "Posted",
      tone: "success",
    },
    failed: {
      label: "Failed",
      tone: "warning", // Warning tone (not red) - only use red if it's already used elsewhere
    },
  };

  return statusChips[item.status] || {
    label: item.status,
    tone: "neutral",
  };
}

