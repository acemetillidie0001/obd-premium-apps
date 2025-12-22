import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const key = searchParams.get("key");
  const bypassKey = env.PREMIUM_BYPASS_KEY;
  
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Admin bypass is not available in production" },
      { status: 403 }
    );
  }
  
  if (!bypassKey) {
    return NextResponse.json(
      { error: "Premium bypass is not configured" },
      { status: 500 }
    );
  }
  
  if (key !== bypassKey) {
    return NextResponse.json(
      { error: "Invalid bypass key" },
      { status: 401 }
    );
  }
  
  // Set bypass cookie (30 days, httpOnly, secure in production)
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test";
  cookieStore.set("obd_admin_bypass", bypassKey, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });
  
  return NextResponse.redirect(new URL("/", request.url));
}

