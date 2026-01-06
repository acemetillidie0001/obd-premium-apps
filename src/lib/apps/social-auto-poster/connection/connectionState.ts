/**
 * Connection State Mapping (Tier 5A)
 * 
 * Centralized mapping that converts raw platform status responses/errors
 * into normalized UI states with calm, trust-safe messaging.
 * 
 * This is the single source of truth for connection state interpretation.
 */

export type ConnectionUIState = 
  | "connected"
  | "limited"
  | "pending"
  | "disabled"
  | "error";

export interface ConnectionUIModel {
  state: ConnectionUIState;
  badgeLabel: string;
  message: string;
  detail?: string; // Optional debugging details (e.g., original error string)
}

/**
 * Connection state messages (Tier 5A - calm, trust-safe)
 */
const STATE_MESSAGES: Record<ConnectionUIState, { badgeLabel: string; message: string }> = {
  connected: {
    badgeLabel: "Connected",
    message: "Accounts connected and ready to publish.",
  },
  limited: {
    badgeLabel: "Limited Mode",
    message: "You can generate, approve, and queue posts. Publishing will activate automatically once approved.",
  },
  pending: {
    badgeLabel: "API Pending",
    message: "Facebook & Instagram posting is temporarily unavailable while Meta completes app review.",
  },
  disabled: {
    badgeLabel: "Disabled",
    message: "Connect accounts to enable publishing.",
  },
  error: {
    badgeLabel: "Error",
    message: "We couldn't verify connection status right now. Try again.",
  },
};

/**
 * Get connection UI model from raw API response
 * 
 * @param apiResponse - Raw API response from connection status endpoint
 * @param metaError - Optional Meta API error details
 * @param publishingEnabled - Whether Meta publishing is enabled via feature flag
 * @returns Normalized ConnectionUIModel
 */
export function getConnectionUIModel(
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
  } | null,
  metaError?: {
    code?: string;
    message?: string;
    type?: string;
  } | null,
  publishingEnabled: boolean = false
): ConnectionUIModel {
  // Safety: Handle null/undefined
  if (!apiResponse) {
    return {
      state: "error",
      ...STATE_MESSAGES.error,
      detail: "No API response received",
    };
  }

  // Not configured - treat as disabled (setup issue, not user error)
  if (!apiResponse.configured) {
    return {
      state: "disabled",
      ...STATE_MESSAGES.disabled,
      detail: apiResponse.errorCode || "NOT_CONFIGURED",
    };
  }

  // API error states
  if (apiResponse.ok === false) {
    const errorCode = apiResponse.errorCode || "UNKNOWN_ERROR";
    const errorMessage = apiResponse.errorMessage || "";

    // Not configured - setup issue
    if (errorCode === "META_NOT_CONFIGURED") {
      return {
        state: "disabled",
        ...STATE_MESSAGES.disabled,
        detail: errorCode,
      };
    }

    // Database error - real error state
    if (errorCode === "DB_ERROR") {
      return {
        state: "error",
        ...STATE_MESSAGES.error,
        detail: errorCode,
      };
    }

    // Unauthorized/Premium required - treat as disabled (user needs to connect)
    if (errorCode === "UNAUTHORIZED" || errorCode === "PREMIUM_REQUIRED") {
      return {
        state: "disabled",
        ...STATE_MESSAGES.disabled,
        detail: errorCode,
      };
    }

    // Generic error - preserve original error message in detail
    return {
      state: "error",
      ...STATE_MESSAGES.error,
      detail: errorMessage || errorCode,
    };
  }

  // Check Facebook connection
  const facebook = apiResponse.facebook;
  if (!facebook?.connected) {
    return {
      state: "disabled",
      ...STATE_MESSAGES.disabled,
    };
  }

  // Check for Meta API errors
  if (metaError) {
    const errorCode = metaError.code || metaError.type || "UNKNOWN";
    const errorMessage = metaError.message || "";

    // Token expired or invalid - needs reauth (treat as disabled)
    if (errorCode === "190" || errorCode.includes("expired") || errorCode.includes("invalid_token")) {
      return {
        state: "disabled",
        ...STATE_MESSAGES.disabled,
        detail: `Token expired: ${errorMessage}`,
      };
    }

    // Permissions revoked - needs reauth (treat as disabled)
    if (errorCode === "200" || errorCode === "10" || errorCode.includes("permission") || errorCode.includes("revoked")) {
      return {
        state: "disabled",
        ...STATE_MESSAGES.disabled,
        detail: `Access revoked: ${errorMessage}`,
      };
    }

    // Generic Meta API error - preserve in detail
    return {
      state: "error",
      ...STATE_MESSAGES.error,
      detail: errorMessage || errorCode,
    };
  }

  // Check publishing status
  if (apiResponse.publishing && !apiResponse.publishing.enabled) {
    const reason = apiResponse.publishing.reasonIfDisabled || "";
    // If disabled due to app review, show pending state
    if (reason.toLowerCase().includes("app review") || reason.toLowerCase().includes("meta review")) {
      return {
        state: "pending",
        ...STATE_MESSAGES.pending,
        detail: reason,
      };
    }
  }

  // Connected successfully with publishing enabled
  if (publishingEnabled && facebook.connected && facebook.pagesAccessGranted) {
    return {
      state: "connected",
      ...STATE_MESSAGES.connected,
    };
  }

  // Connected but needs pages access - limited mode
  if (facebook.connected && !facebook.pagesAccessGranted) {
    return {
      state: "limited",
      ...STATE_MESSAGES.limited,
      detail: "Pages access not granted",
    };
  }

  // Connected but publishing not enabled via feature flag - limited mode
  if (!publishingEnabled && facebook.connected) {
    return {
      state: "limited",
      ...STATE_MESSAGES.limited,
    };
  }

  // Connected but unclear state - default to limited
  if (facebook.connected) {
    return {
      state: "limited",
      ...STATE_MESSAGES.limited,
    };
  }

  // Final fallback - disabled
  return {
    state: "disabled",
    ...STATE_MESSAGES.disabled,
  };
}

