/**
 * AI Help Desk Website Import Commit API Route
 * 
 * Imports selected pages as knowledge entries.
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
const commitRequestSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  items: z.array(
    z.object({
      type: z.enum(["FAQ", "SERVICE", "POLICY", "NOTE"]),
      title: z.string().min(1, "Title is required").max(500, "Title is too long"),
      content: z.string().min(1, "Content is required"),
      tags: z.array(z.string()).optional().default([]),
    })
  ).min(1, "At least one item is required"),
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

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = commitRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId, items } = validationResult.data;

    // Tenant safety: Ensure businessId is provided
    if (!businessId || !businessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    const trimmedBusinessId = businessId.trim();

    // Create entries
    const created = await prisma.$transaction(
      items.map((item) =>
        prisma.aiHelpDeskEntry.create({
          data: {
            businessId: trimmedBusinessId,
            type: item.type,
            title: item.title.trim(),
            content: item.content.trim(),
            tags: item.tags || [],
            isActive: true,
          },
        })
      )
    );

    return apiSuccessResponse({
      created: created.map((entry) => ({
        id: entry.id,
        businessId: entry.businessId,
        type: entry.type,
        title: entry.title,
        content: entry.content,
        tags: entry.tags,
        isActive: entry.isActive,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
      count: created.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

