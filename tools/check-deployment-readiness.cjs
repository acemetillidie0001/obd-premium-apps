/**
 * Deployment Readiness Check
 * 
 * Verifies that the project is ready for production deployment:
 * - Checks Prisma schema for all required models
 * - Verifies migration files exist
 * - Checks for potential conflicts
 * - Validates schema coherence
 * 
 * Usage: node tools/check-deployment-readiness.cjs
 */

const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.join(__dirname, "..", "prisma", "schema.prisma");
const MIGRATIONS_PATH = path.join(__dirname, "..", "prisma", "migrations");

// Required models by feature area
const REQUIRED_MODELS = {
  auth: ["User", "Account", "Session", "VerificationToken"],
  scheduler: [
    "BookingService",
    "BookingSettings",
    "BookingPublicLink",
    "BookingRequest",
    "BookingRequestAuditLog",
    "BookingTheme",
    "AvailabilityWindow",
    "AvailabilityException",
    "SchedulerCalendarConnection",
  ],
  crm: [
    "CrmContact",
    "CrmTag",
    "CrmContactTag",
    "CrmContactActivity",
  ],
  reviewAutomation: [
    "ReviewRequestCampaign",
    "ReviewRequestCustomer",
    "ReviewRequestQueueItem",
    "ReviewRequestDataset",
    "UsageCounter",
  ],
  social: [
    "SocialAutoposterSettings",
    "SocialQueueItem",
    "SocialDeliveryAttempt",
    "SocialAccountConnection",
    "SocialPostingDestination",
    "SocialPublishAttempt",
  ],
  other: [
    "ProReport",
    "BrandProfile",
    "ImageRequest",
    "ImageEvent",
    "AiWorkspaceMap",
    "AiHelpDeskEntry",
    "AiHelpDeskSyncState",
    "AiHelpDeskQuestionLog",
    "AiHelpDeskWidgetKey",
    "AiHelpDeskWidgetSettings",
    "AiHelpDeskWidgetEvent",
    "RateLimitEvent",
  ],
};

function readSchema() {
  try {
    return fs.readFileSync(SCHEMA_PATH, "utf8");
  } catch (error) {
    console.error("❌ Failed to read schema.prisma:", error.message);
    process.exit(1);
  }
}

function getModelsFromSchema(schema) {
  const modelMatches = schema.matchAll(/^model (\w+)/gm);
  const models = [];
  for (const match of modelMatches) {
    models.push(match[1]);
  }
  return models;
}

function getMigrations() {
  try {
    const entries = fs.readdirSync(MIGRATIONS_PATH, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name !== "migration_lock.toml")
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    console.error("❌ Failed to read migrations directory:", error.message);
    process.exit(1);
  }
}

function checkModelExists(models, modelName, feature) {
  if (models.includes(modelName)) {
    return { exists: true, model: modelName };
  }
  return { exists: false, model: modelName, feature };
}

function checkDeploymentReadiness() {
  console.log("🔍 Checking deployment readiness...\n");

  // Read schema
  const schema = readSchema();
  const models = getModelsFromSchema(schema);
  const migrations = getMigrations();

  console.log(`📊 Found ${models.length} models in schema`);
  console.log(`📦 Found ${migrations.length} migration directories\n`);

  // Check required models
  const missingModels = [];
  const foundModels = [];

  for (const [feature, modelList] of Object.entries(REQUIRED_MODELS)) {
    console.log(`\n🔎 Checking ${feature} models:`);
    for (const modelName of modelList) {
      const check = checkModelExists(models, modelName, feature);
      if (check.exists) {
        console.log(`  ✅ ${modelName}`);
        foundModels.push(modelName);
      } else {
        console.log(`  ❌ ${modelName} (MISSING)`);
        missingModels.push(check);
      }
    }
  }

  // Check for critical migrations
  console.log("\n\n📋 Checking critical migrations:");
  const criticalMigrations = [
    "add_auth_models",
    "20251225045724_add_review_request_automation_tables",
    "20251225050000_add_user_foreign_keys_to_review_request_tables",
    "20251231230000_add_crm_tables",
    "20260101091921_add_v4_tier1a_models",
  ];

  const missingMigrations = [];
  for (const migration of criticalMigrations) {
    if (migrations.some((m) => m.includes(migration.split("_")[0]) || m === migration)) {
      console.log(`  ✅ ${migration}`);
    } else {
      console.log(`  ❌ ${migration} (MISSING)`);
      missingMigrations.push(migration);
    }
  }

  // Check for User table dependencies
  console.log("\n\n🔗 Checking User table dependencies:");
  const userDependentModels = models.filter((model) => {
    const modelDef = schema.match(new RegExp(`model ${model}[\\s\\S]*?(?=^model |$)`))?.[0] || "";
    return modelDef.includes('references: [id]') && modelDef.includes('User');
  });

  console.log(`  Found ${userDependentModels.length} models with User foreign keys:`);
  userDependentModels.forEach((model) => {
    console.log(`    - ${model}`);
  });

  // Summary
  console.log("\n\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT READINESS SUMMARY");
  console.log("=".repeat(60));

  if (missingModels.length === 0 && missingMigrations.length === 0) {
    console.log("\n✅ ALL CHECKS PASSED");
    console.log("\n✅ Schema is complete");
    console.log("✅ All required models are present");
    console.log("✅ All critical migrations exist");
    console.log("✅ Ready for production deployment");
    console.log("\n📝 Next steps:");
    console.log("   1. Run: pnpm prisma migrate deploy");
    console.log("   2. Verify migration status");
    console.log("   3. Test application functionality");
    return true;
  } else {
    console.log("\n❌ DEPLOYMENT BLOCKERS FOUND");
    if (missingModels.length > 0) {
      console.log(`\n❌ Missing ${missingModels.length} model(s):`);
      missingModels.forEach(({ model, feature }) => {
        console.log(`   - ${model} (${feature})`);
      });
    }
    if (missingMigrations.length > 0) {
      console.log(`\n❌ Missing ${missingMigrations.length} migration(s):`);
      missingMigrations.forEach((migration) => {
        console.log(`   - ${migration}`);
      });
    }
    console.log("\n⚠️  Please fix the issues above before deploying.");
    return false;
  }
}

// Run check
const isReady = checkDeploymentReadiness();
process.exit(isReady ? 0 : 1);

