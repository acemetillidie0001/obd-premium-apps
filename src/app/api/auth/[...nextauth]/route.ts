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
  } catch (error: unknown) {
    console.error("[NextAuth Route] Error:", error instanceof Error ? error.message : String(error));
    
    // If AUTH_DEBUG is enabled, include more details
    const isDebug = process.env.AUTH_DEBUG === "true" || process.env.NEXTAUTH_DEBUG === "true";
    
    const underlyingError =
      error instanceof Error && "cause" in error
        ? (error as Error & { cause?: unknown }).cause
        : undefined;
    
    return new Response(
      JSON.stringify({
        error: "Authentication error",
        message: error instanceof Error ? error.message : "Unknown error",
        ...(isDebug && underlyingError
          ? { underlyingError: String(underlyingError) }
          : {}),
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
  } catch (error: unknown) {
    console.error("[NextAuth Route] GET handler error:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "Configuration", message: error instanceof Error ? error.message : "Unknown error" }),
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
  } catch (error: unknown) {
    console.error("[NextAuth Route] POST handler error:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "Configuration", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
