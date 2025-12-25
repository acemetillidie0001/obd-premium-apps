# Social Auto-Poster Environment Variables Checklist

Quick reference for setting up Social Auto-Poster environment variables.

## Vercel Environment Variables Checklist

Add these in **Vercel Project Settings → Environment Variables**:

### Required for Social Auto-Poster

- [ ] `CRON_SECRET` - Random secret for `/runner` endpoint authentication (generate with `openssl rand -hex 32`)
  - **Note:** Not required for `/cron` endpoint (it uses Vercel header verification)
- [ ] `META_APP_ID` - Meta/Facebook App ID
- [ ] `META_APP_SECRET` - Meta/Facebook App Secret  
- [ ] `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., `https://apps.ocalabusinessdirectory.com`)

### Other Required Variables (if not already set)

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `AUTH_SECRET` - NextAuth secret
- [ ] `AUTH_URL` - Same as `NEXT_PUBLIC_APP_URL`

## Local Development (.env.local)

Create `.env.local` in project root:

```bash
# Social Auto-Poster - Cron Runner
CRON_SECRET=your-local-development-secret

# Social Auto-Poster - Meta OAuth
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Other required vars...
DATABASE_URL=your-database-url
AUTH_SECRET=your-auth-secret
AUTH_URL=http://localhost:3000
```

**Note:** `.env.local` is gitignored - never commit secrets to Git.

## Endpoints

There are two endpoints:

1. **`/api/social-auto-poster/cron`** - For Vercel Cron (automatic, no secrets)
   - Called automatically by Vercel Cron
   - Verifies Vercel headers (no `CRON_SECRET` needed)
   - Cannot be tested manually (requires Vercel headers)

2. **`/api/social-auto-poster/runner`** - For manual/external use
   - Requires `CRON_SECRET` via query param or header
   - Use this for manual testing

## Testing Commands

### Local Testing (`/runner` endpoint)

```bash
# Test runner with query parameter (recommended)
curl -X POST "http://localhost:3000/api/social-auto-poster/runner?secret=your-local-development-secret"

# Test runner with header
curl -X POST "http://localhost:3000/api/social-auto-poster/runner" \
  -H "x-cron-secret: your-local-development-secret"
```

**Note:** The `/cron` endpoint will return `401` locally because it requires Vercel headers. Use `/runner` for local testing.

### Production Testing (`/runner` endpoint)

```bash
# Test runner with query parameter (recommended)
curl -X POST "https://your-domain.com/api/social-auto-poster/runner?secret=YOUR_PRODUCTION_CRON_SECRET"

# Test runner with header
curl -X POST "https://your-domain.com/api/social-auto-poster/runner" \
  -H "x-cron-secret: YOUR_PRODUCTION_CRON_SECRET"
```

**Note:** The `/cron` endpoint is called automatically by Vercel Cron. To verify it's working, check Vercel Dashboard → Cron Jobs → Function logs.

## Generate CRON_SECRET

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Full Documentation

For complete setup instructions, see:
- [`docs/apps/social-auto-poster-cron-runner.md`](./social-auto-poster-cron-runner.md)
- [`docs/VERCEL_ENV_VARS.md`](../VERCEL_ENV_VARS.md)

