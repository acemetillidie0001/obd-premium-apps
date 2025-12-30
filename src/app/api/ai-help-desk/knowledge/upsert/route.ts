/**
 * AI Help Desk Knowledge Upsert API Route
 * 
 * Handles creating or updating knowledge entries for a business.
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
const upsertRequestSchema = z.object({
  id: z.string().optional(), // If provided, update; otherwise, create
  businessId: z.string().min(1, "Business ID is required"),
  type: z.enum(["FAQ", "SERVICE", "POLICY", "NOTE"]),
  title: z.string().min(1, "Title is required").max(500, "Title is too long"),
  content: z.string().min(1, "Content is required"),
  tags: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  // Check rate limit
  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = upsertRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { id, businessId, type, title, content, tags, isActive } = validationResult.data;

    // Tenant safety: Ensure businessId is provided
    if (!businessId || !businessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    const trimmedBusinessId = businessId.trim();

    // If id is provided, update existing entry; otherwise, create new
    if (id) {
      // Verify the entry exists and belongs to the business (tenant safety)
      const existing = await prisma.aiHelpDeskEntry.findUnique({
        where: { id },
      });

      if (!existing) {
        return apiErrorResponse(
          "Entry not found",
          "UPSTREAM_NOT_FOUND",
          404
        );
      }

      // Ensure tenant safety: entry must belong to the same business
      if (existing.businessId !== trimmedBusinessId) {
        return apiErrorResponse(
          "Entry does not belong to this business",
          "TENANT_SAFETY_BLOCKED",
          403
        );
      }

      // Update entry
      const updated = await prisma.aiHelpDeskEntry.update({
        where: { id },
        data: {
          type,
          title: title.trim(),
          content: content.trim(),
          tags: tags || [],
          isActive: isActive ?? true,
          updatedAt: new Date(),
        },
      });

      return apiSuccessResponse({
        id: updated.id,
        businessId: updated.businessId,
        type: updated.type,
        title: updated.title,
        content: updated.content,
        tags: updated.tags,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } else {
      // Create new entry
      const created = await prisma.aiHelpDeskEntry.create({
        data: {
          businessId: trimmedBusinessId,
          type,
          title: title.trim(),
          content: content.trim(),
          tags: tags || [],
          isActive: isActive ?? true,
        },
      });

      return apiSuccessResponse({
        id: created.id,
        businessId: created.businessId,
        type: created.type,
        title: created.title,
        content: created.content,
        tags: created.tags,
        isActive: created.isActive,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

