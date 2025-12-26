# Vercel Environment Variables Setup Guide

This guide walks you through setting up all required environment variables in Vercel for the OBD Premium Apps authentication system.

---

## 📍 Where to Set Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to: **Project → Settings → Environment Variables**
3. Add each variable below for **Production**, **Preview**, and **Development** environments

---

## 🔑 Required Environment Variables

### 1. NEXTAUTH_SECRET

**Description:** Secret key for NextAuth.js session encryption

**How to Generate:**
```bash
# Mac/Linux:
openssl rand -base64 32

# Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Example Value:**
```
aBc123XyZ456DeF789GhI012JkL345MnO678PqR901StU234VwX567YzA890=
```

**Important:** 
- Must be at least 32 characters long
- Keep this secret! Never commit it to git
- Use a different value for each environment (production, preview, development)

---

### 2. NEXTAUTH_URL

**Description:** The canonical URL of your site (used for email links)

**Value:**
```
https://apps.ocalabusinessdirectory.com
```

**For Preview/Development:**
- Preview: Use the Vercel preview URL (e.g., `https://your-project-git-branch.vercel.app`)
- Development: `http://localhost:3000`

**Important:** 
- Must be a valid URL
- Must match the domain where your app is deployed
- No trailing slash

---

### 3. RESEND_API_KEY

**Description:** API key for Resend email service

**How to Get:**
1. Sign up at [resend.com](https://resend.com)
2. Go to **API Keys** section
3. Click **Create API Key**
4. Copy the key (starts with `re_`)

**Example Value:**
```
re_YOUR_API_KEY_HERE
```

**Note:** Replace `YOUR_API_KEY_HERE` with your actual Resend API key from the dashboard.

**Important:**
- Keep this secret! Never commit it to git
- Free tier: 3,000 emails/month, 100 emails/day

---

### 4. EMAIL_FROM

**Description:** The email address that sends magic link emails

**Value:**
```
noreply@ocalabusinessdirectory.com
```

**Alternative (if domain not verified):**
```
onboarding@resend.dev
```

**Important:**
- Must be a valid email address
- If using custom domain, verify it in Resend first
- See [Resend Domain Verification](https://resend.com/docs/dashboard/domains/introduction)

---

### 5. DATABASE_URL

**Description:** PostgreSQL connection string

**Format:**
```
postgresql://username:password@host:port/database?schema=public
```

**Example:**
```
postgresql://user:pass@db.example.com:5432/mydb?schema=public
```

**Important:**
- Usually provided by your database provider (Railway, Supabase, etc.)
- Must include `?schema=public` for Prisma
- Keep this secret! Never commit it to git

---

### 6. PREMIUM_BYPASS_KEY (Optional)

**Description:** Development-only bypass key for testing without authentication

**When to Use:**
- Only for **Development** environment
- **DO NOT** set in Production
- Used for local testing

**How to Generate:**
```bash
# Any random string, e.g.:
openssl rand -hex 16
```

**Example Value:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Usage:**
Visit: `http://localhost:3000/unlock?key=YOUR_BYPASS_KEY`

**Important:**
- Only works in development mode
- Not available in production
- Optional - can be omitted if not needed

---

## 📋 Setup Checklist

Copy this checklist and check off each item:

- [ ] **NEXTAUTH_SECRET** added to Production
- [ ] **NEXTAUTH_SECRET** added to Preview
- [ ] **NEXTAUTH_SECRET** added to Development
- [ ] **NEXTAUTH_URL** set to `https://apps.ocalabusinessdirectory.com` (Production)
- [ ] **NEXTAUTH_URL** set for Preview environment
- [ ] **NEXTAUTH_URL** set for Development environment
- [ ] **RESEND_API_KEY** added to all environments
- [ ] **EMAIL_FROM** set to `noreply@ocalabusinessdirectory.com`
- [ ] **DATABASE_URL** added to all environments
- [ ] **PREMIUM_BYPASS_KEY** added to Development only (optional)

---

## 🚀 After Setting Variables

### 1. Configure Build Command (CRITICAL)

**Before deploying, you MUST set the build command to run migrations:**

1. Go to **Project → Settings → Build & Development Settings**
2. Find **"Build Command"**
3. Set it to:
   ```
   npm run migrate:deploy && npm run build
   ```
4. Click **Save**

**Why?** This ensures database migrations run before the build, preventing schema mismatch crashes. See `docs/PRISMA_MIGRATION_SAFETY.md` for details.

### 2. Redeploy Your Application

After adding environment variables and setting the build command, you **must** redeploy:

1. Go to **Deployments** tab
2. Click **⋯** (three dots) on latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic deployment

**Important:** Environment variables are only available after redeployment!

### 2. Verify Variables Are Loaded

Check your deployment logs for any errors. If you see:
```
❌ Missing required environment variables
```

Then the variables weren't set correctly or the app wasn't redeployed.

---

## 🔍 Verifying Setup

### Check Environment Variables in Vercel:

1. Go to **Project → Settings → Environment Variables**
2. Verify all variables are listed
3. Check that they're enabled for the correct environments

### Test Locally:

1. Copy variables to `.env.local`:
   ```bash
   NEXTAUTH_SECRET=your-secret
   NEXTAUTH_URL=http://localhost:3000
   RESEND_API_KEY=re_your_key
   EMAIL_FROM=noreply@ocalabusinessdirectory.com
   DATABASE_URL=your-database-url
   ```

2. Run the app:
   ```bash
   npm run dev
   ```

3. If variables are missing, you'll see a clear error message on startup.

---

## 🐛 Troubleshooting

### "Missing required environment variables"

**Solution:**
1. Verify all variables are set in Vercel
2. Ensure you've redeployed after adding variables
3. Check that variables are enabled for the correct environment (Production/Preview/Development)

### "NEXTAUTH_SECRET must be at least 32 characters"

**Solution:**
- Generate a new secret using the command above
- Ensure it's at least 32 characters long

### "NEXTAUTH_URL must be a valid URL"

**Solution:**
- Check for typos
- Ensure no trailing slash
- Use `https://` for production, `http://` for local

### "Failed to send verification email"

**Solution:**
- Verify `RESEND_API_KEY` is correct
- Check Resend account is active
- Verify `EMAIL_FROM` domain is verified in Resend (if using custom domain)

---

## 📚 Additional Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [NextAuth.js Environment Variables](https://authjs.dev/getting-started/environment-variables)
- [Resend Documentation](https://resend.com/docs)

---

## 🔒 Security Best Practices

1. **Never commit** `.env.local` or environment variables to git
2. **Use different secrets** for each environment (production, preview, development)
3. **Rotate secrets** periodically, especially if compromised
4. **Limit access** to Vercel project settings
5. **Use strong secrets** - generate with `openssl rand -base64 32`

---

**Last Updated:** December 2024

