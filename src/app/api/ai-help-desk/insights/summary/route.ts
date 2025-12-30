/**
 * AI Help Desk Insights Summary API Route
 * 
 * Returns insights about questions asked, knowledge gaps, and top questions.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

// Zod schema for request validation
const summaryRequestSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  days: z.number().int().min(1).max(365).optional().default(30),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const days = searchParams.get("days") ? parseInt(searchParams.get("days")!, 10) : 30;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

    // Validate request
    const validationResult = summaryRequestSchema.safeParse({
      businessId,
      days,
      limit,
    });

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId: validatedBusinessId, days: validatedDays, limit: validatedLimit } = validationResult.data;

    // Tenant safety: Ensure businessId is provided
    if (!validatedBusinessId || !validatedBusinessId.trim()) {
      return apiErrorResponse(
        "Business ID is required",
        "BUSINESS_REQUIRED",
        400
      );
    }

    const trimmedBusinessId = validatedBusinessId.trim();
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - validatedDays);

    // Get total questions count
    const totalQuestions = await prisma.aiHelpDeskQuestionLog.count({
      where: {
        businessId: trimmedBusinessId,
        createdAt: {
          gte: daysAgo,
        },
      },
    });

    // Get questions with no sources (knowledge gaps)
    const knowledgeGaps = await prisma.aiHelpDeskQuestionLog.findMany({
      where: {
        businessId: trimmedBusinessId,
        hasSources: false,
        createdAt: {
          gte: daysAgo,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: validatedLimit,
      select: {
        id: true,
        question: true,
        createdAt: true,
        sourcesCount: true,
        responseQuality: true,
      },
    });

    // Get top questions (most frequent, with sources)
    // Group by question text and count occurrences
    const allQuestions = await prisma.aiHelpDeskQuestionLog.findMany({
      where: {
        businessId: trimmedBusinessId,
        createdAt: {
          gte: daysAgo,
        },
      },
      select: {
        question: true,
        hasSources: true,
        sourcesCount: true,
        responseQuality: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group by question text (case-insensitive, normalized)
    const questionGroups = new Map<
      string,
      {
        question: string;
        count: number;
        hasSources: boolean;
        sourcesCount: number;
        responseQuality: "GOOD" | "WEAK" | "NONE" | null;
        lastAsked: Date;
      }
    >();

    for (const log of allQuestions) {
      const normalized = log.question.trim().toLowerCase();
      const existing = questionGroups.get(normalized);

      if (existing) {
        existing.count += 1;
        if (log.createdAt > existing.lastAsked) {
          existing.lastAsked = log.createdAt;
          // Update with most recent quality metrics
          existing.hasSources = log.hasSources;
          existing.sourcesCount = log.sourcesCount;
          existing.responseQuality = log.responseQuality;
        }
      } else {
        questionGroups.set(normalized, {
          question: log.question.trim(), // Keep original casing from first occurrence
          count: 1,
          hasSources: log.hasSources,
          sourcesCount: log.sourcesCount,
          responseQuality: log.responseQuality,
          lastAsked: log.createdAt,
        });
      }
    }

    // Sort by count (descending) and take top N
    const topQuestions = Array.from(questionGroups.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, validatedLimit)
      .map((q) => ({
        question: q.question,
        count: q.count,
        hasSources: q.hasSources,
        sourcesCount: q.sourcesCount,
        responseQuality: q.responseQuality,
        lastAsked: q.lastAsked.toISOString(),
      }));

    // Calculate stats
    const questionsWithSources = await prisma.aiHelpDeskQuestionLog.count({
      where: {
        businessId: trimmedBusinessId,
        hasSources: true,
        createdAt: {
          gte: daysAgo,
        },
      },
    });

    const questionsWithoutSources = await prisma.aiHelpDeskQuestionLog.count({
      where: {
        businessId: trimmedBusinessId,
        hasSources: false,
        createdAt: {
          gte: daysAgo,
        },
      },
    });

    return apiSuccessResponse({
      period: {
        days: validatedDays,
        startDate: daysAgo.toISOString(),
        endDate: new Date().toISOString(),
      },
      stats: {
        totalQuestions,
        questionsWithSources,
        questionsWithoutSources,
        knowledgeGapCount: questionsWithoutSources,
      },
      topQuestions,
      knowledgeGaps: knowledgeGaps.map((gap) => ({
        id: gap.id,
        question: gap.question,
        createdAt: gap.createdAt.toISOString(),
        sourcesCount: gap.sourcesCount,
        responseQuality: gap.responseQuality,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

