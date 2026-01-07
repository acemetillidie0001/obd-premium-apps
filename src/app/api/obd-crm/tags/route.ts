/**
 * OBD CRM Tags API Route (V3)
 * 
 * Handles listing and creating tags.
 * GET: List all tags for the business
 * POST: Create a new tag
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getCurrentUser } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { verifyCrmDatabaseSetup, selfTestErrorResponse } from "@/lib/apps/obd-crm/devSelfTest";
import { handleCrmDatabaseError } from "@/lib/apps/obd-crm/dbErrorHandler";
import { z } from "zod";
import type {
  CrmTag,
  CreateTagRequest,
} from "@/lib/apps/obd-crm/types";

export const runtime = "nodejs";

// Validation schema
const createTagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(100),
  color: z.string().max(50).optional(),
});

// Helper: Format tag from DB
function formatTag(tag: any): CrmTag {
  return {
    id: tag.id,
    businessId: tag.businessId,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}

/**
 * GET /api/obd-crm/tags
 * List all tags for the business
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Dev-only self-test: Verify database connectivity and required tables
  const selfTest = await verifyCrmDatabaseSetup();
  if (!selfTest.ok) {
    return selfTestErrorResponse(selfTest);
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    const tags = await prisma.crmTag.findMany({
      where: {
        businessId,
      },
      orderBy: {
        name: "asc",
      },
    });

    const formattedTags = tags.map(formatTag);

    return apiSuccessResponse({
      tags: formattedTags,
      count: formattedTags.length,
    });
  } catch (error) {
    // Check for database-specific errors first
    const dbError = handleCrmDatabaseError(error);
    if (dbError) {
      return dbError;
    }
    return handleApiError(error);
  }
}

/**
 * POST /api/obd-crm/tags
 * Create a new tag
 */
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  // Dev-only self-test: Verify database connectivity and required tables
  const selfTest = await verifyCrmDatabaseSetup();
  if (!selfTest.ok) {
    return selfTestErrorResponse(selfTest);
  }

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

    // Validate request
    const validationResult = createTagSchema.safeParse(json);
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { name, color } = validationResult.data;

    // Check if tag with this name already exists for this business
    const existingTag = await prisma.crmTag.findUnique({
      where: {
        businessId_name: {
          businessId,
          name: name.trim(),
        },
      },
    });

    if (existingTag) {
      return apiErrorResponse(
        "A tag with this name already exists",
        "VALIDATION_ERROR",
        400
      );
    }

    // Create tag
    const tag = await prisma.crmTag.create({
      data: {
        businessId,
        name: name.trim(),
        color: color || null,
      },
    });

    const formattedTag = formatTag(tag);

    return apiSuccessResponse(formattedTag, 201);
  } catch (error) {
    // Check for database-specific errors first
    const dbError = handleCrmDatabaseError(error);
    if (dbError) {
      return dbError;
    }
    return handleApiError(error);
  }
}

/**
 * DELETE /api/obd-crm/tags
 * Delete a tag by ID (passed as query param)
 */
export async function DELETE(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  // Dev-only safety check
  if (process.env.NODE_ENV !== "production") {
    if (!prisma?.crmTag) {
      console.error("[OBD CRM] Prisma client or crmTag model missing in tags DELETE route");
      return apiErrorResponse("Database client not initialized", "INTERNAL_ERROR", 500);
    }
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const businessId = user.id; // V3: userId = businessId

    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("id");

    if (!tagId) {
      return apiErrorResponse("Tag ID is required", "VALIDATION_ERROR", 400);
    }

    // Verify tag exists and belongs to this business
    const existingTag = await prisma.crmTag.findFirst({
      where: {
        id: tagId,
        businessId,
      },
    });

    if (!existingTag) {
      return apiErrorResponse("Tag not found", "UPSTREAM_NOT_FOUND", 404);
    }

    // Delete tag (cascade will handle contact tag relations)
    await prisma.crmTag.delete({
      where: {
        id: tagId,
      },
    });

    return apiSuccessResponse({ success: true });
  } catch (error) {
    // Check for database-specific errors first
    const dbError = handleCrmDatabaseError(error);
    if (dbError) {
      return dbError;
    }
    return handleApiError(error);
  }
}

