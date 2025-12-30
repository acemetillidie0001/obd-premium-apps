import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const resendConfigured = !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "placeholder_resend_key_please_update";
  const emailFromConfigured = !!process.env.EMAIL_FROM && process.env.EMAIL_FROM !== "noreply@example.com";
  
  const mode = resendConfigured && emailFromConfigured ? "EMAIL" : "CONSOLE_FALLBACK";
  
  return NextResponse.json({
    resendConfigured,
    emailFromConfigured,
    mode,
  });
}

