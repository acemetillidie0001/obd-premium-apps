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
