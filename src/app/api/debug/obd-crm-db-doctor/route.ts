/**
 * OBD CRM DB Doctor Endpoint
 * 
 * Dev-only diagnostic endpoint that performs comprehensive database health checks.
 * Returns a full "doctor report" with individual check results.
 * 
 * Response format:
 * {
 *   ok: boolean,
 *   data: {
 *     verdict: "PASS" | "FAIL",
 *     checks: Array<{
 *       id: string,
 *       name: string,
 *       status: "PASS" | "FAIL",
 *       message: string,
 *       details?: any
 *     }>,
 *     time: string (ISO timestamp),
 *     nodeEnv: string,
 *     databaseUrlPresent: boolean,
 *     databaseUrlIsValid: boolean,
 *     parsed: {
 *       host: string | null,
 *       db: string | null,
 *       schema: string | null,
 *       rawPathname: string | null
 *     },
 *     sourceHint: string
 *   }
 * }
 * 
 * Query params:
 * - ?testEndpoints=1 - Enable endpoint tests (contacts/tags API calls)
 * 
 * Returns 404 in production.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Admin email allowlist for production access
const ADMIN_EMAILS = ["scottbaxtermarketing@gmail.com"];

// Standard error response type for API errors
type ApiErrorResponse = {
  ok: false;
  error: string;
  code: string;
  details?: any;
};

type Check = {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  message: string;
  details?: any;
};

type DbDoctorReport = {
  ok: boolean;
  data: {
    verdict: "PASS" | "FAIL";
    checks: Check[];
    time: string;
    nodeEnv: string;
    databaseUrlPresent: boolean;
    databaseUrlIsValid: boolean;
    parsed: {
      host: string | null;
      db: string | null;
      schema: string | null;
      rawPathname: string | null;
    };
    sourceHint: string;
  };
};

// Backward compatibility: support old format
type LegacyDbDoctorReport = {
  ok: boolean;
  data: {
    databaseUrlPresent: boolean;
    databaseHost: string | null;
    databaseName: string | null;
    schema: string | null;
    prismaModelsAvailable: {
      crmContact: boolean;
      crmTag: boolean;
      crmContactActivity: boolean;
      user: boolean;
    };
    tablesExist: {
      CrmContact: boolean;
      CrmTag: boolean;
      CrmContactActivity: boolean;
      CrmContactTag: boolean;
      User: boolean;
      PrismaMigrations: boolean;
    };
    migrationStatusHint: string;
    recommendedFix: string[];
  };
};

type DbDoctorResponse = DbDoctorReport | LegacyDbDoctorReport | ApiErrorResponse;

export async function GET(request: NextRequest): Promise<NextResponse<DbDoctorResponse>> {
  console.log("CRM DB Doctor route hit");
  
  // Production access control: require admin session
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    try {
      const session = await auth();
      
      // Check if user is authenticated
      if (!session?.user?.email) {
        return NextResponse.json(
          {
            ok: false,
            error: "Forbidden",
            code: "FORBIDDEN",
          },
          { status: 403 }
        );
      }
      
      // Check if user email is in allowlist
      const userEmail = session.user.email.toLowerCase();
      const isAdmin = ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === userEmail);
      
      if (!isAdmin) {
        return NextResponse.json(
          {
            ok: false,
            error: "Forbidden",
            code: "FORBIDDEN",
          },
          { status: 403 }
        );
      }
    } catch (error) {
      // If session check fails, deny access
      return NextResponse.json(
        {
          ok: false,
          error: "Forbidden",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }
  }
  // In development, allow without session check (developer convenience)

  const { searchParams } = new URL(request.url);
  const testEndpoints = searchParams.get("testEndpoints") === "1";
  const useLegacyFormat = searchParams.get("legacy") === "1";

  const nodeEnv = process.env.NODE_ENV || "development";
  const checks: Check[] = [];
  let verdict: "PASS" | "FAIL" = "FAIL";

  // Helper to add a check
  const addCheck = (id: string, name: string, status: "PASS" | "FAIL", message: string, details?: any) => {
    checks.push({ id, name, status, message, details });
  };

  // Check 1: DATABASE_URL presence
  const databaseUrl = process.env.DATABASE_URL;
  const databaseUrlPresent = !!databaseUrl;
  
  if (databaseUrlPresent) {
    addCheck("db_url_present", "DATABASE_URL Present", "PASS", "DATABASE_URL environment variable is set");
  } else {
    addCheck("db_url_present", "DATABASE_URL Present", "FAIL", "DATABASE_URL environment variable is not set");
    verdict = "FAIL";
  }

  // Check 2: DATABASE_URL validity
  let databaseUrlIsValid = false;
  let host: string | null = null;
  let db: string | null = null;
  let schema: string | null = null;
  let rawPathname: string | null = null;
  let sourceHint = "process";

  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      host = url.host;
      rawPathname = url.pathname;
      db = url.pathname ? url.pathname.replace(/^\//, "") : null;
      schema = url.searchParams.get("schema") ?? null;
      databaseUrlIsValid = true;
      sourceHint = "env.local|env|process";
      addCheck("db_url_valid", "DATABASE_URL Valid", "PASS", `Database URL is valid (host: ${host})`);
    } catch (error) {
      databaseUrlIsValid = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      addCheck("db_url_valid", "DATABASE_URL Valid", "FAIL", `DATABASE_URL is malformed: ${errorMsg}`);
      verdict = "FAIL";
    }
  }

  // Check 3: Prisma client initialization
  try {
    if (prisma) {
      addCheck("prisma_client", "Prisma Client Initialized", "PASS", "Prisma client is available");
    } else {
      addCheck("prisma_client", "Prisma Client Initialized", "FAIL", "Prisma client is not initialized");
      verdict = "FAIL";
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    addCheck("prisma_client", "Prisma Client Initialized", "FAIL", `Prisma client error: ${errorMsg}`);
    verdict = "FAIL";
  }

  // Check 4: Prisma models availability
  const prismaModelsAvailable = {
    crmContact: false,
    crmTag: false,
    crmContactActivity: false,
    user: false,
  };

  if (prisma) {
    try {
      const prismaAny = prisma as any;
      prismaModelsAvailable.crmContact = typeof prismaAny.crmContact?.findMany === "function";
      prismaModelsAvailable.crmTag = typeof prismaAny.crmTag?.findMany === "function";
      prismaModelsAvailable.crmContactActivity = typeof prismaAny.crmContactActivity?.findMany === "function";
      prismaModelsAvailable.user = typeof prismaAny.user?.findMany === "function";

      if (prismaModelsAvailable.crmContact && prismaModelsAvailable.crmTag && 
          prismaModelsAvailable.crmContactActivity && prismaModelsAvailable.user) {
        addCheck("prisma_models", "Prisma Models Available", "PASS", "All required Prisma models are available");
      } else {
        const missing = [];
        if (!prismaModelsAvailable.crmContact) missing.push("crmContact");
        if (!prismaModelsAvailable.crmTag) missing.push("crmTag");
        if (!prismaModelsAvailable.crmContactActivity) missing.push("crmContactActivity");
        if (!prismaModelsAvailable.user) missing.push("user");
        addCheck("prisma_models", "Prisma Models Available", "FAIL", 
          `Missing Prisma models: ${missing.join(", ")}. Run: npx prisma generate`, 
          { missing });
        verdict = "FAIL";
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addCheck("prisma_models", "Prisma Models Available", "FAIL", `Error checking Prisma models: ${errorMsg}`);
      verdict = "FAIL";
    }
  }

  // Check 5: Database tables existence
  const tablesExist = {
    CrmContact: false,
    CrmTag: false,
    CrmContactActivity: false,
    CrmContactTag: false,
    User: false,
    PrismaMigrations: false,
  };

  if (prisma && databaseUrlIsValid) {
    try {
      const tableChecks = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('CrmContact', 'CrmTag', 'CrmContactActivity', 'CrmContactTag', 'User', '_prisma_migrations')
      `;

      const existingTables = new Set(tableChecks.map((row) => row.table_name));
      
      tablesExist.CrmContact = existingTables.has("CrmContact");
      tablesExist.CrmTag = existingTables.has("CrmTag");
      tablesExist.CrmContactActivity = existingTables.has("CrmContactActivity");
      tablesExist.CrmContactTag = existingTables.has("CrmContactTag");
      tablesExist.User = existingTables.has("User");
      tablesExist.PrismaMigrations = existingTables.has("_prisma_migrations");

      const allCrmTablesExist = 
        tablesExist.CrmContact &&
        tablesExist.CrmTag &&
        tablesExist.CrmContactActivity &&
        tablesExist.CrmContactTag;

      if (!tablesExist.PrismaMigrations) {
        addCheck("db_tables", "Database Tables Exist", "FAIL", 
          "No _prisma_migrations table found. Run: npx prisma migrate deploy",
          { tablesExist });
        verdict = "FAIL";
      } else if (!allCrmTablesExist) {
        const missing = [];
        if (!tablesExist.CrmContact) missing.push("CrmContact");
        if (!tablesExist.CrmTag) missing.push("CrmTag");
        if (!tablesExist.CrmContactActivity) missing.push("CrmContactActivity");
        if (!tablesExist.CrmContactTag) missing.push("CrmContactTag");
        addCheck("db_tables", "Database Tables Exist", "FAIL", 
          `Missing CRM tables: ${missing.join(", ")}. Run: npx prisma migrate deploy`,
          { tablesExist, missing });
        verdict = "FAIL";
      } else {
        addCheck("db_tables", "Database Tables Exist", "PASS", "All required CRM tables exist in database");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addCheck("db_tables", "Database Tables Exist", "FAIL", 
        `Database query failed: ${errorMsg}. Check DATABASE_URL connection string`,
        { error: errorMsg });
      verdict = "FAIL";
    }
  } else {
    addCheck("db_tables", "Database Tables Exist", "FAIL", 
      "Cannot check tables - DATABASE_URL invalid or Prisma client not available");
    verdict = "FAIL";
  }

  // Check 6: Optional endpoint tests (only if ?testEndpoints=1)
  if (testEndpoints) {
    try {
      // Test contacts endpoint
      const contactsUrl = new URL("/api/obd-crm/contacts", request.url);
      const contactsResponse = await fetch(contactsUrl.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (contactsResponse.ok) {
        addCheck("endpoint_contacts", "Contacts Endpoint", "PASS", "Contacts endpoint returns 200");
      } else {
        addCheck("endpoint_contacts", "Contacts Endpoint", "FAIL", 
          `Contacts endpoint returned ${contactsResponse.status}`);
        verdict = "FAIL";
      }

      // Test tags endpoint
      const tagsUrl = new URL("/api/obd-crm/tags", request.url);
      const tagsResponse = await fetch(tagsUrl.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (tagsResponse.ok) {
        addCheck("endpoint_tags", "Tags Endpoint", "PASS", "Tags endpoint returns 200");
      } else {
        addCheck("endpoint_tags", "Tags Endpoint", "FAIL", 
          `Tags endpoint returned ${tagsResponse.status}`);
        verdict = "FAIL";
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addCheck("endpoint_tests", "Endpoint Tests", "FAIL", 
        `Error testing endpoints: ${errorMsg}`);
      verdict = "FAIL";
    }
  }

  // Determine final verdict if all critical checks pass
  const criticalChecksPass = checks
    .filter(c => c.id !== "endpoint_contacts" && c.id !== "endpoint_tags" && c.id !== "endpoint_tests")
    .every(c => c.status === "PASS");

  if (criticalChecksPass) {
    verdict = "PASS";
  }

  // Return legacy format if requested
  if (useLegacyFormat) {
    const legacyReport: LegacyDbDoctorReport = {
      ok: verdict === "PASS",
      data: {
        databaseUrlPresent,
        databaseHost: host,
        databaseName: db,
        schema,
        prismaModelsAvailable,
        tablesExist,
        migrationStatusHint: checks.find(c => c.id === "db_tables")?.message || "Unknown",
        recommendedFix: checks.filter(c => c.status === "FAIL").map(c => c.message),
      },
    };
    return NextResponse.json(legacyReport, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
      },
    });
  }

  // Return new format
  const report: DbDoctorReport = {
    ok: verdict === "PASS",
    data: {
      verdict,
      checks,
      time: new Date().toISOString(),
      nodeEnv,
      databaseUrlPresent,
      databaseUrlIsValid,
      parsed: {
        host,
        db,
        schema,
        rawPathname,
      },
      sourceHint,
    },
  };

  return NextResponse.json(report, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
}
