import OpenAI from "openai";

/**
 * OpenAI Timeout Wrapper
 * 
 * Wraps OpenAI API calls with timeout handling using AbortController.
 * All OpenAI calls should use this utility to prevent hanging requests.
 * 
 * OpenAI SDK supports AbortSignal via the `signal` option in create() calls.
 */

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Execute an OpenAI API call with timeout
 * 
 * OpenAI SDK accepts signal via the options parameter (second arg to create()).
 * This wrapper creates an AbortController and passes the signal correctly.
 * 
 * @param call - Function that performs the OpenAI API call, receives AbortSignal as parameter
 * @param timeoutMs - Timeout in milliseconds (default: 30000 = 30s)
 * @returns The result of the OpenAI API call
 * @throws Error with name "AbortError" if timeout is exceeded
 */
export async function withOpenAITimeout<T>(
  call: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const result = await call(controller.signal);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    // If aborted, throw AbortError
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      const abortError = new Error("Request timeout");
      abortError.name = "AbortError";
      throw abortError;
    }

    // Re-throw original error
    throw error;
  }
}

