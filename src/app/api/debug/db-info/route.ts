/**
 * Database Info Debug Endpoint
 * 
 * Dev-only endpoint to show which database the local server is connected to.
 * Returns lightweight snapshot of database connection info without leaking credentials.
 * 
 * Response format:
 * {
 *   ok: boolean,
 *   data: {
 *     nodeEnv: string,
 *     databaseUrlPresent: boolean,
 *     databaseUrlIsValid: boolean,
 *     host: string | null,
 *     db: string | null,
 *     schema: string | null,
 *     rawPathname: string | null,
 *     sourceHint: string,
 *     time: string (ISO timestamp)
 *   }
 * }
 * 
 * Returns 404 in production.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Production guard
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  const nodeEnv = process.env.NODE_ENV || "development";
  const databaseUrl = process.env.DATABASE_URL;
  const databaseUrlPresent = !!databaseUrl;
  
  let databaseUrlIsValid = false;
  let host: string | null = null;
  let db: string | null = null;
  let schema: string | null = null;
  let rawPathname: string | null = null;
  let sourceHint = "process";

  // Determine source hint (check .env.local first, then .env)
  // Note: We can't read files in API routes easily, so we infer from process.env
  // In practice, Next.js loads .env.local before .env, so if DATABASE_URL exists,
  // it's likely from .env.local (preferred) or .env
  if (databaseUrlPresent) {
    sourceHint = "env.local|env|process";
  }

  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      host = url.host;
      rawPathname = url.pathname;
      db = url.pathname ? url.pathname.replace(/^\//, "") : null;
      schema = url.searchParams.get("schema") ?? null;
      databaseUrlIsValid = true;
    } catch (error) {
      // If URL parsing fails, leave values as null
      console.warn("[DB Info] Failed to parse DATABASE_URL:", error);
      databaseUrlIsValid = false;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        nodeEnv,
        databaseUrlPresent,
        databaseUrlIsValid,
        host,
        db,
        schema,
        rawPathname,
        sourceHint,
        time: new Date().toISOString(),
      },
    },
    {
      // Prevent caching of diagnostic endpoints
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
      },
    }
  );
}

