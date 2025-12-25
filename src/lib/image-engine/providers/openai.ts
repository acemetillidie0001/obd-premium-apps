/**
 * OBD Brand-Safe Image Generator - OpenAI Provider Adapter
 * 
 * Real wiring ready but safe stub for OpenAI image generation.
 * Checks for API key but returns safe error until enabled.
 */

import type {
  ProviderGenerateInput,
  ProviderGenerateOutput,
} from "./types";

/**
 * Generates an image using OpenAI provider.
 * 
 * @param input - Provider generation input
 * @returns Provider generation output (currently returns error stub)
 */
export async function generateWithOpenAI(
  input: ProviderGenerateInput
): Promise<ProviderGenerateOutput> {
  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      ok: false,
      provider: "openai",
      errorCode: "API_KEY_MISSING",
      errorMessageSafe: "OpenAI API key not configured",
    };
  }

  // Safe stub - returns error indicating not enabled in this build
  return {
    ok: false,
    provider: "openai",
    errorCode: "NOT_ENABLED",
    errorMessageSafe: "OpenAI image generation not enabled in this build",
  };
}

