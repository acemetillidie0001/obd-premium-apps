/**
 * OBD Brand-Safe Image Generator - Request Timeline Helper
 * 
 * Provides querying helper to fetch request timeline for debugging.
 */

import { prisma } from "@/lib/prisma";

export interface ImageRequestTimeline {
  request: {
    requestId: string;
    status: string;
    platform: string;
    category: string;
    imageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  events: Array<{
    id: string;
    type: string;
    ok: boolean;
    messageSafe: string | null;
    data: unknown;
    createdAt: Date;
  }>;
}

/**
 * Fetches ImageRequest and all associated ImageEvents ordered by creation time.
 * 
 * Used for debugging and audit purposes.
 * 
 * @param requestId - The ImageRequest requestId
 * @returns Request timeline with events ordered ascending by createdAt
 */
export async function getImageRequestTimeline(
  requestId: string
): Promise<ImageRequestTimeline | null> {
  const request = await prisma.imageRequest.findUnique({
    where: { requestId },
    select: {
      requestId: true,
      status: true,
      platform: true,
      category: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!request) {
    return null;
  }

  const events = await prisma.imageEvent.findMany({
    where: { requestId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      ok: true,
      messageSafe: true,
      data: true,
      createdAt: true,
    },
  });

  return {
    request: {
      requestId: request.requestId,
      status: request.status,
      platform: request.platform,
      category: request.category,
      imageUrl: request.imageUrl,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    },
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      ok: event.ok,
      messageSafe: event.messageSafe,
      data: event.data,
      createdAt: event.createdAt,
    })),
  };
}

