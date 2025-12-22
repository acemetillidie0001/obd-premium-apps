# Fix Deployment - Step by Step Guide

## ✅ Current Situation

- **Code is fine** - Some deployments are "Ready" ✅
- **Issue:** Database migration not applied OR env vars not injected
- **Solution:** Run migration + clean redeploy

---

## 🎯 Step-by-Step Fix

### Step 1: Check the Error (Optional but Helpful)

1. In Vercel, click the **most recent failed deployment** (red ❌)
2. Go to **Logs** → **Runtime Logs**
3. Look for one of these:
   - `column "role" does not exist`
   - `column "isPremium" does not exist`
   - `Missing required environment variables`
   - `PrismaClientKnownRequestError`

**This confirms what we're fixing.**

---

### Step 2: Run Database Migration

You have **3 options**. Choose the one that works for you:

#### Option A: Add Migration to Build Command (REQUIRED)

**⚠️ CRITICAL: This MUST be set to prevent schema mismatch crashes.**

**This runs migration automatically on every deploy:**

1. Go to Vercel: **Project → Settings → Build & Development Settings**
2. Find **"Build Command"**
3. **Set it to** (replace whatever is there):
   ```
   npm run migrate:deploy && npm run build
   ```
4. Click **Save**

**Why?** Without this, your app will crash when it tries to access `User.role` or `User.isPremium` columns that don't exist yet. See `docs/PRISMA_MIGRATION_SAFETY.md` for details.

**Then redeploy** (see Step 3)

---

#### Option B: Run Migration via Vercel CLI

**If you have Vercel CLI installed:**

```bash
# Make sure you're in the project directory
cd "C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build"

# Pull environment variables
vercel env pull .env.local

# Run migration
npm run migrate:deploy

# Deploy
vercel --prod
```

---

#### Option C: Run Migration Manually (If you have direct DB access)

**If you can connect directly to your PostgreSQL database:**

1. Connect to your database (via psql, pgAdmin, or your database provider's console)
2. Run this SQL:

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN NOT NULL DEFAULT false;
```

3. Then redeploy (see Step 3)

---

### Step 3: Clean Redeploy

**Important:** Redeploy the **latest successful deployment**, not a failed one.

1. Go to Vercel **Deployments** tab
2. Find the **most recent "Ready" ✅ deployment** (green dot)
   - Look for `GezWT6hCu` or `5F7WL7qjy` if they're recent
3. Click the **⋯** (three dots) menu on that deployment
4. Click **Redeploy**
5. Select **"Use existing Build Cache"** = **OFF** (to force fresh build)
6. Click **Redeploy**

**Wait for it to complete** (usually 1-2 minutes)

---

### Step 4: Verify Success

After redeploy completes:

1. **Check deployment status:**
   - Should show **"Ready" ✅** (green)
   - Should NOT show "Error" ❌

2. **Test the app:**
   - Visit: `https://apps.ocalabusinessdirectory.com/login`
   - Should load without errors
   - Try entering an email (magic link should send)

3. **Check logs (if needed):**
   - Go to deployment → **Logs**
   - Should NOT see database errors
   - Should NOT see "Missing environment variables"

---

## 🎯 Recommended Approach

**I recommend Option A** (add migration to build command) because:
- ✅ Runs automatically on every deploy
- ✅ No manual steps needed
- ✅ Prevents this issue in the future

**Steps:**
1. Add `npm run migrate:deploy &&` to build command
2. Redeploy latest successful deployment
3. Done!

---

## ❓ What If It Still Fails?

If redeploy still fails after migration:

1. **Check the error message** in deployment logs
2. **Verify environment variables:**
   - Go to **Project → Settings → Environment Variables**
   - Ensure all are set for **Production**
   - Ensure variable names are **exact** (case-sensitive)

3. **Run diagnostic locally:**
   ```bash
   npm run check:deploy
   ```
   (Requires `.env.local` with your production values)

4. **Share the error message** and we'll fix it

---

## ✅ Success Checklist

After completing steps:

- [ ] Migration added to build command (Option A) OR migration run manually
- [ ] Latest successful deployment redeployed
- [ ] New deployment shows "Ready" ✅
- [ ] `/login` page loads without errors
- [ ] No database errors in logs

---

**You're almost there!** The code is fine - we just need to sync the database and redeploy. 🚀

