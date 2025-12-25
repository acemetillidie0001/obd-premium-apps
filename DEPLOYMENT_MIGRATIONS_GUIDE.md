# Running Prisma Migrations After Vercel Deployment

## ✅ Deployment Status
Your application has been successfully deployed to Vercel production:
- **Production URL**: https://cursor-app-build-f3xatyg4y-ocala-business-directorys-projects.vercel.app
- **Alias**: https://cursor-app-build.vercel.app

## 🔄 Running Database Migrations

To apply Prisma migrations to your production database, you have two options:

### Option 1: Run Migrations Manually (Recommended)

1. **Get Production DATABASE_URL**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to your project → Settings → Environment Variables
   - Copy the `DATABASE_URL` value for **Production** environment
   - Or retrieve it from your database provider (Railway, etc.)

2. **Set DATABASE_URL Locally**
   ```powershell
   # Windows PowerShell
   $env:DATABASE_URL="your-production-database-url-here"
   ```

3. **Run Migrations**
   ```powershell
   npm run migrate:deploy
   ```
   
   This will:
   - Validate the DATABASE_URL format
   - Apply pending migrations to production
   - Regenerate Prisma Client

4. **Verify Migration Status**
   ```powershell
   npx prisma migrate status
   ```

### Option 2: Configure Automatic Migrations (Alternative)

If you prefer migrations to run automatically during deployment, you can modify `vercel.json`:

```json
{
  "buildCommand": "npm run migrate:deploy && npm run build",
  "crons": [
    {
      "path": "/api/google-business/pro/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Note**: This approach runs migrations on every build, which can slow down deployments. Manual migrations are generally preferred for production.

## 📋 Environment Variables Checklist

Ensure these are set in Vercel Production environment:

- ✅ `DATABASE_URL` - PostgreSQL connection string (required for migrations)
- ✅ `AUTH_SECRET` or `NEXTAUTH_SECRET` - Session encryption secret
- ✅ `AUTH_URL` or `NEXTAUTH_URL` - Production app URL
- ✅ `OPENAI_API_KEY` - For AI features

## 🔍 Verify Deployment

After running migrations, verify the deployment:

1. **Check Application Health**
   - Visit: https://cursor-app-build.vercel.app
   - Test authentication/login
   - Test key features (Review Request Automation, Reputation Dashboard)

2. **Check Database Connection**
   ```powershell
   npm run verify:db
   ```

3. **Monitor Logs**
   ```powershell
   vercel logs --follow
   ```

## 📝 Current Migrations

The following migrations are available in `prisma/migrations/`:
- `add_auth_models`
- `add_brand_profile`
- `add_role_premium`
- `20251214014402_add_expires_at`

These will be applied to production when you run `npm run migrate:deploy`.

## 🚨 Troubleshooting

### Migration Fails with "DATABASE_URL not found"
- Ensure `DATABASE_URL` is set in your local environment
- Verify the URL format: `postgresql://user:pass@host:port/db?sslmode=require`

### Migration Fails with Connection Error
- Verify database allows connections from your IP
- Check firewall/security group settings
- Ensure SSL mode is correct in connection string

### Migration Shows "Already Applied"
- Run `npx prisma migrate status` to verify
- Database may already be up to date

