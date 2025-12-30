/**
 * AI Help Desk Knowledge List API Route
 * 
 * Handles listing knowledge entries for a business.
 * Supports filtering by type and search query.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for request validation
const listRequestSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  type: z.enum(["FAQ", "SERVICE", "POLICY", "NOTE"]).optional(),
  search: z.string().optional(),
  includeInactive: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const includeInactive = searchParams.get("includeInactive") === "true";

    // Validate request
    const validationResult = listRequestSchema.safeParse({
      businessId,
      type: type ? (type as "FAQ" | "SERVICE" | "POLICY" | "NOTE") : undefined,
      search: search || undefined,
      includeInactive,
    });

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId: validatedBusinessId, type: validatedType, search: validatedSearch } = validationResult.data;

    // Tenant safety: Ensure businessId is provided
    if (!validatedBusinessId || !validatedBusinessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    // Build where clause
    const where: {
      businessId: string;
      type?: "FAQ" | "SERVICE" | "POLICY" | "NOTE";
      isActive?: boolean;
      OR?: Array<{
        title?: { contains: string; mode?: "insensitive" };
        content?: { contains: string; mode?: "insensitive" };
      }>;
    } = {
      businessId: validatedBusinessId.trim(),
    };

    if (validatedType) {
      where.type = validatedType;
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    if (validatedSearch && validatedSearch.trim()) {
      const searchTerm = validatedSearch.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { content: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    // Query entries
    const entries = await prisma.aiHelpDeskEntry.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
      ],
    });

    // Format response
    const formattedEntries = entries.map((entry) => ({
      id: entry.id,
      businessId: entry.businessId,
      type: entry.type,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      isActive: entry.isActive,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }));

    return apiSuccessResponse({
      entries: formattedEntries,
      count: formattedEntries.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

