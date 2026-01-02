/**
 * SMS Sending Utilities (Tier 5.4A)
 */

import { getTwilioClient, getSmsFromNumber, isSmsEnabled } from "./twilioClient";
import { normalizeE164, type SmsTemplateKey, type SmsContext, type SmsSendResult } from "./smsTypes";
import { renderSms } from "./smsTemplates";

/**
 * Send transactional SMS
 * 
 * Returns { ok: false } if:
 * - SMS_ENABLED !== "true"
 * - Phone number is invalid
 * - Business name is missing/invalid
 * - Twilio API error
 * 
 * Never throws - always returns a result.
 */
export async function sendTransactionalSms(
  toPhone: string,
  templateKey: SmsTemplateKey,
  ctx: SmsContext
): Promise<SmsSendResult> {
  // Check if SMS is enabled
  if (!isSmsEnabled()) {
    return { ok: false, error: "SMS_DISABLED" };
  }

  // Validate context
  if (!ctx.businessName || !ctx.businessName.trim()) {
    return { ok: false, error: "INVALID_CONTEXT: businessName is required" };
  }

  // Normalize phone number
  const normalizedPhone = normalizeE164(toPhone);
  if (!normalizedPhone) {
    return { ok: false, error: "INVALID_PHONE" };
  }

  try {
    // Get Twilio client and from number
    const client = getTwilioClient();
    const fromNumber = getSmsFromNumber();

    // Render message (with length protection)
    const body = renderSms(templateKey, ctx);

    // Validate message length (should never exceed 160, but double-check)
    if (body.length > 160) {
      console.warn(`[SMS] Message exceeds 160 chars (${body.length}), truncating`);
      // This shouldn't happen with our truncation, but be defensive
    }

    // Send SMS
    const message = await client.messages.create({
      from: fromNumber,
      to: normalizedPhone,
      body: body.substring(0, 160), // Final safety check
    });

    // Log success (without sensitive data)
    console.info("[SMS] Sent successfully", {
      template: templateKey,
      sid: message.sid?.substring(0, 20) + "...",
      toPrefix: normalizedPhone.substring(0, 5) + "...",
    });

    return {
      ok: true,
      sid: message.sid,
    };
  } catch (error) {
    // Extract safe error message (don't log full error object which might contain secrets)
    let errorMessage = "UNKNOWN_ERROR";
    if (error instanceof Error) {
      errorMessage = error.message;
      // Don't log stack traces or full error objects
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    // Log error without sensitive data
    console.error("[SMS] Failed to send SMS", {
      template: templateKey,
      error: errorMessage,
      toPrefix: normalizedPhone?.substring(0, 5) + "..." || "unknown",
    });

    return {
      ok: false,
      error: errorMessage,
    };
  }
}

