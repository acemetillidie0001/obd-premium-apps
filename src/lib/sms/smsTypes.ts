/**
 * SMS Types (Tier 5.4A)
 */

export type SmsTemplateKey = "REQUEST_RECEIVED" | "CONFIRMED" | "PROPOSED" | "DECLINED";

export interface SmsContext {
  businessName: string;
  customerName?: string;
  startISO?: string;
  proposedISO?: string;
  bookingUrl?: string;
}

export interface SmsSendResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

/**
 * Normalize phone number to E.164 format
 * For now: accepts US numbers and common formats; returns +1XXXXXXXXXX when possible
 */
export function normalizeE164(phone: string): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Handle US numbers (10 digits or 11 digits starting with 1)
  if (digits.length === 10) {
    // 10 digits: assume US, add +1
    return `+1${digits}`;
  } else if (digits.length === 11 && digits[0] === "1") {
    // 11 digits starting with 1: add +
    return `+${digits}`;
  } else if (phone.startsWith("+1") && digits.length === 12) {
    // Already in +1XXXXXXXXXX format
    return phone;
  }

  // Not a valid US number format
  return null;
}

