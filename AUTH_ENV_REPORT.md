# Auth Environment Variables Report

## Files Inspected
- ✅ `src/lib/auth.ts`
- ✅ `src/lib/env.ts`
- ✅ `src/app/api/auth/[...nextauth]/route.ts`
- ✅ `src/middleware.ts`

## Environment Variables Found

### Required at Runtime

#### 1. Auth Secret (either one required)
- **`AUTH_SECRET`** (NextAuth v5 style) - Line 30 in `src/lib/auth.ts`
- **`NEXTAUTH_SECRET`** (Legacy style) - Lines 20, 30, 90 in `src/lib/auth.ts`, Line 20 in `src/middleware.ts`, Lines 46, 90 in `src/lib/env.ts`
- **Usage**: JWT signing secret for NextAuth
- **Note**: Code supports both naming conventions via `getAuthSecret()` helper

#### 2. Auth URL (either one required)
- **`AUTH_URL`** (NextAuth v5 style) - Line 34 in `src/lib/auth.ts`
- **`NEXTAUTH_URL`** (Legacy style) - Lines 34, 47, 98 in `src/lib/env.ts`
- **Usage**: Canonical URL for NextAuth callbacks
- **Note**: Code supports both naming conventions via `getAuthUrl()` helper

#### 3. Resend Email Service
- **`RESEND_API_KEY`** - Lines 87, 142, 150, 153 in `src/lib/auth.ts`, Lines 48, 118 in `src/lib/env.ts`
- **Usage**: Resend API key for sending magic link emails
- **Required**: Yes

#### 4. Email From Address
- **`EMAIL_FROM`** - Lines 92, 134, 148, 158 in `src/lib/auth.ts`, Lines 49, 108, 119 in `src/lib/env.ts`
- **Usage**: Verified sender email address for magic link emails
- **Required**: Yes

#### 5. Database Connection
- **`DATABASE_URL`** - Lines 60, 97 in `src/lib/auth.ts`, Lines 40, 51, 121 in `src/lib/env.ts`, Line 9 in `src/lib/prisma.ts`
- **Usage**: PostgreSQL connection string for Prisma
- **Required**: Yes

### Optional

#### 6. Trust Host
- **`AUTH_TRUST_HOST`** - Lines 38-39 in `src/lib/auth.ts`
- **Usage**: Controls `trustHost` setting in NextAuth config
- **Values**: `"true"` or `"false"` (defaults to `true` if not set)
- **Required**: No (defaults to `true`)

#### 7. Premium Bypass (Development Only)
- **`PREMIUM_BYPASS_KEY`** - Line 50 in `src/lib/env.ts`
- **Usage**: Admin bypass key for development
- **Required**: No (development only)

## Naming Convention Analysis

### Current State
- **`src/lib/auth.ts`**: ✅ Supports BOTH `AUTH_*` (v5) and `NEXTAUTH_*` (legacy) via helper functions
- **`src/lib/env.ts`**: ❌ Only uses `NEXTAUTH_*` naming (legacy)
- **`src/middleware.ts`**: ❌ Only uses `NEXTAUTH_SECRET` (legacy)

### Production Recommendation
**Use NextAuth v5 naming convention (`AUTH_*`)** for new deployments:
- `AUTH_SECRET` (instead of `NEXTAUTH_SECRET`)
- `AUTH_URL` (instead of `NEXTAUTH_URL`)
- `AUTH_TRUST_HOST` (optional, defaults to `true`)

**Legacy naming (`NEXTAUTH_*`) will also work** due to fallback support in `src/lib/auth.ts`.

## Summary

### Required Variables (at least one from each pair):
1. `AUTH_SECRET` OR `NEXTAUTH_SECRET`
2. `AUTH_URL` OR `NEXTAUTH_URL`
3. `RESEND_API_KEY` (required)
4. `EMAIL_FROM` (required)
5. `DATABASE_URL` (required)

### Optional Variables:
- `AUTH_TRUST_HOST` (defaults to `true` if not set)
- `PREMIUM_BYPASS_KEY` (development only)

## Notes
- `src/lib/env.ts` is not currently imported/used by `src/lib/auth.ts` (auth.ts has its own validation)
- Middleware only checks `NEXTAUTH_SECRET` (should be updated to support both)
- Both naming conventions work in `src/lib/auth.ts` due to helper functions

