import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    NEXTAUTH_SECRET: {
      set: !!process.env.NEXTAUTH_SECRET,
      length: process.env.NEXTAUTH_SECRET?.length || 0,
      valid: (process.env.NEXTAUTH_SECRET?.length || 0) >= 32,
    },
    AUTH_SECRET: {
      set: !!process.env.AUTH_SECRET,
      length: process.env.AUTH_SECRET?.length || 0,
      valid: (process.env.AUTH_SECRET?.length || 0) >= 32,
    },
    NEXTAUTH_URL: {
      set: !!process.env.NEXTAUTH_URL,
      value: process.env.NEXTAUTH_URL,
    },
    AUTH_URL: {
      set: !!process.env.AUTH_URL,
      value: process.env.AUTH_URL,
    },
    DATABASE_URL: {
      set: !!process.env.DATABASE_URL,
      startsWithPostgres: process.env.DATABASE_URL?.startsWith("postgresql://") || false,
      length: process.env.DATABASE_URL?.length || 0,
    },
    RESEND_API_KEY: {
      set: !!process.env.RESEND_API_KEY,
      startsWithRe: process.env.RESEND_API_KEY?.startsWith("re_") || false,
    },
    EMAIL_FROM: {
      set: !!process.env.EMAIL_FROM,
      value: process.env.EMAIL_FROM,
    },
  };

  const allValid = 
    checks.NEXTAUTH_SECRET.valid &&
    checks.AUTH_SECRET.valid &&
    checks.DATABASE_URL.startsWithPostgres &&
    checks.RESEND_API_KEY.startsWithRe &&
    checks.EMAIL_FROM.set;

  return NextResponse.json({
    status: allValid ? "✅ All variables valid" : "❌ Some variables invalid",
    checks,
    timestamp: new Date().toISOString(),
  });
}

