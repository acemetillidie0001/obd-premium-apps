# Local Development: Auth Email Debug Guide

This guide helps diagnose and fix magic-link login issues in local development.

## Required Environment Variables

Set these in `.env.local` (project root):

- `DATABASE_URL` - Railway Postgres connection string
- `RESEND_API_KEY` - Resend API key (starts with `re_`)
- `EMAIL_FROM` - Email sender address (e.g., `"OBD <support@updates.ocalabusinessdirectory.com>"`)
- `NEXTAUTH_URL` - Local dev URL (e.g., `http://localhost:3000`)
- `NEXTAUTH_SECRET` - NextAuth secret (any secure random string for local dev)
- `NEXT_PUBLIC_APP_URL` - Public app URL (e.g., `http://localhost:3000`)

## Debug Endpoint

A local-only debug endpoint is available to validate configuration:

**URL:** `http://localhost:3000/api/debug/auth-email`

**Method:** `GET`

**Response Format:**
```json
{
  "ok": boolean,
  "env": {
    "hasDatabaseUrl": boolean,
    "hasResendKey": boolean,
    "emailFrom": string | null,
    "nextauthUrl": string | null
  },
  "db": {
    "ok": boolean,
    "error": string | undefined
  },
  "resend": {
    "ok": boolean,
    "error": string | undefined
  }
}
```

## Steps to Debug

### 1. Restart Development Server

After updating `.env.local`, **always restart the dev server**:

```bash
# Stop server (Ctrl+C)
pnpm dev
```

### 2. Check Debug Endpoint

Open in browser or use curl:

```bash
# Browser
http://localhost:3000/api/debug/auth-email

# Or curl
curl http://localhost:3000/api/debug/auth-email
```

### 3. Expected Output (Success)

```json
{
  "ok": true,
  "env": {
    "hasDatabaseUrl": true,
    "hasResendKey": true,
    "emailFrom": "OBD <support@updates.ocalabusinessdirectory.com>",
    "nextauthUrl": "http://localhost:3000"
  },
  "db": {
    "ok": true
  },
  "resend": {
    "ok": true
  }
}
```

### 4. Test Magic Link Login

1. Visit: `http://localhost:3000/login`
2. Enter your email address
3. Click "Send magic link"
4. Expected: Success message (no "Server configuration error")
5. Check your email inbox for the magic link

## Common Failure Cases

### Case 1: `env.hasDatabaseUrl: false`

**Symptom:**
```json
{
  "env": {
    "hasDatabaseUrl": false
  }
}
```

**Fix:**
- Add `DATABASE_URL` to `.env.local`
- Get the connection string from Railway Postgres dashboard
- Format: `postgresql://user:password@host:port/database?sslmode=require`
- Restart dev server

### Case 2: `db.ok: false` with "Database connection failed"

**Symptom:**
```json
{
  "db": {
    "ok": false,
    "error": "Database connection failed. Check DATABASE_URL."
  }
}
```

**Fix:**
- Verify `DATABASE_URL` format is correct
- Ensure Railway Postgres is running
- Check that `DATABASE_URL` includes `sslmode=require` or `sslmode=no-verify`
- Restart dev server

### Case 3: `env.hasResendKey: false`

**Symptom:**
```json
{
  "env": {
    "hasResendKey": false
  }
}
```

**Fix:**
- Add `RESEND_API_KEY` to `.env.local`
- Get API key from Resend dashboard
- Key should start with `re_`
- Restart dev server

### Case 4: `resend.ok: false` with "format invalid"

**Symptom:**
```json
{
  "resend": {
    "ok": false,
    "error": "RESEND_API_KEY format invalid (should start with 're_')"
  }
}
```

**Fix:**
- Verify `RESEND_API_KEY` starts with `re_`
- Get a new API key from Resend dashboard if needed
- Restart dev server

### Case 5: `env.emailFrom: null`

**Symptom:**
```json
{
  "env": {
    "emailFrom": null
  }
}
```

**Fix:**
- Add `EMAIL_FROM` to `.env.local`
- Use verified domain: `"OBD <support@updates.ocalabusinessdirectory.com>"`
- Restart dev server

### Case 6: "Server configuration error" on login page

**Symptom:**
- Login page shows: "Server configuration error. Please check that all required environment variables are set and the database is accessible."

**Fix:**
1. Check debug endpoint: `http://localhost:3000/api/debug/auth-email`
2. Fix any `ok: false` issues shown
3. Restart dev server
4. Try login again

## Verification Checklist

After fixing issues, verify:

- [ ] Debug endpoint shows `ok: true`
- [ ] All `env` flags are `true`
- [ ] `db.ok: true`
- [ ] `resend.ok: true`
- [ ] Login page loads without errors
- [ ] Magic link request succeeds
- [ ] Email arrives in inbox
- [ ] Magic link works (clicking it logs you in)

## Security Notes

- **Never commit `.env.local`** - It's gitignored
- **Never log secrets** - Debug endpoint only returns booleans, not actual values
- **Production:** This debug endpoint is disabled in production (returns 403)

## Related Documentation

- [`docs/resend-sending.md`](./resend-sending.md) - Resend email configuration
- [`docs/local-dev-env.md`](./local-dev-env.md) - Complete local development setup

