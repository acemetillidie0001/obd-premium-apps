/**
 * OBD Brand-Safe Image Generator - Prompt Builder Types
 * 
 * Types for building provider-ready prompts and alt text.
 * Prompts exist ONLY in memory - never persisted.
 */

export interface PromptBuildInput {
  requestId: string;
  platform: "instagram" | "facebook" | "x" | "google_business_profile" | "website";
  category: "evergreen" | "promo" | "event" | "review" | "seasonal" | "announcement";
  aspect: string;
  safety: {
    negativeRules: string[];
    verdict: "allow" | "fallback" | "block";
  };
  businessHints?: {
    industry?: string;
    vibe?: "professional" | "friendly" | "luxury" | "bold";
  };
  mode: "generate" | "fallback";
}

export interface PromptBuildResult {
  prompt: string; // NEVER persisted
  negativePrompt?: string; // NEVER persisted
  styleHints: string[];
}

