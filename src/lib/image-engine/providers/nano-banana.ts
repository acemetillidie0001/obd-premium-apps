/**
 * OBD Brand-Safe Image Generator - Nano Banana Provider Adapter
 * 
 * Real implementation using Gemini 2.5 Flash Image API.
 * Prompts exist ONLY in memory - never logged or stored.
 */

import type {
  ProviderGenerateInput,
  ProviderGenerateOutput,
} from "./types";

/**
 * Gemini API endpoint.
 */
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

/**
 * Request timeout in milliseconds.
 */
const REQUEST_TIMEOUT_MS = 25000;

/**
 * Determines aspect ratio string from width and height.
 */
function determineAspectRatio(
  width: number,
  height: number,
  metadata?: Record<string, unknown>
): string {
  // Check metadata first
  if (metadata?.aspect && typeof metadata.aspect === "string") {
    const aspect = metadata.aspect as string;
    if (["1:1", "4:5", "16:9", "4:3", "9:16"].includes(aspect)) {
      return aspect;
    }
  }

  // Infer from dimensions
  if (width === height) {
    return "1:1";
  }

  const ratio = width / height;

  if (width > height) {
    // Landscape
    if (Math.abs(ratio - 16 / 9) < Math.abs(ratio - 4 / 3)) {
      return "16:9";
    }
    return "4:3";
  } else {
    // Portrait
    if (Math.abs(ratio - 4 / 5) < Math.abs(ratio - 9 / 16)) {
      return "4:5";
    }
    return "9:16";
  }
}

/**
 * Builds the prompt text with negative prompt constraints (in memory only).
 */
function buildPromptWithConstraints(
  prompt: string,
  negativePrompt?: string
): string {
  if (!negativePrompt || negativePrompt.trim().length === 0) {
    return prompt;
  }

  // Append constraints section (in memory only, never stored)
  return `${prompt}\n\nConstraints: ${negativePrompt}`;
}

/**
 * Generates an image using Nano Banana (Gemini 2.5 Flash Image) provider.
 * 
 * @param input - Provider generation input
 * @returns Provider generation output
 */
export async function generateWithNanoBanana(
  input: ProviderGenerateInput
): Promise<ProviderGenerateOutput> {
  // Check for API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      ok: false,
      provider: "nano_banana",
      errorCode: "MISSING_GEMINI_API_KEY",
      errorMessageSafe: "Gemini API key not configured",
    };
  }

  // Build prompt with constraints (in memory only)
  const promptText = buildPromptWithConstraints(input.prompt, input.negativePrompt);

  // Determine aspect ratio
  const aspectRatio = determineAspectRatio(input.width, input.height, input.metadata);

  // Build request body
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: promptText, // Prompt exists only in memory
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["Image"],
      imageConfig: {
        aspectRatio: aspectRatio,
      },
    },
  };

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Make API call
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-200 responses
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error?.message && typeof errorJson.error.message === "string") {
          // Use safe error message (no prompt content)
          errorMessage = `HTTP ${response.status}: ${errorJson.error.message}`;
        }
      } catch {
        // Ignore JSON parse errors, use status only
      }

      return {
        ok: false,
        provider: "nano_banana",
        errorCode: "GEMINI_HTTP_ERROR",
        errorMessageSafe: errorMessage,
        raw: {
          model: "gemini-2.5-flash-image",
          status: response.status,
        },
      };
    }

    // Parse response JSON
    let responseJson: unknown;
    try {
      responseJson = await response.json();
    } catch (parseError) {
      return {
        ok: false,
        provider: "nano_banana",
        errorCode: "GEMINI_BAD_RESPONSE",
        errorMessageSafe: "Failed to parse Gemini API response",
        raw: {
          model: "gemini-2.5-flash-image",
        },
      };
    }

    // Extract image data from response
    const responseData = responseJson as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              data?: string;
              mimeType?: string;
            };
          }>;
        };
      }>;
    };

    // Find first inline image
    const candidate = responseData.candidates?.[0];
    if (!candidate) {
      return {
        ok: false,
        provider: "nano_banana",
        errorCode: "NO_IMAGE_RETURNED",
        errorMessageSafe: "Gemini API did not return an image",
        raw: {
          model: "gemini-2.5-flash-image",
        },
      };
    }

    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        // Decode base64 image data
        const imageBytes = Buffer.from(part.inlineData.data, "base64");
        const mimeType = part.inlineData.mimeType || "image/png";

        return {
          ok: true,
          provider: "nano_banana",
          imageBytes,
          mimeType,
          raw: {
            model: "gemini-2.5-flash-image",
          },
        };
      }
    }

    // No image found in response
    return {
      ok: false,
      provider: "nano_banana",
      errorCode: "NO_IMAGE_RETURNED",
      errorMessageSafe: "Gemini API response did not contain image data",
      raw: {
        model: "gemini-2.5-flash-image",
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        provider: "nano_banana",
        errorCode: "GEMINI_TIMEOUT",
        errorMessageSafe: "Gemini API request timed out",
        raw: {
          model: "gemini-2.5-flash-image",
        },
      };
    }

    // Handle other errors
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    
    return {
      ok: false,
      provider: "nano_banana",
      errorCode: "GEMINI_ERROR",
      errorMessageSafe: `Gemini API error: ${errorMessage}`,
      raw: {
        model: "gemini-2.5-flash-image",
      },
    };
  }
}

