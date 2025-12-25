/**
 * OBD Brand-Safe Image Generator - Provider Registry
 * 
 * Manages provider selection and instantiation.
 */

import type { ImageProvider, ImageProviderId } from "../types";
import { nanoBananaFlashProvider } from "./nanoBananaFlash";
import { stubProvider } from "./stub";
import type {
  ImageProviderName,
  ProviderGenerateInput,
  ProviderGenerateOutput,
} from "./types";
import { generateWithNanoBanana } from "./nano-banana";
import { generateWithOpenAI } from "./openai";

/**
 * Gets a provider instance by ID.
 * 
 * @param providerId - Provider identifier
 * @returns Provider instance
 * @throws Error if provider is not found
 */
export function getProvider(providerId: ImageProviderId): ImageProvider {
  switch (providerId) {
    case "nano_banana":
      return nanoBananaFlashProvider;
    case "openai":
      // TODO: Implement OpenAI provider in Phase 2B
      throw new Error("OpenAI provider not yet implemented");
    case "other":
      // Fallback to stub for unknown providers
      return stubProvider;
    default:
      return stubProvider;
  }
}

/**
 * Generates an image using the specified provider adapter.
 * 
 * This is the new provider-agnostic entry point that routes to
 * provider-specific adapters.
 * 
 * @param provider - Provider name
 * @param input - Provider generation input
 * @returns Provider generation output
 */
export async function generateWithProvider(
  provider: ImageProviderName,
  input: ProviderGenerateInput
): Promise<ProviderGenerateOutput> {
  switch (provider) {
    case "nano_banana":
      return await generateWithNanoBanana(input);
    case "openai":
      return await generateWithOpenAI(input);
    default:
      return {
        ok: false,
        provider: "nano_banana", // Default fallback
        errorCode: "UNKNOWN_PROVIDER",
        errorMessageSafe: `Unknown provider: ${provider}`,
      };
  }
}

