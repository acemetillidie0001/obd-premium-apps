/**
 * Meta Connection Status Helper
 * 
 * Provides standardized connection status states and error handling
 * for Meta (Facebook/Instagram) connections.
 * 
 * Uses centralized connection state mapping (Tier 5A) for calm, trust-safe messaging.
 */

import { getConnectionUIModel, type ConnectionUIModel } from "./connection/connectionState";

export type MetaConnectionStatus = 
  | "NOT_CONNECTED"
  | "CONNECTED"
  | "NEEDS_REAUTH"
  | "ACCESS_REVOKED"
  | "ERROR";

export interface MetaConnectionState {
  status: MetaConnectionStatus;
  message: string;
  actionLabel: string;
  actionUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Maps ConnectionUIState to legacy MetaConnectionStatus
 */
function mapUIStateToMetaStatus(state: ConnectionUIModel["state"]): MetaConnectionStatus {
  switch (state) {
    case "connected":
      return "CONNECTED";
    case "limited":
    case "pending":
      return "CONNECTED"; // Limited/pending still considered connected
    case "disabled":
      return "NOT_CONNECTED";
    case "error":
      return "ERROR";
    default:
      return "ERROR";
  }
}

/**
 * Derives connection status from API response and error codes
 * 
 * Uses centralized connection state mapping (Tier 5A) to provide
 * calm, trust-safe messaging instead of scary error messages.
 */
export function deriveMetaConnectionStatus(
  apiResponse: {
    ok?: boolean;
    configured?: boolean;
    errorCode?: string;
    errorMessage?: string;
    facebook?: {
      connected?: boolean;
      basicConnectGranted?: boolean;
      pagesAccessGranted?: boolean;
      pageName?: string;
    };
    publishing?: {
      enabled?: boolean;
      reasonIfDisabled?: string;
    };
  },
  metaError?: {
    code?: string;
    message?: string;
    type?: string;
  }
): MetaConnectionState {
  // Use centralized mapping
  const publishingEnabled = isMetaPublishingEnabled(); // Defined below
  const uiModel = getConnectionUIModel(apiResponse, metaError || null, publishingEnabled);

  // Map to legacy status format for backward compatibility
  const status = mapUIStateToMetaStatus(uiModel.state);

  // Determine action label based on state
  let actionLabel = "Try Again";
  let actionUrl: string | undefined;

  if (uiModel.state === "connected") {
    actionLabel = "Disconnect";
  } else if (uiModel.state === "limited") {
    const facebook = apiResponse?.facebook;
    if (facebook?.connected && !facebook?.pagesAccessGranted) {
      actionLabel = "Enable Pages Access";
    } else {
      actionLabel = "Connect";
    }
  } else if (uiModel.state === "disabled") {
    if (!apiResponse?.configured) {
      actionLabel = "Contact Support";
      actionUrl = "mailto:support@ocalabusinessdirectory.com";
    } else {
      actionLabel = "Connect Facebook";
    }
  } else if (uiModel.state === "pending") {
    actionLabel = "Learn More";
  }

  // Preserve error details in errorMessage for debugging
  const errorCode = apiResponse?.errorCode;
  const errorMessage = uiModel.detail || undefined;

  return {
    status,
    message: uiModel.message, // Use calm message from centralized mapping
    actionLabel,
    actionUrl,
    errorCode,
    errorMessage,
  };
}

/**
 * Check if Meta publishing is enabled via feature flag
 */
export function isMetaPublishingEnabled(): boolean {
  return process.env.META_PUBLISHING_ENABLED === "true";
}

/**
 * Get feature flag message for UI
 */
export function getMetaPublishingBannerMessage(): string | null {
  if (isMetaPublishingEnabled()) {
    return null; // No banner when enabled
  }
  
  return "Facebook/Instagram publishing is in limited mode while we complete Meta App Review. You can still compose posts, queue them, and use simulate mode to preview how they'll look.";
}

