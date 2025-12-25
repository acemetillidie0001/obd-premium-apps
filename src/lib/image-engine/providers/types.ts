/**
 * OBD Brand-Safe Image Generator - Provider Adapter Types
 * 
 * Clean, provider-agnostic interface for image generation providers.
 */

export type ImageProviderName = "nano_banana" | "openai";

export interface ProviderGenerateInput {
  requestId: string;
  width: number;
  height: number;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  model?: string;
  style?: string;
  userId?: string;
  orgId?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderGenerateOutput {
  ok: boolean;
  provider: ImageProviderName;
  imageBytes?: Buffer;
  mimeType?: string;
  errorCode?: string;
  errorMessageSafe?: string;
  raw?: unknown;
}

