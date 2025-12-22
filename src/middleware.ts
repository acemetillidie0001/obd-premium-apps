import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req: NextRequest & { auth?: any }) => {
  const { pathname } = req.nextUrl;
  
  // Allow all /api/auth routes (NextAuth handles these)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  
  // Protect /apps/* routes - require authentication
  if (pathname.startsWith("/apps")) {
    if (!req.auth) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  // Protect /api/* routes (except /api/auth which is already handled above)
  if (pathname.startsWith("/api")) {
    if (!req.auth) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  // Allow all other routes (/, /login, /_next, static files, etc.)
  return NextResponse.next();
});

export const config = {
  matcher: ["/apps/:path*", "/api/:path*"],
};
