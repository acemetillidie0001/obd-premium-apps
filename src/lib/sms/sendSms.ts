// src/lib/sms/sendSms.ts

import { getTwilioClient, getSmsFromNumber, isSmsEnabled } from "./twilioClient";
import { renderSms } from "./smsTemplates";
import type { SmsTemplateKey, SmsContext } from "./smsTypes";

function normalizePhone(phone: string): string {
  return (phone ?? "").trim();
}

/**
 * Simple template map for fallback when templateKey is not a recognized SmsTemplateKey
 */
function getFallbackTemplate(templateKey: string, businessName: string): string {
  const PREFIX = "Ocala Business Directory: ";
  const STOP_TEXT = "Reply STOP to opt out.";
  return `${PREFIX}${businessName || "Business"}. ${STOP_TEXT}`;
}

/**
 * Convert variables Record to SmsContext
 */
function convertToSmsContext(
  variables?: Record<string, string | number | boolean | null | undefined>
): SmsContext {
  return {
    businessName: String(variables?.businessName || "Business"),
    customerName: variables?.customerName ? String(variables.customerName) : undefined,
    startISO: variables?.startISO ? String(variables.startISO) : undefined,
    proposedISO: variables?.proposedISO ? String(variables.proposedISO) : undefined,
    bookingUrl: variables?.bookingUrl ? String(variables.bookingUrl) : undefined,
  };
}

export async function sendTransactionalSms(
  toPhone: string,
  templateKey: string = "generic",
  variables?: Record<string, string | number | boolean | null | undefined>
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Check if SMS is configured - return early without throwing
  if (!isSmsEnabled()) {
    return { ok: false, error: "SMS not configured" };
  }

  const to = normalizePhone(toPhone);
  if (!to) {
    return { ok: false, error: "Missing recipient phone number." };
  }

  // Build message body from template
  let body: string;
  try {
    // Map variables to SmsContext
    const ctx = convertToSmsContext(variables);
    
    // Check if templateKey is a valid SmsTemplateKey, use renderSms if so
    const validTemplateKeys: SmsTemplateKey[] = ["REQUEST_RECEIVED", "CONFIRMED", "PROPOSED", "DECLINED"];
    if (validTemplateKeys.includes(templateKey as SmsTemplateKey)) {
      body = renderSms(templateKey as SmsTemplateKey, ctx);
    } else {
      // Fallback for unrecognized template keys
      body = getFallbackTemplate(templateKey, ctx.businessName);
    }
    
    body = body.trim();
    if (!body) {
      return { ok: false, error: "Empty SMS body generated." };
    }
  } catch (err: any) {
    return { ok: false, error: `Failed to generate SMS template: ${err?.message || "Unknown error"}` };
  }

  // Send SMS using Twilio
  try {
    const client = getTwilioClient();
    const from = getSmsFromNumber();

    await client.messages.create({
      to,
      from,
      body,
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Failed to send SMS." };
  }
}
