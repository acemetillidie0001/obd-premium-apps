/**
 * OBD Scheduler Health Snapshot Endpoint
 * 
 * Internal monitoring endpoint to check Scheduler core dependencies.
 * Returns simple JSON status for health checks.
 * 
 * GET /api/obd-scheduler/health
 * 
 * Success: { ok: true, scheduler: "up" }
 * DB Unavailable: { ok: false, code: "DB_UNAVAILABLE", error: "..." } (HTTP 503)
 */

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errorHandler";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/obd-scheduler/health
 * Health check endpoint for Scheduler
 */
export async function GET(request: NextRequest) {
  try {
    // Test database connection with minimal query
    const prisma = getPrisma();
    
    // Run minimal query to verify DB connection
    // Using a simple count query that's safe and fast
    await prisma.bookingSettings.count();

    // If query succeeds, scheduler is up
    const pilotMode = process.env.OBD_SCHEDULER_PILOT_MODE === "true" || process.env.OBD_SCHEDULER_PILOT_MODE === "1";
    
    return NextResponse.json(
      {
        ok: true,
        scheduler: "up",
        pilotMode,
      },
      { status: 200 }
    );
  } catch (error) {
    // handleApiError will map DB_UNAVAILABLE to 503 automatically
    return handleApiError(error);
  }
}

