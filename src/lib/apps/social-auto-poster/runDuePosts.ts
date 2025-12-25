/**
 * Shared module for processing due scheduled posts.
 * Used by both /api/social-auto-poster/runner and /api/social-auto-poster/cron endpoints.
 */

import { prisma } from "@/lib/prisma";
import { processScheduledPost } from "./processScheduledPost";

export interface RunDuePostsResult {
  ok: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  errors?: string[];
  message?: string;
  timestamp: string;
}

/**
 * Finds and processes all due scheduled posts.
 * 
 * Due posts are those where:
 * - status = "scheduled"
 * - scheduledAt <= now
 * - nextAttemptAt is null OR nextAttemptAt <= now (for retries)
 * 
 * Processes up to 50 items per batch to avoid timeouts.
 */
export async function runDuePosts(): Promise<RunDuePostsResult> {
  const now = new Date();

  // Find due posts
  const dueItems = await prisma.socialQueueItem.findMany({
    where: {
      status: "scheduled",
      scheduledAt: {
        lte: now,
      },
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } },
      ],
    },
    select: {
      id: true,
      userId: true,
    },
    take: 50, // Limit batch size per run
  });

  if (dueItems.length === 0) {
    return {
      ok: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      message: "No due posts found",
      timestamp: now.toISOString(),
    };
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process each due item
  for (const item of dueItems) {
    try {
      const result = await processScheduledPost(item.id, item.userId);
      
      processed++;
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        if (result.errorMessage) {
          errors.push(`${item.id}: ${result.errorMessage}`);
        }
      }
    } catch (error) {
      processed++;
      failed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${item.id}: ${errorMessage}`);
      console.error(`[RunDuePosts] Error processing queue item ${item.id}:`, error);
    }
  }

  return {
    ok: true,
    processed,
    succeeded,
    failed,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: now.toISOString(),
  };
}

