/**
 * Admin Database Fingerprint Endpoint
 * 
 * Returns safe, non-secret database information for production verification.
 * Requires admin/premium access.
 */

import { NextRequest } from "next/server";
import { requirePremiumAccess } from "@/lib/api/premiumGuard";
import { getCurrentUser } from "@/lib/premium";
import { apiSuccessResponse, apiErrorResponse } from "@/lib/api/errorHandler";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = ["scottbaxtermarketing@gmail.com"];

/**
 * Mask a host string (e.g., "abc123def456" -> "abc***456")
 */
function maskHost(host: string): string {
  if (host.length <= 6) {
    return "***";
  }
  const start = host.substring(0, 3);
  const end = host.substring(host.length - 3);
  return `${start}***${end}`;
}

/**
 * Parse DATABASE_URL safely and extract non-secret info
 */
function parseDatabaseUrl(): {
  host: string | null;
  database: string | null;
  schema: string | null;
} {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return { host: null, database: null, schema: null };
  }

  try {
    // Parse the URL
    const url = new URL(dbUrl);
    
    // Extract host (mask it)
    const host = url.hostname ? maskHost(url.hostname) : null;
    
    // Extract database name (pathname without leading slash)
    const database = url.pathname ? url.pathname.replace(/^\//, "") : null;
    
    // Extract schema from query params if present
    const schema = url.searchParams.get("schema") || null;
    
    return { host, database, schema };
  } catch (error) {
    // If URL parsing fails, return nulls
    return { host: null, database: null, schema: null };
  }
}

/**
 * Get latest migration name from _prisma_migrations table
 */
async function getLatestMigration(): Promise<string | null> {
  try {
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    
    if (migrations.length > 0) {
      return migrations[0].migration_name;
    }
    return null;
  } catch (error) {
    console.error("[DB Fingerprint] Error querying migrations:", error);
    return null;
  }
}

/**
 * GET /api/admin/db-fingerprint
 * 
 * Returns safe database fingerprint information for admin verification.
 */
export async function GET(request: NextRequest) {
  // Step 1: Require premium access
  const premiumGuard = await requirePremiumAccess();
  if (premiumGuard) {
    return premiumGuard;
  }

  // Step 2: Require admin email (additional gate)
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiErrorResponse("Unauthorized", "UNAUTHORIZED", 401);
    }

    const userEmail = user.email?.toLowerCase();
    const isAdmin = ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === userEmail);
    
    if (!isAdmin) {
      return apiErrorResponse("Forbidden: Admin access required", "FORBIDDEN", 403);
    }
  } catch (error) {
    return apiErrorResponse("Authentication failed", "UNAUTHORIZED", 401);
  }

  // Step 3: Gather safe database information
  try {
    const dbInfo = parseDatabaseUrl();
    
    // Get user count
    const userCount = await prisma.user.count();
    
    // Get latest migration
    const latestMigration = await getLatestMigration();
    
    return apiSuccessResponse({
      database: {
        host: dbInfo.host,
        database: dbInfo.database,
        schema: dbInfo.schema,
      },
      stats: {
        userCount,
        latestMigration,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[DB Fingerprint] Error:", error);
    return apiErrorResponse(
      "Failed to gather database fingerprint",
      "INTERNAL_ERROR",
      500
    );
  }
}

export const runtime = "nodejs";

