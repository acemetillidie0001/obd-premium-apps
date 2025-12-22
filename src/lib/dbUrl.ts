/**
 * Database URL normalization for Prisma in Vercel serverless
 * 
 * Ensures DATABASE_URL has required parameters for Railway Postgres:
 * - sslmode=require (SSL required for Railway)
 * - connection_limit=1 (required for Prisma in serverless environments)
 */

export function getDatabaseUrl(): string {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Track which parameters we're adding (for logging only)
  const hasSslmode = connectionString.includes("sslmode=");
  const hasConnectionLimit = connectionString.includes("connection_limit=");

  // Ensure sslmode=require is present (Railway requires SSL)
  if (!hasSslmode) {
    const separator = connectionString.includes("?") ? "&" : "?";
    connectionString = `${connectionString}${separator}sslmode=require`;
  } else {
    // Replace sslmode=no-verify with sslmode=require if present
    // (We'll handle self-signed certs via Pool SSL config, not connection string)
    if (connectionString.includes("sslmode=no-verify")) {
      connectionString = connectionString.replace(/sslmode=no-verify/gi, "sslmode=require");
    }
  }

  // Ensure connection_limit=1 is present (required for Prisma in serverless)
  if (!hasConnectionLimit) {
    const separator = connectionString.includes("?") ? "&" : "?";
    connectionString = `${connectionString}${separator}connection_limit=1`;
  }

  // Log safe info (no secrets)
  if (!hasSslmode || !hasConnectionLimit) {
    console.log("[DB URL] Normalized DATABASE_URL:", {
      hasSslmode: connectionString.includes("sslmode="),
      hasConnectionLimit: connectionString.includes("connection_limit="),
      addedSslmode: !hasSslmode,
      addedConnectionLimit: !hasConnectionLimit,
    });
  }

  return connectionString;
}

