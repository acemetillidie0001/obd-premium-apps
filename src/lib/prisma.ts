import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Ensure connection string has SSL mode for Railway Postgres
// Railway requires SSL but uses self-signed certificates
// Use sslmode=no-verify to accept self-signed certificates
// IMPORTANT: Replace sslmode=require with sslmode=no-verify (require still validates certs)

// Check for any existing sslmode parameter (case-insensitive)
const sslmodeMatch = connectionString.match(/[?&]sslmode=([^&]+)/i);
if (sslmodeMatch) {
  const currentSslmode = sslmodeMatch[1];
  if (currentSslmode.toLowerCase() !== "no-verify") {
    // Replace existing sslmode with no-verify
    connectionString = connectionString.replace(/[?&]sslmode=[^&]+/i, `${sslmodeMatch[0].startsWith("?") ? "?" : "&"}sslmode=no-verify`);
    console.log("[Prisma] Replaced sslmode parameter with sslmode=no-verify for Railway Postgres");
  }
} else {
  // Add sslmode=no-verify if no sslmode is present
  const separator = connectionString.includes("?") ? "&" : "?";
  connectionString = `${connectionString}${separator}sslmode=no-verify`;
  console.log("[Prisma] Added sslmode=no-verify to connection string");
}

// Configure Pool with SSL for Railway Postgres
// Railway requires SSL but uses self-signed certificates
// Both connection string sslmode=no-verify AND Pool ssl config are needed
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Accept self-signed certificates (Railway uses these)
  },
});
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
