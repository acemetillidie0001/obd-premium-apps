// src/lib/sms/sendSms.ts

import { getTwilioClient, getSmsFromNumber, isSmsEnabled } from "./twilioClient";

type SendSmsArgs = {
  to: string;
  body: string;
};

function normalizePhone(phone: string): string {
  return (phone ?? "").trim();
}

export async function sendTransactionalSms(args: SendSmsArgs): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSmsEnabled()) {
    return { ok: false, error: "SMS is disabled (missing Twilio env vars)." };
  }

  const to = normalizePhone(args.to);
  const body = (args.body ?? "").trim();

  if (!to) return { ok: false, error: "Missing recipient phone number." };
  if (!body) return { ok: false, error: "Missing SMS body." };

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
