/**
 * Meta (Facebook/Instagram) Publishing Service
 * 
 * Provides reusable functions for publishing to Facebook Pages and Instagram Business accounts.
 * Used by both manual test posts and scheduled post runners.
 * 
 * Security: Never logs tokens or raw provider responses.
 */

export interface MetaPublishResult {
  ok: boolean;
  providerPostId?: string;
  permalink?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Publishes a post to a Facebook Page.
 * 
 * @param pageId - Facebook Page ID
 * @param pageAccessToken - Page access token (long-lived)
 * @param message - Post caption/message text
 * @param imageUrl - Optional image URL to attach
 * @returns Publish result with post ID and permalink
 */
export async function publishToFacebookPage({
  pageId,
  pageAccessToken,
  message,
  imageUrl,
}: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  imageUrl?: string;
}): Promise<MetaPublishResult> {
  try {
    let postId: string | undefined;

    if (imageUrl) {
      // Upload photo first, then get post ID
      const photoResponse = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/photos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            url: imageUrl,
            caption: message,
            access_token: pageAccessToken,
          }),
        }
      );

      if (!photoResponse.ok) {
        const errorData = await photoResponse.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || "Failed to upload photo to Facebook";
        const errorCode = errorData.error?.code?.toString() || "UNKNOWN";
        
        return {
          ok: false,
          errorCode,
          errorMessage,
        };
      }

      const photoData = await photoResponse.json();
      postId = photoData.post_id || photoData.id;
    } else {
      // Text-only post
      const postResponse = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/feed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            message,
            access_token: pageAccessToken,
          }),
        }
      );

      if (!postResponse.ok) {
        const errorData = await postResponse.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || "Failed to post to Facebook";
        const errorCode = errorData.error?.code?.toString() || "UNKNOWN";
        
        return {
          ok: false,
          errorCode,
          errorMessage,
        };
      }

      const postData = await postResponse.json();
      postId = postData.id;
    }

    if (!postId) {
      return {
        ok: false,
        errorCode: "NO_POST_ID",
        errorMessage: "Facebook API did not return post ID",
      };
    }

    // Fetch permalink
    let permalink: string | undefined;
    try {
      const permalinkResponse = await fetch(
        `https://graph.facebook.com/v21.0/${postId}?fields=permalink_url&access_token=${pageAccessToken}`
      );
      if (permalinkResponse.ok) {
        const permalinkData = await permalinkResponse.json();
        permalink = permalinkData.permalink_url;
      }
    } catch {
      // Permalink fetch failed, but post succeeded - continue
    }

    return {
      ok: true,
      providerPostId: postId,
      permalink,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error publishing to Facebook";
    return {
      ok: false,
      errorCode: "EXCEPTION",
      errorMessage,
    };
  }
}

/**
 * Publishes a post to an Instagram Business account.
 * 
 * @param igBusinessId - Instagram Business Account ID
 * @param accessToken - Page access token (works for IG Business accounts)
 * @param caption - Post caption text
 * @param imageUrl - Image URL (required for Instagram)
 * @returns Publish result with post ID and permalink
 */
export async function publishToInstagram({
  igBusinessId,
  accessToken,
  caption,
  imageUrl,
}: {
  igBusinessId: string;
  accessToken: string;
  caption: string;
  imageUrl: string;
}): Promise<MetaPublishResult> {
  try {
    // Step 1: Create media container
    const createContainerResponse = await fetch(
      `https://graph.facebook.com/v21.0/${igBusinessId}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          image_url: imageUrl,
          caption,
          access_token: accessToken,
        }),
      }
    );

    if (!createContainerResponse.ok) {
      const errorData = await createContainerResponse.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || "Failed to create Instagram media container";
      const errorCode = errorData.error?.code?.toString() || "UNKNOWN";
      
      // Check for common errors
      let userFriendlyError = errorMessage;
      if (errorMessage.includes("permission") || errorMessage.includes("access")) {
        userFriendlyError = "Missing permissions or account not linked to Page";
      } else if (errorMessage.includes("Business") || errorMessage.includes("Creator")) {
        userFriendlyError = "Instagram account not Business/Creator or not linked to Page";
      }

      return {
        ok: false,
        errorCode,
        errorMessage: userFriendlyError,
      };
    }

    const containerData = await createContainerResponse.json();
    const creationId = containerData.id;

    if (!creationId) {
      return {
        ok: false,
        errorCode: "NO_CREATION_ID",
        errorMessage: "Instagram API did not return creation ID",
      };
    }

    // Step 2: Publish the container
    const publishResponse = await fetch(
      `https://graph.facebook.com/v21.0/${igBusinessId}/media_publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          creation_id: creationId,
          access_token: accessToken,
        }),
      }
    );

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || "Failed to publish Instagram post";
      const errorCode = errorData.error?.code?.toString() || "UNKNOWN";
      
      return {
        ok: false,
        errorCode,
        errorMessage,
      };
    }

    const publishData = await publishResponse.json();
    const postId = publishData.id;

    if (!postId) {
      return {
        ok: false,
        errorCode: "NO_POST_ID",
        errorMessage: "Instagram API did not return post ID",
      };
    }

    // Fetch permalink
    let permalink: string | undefined;
    try {
      const permalinkResponse = await fetch(
        `https://graph.facebook.com/v21.0/${postId}?fields=permalink&access_token=${accessToken}`
      );
      if (permalinkResponse.ok) {
        const permalinkData = await permalinkResponse.json();
        permalink = permalinkData.permalink;
      }
    } catch {
      // Permalink fetch failed, but post succeeded - continue
    }

    // Fallback to constructing permalink from post ID if API doesn't return it
    if (!permalink && postId) {
      permalink = `https://www.instagram.com/p/${postId}/`;
    }

    return {
      ok: true,
      providerPostId: postId,
      permalink,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error publishing to Instagram";
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
    "access_denied",
    "invalid_token",
    "expired_token",
    "invalid_user_id",
    "not found",
    "business",
    "creator", // Account type errors
  ];

  for (const pattern of permanentPatterns) {
    if (code.includes(pattern) || message.includes(pattern)) {
      return false;
    }
  }

  // Temporary errors (retry)
  const temporaryPatterns = [
    "rate",
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

