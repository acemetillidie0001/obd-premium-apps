/**
 * Widget Domain Validation API Route
 * 
 * POST: Check if a domain is allowed for widget embedding
 * Public endpoint (no auth required) - used by widget iframe
 */

import { NextRequest } from "next/server";
import { apiSuccessResponse, apiErrorResponse, handleApiError } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validateDomainSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  domain: z.string().min(1, "Domain is required"),
});

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    const body = await request.json();
    const validationResult = validateDomainSchema.safeParse(body);

    if (!validationResult.success) {
      return apiErrorResponse(
        "Invalid request body",
        "VALIDATION_ERROR",
        400
      );
    }

    const { businessId, domain } = validationResult.data;

    // Get widget settings
    const settings = await prisma.aiHelpDeskWidgetSettings.findUnique({
      where: { businessId: businessId.trim() },
    });

    // If no settings or no allowed domains, allow all (warning-only mode)
    const allowedDomains = (settings as any)?.allowedDomains || [];
    if (!settings || !allowedDomains || allowedDomains.length === 0) {
      return apiSuccessResponse({
        allowed: true,
        warning: "No domain restrictions configured",
      });
    }

    // Normalize domain for comparison
    const normalizedDomain = domain.toLowerCase().trim();
    const normalizedAllowed = allowedDomains.map((d: string) => d.toLowerCase().trim());

    // Check if domain is in allowlist
    const isAllowed = normalizedAllowed.includes(normalizedDomain) ||
                     normalizedAllowed.some((allowed: string) => {
                       // Also check if domain matches without www prefix
                       const domainWithoutWww = normalizedDomain.replace(/^www\./, "");
                       const allowedWithoutWww = allowed.replace(/^www\./, "");
                       return domainWithoutWww === allowedWithoutWww;
                     });

    return apiSuccessResponse({
      allowed: isAllowed,
      warning: isAllowed ? null : "Domain not in allowlist",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

