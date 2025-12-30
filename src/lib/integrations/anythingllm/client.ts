/**
 * AnythingLLM API Client
 * 
 * Thin client wrapper for AnythingLLM API calls.
 * Handles authentication, error handling, response normalization, and endpoint discovery.
 */

import { apiLogger } from "@/lib/api/logger";
import type {
  AnythingLLMSearchResponse,
  AnythingLLMChatResponse,
  SearchResult,
  ChatSource,
} from "@/lib/apps/ai-help-desk/types";

/**
 * AnythingLLM Client Configuration
 */
interface AnythingLLMConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * Endpoint cache for resolved endpoints per workspace slug
 */
const endpointCache = new Map<string, {
  search?: string;
  chat?: string;
}>();

/**
 * Candidate endpoint patterns for search (in order of preference)
 */
const SEARCH_ENDPOINT_CANDIDATES = [
  "/api/workspaces/{slug}/search",
  "/api/workspace/{slug}/search",
  "/api/search/{slug}",
  "/api/query/{slug}",
] as const;

/**
 * Candidate endpoint patterns for chat (in order of preference)
 */
const CHAT_ENDPOINT_CANDIDATES = [
  "/api/workspaces/{slug}/chat",
  "/api/workspace/{slug}/chat",
  "/api/chat/{slug}",
  "/api/conversation/{slug}",
] as const;

/**
 * Get AnythingLLM configuration from environment variables
 */
function getConfig(): AnythingLLMConfig {
  const baseUrl = process.env.ANYTHINGLLM_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "ANYTHINGLLM_BASE_URL environment variable is required"
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""), // Remove trailing slash
    apiKey: process.env.ANYTHINGLLM_API_KEY,
    timeoutMs: process.env.ANYTHINGLLM_TIMEOUT_MS
      ? parseInt(process.env.ANYTHINGLLM_TIMEOUT_MS, 10)
      : 30000, // Default 30s timeout
  };
}

/**
 * Make a request to AnythingLLM API with timeout, retry, and error handling
 */
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<{ response: Response; data: T }> {
  const config = getConfig();
  const url = `${config.baseUrl}${endpoint}`;

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Merge in any existing headers from options
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, options.headers);
    }
  }

  // Add API key if provided
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    config.timeoutMs
  );

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      
      // Don't log full error text to avoid leaking secrets
      apiLogger.error("anythingllm.client.request-error", {
        status: response.status,
        statusText: response.statusText,
        endpoint: endpoint.replace(config.baseUrl, ""),
        hasErrorText: !!errorText,
      });

      // 4xx errors should not be retried
      if (response.status >= 400 && response.status < 500) {
        if (response.status === 401) {
          throw new Error("AnythingLLM authentication failed");
        }
        if (response.status === 404) {
          throw new Error("AnythingLLM workspace not found");
        }
        throw new Error(`AnythingLLM API error: ${response.statusText}`);
      }

      // 5xx errors can be retried (handled below)
      throw new Error(`AnythingLLM server error: ${response.statusText}`);
    }

    // Parse JSON response
    try {
      const data = await response.json();
      return { response, data };
    } catch (parseError) {
      apiLogger.error("anythingllm.client.parse-error", {
        endpoint: endpoint.replace(config.baseUrl, ""),
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      throw new Error("Invalid JSON response from AnythingLLM");
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AnythingLLM request timeout");
    }

    // Retry network failures (not 4xx errors) once
    const isNetworkError = 
      error instanceof TypeError || // fetch network errors
      (error instanceof Error && (
        error.message.includes("network") ||
        error.message.includes("fetch") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ETIMEDOUT")
      ));

    if (isNetworkError && retryCount === 0) {
      apiLogger.error("anythingllm.client.network-retry", {
        endpoint: endpoint.replace(config.baseUrl, ""),
        attempt: retryCount + 1,
      });
      // Wait a bit before retry (exponential backoff would be better, but simple delay is fine)
      await new Promise(resolve => setTimeout(resolve, 500));
      return makeRequest<T>(endpoint, options, retryCount + 1);
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Try multiple endpoint candidates until one succeeds
 * Returns the successful endpoint path, or throws if all fail
 */
async function tryEndpoints<T>(
  workspaceSlug: string,
  endpointType: "search" | "chat",
  candidates: readonly string[],
  requestBody: unknown,
  cachedEndpoint?: string
): Promise<{ endpoint: string; data: T }> {
  const config = getConfig();
  
  // If we have a cached endpoint, try it first
  const endpointsToTry = cachedEndpoint 
    ? [cachedEndpoint, ...candidates.map(pattern => pattern.replace("{slug}", workspaceSlug))]
    : candidates.map(pattern => pattern.replace("{slug}", workspaceSlug));

  const triedEndpoints: string[] = [];
  let lastError: Error | null = null;

  for (const endpoint of endpointsToTry) {
    // Skip duplicates
    if (triedEndpoints.includes(endpoint)) {
      continue;
    }
    triedEndpoints.push(endpoint);

    try {
      const { data } = await makeRequest<T>(endpoint, {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      // Cache the successful endpoint
      const cacheKey = workspaceSlug;
      const cached = endpointCache.get(cacheKey) || {};
      cached[endpointType] = endpoint;
      endpointCache.set(cacheKey, cached);

      // Log resolved endpoint once (debug level)
      apiLogger.debug("anythingllm.client.endpoint-resolved", {
        workspaceSlug,
        endpointType,
        endpoint: endpoint.replace(config.baseUrl, ""),
      });

      return { endpoint, data };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If it's a 404, try next endpoint
      // If it's a network error and we're on the first attempt, the retry logic will handle it
      // Otherwise, continue to next endpoint
      if (
        error instanceof Error &&
        !error.message.includes("404") &&
        !error.message.includes("not found") &&
        !error.message.includes("timeout") &&
        !error.message.includes("network")
      ) {
        // Non-404, non-network error - don't try other endpoints
        break;
      }
      continue;
    }
  }

  // All endpoints failed - throw with diagnostics
  const error = new Error(
    `All ${endpointType} endpoints failed for workspace: ${workspaceSlug}`
  ) as Error & {
    code?: string;
    details?: {
      triedEndpoints: string[];
      baseUrl: string;
    };
  };

  error.code = "UPSTREAM_NOT_FOUND";
  error.details = {
    triedEndpoints: triedEndpoints.map(e => e.replace(config.baseUrl, "")),
    baseUrl: config.baseUrl,
  };

  // Log failure without leaking secrets
  apiLogger.error("anythingllm.client.all-endpoints-failed", {
    workspaceSlug,
    endpointType,
    triedCount: triedEndpoints.length,
    lastError: lastError?.message,
  });

  throw error;
}

/**
 * Search a workspace for documents/content
 * 
 * @param workspaceSlug - The workspace slug to search in
 * @param query - Search query
 * @param limit - Maximum number of results (default: 10)
 * @returns Normalized search results
 */
export async function searchWorkspace(
  workspaceSlug: string,
  query: string,
  limit: number = 10
): Promise<AnythingLLMSearchResponse> {
  try {
    // Get cached endpoint if available
    const cached = endpointCache.get(workspaceSlug);
    const cachedEndpoint = cached?.search;

    // Try endpoints in order
    const { data } = await tryEndpoints<{
      results?: Array<{
        id?: string;
        title?: string;
        snippet?: string;
        text?: string;
        content?: string;
        sourceType?: string;
        score?: number;
        metadata?: Record<string, unknown>;
      }>;
      data?: Array<unknown>;
    }>(
      workspaceSlug,
      "search",
      SEARCH_ENDPOINT_CANDIDATES,
      { query, limit },
      cachedEndpoint
    );

    // Normalize response from various possible shapes
    const results = normalizeSearchResults(data);
    return { results };
  } catch (error) {
    // Error already logged in tryEndpoints
    // Re-throw with proper structure if it's our custom error
    if (error instanceof Error && "code" in error && error.code === "UPSTREAM_NOT_FOUND") {
      throw error;
    }

    // Wrap other errors
    apiLogger.error("anythingllm.client.search-error", {
      workspaceSlug,
      query: query.substring(0, 100), // Log first 100 chars only
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Normalize search results from various AnythingLLM response shapes
 */
function normalizeSearchResults(
  response: unknown
): SearchResult[] {
  // Handle different response shapes
  let results: unknown[] = [];

  if (response && typeof response === "object") {
    if ("results" in response && Array.isArray(response.results)) {
      results = response.results;
    } else if ("data" in response && Array.isArray(response.data)) {
      results = response.data;
    }
  }

  // Map to normalized SearchResult format
  return results.map((item, index) => {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      return {
        id: String(obj.id ?? obj.docId ?? index),
        title:
          String(obj.title ?? obj.name ?? obj.filename ?? "Untitled"),
        snippet: String(
          obj.snippet ??
          obj.text ??
          obj.content ??
          obj.excerpt ??
          ""
        ),
        sourceType: obj.sourceType
          ? String(obj.sourceType)
          : undefined,
        score:
          typeof obj.score === "number" ? obj.score : undefined,
      };
    }

    // Fallback for unexpected shapes
    return {
      id: String(index),
      title: "Untitled",
      snippet: String(item ?? ""),
    };
  });
}

/**
 * Send a chat message to a workspace
 * 
 * @param workspaceSlug - The workspace slug
 * @param message - User message
 * @param threadId - Optional thread ID for conversation continuity
 * @returns Normalized chat response
 */
export async function chatWorkspace(
  workspaceSlug: string,
  message: string,
  threadId?: string
): Promise<AnythingLLMChatResponse> {
  try {
    // Get cached endpoint if available
    const cached = endpointCache.get(workspaceSlug);
    const cachedEndpoint = cached?.chat;

    // Build request body
    const body: Record<string, unknown> = { message };
    if (threadId) {
      body.threadId = threadId;
    }

    // Try endpoints in order
    const { data } = await tryEndpoints<{
      answer?: string;
      response?: string;
      text?: string;
      threadId?: string;
      sources?: Array<{
        id?: string;
        title?: string;
        snippet?: string;
        name?: string;
      }>;
      references?: Array<unknown>;
    }>(
      workspaceSlug,
      "chat",
      CHAT_ENDPOINT_CANDIDATES,
      body,
      cachedEndpoint
    );

    // Normalize response
    return normalizeChatResponse(data);
  } catch (error) {
    // Error already logged in tryEndpoints
    // Re-throw with proper structure if it's our custom error
    if (error instanceof Error && "code" in error && error.code === "UPSTREAM_NOT_FOUND") {
      throw error;
    }

    // Wrap other errors
    apiLogger.error("anythingllm.client.chat-error", {
      workspaceSlug,
      message: message.substring(0, 100), // Log first 100 chars only
      threadId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Normalize chat response from various AnythingLLM response shapes
 */
function normalizeChatResponse(response: unknown): AnythingLLMChatResponse {
  if (!response || typeof response !== "object") {
    return {
      answer: "I'm sorry, I couldn't generate a response. Please try again.",
    };
  }

  const obj = response as Record<string, unknown>;

  // Extract answer text
  const answer =
    String(obj.answer ?? obj.response ?? obj.text ?? "") || 
    "I'm sorry, I couldn't generate a response. Please try again.";

  // Extract thread ID
  const threadId = obj.threadId ? String(obj.threadId) : undefined;

  // Extract sources
  let sources: ChatSource[] | undefined;
  const rawSources = obj.sources ?? obj.references;
  if (Array.isArray(rawSources) && rawSources.length > 0) {
    sources = rawSources.map((source, index) => {
      if (source && typeof source === "object") {
        const src = source as Record<string, unknown>;
        return {
          id: String(src.id ?? src.docId ?? index),
          title: String(src.title ?? src.name ?? "Source"),
          snippet: src.snippet ? String(src.snippet) : undefined,
        };
      }
      return {
        id: String(index),
        title: "Source",
      };
    });
  }

  return {
    answer,
    threadId,
    sources,
  };
}
