/**
 * OBD Scheduler & Booking - Busy Block by ID API Route (Phase 3A)
 * 
 * GET: Get busy block by ID
 * PUT: Update busy block
 * DELETE: Delete busy block
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { getPrisma } from "@/lib/prisma";
import { isSchedulerPilotAllowed } from "@/lib/apps/obd-scheduler/pilotAccess";
import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitizeText";
import type {
  SchedulerBusyBlock,
  UpdateBusyBlockRequest,
} from "@/lib/apps/obd-scheduler/types";

export const runtime = "nodejs";

// Validation schema
const updateBusyBlockSchema = z.object({
  start: z.string().datetime({ message: "Start time must be a valid ISO 8601 datetime" }).optional(),
  end: z.string().datetime({ message: "End time must be a valid ISO 8601 datetime" }).optional(),
  reason: z.string().max(500).optional().nullable(),
}).refine(
  (data) => {
    // Only validate if both start and end are provided
    if (data.start && data.end) {
      return new Date(data.end) > new Date(data.start);
    }
    return true;
  },
  {
    message: "End time must be after start time",
    path: ["end"],
  }
);

// Helper: Format busy block from DB
function formatBusyBlock(block: any): SchedulerBusyBlock {
  return {
    id: block.id,
    businessId: block.businessId,
    start: block.start.toISOString(),
    end: block.end.toISOString(),
    reason: block.reason,
    source: block.source as "manual" | "google" | "microsoft",
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-scheduler/busy-blocks/[id]
 * Get busy block by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const { id } = await context.params;
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    const block = await prisma.schedulerBusyBlock.findFirst({
      where: {
        id,
        businessId, // Ensure business owns this block
      },
    });

    if (!block) {
      return apiErrorResponse("Busy block not found", "NOT_FOUND", 404);
    }

    return apiSuccessResponse(formatBusyBlock(block));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/obd-scheduler/busy-blocks/[id]
 * Update busy block
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const { id } = await context.params;
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    // Check if block exists and belongs to business
    const existingBlock = await prisma.schedulerBusyBlock.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingBlock) {
      return apiErrorResponse("Busy block not found", "NOT_FOUND", 404);
    }

    // Only allow updating manual blocks in Phase 3A
    if (existingBlock.source !== "manual") {
      return apiErrorResponse(
        "Only manually created blocks can be updated in Phase 3A",
        "VALIDATION_ERROR",
        400
      );
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = updateBusyBlockSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Build update data
    const updateData: any = {};
    if (body.start !== undefined) {
      updateData.start = new Date(body.start);
    }
    if (body.end !== undefined) {
      updateData.end = new Date(body.end);
    }
    if (body.reason !== undefined) {
      updateData.reason = body.reason ? sanitizeText(body.reason) : null;
    }

    // If both start and end are being updated, validate they're in order
    if (updateData.start && updateData.end) {
      if (updateData.end <= updateData.start) {
        return apiErrorResponse(
          "End time must be after start time",
          "VALIDATION_ERROR",
          400
        );
      }
    } else if (updateData.start && existingBlock.end) {
      // If only start is updated, check against existing end
      if (existingBlock.end <= updateData.start) {
        return apiErrorResponse(
          "End time must be after start time",
          "VALIDATION_ERROR",
          400
        );
      }
    } else if (updateData.end && existingBlock.start) {
      // If only end is updated, check against existing start
      if (updateData.end <= existingBlock.start) {
        return apiErrorResponse(
          "End time must be after start time",
          "VALIDATION_ERROR",
          400
        );
      }
    }

    // Update busy block
    const block = await prisma.schedulerBusyBlock.update({
      where: {
        id,
      },
      data: updateData,
    });

    return apiSuccessResponse(formatBusyBlock(block));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/obd-scheduler/busy-blocks/[id]
 * Delete busy block
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const { id } = await context.params;
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Check pilot access
    if (!isSchedulerPilotAllowed(businessId)) {
      return apiErrorResponse(
        "Scheduler is currently in pilot rollout.",
        "PILOT_ONLY",
        403
      );
    }

    // Check if block exists and belongs to business
    const existingBlock = await prisma.schedulerBusyBlock.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!existingBlock) {
      return apiErrorResponse("Busy block not found", "NOT_FOUND", 404);
    }

    // Only allow deleting manual blocks in Phase 3A
    if (existingBlock.source !== "manual") {
      return apiErrorResponse(
        "Only manually created blocks can be deleted in Phase 3A",
        "VALIDATION_ERROR",
        400
      );
    }

    // Delete busy block
    await prisma.schedulerBusyBlock.delete({
      where: {
        id,
      },
    });

    return apiSuccessResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

