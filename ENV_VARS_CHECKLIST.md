# Environment Variables Checklist for Vercel Production

## Required Environment Variables

### NextAuth.js Authentication
- **`NEXTAUTH_SECRET`**
  - Type: String (minimum 32 characters)
  - Description: Secret key for signing and encrypting JWT tokens
  - Example: `openssl rand -base64 32`
  - **Required**: Yes

- **`NEXTAUTH_URL`**
  - Type: URL
  - Description: Canonical URL of your application
  - Example: `https://apps.ocalabusinessdirectory.com`
  - **Required**: Yes

### Resend Email Service
- **`RESEND_API_KEY`**
  - Type: String (API key from Resend dashboard)
  - Description: Resend API key for sending magic link emails
  - Get from: https://resend.com/api-keys
  - **Required**: Yes

- **`EMAIL_FROM`**
  - Type: Email address
  - Description: Verified sender email address in Resend
  - Format: Must be verified in your Resend domain
  - Example: `noreply@yourdomain.com` or `onboarding@resend.dev`
  - **Required**: Yes

### Database (Prisma)
- **`DATABASE_URL`**
  - Type: PostgreSQL connection string
  - Description: Railway PostgreSQL connection URL
  - Format: `postgresql://user:password@host:port/database`
  - **Required**: Yes

### Optional (Development Only)
- **`PREMIUM_BYPASS_KEY`**
  - Type: String
  - Description: Admin bypass key for development (not used in production)
  - **Required**: No (only for local development)

## Verification Steps

1. **Check Vercel Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Verify all required variables are set for **Production** environment

2. **Verify Email Provider in Logs:**
   - After deployment, check Vercel Function Logs
   - Look for: `[NextAuth Email] Using Resend SDK for email delivery`
   - Look for: `[NextAuth Email] From address: ...` (should show masked email)
   - Look for: `[NextAuth Email] Resend API key: SET` (should show "SET")

3. **Test Magic Link Flow:**
   - Visit `/login`
   - Submit email address
   - Check Vercel logs for email sending confirmation
   - Check email inbox for magic link

## Common Issues

### Error: "Missing required environment variable: RESEND_API_KEY"
- **Fix**: Add `RESEND_API_KEY` to Vercel environment variables
- **Verify**: Check logs for `[NextAuth Email] Resend API key: SET`

### Error: "Missing required environment variable: EMAIL_FROM"
- **Fix**: Add `EMAIL_FROM` to Vercel environment variables
- **Note**: Email must be verified in Resend dashboard

### Error: "Failed to send verification email"
- **Check**: Resend API key is valid and active
- **Check**: `EMAIL_FROM` address is verified in Resend
- **Check**: Resend account has sending quota available
- **Check**: Vercel logs for detailed error message

### Error: "Nodemailer requires a `server` configuration"
- **Status**: This is resolved - server config is now included (not used, but required by NextAuth)

## Code Expectations

The code expects these exact variable names:
- `NEXTAUTH_SECRET` (not `NEXTAUTH_SECRET_KEY`)
- `NEXTAUTH_URL` (not `NEXT_PUBLIC_NEXTAUTH_URL`)
- `RESEND_API_KEY` (not `RESEND_KEY` or `RESEND_TOKEN`)
- `EMAIL_FROM` (not `FROM_EMAIL` or `SENDER_EMAIL`)
- `DATABASE_URL` (standard Prisma variable name)

