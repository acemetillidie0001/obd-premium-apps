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

## Database Bootstrap Workflow

### Step 1: Verify DATABASE_URL is Set

**In Vercel:**
1. Go to Project → Settings → Environment Variables
2. Verify `DATABASE_URL` is set for **Production** environment
3. Format should be: `postgresql://user:password@host:port/database?sslmode=require`

**Locally (if testing):**
```bash
# Check if DATABASE_URL is in .env.local
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

```bash
# Generate Prisma Client
npx prisma generate

# Deploy migrations (production-safe)
npx prisma migrate deploy

# View database in browser (local only)
npx prisma studio

# Check migration status
npx prisma migrate status

# Reset database (⚠️ DESTRUCTIVE - only for development)
npx prisma migrate reset
```

---

## Files Changed

### 1. `prisma/schema.prisma`
**Change**: Added `url = env("DATABASE_URL")` to datasource block

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // ← Added this line
}
```

**Why**: Prisma needs to know where to connect. This was missing and would cause connection issues.

---

## Next Steps After Bootstrap

1. ✅ Run migrations: `npx prisma migrate deploy && npx prisma generate`
2. ✅ Verify tables exist (use one of the verification methods above)
3. ✅ Test `/api/auth/providers` endpoint
4. ✅ Test `/api/auth/csrf` endpoint
5. ✅ Test magic link login flow
6. ✅ Check Vercel Function Logs for any errors

Once all checks pass, your NextAuth Email provider should work correctly! 🎉

