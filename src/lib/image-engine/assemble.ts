/**
 * OBD Brand-Safe Image Generator - Prompt Assembly
 * 
 * Assembles provider-ready prompts from decision plans.
 * Internal only - never exposed to end users.
 */

import type { ImageEngineDecision } from "./types";

/**
 * Assembles a provider-ready prompt string from a decision's prompt plan.
 * 
 * Rules:
 * - Must include negativeRules explicitly
 * - Must include category + platform + aspect intent
 * - Must include "abstract / non-literal / no identifiable people" guardrails
 * - Never include business name
 * - Never include logos
 * - Never include "real review" language
 * - Keep prompt concise and consistent
 */
export function assembleProviderPrompt(decision: ImageEngineDecision): string {
  const { promptPlan, platform, category, aspect, energy } = decision;

  // Build base intent from category and platform
  const categoryIntent = getCategoryIntent(category, platform);
  const energyDescriptor = getEnergyDescriptor(energy);

  // Build style guidance from variables
  const styleTone = promptPlan.variables.styleTone || "clean";
  const localeHint = promptPlan.variables.localeAbstract
    ? `, ${promptPlan.variables.localeAbstract}`
    : "";

  // Build color guidance (if present)
  const colorGuidance = buildColorGuidance(promptPlan.variables);

  // Build industry context (if present)
  const industryContext = promptPlan.variables.industry
    ? `, abstract ${promptPlan.variables.industry} theme`
    : "";

  // Assemble main prompt
  const mainPrompt = `${categoryIntent}, ${energyDescriptor} energy${localeHint}${industryContext}${colorGuidance}, ${styleTone} style, abstract and non-literal visual, no identifiable people, no faces, no real locations`;

  // Add negative rules explicitly
  const negativeRulesText = promptPlan.negativeRules
    .map((rule) => rule.replace(/^no /i, ""))
    .join(", ");

  // Combine into final prompt
  const fullPrompt = `${mainPrompt}. Must not include: ${negativeRulesText}.`;

  return fullPrompt.trim();
}

/**
 * Gets category-specific intent description.
 */
function getCategoryIntent(
  category: ImageEngineDecision["category"],
  platform: ImageEngineDecision["platform"]
): string {
  switch (category) {
    case "educational":
      return "Abstract educational visual about business tips and insights";
    case "promotion":
      return "Abstract promotional visual with high energy";
    case "social_proof":
      return "Abstract trust and quality visual, no testimonials or reviews";
    case "local_abstract":
      return "Abstract local community visual";
    case "evergreen":
      return "Abstract evergreen brand pattern visual";
    default:
      return "Abstract visual";
  }
}

/**
 * Gets energy descriptor.
 */
function getEnergyDescriptor(energy: ImageEngineDecision["energy"]): string {
  switch (energy) {
    case "low":
      return "calm";
    case "medium":
      return "balanced";
    case "high":
      return "dynamic";
    default:
      return "balanced";
  }
}

/**
 * Builds color guidance from variables (if colors are present).
 */
function buildColorGuidance(variables: Record<string, string>): string {
  const colors: string[] = [];
  if (variables.primaryColorHex) {
    colors.push(`primary color ${variables.primaryColorHex}`);
  }
  if (variables.accentColorHex) {
    colors.push(`accent color ${variables.accentColorHex}`);
  }
  if (colors.length > 0) {
    return `, color palette: ${colors.join(", ")}`;
  }
  return "";
}

