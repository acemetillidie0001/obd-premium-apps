/**
 * Widget Analytics Events API Route
 * 
 * POST: Log widget analytics events (non-blocking)
 * Public endpoint (no auth required) - used by widget iframe
 */

import { NextRequest } from "next/server";
import { apiSuccessResponse, handleApiError } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const widgetEventSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  eventType: z.enum(["widget_open", "message_sent"] as const),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;

  try {
    const body = await request.json();
    const validationResult = widgetEventSchema.safeParse(body);

    if (!validationResult.success) {
      // Non-blocking: return success even if validation fails
      return apiSuccessResponse({ logged: false, reason: "validation_failed" });
    }

    const { businessId, eventType, metadata } = validationResult.data;

    // Log event (non-blocking - don't fail if DB is unavailable)
    try {
      await (prisma as any).aiHelpDeskWidgetEvent.create({
        data: {
          businessId: businessId.trim(),
          eventType,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return apiSuccessResponse({ logged: true });
    } catch (dbError) {
      // Non-blocking: log error but don't fail the request
      console.error("Failed to log widget event:", dbError);
      return apiSuccessResponse({ logged: false, reason: "database_error" });
    }
  } catch (error) {
    // Non-blocking: always return success
    console.error("Widget event API error:", error);
    return apiSuccessResponse({ logged: false, reason: "unknown_error" });
  }
}

