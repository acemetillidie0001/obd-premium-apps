import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  
  // Check for admin bypass cookie (development only)
  const bypassKey = req.cookies.get("obd_admin_bypass")?.value;
  const premiumBypassKey = process.env.PREMIUM_BYPASS_KEY;
  const validBypass = premiumBypassKey && 
                      bypassKey === premiumBypassKey &&
                      process.env.NODE_ENV !== "production";
  
  // Public routes
  const publicRoutes = ["/login", "/api/auth", "/unlock"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  
  // Dashboard (/) is public
  if (pathname === "/") {
    return NextResponse.next();
  }
  
  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // Admin bypass (development only)
  if (validBypass) {
    return NextResponse.next();
  }
  
  // Premium tool routes require authentication
  const isPremiumRoute = pathname.startsWith("/apps/") || pathname.startsWith("/api/");
  
  if (isPremiumRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // If user is logged in and trying to access login page, redirect to dashboard
  if (isLoggedIn && pathname.startsWith("/login")) {
    const callbackUrl = req.nextUrl.searchParams.get("next") || "/";
    return NextResponse.redirect(new URL(callbackUrl, req.url));
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|obd-logo.png).*)"],
};
