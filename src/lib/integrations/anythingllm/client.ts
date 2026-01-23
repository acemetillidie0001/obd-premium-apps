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

type AnythingLLMUpstreamErrorCode =
  | "UPSTREAM_BAD_REQUEST"
  | "UPSTREAM_UNAUTHORIZED"
  | "UPSTREAM_FORBIDDEN"
  | "UPSTREAM_NOT_FOUND"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR";

type AnythingLLMUpstreamError = Error & {
  code?: AnythingLLMUpstreamErrorCode;
  status?: number;
  details?: unknown;
};

/**
 * AnythingLLM Client Configuration
 */
interface AnythingLLMConfig {
  /**
   * Resolved API base URL (AnythingLLM v1): https://host/api/v1
   */
  apiBase: string;
  /**
   * Normalized origin/root URL (ex: https://host)
   */
  baseOrigin: string;
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
 * AnythingLLM v1 search endpoint (vector search)
 */
const SEARCH_ENDPOINT_CANDIDATES = [
  "/workspace/{slug}/vector-search",
] as const;

/**
 * AnythingLLM v1 chat endpoint
 */
const CHAT_ENDPOINT_CANDIDATES = [
  "/workspace/{slug}/chat",
] as const;

/**
 * Parse and validate ANYTHINGLLM_BASE_URL.
 *
 * Requirement: MUST be origin-only (no path), e.g.
 *   https://anythingllm.example.com
 */
function parseBaseOrigin(raw: string): string {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      "ANYTHINGLLM_BASE_URL must be a full URL origin (e.g. https://anythingllm.example.com)"
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(
      "ANYTHINGLLM_BASE_URL must start with http:// or https://"
    );
  }

  // Enforce origin-only: no pathname beyond "/"
  const pathname = url.pathname || "/";
  if (pathname !== "/" && pathname !== "") {
    throw new Error(
      "ANYTHINGLLM_BASE_URL must be the instance origin only (no /api, no /api/v1). Example: https://anythingllm.example.com"
    );
  }

  return url.origin;
}

/**
 * Get AnythingLLM config inputs from environment variables
 */
function getEnvConfig(): Omit<AnythingLLMConfig, "apiBase"> {
  const rawBaseUrl = process.env.ANYTHINGLLM_BASE_URL;
  if (!rawBaseUrl) {
    throw new Error(
      "ANYTHINGLLM_BASE_URL environment variable is required"
    );
  }

  const baseOrigin = parseBaseOrigin(rawBaseUrl);

  return {
    baseOrigin,
    apiKey: process.env.ANYTHINGLLM_API_KEY,
    timeoutMs: process.env.ANYTHINGLLM_TIMEOUT_MS
      ? parseInt(process.env.ANYTHINGLLM_TIMEOUT_MS, 10)
      : 30000, // Default 30s timeout
  };
}

/**
 * Build request headers including AnythingLLM auth.
 * - Always sends Authorization Bearer
 * - Also sends x-api-key as a harmless fallback (some installs/gateways use it)
 */
function buildHeaders(options: RequestInit = {}): Record<string, string> {
  const env = getEnvConfig();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

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

  if (env.apiKey) {
    headers.Authorization = `Bearer ${env.apiKey}`;
    // Lowercase header name is fine; fetch will normalize.
    headers["x-api-key"] = env.apiKey;
  }

  return headers;
}

/**
 * Fetch JSON with explicit non-JSON detection.
 * If the upstream responds with HTML (common when hitting the UI server instead of API),
 * throw an error including status + a short snippet to aid debugging.
 */
async function fetchJson<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ response: Response; data: T }> {
  const env = getEnvConfig();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers: buildHeaders(options),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";
    const isJson = /application\/json|[+\/]json/i.test(contentType);

    if (!isJson) {
      const text = await response.text().catch(() => "");
      const snippet = text.slice(0, 200);
      const err: AnythingLLMUpstreamError = new Error(
        `AnythingLLM returned non-JSON response (status ${response.status}). First 200 chars: ${snippet}`
      );
      err.code = "UPSTREAM_ERROR";
      err.status = response.status;
      err.details = {
        nonJson: true,
        contentType: contentType || null,
        snippet,
      };
      throw err;
    }

    try {
      const data = (await response.json()) as T;
      return { response, data };
    } catch (parseError) {
      const text = await response.text().catch(() => "");
      const snippet = text.slice(0, 200);
      const err: AnythingLLMUpstreamError = new Error(
        `Invalid JSON response from AnythingLLM (status ${response.status}). First 200 chars: ${snippet}`
      );
      err.code = "UPSTREAM_ERROR";
      err.status = response.status;
      err.details = {
        invalidJson: true,
        snippet,
      };
      apiLogger.error("anythingllm.client.parse-error", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      throw err;
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      const err: AnythingLLMUpstreamError = new Error("AnythingLLM request timeout");
      err.code = "UPSTREAM_TIMEOUT";
      throw err;
    }

    throw error;
  }
}

/**
 * Get AnythingLLM configuration (AnythingLLM v1 API only)
 */
async function getConfig(): Promise<AnythingLLMConfig> {
  const env = getEnvConfig();
  return { ...env, apiBase: `${env.baseOrigin}/api/v1` };
}

/**
 * List workspaces (AnythingLLM v1)
 * Used for auth verification and (optionally) for determining whether a workspace slug exists.
 */
export async function listWorkspaces(): Promise<unknown> {
  const { data } = await makeRequest<unknown>("/workspaces", { method: "GET" });
  return data;
}

/**
 * Make a request to AnythingLLM API with timeout, retry, and error handling
 */
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<{ response: Response; data: T }> {
  const config = await getConfig();
  const url = `${config.apiBase}${endpoint}`;

  try {
    const { response, data } = await fetchJson<T>(url, options);

    if (!response.ok) {
      // Don't log full upstream payload to avoid leaking secrets
      apiLogger.error("anythingllm.client.request-error", {
        status: response.status,
        statusText: response.statusText,
        endpoint,
      });

      const upstreamError: AnythingLLMUpstreamError = new Error(
        `AnythingLLM API error: ${response.statusText || String(response.status)}`
      );
      upstreamError.status = response.status;
      upstreamError.details = {
        endpoint,
        status: response.status,
        statusText: response.statusText,
      };

      if (response.status === 401) {
        upstreamError.code = "UPSTREAM_UNAUTHORIZED";
        upstreamError.message = "AnythingLLM authentication failed";
        throw upstreamError;
      }
      if (response.status === 403) {
        upstreamError.code = "UPSTREAM_FORBIDDEN";
        upstreamError.message = "AnythingLLM access forbidden";
        throw upstreamError;
      }
      if (response.status === 404) {
        upstreamError.code = "UPSTREAM_NOT_FOUND";
        upstreamError.message = "AnythingLLM endpoint or workspace not found";
        throw upstreamError;
      }

      if (response.status >= 400 && response.status < 500) {
        upstreamError.code = "UPSTREAM_BAD_REQUEST";
        throw upstreamError;
      }

      upstreamError.code = "UPSTREAM_ERROR";
      throw upstreamError;
    }

    return { response, data };
  } catch (error) {
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
        endpoint,
        attempt: retryCount + 1,
      });
      // Wait a bit before retry (exponential backoff would be better, but simple delay is fine)
      await new Promise(resolve => setTimeout(resolve, 500));
      return makeRequest<T>(endpoint, options, retryCount + 1);
    }

    // Re-throw other errors, tagging network errors for callers
    if (isNetworkError) {
      const err: AnythingLLMUpstreamError =
        error instanceof Error ? error : new Error(String(error));
      err.code = err.code ?? "UPSTREAM_ERROR";
      throw err;
    }

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
  requestBody: unknown | ((endpoint: string) => unknown),
  cachedEndpoint?: string
): Promise<{ endpoint: string; data: T }> {
  const config = await getConfig();
  
  // If we have a cached endpoint, try it first
  const endpointsToTry = cachedEndpoint 
    ? [cachedEndpoint, ...candidates.map(pattern => pattern.replace("{slug}", workspaceSlug))]
    : candidates.map(pattern => pattern.replace("{slug}", workspaceSlug));

  const triedEndpoints: string[] = [];
  let lastError: Error | null = null;
  let sawNotFound = false;

  for (const endpoint of endpointsToTry) {
    // Skip duplicates
    if (triedEndpoints.includes(endpoint)) {
      continue;
    }
    triedEndpoints.push(endpoint);

    try {
      const { data } = await makeRequest<T>(endpoint, {
        method: "POST",
        body: JSON.stringify(
          typeof requestBody === "function" ? requestBody(endpoint) : requestBody
        ),
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
        endpoint,
      });

      return { endpoint, data };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      const code = (err as AnythingLLMUpstreamError).code;

      // Auth/permission problems are definitive; don't try other endpoints.
      if (code === "UPSTREAM_UNAUTHORIZED" || code === "UPSTREAM_FORBIDDEN") {
        throw err;
      }

      // Bad request likely means our payload doesn't match this endpoint.
      // Trying other endpoints may still work (different contract), so continue.
      if (code === "UPSTREAM_BAD_REQUEST") {
        continue;
      }

      // Not found could be workspace slug OR endpoint mismatch; keep trying.
      if (code === "UPSTREAM_NOT_FOUND") {
        sawNotFound = true;
        continue;
      }

      // Timeouts/network errors: try next candidate (may not help, but safe).
      if (code === "UPSTREAM_TIMEOUT" || code === "UPSTREAM_ERROR") {
        continue;
      }
      
      // Unknown error type: stop early
      break;
    }
  }

  // If we have a typed upstream error, prefer surfacing it.
  if (lastError && (lastError as AnythingLLMUpstreamError).code && !sawNotFound) {
    throw lastError;
  }

  // If we saw only not-found-ish responses, throw a not-found error with diagnostics.
  const notFoundErr: AnythingLLMUpstreamError = new Error(
    `AnythingLLM ${endpointType} endpoints not found for workspace: ${workspaceSlug}`
  );
  notFoundErr.code = "UPSTREAM_NOT_FOUND";
  notFoundErr.details = {
    triedEndpoints,
    apiBase: config.apiBase,
    baseOrigin: config.baseOrigin,
  };

  // Log failure without leaking secrets
  apiLogger.error("anythingllm.client.all-endpoints-failed", {
    workspaceSlug,
    endpointType,
    triedCount: triedEndpoints.length,
    lastError: lastError?.message,
  });

  throw notFoundErr;
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
      (endpoint: string) => {
        // AnythingLLM v1 uses /vector-search with { query, topN }
        if (endpoint.includes("/vector-search")) {
          return { query, topN: limit };
        }
        return { query, topN: limit };
      },
      cachedEndpoint
    );

    const results = normalizeSearchResults(data);
    return { results };
  } catch (error) {
    // Error already logged in tryEndpoints
    // Re-throw with proper structure if it's one of our upstream errors
    if (error instanceof Error && "code" in error && String(error.code).startsWith("UPSTREAM_")) {
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
    // Re-throw with proper structure if it's one of our upstream errors
    if (error instanceof Error && "code" in error && String(error.code).startsWith("UPSTREAM_")) {
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
