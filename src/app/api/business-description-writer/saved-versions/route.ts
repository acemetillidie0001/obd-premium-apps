/**
 * Business Description Writer - Saved Versions API Route
 * 
 * GET: List saved versions for a business (tenant-scoped)
 * POST: Create a new saved version
 * DELETE: Delete a saved version (tenant-scoped)
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for POST request
const createVersionSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  title: z.string().min(1, "Title is required").max(500, "Title is too long"),
  businessName: z.string().min(1, "Business name is required"),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  inputs: z.any(), // JSON object - validated by structure
  outputs: z.object({
    obdListingDescription: z.string(),
    googleBusinessDescription: z.string(),
    websiteAboutUs: z.string(),
    metaDescription: z.string().nullable(),
  }),
});

/**
 * GET /api/business-description-writer/saved-versions?businessId=...
 * 
 * Returns latest 50 versions for the business, ordered by createdAt desc
 */
export async function GET(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    // Validate businessId
    if (!businessId || !businessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    const trimmedBusinessId = businessId.trim();

    // Query database with tenant safety (businessId is the tenant boundary)
    let versions;
    try {
      versions = await prisma.businessDescriptionSavedVersion.findMany({
        where: {
          businessId: trimmedBusinessId,
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50, // Limit to latest 50
        select: {
          id: true,
          businessId: true,
          createdAt: true,
          updatedAt: true,
          title: true,
          businessName: true,
          city: true,
          state: true,
          inputs: true,
          outputs: true,
          isActive: true,
        },
      });
    } catch (dbError) {
      // Handle database unavailability and missing table errors
      console.error("[BDW Saved Versions] Database error:", dbError);
      
      // Check for missing table errors (P2021/P2022 or message patterns)
      const errorCode = (dbError as any)?.code;
      const errorMessage = dbError instanceof Error ? dbError.message.toLowerCase() : String(dbError).toLowerCase();
      
      const isMissingTableError = 
        errorCode === "P2021" || // Table does not exist (PostgreSQL)
        errorCode === "P2022" || // Table does not exist (alternative)
        errorMessage.includes("does not exist") ||
        errorMessage.includes("relation") && errorMessage.includes("does not exist") ||
        errorMessage.includes("no such table") ||
        errorMessage.includes("table") && errorMessage.includes("does not exist");
      
      // Check if it's a connection error
      const isConnectionError = dbError instanceof Error && (
        dbError.message.includes("connect") ||
        dbError.message.includes("timeout") ||
        dbError.message.includes("ECONNREFUSED") ||
        errorCode === "P1001" // Prisma connection error code
      );

      if (isMissingTableError || isConnectionError) {
        return apiErrorResponse(
          "Database unavailable.",
          "DB_UNAVAILABLE",
          503
        );
      }

      // Re-throw other errors to be handled by handleApiError
      throw dbError;
    }

    return apiSuccessResponse({
      versions: versions.map((v) => ({
        id: v.id,
        createdAt: v.createdAt.toISOString(),
        businessName: v.businessName,
        city: v.city || "",
        state: v.state || "",
        inputs: v.inputs,
        outputs: v.outputs,
        title: v.title,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/business-description-writer/saved-versions
 * 
 * Creates a new saved version
 */
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
    const body = await request.json();
    const validationResult = createVersionSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId, title, businessName, city, state, inputs, outputs } = validationResult.data;

    const trimmedBusinessId = businessId.trim();

    // Tenant safety: businessId is the tenant boundary
    // No additional validation needed since we're using the businessId directly

    let created;
    try {
      created = await prisma.businessDescriptionSavedVersion.create({
        data: {
          businessId: trimmedBusinessId,
          title: title.trim(),
          businessName: businessName.trim(),
          city: city?.trim() || null,
          state: state?.trim() || null,
          inputs: inputs,
          outputs: outputs,
          isActive: true,
        },
        select: {
          id: true,
          businessId: true,
          createdAt: true,
          updatedAt: true,
          title: true,
          businessName: true,
          city: true,
          state: true,
          inputs: true,
          outputs: true,
          isActive: true,
        },
      });
    } catch (dbError) {
      // Handle database unavailability and missing table errors
      console.error("[BDW Saved Versions] Database error:", dbError);
      
      const errorCode = (dbError as any)?.code;
      const errorMessage = dbError instanceof Error ? dbError.message.toLowerCase() : String(dbError).toLowerCase();
      
      const isMissingTableError = 
        errorCode === "P2021" ||
        errorCode === "P2022" ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("relation") && errorMessage.includes("does not exist") ||
        errorMessage.includes("no such table") ||
        errorMessage.includes("table") && errorMessage.includes("does not exist");
      
      const isConnectionError = dbError instanceof Error && (
        dbError.message.includes("connect") ||
        dbError.message.includes("timeout") ||
        dbError.message.includes("ECONNREFUSED") ||
        errorCode === "P1001"
      );

      if (isMissingTableError || isConnectionError) {
        return apiErrorResponse(
          "Database unavailable.",
          "DB_UNAVAILABLE",
          503
        );
      }

      throw dbError;
    }

    return apiSuccessResponse({
      id: created.id,
      createdAt: created.createdAt.toISOString(),
      businessName: created.businessName,
      city: created.city || "",
      state: created.state || "",
      inputs: created.inputs,
      outputs: created.outputs,
      title: created.title,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/business-description-writer/saved-versions?id=...&businessId=...
 * 
 * Deletes a saved version (tenant-scoped)
 */
export async function DELETE(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const businessId = searchParams.get("businessId");

    // Validate required params
    if (!id || !id.trim()) {
      return apiErrorResponse(
        "Version ID is required",
        "VALIDATION_ERROR",
        400
      );
    }

    if (!businessId || !businessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    const trimmedId = id.trim();
    const trimmedBusinessId = businessId.trim();

    // Tenant safety: Verify the version exists and belongs to the business
    let existing;
    try {
      existing = await prisma.businessDescriptionSavedVersion.findUnique({
        where: { id: trimmedId },
        select: { id: true, businessId: true },
      });
    } catch (dbError) {
      // Handle database unavailability and missing table errors
      console.error("[BDW Saved Versions] Database error:", dbError);
      
      const errorCode = (dbError as any)?.code;
      const errorMessage = dbError instanceof Error ? dbError.message.toLowerCase() : String(dbError).toLowerCase();
      
      const isMissingTableError = 
        errorCode === "P2021" ||
        errorCode === "P2022" ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("relation") && errorMessage.includes("does not exist") ||
        errorMessage.includes("no such table") ||
        errorMessage.includes("table") && errorMessage.includes("does not exist");
      
      const isConnectionError = dbError instanceof Error && (
        dbError.message.includes("connect") ||
        dbError.message.includes("timeout") ||
        dbError.message.includes("ECONNREFUSED") ||
        errorCode === "P1001"
      );

      if (isMissingTableError || isConnectionError) {
        return apiErrorResponse(
          "Database unavailable.",
          "DB_UNAVAILABLE",
          503
        );
      }

      throw dbError;
    }

    if (!existing) {
      return apiErrorResponse(
        "Version not found",
        "NOT_FOUND",
        404
      );
    }

    // Tenant safety: Ensure version belongs to the business
    if (existing.businessId !== trimmedBusinessId) {
      return apiErrorResponse(
        "Version does not belong to this business",
        "TENANT_SAFETY_BLOCKED",
        403
      );
    }

    // Delete the version
    try {
      await prisma.businessDescriptionSavedVersion.delete({
        where: { id: trimmedId },
      });
    } catch (dbError) {
      // Handle database unavailability and missing table errors
      console.error("[BDW Saved Versions] Database error:", dbError);
      
      const errorCode = (dbError as any)?.code;
      const errorMessage = dbError instanceof Error ? dbError.message.toLowerCase() : String(dbError).toLowerCase();
      
      const isMissingTableError = 
        errorCode === "P2021" ||
        errorCode === "P2022" ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("relation") && errorMessage.includes("does not exist") ||
        errorMessage.includes("no such table") ||
        errorMessage.includes("table") && errorMessage.includes("does not exist");
      
      const isConnectionError = dbError instanceof Error && (
        dbError.message.includes("connect") ||
        dbError.message.includes("timeout") ||
        dbError.message.includes("ECONNREFUSED") ||
        errorCode === "P1001"
      );

      if (isMissingTableError || isConnectionError) {
        return apiErrorResponse(
          "Database unavailable.",
          "DB_UNAVAILABLE",
          503
        );
      }

      throw dbError;
    }

    return apiSuccessResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

