import { prisma } from "@/lib/prisma";

const APP_ID = "ai-logo-generator";
const CONCEPTS_LIMIT = 20;
const IMAGES_LIMIT = 5;

/**
 * Get the current day key in YYYY-MM-DD format (UTC)
 */
function getDayKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get the reset time (start of next day in UTC)
 */
function getResetsAt(): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

export interface UsageCheckResult {
  allowed: boolean;
  conceptsUsed: number;
  imagesUsed: number;
  conceptsLimit: number;
  imagesLimit: number;
  resetsAt: string;
}

/**
 * Check if user can make a request (without incrementing)
 */
export async function checkUsage(
  userId: string
): Promise<UsageCheckResult> {
  const dayKey = getDayKey();
  
  const counter = await prisma.usageCounter.findUnique({
    where: {
      userId_appId_dayKey: {
        userId,
        appId: APP_ID,
        dayKey,
      },
    },
  });

  const conceptsUsed = counter?.conceptsCount ?? 0;
  const imagesUsed = counter?.imagesCount ?? 0;

  return {
    allowed: true, // Always return true for check (increment will enforce limits)
    conceptsUsed,
    imagesUsed,
    conceptsLimit: CONCEPTS_LIMIT,
    imagesLimit: IMAGES_LIMIT,
    resetsAt: getResetsAt(),
  };
}

export interface IncrementUsageOptions {
  userId: string;
  generateImages: boolean;
}

export interface IncrementUsageResult {
  allowed: boolean;
  conceptsUsed: number;
  imagesUsed: number;
  conceptsLimit: number;
  imagesLimit: number;
  resetsAt: string;
  message?: string;
}

/**
 * Atomically increment usage counters and check limits
 * Returns allowed=false if limit would be exceeded
 */
export async function incrementUsage(
  options: IncrementUsageOptions
): Promise<IncrementUsageResult> {
  const { userId, generateImages } = options;
  const dayKey = getDayKey();

  // Use a transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Get or create counter for today
    const counter = await tx.usageCounter.upsert({
      where: {
        userId_appId_dayKey: {
          userId,
          appId: APP_ID,
          dayKey,
        },
      },
      create: {
        userId,
        appId: APP_ID,
        dayKey,
        conceptsCount: 0,
        imagesCount: 0,
      },
      update: {}, // No update needed, we'll check and increment below
    });

    const currentConcepts = counter.conceptsCount;
    const currentImages = counter.imagesCount;

    // Check limits before incrementing (check if increment would exceed limit)
    if (generateImages) {
      // For image generation, check both limits
      if (currentConcepts >= CONCEPTS_LIMIT) {
        return {
          allowed: false,
          conceptsUsed: currentConcepts,
          imagesUsed: currentImages,
          conceptsLimit: CONCEPTS_LIMIT,
          imagesLimit: IMAGES_LIMIT,
          resetsAt: getResetsAt(),
          message: "Daily concept limit reached",
        };
      }
      if (currentImages >= IMAGES_LIMIT) {
        return {
          allowed: false,
          conceptsUsed: currentConcepts,
          imagesUsed: currentImages,
          conceptsLimit: CONCEPTS_LIMIT,
          imagesLimit: IMAGES_LIMIT,
          resetsAt: getResetsAt(),
          message: "Daily image limit reached",
        };
      }
      // Increment both
      const updated = await tx.usageCounter.update({
        where: {
          userId_appId_dayKey: {
            userId,
            appId: APP_ID,
            dayKey,
          },
        },
        data: {
          conceptsCount: { increment: 1 },
          imagesCount: { increment: 1 },
        },
      });
      return {
        allowed: true,
        conceptsUsed: updated.conceptsCount,
        imagesUsed: updated.imagesCount,
        conceptsLimit: CONCEPTS_LIMIT,
        imagesLimit: IMAGES_LIMIT,
        resetsAt: getResetsAt(),
      };
    } else {
      // For concepts only, check concepts limit
      if (currentConcepts >= CONCEPTS_LIMIT) {
        return {
          allowed: false,
          conceptsUsed: currentConcepts,
          imagesUsed: currentImages,
          conceptsLimit: CONCEPTS_LIMIT,
          imagesLimit: IMAGES_LIMIT,
          resetsAt: getResetsAt(),
          message: "Daily concept limit reached",
        };
      }
      // Increment concepts only
      const updated = await tx.usageCounter.update({
        where: {
          userId_appId_dayKey: {
            userId,
            appId: APP_ID,
            dayKey,
          },
        },
        data: {
          conceptsCount: { increment: 1 },
        },
      });
      return {
        allowed: true,
        conceptsUsed: updated.conceptsCount,
        imagesUsed: updated.imagesCount,
        conceptsLimit: CONCEPTS_LIMIT,
        imagesLimit: IMAGES_LIMIT,
        resetsAt: getResetsAt(),
      };
    }
  });

  return result;
}

