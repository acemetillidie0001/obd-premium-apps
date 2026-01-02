/**
 * OBD Scheduler & Booking - Services API Route (V3)
 * 
 * GET: List services (scoped to business)
 * POST: Create service
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sanitizeSingleLine, sanitizeText } from "@/lib/utils/sanitizeText";
import type {
  BookingService,
  CreateServiceRequest,
} from "@/lib/apps/obd-scheduler/types";

export const runtime = "nodejs";

// Validation schema
const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(200),
  durationMinutes: z.number().int().min(1).max(1440), // Max 24 hours
  description: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional().default(true),
});

// Helper: Format service from DB
function formatService(service: any): BookingService {
  return {
    id: service.id,
    businessId: service.businessId,
    name: service.name,
    durationMinutes: service.durationMinutes,
    description: service.description,
    active: service.active,
    paymentRequired: service.paymentRequired,
    depositAmountCents: service.depositAmountCents,
    currency: service.currency,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-scheduler/services
 * List services (scoped to business)
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

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where: any = {
      businessId,
    };

    if (activeOnly) {
      where.active = true;
    }

    const services = await prisma.bookingService.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return apiSuccessResponse(services.map(formatService));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/obd-scheduler/services
 * Create a new service
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
    const parsed = createServiceSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const body = parsed.data;

    // Create service
    const service = await prisma.bookingService.create({
      data: {
        businessId,
        name: sanitizeSingleLine(body.name),
        durationMinutes: body.durationMinutes,
        description: body.description ? sanitizeText(body.description) : null,
        active: body.active ?? true,
      },
    });

    return apiSuccessResponse(formatService(service), 201);
  } catch (error) {
    return handleApiError(error);
  }
}

