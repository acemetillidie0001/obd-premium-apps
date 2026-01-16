/**
 * Prisma migrate wrapper (repo-safe)
 *
 * Purpose:
 * - Provide a repeatable, low-risk workflow when `prisma migrate dev` fails due to
 *   shadow DB issues (commonly error P3006 in this repo).
 * - NEVER performs destructive actions (no reset, no push, no drop).
 *
 * Usage:
 * - pnpm prisma:migrate:safe migrate dev --create-only --name add_feature_x
 * - pnpm prisma:migrate:safe migrate dev
 *
 * If the command fails with a shadow DB error, this script prints the approved
 * manual SQL migration workflow and exits with the same code.
 */

const { spawn } = require("node:child_process");

function printGuidance() {
  // Keep this short; the full doc lives in docs/dev/prisma-migrations.md
  // eslint-disable-next-line no-console
  console.error("\n[Prisma] Shadow DB migration failure detected (common in this repo).\n");
  // eslint-disable-next-line no-console
  console.error("Approved workaround: create a manual SQL migration file and run migrate deploy.\n");
  // eslint-disable-next-line no-console
  console.error("Docs: docs/dev/prisma-migrations.md\n");
  // eslint-disable-next-line no-console
  console.error("Typical flow:");
  // eslint-disable-next-line no-console
  console.error("  1) Update prisma/schema.prisma");
  // eslint-disable-next-line no-console
  console.error('  2) Add prisma/migrations/<timestamp>_<name>/migration.sql (manual)');
  // eslint-disable-next-line no-console
  console.error("  3) pnpm -s prisma:generate");
  // eslint-disable-next-line no-console
  console.error("  4) pnpm -s prisma:migrate:deploy\n");
}

function looksLikeShadowDbError(output) {
  const s = (output || "").toString();
  return (
    s.includes("P3006") ||
    s.toLowerCase().includes("shadow database") ||
    s.toLowerCase().includes("failed to apply migration") && s.toLowerCase().includes("shadow") ||
    s.toLowerCase().includes("migration") && s.toLowerCase().includes("shadow")
  );
}

const args = process.argv.slice(2);
if (args.length === 0) {
  // Default to "prisma migrate status" (read-only) when no args provided.
  args.push("migrate", "status");
}

const child = spawn("prisma", args, {
  stdio: ["inherit", "pipe", "pipe"],
  shell: true,
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (d) => {
  stdout += d.toString();
  process.stdout.write(d);
});
child.stderr.on("data", (d) => {
  stderr += d.toString();
  process.stderr.write(d);
});

child.on("close", (code) => {
  const combined = `${stdout}\n${stderr}`;
  if (code !== 0 && looksLikeShadowDbError(combined)) {
    printGuidance();
  }
  process.exit(code ?? 1);
});


