import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function GET() {
  // Extract email from "Display Name <email@domain.com>" format if present
  const emailFromRaw = process.env.EMAIL_FROM || "";
  let from = emailFromRaw;
  const emailMatch = emailFromRaw.match(/<([^>]+)>/);
  if (emailMatch) {
    from = emailMatch[1].trim();
  }
  
  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = "scottbaxtermarketing@gmail.com";

  console.log("[Test Resend] EMAIL_FROM raw:", emailFromRaw);
  console.log("[Test Resend] EMAIL_FROM extracted:", from);
  console.log("[Test Resend] RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject: "OBD Resend test",
      html: "<p>If you got this email, Resend is working in production.</p>",
    });
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : { message: String(err) };
    const errorObj = {
      message: error.message,
      name: error.name,
      statusCode: "statusCode" in error ? error.statusCode : undefined,
      response: "response" in error ? error.response : undefined,
    };
    console.error("[Test Resend] Error:", errorObj);
    return NextResponse.json(
      { ok: false, error: errorObj },
      { status: 500 }
    );
  }
}

