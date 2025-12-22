import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Wrap handlers with error handling
async function handleRequest(
  handler: (req: NextRequest) => Promise<Response>,
  req: NextRequest
): Promise<Response> {
  try {
    // REMOVE AFTER FIX: Log email sign-in requests for debugging
    const url = new URL(req.url);
    if (url.pathname.includes("/signin/email")) {
      console.log("[NextAuth Route] signin/email request", {
        path: url.pathname,
        method: req.method,
        hasAuthUrl: !!(process.env.AUTH_URL || process.env.NEXTAUTH_URL),
        hasAuthSecret: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
        hasResendKey: !!process.env.RESEND_API_KEY,
        hasEmailFrom: !!process.env.EMAIL_FROM,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      });
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
