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
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";
import { requirePermission } from "@/lib/auth/permissions.server";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
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

  warnIfBusinessIdParamPresent(request);

  try {
    const { businessId, role, userId } = await requireTenant();
    void role;
    void userId;
    await requirePermission("AI_HELP_DESK", "EDIT_DRAFT");

    // Parse and validate request body
    const body = await request.json();
    const validationResult = upsertRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { id, type, title, content, tags, isActive } = validationResult.data;

    // If id is provided, update existing entry; otherwise, create new
    if (id) {
      // Verify the entry exists and belongs to this business (tenant safety)
      const existing = await prisma.aiHelpDeskEntry.findFirst({
        where: { id, businessId },
      });

      if (!existing) {
        return apiErrorResponse(
          "Entry not found",
          "UPSTREAM_NOT_FOUND",
          404
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
          businessId,
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
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

