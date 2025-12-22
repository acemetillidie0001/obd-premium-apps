import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

export async function GET() {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = "scottbaxtermarketing@gmail.com";
  const from = process.env.EMAIL_FROM!;

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject: "OBD Resend test",
      html: "<p>If you got this email, Resend is working in production.</p>",
    });
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: { message: err?.message, statusCode: err?.statusCode, response: err?.response } },
      { status: 500 }
    );
  }
}

