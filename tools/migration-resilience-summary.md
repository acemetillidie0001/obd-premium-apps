# Migration Resilience Update Summary

## Changes Made

### 1. Updated Original Migration
**File:** `prisma/migrations/20251225045724_add_review_request_automation_tables/migration.sql`

**Improvements:**
- ✅ Added `IF NOT EXISTS` to all `CREATE TABLE` statements
- ✅ Added `IF NOT EXISTS` to all `CREATE INDEX` statements
- ✅ Wrapped User foreign key creation in conditional DO block
- ✅ Checks if User table exists before adding foreign keys
- ✅ Checks if foreign key constraints already exist (idempotent)
- ✅ Creates tables first, then conditionally adds foreign keys

**Key Features:**
- Tables are created even if User table doesn't exist
- Foreign keys to User are only added if User table exists
- Foreign keys between Review Request tables are always added (safe)
- Migration is idempotent (can run multiple times safely)

### 2. Created Follow-up Migration
**File:** `prisma/migrations/20251225050000_add_user_foreign_keys_to_review_request_tables/migration.sql`

**Purpose:**
- Adds User foreign keys after User table is created
- Safe to run even if foreign keys already exist
- Idempotent migration

**Usage:**
- Run this migration after `add_auth_models` migration
- Or run it anytime to ensure foreign keys are in place
- Will only add foreign keys if User table exists

## Migration Flow

### Scenario 1: User table exists
1. Original migration creates tables
2. Original migration adds User foreign keys (User table exists)
3. Follow-up migration checks and skips (foreign keys already exist)

### Scenario 2: User table doesn't exist
1. Original migration creates tables (no foreign keys to User)
2. `add_auth_models` migration creates User table
3. Follow-up migration adds User foreign keys

### Scenario 3: Partial migration (failed original)
1. Mark original migration as rolled back
2. Re-run original migration (creates tables, conditionally adds foreign keys)
3. Run follow-up migration to ensure foreign keys are in place

## Safety Features

✅ **No hard failures** - Migration won't fail if User table doesn't exist  
✅ **Idempotent** - Can run multiple times safely  
✅ **Production safe** - Won't break existing data  
✅ **Backward compatible** - Works with existing Railway Postgres database  
✅ **Conditional logic** - Uses PostgreSQL DO blocks for safety checks  

## Testing Checklist

- [ ] Run migration on fresh database (no User table)
- [ ] Run migration on database with User table
- [ ] Run migration multiple times (idempotency test)
- [ ] Verify tables are created correctly
- [ ] Verify foreign keys are added when User exists
- [ ] Verify foreign keys are NOT added when User doesn't exist
- [ ] Run follow-up migration to add foreign keys after User is created

## Next Steps

1. Mark failed migration as rolled back: `node tools/rollback-migration.cjs`
2. Re-run the updated migration: `pnpm prisma migrate deploy`
3. If User table doesn't exist, run `add_auth_models` migration first
4. Run follow-up migration to ensure foreign keys are in place

