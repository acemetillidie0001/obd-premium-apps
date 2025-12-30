/**
 * AI Help Desk V4 Production Readiness Check
 * 
 * Verifies environment variables and database tables required for production.
 * This is a read-only diagnostic utility - it does not modify data or apply migrations.
 */

import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Environment variable check result
 */
export type EnvCheckResult = "present" | "missing" | "not_required";

/**
 * Database table check result
 */
export type DbCheckResult = "exists" | "missing";

/**
 * Environment variable check results
 */
export interface EnvCheckResults {
  ANYTHINGLLM_BASE_URL: EnvCheckResult;
  ANYTHINGLLM_API_KEY: EnvCheckResult;
  ANYTHINGLLM_TIMEOUT_MS: EnvCheckResult;
  AI_HELP_DESK_ADMIN_EMAILS: EnvCheckResult;
  NEXT_PUBLIC_BASE_URL: EnvCheckResult;
}

/**
 * Database table check results
 */
export interface DbCheckResults {
  AiWorkspaceMap: DbCheckResult;
  AiHelpDeskEntry: DbCheckResult;
  AiHelpDeskSyncState: DbCheckResult;
  AiHelpDeskQuestionLog: DbCheckResult;
  AiHelpDeskWidgetKey: DbCheckResult;
  AiHelpDeskWidgetSettings: DbCheckResult;
}

/**
 * Production readiness check result
 */
export interface ProductionReadinessResult {
  env: EnvCheckResults;
  database: DbCheckResults;
  summary: {
    ready: boolean;
    blockingIssues: string[];
    warnings: string[];
  };
}

/**
 * Check if a database table exists
 * Uses Prisma introspection to safely check table existence
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    // Use a simple query to check if the table exists
    // This is safe and read-only
    // Note: Prisma.$queryRaw requires proper SQL escaping
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ) as exists;
    `;
    
    return result[0]?.exists ?? false;
  } catch (error) {
    // If query fails, assume table doesn't exist
    // Only log in development to avoid production noise
    if (process.env.NODE_ENV === "development") {
      console.error(`Error checking table ${tableName}:`, error);
    }
    return false;
  }
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables(): EnvCheckResults {
  return {
    ANYTHINGLLM_BASE_URL: process.env.ANYTHINGLLM_BASE_URL ? "present" : "missing",
    ANYTHINGLLM_API_KEY: process.env.ANYTHINGLLM_API_KEY ? "present" : "not_required",
    ANYTHINGLLM_TIMEOUT_MS: process.env.ANYTHINGLLM_TIMEOUT_MS ? "present" : "missing",
    AI_HELP_DESK_ADMIN_EMAILS: process.env.AI_HELP_DESK_ADMIN_EMAILS ? "present" : "missing",
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ? "present" : "missing",
  };
}

/**
 * Check database tables
 */
async function checkDatabaseTables(): Promise<DbCheckResults> {
  const tables = [
    "AiWorkspaceMap",
    "AiHelpDeskEntry",
    "AiHelpDeskSyncState",
    "AiHelpDeskQuestionLog",
    "AiHelpDeskWidgetKey",
    "AiHelpDeskWidgetSettings",
  ] as const;

  const results: Partial<DbCheckResults> = {};

  for (const table of tables) {
    const exists = await checkTableExists(table);
    results[table] = exists ? "exists" : "missing";
  }

  return results as DbCheckResults;
}

/**
 * Generate summary with plain-English messages
 */
function generateSummary(
  env: EnvCheckResults,
  database: DbCheckResults
): {
  ready: boolean;
  blockingIssues: string[];
  warnings: string[];
} {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  if (env.ANYTHINGLLM_BASE_URL === "missing") {
    blockingIssues.push(
      "ANYTHINGLLM_BASE_URL is missing. This tells OBD where your AI engine lives. Set it to your AnythingLLM instance URL."
    );
  }

  // Check required database tables
  const requiredTables: Array<keyof DbCheckResults> = [
    "AiWorkspaceMap",
    "AiHelpDeskEntry",
    "AiHelpDeskQuestionLog",
    "AiHelpDeskWidgetKey",
    "AiHelpDeskWidgetSettings",
  ];

  for (const table of requiredTables) {
    if (database[table] === "missing") {
      blockingIssues.push(
        `Database table "${table}" is missing. Run database migrations to create this table.`
      );
    }
  }

  // Optional but recommended
  if (env.ANYTHINGLLM_API_KEY === "not_required") {
    warnings.push(
      "ANYTHINGLLM_API_KEY is not set. If your AnythingLLM instance requires authentication, set this variable."
    );
  }

  if (env.AI_HELP_DESK_ADMIN_EMAILS === "missing") {
    warnings.push(
      "AI_HELP_DESK_ADMIN_EMAILS is not set. This allows specific emails to access admin features. Optional but recommended."
    );
  }

  if (env.NEXT_PUBLIC_BASE_URL === "missing") {
    warnings.push(
      "NEXT_PUBLIC_BASE_URL is not set. This is required for the widget feature to work correctly. Set it to your OBD instance URL."
    );
  }

  // Optional table (for future sync feature)
  if (database.AiHelpDeskSyncState === "missing") {
    warnings.push(
      'Database table "AiHelpDeskSyncState" is missing. This is optional and only needed for future AnythingLLM sync features.'
    );
  }

  // Optional timeout (has default)
  if (env.ANYTHINGLLM_TIMEOUT_MS === "missing") {
    warnings.push(
      "ANYTHINGLLM_TIMEOUT_MS is not set. Using default timeout of 30000ms. Set this if you need a custom timeout."
    );
  }

  const ready = blockingIssues.length === 0;

  return {
    ready,
    blockingIssues,
    warnings,
  };
}

/**
 * Check AI Help Desk production readiness
 * 
 * This function:
 * - Checks required and optional environment variables
 * - Verifies database tables exist
 * - Returns a structured result with plain-English messages
 * 
 * Does NOT:
 * - Modify data
 * - Apply migrations
 * - Create tables
 * - Log secrets
 */
export async function checkAiHelpDeskProductionReadiness(): Promise<ProductionReadinessResult> {
  // Check environment variables (synchronous, no secrets logged)
  const env = checkEnvironmentVariables();

  // Check database tables (asynchronous, safe read-only queries)
  const database = await checkDatabaseTables();

  // Generate summary with plain-English messages
  const summary = generateSummary(env, database);

  return {
    env,
    database,
    summary,
  };
}

