/**
 * OBD Scheduler & Booking - Settings API Route (V3)
 * 
 * GET: Get booking settings
 * POST/PATCH: Save booking settings
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type {
  BookingSettings,
  UpdateBookingSettingsRequest,
} from "@/lib/apps/obd-scheduler/types";
import { generateBookingKey } from "@/lib/apps/obd-scheduler/bookingKey";

export const runtime = "nodejs";

// Validation schema
const updateSettingsSchema = z.object({
  timezone: z.string().max(100).optional(),
  bufferMinutes: z.number().int().min(0).max(1440).optional(),
  minNoticeHours: z.number().int().min(0).max(168).optional(), // Max 1 week
  maxDaysOut: z.number().int().min(1).max(365).optional(),
  policyText: z.string().max(5000).optional().nullable(),
  notificationEmail: z.string().email("Invalid email format").optional().nullable(),
});

// Helper: Format settings from DB
function formatSettings(settings: any): BookingSettings {
  return {
    id: settings.id,
    businessId: settings.businessId,
    timezone: settings.timezone,
    bufferMinutes: settings.bufferMinutes,
    minNoticeHours: settings.minNoticeHours,
    maxDaysOut: settings.maxDaysOut,
    policyText: settings.policyText,
    bookingKey: settings.bookingKey,
    notificationEmail: settings.notificationEmail,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}


/**
 * GET /api/obd-scheduler/settings
 * Get booking settings (creates default if not exists)
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    // Get or create settings
    let settings = await prisma.bookingSettings.findUnique({
      where: { businessId },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.bookingSettings.create({
        data: {
          businessId,
          timezone: "America/New_York",
          bufferMinutes: 15,
          minNoticeHours: 24,
          maxDaysOut: 90,
          bookingKey: generateBookingKey(),
        },
      });
    }

    return apiSuccessResponse(formatSettings(settings));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST/PATCH /api/obd-scheduler/settings
 * Save booking settings (upsert)
 */
export async function POST(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    const json = await request.json().catch(() => null);
    if (!json) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    // Validate request body
    const parsed = updateSettingsSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Get existing settings or create new
    const existing = await prisma.bookingSettings.findUnique({
      where: { businessId },
    });

    const updateData: any = {};

    if (body.timezone !== undefined) {
      updateData.timezone = body.timezone;
    }

    if (body.bufferMinutes !== undefined) {
      updateData.bufferMinutes = body.bufferMinutes;
    }

    if (body.minNoticeHours !== undefined) {
      updateData.minNoticeHours = body.minNoticeHours;
    }

    if (body.maxDaysOut !== undefined) {
      updateData.maxDaysOut = body.maxDaysOut;
    }

    if (body.policyText !== undefined) {
      updateData.policyText = body.policyText?.trim() || null;
    }

    if (body.notificationEmail !== undefined) {
      updateData.notificationEmail = body.notificationEmail?.trim() || null;
    }

    let settings: any;

    if (existing) {
      // Update existing
      settings = await prisma.bookingSettings.update({
        where: { businessId },
        data: updateData,
      });
    } else {
      // Create new with defaults
      settings = await prisma.bookingSettings.create({
        data: {
          businessId,
          timezone: body.timezone || "America/New_York",
          bufferMinutes: body.bufferMinutes ?? 15,
          minNoticeHours: body.minNoticeHours ?? 24,
          maxDaysOut: body.maxDaysOut ?? 90,
          policyText: body.policyText?.trim() || null,
          bookingKey: generateBookingKey(),
        },
      });
    }

    return apiSuccessResponse(formatSettings(settings));
  } catch (error) {
    return handleApiError(error);
  }
}

// Alias PATCH to POST (same behavior)
export const PATCH = POST;

