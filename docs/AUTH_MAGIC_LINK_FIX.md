# Magic Link Email Sign-In Fix Documentation

## Problem Summary

**What Failed:**
- Magic Link login on `https://apps.ocalabusinessdirectory.com/login` shows a red "Configuration" error after submitting an email
- Error occurs when POSTing to `/api/auth/signin/email` (during token creation or email send)

**What Works:**
- ✅ Auth route exists: `src/app/api/auth/[...nextauth]/route.ts`
- ✅ Runtime is Node.js: `export const runtime = "nodejs"`
- ✅ PrismaAdapter is configured in `src/lib/auth.ts`
- ✅ `prisma/schema.prisma` includes VerificationToken model
- ✅ Migrations are already deployed
- ✅ Provider is registered: `/api/auth/providers` returns the email provider
- ✅ CSRF works: `/api/auth/csrf` returns a csrfToken

## Diagnostic Endpoints

### 1. Test Resend Email Sending (Isolated)
**URL:** `https://apps.ocalabusinessdirectory.com/api/test-resend`

**Purpose:** Tests Resend email sending independently of NextAuth to isolate email delivery issues.

**Expected Response (Success):**
```json
{
  "ok": true,
  "result": { ... }
}
```

**Expected Response (Failure):**
```json
{
  "ok": false,
  "error": {
    "message": "...",
    "statusCode": 401,
    "response": { ... }
  }
}
```

### 2. NextAuth Provider Check
**URL:** `https://apps.ocalabusinessdirectory.com/api/auth/providers`

**Purpose:** Confirms NextAuth is initialized and Email provider is registered.

**Expected Response:**
```json
{
  "email": {
    "id": "email",
    "name": "Email",
    "type": "email",
    "signinUrl": "https://apps.ocalabusinessdirectory.com/api/auth/signin/email",
    "callbackUrl": "https://apps.ocalabusinessdirectory.com/api/auth/callback/email"
  }
}
```

### 3. NextAuth CSRF Check
**URL:** `https://apps.ocalabusinessdirectory.com/api/auth/csrf`

**Purpose:** Confirms NextAuth can generate CSRF tokens (basic functionality test).

**Expected Response:**
```json
{
  "csrfToken": "abc123..."
}
```

## Required Environment Variables (Vercel Production)

All of these **MUST** exist in Vercel Project Settings → Environment Variables → **Production**:

### 1. `AUTH_URL` OR `NEXTAUTH_URL`
- **Value:** `https://apps.ocalabusinessdirectory.com`
- **Purpose:** Canonical URL for NextAuth callbacks
- **Format:** Full URL, no trailing slash
- **Note:** Code supports both naming conventions

### 2. `AUTH_SECRET` OR `NEXTAUTH_SECRET`
- **Value:** Random string, minimum 32 characters
- **Purpose:** JWT signing secret for NextAuth
- **Generate:** `openssl rand -base64 32`
- **Note:** Code supports both naming conventions

### 3. `RESEND_API_KEY`
- **Value:** Resend API key (starts with `re_`)
- **Purpose:** Resend API key for sending magic link emails
- **Get from:** Resend Dashboard → API Keys
- **Format:** `re_xxxxxxxxxxxxx`

### 4. `EMAIL_FROM`
- **Value:** Verified email address (e.g., `noreply@yourdomain.com`)
- **Purpose:** Sender email address for magic link emails
- **Requirement:** Must be verified in Resend Dashboard
- **Format:** Valid email address

### 5. `DATABASE_URL`
- **Value:** PostgreSQL connection string
- **Purpose:** Railway Postgres connection for PrismaAdapter
- **Format:** `postgresql://user:password@host:port/database?sslmode=require`
- **Get from:** Railway Dashboard → Postgres Service → Connect

## Debugging via Vercel Function Logs

### How to Access Logs
1. Go to: Vercel Dashboard → Your Project
2. Click: **Functions** tab
3. Find: `/api/auth/[...nextauth]` function
4. Click: **View Logs** or **View Function Logs**

### What to Look For

#### Search for: `[NextAuth Route]`
**When:** Email sign-in form is submitted
**Shows:**
- Path being requested
- HTTP method
- Which environment variables are present (booleans only)

**Example:**
```
[NextAuth Route] signin/email request {
  path: '/api/auth/signin/email',
  method: 'POST',
  hasAuthUrl: true,
  hasAuthSecret: true,
  hasResendKey: true,
  hasEmailFrom: true,
  hasDatabaseUrl: true
}
```

#### Search for: `[NextAuth Email]`
**When:** Email sending is attempted
**Shows:**
- Email identifier (recipient)
- Environment variable presence
- Resend API call start
- Success or detailed error information

**Example (Success):**
```
[NextAuth Email] sendVerificationRequest start {
  identifier: 'user@example.com',
  hasResendKey: true,
  hasEmailFrom: true,
  hasDatabaseUrl: true
}
[NextAuth Email] Verification email sent successfully to: user@example.com
```

**Example (Error):**
```
[NextAuth Email] resend error {
  message: 'Invalid API key',
  name: 'ResendError',
  statusCode: 401,
  response: { ... },
  cause: undefined,
  stack: '...'
}
```

## Common Failure Scenarios

### 1. 401 Invalid API Key
**Error:** `statusCode: 401`, `message: "Invalid API key"` or similar
**Cause:** `RESEND_API_KEY` is missing, incorrect, or expired
**Fix:**
1. Go to Resend Dashboard → API Keys
2. Verify key exists and is active
3. Copy the full key (starts with `re_`)
4. Add to Vercel as `RESEND_API_KEY` for Production
5. Redeploy

### 2. 403 Sender/Domain Not Verified
**Error:** `statusCode: 403`, `message: "Sender not verified"` or "Domain not verified"
**Cause:** `EMAIL_FROM` address or domain is not verified in Resend
**Fix:**
1. Go to Resend Dashboard → Domains
2. Verify the domain for `EMAIL_FROM` is added and verified
3. Or use a verified email address from Resend's default domain
4. Update `EMAIL_FROM` in Vercel if needed
5. Redeploy

### 3. 429 Rate Limit
**Error:** `statusCode: 429`, `message: "Rate limit exceeded"`
**Cause:** Too many email requests in a short time
**Fix:**
- Wait a few minutes and try again
- Check Resend Dashboard → Usage for rate limits
- Consider upgrading Resend plan if needed

### 4. DNS/Domain Verification Pending
**Error:** `statusCode: 400` or `403`, `message: "Domain verification pending"`
**Cause:** Domain DNS records not properly configured
**Fix:**
1. Go to Resend Dashboard → Domains
2. Check domain verification status
3. Add required DNS records (SPF, DKIM, DMARC)
4. Wait for verification to complete
5. Retry email send

### 5. Prisma DB Write Error for VerificationToken
**Error:** Database error when creating VerificationToken
**Cause:** 
- `DATABASE_URL` is missing or invalid
- Database tables don't exist (migrations not applied)
- Database connection issues

**Fix:**
1. Verify `DATABASE_URL` is set in Vercel Production
2. Check Vercel build logs for migration errors
3. Run `npx prisma migrate deploy` manually if needed
4. Verify `VerificationToken` table exists in Railway database
5. Check Railway database connection status

### 6. Missing Environment Variable
**Error:** Configuration error, no specific Resend error
**Cause:** One or more required env vars are missing
**Fix:**
1. Check Vercel Function Logs for `[NextAuth Route]` output
2. Identify which variables show `false`
3. Add missing variables to Vercel Production environment
4. Redeploy

## Testing Workflow

### Step 1: Test Resend Directly
1. Visit: `https://apps.ocalabusinessdirectory.com/api/test-resend`
2. **If success:** Resend is working, issue is in NextAuth integration
3. **If failure:** Check error details and fix Resend configuration

### Step 2: Test NextAuth Provider
1. Visit: `https://apps.ocalabusinessdirectory.com/api/auth/providers`
2. **Expected:** Email provider JSON
3. **If missing:** NextAuth not initialized correctly

### Step 3: Test Magic Link Flow
1. Visit: `https://apps.ocalabusinessdirectory.com/login`
2. Enter email address
3. Click "Send Login Link"
4. **Immediately check Vercel Function Logs:**
   - Search for `[NextAuth Route]` - confirms request received
   - Search for `[NextAuth Email]` - shows email send attempt
   - Look for errors with status codes

### Step 4: Interpret Results
- **If `/api/test-resend` works but magic link fails:** Issue is in NextAuth → Resend integration
- **If both fail with 401:** `RESEND_API_KEY` is wrong
- **If both fail with 403:** `EMAIL_FROM` is not verified
- **If no errors in logs but Configuration error:** Check for missing env vars in logs

## Cleanup

After the issue is resolved, remove debug logging marked with:
```
// REMOVE AFTER FIX: ...
```

Files with debug logging:
- `src/lib/auth.ts` - `sendVerificationRequest` function
- `src/app/api/auth/[...nextauth]/route.ts` - route handler logging

The test endpoint can be kept for future debugging or removed:
- `src/app/api/test-resend/route.ts`

