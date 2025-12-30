# Auth Sanity Checklist

Quick 5-step manual checklist to validate login after unrelated changes.

## Checklist

1. **Start dev server**
   ```bash
   pnpm dev
   ```

2. **Visit `/api/health/auth`**
   - Open: `http://localhost:3000/api/health/auth`
   - Expected: `{ "mode": "EMAIL", "resendConfigured": true, "emailFromConfigured": true }`

3. **Confirm `mode === "EMAIL"`**
   - If mode is `"EMAIL"` → continue to step 4
   - If mode is `"CONSOLE_FALLBACK"` → **STOP and investigate auth configuration**

4. **Submit email on `/login`**
   - Go to: `http://localhost:3000/login`
   - Enter email address
   - Click "Send Login Link"
   - Should redirect to `/login/verify`

5. **Receive email**
   - Check inbox for magic link email
   - Email should arrive within a few seconds
   - Click link to complete login

## Important Notes

**If step 2 shows `CONSOLE_FALLBACK` unexpectedly:**
- **STOP** and investigate auth configuration
- Check `.env.local` for `RESEND_API_KEY` and `EMAIL_FROM`
- Do NOT debug DB, Prisma, or Meta first
- Auth email delivery must be configured before other systems

**If login breaks:**
1. Check `/api/health/auth` endpoint first
2. Check server logs for `[AUTH]` lines
3. Verify `RESEND_API_KEY` and `EMAIL_FROM` are set
4. Only then investigate other systems (DB, Prisma, etc.)

## Quick Reference

- Health endpoint: `/api/health/auth`
- Login page: `/login`
- Expected email delivery mode: `"EMAIL"`

