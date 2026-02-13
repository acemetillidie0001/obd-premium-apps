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

function twiml(xmlInner: string) {
  const xml = `<Response>${xmlInner}</Response>`;
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const form = parseTwilioForm(rawBody);

  const from = form.From;
  const to = form.To;
  const body = form.Body;
  const messageSid = form.MessageSid || null;

  const cmd = (body || "").trim().toUpperCase();

  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(cmd)) {
    return twiml(
      `<Message>You\u2019re opted out. Reply START to re-subscribe (if enabled) or contact support at (352) 496-0016.</Message>`
    );
  }

  if (cmd === "HELP") {
    return twiml(`<Message>OBD Support: (352) 496-0016. Reply STOP to opt out.</Message>`);
  }

  console.log({
    event: "twilio_inbound",
    fromLast4: last4(from),
    toLast4: last4(to),
    messageSid,
    bodyPreview: preview(body),
  });

  return twiml("");
}

