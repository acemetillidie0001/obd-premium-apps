/**
 * Maps Meta (Facebook/Instagram) API errors to user-friendly messages
 */

export interface MetaErrorMapping {
  message: string;
  action?: string;
}

/**
 * Maps Meta error codes/messages to user-friendly error messages
 */
export function mapMetaError(errorCode: string | null, errorMessage: string | null): MetaErrorMapping {
  const code = (errorCode || "").toLowerCase();
  const message = (errorMessage || "").toLowerCase();

  // Missing scopes / insufficient permissions
  if (code.includes("missing_scopes") || code.includes("insufficient_scope") || 
      message.includes("permission") && message.includes("required")) {
    return {
      message: "Permissions not granted. Disconnect and reconnect, ensuring you approve all requested permissions.",
      action: "Disconnect and reconnect your Meta account",
    };
  }

  // Not page admin
  if (code.includes("not_page_admin") || message.includes("not an admin") || 
      message.includes("must be an admin")) {
    return {
      message: "You must be an admin of at least one Facebook Page to post.",
      action: "Ensure you are an admin of a Facebook Page",
    };
  }

  // Instagram not linked
  if (code.includes("ig_not_linked") || message.includes("instagram") && 
      (message.includes("not linked") || message.includes("not connected"))) {
    return {
      message: "Instagram must be a Business/Creator account connected to your selected Facebook Page.",
      action: "Link your Instagram Business account to your Facebook Page",
    };
  }

  // Instagram publishing not allowed
  if (code.includes("ig_publish_not_allowed") || 
      (message.includes("instagram") && message.includes("publish") && message.includes("not allowed")) ||
      (message.includes("business") && message.includes("required"))) {
    return {
      message: "Instagram publishing requires a Business account and content publishing permissions.",
      action: "Convert your Instagram account to Business and ensure publishing permissions are granted",
    };
  }

  // Token expired
  if (code.includes("token_expired") || code.includes("invalid_token") || 
      message.includes("token") && (message.includes("expired") || message.includes("invalid"))) {
    return {
      message: "Token expired. Please reconnect.",
      action: "Disconnect and reconnect your Meta account",
    };
  }

  // Rate limited
  if (code.includes("rate_limited") || code.includes("rate_limit") || 
      message.includes("rate limit") || message.includes("too many requests")) {
    return {
      message: "Temporary rate limit. Try again in a few minutes.",
      action: "Wait a few minutes and try again",
    };
  }

  // Generic fallback
  return {
    message: errorMessage || errorCode || "An error occurred. Please try again.",
  };
}

/**
 * Maps callback error codes to user-friendly messages
 */
export function mapCallbackError(errorCode: string): string {
  const errorMap: Record<string, string> = {
    unauthorized: "Please sign in again.",
    premium_required: "Premium access is required to connect Meta accounts.",
    missing_params: "OAuth callback missing required parameters. Please try again.",
    invalid_state: "Security validation failed. Please try connecting again.",
    not_configured: "Meta connection not configured. Please contact support.",
    token_exchange_failed: "Failed to authenticate with Meta. Please try again.",
    no_access_token: "Authentication failed. Please try again.",
    pages_fetch_failed: "Unable to fetch your Facebook Pages. Please ensure you have at least one Page.",
    no_pages: "You must be an admin of at least one Facebook Page to use this feature.",
    no_page_token: "Unable to get page permissions. Please ensure you granted all requested permissions.",
    callback_failed: "Connection failed. Please try again.",
    access_denied: "You denied access to the required permissions. Please try again and approve all requested permissions.",
    invalid_request: "Invalid OAuth request. Please try connecting again.",
  };

  return errorMap[errorCode] || `Connection failed: ${errorCode}. Please try again.`;
}

