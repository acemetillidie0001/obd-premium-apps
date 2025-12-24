# Automated Prisma Migrations

This document describes the automated Prisma migration workflow that runs on pushes to the `main` branch.

## Overview

The GitHub Actions workflow (`.github/workflows/prisma-migrate.yml`) automatically runs Prisma migrations when schema changes are detected. This ensures that your production database stays in sync with your schema without manual intervention.

## What the Workflow Does

When you push to `main`, the workflow:

1. **Checks for changes**: Only runs if `prisma/schema.prisma` or any files in `prisma/migrations/` have changed
2. **Installs dependencies**: Uses Node.js 20 and runs `npm ci` for fast, reliable installs
3. **Deploys migrations**: Runs `npx prisma migrate deploy` to apply pending migrations to the database
4. **Generates Prisma Client**: Runs `npx prisma generate` to update the Prisma Client with the latest schema

## Setup

### Adding DATABASE_URL as a GitHub Secret

To configure the workflow with your database connection string:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab
3. Click **New repository secret**
4. Set:
   - **Name**: `DATABASE_URL`
   - **Value**: Your database connection string (e.g., `postgresql://user:password@host:port/database`)
5. Click **Add secret**

The workflow will automatically use this secret for all migration operations.

**Important**: Never commit `DATABASE_URL` directly in code or workflow files. Always use GitHub Secrets.

### Configuring Auto-Migration Guard (Optional)

To use the emergency rollback switch:

1. Go to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab
2. Click **New repository variable**
3. Set:
   - **Name**: `AUTO_MIGRATIONS_ENABLED`
   - **Value**: `true` (to explicitly enable) or `false` (to disable)
4. Click **Add variable**

**Note**: If the variable is not set, auto-migrations are **enabled by default**. Only set this variable if you need to explicitly control the state.

## Deployment Order Recommendation

For safe production deployments, follow this order:

1. **Push code to main branch**
   - The workflow automatically detects Prisma schema/migration changes
   - Workflow applies migrations to production database

2. **Workflow applies migrations**
   - Monitor the GitHub Actions workflow in the **Actions** tab
   - Verify the migration completes successfully before proceeding

3. **Verify production**
   - Check application logs for any migration-related errors
   - Verify new schema changes are reflected correctly
   - Test critical functionality that depends on schema changes

**Best Practice**: Deploy code changes immediately after migrations complete, or ensure your application code is backward-compatible with both old and new schema versions during the deployment window.

## Safety Checklist

Before pushing schema changes that will trigger auto-migrations:

- [ ] **Additive only**: Migration only adds new tables, columns, indexes, or relations
- [ ] **No destructive changes**: No dropping tables, columns, or indexes
- [ ] **Backward compatible**: Application code works with existing schema
- [ ] **Tested locally**: Migration tested in local/staging environment
- [ ] **Database backup**: Production database backup verified (if possible)
- [ ] **Monitoring ready**: Application monitoring set up to detect migration issues
- [ ] **Rollback plan**: Plan for manual intervention if migration fails

### Critical Safety Rule: Additive Migrations Only

⚠️ **CRITICAL**: All migrations deployed automatically **MUST be additive only** to avoid downtime and data loss.

**Why**: Automated migrations run immediately on push to main. Destructive changes (drops, renames, type changes) require:
- Data migration scripts
- Coordinated deployment timing
- Manual verification steps
- Potential rollback procedures

These cannot be safely automated.

## Disabling the Workflow

If you need to temporarily disable automated migrations:

### Option 1: Emergency Rollback Switch (Recommended)

Use the repository variable `AUTO_MIGRATIONS_ENABLED` as a quick kill switch:

1. Go to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab
2. Click **New repository variable**
3. Set:
   - **Name**: `AUTO_MIGRATIONS_ENABLED`
   - **Value**: `false`
4. Click **Add variable**

The workflow will skip all migration steps while still running (showing a skipped status).

**To re-enable**: Either set the value to `true` or delete the variable (default behavior is enabled).

### Option 2: Skip via commit message
Add `[skip migrations]` or `[skip ci]` to your commit message:

```bash
git commit -m "Update schema [skip migrations]"
```

### Option 3: Disable the workflow file
Rename or delete `.github/workflows/prisma-migrate.yml`:

```bash
git mv .github/workflows/prisma-migrate.yml .github/workflows/prisma-migrate.yml.disabled
```

### Option 4: Modify the workflow trigger
Edit `.github/workflows/prisma-migrate.yml` and comment out the trigger:

```yaml
# on:
#   push:
#     branches:
#       - main
```

## Migration Best Practices

### Only Additive Migrations

⚠️ **Critical Rule**: All migrations deployed automatically should be **additive only** to avoid downtime and data loss.

#### ✅ Safe (Additive) Changes:
- Adding new tables
- Adding new columns (with default values or nullable)
- Adding new indexes
- Adding new relations

#### ❌ Unsafe (Breaking) Changes:
- Dropping tables
- Dropping columns
- Renaming columns (creates new column, doesn't migrate data)
- Changing column types without data migration
- Removing indexes that are in use

### For Breaking Changes

If you need to make breaking changes:

1. **Disable auto-migrations first**:
   - Set `AUTO_MIGRATIONS_ENABLED` repository variable to `false` (see Disabling the Workflow section)
   - Or use `[skip migrations]` in commit message

2. **Create a multi-step migration plan**:
   - Step 1: Add new column/table alongside old one (can be automated)
   - Step 2: Deploy application code that migrates data and uses both old/new
   - Step 3: Remove old column/table (separate migration, run manually after verification)

3. **Deploy manually**:
   - Run migrations manually with verification: `npx prisma migrate deploy`
   - Monitor application for issues
   - Verify data integrity

4. **Re-enable auto-migrations**:
   - Remove `AUTO_MIGRATIONS_ENABLED` variable or set to `true`
   - Future additive migrations will run automatically again

5. **Test in staging first**:
   - Always test migrations in a staging environment
   - Use production data copies when possible

## Troubleshooting

### Migration fails in workflow

**Immediate actions:**

1. **Check workflow logs**:
   - Go to the **Actions** tab in GitHub
   - Open the failed workflow run
   - Review error messages in the failed step

2. **Identify the failure cause**:
   - Database connection issues: Verify `DATABASE_URL` secret is correct
   - Network/firewall: Ensure database is accessible from GitHub Actions
   - Migration errors: Check for syntax errors, constraint violations, or missing dependencies

3. **Fix the issue**:
   - If it's a migration file issue: Fix the migration locally and push a new commit
   - If it's a database/connection issue: Fix the configuration and re-run the workflow

4. **Re-run the workflow**:
   - Go to the failed workflow run in **Actions** tab
   - Click **Re-run all jobs** or **Re-run failed jobs**
   - Alternatively, push a new commit that touches a file in the repository (empty commit works: `git commit --allow-empty -m "Retry migration"`)

5. **If migration partially applied**:
   - Check migration status: `npx prisma migrate status`
   - You may need to manually resolve migration state in the database
   - Consider rolling back the partial migration if possible

**Preventing re-runs**: If the migration failed and you need to prevent automatic retry on the next push:
- Set `AUTO_MIGRATIONS_ENABLED` to `false` until you fix the issue
- Fix the migration locally and test before re-enabling

### Workflow runs when it shouldn't

- Verify the `paths` filter in the workflow file
- Check that you're not committing migration files unintentionally
- Use `[skip migrations]` in commit message if needed
- Set `AUTO_MIGRATIONS_ENABLED` to `false` as a temporary guard

### DATABASE_URL not found error

- Go to repository Settings → Secrets and variables → Actions → Secrets tab
- Verify `DATABASE_URL` secret exists
- Ensure it's spelled exactly as `DATABASE_URL` (case-sensitive)
- Update the secret value if needed
- Remember: Secrets are different from Variables (use Secrets for sensitive data)

### Workflow skipped unexpectedly

- Check if `AUTO_MIGRATIONS_ENABLED` repository variable is set to `false`
- Go to Settings → Secrets and variables → Actions → Variables tab
- Either delete the variable or set it to `true` to enable auto-migrations

## Related Documentation

- [Prisma Migration Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Database Deployment Checklist](../DEPLOY_CHECKLIST.md)

