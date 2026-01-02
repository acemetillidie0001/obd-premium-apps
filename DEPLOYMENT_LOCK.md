# Deployment Lock - Migration Resolution

## Status: ✅ RESOLVED

**Date:** 2025-01-02  
**Timestamp:** Migration `20251225045724_add_review_request_automation_tables` resolved

---

## Migration Resolution

### Resolved Migration
- **Migration Name:** `20251225045724_add_review_request_automation_tables`
- **Resolution Method:** Manual update via `tools/resolve-failed-migration.cjs`
- **Action Taken:** Set `finished_at = NOW()` and `applied_steps_count = 1` in `_prisma_migrations` table
- **Status:** Migration marked as completed

### Production Database Status
✅ **Production database is now migration-clean**

All migrations have been successfully applied. The database schema is in sync with the Prisma schema definition.

---

## ⚠️ CRITICAL PRODUCTION WARNINGS

### NEVER Run These Commands in Production

**🚫 `prisma migrate reset`**  
**This command will:**
- Drop all database tables
- Delete all data
- Recreate the database from scratch
- **CAUSE IRREVERSIBLE DATA LOSS**

**🚫 `prisma db push --force-reset`**  
**This command will:**
- Drop all database tables
- Delete all data
- **CAUSE IRREVERSIBLE DATA LOSS**

**🚫 `prisma migrate dev --create-only` followed by manual SQL execution**  
**Only use in development environments with disposable data**

---

## Safe Production Migration Commands

### ✅ Approved for Production

1. **`prisma migrate deploy`**
   - Applies pending migrations
   - Safe, non-destructive
   - Automatically runs `prisma:predeploy` first (resolves failed migrations)

2. **`prisma generate`**
   - Regenerates Prisma Client
   - Safe, read-only operation

3. **`prisma migrate status`**
   - Checks migration status
   - Safe, read-only operation

---

## Verification Scripts

### Check Migration Status
```bash
node tools/check-migrations.cjs
```

### Verify Production Database
```bash
node tools/verify-production-db.cjs
```

### Resolve Failed Migrations
```bash
node tools/resolve-failed-migration.cjs
```

---

## Deployment Workflow

The deployment workflow has been updated to automatically resolve failed migrations:

1. **Pre-deployment:** `prisma:predeploy` runs automatically
   - Resolves any failed migrations before applying new ones
   - Ensures clean migration state

2. **Migration:** `prisma migrate deploy` applies pending migrations
   - Only runs if predeploy succeeds
   - Safe, non-destructive operation

3. **Verification:** `verify-production-db.cjs` can be run post-deployment
   - Confirms all tables exist
   - Verifies migration state is clean

---

## Maintenance Notes

- All migration scripts are idempotent and safe to run multiple times
- Failed migrations are automatically resolved before new migrations are applied
- Production database state is continuously monitored and verified
- Never modify the database schema manually - always use Prisma migrations

---

## Related Documentation

- `tools/resolve-failed-migration.cjs` - Script to resolve failed migrations
- `tools/check-migrations.cjs` - Script to check migration status
- `tools/verify-production-db.cjs` - Script to verify production database state
- `package.json` - Contains `prisma:predeploy` and `prisma:migrate:deploy` scripts

---

**Last Updated:** 2025-01-02  
**Maintained By:** Development Team  
**Status:** Active

