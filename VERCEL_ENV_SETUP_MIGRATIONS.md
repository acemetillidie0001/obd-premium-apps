# Setting Up DATABASE_URL in Vercel for Migrations

## Current Status
❌ **DATABASE_URL is not set in Vercel Production environment**

This is required to run Prisma migrations. Follow these steps to add it:

## Step 1: Get Your Production Database URL

Your production database URL should be in one of these places:

1. **Railway Dashboard** (if using Railway Postgres):
   - Go to [Railway Dashboard](https://railway.app)
   - Select your PostgreSQL service
   - Go to **Variables** tab
   - Copy the `DATABASE_URL` value

2. **Other Database Provider**:
   - Check your database provider's dashboard
   - Look for connection string or DATABASE_URL
   - Format: `postgresql://user:password@host:port/database?sslmode=require`

## Step 2: Add DATABASE_URL to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **cursor-app-build**
3. Navigate to **Settings** → **Environment Variables**
4. Click **Add New**
5. Enter:
   - **Key**: `DATABASE_URL`
   - **Value**: Your production database connection string
   - **Environment**: Select **Production** (and optionally Preview/Development)
6. Click **Save**

### Option B: Via Vercel CLI

```bash
vercel env add DATABASE_URL production
```

When prompted, paste your database URL.

## Step 3: Verify Environment Variable

```bash
vercel env ls
```

You should see `DATABASE_URL` listed for Production.

## Step 4: Run Migrations

After adding DATABASE_URL, you have two options:

### Option A: Automatic Migrations (During Build)

If you want migrations to run automatically during deployment, update `vercel.json`:

```json
{
  "buildCommand": "npm run migrate:deploy && npm run build"
}
```

Then redeploy:
```bash
vercel --prod --yes
```

### Option B: Manual Migrations (Recommended)

1. Get DATABASE_URL from Vercel Dashboard
2. Set it locally:
   ```powershell
   $env:DATABASE_URL="your-production-database-url"
   ```
3. Run migrations:
   ```bash
   npm run migrate:deploy
   ```
4. Verify:
   ```bash
   npx prisma migrate status
   ```

## Step 5: Redeploy (If Using Automatic Migrations)

After adding DATABASE_URL to Vercel:

```bash
vercel --prod --yes
```

The build will now run migrations automatically.

## ⚠️ Important Security Notes

- **Never commit DATABASE_URL** to Git
- **Use Vercel's environment variables** for secrets
- **Verify** you're using the production database URL (not local/dev)
- **Test migrations** on a staging environment first if possible

## Troubleshooting

### "DATABASE_URL is not set" Error
- Verify the variable is added in Vercel Dashboard
- Ensure it's set for **Production** environment
- Redeploy after adding the variable

### "Can't reach database server" Error
- Verify DATABASE_URL format is correct
- Check if database allows connections from Vercel's IPs
- Ensure SSL mode is included: `?sslmode=require`

### Migration Fails During Build
- Check build logs in Vercel Dashboard
- Verify DATABASE_URL is accessible from Vercel's build environment
- Consider using manual migrations instead

