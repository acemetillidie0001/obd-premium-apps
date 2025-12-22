# How to Diagnose Your Deployment Error

Since you've already set environment variables and redeployed, let's find the exact error.

## Step 1: Get the Exact Error Message

1. **Go to Vercel Dashboard**
   - Navigate to your project: `obd-premium-apps`
   - Click on the **Deployments** tab

2. **Open the Failed Deployment**
   - Click on the most recent failed deployment (the one with red "Error" status)
   - Look for deployment ID like `Cs95BQWou`

3. **View the Logs**
   - Click on the deployment
   - Look for tabs: **"Logs"**, **"Function Logs"**, or **"Build Logs"**
   - Click on **"Function Logs"** (runtime errors) or **"Build Logs"** (build-time errors)

4. **Find the Error**
   - Scroll through the logs
   - Look for red text or error messages
   - Common patterns:
     - `Error: ❌ Missing required environment variables`
     - `Error: Can't reach database server`
     - `Error: Prisma Client not generated`
     - `TypeError: Cannot read property...`
     - `Module not found`

## Step 2: Run Local Diagnostic

Run this command locally (with your `.env.local` set up):

```bash
npm run check:deploy
```

This will check:
- ✅ Environment variables are set
- ✅ Database connection works
- ✅ Database schema has required fields
- ✅ NEXTAUTH_SECRET is valid length
- ✅ NEXTAUTH_URL is valid format

## Step 3: Common Errors & Fixes

### Error: "Missing required environment variables"

**Even though you set them, check:**
1. Variables are set for **Production** environment (not just Preview/Development)
2. You **redeployed** after setting variables
3. Variable names are **exact** (case-sensitive):
   - `NEXTAUTH_SECRET` (not `AUTH_SECRET`)
   - `NEXTAUTH_URL` (not `AUTH_URL`)
   - `RESEND_API_KEY` (not `RESEND_KEY`)

**Fix:**
- Go to **Project → Settings → Environment Variables**
- Verify each variable shows "Production" in the environment column
- If missing, add it and redeploy

---

### Error: "Can't reach database server" or "P1001"

**Cause:** Database connection issue

**Check:**
1. `DATABASE_URL` is correct format:
   ```
   postgresql://user:password@host:port/database?schema=public
   ```
2. Database is running and accessible
3. Database firewall allows Vercel IPs (if using managed database)

**Fix:**
- Verify `DATABASE_URL` in Vercel matches your database
- Test connection locally: `npx prisma db pull`
- Check database provider allows external connections

---

### Error: "Unknown column 'role'" or "column 'isPremium' does not exist"

**Cause:** Database migration not run

**Fix:**
1. **Option A: Add to Build Command**
   - Go to **Project → Settings → Build & Development Settings**
   - Set **Build Command** to:
     ```bash
     npm run migrate:deploy && npm run build
     ```
   - Redeploy

2. **Option B: Run Migration Manually**
   ```bash
   # Via Vercel CLI
   vercel env pull .env.local
   npm run migrate:deploy
   ```

3. **Option C: Run via Database Provider**
   - If you have direct database access
   - Run the SQL from `prisma/migrations/add_role_premium/migration.sql`

---

### Error: "Prisma Client not generated" or "Cannot find module '@prisma/client'"

**Cause:** Prisma Client not generated during build

**Check:**
- `package.json` has: `"postinstall": "prisma generate"`
- Build logs show Prisma generating

**Fix:**
- Ensure `postinstall` script exists in `package.json`
- Check build logs for Prisma errors
- Try: `npm install` locally to verify it works

---

### Error: "TypeError" or "Cannot read property"

**Cause:** Runtime code error

**Check:**
- Look at the full stack trace in logs
- See which file/line is failing
- Check if it's related to:
  - Environment variable access
  - Database query
  - API route

**Fix:**
- Share the full error message
- Check if the error happens on a specific route
- Test that route locally

---

## Step 4: Share the Error

If you're still stuck, share:

1. **The exact error message** from Vercel logs
2. **Which deployment** failed (deployment ID)
3. **Output of:** `npm run check:deploy` (if you can run it locally)

This will help identify the specific issue.

---

## Quick Test: Check Environment Variables in Vercel

1. Go to **Project → Settings → Environment Variables**
2. Verify you see these **exact** names:
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `DATABASE_URL`
3. Check each one has **"Production"** checked in the environment column
4. If any are missing or unchecked, add/check them and **redeploy**

---

## Still Failing?

If deployments are still failing after:
- ✅ Environment variables are set correctly
- ✅ Database migration has been run
- ✅ You've redeployed

Then we need to see the **actual error message** from the Vercel logs to diagnose further.

**Next Step:** Copy the error message from the failed deployment logs and share it.

