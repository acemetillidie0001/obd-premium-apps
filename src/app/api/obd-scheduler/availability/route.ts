/**
 * OBD Scheduler & Booking - Availability API Route (V4 Tier 1A)
 * 
 * GET: Get availability windows and exceptions
 * PUT: Update availability windows and exceptions
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getPrisma } from "@/lib/prisma";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";
import { z } from "zod";
import type {
  AvailabilityWindow,
  AvailabilityException,
  AvailabilityData,
  UpdateAvailabilityRequest,
} from "@/lib/apps/obd-scheduler/types";
import { AvailabilityExceptionType } from "@/lib/apps/obd-scheduler/types";

export const runtime = "nodejs";

// Validation schemas
const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/; // HH:mm format

const availabilityWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timePattern, "Start time must be in HH:mm format"),
  endTime: z.string().regex(timePattern, "End time must be in HH:mm format"),
  isEnabled: z.boolean().optional().default(true),
});

const availabilityExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  startTime: z.string().regex(timePattern, "Start time must be in HH:mm format").optional().nullable(),
  endTime: z.string().regex(timePattern, "End time must be in HH:mm format").optional().nullable(),
  type: z.nativeEnum(AvailabilityExceptionType),
});

const updateAvailabilitySchema = z.object({
  windows: z.array(availabilityWindowSchema).optional(),
  exceptions: z.array(availabilityExceptionSchema).optional(),
});

// Helper: Format window from DB
function formatWindow(window: any): AvailabilityWindow {
  return {
    id: window.id,
    businessId: window.businessId,
    dayOfWeek: window.dayOfWeek,
    startTime: window.startTime,
    endTime: window.endTime,
    isEnabled: window.isEnabled,
    createdAt: window.createdAt.toISOString(),
    updatedAt: window.updatedAt.toISOString(),
  };
}

// Helper: Format exception from DB
function formatException(exception: any): AvailabilityException {
  return {
    id: exception.id,
    businessId: exception.businessId,
    date: exception.date.toISOString().split("T")[0], // Convert Date to YYYY-MM-DD
    startTime: exception.startTime,
    endTime: exception.endTime,
    type: exception.type,
    createdAt: exception.createdAt.toISOString(),
    updatedAt: exception.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-scheduler/availability
 * Get availability windows and exceptions
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  warnIfBusinessIdParamPresent(request);

  try {
    const prisma = getPrisma();
    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
    await requirePermission("OBD_SCHEDULER", "VIEW");

    // Get windows and exceptions
    const [windows, exceptions] = await Promise.all([
      prisma.availabilityWindow.findMany({
        where: { businessId },
        orderBy: { dayOfWeek: "asc" },
      }),
      prisma.availabilityException.findMany({
        where: { businessId },
        orderBy: { date: "desc" },
      }),
    ]);

    const data: AvailabilityData = {
      windows: windows.map(formatWindow),
      exceptions: exceptions.map(formatException),
    };

    return apiSuccessResponse(data);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

/**
 * PUT /api/obd-scheduler/availability
 * Update availability windows and exceptions
 */
export async function PUT(request: NextRequest) {
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
    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
    await requirePermission("OBD_SCHEDULER", "MANAGE_SETTINGS");

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = updateAvailabilitySchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Update windows if provided
    if (body.windows !== undefined) {
      // Delete all existing windows for this business
      await prisma.availabilityWindow.deleteMany({
        where: { businessId },
      });

      // Create new windows
      if (body.windows.length > 0) {
        await prisma.availabilityWindow.createMany({
          data: body.windows.map((w) => ({
            businessId,
            dayOfWeek: w.dayOfWeek,
            startTime: w.startTime,
            endTime: w.endTime,
            isEnabled: w.isEnabled ?? true,
          })),
        });
      }
    }

    // Update exceptions if provided
    if (body.exceptions !== undefined) {
      // Delete all existing exceptions for this business
      await prisma.availabilityException.deleteMany({
        where: { businessId },
      });

      // Create new exceptions
      if (body.exceptions.length > 0) {
        await prisma.availabilityException.createMany({
          data: body.exceptions.map((e) => ({
            businessId,
            date: new Date(e.date),
            startTime: e.startTime,
            endTime: e.endTime,
            type: e.type,
          })),
        });
      }
    }

    // Fetch updated data
    const [windows, exceptions] = await Promise.all([
      prisma.availabilityWindow.findMany({
        where: { businessId },
        orderBy: { dayOfWeek: "asc" },
      }),
      prisma.availabilityException.findMany({
        where: { businessId },
        orderBy: { date: "desc" },
      }),
    ]);

    const data: AvailabilityData = {
      windows: windows.map(formatWindow),
      exceptions: exceptions.map(formatException),
    };

    return apiSuccessResponse(data);
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

