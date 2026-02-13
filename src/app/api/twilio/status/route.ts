import { parseTwilioForm } from "../_lib/parse";

export const runtime = "nodejs";

function last4(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function preview(text?: string): string {
  if (!text) return "";
  const s = String(text);
  return s.length <= 40 ? s : s.slice(0, 40);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const form = parseTwilioForm(rawBody);

  const messageSid = form.MessageSid || null;
  const status = form.MessageStatus || null;
  const to = form.To;
  const errorCode = form.ErrorCode || null;
  const _errorMessage = form.ErrorMessage;

  void preview;
  void _errorMessage;

  console.log({
    event: "twilio_status",
    messageSid,
    status,
    toLast4: last4(to),
    errorCode,
  });

  return Response.json({ ok: true }, { status: 200 });
}

