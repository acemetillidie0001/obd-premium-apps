/**
 * SMS Templates (Tier 5.4A)
 * 
 * All messages must be <= 160 chars when reasonable.
 * Always include "Reply STOP to opt out." on outbound SMS.
 */

import type { SmsTemplateKey, SmsContext } from "./smsTypes";

const STOP_TEXT = "Reply STOP to opt out.";
const MAX_SMS_LENGTH = 160;
const PREFIX = "Ocala Business Directory: ";

/**
 * Truncate business name to fit within SMS length limits
 */
function truncateBusinessName(businessName: string, maxLength: number): string {
  if (!businessName || businessName.length <= maxLength) {
    return businessName || "Business";
  }
  // Truncate and add ellipsis if needed
  return businessName.substring(0, maxLength - 3) + "...";
}

/**
 * Calculate max business name length for a template
 */
function getMaxBusinessNameLength(templateKey: SmsTemplateKey): number {
  // Base template lengths (without business name)
  const baseLengths: Record<SmsTemplateKey, number> = {
    REQUEST_RECEIVED: (PREFIX + "Request received for . " + STOP_TEXT).length,
    CONFIRMED: (PREFIX + "Your appointment with  is confirmed. " + STOP_TEXT).length,
    PROPOSED: (PREFIX + " proposed a new time. " + STOP_TEXT).length,
    DECLINED: (PREFIX + "Your request with  was declined. " + STOP_TEXT).length,
  };
  
  const baseLength = baseLengths[templateKey] || PREFIX.length + STOP_TEXT.length;
  // Leave some buffer for safety
  return MAX_SMS_LENGTH - baseLength - 5;
}

/**
 * Render SMS message from template and context
 * Ensures message stays within 160 character limit
 */
export function renderSms(templateKey: SmsTemplateKey, ctx: SmsContext): string {
  // Validate and sanitize business name
  const businessName = ctx.businessName?.trim() || "Business";
  const maxNameLength = getMaxBusinessNameLength(templateKey);
  const safeBusinessName = truncateBusinessName(businessName, maxNameLength);

  switch (templateKey) {
    case "REQUEST_RECEIVED":
      return `${PREFIX}Request received for ${safeBusinessName}. ${STOP_TEXT}`;

    case "CONFIRMED":
      return `${PREFIX}Your appointment with ${safeBusinessName} is confirmed. ${STOP_TEXT}`;

    case "PROPOSED":
      return `${PREFIX}${safeBusinessName} proposed a new time. ${STOP_TEXT}`;

    case "DECLINED":
      return `${PREFIX}Your request with ${safeBusinessName} was declined. ${STOP_TEXT}`;

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = templateKey;
      return `${PREFIX}${safeBusinessName}. ${STOP_TEXT}`;
  }
}

