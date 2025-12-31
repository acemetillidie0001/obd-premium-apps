/**
 * Database Startup Checks
 * 
 * Performs non-blocking checks at server startup to ensure:
 * - DATABASE_URL is present
 * - Migrations are applied
 * - Database is accessible
 * 
 * These checks run once per server boot, not per request.
 */

import { validatePrismaConnection, logConnectionDiagnostics } from "./dbValidation";
import { prisma } from "./prisma";

let startupCheckComplete = false;
let startupCheckPromise: Promise<void> | null = null;

/**
 * Check if DATABASE_URL and DATABASE_URL_DIRECT are present (logs YES/NO, never logs the values)
 */
function checkDatabaseUrl(): void {
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasDatabaseUrlDirect = !!process.env.DATABASE_URL_DIRECT;
  
  console.log(`[DB Startup] DATABASE_URL present: ${hasDatabaseUrl ? "YES" : "NO"}`);
  console.log(`[DB Startup] DATABASE_URL_DIRECT present: ${hasDatabaseUrlDirect ? "YES" : "NO"}`);
  
  if (!hasDatabaseUrl) {
    console.warn("[DB Startup] ⚠️  DATABASE_URL is missing. Runtime database operations will fail.");
    console.warn("[DB Startup] Set DATABASE_URL in .env.local/.env (for Next.js runtime) or Vercel environment variables (for production).");
  }
  
  if (!hasDatabaseUrlDirect) {
    console.warn("[DB Startup] ⚠️  DATABASE_URL_DIRECT is missing. Prisma CLI operations (migrations, studio) will fail.");
    console.warn("[DB Startup] Set DATABASE_URL_DIRECT in .env with a direct postgresql:// connection string.");
    console.warn("[DB Startup] Note: DATABASE_URL may be prisma+postgres:// (Accelerate/Data Proxy) which Prisma Studio does not support.");
  }
}

/**
 * Check migration status (non-blocking, logs warnings only)
 * Uses the shared validation helper for consistency.
 */
async function checkMigrationStatus(): Promise<void> {
  try {
    const result = await validatePrismaConnection();
    logConnectionDiagnostics(result);
  } catch (error) {
    // Non-blocking: log but don't throw
    console.warn("[DB Startup] ⚠️  Could not check migration status:", error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * Run all startup checks (non-blocking)
 * This function is idempotent - it only runs once per server boot
 */
export async function runStartupChecks(): Promise<void> {
  // Skip during build
  if (process.env.NEXT_PHASE === "phase-production-build" || 
      process.env.NEXT_PHASE === "phase-development-build") {
    return;
  }

  // Skip in Edge Runtime
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  // Only run once
  if (startupCheckComplete) {
    return;
  }

  // If check is already in progress, wait for it
  if (startupCheckPromise) {
    return startupCheckPromise;
  }

  // Start the check
  startupCheckPromise = (async () => {
    try {
      checkDatabaseUrl();
      await checkMigrationStatus();
    } catch (error) {
      // Non-blocking: log but don't throw
      console.warn("[DB Startup] Startup check error:", error instanceof Error ? error.message : "Unknown error");
    } finally {
      startupCheckComplete = true;
    }
  })();

  return startupCheckPromise;
}

/**
 * Dev-only Prisma model availability assertion
 * 
 * Verifies that required Prisma models are available after client initialization.
 * Throws an error in development if any required models are missing.
 * Does not run in production.
 * 
 * Required models:
 * - prisma.user
 * - prisma.crmContact
 * - prisma.crmTag
 * 
 * @throws Error if any required model is missing (dev only)
 */
export function assertPrismaModelsAvailable(): void {
  // Only run in development
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const missingModels: string[] = [];
  const requiredModels = [
    { name: "user", path: "prisma.user" },
    { name: "crmContact", path: "prisma.crmContact" },
    { name: "crmTag", path: "prisma.crmTag" },
  ];

  // Check each required model
  for (const model of requiredModels) {
    const modelInstance = (prisma as any)[model.name];
    if (!modelInstance || typeof modelInstance.findMany !== "function") {
      missingModels.push(model.path);
    }
  }

  // If any models are missing, throw a clear error
  if (missingModels.length > 0) {
    const missingList = missingModels.join(", ");
    const errorMessage = `[Prisma Model Assertion] Missing required Prisma models: ${missingList}

This usually means:
1. Prisma client was not generated - run: npx prisma generate
2. Database migrations were not applied - run: npx prisma migrate deploy
3. Prisma schema is out of sync - check prisma/schema.prisma

Required models: prisma.user, prisma.crmContact, prisma.crmTag
Missing models: ${missingList}`;

    console.error(errorMessage);
    throw new Error(`Prisma models missing: ${missingList}. Run 'npx prisma generate' and ensure migrations are applied.`);
  }
}

// Auto-run checks when module is imported (in Node.js runtime only)
if (typeof window === "undefined" && 
    process.env.NEXT_RUNTIME !== "edge" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.NEXT_PHASE !== "phase-development-build") {
  // Run asynchronously, don't block module load
  runStartupChecks().catch(() => {
    // Ignore errors - checks are non-blocking
  });
}

