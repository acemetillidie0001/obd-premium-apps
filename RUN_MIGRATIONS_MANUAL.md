# Running Prisma Migrations Manually

If you prefer to run migrations manually (recommended for production), follow these steps:

## Step 1: Get Production DATABASE_URL

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project: **cursor-app-build**
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL` in the **Production** environment
5. Copy the value (it should look like: `postgresql://user:pass@host:port/db?sslmode=require`)

## Step 2: Set DATABASE_URL Locally

### Windows PowerShell:
```powershell
$env:DATABASE_URL="your-production-database-url-here"
```

### Windows Command Prompt:
```cmd
set DATABASE_URL=your-production-database-url-here
```

### Linux/Mac:
```bash
export DATABASE_URL="your-production-database-url-here"
```

## Step 3: Run Migrations

```bash
npm run migrate:deploy
```

This will:
- ✅ Validate DATABASE_URL format
- ✅ Apply pending migrations to production
- ✅ Regenerate Prisma Client

## Step 4: Verify Migrations

```bash
npx prisma migrate status
```

Expected output:
```
Database schema is up to date!

Following migrations have been applied:
  migrations/
    add_auth_models
    add_brand_profile
    add_role_premium
    20251214014402_add_expires_at
```

## Alternative: Run Directly

If you prefer to skip validation:

```bash
npx prisma migrate deploy
```

## ⚠️ Important Notes

- **Never commit DATABASE_URL** to version control
- **Always verify** you're pointing to production (not local/dev)
- **Backup database** before running migrations in production (if possible)
- Migrations are **idempotent** - safe to run multiple times

## Troubleshooting

### Error: "Can't reach database server"
- Verify DATABASE_URL is correct
- Check if database allows connections from your IP
- Ensure SSL mode is correct (`?sslmode=require`)

### Error: "Migration already applied"
- This is normal if migrations were already run
- Run `npx prisma migrate status` to verify current state

### Error: "DATABASE_URL not set"
- Ensure you set the environment variable in your current terminal session
- Verify the variable name is exactly `DATABASE_URL` (case-sensitive)

