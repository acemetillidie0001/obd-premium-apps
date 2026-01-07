/**
 * Global Fetch Interceptor for Demo Mode
 * 
 * Patches the global fetch function to automatically handle DEMO_READ_ONLY errors.
 * This ensures all fetch calls (including existing code) show toast notifications
 * when demo mode blocks mutations.
 * 
 * Should be initialized once on client-side mount.
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
 * Initialize global fetch interceptor
 * 
 * Patches the native fetch function to intercept DEMO_READ_ONLY errors
 * and show toast notifications. Should be called once on client-side initialization.
 * 
 * This ensures all fetch calls (including existing code) automatically
 * show toast notifications when demo mode blocks mutations.
 */
export function initGlobalFetchInterceptor(): void {
  if (typeof window === "undefined") {
    return; // SSR-safe
  }

  // Store original fetch
  const originalFetch = window.fetch;

  // Patch fetch
  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Call original fetch
    const response = await originalFetch(input, init);

    // Check for Demo Mode read-only error
    if (await isDemoReadOnlyError(response)) {
      // Show toast notification
      showDemoToast();
    }

    // Return response unchanged (existing error handling continues to work)
    return response;
  };
}

