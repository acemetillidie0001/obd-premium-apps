import { spawnSync } from "node:child_process";

function run(cmd) {
  const res = spawnSync(cmd, {
    shell: true,
    stdio: "inherit",
  });
  if (typeof res.status === "number" && res.status !== 0) {
    process.exit(res.status);
  }
}

const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || "none";
const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "none";
console.log("BUILD_SHA=", buildSha, "ENV=", env, "CWD=", process.cwd());

const hasDirect = !!process.env.DATABASE_URL_DIRECT;
const hasAny = hasDirect || !!process.env.DATABASE_URL;

// Prisma generate does not require a live DB connection, but Prisma config loading may require a URL.
// prisma.config.ts now provides a safe placeholder fallback.
//
// Migrations DO require a real DB connection. In production we only run them when DATABASE_URL_DIRECT is present.
if (hasDirect) {
  run("prisma migrate deploy");
} else {
  console.warn(
    "[build:vercel] Skipping `prisma migrate deploy` (DATABASE_URL_DIRECT missing)."
  );
}

// Generate Prisma client whenever possible (still safe with placeholder URL).
if (!hasAny) {
  console.warn(
    "[build:vercel] DATABASE_URL(_DIRECT) missing; running `prisma generate` with placeholder datasource."
  );
}
run("prisma generate");

// Next build must always run.
run("next build");


