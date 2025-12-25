/**
 * OBD Brand-Safe Image Generator - Prompt Builder
 * 
 * Builds provider-ready image prompts safely.
 * Prompts exist ONLY in memory during request lifecycle.
 * NEVER persisted to DB, logs, or any storage.
 */

import type { PromptBuildInput, PromptBuildResult } from "./types";

/**
 * Gets aspect ratio composition description.
 */
function getAspectComposition(aspect: string): string {
  switch (aspect) {
    case "1:1":
      return "square composition";
    case "4:5":
      return "vertical layout";
    case "16:9":
      return "wide landscape layout";
    case "4:3":
      return "standard landscape layout";
    default:
      return "balanced composition";
  }
}

/**
 * Gets platform-specific style guidance.
 */
function getPlatformStyle(platform: PromptBuildInput["platform"]): string {
  switch (platform) {
    case "instagram":
      return "modern, visually appealing, Instagram-optimized";
    case "facebook":
      return "clean, professional, Facebook-optimized";
    case "x":
      return "bold, concise, Twitter-optimized";
    case "google_business_profile":
      return "professional, trustworthy, business-optimized";
    case "website":
      return "versatile, web-optimized";
    default:
      return "clean, modern";
  }
}

/**
 * Gets category-specific scene description.
 */
function getCategoryScene(
  category: PromptBuildInput["category"],
  mode: PromptBuildInput["mode"]
): string {
  if (mode === "fallback") {
    return "safe abstract illustration";
  }

  switch (category) {
    case "evergreen":
      return "lifestyle abstract visual, brand-neutral pattern";
    case "promo":
      return "abstract promotional visual, no prices, no text overlays";
    case "event":
      return "generic event atmosphere, abstract celebration visual";
    case "review":
      return "symbolic trust imagery, abstract satisfaction visual, no testimonials";
    case "seasonal":
      return "abstract seasonal visual, brand-neutral";
    case "announcement":
      return "abstract announcement visual, professional tone";
    default:
      return "abstract brand-safe visual";
  }
}

/**
 * Gets vibe descriptor from business hints.
 */
function getVibeDescriptor(
  vibe?: "professional" | "friendly" | "luxury" | "bold"
): string {
  switch (vibe) {
    case "professional":
      return "professional tone";
    case "friendly":
      return "friendly, approachable tone";
    case "luxury":
      return "refined, elegant tone";
    case "bold":
      return "confident, bold tone";
    default:
      return "professional tone";
  }
}

/**
 * Builds a provider-ready image prompt.
 * 
 * Rules:
 * - Generic, non-identifying, brand-safe
 * - Platform-aware
 * - NO business names, real people, claims, pricing
 * - Applies safety negativeRules as negativePrompt
 * - Aspect ratio influences composition wording
 * - Category influences scene description
 * 
 * @param input - Prompt build input
 * @returns Prompt build result (NEVER persisted)
 */
export function buildImagePrompt(input: PromptBuildInput): PromptBuildResult {
  const { platform, category, aspect, safety, businessHints, mode } = input;

  // Build composition description
  const composition = getAspectComposition(aspect);

  // Build platform style
  const platformStyle = getPlatformStyle(platform);

  // Build category scene
  const categoryScene = getCategoryScene(category, mode);

  // Build vibe descriptor
  const vibe = getVibeDescriptor(businessHints?.vibe);

  // Build industry hint (if present, abstract only)
  const industryHint = businessHints?.industry
    ? `, abstract ${businessHints.industry} theme`
    : "";

  // Assemble main prompt
  const promptParts: string[] = [
    `A clean, modern ${categoryScene}`,
    `suitable for a ${platform} post`,
    vibe,
    composition,
    platformStyle,
    "brand-neutral",
    "no text",
    "no people",
    "no identifiable elements",
  ];

  if (industryHint) {
    promptParts.push(industryHint.replace(/^, /, ""));
  }

  const prompt = promptParts.join(", ").trim();

  // Build negative prompt from safety rules
  const negativePromptParts: string[] = [
    ...safety.negativeRules,
    "no real people",
    "no explicit content",
    "no medical claims",
    "no pricing",
    "no guarantees",
  ];

  // Remove duplicates and normalize
  const uniqueNegativeRules = Array.from(
    new Set(negativePromptParts.map((rule) => rule.toLowerCase().trim()))
  );

  const negativePrompt = uniqueNegativeRules.join(", ");

  // Build style hints (for internal reference, not persisted)
  const styleHints: string[] = [platformStyle, vibe, composition];

  return {
    prompt,
    negativePrompt,
    styleHints,
  };
}

