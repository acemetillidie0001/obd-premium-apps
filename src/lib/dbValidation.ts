/**
 * Database Connection Validation Helper
 * 
 * Safe validation helper used by:
 * - Prisma Studio (via CLI scripts)
 * - App startup (non-blocking)
 * - Diagnostic endpoints
 * 
 * If Prisma cannot connect, logs clear diagnostic warnings.
 * Does NOT crash the app if validation fails.
 */

export type DbValidationResult =
  | { ok: true; message: string }
  | { ok: false; error: "MISSING_URL" | "CONNECTION_FAILED" | "MIGRATIONS_PENDING" | "UNKNOWN"; message: string; details?: string };

/**
 * Validate Prisma can connect to the database
 * 
 * Uses DATABASE_URL_DIRECT for Prisma CLI operations (migrations, studio).
 * Runtime uses DATABASE_URL (may be prisma+postgres:// for Accelerate/Data Proxy).
 * 
 * Returns structured result with diagnostic information.
 * Never throws - always returns a result.
 */
export async function validatePrismaConnection(): Promise<DbValidationResult> {
  // Check DATABASE_URL_DIRECT is present (required for Prisma CLI operations)
  if (!process.env.DATABASE_URL_DIRECT) {
    return {
      ok: false,
      error: "MISSING_URL",
      message: "DATABASE_URL_DIRECT is not set",
      details: "Set DATABASE_URL_DIRECT in .env with a direct postgresql:// connection string. Prisma Studio and migrations require DATABASE_URL_DIRECT (prisma+postgres:// is not supported).",
    };
  }

  try {
    // Dynamic import to avoid loading Prisma during build
    const { PrismaClient } = await import("@prisma/client");
    // PrismaClient reads from schema.datasource.url (DATABASE_URL_DIRECT)
    const prisma = new PrismaClient({
      log: ["error"],
    });

    try {
      // Test basic connection
      await prisma.$queryRaw`SELECT 1 as connected`;
      
      // Check if User table exists (indicates migrations are applied)
      const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'User'
        LIMIT 1
      `;
      
      if (tables.length === 0) {
        await prisma.$disconnect();
        return {
          ok: false,
          error: "MIGRATIONS_PENDING",
          message: "Database connected but migrations not applied",
          details: "User table not found. Run: pnpm db:deploy (or npx prisma migrate deploy)",
        };
      }

      await prisma.$disconnect();
      return {
        ok: true,
        message: "Database connection successful and tables found",
      };
    } catch (error) {
      await prisma.$disconnect().catch(() => {
        // Ignore disconnect errors
      });
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorCode = error instanceof Error ? (error as { code?: string }).code : undefined;
      
      // Detect specific error types
      if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND") || errorCode === "ECONNREFUSED") {
        return {
          ok: false,
          error: "CONNECTION_FAILED",
          message: "Database is unreachable",
          details: `Connection refused. Check DATABASE_URL_DIRECT host and port. Error: ${errorMessage}`,
        };
      }
      
      if (errorMessage.includes("P1001") || errorMessage.includes("Can't reach database server")) {
        return {
          ok: false,
          error: "CONNECTION_FAILED",
          message: "Cannot reach database server",
          details: `Database server is unreachable. Check network connectivity and DATABASE_URL_DIRECT. Error: ${errorMessage}`,
        };
      }
      
      if (errorMessage.includes("authentication failed") || errorMessage.includes("password")) {
        return {
          ok: false,
          error: "CONNECTION_FAILED",
          message: "Database authentication failed",
          details: `Invalid credentials in DATABASE_URL_DIRECT. Error: ${errorMessage}`,
        };
      }
      
      return {
        ok: false,
        error: "UNKNOWN",
        message: "Database connection check failed",
        details: `Unknown error: ${errorMessage}`,
      };
    }
  } catch (error) {
    // Error loading Prisma Client
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      error: "UNKNOWN",
      message: "Failed to initialize Prisma Client",
      details: errorMessage,
    };
  }
}

/**
 * Log diagnostic warnings for connection failures
 * 
 * Used by app startup and diagnostic endpoints.
 * Logs clear, actionable messages without secrets.
 */
export function logConnectionDiagnostics(result: DbValidationResult): void {
  if (result.ok) {
    console.log(`[DB Validation] ✓ ${result.message}`);
    return;
  }

  console.warn(`[DB Validation] ⚠️  ${result.message}`);
  if (result.details) {
    console.warn(`[DB Validation] ${result.details}`);
  }

  switch (result.error) {
    case "MISSING_URL":
      console.warn("[DB Validation] Possible causes:");
      console.warn("[DB Validation]   - DATABASE_URL_DIRECT missing from .env (required for Prisma CLI/Studio)");
      console.warn("[DB Validation]   - Environment variables not loaded");
      break;
    case "CONNECTION_FAILED":
      console.warn("[DB Validation] Possible causes:");
      console.warn("[DB Validation]   - Wrong database host/port in DATABASE_URL_DIRECT");
      console.warn("[DB Validation]   - Database server is down or unreachable");
      console.warn("[DB Validation]   - Network connectivity issues");
      console.warn("[DB Validation]   - Invalid credentials in DATABASE_URL_DIRECT");
      break;
    case "MIGRATIONS_PENDING":
      console.warn("[DB Validation] Solution:");
      console.warn("[DB Validation]   - Run: pnpm db:deploy");
      console.warn("[DB Validation]   - Or: npx prisma migrate deploy");
      break;
    case "UNKNOWN":
      console.warn("[DB Validation] Check logs above for details");
      break;
  }
}
