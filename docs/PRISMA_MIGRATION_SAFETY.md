# Prisma Migration Safety Guide

## ⚠️ CRITICAL: Migrations Must Run Before Build

**This is a production safety requirement.** Failure to follow this will cause deployment crashes.

---

## 🎯 Why Migrations Must Run Before Build

### The Problem

When you deploy code that expects database columns that don't exist yet:

1. **Build succeeds** ✅ (TypeScript compiles fine)
2. **Deployment starts** ✅ (Vercel builds the app)
3. **First request hits the app** ❌ **CRASH**
   - Error: `column "role" does not exist`
   - Error: `column "isPremium" does not exist`
   - Error: `PrismaClientKnownRequestError`

### The Solution

**Run migrations BEFORE building the app.**

This ensures:
- ✅ Database schema matches code expectations
- ✅ No runtime crashes from missing columns
- ✅ Smooth deployments every time

---

## 📋 Required Vercel Build Command

**You MUST set this in Vercel:**

```
npm run migrate:deploy && npm run build
```

**NOT just:**
```
npm run build
```

### Where to Set This

1. Go to **Vercel Dashboard**
2. Select your project: `obd-premium-apps`
3. Go to **Settings → Build & Development Settings**
4. Find **"Build Command"**
5. Set it to: `npm run migrate:deploy && npm run build`
6. Click **Save**

---

## 🔍 What `migrate:deploy` Does

The `migrate:deploy` script (defined in `package.json`) runs:

```bash
prisma migrate deploy && prisma generate
```

This:
1. **Applies pending migrations** to your production database
   - Adds missing columns (`role`, `isPremium`)
   - Updates schema to match `prisma/schema.prisma`
2. **Regenerates Prisma Client**
   - Updates TypeScript types
   - Ensures code can access new fields

---

## ✅ Verification Checklist

Before deploying, verify:

- [ ] `package.json` contains: `"migrate:deploy": "prisma migrate deploy && prisma generate"`
- [ ] `package.json` contains: `"build": "next build"`
- [ ] Vercel Build Command is: `npm run migrate:deploy && npm run build`
- [ ] `prisma/schema.prisma` has `User.role` and `User.isPremium` fields
- [ ] Migration file exists: `prisma/migrations/add_role_premium/migration.sql`

---

## 🚨 What Happens If You Skip This

### Scenario: Build Command is Just `npm run build`

1. **Build completes** ✅
2. **Deployment succeeds** ✅
3. **User visits `/login`** ❌
4. **App tries to query `User.role`** ❌
5. **Database error:** `column "role" does not exist`
6. **Deployment shows "Error"** ❌
7. **App is broken** ❌

### Scenario: Build Command is `npm run migrate:deploy && npm run build`

1. **Migration runs** ✅ (adds `role` and `isPremium` columns)
2. **Build completes** ✅
3. **Deployment succeeds** ✅
4. **User visits `/login`** ✅
5. **App queries `User.role`** ✅ (column exists!)
6. **Everything works** ✅

---

## 📝 Current Schema Requirements

Your `prisma/schema.prisma` must include:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  role          String    @default("user") // ✅ REQUIRED
  isPremium     Boolean   @default(false) // ✅ REQUIRED
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  accounts      Account[]
  sessions      Session[]

  @@index([email])
}
```

**These fields are used by:**
- `src/lib/auth.ts` - JWT callbacks
- `src/lib/premium.ts` - Premium access checks
- `src/middleware.ts` - Route protection
- All authentication flows

---

## 🔧 Troubleshooting

### Error: "Migration already applied"

**This is fine!** It means the migration ran successfully. The `&&` operator ensures the build continues.

### Error: "Can't reach database server"

**Check:**
- `DATABASE_URL` is set in Vercel environment variables
- Database is running and accessible
- Database firewall allows Vercel IPs

### Error: "No migrations found"

**Check:**
- Migration file exists: `prisma/migrations/add_role_premium/migration.sql`
- Migration file is committed to git
- Vercel can access the migration file

---

## ✅ Quick Verification

After setting the build command, verify it works:

1. **Make a small code change** (add a comment)
2. **Commit and push** to trigger deployment
3. **Watch the build logs** in Vercel
4. **Look for:**
   ```
   Running: npm run migrate:deploy
   Applying migration...
   Prisma Client generated
   Running: npm run build
   ```

If you see both commands, you're good! ✅

---

## 📚 Related Documentation

- `docs/FIX_DEPLOYMENT_NOW.md` - Step-by-step fix guide
- `docs/VERCEL_ENV_SETUP.md` - Environment variables setup
- `docs/DEPLOYMENT_TROUBLESHOOTING.md` - General troubleshooting

---

## 🎯 Summary

**Always run migrations before building.**

**Vercel Build Command MUST be:**
```
npm run migrate:deploy && npm run build
```

**This prevents schema mismatch crashes and ensures smooth deployments.**

---

**Last Updated:** December 2024

