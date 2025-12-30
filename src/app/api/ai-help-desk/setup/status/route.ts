/**
 * AI Help Desk Setup Status API Route
 * 
 * Checks the current setup status:
 * - Environment variables (ANYTHINGLLM_BASE_URL, ANYTHINGLLM_API_KEY)
 * - Database connectivity and AiWorkspaceMap table existence
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { handleApiError, apiSuccessResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface SetupStatusResponse {
  ok: true;
  data: {
    env: {
      hasBaseUrl: boolean;
      hasApiKey: boolean;
      baseUrlPreview: string | null;
    };
    db: {
      canQuery: boolean;
      hasAiWorkspaceMap: boolean;
      lastErrorCode?: string;
      lastErrorMessage?: string;
    };
  };
}

export async function GET(request: NextRequest) {
  // Require premium access
  const guard = await requirePremiumAccess();
  if (guard) return guard;

  try {
    // Check environment variables
    const baseUrl = process.env.ANYTHINGLLM_BASE_URL;
    const apiKey = process.env.ANYTHINGLLM_API_KEY;
    
    const env = {
      hasBaseUrl: !!baseUrl,
      hasApiKey: !!apiKey,
      baseUrlPreview: baseUrl ? (() => {
        try {
          const url = new URL(baseUrl);
          // Show protocol and hostname only, not full path
          return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
        } catch {
          // If URL parsing fails, show first 50 chars
          return baseUrl.length > 50 ? `${baseUrl.substring(0, 50)}...` : baseUrl;
        }
      })() : null,
    };

    // Check database connectivity and table existence
    let canQuery = false;
    let hasAiWorkspaceMap = false;
    let lastErrorCode: string | undefined;
    let lastErrorMessage: string | undefined;

    try {
      // Attempt a simple query to check database connectivity
      await prisma.$queryRaw`SELECT 1`;
      canQuery = true;

      // Check if AiWorkspaceMap table exists by attempting a count query
      // This will fail with a known error if the table doesn't exist
      try {
        await prisma.$queryRaw`SELECT COUNT(*) FROM "AiWorkspaceMap"`;
        hasAiWorkspaceMap = true;
      } catch (tableError: unknown) {
        // Check if it's a "relation does not exist" error (PostgreSQL)
        const errorMessage = tableError instanceof Error ? tableError.message : String(tableError);
        
        // Map error to stable code
        if (
          errorMessage.includes("does not exist") ||
          errorMessage.includes("relation") ||
          errorMessage.includes("table") ||
          errorMessage.includes("AiWorkspaceMap")
        ) {
          // Table doesn't exist - this is expected before migration
          hasAiWorkspaceMap = false;
          lastErrorCode = "TABLE_MISSING";
          lastErrorMessage = "The AiWorkspaceMap table does not exist. Run the database migration to create it.";
        } else {
          // Some other error - log it but don't fail the whole check
          console.warn("[AI Help Desk Setup] Unexpected error checking AiWorkspaceMap:", errorMessage);
          hasAiWorkspaceMap = false;
          lastErrorCode = "UNKNOWN_DB_ERROR";
          lastErrorMessage = "An unexpected error occurred while checking the table. Check database logs for details.";
        }
      }
    } catch (dbError: unknown) {
      // Database connection failed
      canQuery = false;
      hasAiWorkspaceMap = false;
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      console.warn("[AI Help Desk Setup] Database connection check failed:", errorMessage);
      
      // Map connection errors
      if (
        errorMessage.includes("connect") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("network")
      ) {
        lastErrorCode = "DB_CONNECT_FAILED";
        lastErrorMessage = "Cannot connect to the database. Please check your database configuration and ensure it's accessible.";
      } else {
        lastErrorCode = "UNKNOWN_DB_ERROR";
        lastErrorMessage = "Database error occurred. Check your database configuration.";
      }
    }

    const response: SetupStatusResponse = {
      ok: true,
      data: {
        env,
        db: {
          canQuery,
          hasAiWorkspaceMap,
          ...(lastErrorCode ? { lastErrorCode } : {}),
          ...(lastErrorMessage ? { lastErrorMessage } : {}),
        },
      },
    };

    return apiSuccessResponse(response.data);
  } catch (error) {
    return handleApiError(error);
  }
}

