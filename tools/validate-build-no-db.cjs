#!/usr/bin/env node
/**
 * Build Script Database Call Validator
 * 
 * HARD RULE: Build scripts MUST NOT make any database connections or calls.
 * 
 * This script validates that build-related npm scripts do not contain:
 * - prisma migrate (any migrate command)
 * - prisma db (any db command except generate)
 * - Database connection strings or queries
 * - Migration resolver scripts
 * 
 * Usage: node tools/validate-build-no-db.cjs
 */

const fs = require("fs");
const path = require("path");

const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json");
const FORBIDDEN_PATTERNS = [
  /prisma\s+migrate/i,
  /prisma\s+db\s+(?!generate)/i, // Allow "prisma db generate" but not other db commands
  /migrate\s+(deploy|resolve|status)/i,
  /db:(resolve|deploy|sync|status|check|exec)/i,
  /resolve.*migration/i,
  /check.*migration/i,
  /validate-db-url/i,
  /verify-db/i,
  /check-deployment-status/i,
];

// Build-related scripts that MUST NOT have DB calls
const BUILD_SCRIPTS = [
  "build",
  "build:prod",
  "build:vercel",
  "vercel-build",
  "ci",
  "postinstall",
  "prebuild",
  "prepare",
];

function validateBuildScripts() {
  console.log("=".repeat(60));
  console.log("Build Script Database Call Validator");
  console.log("=".repeat(60));
  console.log();

  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const scripts = packageJson.scripts || {};

  let hasErrors = false;
  const errors = [];

  for (const scriptName of BUILD_SCRIPTS) {
    const scriptCommand = scripts[scriptName];
    if (!scriptCommand) {
      continue; // Script doesn't exist, skip
    }

    console.log(`Checking: ${scriptName}`);
    console.log(`  Command: ${scriptCommand}`);

    // Check for forbidden patterns
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(scriptCommand)) {
        const error = `❌ ${scriptName} contains forbidden database operation`;
        errors.push({ script: scriptName, command: scriptCommand, error });
        console.log(`  ${error}`);
        hasErrors = true;
      }
    }

    // Check if script calls another script that might have DB calls
    const calledScripts = scriptCommand.match(/pnpm\s+run\s+(\w+)/g) || [];
    for (const call of calledScripts) {
      const calledScriptName = call.match(/pnpm\s+run\s+(\w+)/)[1];
      if (BUILD_SCRIPTS.includes(calledScriptName)) {
        // This is fine - it's calling another build script
        continue;
      }
      
      // Check if the called script has DB operations
      const calledScriptCommand = scripts[calledScriptName];
      if (calledScriptCommand) {
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(calledScriptCommand)) {
            const error = `❌ ${scriptName} calls ${calledScriptName} which contains forbidden database operation`;
            errors.push({ 
              script: scriptName, 
              command: scriptCommand, 
              calledScript: calledScriptName,
              calledCommand: calledScriptCommand,
              error 
            });
            console.log(`  ${error}`);
            hasErrors = true;
          }
        }
      }
    }

    if (!hasErrors) {
      console.log(`  ✅ No database operations detected`);
    }
    console.log();
  }

  console.log("=".repeat(60));
  if (hasErrors) {
    console.log("❌ VALIDATION FAILED");
    console.log("=".repeat(60));
    console.log();
    console.log("Build scripts MUST NOT contain database operations.");
    console.log("Move all database operations to explicit ops-only commands.");
    console.log();
    console.log("Errors found:");
    errors.forEach(({ script, error }) => {
      console.log(`  - ${error}`);
    });
    console.log();
    process.exit(1);
  } else {
    console.log("✅ VALIDATION PASSED");
    console.log("=".repeat(60));
    console.log();
    console.log("All build scripts are free of database operations.");
    console.log("✅ Safe to run builds without database access.");
    process.exit(0);
  }
}

// Run validation
try {
  validateBuildScripts();
} catch (error) {
  console.error("❌ Validation script failed:", error.message);
  process.exit(1);
}

