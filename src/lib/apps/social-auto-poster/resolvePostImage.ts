/**
 * OBD Social Auto-Poster - Post Image Resolution
 * 
 * Resolves final image URL and alt text for posting.
 * Priority: queue item imageUrl -> ImageRequest imageUrl -> none
 * Never throws - always returns a result (may be "none").
 */

import { prisma } from "@/lib/prisma";

export interface ResolvePostImageResult {
  source: "queue" | "engine" | "none";
  imageUrl?: string;
  altText?: string;
  provider?: string;
  storage?: string;
}

/**
 * Resolves the final image URL and alt text for posting.
 * 
 * Priority:
 * 1. SocialQueueItem.imageUrl if present
 * 2. ImageRequest.imageUrl via imageRequestId if present
 * 3. None (post without image)
 * 
 * @param params - Resolution parameters
 * @returns Image resolution result (never throws)
 */
export async function resolvePostImage(params: {
  queueItemId: string;
  userId: string;
}): Promise<ResolvePostImageResult> {
  const { queueItemId, userId } = params;

  try {
    // Fetch queue item and verify ownership
    const queueItem = await prisma.socialQueueItem.findUnique({
      where: { id: queueItemId },
      select: {
        id: true,
        userId: true,
        imageUrl: true,
        imageAltText: true,
        imageRequestId: true,
      },
    });

    if (!queueItem) {
      return { source: "none" };
    }

    // Verify ownership
    if (queueItem.userId !== userId) {
      return { source: "none" };
    }

    // Priority A: Use queue item imageUrl if present
    if (queueItem.imageUrl) {
      return {
        source: "queue",
        imageUrl: queueItem.imageUrl,
        altText: queueItem.imageAltText || undefined,
      };
    }

    // Priority B: Resolve from ImageRequest if imageRequestId exists
    if (queueItem.imageRequestId) {
      try {
        const imageRequest = await prisma.imageRequest.findUnique({
          where: { requestId: queueItem.imageRequestId },
          select: {
            imageUrl: true,
            altText: true,
            provider: true,
            storage: true,
          },
        });

        if (imageRequest?.imageUrl) {
          // Map ImageProvider enum to string for SocialQueueItem
          const providerString = imageRequest.provider
            ? String(imageRequest.provider)
            : undefined;

          // Map ImageStorage enum to string (if needed in future)
          const storageString = imageRequest.storage
            ? String(imageRequest.storage)
            : undefined;

          return {
            source: "engine",
            imageUrl: imageRequest.imageUrl,
            altText: imageRequest.altText || undefined,
            provider: providerString,
            storage: storageString,
          };
        }
      } catch (imageRequestError) {
        // Log but don't throw - continue without image
        console.warn(
          `[ResolvePostImage] Failed to fetch ImageRequest ${queueItem.imageRequestId}:`,
          imageRequestError
        );
      }
    }

    // Priority C: No image available
    return { source: "none" };
  } catch (error) {
    // Never throw - log and return none
    console.warn(`[ResolvePostImage] Error resolving image for ${queueItemId}:`, error);
    return { source: "none" };
  }
}

