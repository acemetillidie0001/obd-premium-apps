# Troubleshooting NextAuth "Configuration" Error

## What the Error Means
The "Configuration" error in NextAuth typically means one of these required settings is missing or invalid:
1. `AUTH_SECRET` or `NEXTAUTH_SECRET` - Missing, empty, or too short
2. `AUTH_URL` or `NEXTAUTH_URL` - Missing or invalid format
3. Email provider configuration - Invalid or missing required fields

## Debug Steps

### 1. Check Environment Variables in Vercel
Visit: `https://apps.ocalabusinessdirectory.com/api/debug/auth-env`

This will show you which env vars are set:
```json
{
  "hasSecret": true/false,
  "hasUrl": true/false,
  "hasResendKey": true/false,
  "hasEmailFrom": true/false,
  "hasDb": true/false,
  "allRequired": true/false
}
```

### 2. Verify Required Variables in Vercel Dashboard
Go to: Vercel Project → Settings → Environment Variables

**Required variables (at least one from each pair):**
- `AUTH_SECRET` OR `NEXTAUTH_SECRET` (must be at least 32 characters)
- `AUTH_URL` OR `NEXTAUTH_URL` (must be full URL like `https://apps.ocalabusinessdirectory.com`)
- `RESEND_API_KEY` (your Resend API key)
- `EMAIL_FROM` (verified email like `noreply@yourdomain.com`)
- `DATABASE_URL` (PostgreSQL connection string)

### 3. Check Vercel Function Logs
1. Go to Vercel Dashboard → Your Project → Functions
2. Look for errors in `/api/auth/[...nextauth]` function logs
3. Check for messages like:
   - `[NextAuth] Environment validation failed`
   - `Missing required environment variable`
   - `AUTH_SECRET or NEXTAUTH_SECRET must be set`

### 4. Common Issues and Fixes

#### Issue: Secret is too short
**Error**: NextAuth requires secrets to be at least 32 characters
**Fix**: Generate a new secret:
```bash
openssl rand -base64 32
```
Then set it in Vercel as `AUTH_SECRET` or `NEXTAUTH_SECRET`

#### Issue: URL is missing or wrong format
**Error**: `AUTH_URL` or `NEXTAUTH_URL` must be a full URL
**Fix**: Set to: `https://apps.ocalabusinessdirectory.com`
- Must start with `http://` or `https://`
- Must not have trailing slash
- Must match your actual domain

#### Issue: Email provider not configured
**Error**: `EMAIL_FROM` or `RESEND_API_KEY` missing
**Fix**: 
- Set `EMAIL_FROM` to a verified email address in Resend
- Set `RESEND_API_KEY` to your Resend API key

#### Issue: Using fallback secret in production
**Error**: Code is using `"fallback-secret-for-build"` in production
**Fix**: Ensure `AUTH_SECRET` or `NEXTAUTH_SECRET` is set in Vercel Production environment

### 5. Verify After Setting Variables
1. Redeploy the application (Vercel will auto-deploy on env var changes)
2. Check `/api/debug/auth-env` again
3. Try the login flow again

### 6. Check NextAuth Route Handler
Verify the route handler exists and is correct:
- File: `src/app/api/auth/[...nextauth]/route.ts`
- Must export: `export const runtime = "nodejs"`
- Must export: `export const { GET, POST } = handlers;`

## Quick Fix Checklist
- [ ] `AUTH_SECRET` or `NEXTAUTH_SECRET` is set (32+ characters)
- [ ] `AUTH_URL` or `NEXTAUTH_URL` is set (full URL)
- [ ] `RESEND_API_KEY` is set
- [ ] `EMAIL_FROM` is set (verified email)
- [ ] `DATABASE_URL` is set
- [ ] All variables are set in **Production** environment (not just Preview)
- [ ] Application has been redeployed after setting variables
- [ ] `/api/debug/auth-env` shows `allRequired: true`

