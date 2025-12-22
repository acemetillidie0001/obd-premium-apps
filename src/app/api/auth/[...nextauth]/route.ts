import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Wrap handlers with error handling
async function handleRequest(
  handler: (req: NextRequest) => Promise<Response>,
  req: NextRequest
): Promise<Response> {
  try {
    // Log environment variables at request time (booleans only, no secrets)
    const url = new URL(req.url);
    if (url.pathname.includes("/signin/email") || url.pathname.includes("/callback/email")) {
      console.log("[NextAuth Route] === Email Sign-In Request ===");
      console.log("[NextAuth Route] Path:", url.pathname);
      console.log("[NextAuth Route] AUTH_URL present:", !!(process.env.AUTH_URL || process.env.NEXTAUTH_URL));
      console.log("[NextAuth Route] AUTH_SECRET present:", !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET));
      console.log("[NextAuth Route] EMAIL_FROM present:", !!process.env.EMAIL_FROM);
      console.log("[NextAuth Route] RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);
      console.log("[NextAuth Route] DATABASE_URL present:", !!process.env.DATABASE_URL);
    }
    
    return await handler(req);
  } catch (error) {
    console.error("[NextAuth Route] Error:", error);
    // Return a proper error response instead of crashing
    return new Response(
      JSON.stringify({
        error: "Authentication error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(handlers.GET, req);
}

export async function POST(req: NextRequest) {
  return handleRequest(handlers.POST, req);
}
