import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { getDatabaseUrl } from "../src/lib/dbUrl";

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  throw new Error(
    "Missing required env var DATABASE_URL. Ensure your environment loads it (for local scripts: confirm .env.local contains DATABASE_URL).",
  );
}

const globalForPrisma = globalThis as unknown as {
  __obd_prisma?: PrismaClient;
  __obd_pg_pool?: Pool;
};

// Scripts prefer a direct connection string when available (Prisma Studio compatible),
// but still require DATABASE_URL to be present to ensure env loading is correct.
const connectionString =
  process.env.DATABASE_URL_DIRECT?.trim() || getDatabaseUrl();

const pool =
  globalForPrisma.__obd_pg_pool ??
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.__obd_prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

// Prevent multiple instances during dev / watch runs
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__obd_prisma = prisma;
  globalForPrisma.__obd_pg_pool = pool;
}

export default prisma;

