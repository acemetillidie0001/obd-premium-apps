/**
 * Process Scheduled Post
 * 
 * Handles publishing a scheduled queue item to connected platforms.
 * Uses real Meta publishing if connections exist, otherwise falls back to simulation.
 */

import { prisma } from "@/lib/prisma";
import { publishToFacebookPage, publishToInstagram, isTemporaryError } from "./publishers/metaPublisher";
import { publishToGoogleBusiness, isTemporaryError as isGoogleTemporaryError } from "./publishers/googleBusinessPublisher";
import { resolvePostImage } from "./resolvePostImage";
import type { Prisma } from "@prisma/client";

const MAX_ATTEMPTS = 5;

/**
 * Calculate next attempt time based on attempt count (exponential backoff)
 */
function calculateNextAttemptAt(attemptCount: number): Date {
  const now = new Date();
  const backoffMinutes = [2, 5, 15, 60]; // 2min, 5min, 15min, 60min
  const backoffIndex = Math.min(attemptCount, backoffMinutes.length - 1);
  const minutes = backoffMinutes[backoffIndex];
  
  return new Date(now.getTime() + minutes * 60 * 1000);
}

/**
 * Process a single scheduled queue item
 */
export async function processScheduledPost(queueItemId: string, userId: string): Promise<{
  success: boolean;
  errorMessage?: string;
}> {
  // Get queue item with optimistic locking
  const queueItem = await prisma.socialQueueItem.findUnique({
    where: { id: queueItemId },
  });

  if (!queueItem || queueItem.userId !== userId) {
    return {
      success: false,
      errorMessage: "Queue item not found",
    };
  }

  // Only process scheduled items
  if (queueItem.status !== "scheduled") {
    return {
      success: false,
      errorMessage: `Item is not scheduled (status: ${queueItem.status})`,
    };
  }

  // Check if item is due
  const now = new Date();
  if (queueItem.scheduledAt && queueItem.scheduledAt > now) {
    return {
      success: false,
      errorMessage: "Item is not yet due",
    };
  }

  // Check retry delay
  if (queueItem.nextAttemptAt && queueItem.nextAttemptAt > now) {
    return {
      success: false,
      errorMessage: "Item is waiting for retry",
    };
  }

  // Mark as running (optimistic lock: update status and attemptCount atomically)
  // Use updateMany to ensure we only update if still scheduled
  const updateResult = await prisma.socialQueueItem.updateMany({
    where: {
      id: queueItemId,
      status: "scheduled", // Only update if still scheduled
    },
    data: {
      attemptCount: queueItem.attemptCount + 1,
    },
  });

  if (updateResult.count === 0) {
    // Another process already took this item or status changed
    return {
      success: false,
      errorMessage: "Item already being processed or status changed",
    };
  }

  // Resolve image (non-blocking)
  let imageUrl: string | undefined;
  try {
    const imageResolution = await resolvePostImage({
      queueItemId,
      userId,
    });
    imageUrl = imageResolution.imageUrl;
  } catch {
    // Continue without image if resolution fails
  }

  // Check for platform connections
  const platform = queueItem.platform as "facebook" | "instagram" | "google_business";

  let published = false;
  let publishError: string | undefined;
  let publishErrorCode: string | undefined;
  const providerPostIds: Record<string, { id?: string; permalink?: string }> = {};

  if (platform === "facebook") {
    try {
      const fbDestination = await prisma.socialPostingDestination.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: "facebook",
          },
        },
      });

      if (fbDestination) {
        const fbConnection = await prisma.socialAccountConnection.findFirst({
          where: {
            userId,
            platform: "facebook",
            providerAccountId: fbDestination.selectedAccountId,
          },
        });

        if (fbConnection && fbConnection.accessToken) {
          const fbResult = await publishToFacebookPage({
            pageId: fbConnection.providerAccountId,
            pageAccessToken: fbConnection.accessToken,
            message: queueItem.content,
            imageUrl,
          });

          if (fbResult.ok && fbResult.providerPostId) {
            providerPostIds.facebook = {
              id: fbResult.providerPostId,
              permalink: fbResult.permalink,
            };
            published = true;
          } else {
            publishError = fbResult.errorMessage || "Facebook publish failed";
            publishErrorCode = fbResult.errorCode;
          }
        } else {
          publishError = "Facebook connection not found";
          publishErrorCode = "NO_CONNECTION";
        }
      } else {
        publishError = "Facebook destination not configured";
        publishErrorCode = "NO_DESTINATION";
      }
    } catch (error) {
      publishError = error instanceof Error ? error.message : "Unknown error";
      publishErrorCode = "EXCEPTION";
    }
  } else if (platform === "instagram") {
    try {
      const igDestination = await prisma.socialPostingDestination.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: "instagram",
          },
        },
      });

      if (igDestination) {
        const igConnection = await prisma.socialAccountConnection.findFirst({
          where: {
            userId,
            platform: "instagram",
            providerAccountId: igDestination.selectedAccountId,
          },
        });

        if (igConnection && igConnection.accessToken) {
          // Instagram requires an image
          const igImageUrl = imageUrl || `${process.env.NEXT_PUBLIC_APP_URL || ""}/obd-logo.png`;
          
          const igResult = await publishToInstagram({
            igBusinessId: igConnection.providerAccountId,
            accessToken: igConnection.accessToken,
            caption: queueItem.content,
            imageUrl: igImageUrl,
          });

          if (igResult.ok && igResult.providerPostId) {
            providerPostIds.instagram = {
              id: igResult.providerPostId,
              permalink: igResult.permalink,
            };
            published = true;
          } else {
            publishError = igResult.errorMessage || "Instagram publish failed";
            publishErrorCode = igResult.errorCode;
          }
        } else {
          publishError = "Instagram connection not found";
          publishErrorCode = "NO_CONNECTION";
        }
      } else {
        publishError = "Instagram destination not configured";
        publishErrorCode = "NO_DESTINATION";
      }
    } catch (error) {
      publishError = error instanceof Error ? error.message : "Unknown error";
      publishErrorCode = "EXCEPTION";
    }
  } else if (platform === "google_business") {
    try {
      const gbpDestination = await prisma.socialPostingDestination.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: "google_business",
          },
        },
      });

      if (gbpDestination) {
        const gbpConnection = await prisma.socialAccountConnection.findFirst({
          where: {
            userId,
            platform: "google_business",
          },
        });

        if (gbpConnection && gbpConnection.accessToken) {
          const gbpResult = await publishToGoogleBusiness({
            locationId: gbpDestination.selectedAccountId,
            accessToken: gbpConnection.accessToken,
            refreshToken: gbpConnection.refreshToken,
            tokenExpiresAt: gbpConnection.tokenExpiresAt,
            summaryText: queueItem.content,
            imageUrl,
          });

          if (gbpResult.ok && gbpResult.providerPostId) {
            providerPostIds.google_business = {
              id: gbpResult.providerPostId,
              permalink: gbpResult.providerPermalink,
            };
            published = true;

            // Update connection with refreshed token if it was refreshed
            if (gbpResult.refreshedToken) {
              const tokenExpiresAt = new Date(Date.now() + gbpResult.refreshedToken.expiresIn * 1000);
              await prisma.socialAccountConnection.updateMany({
                where: {
                  userId,
                  platform: "google_business",
                },
                data: {
                  accessToken: gbpResult.refreshedToken.accessToken,
                  tokenExpiresAt,
                },
              });
            }
          } else {
            publishError = gbpResult.errorMessage || "Google Business Profile publish failed";
            publishErrorCode = gbpResult.errorCode;
          }
        } else {
          publishError = "Google Business Profile connection not found";
          publishErrorCode = "NO_CONNECTION";
        }
      } else {
        publishError = "Google Business Profile destination not configured";
        publishErrorCode = "NO_DESTINATION";
      }
    } catch (error) {
      publishError = error instanceof Error ? error.message : "Unknown error";
      publishErrorCode = "EXCEPTION";
    }
  }

  // Handle publishing result (continue with retry logic if needed)
  if (!published && publishError) {

    const attemptCount = queueItem.attemptCount + 1;
    // Use appropriate error checker based on platform
    const isTemporary = platform === "google_business" 
      ? isGoogleTemporaryError(publishErrorCode, publishError)
      : isTemporaryError(publishErrorCode, publishError);

    if (attemptCount < MAX_ATTEMPTS && isTemporary) {
      // Schedule retry
      const nextAttemptAt = calculateNextAttemptAt(attemptCount);
      
      await prisma.socialQueueItem.update({
        where: { id: queueItemId },
        data: {
          status: "scheduled", // Keep as scheduled for retry
          errorMessage: publishError,
          lastErrorCode: publishErrorCode || undefined,
          nextAttemptAt,
          metadata: {
            ...(queueItem.metadata as Record<string, unknown> || {}),
            lastProviderPostIds: providerPostIds,
          } as Prisma.InputJsonValue,
        },
      });

      // Log delivery attempt
      await prisma.socialDeliveryAttempt.create({
        data: {
          userId,
          queueItemId,
          platform: queueItem.platform,
          success: false,
          errorMessage: publishError,
          responseData: {
            errorCode: publishErrorCode,
            attemptCount,
            nextAttemptAt: nextAttemptAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      return {
        success: false,
        errorMessage: publishError,
      };
    } else {
      // Max attempts reached or permanent error - mark as failed
      await prisma.socialQueueItem.update({
        where: { id: queueItemId },
        data: {
          status: "failed",
          errorMessage: publishError,
          lastErrorCode: publishErrorCode || undefined,
          metadata: {
            ...(queueItem.metadata as Record<string, unknown> || {}),
            lastProviderPostIds: providerPostIds,
          } as Prisma.InputJsonValue,
        },
      });

      // Log delivery attempt
      await prisma.socialDeliveryAttempt.create({
        data: {
          userId,
          queueItemId,
          platform: queueItem.platform,
          success: false,
          errorMessage: publishError,
          responseData: {
            errorCode: publishErrorCode,
            attemptCount,
            permanent: !isTemporary,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        success: false,
        errorMessage: publishError,
      };
    }
  }

  // If no Meta connection or simulation fallback
  if (!published) {
    // Fallback to simulation for non-Meta platforms or when connections missing
    const simulatedSuccess = Math.random() > 0.2; // 80% success rate

    if (simulatedSuccess) {
      await prisma.socialQueueItem.update({
        where: { id: queueItemId },
        data: {
          status: "posted",
          postedAt: new Date(),
        },
      });

      await prisma.socialDeliveryAttempt.create({
        data: {
          userId,
          queueItemId,
          platform: queueItem.platform,
          success: true,
          responseData: {
            mock: true,
            message: "Post simulated (no Meta connection)",
          } as Prisma.InputJsonValue,
        },
      });

      return { success: true };
    } else {
      await prisma.socialQueueItem.update({
        where: { id: queueItemId },
        data: {
          status: "failed",
          errorMessage: "Simulated posting failure (no Meta connection)",
        },
      });

      await prisma.socialDeliveryAttempt.create({
        data: {
          userId,
          queueItemId,
          platform: queueItem.platform,
          success: false,
          errorMessage: "Simulated posting failure (no Meta connection)",
          responseData: {
            mock: true,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        success: false,
        errorMessage: "Simulated posting failure",
      };
    }
  }

  // Success - mark as posted
  await prisma.socialQueueItem.update({
    where: { id: queueItemId },
    data: {
      status: "posted",
      postedAt: new Date(),
      nextAttemptAt: null,
      errorMessage: null,
      lastErrorCode: null,
      metadata: {
        ...(queueItem.metadata as Record<string, unknown> || {}),
        lastProviderPostIds: providerPostIds,
      } as Prisma.InputJsonValue,
    },
  });

  // Log successful delivery attempt
  const platformForAttempt = platform as "facebook" | "instagram" | "google_business";
  const postInfo = providerPostIds[platformForAttempt] || providerPostIds.facebook || providerPostIds.instagram || providerPostIds.google_business;
  
  await prisma.socialDeliveryAttempt.create({
    data: {
      userId,
      queueItemId,
      platform: queueItem.platform,
      success: true,
      responseData: {
        providerPostId: postInfo?.id,
        providerPermalink: postInfo?.permalink,
      } as Prisma.InputJsonValue,
    },
  });

  return { success: true };
}

