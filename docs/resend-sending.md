# Resend Email Configuration

This document explains how to configure Resend for email sending in the OBD Premium Apps application.

## Verified Resend Domain

**Domain:** `updates.ocalabusinessdirectory.com`

This domain has been verified in the Resend dashboard and is approved for sending emails.

## Recommended Sender Address

**Recommended:** `support@updates.ocalabusinessdirectory.com`

This address is verified and working for:
- NextAuth magic-link authentication emails
- Review request automation emails
- Other application emails

## Environment Variable

Set `EMAIL_FROM` in your environment variables:

**Local Development (`.env.local`):**
```bash
EMAIL_FROM="OBD <support@updates.ocalabusinessdirectory.com>"
```

**Production (Vercel Environment Variables):**
```
EMAIL_FROM=OBD <support@updates.ocalabusinessdirectory.com>
```

## Important Notes

1. **Domain Verification:** The `EMAIL_FROM` address must use a domain that has been verified in your Resend account. Currently, `updates.ocalabusinessdirectory.com` is verified.

2. **Format:** The `EMAIL_FROM` can be in either format:
   - `"Display Name <email@domain.com>"` (recommended)
   - `email@domain.com` (also works)

3. **Restart Required:** After changing `EMAIL_FROM`, you **must restart the development server** for changes to take effect:
   ```bash
   # Stop server (Ctrl+C)
   pnpm dev
   ```

4. **Production:** Production values must be set in Vercel Project Settings → Environment Variables, not in local files.

## Troubleshooting

**"Server configuration error" when sending magic links:**
- Verify `EMAIL_FROM` is set correctly in `.env.local`
- Verify the domain in `EMAIL_FROM` matches a verified domain in Resend
- Verify `RESEND_API_KEY` is set and valid
- Restart the development server after making changes

**Email sending fails:**
- Check Resend dashboard for error messages
- Verify the sender email domain is verified in Resend
- Check that `RESEND_API_KEY` has permission to send from the domain

## Related Documentation

- [`docs/local-dev-env.md`](./local-dev-env.md) - Local development setup
- [`docs/VERCEL_ENV_VARS.md`](./VERCEL_ENV_VARS.md) - Complete environment variable reference

