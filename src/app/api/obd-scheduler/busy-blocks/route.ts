/**
 * OBD Scheduler & Booking - Busy Blocks API Route (Phase 3A)
 * 
 * GET: List busy blocks (scoped to business)
 * POST: Create busy block
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getPrisma } from "@/lib/prisma";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitizeText";
import type {
  SchedulerBusyBlock,
  CreateBusyBlockRequest,
} from "@/lib/apps/obd-scheduler/types";

export const runtime = "nodejs";

// Validation schema
const createBusyBlockSchema = z.object({
  start: z.string().datetime({ message: "Start time must be a valid ISO 8601 datetime" }),
  end: z.string().datetime({ message: "End time must be a valid ISO 8601 datetime" }),
  reason: z.string().max(500).optional().nullable(),
}).refine(
  (data) => new Date(data.end) > new Date(data.start),
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
 * GET /api/obd-scheduler/busy-blocks
 * List busy blocks (scoped to business)
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
    await requirePermission("OBD_SCHEDULER", "VIEW");

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate"); // Optional filter: YYYY-MM-DD
    const endDate = searchParams.get("endDate"); // Optional filter: YYYY-MM-DD

    const where: any = {
      businessId,
    };

    // Add date range filter if provided
    if (startDate || endDate) {
      where.AND = [];
      if (startDate) {
        where.AND.push({
          end: {
            gte: new Date(`${startDate}T00:00:00Z`),
          },
        });
      }
      if (endDate) {
        where.AND.push({
          start: {
            lte: new Date(`${endDate}T23:59:59Z`),
          },
        });
      }
    }

    const blocks = await prisma.schedulerBusyBlock.findMany({
      where,
      orderBy: {
        start: "asc",
      },
    });

    return apiSuccessResponse(blocks.map(formatBusyBlock));
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code =
        error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

/**
 * POST /api/obd-scheduler/busy-blocks
 * Create a new busy block
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return apiErrorResponse("Database unavailable", "DB_UNAVAILABLE", 503);
    }

    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
    await requirePermission("OBD_SCHEDULER", "MANAGE_SETTINGS");

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = createBusyBlockSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Create busy block
    const block = await prisma.schedulerBusyBlock.create({
      data: {
        businessId,
        start: new Date(body.start),
        end: new Date(body.end),
        reason: body.reason ? sanitizeText(body.reason) : null,
        source: "manual", // Phase 3A: Only manual blocks
      },
    });

    return apiSuccessResponse(formatBusyBlock(block), 201);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code =
        error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

