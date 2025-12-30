# Database Bootstrap Guide

## Overview

This guide ensures Prisma and Next.js use the same `DATABASE_URL` and that database migrations are properly applied.

---

## Environment Variable Setup

### Single Source of Truth

**Prisma CLI** and **Next.js runtime** now both read from:
1. `.env` (loaded first, lower priority)
2. `.env.local` (loaded second, overrides `.env` - Next.js convention)

**Priority:** `.env.local` > `.env`

### Setup Steps

1. **Check if DATABASE_URL exists:**
   ```powershell
   # Check .env.local (Next.js reads this)
   Select-String -Path .env.local -Pattern "DATABASE_URL"
   
   # Check .env (Prisma CLI reads this)
   Select-String -Path .env -Pattern "DATABASE_URL"
   ```

2. **If DATABASE_URL only exists in .env.local:**
   ```powershell
   # Copy to .env so Prisma CLI can find it
   $dbUrl = (Get-Content .env.local | Select-String "DATABASE_URL").Line
   Add-Content -Path .env -Value $dbUrl
   ```

3. **Verify both files have DATABASE_URL:**
   ```powershell
   # Should show DATABASE_URL in both
   Select-String -Path .env.local,.env -Pattern "DATABASE_URL"
   ```

---

## Startup Checks

The app now performs automatic startup checks (non-blocking):

1. **DATABASE_URL Check:**
   - Logs: `[DB Startup] DATABASE_URL present: YES/NO`
   - Never logs the actual value (security)

2. **Migration Status Check:**
   - Verifies database connection
   - Checks if `User` table exists (indicates migrations applied)
   - Logs warnings if issues found

**View startup logs:**
- Local: Check terminal where `pnpm dev` is running
- Production: Vercel Function Logs

---

## Database Migrations

### Deploy Migrations (Production-Safe)

```powershell
# Generate Prisma Client
pnpm db:generate

# Deploy migrations (applies pending migrations)
pnpm db:deploy

# Check migration status
pnpm db:status
```

### What These Commands Do

- **`pnpm db:generate`**: Generates Prisma Client types from schema
- **`pnpm db:deploy`**: Applies all pending migrations to database
- **`pnpm db:status`**: Shows which migrations are applied/pending

---

## Prisma Studio

### Running Prisma Studio

```powershell
pnpm db:studio
```

**Important Notes:**
- Prisma Studio reads `.env` by default (not `.env.local`)
- If Prisma Studio shows "No tables found":
  1. Verify `DATABASE_URL` is in `.env` (not just `.env.local`)
  2. Run `pnpm db:deploy` to apply migrations
  3. Check startup logs for migration warnings

### Troubleshooting "No Tables Found"

**Cause 1: Wrong DATABASE_URL**
- Prisma Studio is reading a different database than Next.js
- **Fix:** Ensure `DATABASE_URL` is in both `.env` and `.env.local` with the same value

**Cause 2: Migrations Not Applied**
- Database exists but tables don't
- **Fix:** Run `pnpm db:deploy`

**Cause 3: Database Unreachable**
- Network/firewall issue
- **Fix:** Verify `DATABASE_URL` is correct, check Railway dashboard

---

## Verification Steps

### 1. Verify DATABASE_URL is Set

**Local:**
```powershell
# Should show DATABASE_URL in both files
Select-String -Path .env.local,.env -Pattern "DATABASE_URL"
```

**Production (Vercel):**
1. Go to: Vercel Dashboard → Project → Settings → Environment Variables
2. Verify `DATABASE_URL` is set for Production environment

### 2. Verify Migrations Are Applied

```powershell
pnpm db:status
```

**Expected output:**
```
Database schema is up to date!
```

**If migrations are pending:**
```
The following migrations have not yet been applied:
  - 20250101000000_migration_name
```

**Fix:** Run `pnpm db:deploy`

### 3. Verify Prisma Studio Shows Tables

```powershell
pnpm db:studio
```

**Expected:**
- Browser opens at `http://localhost:5555`
- Tables listed: `User`, `Account`, `Session`, `SocialQueueItem`, etc.

**If "No tables found":**
- Check startup logs for warnings
- Verify `DATABASE_URL` in `.env`
- Run `pnpm db:deploy`

### 4. Verify App Connects to Database

**Check startup logs:**
```
[DB Startup] DATABASE_URL present: YES
[DB Startup] ✓ Database connection successful
[DB Startup] ✓ Database tables found (migrations appear applied)
```

**If you see warnings:**
- Follow the suggested fixes in the log messages

---

## Common Issues

### Issue: Prisma Studio shows "No tables found"

**Symptoms:**
- Prisma Studio opens but shows no tables
- App works fine (Next.js uses `.env.local`)

**Root Cause:**
- Prisma Studio reads `.env` (not `.env.local`)
- `DATABASE_URL` only exists in `.env.local`

**Fix:**
1. Copy `DATABASE_URL` from `.env.local` to `.env`
2. Restart Prisma Studio: `pnpm db:studio`

### Issue: "relation does not exist"

**Symptoms:**
- App errors: "relation 'User' does not exist"
- Prisma Studio shows no tables

**Root Cause:**
- Migrations not applied to database

**Fix:**
```powershell
pnpm db:deploy
```

### Issue: Premium users treated as non-premium

**Symptoms:**
- Logged-in users see "Upgrade to Premium" CTA
- Database is temporarily unavailable

**Root Cause:**
- Premium check fails when DB is unavailable
- App treats failure as "not premium"

**Fix:**
- App now handles DB failures gracefully (see `src/lib/premium.ts`)
- Shows "Unable to verify subscription" instead of upgrade CTA
- Check startup logs for DB connection issues

### Issue: Startup logs show migration warnings

**Symptoms:**
```
[DB Startup] ⚠️  User table not found. Migrations may not be applied.
```

**Fix:**
```powershell
pnpm db:deploy
```

---

## Quick Reference Commands

```powershell
# Generate Prisma Client
pnpm db:generate

# Deploy migrations (production-safe)
pnpm db:deploy

# Check migration status
pnpm db:status

# Open Prisma Studio
pnpm db:studio

# Verify database connection (custom script)
pnpm verify:db
```

---

## Production Deployment

### Before Deploying

1. **Verify DATABASE_URL in Vercel:**
   - Vercel Dashboard → Settings → Environment Variables
   - Ensure `DATABASE_URL` is set for Production

2. **Run migrations:**
   ```powershell
   # This applies migrations to production database
   pnpm db:deploy
   ```

3. **Check startup logs after deploy:**
   - Vercel Dashboard → Deployments → [Latest] → Functions → View Logs
   - Look for `[DB Startup]` messages

### After Deploying

1. **Verify health endpoint:**
   ```powershell
   curl https://apps.ocalabusinessdirectory.com/api/health
   ```

2. **Check function logs:**
   - Look for `[DB Startup]` messages
   - Verify no migration warnings

---

## Files Changed

### 1. `prisma.config.ts`
- Now loads from both `.env` and `.env.local`
- Priority: `.env.local` > `.env`

### 2. `src/lib/dbStartupCheck.ts` (NEW)
- Performs startup checks (non-blocking)
- Logs DATABASE_URL presence (YES/NO, never the value)
- Checks migration status

### 3. `src/lib/premium.ts`
- Added `hasPremiumAccessSafe()` function
- Handles DB failures gracefully
- Differentiates "not premium" vs "unable to verify"

### 4. `src/lib/prisma.ts`
- Imports `dbStartupCheck` to run checks on server boot

---

## Security Notes

- **Never log DATABASE_URL value** - only log YES/NO
- **Never commit `.env` or `.env.local`** - these contain secrets
- **Use Vercel environment variables** for production secrets

---

## Next Steps

1. ✅ Verify `DATABASE_URL` is in both `.env` and `.env.local`
2. ✅ Run `pnpm db:deploy` to apply migrations
3. ✅ Verify Prisma Studio shows tables
4. ✅ Check startup logs for warnings
5. ✅ Test app functionality (login, premium features)

---

## Support

If issues persist:
1. Check startup logs for specific error messages
2. Verify `DATABASE_URL` format is correct
3. Check Railway dashboard for database status
4. Review Vercel Function Logs for runtime errors

