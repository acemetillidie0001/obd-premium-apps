# Production Authentication Setup Guide

## ✅ Implementation Complete

Production-ready magic link authentication with NextAuth.js, role-based access control, and premium gating.

### Features:
- ✅ Passwordless login via magic links (email-based)
- ✅ User roles: `user` | `admin`
- ✅ Premium flag for subscription gating
- ✅ Route protection (dashboard public, `/apps/*` protected)
- ✅ Admin bypass for development
- ✅ Premium upgrade prompts
- ✅ Session management (30-day sessions)
- ✅ TypeScript type safety

---

## 🔧 Required Environment Variables

Add these to your `.env.local` file and Vercel environment variables:

### Required:
```bash
# NextAuth.js Configuration
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32
NEXTAUTH_URL=https://apps.ocalabusinessdirectory.com

# Resend (for sending magic link emails)
RESEND_API_KEY=re_your_resend_api_key_here

# Email Configuration
EMAIL_FROM=noreply@ocalabusinessdirectory.com

# Admin Bypass (development only, optional)
PREMIUM_BYPASS_KEY=your-dev-bypass-key-here
```

### Generate NEXTAUTH_SECRET:
```bash
# On Mac/Linux:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

## 📧 Setting Up Resend

1. **Sign up for Resend**: Go to [resend.com](https://resend.com) and create an account
2. **Get API Key**: 
   - Go to API Keys section
   - Create a new API key
   - Copy the key (starts with `re_`)
3. **Verify Domain** (Recommended):
   - Add your domain `ocalabusinessdirectory.com`
   - Add DNS records as instructed
   - This allows you to send from `noreply@ocalabusinessdirectory.com`

### Resend Free Tier:
- 3,000 emails/month free
- 100 emails/day free
- Perfect for starting out!

---

## 🗄️ Database Migration

The Prisma schema has been updated with authentication models and role/premium fields.

### Run Migration:

**On Vercel (Production):**
```bash
npx prisma migrate deploy
```

**Locally (if database is accessible):**
```bash
npx prisma migrate dev
npx prisma generate
```

### Schema Changes:
- Added `role` field (default: "user")
- Added `isPremium` field (default: false)

---

## 🚀 How It Works

### User Flow:
1. User visits `/login` or tries to access `/apps/*`
2. Enters email address
3. Receives magic link email via Resend
4. Clicks link in email
5. Automatically logged in and redirected
6. Session lasts 30 days

### Route Protection:
- **Public Routes:**
  - `/` (Dashboard) - Public, no login required
  - `/login` - Public
  - `/api/auth/*` - Public
  
- **Protected Routes:**
  - `/apps/*` - Requires authentication
  - `/api/*` (except auth) - Requires authentication

### Admin Bypass (Development Only):
Visit: `/unlock?key=YOUR_PREMIUM_BYPASS_KEY`

This sets a secure cookie that bypasses authentication checks. **Only works in development mode.**

---

## 👤 User Roles & Premium Status

### Roles:
- `user` - Standard user (default)
- `admin` - Admin access (always has premium)

### Premium Flag:
- `isPremium: false` - Standard user
- `isPremium: true` - Premium subscriber

### Premium Gating:
Premium users can access all features. Non-premium users:
- Can log in
- Can view dashboard
- See "Upgrade Required" prompts on premium tools
- Redirected to: `https://ocalabusinessdirectory.com/for-business-owners/`

---

## 💻 Usage Examples

### Check Premium Status in API Route:
```typescript
import { hasPremiumAccess } from "@/lib/premium";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const hasPremium = await hasPremiumAccess();
  
  if (!hasPremium) {
    return NextResponse.json(
      { error: "Premium subscription required" },
      { status: 403 }
    );
  }
  
  // Premium feature logic here
}
```

### Check User Role:
```typescript
import { isAdmin } from "@/lib/premium";

export async function GET() {
  const admin = await isAdmin();
  
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  
  // Admin-only logic
}
```

### Use Premium Component in Page:
```typescript
import UpgradePrompt from "@/components/premium/UpgradePrompt";
import { hasPremiumAccess } from "@/lib/premium";

export default async function PremiumToolPage() {
  const hasPremium = await hasPremiumAccess();
  
  if (!hasPremium) {
    return <UpgradePrompt />;
  }
  
  return <div>Premium tool content</div>;
}
```

### Get Current User:
```typescript
import { getCurrentUser } from "@/lib/premium";

export default async function Page() {
  const user = await getCurrentUser();
  
  if (!user) {
    return <div>Not logged in</div>;
  }
  
  return (
    <div>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <p>Premium: {user.isPremium ? "Yes" : "No"}</p>
    </div>
  );
}
```

---

## 🔒 Security Notes

- Magic links expire after 24 hours (NextAuth default)
- Sessions use secure HTTP-only cookies
- Premium routes protected by middleware
- CSRF protection built into NextAuth
- Email verification required for login
- Admin bypass only works in development

---

## 🧪 Testing Locally

1. **Set up environment variables** in `.env.local`
2. **Start dev server**: `npm run dev`
3. **Test login flow**:
   - Go to `http://localhost:3000/login`
   - Enter your email
   - Check your email for the magic link
   - Click the link to sign in
4. **Test admin bypass** (development only):
   - Visit: `http://localhost:3000/unlock?key=YOUR_PREMIUM_BYPASS_KEY`
   - Should redirect to dashboard with bypass active

---

## 📝 Managing Users

### Set User as Admin (via Prisma):
```typescript
await prisma.user.update({
  where: { email: "admin@example.com" },
  data: { role: "admin" },
});
```

### Grant Premium Access:
```typescript
await prisma.user.update({
  where: { email: "user@example.com" },
  data: { isPremium: true },
});
```

---

## 🐛 Troubleshooting

### "Failed to send verification email"
- Check `RESEND_API_KEY` is set correctly
- Verify Resend account is active
- Check email domain is verified in Resend

### "Can't reach database server"
- Database migration needs to run on Vercel
- Or set up local database connection

### "Module not found: nodemailer"
- Run `npm install` to ensure all dependencies are installed

### "Invalid bypass key"
- Check `PREMIUM_BYPASS_KEY` matches in `.env.local`
- Bypass only works in development mode

---

## 📚 File Structure

```
src/
├── lib/
│   ├── auth.ts          # NextAuth configuration
│   └── premium.ts       # Premium access utilities
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts
│   ├── login/
│   │   └── page.tsx     # Login page
│   └── unlock/
│       └── route.ts      # Admin bypass route
├── components/
│   └── premium/
│       └── UpgradePrompt.tsx
├── middleware.ts         # Route protection
└── types/
    └── next-auth.d.ts    # TypeScript definitions
```

---

## 🚀 Next Steps (Future Enhancements)

- [ ] Stripe integration for premium subscriptions
- [ ] User profile page
- [ ] Admin dashboard
- [ ] OAuth providers (Google, Facebook)
- [ ] Email verification for new accounts
- [ ] Password reset flow (if adding password option)

---

## 📚 Resources

- [NextAuth.js Documentation](https://authjs.dev/)
- [Resend Documentation](https://resend.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
