/**
 * AI Review Responder - Response History (Tier 6-1)
 *
 * Snapshot-only, read-only history:
 * - POST creates an immutable snapshot for the current tenant (businessId).
 * - GET lists latest snapshots for the current tenant.
 *
 * Trust rules:
 * - No apply/restore automation
 * - No background jobs
 * - Tenant-scoped via membership-derived businessId (requireTenant)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { requireTenant, warnIfBusinessIdParamPresent } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/permissions.server";
import { BusinessContextError } from "@/lib/auth/requireBusinessContext";

export const runtime = "nodejs";

const reviewResponsePlatformKeySchema = z.enum(["google", "facebook", "obd", "other"]);
const reviewResponseKindSchema = z.enum([
  "standardReply",
  "shortReply",
  "socialSnippet",
  "whyChooseSection",
  "qnaBox",
  "metaDescription",
  "storytellingVersion",
]);
const reviewResponseStatusSchema = z.enum(["draft", "generated", "edited"]);

const snapshotInputSummarySchema = z
  .object({
    platform: z.enum(["Google", "OBD", "Facebook", "Other"]).optional(),
    reviewRating: z.number().int().min(1).max(5).optional(),
    responseLength: z.enum(["Short", "Medium", "Long"]).optional(),
    language: z.enum(["English", "Spanish", "Bilingual"]).optional(),
    personalityStyle: z.enum(["None", "Soft", "Bold", "High-Energy", "Luxury"]).optional(),
    includeQnaBox: z.boolean().optional(),
    includeMetaDescription: z.boolean().optional(),
    includeStoryVersion: z.boolean().optional(),
    reviewTextHash: z.string().max(64).optional(),
    reviewTextLength: z.number().int().min(0).max(5000).optional(),
    hasServices: z.boolean().optional(),
    hasResponseGoal: z.boolean().optional(),
    hasBrandVoice: z.boolean().optional(),
  })
  .strict();

const snapshotResponseItemSchema = z
  .object({
    platform: reviewResponsePlatformKeySchema,
    kind: reviewResponseKindSchema,
    activeText: z.string().min(1).max(20000),
    status: reviewResponseStatusSchema,
    tone: z.string().max(60).optional(),
    length: z.string().max(60).optional(),
  })
  .strict();

const createSnapshotSchema = z
  .object({
    // Transitional: clients may send businessId. It is ignored for scoping.
    businessId: z.string().optional(),
    inputSummary: snapshotInputSummarySchema,
    responses: z.array(snapshotResponseItemSchema).min(1),
  })
  .strict();

function isDbUnavailableError(dbError: unknown): boolean {
  const errorCode = (dbError as any)?.code;
  const errorMessage = dbError instanceof Error ? dbError.message.toLowerCase() : String(dbError).toLowerCase();

  const isMissingTableError =
    errorCode === "P2021" ||
    errorCode === "P2022" ||
    errorMessage.includes("does not exist") ||
    (errorMessage.includes("relation") && errorMessage.includes("does not exist")) ||
    errorMessage.includes("no such table") ||
    (errorMessage.includes("table") && errorMessage.includes("does not exist"));

  const isConnectionError =
    dbError instanceof Error &&
    (dbError.message.includes("connect") ||
      dbError.message.includes("timeout") ||
      dbError.message.includes("ECONNREFUSED") ||
      errorCode === "P1001");

  return isMissingTableError || isConnectionError;
}

function computeCounts(responses: unknown): { responsesCount: number; editedCount: number; platformCount: number } {
  const arr = Array.isArray(responses) ? responses : [];
  const responsesCount = arr.length;
  const editedCount = arr.filter((r: any) => r && r.status === "edited").length;
  const platformCount = new Set(arr.map((r: any) => r?.platform).filter(Boolean)).size;
  return { responsesCount, editedCount, platformCount };
}

/**
 * GET /api/review-responder/snapshots
 *
 * Returns latest 50 snapshots for the tenant, newest-first.
 */
export async function GET(request: NextRequest) {
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  const rateLimitCheck = await checkRateLimit(request);
  if (rateLimitCheck) return rateLimitCheck;

  try {
    warnIfBusinessIdParamPresent(request);
    const { businessId: tenantBusinessId } = await requireTenant();
    await requirePermission("REVIEW_RESPONDER", "VIEW");

    let rows;
    try {
      rows = await prisma.reviewResponseSnapshot.findMany({
        where: { businessId: tenantBusinessId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          businessId: true,
          createdAt: true,
          inputSummary: true,
          responses: true,
        },
      });
    } catch (dbError) {
      console.error("[Review Responder Snapshots] Database error:", dbError);
      if (isDbUnavailableError(dbError)) {
        return apiErrorResponse("Database unavailable.", "DB_UNAVAILABLE", 503);
      }
      throw dbError;
    }

    return apiSuccessResponse({
      snapshots: rows.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        inputSummary: s.inputSummary,
        counts: computeCounts(s.responses),
      })),
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

/**
 * POST /api/review-responder/snapshots
 *
 * Creates an immutable snapshot for the tenant.
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

  try {
    const { businessId: tenantBusinessId } = await requireTenant();
    await requirePermission("REVIEW_RESPONDER", "EDIT_DRAFT");

    const body = await request.json().catch(() => null);
    if (!body) {
      return apiErrorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    const parsed = createSnapshotSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const { inputSummary, responses } = parsed.data;

    let created;
    try {
      created = await prisma.reviewResponseSnapshot.create({
        data: {
          businessId: tenantBusinessId,
          inputSummary,
          responses,
        },
        select: {
          id: true,
          createdAt: true,
          inputSummary: true,
        },
      });
    } catch (dbError) {
      console.error("[Review Responder Snapshots] Database error:", dbError);
      if (isDbUnavailableError(dbError)) {
        return apiErrorResponse("Database unavailable.", "DB_UNAVAILABLE", 503);
      }
      throw dbError;
    }

    return apiSuccessResponse({
      id: created.id,
      createdAt: created.createdAt.toISOString(),
      inputSummary: created.inputSummary,
    });
  } catch (error) {
    if (error instanceof BusinessContextError) {
      const code = error.status === 401 ? "UNAUTHORIZED" : error.status === 403 ? "FORBIDDEN" : "DB_UNAVAILABLE";
      return apiErrorResponse(error.message, code, error.status);
    }
    return handleApiError(error);
  }
}

