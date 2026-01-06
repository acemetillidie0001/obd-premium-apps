/**
 * Activity Message Mapper (Tier 5B)
 * 
 * Maps raw activity log items to human-readable, actionable UI messages.
 */

import type { ActivityLogItem } from "../types";
import type { ConnectionUIModel } from "../connection/connectionState";

export type ActivityTone = "neutral" | "success" | "warning";

export interface ActivityUIMessage {
  title: string;
  description?: string;
  tone: ActivityTone;
  nextAction?: "will_retry" | "paused" | "needs_attention" | "none";
}

/**
 * Map activity log item to UI message
 * 
 * @param item - Activity log item
 * @param connectionUI - Connection UI model for context
 * @returns ActivityUIMessage with human-readable content
 */
export function mapActivityToUI(
  item: ActivityLogItem,
  connectionUI: ConnectionUIModel
): ActivityUIMessage {
  // Success case
  if (item.status === "posted") {
    return {
      title: "Post published successfully",
      tone: "success",
      nextAction: "none",
    };
  }

  // Failed case - analyze error
  if (item.status === "failed") {
    const errorMsg = item.errorMessage?.toLowerCase() || "";
    
    // Check if connection state is pending/disabled/error and publish was attempted
    if (
      (connectionUI.state === "pending" || 
       connectionUI.state === "disabled" || 
       connectionUI.state === "error") &&
      item.attemptCount > 0
    ) {
      return {
        title: "Publishing paused",
        description: connectionUI.state === "pending"
          ? "Publishing is temporarily unavailable while Meta completes app review. Posts will resume automatically once approved."
          : connectionUI.state === "disabled"
          ? "Publishing is disabled. Connect your accounts in Setup to enable posting."
          : "Publishing is unavailable due to connection issues. Please check your account connections.",
        tone: "warning",
        nextAction: "paused",
      };
    }

    // Rate limiting
    if (
      errorMsg.includes("rate limit") ||
      errorMsg.includes("rate_limit") ||
      errorMsg.includes("too many requests") ||
      errorMsg.includes("429")
    ) {
      return {
        title: "Rate limit reached",
        description: "The platform temporarily limited posting due to too many requests. We'll automatically retry after a short delay.",
        tone: "warning",
        nextAction: "will_retry",
      };
    }

    // Platform rejection (permissions, formatting, policy)
    if (
      errorMsg.includes("permission") ||
      errorMsg.includes("access denied") ||
      errorMsg.includes("forbidden") ||
      errorMsg.includes("403") ||
      errorMsg.includes("policy violation") ||
      errorMsg.includes("community guidelines") ||
      errorMsg.includes("format") ||
      errorMsg.includes("invalid")
    ) {
      return {
        title: "Post rejected by platform",
        description: "The platform rejected this post. This may be due to temporary permission issues or content formatting. Check your account permissions or try editing the post content.",
        tone: "warning",
        nextAction: "needs_attention",
      };
    }

    // Network/timeout errors
    if (
      errorMsg.includes("timeout") ||
      errorMsg.includes("network") ||
      errorMsg.includes("connection") ||
      errorMsg.includes("503") ||
      errorMsg.includes("502") ||
      errorMsg.includes("504")
    ) {
      return {
        title: "Connection issue",
        description: "A temporary connection problem occurred. We'll automatically retry posting.",
        tone: "warning",
        nextAction: "will_retry",
      };
    }

    // Unknown error - calm fallback
    return {
      title: "Post failed to publish",
      description: "The post couldn't be published. This may be temporary. Check your account connections and try again if needed.",
      tone: "warning",
      nextAction: "needs_attention",
    };
  }

  // Draft/Approved/Scheduled - neutral
  if (item.status === "draft" || item.status === "approved" || item.status === "scheduled") {
    return {
      title: item.status === "draft" 
        ? "Draft post"
        : item.status === "approved"
        ? "Post approved"
        : "Post scheduled",
      tone: "neutral",
      nextAction: "none",
    };
  }

  // Skipped - neutral
  if (item.status === "skipped") {
    return {
      title: "Post skipped",
      description: "This post was skipped and won't be published.",
      tone: "neutral",
      nextAction: "none",
    };
  }

  // Default fallback
  return {
    title: `Post ${item.status}`,
    tone: "neutral",
    nextAction: "none",
  };
}

