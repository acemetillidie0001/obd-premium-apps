/**
 * Google Business Profile Publishing Service
 * 
 * Provides reusable functions for publishing to Google Business Profile locations.
 * Used by both manual test posts and scheduled post runners.
 * 
 * Security: Never logs tokens or raw provider responses.
 * 
 * Required Scopes:
 * - https://www.googleapis.com/auth/business.manage
 * - https://www.googleapis.com/auth/plus.business.manage (deprecated but may be needed)
 */

export interface GoogleBusinessLocation {
  id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  websiteUri?: string;
  metadata?: Record<string, unknown>;
}

export interface GoogleBusinessPublishResult {
  ok: boolean;
  providerPostId?: string;
  providerPermalink?: string;
  errorCode?: string;
  errorMessage?: string;
  refreshedToken?: {
    accessToken: string;
    expiresIn: number;
  };
}

/**
 * Refreshes an expired Google OAuth access token using the refresh token.
 * 
 * @param refreshToken - Google refresh token
 * @returns New access token and expiration time
 */
async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("[GBP] Missing Google OAuth credentials for token refresh");
      return null;
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[GBP] Token refresh failed:", errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600, // Default to 1 hour
    };
  } catch (error) {
    console.error("[GBP] Token refresh exception:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

/**
 * Gets a valid access token, refreshing if necessary.
 * 
 * @param accessToken - Current access token
 * @param refreshToken - Refresh token
 * @param tokenExpiresAt - Token expiration time
 * @returns Valid access token or null if refresh fails
 */
async function getValidAccessToken(
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: Date | null
): Promise<string | null> {
  // Check if token is expired or expiring soon (within 5 minutes)
  const now = new Date();
  const expiresAt = tokenExpiresAt ? new Date(tokenExpiresAt) : null;
  const expiresSoon = expiresAt && expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

  if (!expiresAt || expiresSoon) {
    // Token expired or expiring soon, try to refresh
    if (!refreshToken) {
      console.error("[GBP] Token expired and no refresh token available");
      return null;
    }

    const refreshed = await refreshGoogleToken(refreshToken);
    if (!refreshed) {
      return null;
    }

    return refreshed.accessToken;
  }

  return accessToken;
}

/**
 * Lists all Google Business Profile locations for a connected account.
 * 
 * @param accessToken - Google OAuth access token
 * @param refreshToken - Google OAuth refresh token
 * @param tokenExpiresAt - Token expiration time
 * @returns List of business locations
 */
export async function listBusinessLocations({
  accessToken,
  refreshToken,
  tokenExpiresAt,
}: {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<{
  ok: boolean;
  locations?: GoogleBusinessLocation[];
  errorCode?: string;
  errorMessage?: string;
}> {
  try {
    // Get valid access token (refresh if needed)
    const validToken = await getValidAccessToken(accessToken, refreshToken, tokenExpiresAt);
    if (!validToken) {
      return {
        ok: false,
        errorCode: "TOKEN_EXPIRED",
        errorMessage: "Token expired and refresh failed. Please reconnect.",
      };
    }

    // Fetch account info first to get account name
    const accountResponse = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    );

    if (!accountResponse.ok) {
      if (accountResponse.status === 401) {
        return {
          ok: false,
          errorCode: "TOKEN_EXPIRED",
          errorMessage: "Token expired. Please reconnect.",
        };
      }

      const errorData = await accountResponse.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || "Failed to fetch Google Business account";
      
      return {
        ok: false,
        errorCode: "ACCOUNT_FETCH_FAILED",
        errorMessage,
      };
    }

    const accountData = await accountResponse.json();
    const accounts = accountData.accounts || [];

    if (accounts.length === 0) {
      return {
        ok: false,
        errorCode: "NO_ACCOUNTS",
        errorMessage: "No Google Business accounts found.",
      };
    }

    // Use the first account (most users have one)
    const accountName = accounts[0].name;

    // Fetch locations for this account
    const locationsResponse = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
      {
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    );

    if (!locationsResponse.ok) {
      if (locationsResponse.status === 401) {
        return {
          ok: false,
          errorCode: "TOKEN_EXPIRED",
          errorMessage: "Token expired. Please reconnect.",
        };
      }

      const errorData = await locationsResponse.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || "Failed to fetch locations";
      
      return {
        ok: false,
        errorCode: "LOCATIONS_FETCH_FAILED",
        errorMessage,
      };
    }

    const locationsData = await locationsResponse.json();
    const locations = (locationsData.locations || []).map((loc: any) => ({
      id: loc.name?.split("/").pop() || loc.name || "",
      name: loc.title || loc.storefrontAddress?.addressLines?.[0] || "Unnamed Location",
      address: loc.storefrontAddress?.addressLines?.join(", "),
      phoneNumber: loc.primaryPhone,
      websiteUri: loc.websiteUri,
      metadata: {
        locationName: loc.name,
        languageCode: loc.languageCode,
        category: loc.category,
      },
    }));

    if (locations.length === 0) {
      return {
        ok: false,
        errorCode: "NO_LOCATIONS",
        errorMessage: "No business locations found. Please add a location in Google Business Profile.",
      };
    }

    return {
      ok: true,
      locations,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error listing locations";
    return {
      ok: false,
      errorCode: "EXCEPTION",
      errorMessage,
    };
  }
}

/**
 * Publishes a post to a Google Business Profile location.
 * 
 * @param locationId - Google Business Profile location ID
 * @param accessToken - Google OAuth access token
 * @param refreshToken - Google OAuth refresh token
 * @param tokenExpiresAt - Token expiration time
 * @param summaryText - Post summary text (required, max 1500 chars)
 * @param imageUrl - Optional image URL to attach
 * @returns Publish result with post ID and permalink
 */
export async function publishToGoogleBusiness({
  locationId,
  accessToken,
  refreshToken,
  tokenExpiresAt,
  summaryText,
  imageUrl,
}: {
  locationId: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  summaryText: string;
  imageUrl?: string;
}): Promise<GoogleBusinessPublishResult> {
  try {
    // Get valid access token (refresh if needed)
    let validToken = await getValidAccessToken(accessToken, refreshToken, tokenExpiresAt);
    if (!validToken) {
      return {
        ok: false,
        errorCode: "TOKEN_EXPIRED",
        errorMessage: "Token expired and refresh failed. Please reconnect.",
      };
    }

    // Build post payload
    const postPayload: any = {
      summary: summaryText.substring(0, 1500), // GBP limit is 1500 chars
      callToAction: {
        actionType: "LEARN_MORE",
        url: process.env.NEXT_PUBLIC_APP_URL || "https://apps.ocalabusinessdirectory.com",
      },
    };

    // Add media if image URL provided
    if (imageUrl) {
      postPayload.media = {
        mediaFormat: "PHOTO",
        sourceUrl: imageUrl,
      };
    }

    // Publish post
    const locationName = `locations/${locationId}`;
    let response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}/localPosts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postPayload),
      }
    );

    // Track if token was refreshed
    let refreshedTokenInfo: { accessToken: string; expiresIn: number } | undefined;

    // If 401, try refreshing token once and retry
    if (response.status === 401 && refreshToken) {
      const refreshed = await refreshGoogleToken(refreshToken);
      if (refreshed) {
        validToken = refreshed.accessToken;
        refreshedTokenInfo = refreshed;
        response = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}/localPosts`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${validToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(postPayload),
          }
        );
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || "Failed to publish to Google Business Profile";
      const errorCode = errorData.error?.code?.toString() || "UNKNOWN";

      // Map common errors to user-friendly messages
      let userFriendlyError = errorMessage;
      if (errorMessage.includes("insufficient") || errorMessage.includes("permission")) {
        userFriendlyError = "Missing required permissions. Please reconnect and approve all requested permissions.";
      } else if (errorMessage.includes("not verified") || errorMessage.includes("restricted")) {
        userFriendlyError = "Business location not verified or account restricted. Please verify your location in Google Business Profile.";
      } else if (errorMessage.includes("rate") || errorMessage.includes("quota")) {
        userFriendlyError = "Rate limit exceeded. Please try again in a few minutes.";
      }

      return {
        ok: false,
        errorCode,
        errorMessage: userFriendlyError,
      };
    }

    const postData = await response.json();
    const postId = postData.name?.split("/").pop() || postData.name || "";

    if (!postId) {
      return {
        ok: false,
        errorCode: "NO_POST_ID",
        errorMessage: "Google Business Profile API did not return post ID",
      };
    }

    // Construct permalink (GBP posts don't have direct permalinks, but we can link to the location)
    const providerPermalink = `https://www.google.com/maps/place/?q=place_id:${locationId}`;

    return {
      ok: true,
      providerPostId: postId,
      providerPermalink,
      refreshedToken: refreshedTokenInfo,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error publishing to Google Business Profile";
    return {
      ok: false,
      errorCode: "EXCEPTION",
      errorMessage,
    };
  }
}

/**
 * Determines if an error is temporary and should be retried.
 */
export function isTemporaryError(errorCode?: string, errorMessage?: string): boolean {
  if (!errorCode && !errorMessage) {
    return true; // Unknown errors, treat as temporary for first attempts
  }

  const code = errorCode?.toString().toLowerCase() || "";
  const message = errorMessage?.toLowerCase() || "";

  // Permanent errors (don't retry)
  const permanentPatterns = [
    "permission",
    "insufficient",
    "invalid_token",
    "token_expired",
    "not verified",
    "restricted",
    "no_locations",
    "no_accounts",
  ];

  for (const pattern of permanentPatterns) {
    if (code.includes(pattern) || message.includes(pattern)) {
      return false;
    }
  }

  // Temporary errors (retry)
  const temporaryPatterns = [
    "rate",
    "quota",
    "limit",
    "temporarily",
    "unavailable",
    "timeout",
    "network",
    "500",
    "502",
    "503",
    "504",
  ];

  for (const pattern of temporaryPatterns) {
    if (code.includes(pattern) || message.includes(pattern)) {
      return true;
    }
  }

  // Default: treat as temporary for retry attempts
  return true;
}

