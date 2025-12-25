# Manual Database Migrations Guide

This guide covers the manual migration workflow for OBD Premium Apps database schema changes.

## Overview

OBD Premium Apps uses Prisma with PostgreSQL (Railway) for database persistence. Migrations are handled manually (no auto-migrations) to ensure controlled, reviewable schema changes.

## Migration Workflow

### 1. Generate Migration (Local Development)

After making changes to `prisma/schema.prisma`, generate a migration:

```bash
npx prisma migrate dev --name <migration-name>
```

**Example:**
```bash
npx prisma migrate dev --name add_review_request_automation_tables
```

This will:
- Create a new migration file in `prisma/migrations/`
- Apply the migration to your local database
- Regenerate Prisma Client

**Migration Name Convention:**
- Use descriptive, kebab-case names
- Examples: `add_review_request_automation_tables`, `add_brand_profile_index`, `update_user_role_type`

### 2. Review Migration SQL

Before deploying, review the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`:

- Check for any destructive operations (DROP, DELETE)
- Verify index creation/deletion
- Ensure foreign key constraints are correct
- Validate data type changes

### 3. Deploy to Production

Once reviewed and tested locally, deploy to production:

```bash
npx prisma migrate deploy
```

**Note:** This uses the `DATABASE_URL` from your environment variables, which should point to your production database.

**Vercel/Production Deployment:**
- Migrations should be run as part of the deployment process
- Add to `package.json` scripts: `"migrate:deploy": "prisma migrate deploy && prisma generate"`
- Ensure `DATABASE_URL` is set in production environment variables

### 4. Verify Migration

After deployment, verify the migration:

```bash
npx prisma migrate status
```

This shows:
- Applied migrations
- Pending migrations
- Database state

## Example: Review Request Automation Tables

### Step 1: Update Schema

Edit `prisma/schema.prisma` to add new models (e.g., `ReviewRequestCampaign`, `ReviewRequestCustomer`, etc.).

### Step 2: Generate Migration

```bash
npx prisma migrate dev --name add_review_request_automation_tables
```

**Expected Output:**
```
✔ Migration created: prisma/migrations/20240115123456_add_review_request_automation_tables
✔ Applied migration `20240115123456_add_review_request_automation_tables` to database
```

### Step 3: Review Generated SQL

Check `prisma/migrations/20240115123456_add_review_request_automation_tables/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "ReviewRequestCampaign" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  ...
  CONSTRAINT "ReviewRequestCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewRequestCampaign_userId_idx" ON "ReviewRequestCampaign"("userId");

-- AddForeignKey
ALTER TABLE "ReviewRequestCampaign" ADD CONSTRAINT "ReviewRequestCampaign_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Step 4: Deploy

```bash
npx prisma migrate deploy
```

### Step 5: Verify

```bash
npx prisma migrate status
```

**Expected Output:**
```
Database schema is up to date!

Following migrations have been applied:

migrations/
  ...
  20240115123456_add_review_request_automation_tables
```

## Checklist

Before running migrations in production:

- [ ] Review generated SQL migration file
- [ ] Test migration locally on a copy of production data (if possible)
- [ ] Ensure database backup is taken (if production)
- [ ] Verify `DATABASE_URL` environment variable is correct
- [ ] Run `prisma migrate deploy` (not `prisma migrate dev`)
- [ ] Verify migration status after deployment
- [ ] Test application functionality with new schema

## Enum Migrations

When migrating string columns to enum types (e.g., converting `channel` from `String` to `ReviewRequestChannel` enum):

**Prisma automatically handles:**
- Creating the enum type in PostgreSQL
- Converting existing string values to enum values
- Mapping common string variations (e.g., "sms" → `SMS`, "email" → `EMAIL`)

**Important Considerations:**
- Review the generated migration SQL to ensure string-to-enum mapping is correct
- If you have unexpected string values, Prisma will attempt to map them; review the mapping in the migration file
- Consider running a test migration on a database copy if you have production data

**Example Enum Migration:**
```sql
-- Prisma will generate something like:
CREATE TYPE "ReviewRequestChannel" AS ENUM ('EMAIL', 'SMS');
ALTER TABLE "ReviewRequestQueueItem" 
  ALTER COLUMN "channel" TYPE "ReviewRequestChannel" 
  USING "channel"::text::"ReviewRequestChannel";
```

If you need custom mapping logic, edit the migration SQL before running `prisma migrate deploy`.

## Troubleshooting

### Migration Fails

If migration fails:

1. **Check Error Message**: Look for specific SQL errors
2. **Check Constraints**: Ensure no conflicting constraints (unique, foreign keys)
3. **Check Data Types**: Verify column types match existing data
4. **Manual Fix**: If needed, manually edit migration SQL (then mark as applied)

### Rollback

Prisma doesn't support automatic rollbacks. To rollback:

1. Create a new migration that reverses the changes
2. Or manually edit the database to undo changes
3. Remove the migration files from `prisma/migrations/` if not yet deployed

### Migration Already Applied

If migration shows as already applied but schema doesn't match:

1. Check `_prisma_migrations` table in database
2. Manually fix schema or create a new migration
3. Use `prisma migrate resolve --applied <migration-name>` to mark as applied

## Best Practices

1. **Always Review SQL**: Never deploy without reviewing generated SQL
2. **Test Locally First**: Test migrations on local/dev databases before production
3. **One Migration Per Change**: Create separate migrations for logically separate changes
4. **Descriptive Names**: Use clear, descriptive migration names
5. **Backup First**: Always backup production database before major migrations
6. **Index After Data**: For large tables, consider creating indexes after data insertion

## Related Documentation

- [Prisma Migrate Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Schema Reference](prisma/schema.prisma)
- [Deployment Checklist](../DEPLOY_CHECKLIST.md)

