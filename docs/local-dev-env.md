# Local Development Environment Setup

This document explains how to set up environment variables for local development of OBD Premium Apps.

## .env.local File

Create a `.env.local` file in the project root directory. This file is automatically ignored by Git (see `.gitignore`) and should **never be committed** to the repository.

**⚠️ Important:**
- `.env.local` is **local-only** - it will never be committed to Git
- **Production values** belong in **Vercel Environment Variables**, not in this file
- After creating or modifying `.env.local`, you **must restart the development server** for changes to take effect

## Required Environment Variables

Set these in `.env.local` for local development:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Email (Resend)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM="OBD <support@updates.ocalabusinessdirectory.com>"

# NextAuth
# For Meta OAuth testing with ngrok, use: NEXTAUTH_URL=https://<subdomain>.ngrok-free.dev
# (Get the URL from ngrok "Forwarding https://..." line)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-change-later

# Meta (Facebook + Instagram) OAuth
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
# For Meta OAuth testing with ngrok, use: NEXT_PUBLIC_APP_URL=https://<subdomain>.ngrok-free.dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Variable Descriptions

- **`DATABASE_URL`** - PostgreSQL connection string (Railway Postgres for local dev)
- **`RESEND_API_KEY`** - Resend API key for sending emails (starts with `re_`)
- **`EMAIL_FROM`** - Sender email address (must use verified Resend domain)
- **`NEXTAUTH_URL`** - Base URL for NextAuth (local dev: `http://localhost:3000`). For Meta OAuth testing with ngrok, use `https://<subdomain>.ngrok-free.dev` (get the URL from ngrok "Forwarding https://..." line)
- **`NEXTAUTH_SECRET`** - NextAuth secret (any secure random string for local dev)
- **`META_APP_ID`** - Meta (Facebook) App ID for OAuth
- **`META_APP_SECRET`** - Meta (Facebook) App Secret for OAuth
- **`NEXT_PUBLIC_APP_URL`** - Public app URL (local dev: `http://localhost:3000`)

## Getting Started

1. Create `.env.local` in the project root (same directory as `package.json`)
2. Add the required environment variables (see above)
3. **Restart your development server** for changes to take effect:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart
   pnpm dev
   ```

## Restart Required

**Critical:** After creating or modifying `.env.local`, you **must restart the development server** for changes to take effect:

```bash
# Stop the server (Ctrl+C)
# Then restart
pnpm dev
```

Next.js loads environment variables at startup, so changes to `.env.local` will not be picked up until the server is restarted.

## Production vs Local

- **Local Development:** Use `.env.local` (gitignored, never committed)
- **Production:** Set environment variables in **Vercel Project Settings → Environment Variables**

**Never:**
- Commit `.env.local` to Git
- Use production secrets in `.env.local`
- Hardcode secrets in tracked source files

## Security Notes

- `.env.local` is gitignored - it will never be committed
- Never add secrets to tracked files
- Never share `.env.local` files publicly
- Rotate development secrets periodically
- Production secrets must be set in Vercel Environment Variables, not in local files

## Troubleshooting

**Environment variables not loading?**
- Ensure the file is named exactly `.env.local` (not `.env.local.example` or similar)
- Ensure the file is in the project root (same directory as `package.json`)
- **Restart the development server** after adding/modifying variables
- Check that variable names match exactly (case-sensitive)

**Getting "META_NOT_CONFIGURED" error?**
- Ensure `META_APP_ID` and `META_APP_SECRET` are set in `.env.local`
- Ensure `NEXT_PUBLIC_APP_URL` is set to `http://localhost:3000`
- Restart the development server after adding variables

**Getting "Server configuration error" on login?**
- Check that `DATABASE_URL`, `RESEND_API_KEY`, and `EMAIL_FROM` are set
- Use the debug endpoint: `http://localhost:3000/api/debug/auth-email`
- See [`docs/local-dev-auth-email-debug.md`](./local-dev-auth-email-debug.md) for detailed debugging

## Related Documentation

- [`docs/local-dev-auth-email-debug.md`](./local-dev-auth-email-debug.md) - Debugging auth/email issues
- [`docs/resend-sending.md`](./resend-sending.md) - Resend email configuration
- [`docs/VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md) - Complete environment variable reference
