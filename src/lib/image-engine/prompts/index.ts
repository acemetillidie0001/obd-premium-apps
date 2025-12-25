/**
 * OBD Brand-Safe Image Generator - Prompts Module
 * 
 * Prompt and alt text builders.
 * Prompts exist ONLY in memory - never persisted.
 */

export { buildImagePrompt } from "./buildPrompt";
export { buildAltText } from "./buildAltText";
export type { PromptBuildInput, PromptBuildResult } from "./types";

