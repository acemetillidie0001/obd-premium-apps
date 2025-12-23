import { getOpenAIClient } from "@/lib/openai-client";

/**
 * Configuration for image generation
 * Centralized in one place for easy updates
 */
export const IMAGE_GENERATION_CONFIG = {
  model: "dall-e-3" as const,
  defaultSize: "1024x1024" as const,
  defaultQuality: "standard" as const,
  defaultStyle: "natural" as const,
} as const;

export interface GenerateImageOptions {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "natural" | "vivid";
}

export interface GenerateImageResult {
  url: string;
}

/**
 * Generate an image using OpenAI's image generation API.
 * 
 * @param options - Image generation options
 * @returns Promise resolving to the image URL
 * @throws Error if image generation fails
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  const openai = getOpenAIClient();

  const response = await openai.images.generate({
    model: IMAGE_GENERATION_CONFIG.model,
    prompt: options.prompt,
    size: options.size || IMAGE_GENERATION_CONFIG.defaultSize,
    quality: options.quality || IMAGE_GENERATION_CONFIG.defaultQuality,
    style: options.style || IMAGE_GENERATION_CONFIG.defaultStyle,
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("Image generated but URL not returned");
  }

  return { url: imageUrl };
}

