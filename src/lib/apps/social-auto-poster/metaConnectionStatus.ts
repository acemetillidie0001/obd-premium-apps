/**
 * Meta Connection Status Helper
 * 
 * Provides standardized connection status states and error handling
 * for Meta (Facebook/Instagram) connections.
 */

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
 * Derives connection status from API response and error codes
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
  },
  metaError?: {
    code?: string;
    message?: string;
    type?: string;
  }
): MetaConnectionState {
  // Not configured
  if (!apiResponse.configured) {
    return {
      status: "NOT_CONNECTED",
      message: "Meta integration is not configured. Please contact support.",
      actionLabel: "Contact Support",
      actionUrl: "mailto:support@ocalabusinessdirectory.com",
      errorCode: apiResponse.errorCode || "NOT_CONFIGURED",
    };
  }

  // API error
  if (!apiResponse.ok) {
    const errorCode = apiResponse.errorCode || "UNKNOWN_ERROR";
    
    if (errorCode === "UNAUTHORIZED" || errorCode === "PREMIUM_REQUIRED") {
      return {
        status: "NOT_CONNECTED",
        message: "Please sign in and ensure you have premium access.",
        actionLabel: "Sign In",
        actionUrl: "/login",
        errorCode,
      };
    }

    if (errorCode === "DB_ERROR") {
      return {
        status: "ERROR",
        message: "Unable to load connection status. Please try again later.",
        actionLabel: "Try Again",
        errorCode,
      };
    }

    return {
      status: "ERROR",
      message: apiResponse.errorMessage || "Unable to load connection status.",
      actionLabel: "Try Again",
      errorCode,
    };
  }

  // Check Facebook connection
  const facebook = apiResponse.facebook;
  if (!facebook?.connected) {
    return {
      status: "NOT_CONNECTED",
      message: "Facebook is not connected. Connect your account to get started.",
      actionLabel: "Connect Facebook",
    };
  }

  // Check for Meta API errors
  if (metaError) {
    const errorCode = metaError.code || metaError.type || "UNKNOWN";
    
    // Token expired or invalid
    if (errorCode === "190" || errorCode.includes("expired") || errorCode.includes("invalid_token")) {
      return {
        status: "NEEDS_REAUTH",
        message: "Your Facebook connection has expired. Please reconnect to continue posting.",
        actionLabel: "Reconnect",
        errorCode,
        errorMessage: metaError.message,
      };
    }

    // Permissions revoked
    if (errorCode === "200" || errorCode === "10" || errorCode.includes("permission") || errorCode.includes("revoked")) {
      return {
        status: "ACCESS_REVOKED",
        message: "Facebook access has been revoked. Please reconnect to grant permissions again.",
        actionLabel: "Reconnect",
        errorCode,
        errorMessage: metaError.message,
      };
    }

    // Generic error
    return {
      status: "ERROR",
      message: "An error occurred with your Facebook connection. Please try reconnecting.",
      actionLabel: "Reconnect",
      errorCode,
      errorMessage: metaError.message,
    };
  }

  // Connected successfully
  if (facebook.connected && facebook.pagesAccessGranted) {
    return {
      status: "CONNECTED",
      message: `Connected to ${facebook.pageName || "Facebook Page"}`,
      actionLabel: "Disconnect",
    };
  }

  // Connected but needs pages access
  if (facebook.connected && !facebook.pagesAccessGranted) {
    return {
      status: "CONNECTED",
      message: "Connected. Enable Pages access to select a Page for posting.",
      actionLabel: "Enable Pages Access",
    };
  }

  // Fallback
  return {
    status: "CONNECTED",
    message: "Facebook is connected.",
    actionLabel: "Disconnect",
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

