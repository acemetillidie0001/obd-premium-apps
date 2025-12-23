# Brand Kit Builder V3 — Release Notes

**Release Date:** [TBD - Update after deployment]  
**Version:** 3.0.0  
**Status:** Production Ready

## Overview

Brand Kit Builder V3 is a comprehensive brand identity generation tool that creates complete, actionable brand kits for local businesses. This release introduces brand profile persistence, cross-app data sharing, PDF export, and production-grade error handling.

## What Shipped

### Core Features

1. **Brand Kit Generation**
   - Comprehensive brand identity creation including:
     - Color palette (minimum 5 colors with accessibility notes)
     - Typography pairings (headline + body fonts with usage notes)
     - Brand messaging (5 taglines, 5 value props, elevator pitch)
     - Ready-to-use copy (website hero, about us, social bios)
     - Brand summary and positioning
   - Language support: English, Spanish, Bilingual
   - Variation modes: Conservative, Moderate, Bold

2. **Brand Profile Persistence**
   - Save generated brand kits to user profile
   - Persistent storage in PostgreSQL (BrandProfile model)
   - Load saved profile to pre-fill forms
   - Last saved timestamp display
   - One profile per user (automatically updates on save)

3. **Cross-App Auto-Load**
   - Brand profile data automatically loads in:
     - Review Responder
     - Social Media Post Creator
   - User preference toggle: "Use saved brand profile" (localStorage)
   - Only fills empty fields (doesn't overwrite user input)
   - Visual hint: "✓ Loaded from Brand Profile" when auto-filled

4. **Export Functionality**
   - **TXT Export**: Human-readable, sectioned text file with meta information
   - **JSON Export**: Raw API response JSON for programmatic use
   - **PDF Export**: Professional PDF document with all brand kit sections
     - Includes requestId and createdAtISO in header
     - Multi-page support for long content
     - Standard fonts (Helvetica) for compatibility

5. **Extras (Optional Toggles)**
   - Social Post Templates (platform-specific templates)
   - FAQ Starter (5 Q&A pairs)
   - Google Business Profile Description (≤750 chars)
   - Meta Description (140-160 chars, SEO-optimized)

### Technical Improvements

- **Server-Side Normalization**: Enforces data contract guarantees
  - Color palette: minimum 5 colors (auto-appends fallbacks if needed)
  - Taglines/Value Props: exactly 5 items (pads or truncates)
  - GBP Description: ≤750 characters (truncates safely)
  - Meta Description: 140-160 characters (expands or truncates deterministically)

- **Error Handling & Debugging**
  - All API responses include `requestId` for tracing
  - Rate limiting: 20 requests per 15 minutes per IP
  - JSON parsing with repair mechanisms (markdown fence stripping, bracket extraction, model repair attempt)
  - Comprehensive error messages with requestId in dev mode

- **Developer Experience (Dev Mode)**
  - PDF route accepts request payload directly (auto-generates brand kit)
  - Auth bypass for script testing (dev only)
  - Robust URL resolution using `request.nextUrl.origin`

## API Endpoints

### POST `/api/brand-kit-builder`
- **Auth**: Required (session)
- **Rate Limit**: 20 requests / 15 min / IP
- **Request**: `BrandKitBuilderRequest` (see types)
- **Response**: `{ ok: true, data: BrandKitBuilderResponse }`
- **Error**: `{ error: string, requestId: string }`

### POST `/api/brand-kit-builder/pdf`
- **Auth**: Required in production (bypassed in dev for testing)
- **Request**: 
  - Production: `{ brandKit: BrandKitBuilderResponse }`
  - Dev: `BrandKitBuilderRequest` (auto-generates brand kit)
- **Response**: PDF file (application/pdf)
- **Error**: JSON with requestId

### GET `/api/brand-profile`
- **Auth**: Required (session)
- **Response**: `BrandProfile | null`

### POST `/api/brand-profile`
- **Auth**: Required (session)
- **Request**: `BrandProfile` data
- **Response**: `{ success: true, profile: BrandProfile }`

## Database Changes

### New Table: `BrandProfile`
- One-to-one relationship with User
- Stores brand identity data (business basics, brand direction, voice, services, etc.)
- Auto-creates on first save, updates on subsequent saves
- Migration: `prisma migrate deploy` (additive, safe)

## How to Test

### Local Testing

1. **Start dev server:**
   ```bash
   pnpm dev
   ```

2. **Run automated probes:**
   ```powershell
   # Generate JSON
   Invoke-WebRequest -Uri "http://localhost:3000/api/brand-kit-builder" `
     -Method POST -ContentType "application/json" `
     -InFile "scripts\bkb-payload.json" -OutFile "$env:TEMP\bkb.json"
   node scripts/check-bkb-response.mjs "$env:TEMP\bkb.json"

   # Generate PDF
   Invoke-WebRequest -Uri "http://localhost:3000/api/brand-kit-builder/pdf" `
     -Method POST -ContentType "application/json" `
     -InFile "scripts\bkb-payload.json" -OutFile "$env:TEMP\bkb.pdf"
   node scripts/check-pdf.mjs "$env:TEMP\bkb.pdf"
   ```

3. **Manual smoke test checklist:**
   - See `docs/SMOKE_TEST_BRAND_KIT_BUILDER.md`

### Production Testing

1. **Verify routes exist:**
   - `/apps/brand-kit-builder`
   - `/api/brand-kit-builder`
   - `/api/brand-kit-builder/pdf`
   - `/api/brand-profile`

2. **Test authentication:**
   - Visit `/apps/brand-kit-builder` while logged out → redirects to `/login`

3. **Test generation:**
   - Fill form and generate brand kit
   - Verify all result cards render correctly
   - Test copy buttons and exports

4. **Test brand profile:**
   - Save brand profile
   - Refresh page → profile persists
   - Test cross-app auto-load (Review Responder, Social Post Creator)

5. **Test rate limiting:**
   - Generate 21 times rapidly → 429 error on 21st request

## Known Limitations

1. **PDF Export**: Uses standard fonts (Helvetica) only. Custom font embedding not implemented.

2. **Brand Profile**: One profile per user. Updating overwrites existing profile.

3. **Cross-App Auto-Load**: Only works in Review Responder and Social Media Post Creator. Other apps may be added in future releases.

4. **Bilingual Mode**: Returns structured JSON with separate language fields. UI rendering depends on frontend implementation.

5. **Rate Limiting**: Uses in-memory storage (serverless-friendly but resets on cold starts). Consider Redis for production-scale rate limiting.

## Support Notes

### Debugging with requestId

All API responses include a `requestId` field. Use this to trace requests in logs:

```
[Brand Kit Builder] Error: <message>
Request ID: bkb-1234567890-abc123
```

Search logs for the requestId to find:
- Full request/response details
- Error stack traces
- Validation failures
- Rate limit triggers

### Common Issues

1. **401 Unauthorized**: User not logged in. Check session cookie.

2. **429 Rate Limit**: Too many requests. Wait 15 minutes or increase limit if needed.

3. **400 Bad Request**: Invalid input. Check validation errors in response.

4. **500 Server Error**: Check logs for requestId. Common causes:
   - OpenAI API errors
   - JSON parsing failures (with repair attempt)
   - Database connection issues

### Environment Variables Required

See `docs/DEPLOY_CHECKLIST.md` for full list. Key variables:
- `DATABASE_URL` (PostgreSQL)
- `AUTH_SECRET` or `NEXTAUTH_SECRET`
- `AUTH_URL` or `NEXTAUTH_URL`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`

## Migration Guide

### For Existing Users

No action required. Brand Profile is opt-in:
- Users can generate brand kits without saving
- Saved profiles are automatically used in cross-app auto-load (if toggle ON)
- Toggle defaults to ON if profile exists (for backward compatibility)

### For Developers

1. **Database Migration:**
   ```bash
   pnpm prisma migrate deploy
   ```

2. **Environment Variables:**
   - No new variables required (uses existing OpenAI/Resend config)

3. **Code Changes:**
   - Frontend: Uses existing `ResultCard`, `OBDPanel`, `OBDHeading` components
   - Backend: New routes added, existing routes unchanged
   - Middleware: No changes (uses existing `/apps/:path*` protection)

## Performance Notes

- **Generation Time**: Typically 3-8 seconds (OpenAI API latency)
- **PDF Generation**: ~100-200ms (synchronous, in-memory)
- **Database Queries**: Minimal (single SELECT/INSERT/UPDATE per profile operation)
- **Rate Limiting**: In-memory (fast, but resets on cold starts)

## Future Enhancements (Not in This Release)

- Custom font uploads for PDF export
- Multiple brand profiles per user
- Brand kit versioning/history
- Template library for common industries
- Bulk export (multiple formats in one ZIP)
- API webhooks for brand kit updates

## Rollback Plan

See `docs/ROLLBACK_PLAN_BRAND_KIT_BUILDER.md` for detailed rollback procedures.

## Changelog

### v3.0.0 (Current)
- Initial V3 release
- Brand profile persistence
- Cross-app auto-load
- PDF export
- Server-side normalization
- Dev-mode testing improvements

### Previous Versions
- v2.x: Basic brand kit generation (pre-V3 architecture)
- v1.x: Initial implementation

## Contact & Support

- **Issues**: Check logs with requestId
- **Feature Requests**: See roadmap
- **Critical Bugs**: Follow rollback plan if needed

---

**Last Updated:** [Update after deployment]

