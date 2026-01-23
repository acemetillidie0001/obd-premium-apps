/**
 * AI Help Desk Setup Test API Route
 * 
 * Tests the connection to AnythingLLM for a given business/workspace.
 * Performs both search and chat tests to validate the integration.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { validationErrorResponse } from "@/lib/api/validationError";
import { handleApiError, apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { getWorkspaceSlugForBusiness } from "@/lib/integrations/anythingllm/scoping";
import { listWorkspaces, searchWorkspace, chatWorkspace } from "@/lib/integrations/anythingllm/client";
import { z } from "zod";

export const runtime = "nodejs";

type UpstreamCode =
  | "UPSTREAM_NOT_FOUND"
  | "UPSTREAM_UNAUTHORIZED"
  | "UPSTREAM_FORBIDDEN"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_BAD_REQUEST"
  | "UPSTREAM_ERROR";

function classifyAnythingLLMError(err: unknown): {
  code?: UpstreamCode;
  message: string;
  details?: unknown;
} {
  if (!(err instanceof Error)) {
    return { message: String(err) };
  }
  const anyErr = err as Error & { code?: string; details?: unknown };
  const code = anyErr.code as UpstreamCode | undefined;
  return { code, message: err.message, details: anyErr.details };
}

// Zod schema for request validation
const testRequestSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  query: z.string().max(200).optional().default("hours"),
});

function toApiErrorCode(code: UpstreamCode | undefined):
  | "UPSTREAM_ERROR"
  | "UPSTREAM_NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TIMEOUT" {
  switch (code) {
    case "UPSTREAM_NOT_FOUND":
      return "UPSTREAM_NOT_FOUND";
    case "UPSTREAM_UNAUTHORIZED":
      return "UNAUTHORIZED";
    case "UPSTREAM_FORBIDDEN":
      return "FORBIDDEN";
    case "UPSTREAM_TIMEOUT":
      return "TIMEOUT";
    default:
      return "UPSTREAM_ERROR";
  }
}

function extractWorkspaceSlugsFromListResponse(data: unknown): string[] {
  // AnythingLLM /workspaces response shape can vary; handle common patterns:
  // - array of { slug, name }
  // - { workspaces: [...] }
  const arr =
    Array.isArray(data)
      ? data
      : data && typeof data === "object" && "workspaces" in data && Array.isArray((data as any).workspaces)
        ? (data as any).workspaces
        : null;

  if (!arr) return [];

  const slugs: string[] = [];
  for (const item of arr) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const slug = typeof obj.slug === "string" ? obj.slug : null;
      if (slug) slugs.push(slug);
    }
  }
  return slugs;
}

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
    const validationResult = testRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error);
    }

    const { businessId, query } = validationResult.data;

    // Get workspace slug for business (includes fallback in dev)
    const workspaceResult = await getWorkspaceSlugForBusiness(businessId);
    const workspaceSlug = workspaceResult.workspaceSlug;
    const isFallback = workspaceResult.isFallback;

    // Step 0: Verify AnythingLLM v1 API + auth by calling GET /api/v1/workspaces
    let workspacesList: unknown = null;
    let listedSlugs: string[] = [];
    try {
      workspacesList = await listWorkspaces();
      listedSlugs = extractWorkspaceSlugsFromListResponse(workspacesList);
    } catch (error) {
      const classified = classifyAnythingLLMError(error);

      if (classified.code === "UPSTREAM_UNAUTHORIZED") {
        return apiErrorResponse(
          "AnythingLLM authentication failed. Please verify ANYTHINGLLM_API_KEY is correct for this AnythingLLM instance.",
          "UNAUTHORIZED",
          401,
          {
            workspaceSlug,
            friendlyMessage:
              "Authentication failed. Check ANYTHINGLLM_API_KEY and confirm it is an API key for this AnythingLLM instance (Authorization: Bearer ...).",
            upstream: classified.details ?? null,
          }
        );
      }

      if (classified.code === "UPSTREAM_FORBIDDEN") {
        return apiErrorResponse(
          "AnythingLLM access forbidden. Your API key may not have permission to list workspaces.",
          "FORBIDDEN",
          403,
          {
            workspaceSlug,
            friendlyMessage:
              "Access forbidden. Confirm your AnythingLLM API key has permission to access the API and list workspaces.",
            upstream: classified.details ?? null,
          }
        );
      }

      if (classified.code === "UPSTREAM_TIMEOUT") {
        return apiErrorResponse(
          "AnythingLLM request timed out while verifying API access.",
          "TIMEOUT",
          504,
          {
            workspaceSlug,
            friendlyMessage:
              "Timeout talking to AnythingLLM. Try again, or increase ANYTHINGLLM_TIMEOUT_MS.",
            upstream: classified.details ?? null,
          }
        );
      }

      if (classified.code === "UPSTREAM_ERROR") {
        const det = (classified.details ?? {}) as Record<string, unknown>;
        const isNonJson =
          det && typeof det === "object" && (det["nonJson"] === true || det["invalidJson"] === true);

        if (isNonJson) {
          return apiErrorResponse(
            "Endpoint mismatch (HTML response)",
            "UPSTREAM_ERROR",
            502,
            {
              workspaceSlug,
              friendlyMessage: "Endpoint mismatch (HTML response)",
              upstream: classified.details ?? null,
            }
          );
        }
      }

      if (classified.code === "UPSTREAM_NOT_FOUND") {
        return apiErrorResponse(
          "AnythingLLM API endpoint not found while verifying API access.",
          "UPSTREAM_NOT_FOUND",
          404,
          {
            workspaceSlug,
            friendlyMessage:
              "Endpoint mismatch (404). Confirm your AnythingLLM instance exposes /api/v1 and that ANYTHINGLLM_BASE_URL is the instance origin (no /api).",
            upstream: classified.details ?? null,
          }
        );
      }

      return apiErrorResponse(
        "AnythingLLM API verification failed.",
        toApiErrorCode(classified.code),
        502,
        {
          workspaceSlug,
          friendlyMessage: "AnythingLLM API verification failed. See upstream details.",
          upstream: classified.details ?? null,
        }
      );
    }

    // Only show "workspace not found" when we can confirm it from the /workspaces list
    if (listedSlugs.length > 0 && !listedSlugs.includes(workspaceSlug)) {
      return apiErrorResponse(
        `Workspace "${workspaceSlug}" not found in AnythingLLM.`,
        "UPSTREAM_NOT_FOUND",
        404,
        {
          workspaceSlug,
          friendlyMessage:
            "Workspace not found (slug not present in /api/v1/workspaces). Create the workspace in AnythingLLM or correct the saved workspace slug.",
          upstream: {
            availableWorkspacesCount: listedSlugs.length,
          },
        }
      );
    }

    // Test search
    let searchOk = false;
    let searchResultsCount = 0;
    let searchError: string | null = null;
    let searchCode: UpstreamCode | undefined;
    let searchDetails: unknown | undefined;

    try {
      const searchResults = await searchWorkspace(workspaceSlug, query || "ping", 5);
      searchOk = true;
      searchResultsCount = searchResults.results?.length || 0;
    } catch (error) {
      const classified = classifyAnythingLLMError(error);
      searchError = classified.message;
      searchCode = classified.code;
      searchDetails = classified.details;

      if (classified.code === "UPSTREAM_UNAUTHORIZED") {
        return apiErrorResponse(
          "AnythingLLM authentication failed. Please verify ANYTHINGLLM_API_KEY is correct for this AnythingLLM instance.",
          "UNAUTHORIZED",
          401,
          {
            workspaceSlug,
            friendlyMessage:
              "Authentication failed. Re-check your AnythingLLM API key (and that this instance accepts Bearer token auth).",
            upstream: classified.details ?? null,
          }
        );
      }

      if (classified.code === "UPSTREAM_FORBIDDEN") {
        return apiErrorResponse(
          "AnythingLLM access forbidden. Your API key may not have permission to access this workspace.",
          "FORBIDDEN",
          403,
          {
            workspaceSlug,
            friendlyMessage:
              "Access forbidden. Confirm your AnythingLLM API key has permission to access this workspace.",
            upstream: classified.details ?? null,
          }
        );
      }

      if (classified.code === "UPSTREAM_TIMEOUT") {
        return apiErrorResponse(
          "AnythingLLM request timed out. Please try again, or increase ANYTHINGLLM_TIMEOUT_MS.",
          "TIMEOUT",
          504,
          {
            workspaceSlug,
            friendlyMessage:
              "Timeout talking to AnythingLLM. Try again, or increase the timeout env var.",
            upstream: classified.details ?? null,
          }
        );
      }

      // Non-JSON/HTML responses are usually base URL / reverse-proxy misconfiguration.
      if (classified.code === "UPSTREAM_ERROR") {
        const det = (classified.details ?? {}) as Record<string, unknown>;
        const isNonJson = det && typeof det === "object" && (det["nonJson"] === true || det["invalidJson"] === true);
        if (isNonJson) {
          return apiErrorResponse(
            "Endpoint mismatch (HTML response)",
            "UPSTREAM_ERROR",
            502,
            {
              workspaceSlug,
              friendlyMessage:
                "Endpoint mismatch (HTML response)",
              upstream: classified.details ?? null,
            }
          );
        }
      }

      if (classified.code === "UPSTREAM_NOT_FOUND") {
        return apiErrorResponse(
          `AnythingLLM workspace or API endpoint not found for "${workspaceSlug}".`,
          "UPSTREAM_NOT_FOUND",
          404,
          {
            workspaceSlug,
            friendlyMessage:
              "AnythingLLM returned 404 after trying multiple API routes. This can mean the workspace slug doesn't exist OR your AnythingLLM instance uses different API paths. Check your instance's /api/docs, and verify ANYTHINGLLM_BASE_URL points to the instance root (no trailing /api).",
            upstream: classified.details ?? null,
          }
        );
      }
    }

    // Test chat
    let chatOk = false;
    let chatAnswerPreview = "";
    let sourcesCount = 0;
    let chatError: string | null = null;
    let chatCode: UpstreamCode | undefined;
    let chatDetails: unknown | undefined;

    try {
      const chatResponse = await chatWorkspace(
        workspaceSlug,
        "ping"
      );
      chatOk = true;
      chatAnswerPreview = chatResponse.answer?.substring(0, 200) || "";
      sourcesCount = chatResponse.sources?.length || 0;
    } catch (error) {
      const classified = classifyAnythingLLMError(error);
      chatError = classified.message;
      chatCode = classified.code;
      chatDetails = classified.details;

      if (classified.code === "UPSTREAM_UNAUTHORIZED") {
        return apiErrorResponse(
          "AnythingLLM authentication failed. Please verify ANYTHINGLLM_API_KEY is correct for this AnythingLLM instance.",
          "UNAUTHORIZED",
          401,
          {
            workspaceSlug,
            friendlyMessage:
              "Authentication failed. Re-check your AnythingLLM API key (and that this instance accepts Bearer token auth).",
            upstream: classified.details ?? null,
          }
        );
      }

      if (classified.code === "UPSTREAM_FORBIDDEN") {
        return apiErrorResponse(
          "AnythingLLM access forbidden. Your API key may not have permission to access this workspace.",
          "FORBIDDEN",
          403,
          {
            workspaceSlug,
            friendlyMessage:
              "Access forbidden. Confirm your AnythingLLM API key has permission to access this workspace.",
            upstream: classified.details ?? null,
          }
        );
      }

      if (classified.code === "UPSTREAM_TIMEOUT") {
        return apiErrorResponse(
          "AnythingLLM request timed out. Please try again, or increase ANYTHINGLLM_TIMEOUT_MS.",
          "TIMEOUT",
          504,
          {
            workspaceSlug,
            friendlyMessage:
              "Timeout talking to AnythingLLM. Try again, or increase the timeout env var.",
            upstream: classified.details ?? null,
          }
        );
      }

      if (classified.code === "UPSTREAM_ERROR") {
        const det = (classified.details ?? {}) as Record<string, unknown>;
        const isNonJson = det && typeof det === "object" && (det["nonJson"] === true || det["invalidJson"] === true);
        if (isNonJson) {
          return apiErrorResponse(
            "Endpoint mismatch (HTML response)",
            "UPSTREAM_ERROR",
            502,
            {
              workspaceSlug,
              friendlyMessage:
                "Endpoint mismatch (HTML response)",
              upstream: classified.details ?? null,
            }
          );
        }
      }

      if (classified.code === "UPSTREAM_NOT_FOUND") {
        return apiErrorResponse(
          `AnythingLLM workspace or API endpoint not found for "${workspaceSlug}".`,
          "UPSTREAM_NOT_FOUND",
          404,
          {
            workspaceSlug,
            friendlyMessage:
              "AnythingLLM returned 404 after trying multiple API routes. This can mean the workspace slug doesn't exist OR your AnythingLLM instance uses different API paths. Check your instance's /api/docs, and verify ANYTHINGLLM_BASE_URL points to the instance root (no trailing /api).",
            upstream: classified.details ?? null,
          }
        );
      }
    }

    // If both search and chat failed, return a single actionable failure (instead of ok:true with partial flags).
    if (!searchOk && !chatOk) {
      const primaryCode = chatCode || searchCode || "UPSTREAM_ERROR";
      const isNotFound = primaryCode === "UPSTREAM_NOT_FOUND";
      const status = isNotFound ? 404 : 502;
      return apiErrorResponse(
        "AnythingLLM connection test failed.",
        toApiErrorCode(primaryCode),
        status,
        {
          workspaceSlug,
          friendlyMessage:
            primaryCode === "UPSTREAM_NOT_FOUND"
              ? "We couldn't find a compatible AnythingLLM API route for this instance/workspace. Verify the workspace slug exists, and confirm the correct API paths in your instance's /api/docs."
              : "We couldn't complete the test against AnythingLLM. Check the error details, verify ANYTHINGLLM_BASE_URL points to the instance root, and confirm your API key is valid.",
          searchError,
          chatError,
          searchDetails,
          chatDetails,
        }
      );
    }

    // Return test results
    return apiSuccessResponse({
      searchOk,
      chatOk,
      workspaceSlug,
      isFallback,
      searchResultsCount,
      chatAnswerPreview,
      sourcesCount,
      searchError: searchError || null,
      chatError: chatError || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

