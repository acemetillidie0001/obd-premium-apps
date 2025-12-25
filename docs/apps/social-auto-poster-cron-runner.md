# Social Auto-Poster Cron Runner

## Overview

The Social Auto-Poster background runner processes scheduled posts when their scheduled time arrives. There are **two endpoints** for different use cases:

1. **`/api/social-auto-poster/cron`** - For Vercel Cron (automatic, no secrets required)
2. **`/api/social-auto-poster/runner`** - For manual testing and external cron services (requires `CRON_SECRET`)

Both endpoints use the same core processing logic but differ in authentication methods.

## Endpoints

### `/api/social-auto-poster/cron` (Vercel Cron)

- **POST** `/api/social-auto-poster/cron`
- **GET** `/api/social-auto-poster/cron` (same functionality)

**Authentication:** Verified automatically by checking for Vercel-specific headers (no `CRON_SECRET` required).

**Intended for:** Automatic execution by Vercel Cron jobs (configured in `vercel.json`).

**How it works:** The endpoint verifies that requests come from Vercel's infrastructure by checking for:
- Presence of any `x-vercel-*` headers (strong indicator)
- User-Agent containing "vercel" (secondary indicator)

If verification fails, returns `401` with `{ ok: false, error: "unauthorized_cron" }`.

### `/api/social-auto-poster/runner` (Manual/External)

- **POST** `/api/social-auto-poster/runner`
- **GET** `/api/social-auto-poster/runner` (same functionality)

**Authentication:** Protected by `CRON_SECRET` environment variable. Authentication can be provided via:

1. **Query Parameter** (recommended):
   ```
   ?secret=YOUR_CRON_SECRET
   ```

2. **HTTP Header**:
   ```
   x-cron-secret: YOUR_CRON_SECRET
   ```

**Intended for:** Manual testing via curl/HTTP client, or external cron services that can send secrets.

**Security Note:** The secret comparison uses standard string comparison. For production use, ensure `CRON_SECRET` is a strong, randomly generated value (see below).

## Environment Variables

### Required for `/runner` Endpoint

- `CRON_SECRET` - Secret key for authenticating `/runner` requests (not required for `/cron`)
  - Generate a secure random string (32+ characters recommended)
  - Example: `openssl rand -hex 32`
  - **Never commit this value to Git**
  - **Note:** `/cron` endpoint does NOT use this secret; it verifies Vercel headers instead

### Required for Meta Publishing

- `META_APP_ID` - Meta/Facebook App ID
  - Obtained from [Meta for Developers](https://developers.facebook.com/)
  - Required for OAuth and API access

- `META_APP_SECRET` - Meta/Facebook App Secret
  - Obtained from Meta App settings
  - **Never commit this value to Git**

- `NEXT_PUBLIC_APP_URL` - Base URL of your application
  - Format: `https://your-domain.com` (no trailing slash)
  - Used for OAuth callbacks and image fallback URLs
  - Example: `https://apps.ocalabusinessdirectory.com`

## Local Development Setup

### 1. Create `.env.local` File

Create a `.env.local` file in the project root (if it doesn't exist):

```bash
# Social Auto-Poster - Cron Runner
CRON_SECRET=your-local-development-secret-here

# Social Auto-Poster - Meta OAuth
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important:** `.env.local` is gitignored and should never be committed to the repository.

### 2. Generate CRON_SECRET

For local development, you can use any secure string. For production, use a cryptographically secure random generator:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Test Locally

Start your development server:

```bash
pnpm dev
```

#### Test `/runner` Endpoint (Manual Testing)

```bash
# Using query parameter (recommended)
curl -X POST "http://localhost:3000/api/social-auto-poster/runner?secret=your-local-development-secret-here"

# Using header
curl -X POST "http://localhost:3000/api/social-auto-poster/runner" \
  -H "x-cron-secret: your-local-development-secret-here"
```

#### Test `/cron` Endpoint (Simulates Vercel Cron)

The `/cron` endpoint will **fail locally** unless you provide Vercel headers:

```bash
# This will return 401 (unauthorized_cron) because Vercel headers are missing
curl -X POST "http://localhost:3000/api/social-auto-poster/cron"
```

To simulate a Vercel Cron request locally, you would need to add Vercel-specific headers. However, for local testing, use the `/runner` endpoint instead.

**Expected response** (when no posts are due):
```json
{
  "ok": true,
  "processed": 0,
  "succeeded": 0,
  "failed": 0,
  "message": "No due posts found",
  "timestamp": "2025-12-25T18:00:00.000Z"
}
```

## Vercel Deployment Setup

### 1. Environment Variables Checklist

Add the following environment variables in **Vercel Project Settings → Environment Variables**:

#### Required Variables:
- [ ] `CRON_SECRET` - Random secret for runner authentication
- [ ] `META_APP_ID` - Meta/Facebook App ID
- [ ] `META_APP_SECRET` - Meta/Facebook App Secret
- [ ] `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., `https://apps.ocalabusinessdirectory.com`)

#### Optional (if not already set):
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `AUTH_SECRET` - NextAuth secret
- [ ] `AUTH_URL` - Same as `NEXT_PUBLIC_APP_URL`

### 2. Generate Production CRON_SECRET

**Important:** Use a different `CRON_SECRET` for production than development:

```bash
openssl rand -hex 32
```

Copy the output and set it in Vercel environment variables.

### 3. Configure Vercel Cron

The cron job is already configured in `vercel.json` to call the `/cron` endpoint:

```json
{
  "crons": [
    {
      "path": "/api/social-auto-poster/cron",
      "schedule": "* * * * *"
    }
  ]
}
```

This runs every minute (`* * * * *`).

**How Authentication Works:** The `/cron` endpoint automatically verifies that requests come from Vercel's infrastructure by checking for Vercel-specific headers (`x-vercel-*` headers or User-Agent containing "vercel"). **No secrets are required** - the endpoint is protected by verifying the request source.

**Important:** The `/cron` endpoint will reject requests that don't have Vercel headers, so it cannot be called manually from external services. Use `/runner` for manual testing or external cron services.

### 4. Verify Cron is Running

After deployment, verify the cron job is active:

1. Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
2. Verify `/api/social-auto-poster/runner` appears with schedule `* * * * *`
3. Check the cron execution logs to ensure it's running successfully

### 5. Test Production Endpoints

#### Test `/runner` Endpoint Manually

You can test the production `/runner` endpoint manually:

```bash
# Using query parameter (recommended)
curl -X POST "https://your-domain.com/api/social-auto-poster/runner?secret=YOUR_PRODUCTION_CRON_SECRET"

# Using header
curl -X POST "https://your-domain.com/api/social-auto-poster/runner" \
  -H "x-cron-secret: YOUR_PRODUCTION_CRON_SECRET"
```

#### Test `/cron` Endpoint

**Note:** The `/cron` endpoint will return `401` if called manually because it requires Vercel headers. To verify it's working:

1. Check Vercel Dashboard → Your Project → Cron Jobs
2. Verify the cron job is running successfully
3. Check Vercel function logs for execution results

## How It Works

Both endpoints (`/cron` and `/runner`) use the same core processing logic:

1. **Authentication:**
   - `/cron`: Verifies Vercel headers (automatic for Vercel Cron)
   - `/runner`: Verifies `CRON_SECRET` (manual/external use)
2. **Query for due posts:**
   - Status: `scheduled`
   - `scheduledAt <= now`
   - `nextAttemptAt <= now` OR `nextAttemptAt IS NULL`
3. **Processing:**
   - Processes up to 50 items per run (batch limit)
   - Uses real Meta publishing if connections exist
   - Falls back to simulation if no connections
   - Implements retry logic with exponential backoff
4. **Response** includes:
   - `processed` - Number of items processed
   - `succeeded` - Number successfully posted
   - `failed` - Number that failed
   - `errors` - Array of error messages (if any)
   - `timestamp` - ISO timestamp of the run

## Response Format

### Success (no due posts):
```json
{
  "ok": true,
  "processed": 0,
  "message": "No due posts found"
}
```

### Success (posts processed):
```json
{
  "ok": true,
  "processed": 3,
  "succeeded": 2,
  "failed": 1,
  "errors": ["queue-item-id-123: Facebook publish failed"],
  "timestamp": "2025-12-25T18:00:00.000Z"
}
```

### Error (unauthorized):
```json
{
  "error": "Unauthorized"
}
```
Status: 401

### Error (missing config):
```json
{
  "error": "CRON_SECRET not configured"
}
```
Status: 500

## Troubleshooting

### `/runner` returns "Unauthorized"

- Verify `CRON_SECRET` is set in environment variables
- Ensure the secret in your request matches the environment variable exactly
- Check for extra whitespace or encoding issues
- Verify you're using either the query parameter (`?secret=...`) or header (`x-cron-secret: ...`)

### `/runner` returns "CRON_SECRET not configured"

- Ensure `CRON_SECRET` is set in Vercel environment variables (only needed for `/runner`, not `/cron`)
- Redeploy the application after setting environment variables
- Check that the environment variable name is exactly `CRON_SECRET` (case-sensitive)

### `/cron` returns "unauthorized_cron"

- This is expected if calling `/cron` manually (it requires Vercel headers)
- For manual testing, use `/runner` endpoint instead
- If this happens in production, check Vercel logs to verify the cron job is sending proper headers

### Cron job not running

- Verify `vercel.json` contains the cron configuration pointing to `/api/social-auto-poster/cron`
- Check Vercel Dashboard → Settings → Cron Jobs for the job status
- Ensure the deployment succeeded without errors
- Check Vercel function logs for cron execution errors
- Verify the cron job shows as "Active" in the Vercel dashboard

### Posts not being processed

- Verify posts have `status: "scheduled"`
- Check that `scheduledAt` is in the past
- For retries, check that `nextAttemptAt` is in the past or null
- Review runner response for error messages
- Check Activity page (`/apps/social-auto-poster/activity`) for delivery attempts

## Verification Steps

### Verify Cron is Firing in Vercel

1. **Check Vercel Dashboard:**
   - Go to your project → Settings → Cron Jobs
   - Verify `/api/social-auto-poster/cron` is listed and shows as "Active"
   - Check the "Last Run" timestamp to confirm recent executions

2. **Check Vercel Function Logs:**
   - Go to your project → Deployments → [Latest Deployment] → Functions
   - Click on `/api/social-auto-poster/cron`
   - Review execution logs for successful runs or errors

3. **Check Request Headers (in logs):**
   - Look for headers like `x-vercel-*` in the function logs
   - User-Agent should contain "vercel"
   - These indicate the request came from Vercel's cron service

### Test `/runner` Manually

```bash
# Local
curl -X POST "http://localhost:3000/api/social-auto-poster/runner?secret=your-local-secret"

# Production
curl -X POST "https://your-domain.com/api/social-auto-poster/runner?secret=YOUR_PRODUCTION_SECRET"
```

Expected response:
```json
{
  "ok": true,
  "processed": 0,
  "succeeded": 0,
  "failed": 0,
  "message": "No due posts found",
  "timestamp": "2025-12-25T18:00:00.000Z"
}
```

### Simulate `/cron` Locally

The `/cron` endpoint will fail locally because it requires Vercel headers:

```bash
curl -X POST "http://localhost:3000/api/social-auto-poster/cron"
```

Expected response (401):
```json
{
  "ok": false,
  "error": "unauthorized_cron"
}
```

This is expected behavior. For local testing, use the `/runner` endpoint instead.

## Related Documentation

- [Real Publishing Implementation](../../REAL_PUBLISHING_IMPLEMENTATION.md) - Full implementation details
- [Vercel Environment Variables](../VERCEL_ENV_VARS.md) - Complete env var reference
- [Meta Connection Implementation](../../META_CONNECTION_IMPLEMENTATION.md) - OAuth setup guide

