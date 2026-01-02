# Migration Recovery Guide

This guide explains how to recover from a failed migration, specifically for the `20251225045724_add_review_request_automation_tables` migration.

## When to Use This Guide

Use this recovery process when:
- A migration has been marked as `rolled_back` in the `_prisma_migrations` table
- You need to re-run a migration after patching the migration SQL file
- The migration failed but you've fixed the migration SQL and want to re-apply it

## Recovery Steps

Follow these steps **in order**:

### 1. Resolve the Rolled-Back Migration

```bash
pnpm db:resolve:review
```

**What this does:**
- Uses `prisma migrate resolve --rolled-back` to mark the migration as no longer rolled back
- This tells Prisma that the migration should be re-run on the next deploy
- The `--rolled-back` flag is crucial: it tells Prisma the migration was previously rolled back and needs to be re-applied

**Why `--rolled-back`?**
- When a migration is marked as `rolled_back` in the database, Prisma won't re-run it by default
- Using `--rolled-back` tells Prisma: "This migration was rolled back, but I've fixed it, so please re-run it"
- On the next `prisma migrate deploy`, Prisma will execute the patched `migration.sql` file

### 2. Deploy the Migration

```bash
pnpm db:deploy
```

**What this does:**
- Runs `prisma migrate deploy` to apply all pending migrations
- Since we resolved the rolled-back migration in step 1, Prisma will now re-execute the patched migration SQL
- The patched migration SQL is resilient and will not fail if the `User` table doesn't exist

### 3. Verify Migration Status

```bash
pnpm db:check
```

**What this does:**
- Runs `tools/check-migrations.cjs` to verify all migrations are clean
- Checks for any unfinished migrations (`finished_at IS NULL`)
- Exits with code 0 if all migrations are clean, code 1 if any issues are found

**Expected output:**
```
✅ Migration state clean.
✅ Script completed successfully.
```

## Complete Recovery Command

You can run all three steps in sequence:

```bash
pnpm db:resolve:review && pnpm db:deploy && pnpm db:check
```

## Understanding the Process

### Why This Works

1. **Step 1 (`db:resolve:review`)**: Clears the `rolled_back_at` flag in `_prisma_migrations`, telling Prisma the migration is ready to be re-run

2. **Step 2 (`db:deploy`)**: Prisma sees the migration is no longer rolled back and executes the patched `migration.sql` file. The patched migration:
   - Creates tables without foreign keys to `User` initially
   - Conditionally adds foreign keys only if `User` table exists
   - Uses `IF NOT EXISTS` for idempotency

3. **Step 3 (`db:check`)**: Verifies the migration completed successfully and no other migrations are in a bad state

### Migration Resilience

The patched migration (`20251225045724_add_review_request_automation_tables/migration.sql`) is resilient:
- ✅ Never fails if `User` table doesn't exist
- ✅ Creates tables first, then conditionally adds foreign keys
- ✅ Uses `IF NOT EXISTS` for indexes and constraints
- ✅ Safe to run multiple times (idempotent)

## Troubleshooting

### If `db:resolve:review` fails

**Error:** "Migration not found" or "Migration is not rolled back"
- Check the migration name matches exactly: `20251225045724_add_review_request_automation_tables`
- Verify the migration exists in `prisma/migrations/`
- Check migration status: `pnpm db:status`

### If `db:deploy` fails

**Error:** Migration still fails
- Verify the migration SQL file has been patched correctly
- Check that the migration uses the resilient pattern (no inline foreign keys, conditional FK addition)
- Review the error message for specific table/constraint issues

### If `db:check` shows unfinished migrations

**Error:** "Migration state is NOT clean"
- Review the unfinished migrations listed
- Check if any other migrations need to be resolved
- Run `pnpm db:status` for detailed migration information

## Related Documentation

- `DEPLOYMENT_LOCK.md` - Production deployment safety guidelines
- `tools/resolve-failed-migration.cjs` - Script to resolve failed migrations (different use case)
- `tools/check-migrations.cjs` - Script to check migration status

## Important Notes

⚠️ **Never run `prisma migrate reset` in production** - This will delete all data!

✅ **Always verify with `db:check`** after deploying migrations

✅ **The patched migration is safe** - It will not fail if `User` table doesn't exist

---

**Last Updated:** 2025-01-02

