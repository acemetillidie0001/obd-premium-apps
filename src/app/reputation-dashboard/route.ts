import { NextRequest, NextResponse } from "next/server";

/**
 * Permanent redirect from /reputation-dashboard to /apps/reputation-dashboard
 * This preserves any existing links and ensures canonical routing through /apps/* for auth protection
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  url.pathname = "/apps/reputation-dashboard";
  return NextResponse.redirect(url, 308);
}

