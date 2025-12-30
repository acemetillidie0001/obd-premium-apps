# Database Bootstrap Guide for NextAuth Email Provider

## What I Checked / What I Found

### ✅ Prisma Configuration
- **package.json**: ✅ `@prisma/client` (^7.1.0) and `prisma` (^7.1.0) are installed
- **schema.prisma**: ✅ Exists at `prisma/schema.prisma`
  - ✅ Contains all required NextAuth models: `User`, `Account`, `Session`, `VerificationToken`
  - ✅ Includes `role` and `isPremium` fields on User
  - ⚠️ **FIXED**: Added missing `url = env("DATABASE_URL")` to datasource block
- **DATABASE_URL**: ✅ Referenced in `src/lib/prisma.ts` and now in `schema.prisma`

### ✅ NextAuth/PrismaAdapter Wiring
- **src/lib/prisma.ts**: ✅ Exists with production-safe singleton pattern
- **src/lib/auth.ts**: ✅ PrismaAdapter is wired correctly:
  - ✅ `getAdapter()` function loads `PrismaAdapter(prisma)`
  - ✅ Adapter is provided to `authConfig.adapter`
  - ✅ Lazy-loaded to avoid Edge Runtime issues

### ✅ Migrations
- **prisma/migrations/**: ✅ Migrations folder exists with:
  - `add_auth_models/migration.sql` - Creates User, Account, Session, VerificationToken tables
  - `add_role_premium/migration.sql` - Adds role and isPremium columns
  - `20251214014402_add_expires_at/migration.sql` - Adds expiresAt to ProReport

---

## Database URL Configuration

### Two Database URLs Required

This project uses **two separate database URL environment variables** for different purposes:

1. **`DATABASE_URL`** - Used by Next.js runtime (application code)
   - May be `prisma+postgres://...` (Prisma Accelerate/Data Proxy) for optimized queries
   - May be direct `postgresql://...` connection string
   - Used for all runtime database operations via Prisma Client
   - Set in `.env.local` or Vercel environment variables
   - **Runtime is completely isolated from CLI tool configuration**

2. **`DATABASE_URL_DIRECT`** - Used by Prisma CLI tools only
   - **MUST be** a direct `postgresql://...` connection string
   - Required for: `prisma migrate`, `prisma studio`, `prisma db`, `prisma generate`
   - Set in `.env` file at repo root
   - **Prisma Studio does NOT support `prisma+postgres://` protocol**
   - Used by `prisma/schema.prisma` datasource configuration

### Why Two URLs?

- **Prisma Accelerate/Data Proxy** (`prisma+postgres://`) optimizes runtime queries with connection pooling and caching
- **Prisma CLI tools** (migrations, studio) require direct PostgreSQL connections and do not support Accelerate protocol
- This separation allows using Accelerate in production for better performance while maintaining full CLI tool compatibility
- Runtime and CLI operations are completely isolated - changes to one do not affect the other

---

## Database Bootstrap Workflow

### Step 1: Verify Environment Variables are Set

**For Prisma CLI Operations (migrations, studio):**
- **`DATABASE_URL_DIRECT`** must be in `.env` file at repo root
- Format: `postgresql://user:password@host:port/database?sslmode=require`
- Example: `postgresql://postgres:password@localhost:5432/mydb?sslmode=require`

**For Next.js Runtime:**
- **`DATABASE_URL`** in `.env.local` or Vercel environment variables
- May be `prisma+postgres://...` (Accelerate) or direct `postgresql://...`
- Example: `prisma+postgres://localhost:51213/?api_key=...` (Accelerate) or direct URL

**Verification:**
```bash
# Check if DATABASE_URL_DIRECT is in .env (for Prisma CLI)
cat .env | grep DATABASE_URL_DIRECT

# Check if DATABASE_URL is in .env.local (for Next.js runtime)
cat .env.local | grep DATABASE_URL
```

---

### Step 2: Run Database Migrations

**Since migrations already exist**, use `prisma migrate deploy`:

```bash
# Generate Prisma Client (ensures types are up to date)
npx prisma generate

# Deploy migrations to production database
npx prisma migrate deploy

# Verify Prisma Client is generated
npx prisma generate
```

**What this does:**
- `prisma migrate deploy` applies all pending migrations to your Railway Postgres database
- This creates the `User`, `Account`, `Session`, and `VerificationToken` tables
- `prisma generate` ensures the Prisma Client types match your schema

**Expected output:**
```
✔ Generated Prisma Client
✔ Applied migration `add_auth_models`
✔ Applied migration `add_role_premium`
✔ Applied migration `20251214014402_add_expires_at`
```

---

### Step 3: Verify Database Tables Exist

**Option A: Using Prisma Studio (local)**
```bash
npx prisma studio
```
- Opens browser at `http://localhost:5555`
- Check that `User`, `Account`, `Session`, `VerificationToken` tables exist
- **Note:** Prisma Studio requires `DATABASE_URL_DIRECT` (direct `postgresql://` connection)

**Option B: Using Railway Dashboard**
1. Go to Railway Dashboard → Your Postgres Service
2. Click "Query" tab
3. Run:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('User', 'Account', 'Session', 'VerificationToken');
```
- Should return 4 rows

**Option C: Using psql (if you have access)**
```bash
psql $DATABASE_URL -c "\dt"
```
- Should list all tables including NextAuth tables

---

## Verification Checklist

After running migrations, verify each step:

### ✅ 1. Test `/api/auth/providers`
```bash
curl https://apps.ocalabusinessdirectory.com/api/auth/providers
```

**Expected response:**
```json
{
  "email": {
    "id": "email",
    "name": "Email",
    "type": "email"
  }
}
```

**If you get "Configuration" error:**
- Check Vercel Function Logs for `[NextAuth]` messages
- Verify `DATABASE_URL` is set in Vercel Production environment
- Verify migrations ran successfully

---

### ✅ 2. Test `/api/auth/csrf`
```bash
curl https://apps.ocalabusinessdirectory.com/api/auth/csrf
```

**Expected response:**
```json
{
  "csrfToken": "abc123..."
}
```

**If you get an error:**
- Same troubleshooting as above

---

### ✅ 3. Test Magic Link Login Flow

1. Go to: `https://apps.ocalabusinessdirectory.com/login`
2. Enter your email address
3. Click "Send Login Link"
4. **Expected behavior:**
   - ✅ No "Configuration" error
   - ✅ Redirects to `/login/verify` page
   - ✅ Email is sent (check your inbox)
   - ✅ Clicking link in email logs you in

**If magic link fails:**
- Check Vercel Function Logs for `[NextAuth Email]` messages
- Verify `RESEND_API_KEY` and `EMAIL_FROM` are set in Vercel
- Check Resend dashboard for email delivery status

---

## Troubleshooting

### Error: "MissingAdapter"
- **Cause**: PrismaAdapter not loading
- **Fix**: Check Vercel logs for `[NextAuth] Failed to load PrismaAdapter`
- **Solution**: Ensure `DATABASE_URL` is set and migrations are applied

### Error: "Configuration"
- **Cause**: Missing tables or invalid adapter
- **Fix**: Run `npx prisma migrate deploy` to create tables
- **Solution**: Verify tables exist using verification steps above

### Error: "relation does not exist"
- **Cause**: Migrations not applied to database
- **Fix**: Run `npx prisma migrate deploy`
- **Solution**: Check Railway database directly to confirm tables exist

---

## Quick Reference Commands

**Note:** All Prisma CLI commands below require `DATABASE_URL_DIRECT` in `.env` file (direct `postgresql://` connection).

```bash
# Generate Prisma Client (uses DATABASE_URL_DIRECT from schema)
npx prisma generate
# Or use package.json script:
pnpm db:generate

# Check migration status (see which migrations are pending)
npx prisma migrate status
# Or use package.json script:
pnpm db:status

# Deploy migrations (production-safe, uses DATABASE_URL_DIRECT)
npx prisma migrate deploy
# Or use package.json script:
pnpm db:deploy

# View database in browser (local only, requires DATABASE_URL_DIRECT)
npx prisma studio
# Or use package.json script:
pnpm db:studio
# Note: Prisma Studio does NOT support prisma+postgres:// protocol

# Reset database (⚠️ DESTRUCTIVE - only for development)
npx prisma migrate reset
```

---

## Migration Safety and Recovery

### When Prisma Studio Shows "No tables found"

This typically means migrations have not been applied to your database.

**Diagnostic Steps:**
1. Check if `DATABASE_URL` is set:
   ```bash
   # Check .env file (for Prisma CLI/Studio)
   cat .env | grep DATABASE_URL
   ```
2. Verify migration status:
   ```bash
   pnpm db:status
   ```
   - If pending migrations are shown, you need to deploy them
   - If error connecting to database, check `DATABASE_URL` is correct

**Recovery Steps:**
1. **Deploy pending migrations:**
   ```bash
   pnpm db:deploy
   ```
   This applies all pending migrations without creating new migration files (production-safe).

2. **Verify tables exist:**
   ```bash
   pnpm db:studio
   ```
   Should now show tables: `User`, `Account`, `Session`, `VerificationToken`, etc.

3. **Check app startup logs:**
   - App startup should log: `[DB Startup] DATABASE_URL present: YES`
   - App startup should log: `[DB Startup] ✓ Database connection successful`
   - App startup should log: `[DB Startup] ✓ Database tables found (migrations appear applied)`

### Common Failure Scenarios and Fixes

#### Scenario 1: DATABASE_URL_DIRECT Missing or Prisma+postgres Protocol Error
**Symptoms:**
- Prisma Studio shows "No tables found" or connection errors
- Error: "The prisma+postgres protocol with localhost is not supported in Prisma Studio yet"
- Migration commands fail with connection errors
- App logs: `[DB Startup] DATABASE_URL_DIRECT present: NO`

**Fix:**
1. **Add `DATABASE_URL_DIRECT` to `.env` file:**
   - Must be a direct `postgresql://` connection string (NOT `prisma+postgres://`)
   - Format: `postgresql://user:password@host:port/database?sslmode=require`
   - Example: `DATABASE_URL_DIRECT=postgresql://postgres:password@localhost:5432/mydb?sslmode=require`
2. **Keep `DATABASE_URL` as-is:**
   - `DATABASE_URL` may remain `prisma+postgres://...` (for Accelerate/Data Proxy)
   - `DATABASE_URL` is used by Next.js runtime, not Prisma CLI
3. **Verify both are set:**
   ```bash
   # Check DATABASE_URL_DIRECT (for Prisma CLI)
   cat .env | grep DATABASE_URL_DIRECT
   
   # Check DATABASE_URL (for runtime)
   cat .env.local | grep DATABASE_URL
   ```

#### Scenario 2: DATABASE_URL Missing for Runtime
**Symptoms:**
- App runtime database operations fail
- App logs: `[DB Startup] DATABASE_URL present: NO`
- API endpoints return database errors

**Fix:**
1. Ensure `DATABASE_URL` is in `.env.local` (for Next.js runtime)
2. For production, ensure `DATABASE_URL` is set in Vercel environment variables
3. Format: May be `prisma+postgres://...` (Accelerate) or direct `postgresql://...`

#### Scenario 3: Migrations Not Applied
**Symptoms:**
- Prisma Studio shows "No tables found"
- App logs: `[DB Startup] ⚠️  User table not found. Migrations may not be applied.`
- `pnpm db:status` shows pending migrations

**Fix:**
```bash
pnpm db:deploy
```
This applies all pending migrations to the database.

#### Scenario 4: Wrong Database
**Symptoms:**
- Prisma Studio connects but shows wrong tables or no tables
- App connects to different database than expected

**Fix:**
1. Verify `DATABASE_URL` points to the correct database
2. Check environment variables are loaded correctly
3. For production, verify Vercel environment variables are set for the correct environment (Production vs Preview)

#### Scenario 5: Database Server Unreachable
**Symptoms:**
- Connection timeout errors
- `[DB Startup] ⚠️  Database check failed: ECONNREFUSED`
- Migration commands fail to connect

**Fix:**
1. Verify database server is running
2. Check network connectivity
3. Verify `DATABASE_URL` host and port are correct
4. Check firewall rules if applicable

#### Scenario 6: Authentication Failed
**Symptoms:**
- `[DB Startup] ⚠️  Database check failed: authentication failed`
- Migration commands fail with authentication errors

**Fix:**
1. Verify `DATABASE_URL` credentials (username/password) are correct
2. Check if database user has necessary permissions
3. For production, verify Vercel environment variables are set correctly

---

## Files Changed

### 1. `prisma/schema.prisma`
**Change**: Removed `url` from datasource block (Prisma 7.2.0 requirement when using `prisma.config.ts`)

```prisma
datasource db {
  provider = "postgresql"
  // Note: URL is configured in prisma.config.ts, not here (Prisma 7.2.0 requirement)
}
```

**Why**: Prisma 7.2.0 requires datasource URLs to be configured in `prisma.config.ts` when that file exists, not in `schema.prisma`. The URL (`DATABASE_URL_DIRECT`) is configured in `prisma.config.ts` for CLI operations, while `DATABASE_URL` (which may be `prisma+postgres://` for Accelerate) is used by the Next.js runtime.

---

## Next Steps After Bootstrap

1. ✅ Run migrations: `npx prisma migrate deploy && npx prisma generate`
2. ✅ Verify tables exist (use one of the verification methods above)
3. ✅ Test `/api/auth/providers` endpoint
4. ✅ Test `/api/auth/csrf` endpoint
5. ✅ Test magic link login flow
6. ✅ Check Vercel Function Logs for any errors

Once all checks pass, your NextAuth Email provider should work correctly! 🎉

