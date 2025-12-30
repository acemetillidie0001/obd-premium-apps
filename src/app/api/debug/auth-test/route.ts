import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    return NextResponse.json({
      success: true,
      hasSession: !!session,
      nodeEnv: process.env.NODE_ENV,
      hasAuthSecret: !!process.env.AUTH_SECRET,
      hasAuthUrl: !!process.env.AUTH_URL,
      authSecretLength: process.env.AUTH_SECRET?.length || 0,
      authUrl: process.env.AUTH_URL,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      nodeEnv: process.env.NODE_ENV,
      hasAuthSecret: !!process.env.AUTH_SECRET,
      hasAuthUrl: !!process.env.AUTH_URL,
    }, { status: 500 });
  }
}

