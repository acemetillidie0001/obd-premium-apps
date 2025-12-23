import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Wrap handlers with error handling
async function handleRequest(
  handler: (req: NextRequest) => Promise<Response>,
  req: NextRequest
): Promise<Response> {
  try {
    return await handler(req);
  } catch (error: any) {
    console.error("[NextAuth Route] Error:", error?.message);
    
    // If AUTH_DEBUG is enabled, include more details
    const isDebug = process.env.AUTH_DEBUG === "true" || process.env.NEXTAUTH_DEBUG === "true";
    
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
  try {
    // Verify handlers are available
    if (!handlers || !handlers.GET) {
      console.error("[NextAuth Route] handlers.GET is not available");
      return new Response(
        JSON.stringify({ error: "Configuration", message: "Auth handlers not initialized" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return handleRequest(handlers.GET, req);
  } catch (error: any) {
    console.error("[NextAuth Route] GET handler error:", error.message);
    return new Response(
      JSON.stringify({ error: "Configuration", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify handlers are available
    if (!handlers || !handlers.POST) {
      console.error("[NextAuth Route] handlers.POST is not available");
      return new Response(
        JSON.stringify({ error: "Configuration", message: "Auth handlers not initialized" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return handleRequest(handlers.POST, req);
  } catch (error: any) {
    console.error("[NextAuth Route] POST handler error:", error.message);
    return new Response(
      JSON.stringify({ error: "Configuration", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
