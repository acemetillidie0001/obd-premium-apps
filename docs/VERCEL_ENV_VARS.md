# Vercel Production Environment Variables

This document lists **all required environment variables** for the OBD Premium Apps production deployment on Vercel.

## Required Variables

### Authentication (NextAuth.js)

The application supports **both** NextAuth v5 (`AUTH_*`) and legacy (`NEXTAUTH_*`) naming conventions. For maximum compatibility, set **both sets**:

**NextAuth v5 (preferred):**
- `AUTH_SECRET` - Secret key for JWT signing (32+ characters, random string)
- `AUTH_URL` - Base URL of the application: `https://apps.ocalabusinessdirectory.com`

**Legacy (for compatibility):**
- `NEXTAUTH_SECRET` - Same value as `AUTH_SECRET`
- `NEXTAUTH_URL` - Same value as `AUTH_URL`: `https://apps.ocalabusinessdirectory.com`

**Optional:**
- `AUTH_TRUST_HOST` - Set to `"true"` if using Vercel (defaults to true)

### Database (Railway Postgres)

- `DATABASE_URL` - PostgreSQL connection string from Railway
  - Format: `postgresql://user:password@host:port/database?sslmode=require`
  - The application will automatically normalize this to include `connection_limit=1` for serverless

### Email (Resend)

- `RESEND_API_KEY` - API key from Resend dashboard
- `EMAIL_FROM` - Verified sender email address
  - Format: `OBD Premium <support@updates.ocalabusinessdirectory.com>`
  - Must match a verified domain in your Resend account

### Premium Access (Development)

- `PREMIUM_BYPASS_KEY` - Secret key for admin bypass (development/testing only)

## Example Vercel Environment Variables

```
AUTH_SECRET=your-32-character-random-secret-here
AUTH_URL=https://apps.ocalabusinessdirectory.com
NEXTAUTH_SECRET=your-32-character-random-secret-here
NEXTAUTH_URL=https://apps.ocalabusinessdirectory.com
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=OBD Premium <support@updates.ocalabusinessdirectory.com>
PREMIUM_BYPASS_KEY=dev-bypass-key-here
```

## Verification

After setting environment variables, verify they are working:

1. **Test Resend Email**: `https://apps.ocalabusinessdirectory.com/api/test-resend`
   - Should return `{ ok: true }`

2. **Test Database**: `https://apps.ocalabusinessdirectory.com/api/test-db`
   - Should return `{ ok: true, tests: { read: true, create: true, delete: true } }`

3. **Test Auth Providers**: `https://apps.ocalabusinessdirectory.com/api/auth/providers`
   - Should return JSON with `email` provider

4. **Test Magic Link**: Submit email on `/login`
   - Should receive magic link email (no "Configuration" error)

## Notes

- All environment variables are case-sensitive
- Never commit secrets to Git
- Use Vercel's environment variable UI to set production values
- Changes to environment variables require a redeploy to take effect

