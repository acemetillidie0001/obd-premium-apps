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
  } catch (error: any) {
    // REMOVE AFTER FIX: Enhanced error logging to surface underlying Prisma errors
    console.error("[NextAuth Route] Error:", {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      cause: error?.cause,
      stack: error?.stack,
    });
    
    // If AUTH_DEBUG is enabled, include more details
    const isDebug = process.env.AUTH_DEBUG === "true" || process.env.NEXTAUTH_DEBUG === "true";
    if (isDebug && error?.cause) {
      console.error("[NextAuth Route] Underlying error (AUTH_DEBUG):", {
        message: error.cause?.message,
        code: error.cause?.code,
        name: error.cause?.name,
      });
    }
    
    return new Response(
      JSON.stringify({
        error: "Authentication error",
        message: error instanceof Error ? error.message : "Unknown error",
        ...(isDebug && error?.cause ? { underlyingError: error.cause?.message } : {}),
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
