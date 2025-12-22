# Email Sign-In Configuration Error - Debug Patch

## What Was Checked

### ✅ 1. Auth Route Handler
- **File**: `src/app/api/auth/[...nextauth]/route.ts`
- **Status**: ✅ Already has `export const runtime = "nodejs"`
- **Action**: Added logging for email sign-in requests

### ✅ 2. PrismaAdapter Configuration
- **File**: `src/lib/auth.ts`
- **Status**: ✅ PrismaAdapter is configured and loads successfully
- **Verification**: Build logs show `[NextAuth] PrismaAdapter loaded successfully`

### ✅ 3. VerificationToken Model
- **File**: `prisma/schema.prisma`
- **Status**: ✅ VerificationToken model exists (lines 63-69)
- **Structure**: Has `identifier`, `token`, `expires` fields with proper unique constraints

### ✅ 4. Database Migrations
- **Status**: ✅ Migrations deployed (verified earlier)
- **Script**: `package.json` has `"migrate:deploy": "prisma migrate deploy && prisma generate"`
- **Vercel Build**: Should run `npm run migrate:deploy && npm run build`

---

## Exact Patches Applied

### Patch 1: `src/app/api/auth/[...nextauth]/route.ts`

**Added logging to route handler:**

```typescript
// Wrap handlers with error handling
async function handleRequest(
  handler: (req: NextRequest) => Promise<Response>,
  req: NextRequest
): Promise<Response> {
  try {
    // Log environment variables at request time (booleans only, no secrets)
    const url = new URL(req.url);
    if (url.pathname.includes("/signin/email") || url.pathname.includes("/callback/email")) {
      console.log("[NextAuth Route] === Email Sign-In Request ===");
      console.log("[NextAuth Route] Path:", url.pathname);
      console.log("[NextAuth Route] AUTH_URL present:", !!(process.env.AUTH_URL || process.env.NEXTAUTH_URL));
      console.log("[NextAuth Route] AUTH_SECRET present:", !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET));
      console.log("[NextAuth Route] EMAIL_FROM present:", !!process.env.EMAIL_FROM);
      console.log("[NextAuth Route] RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);
      console.log("[NextAuth Route] DATABASE_URL present:", !!process.env.DATABASE_URL);
    }
    
    return await handler(req);
  } catch (error) {
    // ... existing error handling
  }
}
```

### Patch 2: `src/lib/auth.ts`

**Added logging to email verification request:**

```typescript
sendVerificationRequest: async ({ identifier, url }) => {
  // Log environment variable presence (booleans only, no secrets)
  console.log("[NextAuth Email] === Email Sign-In Request Debug ===");
  console.log("[NextAuth Email] AUTH_URL present:", !!(process.env.AUTH_URL || process.env.NEXTAUTH_URL));
  console.log("[NextAuth Email] AUTH_SECRET present:", !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET));
  console.log("[NextAuth Email] EMAIL_FROM present:", !!process.env.EMAIL_FROM);
  console.log("[NextAuth Email] RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);
  console.log("[NextAuth Email] DATABASE_URL present:", !!process.env.DATABASE_URL);
  console.log("[NextAuth Email] Adapter loaded:", adapter !== undefined && adapter !== null);
  // ... rest of function
}
```

**Added logging to JWT callback:**

```typescript
async jwt({ token, user, trigger }) {
  // Log when JWT callback is invoked (for debugging email sign-in flow)
  if (user) {
    console.log("[NextAuth JWT] User sign-in detected, email:", user.email);
  }
  // ... rest of callback
}
```

---

## Exact Required Environment Variables for Vercel Production

### Required Variables (at least one from each pair):

1. **`AUTH_SECRET`** OR **`NEXTAUTH_SECRET`**
   - **Purpose**: JWT signing secret
   - **Format**: Random string, minimum 32 characters
   - **Generate**: `openssl rand -base64 32`
   - **Example**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

2. **`AUTH_URL`** OR **`NEXTAUTH_URL`**
   - **Purpose**: Canonical URL for NextAuth callbacks
   - **Format**: Full URL (no trailing slash)
   - **Example**: `https://apps.ocalabusinessdirectory.com`

3. **`RESEND_API_KEY`**
   - **Purpose**: Resend API key for sending magic link emails
   - **Format**: Resend API key (starts with `re_`)
   - **Get from**: Resend Dashboard → API Keys

4. **`EMAIL_FROM`**
   - **Purpose**: Verified sender email address
   - **Format**: Valid email address (must be verified in Resend)
   - **Example**: `noreply@yourdomain.com` or `hello@yourdomain.com`

5. **`DATABASE_URL`**
   - **Purpose**: PostgreSQL connection string for Railway
   - **Format**: `postgresql://user:password@host:port/database?sslmode=require`
   - **Get from**: Railway Dashboard → Postgres Service → Connect → Connection String

### Optional Variables:

6. **`AUTH_TRUST_HOST`** (optional)
   - **Purpose**: Controls `trustHost` setting
   - **Values**: `"true"` or `"false"` (defaults to `true` if not set)
   - **Note**: Usually not needed on Vercel

---

## Verification Steps

### Step 1: Check Vercel Environment Variables

1. Go to: Vercel Dashboard → Your Project → Settings → Environment Variables
2. Verify all 5 required variables are set for **Production** environment
3. Use the debug endpoint to verify:
   ```bash
   curl https://apps.ocalabusinessdirectory.com/api/debug/auth-env
   ```
   Should return: `"allRequired": true`

### Step 2: Test Email Sign-In and Check Logs

1. Go to: `https://apps.ocalabusinessdirectory.com/login`
2. Enter your email address
3. Click "Send Login Link"
4. **Immediately check Vercel Function Logs:**
   - Go to: Vercel Dashboard → Your Project → Functions → `/api/auth/[...nextauth]`
   - Look for logs starting with `[NextAuth Route]` and `[NextAuth Email]`
   - **Check which variables show `false`** - these are missing

### Step 3: Interpret Log Output

**Expected log sequence:**
```
[NextAuth Route] === Email Sign-In Request ===
[NextAuth Route] Path: /api/auth/signin/email
[NextAuth Route] AUTH_URL present: true
[NextAuth Route] AUTH_SECRET present: true
[NextAuth Route] EMAIL_FROM present: true
[NextAuth Route] RESEND_API_KEY present: true
[NextAuth Route] DATABASE_URL present: true

[NextAuth Email] === Email Sign-In Request Debug ===
[NextAuth Email] AUTH_URL present: true
[NextAuth Email] AUTH_SECRET present: true
[NextAuth Email] EMAIL_FROM present: true
[NextAuth Email] RESEND_API_KEY present: true
[NextAuth Email] DATABASE_URL present: true
[NextAuth Email] Adapter loaded: true
[NextAuth Email] Using Resend SDK for email delivery
```

**If any show `false`, that variable is missing in Vercel Production environment.**

### Step 4: Fix Missing Variables

1. For each variable showing `false`:
   - Go to Vercel → Settings → Environment Variables
   - Add the variable for **Production** environment
   - **Important**: After adding, Vercel will auto-redeploy

2. Wait for redeploy to complete

3. Test email sign-in again

4. Check logs again - all should show `true`

---

## Common Issues and Solutions

### Issue: "AUTH_SECRET present: false"
**Solution**: 
- Generate new secret: `openssl rand -base64 32`
- Add to Vercel as `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- Ensure it's set for **Production** environment

### Issue: "AUTH_URL present: false"
**Solution**:
- Add `AUTH_URL=https://apps.ocalabusinessdirectory.com` to Vercel
- Or use `NEXTAUTH_URL` (legacy naming)
- No trailing slash!

### Issue: "EMAIL_FROM present: false"
**Solution**:
- Add `EMAIL_FROM=noreply@yourdomain.com` to Vercel
- Email must be verified in Resend Dashboard

### Issue: "RESEND_API_KEY present: false"
**Solution**:
- Get API key from Resend Dashboard
- Add to Vercel as `RESEND_API_KEY`

### Issue: "DATABASE_URL present: false"
**Solution**:
- Get connection string from Railway Dashboard
- Add to Vercel as `DATABASE_URL`
- Format: `postgresql://user:password@host:port/database?sslmode=require`

### Issue: "Adapter loaded: false"
**Solution**:
- This means PrismaAdapter failed to load
- Check Vercel logs for `[NextAuth] Failed to load PrismaAdapter`
- Usually means `DATABASE_URL` is missing or invalid
- Or Prisma Client wasn't generated (check build logs)

---

## Production Build Command Verification

**Vercel Build Command should be:**
```bash
npm run migrate:deploy && npm run build
```

**Or in Vercel Dashboard:**
- Settings → General → Build Command
- Set to: `npm run migrate:deploy && npm run build`

**This ensures:**
1. Database migrations run before build
2. Prisma Client is generated
3. NextAuth can access database tables

---

## Next Steps

1. ✅ **Deploy the logging patches** (already committed)
2. ✅ **Wait for Vercel to redeploy**
3. ✅ **Test email sign-in**
4. ✅ **Check Vercel Function Logs** for the debug output
5. ✅ **Identify missing variables** (any showing `false`)
6. ✅ **Add missing variables** to Vercel Production
7. ✅ **Redeploy and test again**

The logs will now show exactly which environment variables are missing when you submit the email form.

