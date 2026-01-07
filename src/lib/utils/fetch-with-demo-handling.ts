/**
 * Fetch wrapper with Demo Mode error handling
 * 
 * Intercepts 403 responses with DEMO_READ_ONLY error and shows a toast notification.
 * All other responses pass through unchanged.
 * 
 * Usage:
 *   import { fetchWithDemoHandling } from "@/lib/utils/fetch-with-demo-handling";
 *   const res = await fetchWithDemoHandling("/api/endpoint", { method: "POST", ... });
 */

import { showDemoToast } from "./demo-toast";

/**
 * Check if a response is a Demo Mode read-only error
 */
async function isDemoReadOnlyError(response: Response): Promise<boolean> {
  if (response.status !== 403) {
    return false;
  }

  try {
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return false;
    }

    // Clone the response to read the body without consuming it
    const clonedResponse = response.clone();
    const json = await clonedResponse.json();

    return json?.error === "DEMO_READ_ONLY";
  } catch {
    // If parsing fails, it's not a DEMO_READ_ONLY error
    return false;
  }
}

/**
 * Fetch wrapper that handles Demo Mode read-only errors
 * 
 * If a 403 response contains { error: "DEMO_READ_ONLY" }, it will:
 * 1. Show a toast notification
 * 2. Return the response unchanged (so existing error handling still works)
 * 
 * All other responses pass through unchanged.
 */
export async function fetchWithDemoHandling(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  // Check for Demo Mode read-only error
  if (await isDemoReadOnlyError(response)) {
    // Show toast notification
    showDemoToast();
  }

  // Return response unchanged (existing error handling continues to work)
  return response;
}

