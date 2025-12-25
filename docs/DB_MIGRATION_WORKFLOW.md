# Database Migration Workflow

This guide covers the safe workflow for applying Prisma migrations to Railway Postgres databases.

## Railway Workflow (Production/Hosted DB)

**Always use `npm run db:deploy` (or `npx prisma migrate deploy`) when targeting Railway.**

- `migrate deploy` is safe for production databases
- It applies pending migrations without creating new ones
- It does NOT modify your schema file
- It does NOT generate a new migration

### Steps:

1. **Ensure DATABASE_URL is set:**
   ```powershell
   # PowerShell
   $env:DATABASE_URL="postgresql://user:pass@host:port/db?schema=public"
   
   # Or set in .env file (persists across sessions)
   DATABASE_URL="postgresql://user:pass@host:port/db?schema=public"
   ```

2. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```

3. **Deploy migrations:**
   ```bash
   npm run db:deploy
   ```

4. **Verify status:**
   ```bash
   npm run db:status
   ```

## Local Workflow (Development Only)

**Only use `prisma migrate dev` if you have a local Postgres instance.**

- `migrate dev` creates new migrations AND applies them
- It modifies your schema file and creates migration files
- **DO NOT use this with Railway/hosted databases**

If you need to create a new migration for Railway:

1. Create the migration file manually or use `migrate dev --create-only` (doesn't apply)
2. Then use `npm run db:deploy` to apply it

## Troubleshooting

### P1001: Can't reach database server (localhost errors)

**Cause:** DATABASE_URL is not set or points to localhost.

**Fix:**
1. Check DATABASE_URL: `echo $env:DATABASE_URL` (PowerShell) or `echo $DATABASE_URL` (bash)
2. Verify it points to Railway host (e.g., `tramway.proxy.rlwy.net`), NOT `localhost`
3. Set it in your session or `.env` file

### P3018: Migration failed / encoding errors

**Cause:** Migration SQL file has encoding issues (common with PowerShell redirection).

**Symptoms:**
- "string contains embedded null"
- "error encoding message to server"

**Fix:**

1. **Ensure migration.sql is UTF-8:**
   - Use the `write` tool or a text editor that saves as UTF-8
   - Avoid PowerShell redirection (`>`) which can introduce BOM/encoding issues

2. **Manual application fallback:**
   ```bash
   # Apply SQL directly
   npx prisma db execute --file prisma/migrations/<migration_id>/migration.sql
   
   # Mark as applied
   npx prisma migrate resolve --applied <migration_name>
   ```

3. **Verify migration:**
   ```bash
   npm run db:status
   ```

### Migration marked as applied but not actually applied

**Fix:**
```bash
# Mark as rolled back
npx prisma migrate resolve --rolled-back <migration_name>

# Apply manually
npx prisma db execute --file prisma/migrations/<migration_id>/migration.sql

# Mark as applied
npx prisma migrate resolve --applied <migration_name>
```

## Available Scripts

- `npm run db:generate` - Generate Prisma Client
- `npm run db:deploy` - Deploy pending migrations (Railway-safe)
- `npm run db:status` - Check migration status
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:exec` - Execute SQL file (requires `--file` argument)

## Best Practices

1. **Always verify DATABASE_URL** before running migrations
2. **Use `db:deploy` for Railway**, never `migrate dev`
3. **Check migration status** after deployment
4. **Test migrations** in a staging environment first if possible
5. **Keep migration files** in version control
6. **Document breaking changes** in migration notes

## Security Note

If database credentials are exposed in chat/terminal history:
1. Rotate the database password immediately
2. Update Vercel environment variables
3. Update local `.env` file
4. Never commit `.env` files to git

