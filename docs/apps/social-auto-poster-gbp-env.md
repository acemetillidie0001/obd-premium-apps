# Google Business Profile OAuth Environment Variables

This document explains how to configure Google Business Profile OAuth environment variables for the Social Auto-Poster.

## Required Environment Variables

### Local Development (`.env.local`)

Add these variables to `.env.local` in the project root:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Note:** Replace `your_google_client_id` and `your_google_client_secret` with actual values from Google Cloud Console.

### Production (Vercel Environment Variables)

Set these in **Vercel Project Settings → Environment Variables**:

- `GOOGLE_CLIENT_ID` - OAuth 2.0 Client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - OAuth 2.0 Client Secret from Google Cloud Console

**Important:**
- Never commit `.env.local` to Git (it's gitignored)
- Production values must be set in Vercel, not in local files
- Variable names are case-sensitive

## Google Cloud Console Setup

### Authorized Redirect URIs

Add these exact URIs to your OAuth 2.0 client in Google Cloud Console:

**Local Development:**
```
http://localhost:3000/api/social-connections/google/callback
```

**Production:**
```
https://apps.ocalabusinessdirectory.com/api/social-connections/google/callback
```

**Important:**
- Must match exactly (including protocol and path)
- No trailing slashes
- Case-sensitive

### How to Get Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services → Credentials**
4. Find your OAuth 2.0 Client ID
5. Copy the **Client ID** and **Client Secret**
6. Add to `.env.local` (local) or Vercel (production)

## Local Test Checklist

After setting up environment variables:

1. **Restart dev server:**
   ```bash
   # Stop server (Ctrl+C)
   pnpm dev
   ```

2. **Visit Setup page:**
   - Navigate to: `http://localhost:3000/apps/social-auto-poster/setup`
   - Scroll to "Connect Accounts" section
   - Find "Google Business Profile" row

3. **Connect Google Business Profile:**
   - Click **"Connect Google Business Profile"** button
   - Complete Google OAuth flow
   - Approve requested permissions
   - **Expected:** Redirects back with `google_connected=1` in URL
   - **Expected:** URL cleans to `/apps/social-auto-poster/setup` (no query params)
   - **Expected:** Success banner appears
   - **Expected:** Status shows "Connected ✅" with location name

4. **Send Test Post:**
   - Click **"Send GBP Test Post"** button
   - **Expected:** Button shows "Sending..." while processing
   - **Expected:** Test post results appear
   - **Expected:** Shows ✅ with "View Post →" link if successful
   - **Expected:** Clicking "View Post →" opens Google Business Profile post

5. **Verify Activity Page:**
   - Navigate to: `http://localhost:3000/apps/social-auto-poster/activity`
   - **Expected:** Test post appears in activity log
   - **Expected:** Shows "View Post →" link if permalink available

## Troubleshooting

**"Google Business Profile connection not configured"**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env.local`
- Restart dev server after adding variables
- Check variable names match exactly (case-sensitive)

**"Redirect URI mismatch"**
- Verify redirect URI in Google Cloud Console matches exactly:
  - Local: `http://localhost:3000/api/social-connections/google/callback`
  - Production: `https://apps.ocalabusinessdirectory.com/api/social-connections/google/callback`
- Ensure no trailing slashes or typos

**"Token expired"**
- Disconnect and reconnect Google Business Profile
- Ensure refresh token is being stored (check OAuth consent screen settings)

## Security Notes

- **Never commit `.env.local`** - It's gitignored
- **Never add secrets to tracked files** - Use placeholders in documentation
- **Production secrets** - Must be set in Vercel Environment Variables only
- **Token storage** - Tokens are stored securely in database, never logged

## Related Documentation

- [`social-auto-poster-gbp.md`](./social-auto-poster-gbp.md) - Complete GBP integration guide
- [`social-auto-poster-env-checklist.md`](./social-auto-poster-env-checklist.md) - All environment variables checklist
- [`local-dev-env.md`](../local-dev-env.md) - Local development setup

