/**
 * AI Help Desk Setup Mapping API Route
 * 
 * Handles creating/updating and retrieving business-to-workspace mappings.
 * 
 * GET: Retrieve mapping by businessId
 * POST: Create or update mapping (upsert)
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for POST request validation
const mappingRequestSchema = z.object({
  businessId: z.string().min(1, "Business ID is required").max(200),
  workspaceSlug: z.string().min(1, "Workspace slug is required").max(200),
});

// GET: Retrieve mapping by businessId
export async function GET(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId) {
      return validationErrorResponse(
        new z.ZodError([
          {
            code: "custom",
            path: ["businessId"],
            message: "businessId query parameter is required",
          },
        ])
      );
    }

    // Query the mapping
    try {
      const mapping = await prisma.aiWorkspaceMap.findUnique({
        where: { businessId },
      });

      if (!mapping) {
        return apiSuccessResponse(null);
      }

      return apiSuccessResponse({
        id: mapping.id,
        businessId: mapping.businessId,
        workspaceSlug: mapping.workspaceSlug,
        createdAt: mapping.createdAt.toISOString(),
        updatedAt: mapping.updatedAt.toISOString(),
      });
    } catch (error) {
      // If table doesn't exist, Prisma will throw an error
      // Let it bubble up to handleApiError
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// POST: Create or update mapping (upsert)
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = mappingRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId, workspaceSlug } = validationResult.data;

    // Upsert the mapping
    const mapping = await prisma.aiWorkspaceMap.upsert({
      where: { businessId },
      update: {
        workspaceSlug,
        updatedAt: new Date(),
      },
      create: {
        businessId,
        workspaceSlug,
      },
    });

    return apiSuccessResponse({
      id: mapping.id,
      businessId: mapping.businessId,
      workspaceSlug: mapping.workspaceSlug,
      createdAt: mapping.createdAt.toISOString(),
      updatedAt: mapping.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

