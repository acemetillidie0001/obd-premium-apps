# OBD Premium Apps — Production Deploy Checklist

## Hosting Setup

- **Next.js App**: Vercel
- **Database**: Railway (PostgreSQL)
- **Migration Command**: `prisma migrate deploy && prisma generate` (runs in `postinstall` script)

## Required Environment Variables

### Authentication (NextAuth v5)

| Variable | Required | Usage | Notes |
|----------|----------|-------|-------|
| `AUTH_SECRET` or `NEXTAUTH_SECRET` | ✅ Yes | NextAuth session encryption | Code supports both naming conventions |
| `AUTH_URL` or `NEXTAUTH_URL` | ✅ Yes | Production app URL | Must match Vercel deployment URL |
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string | From Railway Postgres service |
| `DIRECT_URL` | ⚠️ Optional | Direct DB connection (if Prisma uses it) | May be needed for connection pooling |

**Where used:**
- `src/lib/auth.ts` - Lines 49-54 (getAuthSecret, getAuthUrl helpers)
- `src/middleware.ts` - Line 20 (middleware auth check)

### OpenAI

| Variable | Required | Usage | Notes |
|----------|----------|-------|-------|
| `OPENAI_API_KEY` | ✅ Yes | OpenAI API authentication | Used by all AI generation endpoints |
| `OBD_OPENAI_MODEL` | ⚠️ Optional | Model override | Defaults to `gpt-4o-mini` if not set |

**Where used:**
- `src/lib/openai-client.ts` - Line 11 (getOpenAIClient)
- `src/app/api/*/route.ts` - All generation endpoints
- `src/app/api/local-hiring-assistant/route.ts` - Line 223 (model selection)

### Email Provider (Resend)

| Variable | Required | Usage | Notes |
|----------|----------|-------|-------|
| `RESEND_API_KEY` | ✅ Yes | Resend API key | Starts with `re_` |
| `EMAIL_FROM` | ✅ Yes | Sender email address | Must be verified in Resend dashboard |

**Where used:**
- `src/lib/auth.ts` - Lines 106-113, 235, 255-259 (email sending)
- `src/app/api/test-resend/route.ts` - Line 15 (test endpoint)

### Build/Deployment

| Variable | Required | Usage | Notes |
|----------|----------|-------|-------|
| `NODE_ENV` | ✅ Auto | Environment detection | Set automatically by Vercel |

**Where used:**
- `src/lib/obd-framework/apps.config.ts` - Line 39 (route validation)
- `src/app/api/brand-kit-builder/route.ts` - Line 10 (dev mode detection)

## Vercel Configuration

### Build Command
```bash
npm run build
```

### Install Command
```bash
npm install
```
(Note: `postinstall` script runs `prisma generate` automatically)

### Environment Variables Setup

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all required variables listed above
3. Ensure they're set for **Production**, **Preview**, and **Development** environments
4. Redeploy after adding new variables

### Prisma Migration

Vercel should run migrations automatically via:
- `postinstall` script: `prisma generate`
- Manual migration: `npm run migrate:deploy` (if needed)

**Recommended**: Set up a Railway webhook or Vercel build hook to run migrations on deploy.

## Verification Steps

### 1. Check Environment Variables
```bash
# In Vercel Dashboard, verify all variables are set
# Or use Vercel CLI:
vercel env ls
```

### 2. Test Database Connection
```bash
# Visit: https://your-app.vercel.app/api/test-db
# Should return database connection status
```

### 3. Test Authentication
```bash
# Visit: https://your-app.vercel.app/api/auth/providers
# Should return JSON with email provider
```

### 4. Test Email Sending
```bash
# Visit: https://your-app.vercel.app/api/test-resend
# Should send test email (check logs for success)
```

## Missing Environment Variables

If any required variables are missing:

1. **AUTH_SECRET/NEXTAUTH_SECRET**: Generate with `openssl rand -base64 32`
2. **AUTH_URL/NEXTAUTH_URL**: Set to your Vercel deployment URL (e.g., `https://apps.ocalabusinessdirectory.com`)
3. **DATABASE_URL**: Get from Railway Postgres service → Connection → Connection String
4. **OPENAI_API_KEY**: Get from OpenAI Dashboard → API Keys
5. **RESEND_API_KEY**: Get from Resend Dashboard → API Keys
6. **EMAIL_FROM**: Use verified email from Resend Dashboard (e.g., `noreply@yourdomain.com`)

## Deployment Notes

- All premium app routes use `/apps/*` namespace and are protected by middleware
- Middleware checks authentication before allowing access to `/apps/*` routes
- Build must pass TypeScript compilation and Next.js build
- No `any` types allowed in production code

