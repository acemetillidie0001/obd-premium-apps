import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Check for auth secret (supports both naming conventions)
  const hasAuthSecret = !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
  const hasAuthSecretV5 = !!process.env.AUTH_SECRET;
  const hasAuthSecretLegacy = !!process.env.NEXTAUTH_SECRET;

  // Check for auth URL (supports both naming conventions)
  const hasAuthUrl = !!(process.env.AUTH_URL || process.env.NEXTAUTH_URL);
  const hasAuthUrlV5 = !!process.env.AUTH_URL;
  const hasAuthUrlLegacy = !!process.env.NEXTAUTH_URL;

  // Check other required vars
  const hasResendKey = !!process.env.RESEND_API_KEY;
  const hasEmailFrom = !!process.env.EMAIL_FROM;
  const hasDb = !!process.env.DATABASE_URL;

  // Optional vars
  const hasTrustHost = process.env.AUTH_TRUST_HOST !== undefined;

  return NextResponse.json({
    // Required vars (at least one from each pair)
    hasSecret: hasAuthSecret,
    hasSecretV5: hasAuthSecretV5,
    hasSecretLegacy: hasAuthSecretLegacy,
    hasUrl: hasAuthUrl,
    hasUrlV5: hasAuthUrlV5,
    hasUrlLegacy: hasAuthUrlLegacy,
    hasResendKey,
    hasEmailFrom,
    hasDb,
    // Optional
    hasTrustHost,
    // Summary
    allRequired: hasAuthSecret && hasAuthUrl && hasResendKey && hasEmailFrom && hasDb,
    // Naming convention detection
    usingV5Naming: hasAuthSecretV5 || hasAuthUrlV5,
    usingLegacyNaming: hasAuthSecretLegacy || hasAuthUrlLegacy,
  });
}

