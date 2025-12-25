/**
 * OBD Brand-Safe Image Generator - Logging
 * 
 * Minimal but sufficient logging with PII redaction.
 */

import type { ImageEngineRequest, ImageEngineDecision } from "./types";

// ============================================
// Logging Utilities
// ============================================

/**
 * Creates a decision ID for logging purposes.
 * Combines requestId + platform + category.
 */
export function createDecisionId(request: ImageEngineRequest): string {
  return `${request.requestId}-${request.platform}-${request.category}`;
}

/**
 * Redacts sensitive information from intentSummary for logging.
 * Returns a hashed/trimmed version.
 */
function redactIntentSummary(intentSummary: string): string {
  // If empty, return as-is
  if (!intentSummary || intentSummary.trim().length === 0) {
    return "[empty]";
  }

  // If very short, return first 20 chars with ellipsis
  if (intentSummary.length <= 20) {
    return intentSummary.substring(0, 20);
  }

  // For longer summaries, return first 30 chars + "..." + last 10 chars
  // This gives context without exposing full business info
  const first = intentSummary.substring(0, 30);
  const last = intentSummary.substring(intentSummary.length - 10);
  return `${first}...${last}`;
}

/**
 * Redacts brand colors from logging (never log hex colors).
 */
function redactBrandColors(brand?: ImageEngineRequest["brand"]): Record<string, unknown> | undefined {
  if (!brand) {
    return undefined;
  }

  const redacted: Record<string, unknown> = {};

  if (brand.styleTone) {
    redacted.styleTone = brand.styleTone;
  }
  if (brand.industry) {
    redacted.industry = brand.industry;
  }

  // Never include color hex values
  if (brand.primaryColorHex) {
    redacted.primaryColorHex = "[redacted]";
  }
  if (brand.secondaryColorHex) {
    redacted.secondaryColorHex = "[redacted]";
  }
  if (brand.accentColorHex) {
    redacted.accentColorHex = "[redacted]";
  }

  return Object.keys(redacted).length > 0 ? redacted : undefined;
}

/**
 * Logs a decision event with redaction.
 */
export function logDecision(
  request: ImageEngineRequest,
  decision: ImageEngineDecision
): void {
  const decisionId = createDecisionId(request);

  const logData = {
    decisionId,
    requestId: request.requestId, // requestId is fine to log
    consumerApp: request.consumerApp,
    platform: request.platform,
    category: request.category,
    mode: decision.mode,
    aspect: decision.aspect,
    energy: decision.energy,
    textAllowance: decision.text.allowance,
    safety: {
      isAllowed: decision.safety.isAllowed,
      usedFallback: decision.safety.usedFallback,
      reasonCount: decision.safety.reasons.length,
    },
    intentSummary: redactIntentSummary(request.intentSummary),
    brand: redactBrandColors(request.brand),
    templateId: decision.promptPlan.templateId,
    providerId: decision.providerPlan.providerId,
  };

  // Log to console (in production, this would go to a logging service)
  console.log("[ImageEngine] Decision:", JSON.stringify(logData, null, 2));
}

