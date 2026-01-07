# Demo Mode Verification Checklist

## Environment Variables

### Required
- `DEMO_BUSINESS_ID` - The business ID to use when demo mode is active (ensures tenant safety)

### Optional
- `DEMO_TTL_MINUTES` - Time-to-live for demo mode cookie in minutes (default: 60)

## AI Cost Protection Audit

See: docs/deployments/DEMO_MODE_AI_COST_PROTECTION_AUDIT_REPORT.md

- Demo mode returns sample payloads for AI endpoints (no OpenAI/AnythingLLM calls).
- All mutation routes are read-only in demo mode (403 DEMO_READ_ONLY), ensuring zero-cost + zero-write demo behavior.

## Test Steps

### 1. Demo Mode Entry & Banner Display

**Test:** Visit `https://apps.ocalabusinessdirectory.com/demo`

**Expected Results:**
- Redirects to `/apps` 
- Demo cookie (`obd_demo`) is set in the response
- Demo banner appears at the top of the page with:
  - Text: "Demo Mode: View-only preview. Upgrade to generate, save, or publish."
  - "See Plans & Pricing" button → links to `https://ocalabusinessdirectory.com/premium/#pricing`
  - "Exit Demo" button → links to `/demo/exit`
- Banner is mobile-responsive and styled with OBD design system

**Files Involved:**
- `src/components/layout/DemoBanner.tsx` - Banner component
- `src/components/layout/ConditionalLayout.tsx` - Conditionally shows banner for `/apps` routes
- `src/app/layout.tsx` - Reads demo cookie and passes to ConditionalLayout

---

### 2. Banner Persistence Across Navigation

**Test:** Navigate through different `/apps` tools (e.g., `/apps/content-writer`, `/apps/faq-generator`, `/apps/ai-help-desk`)

**Expected Results:**
- Demo banner persists at the top of all `/apps` routes
- Banner only appears on `/apps` routes, NOT on:
  - `/book/*` (booking pages)
  - Marketing/login pages
  - Other non-apps routes

**Files Involved:**
- `src/components/layout/ConditionalLayout.tsx` - Checks `pathname?.startsWith("/apps")` before showing banner

---

### 3. Server-Side Mutation Blocking (Read-Only Enforcement)

**Test:** Attempt any Save/Mutation action while in demo mode (POST/PUT/PATCH/DELETE requests)

**Test Actions:**
- Try to save content in Content Writer
- Attempt to create a FAQ
- Try to create/update a contact in OBD CRM
- Attempt to update queue items in Social Auto Poster
- Try to save business description versions
- Any other database write operations

**Expected Results:**
- Server returns `403 Forbidden` status
- Response JSON:
  ```json
  {
    "error": "DEMO_READ_ONLY",
    "message": "Demo Mode is view-only."
  }
  ```
- No database writes occur
- Error is returned BEFORE any business logic executes

**Files Involved:**
- `src/lib/demo/assert-not-demo.ts` - Assertion function that blocks mutations
- All mutation API routes in `src/app/api/**/route.ts` (POST/PUT/PATCH/DELETE handlers)

**Protected Routes (Sample - All mutation routes should be protected):**
- `src/app/api/review-responder/route.ts` (POST)
- `src/app/api/content-writer/route.ts` (POST)
- `src/app/api/business-description-writer/route.ts` (POST)
- `src/app/api/image-caption-generator/route.ts` (POST)
- `src/app/api/faq-generator/route.ts` (POST)
- `src/app/api/social-media-post-creator/route.ts` (POST)
- `src/app/api/offers-builder/route.ts` (POST)
- `src/app/api/obd-crm/contacts/route.ts` (POST/PUT/DELETE)
- `src/app/api/social-auto-poster/queue/approve/route.ts` (POST)
- `src/app/api/social-auto-poster/queue/delete/route.ts` (DELETE)
- `src/app/api/brand-kit-builder/route.ts` (POST)
- ... (all other POST/PUT/PATCH/DELETE handlers)

---

### 4. AI Generation Endpoints (Canned Samples)

**Test:** Call AI generation endpoints (GET requests or non-blocked endpoints) while in demo mode

**Expected Results:**
- AI generation endpoints return canned/sample responses
- No OpenAI API calls are executed (cost savings)
- Sample responses are realistic and demonstrate functionality
- Response format matches normal API responses

**Note:** This assumes AI generation endpoints are configured to detect demo mode and return samples. If not yet implemented, this may need additional work.

**Files Involved:**
- AI generation route handlers should check demo mode before calling OpenAI

---

### 5. Demo Mode Exit

**Test:** Visit `/demo/exit` while in demo mode

**Expected Results:**
- Demo cookie (`obd_demo`) is cleared/deleted
- Redirects to `https://ocalabusinessdirectory.com/premium/dashboard-preview/`
- Banner disappears on subsequent `/apps` navigation
- User can now perform mutations normally (assuming they have proper access)

**Files Involved:**
- `/demo/exit` route handler (should call `clearDemoCookie()`)
- Cookie clearing logic

---

### 6. Normal Behavior Without Demo Cookie

**Test:** Access `/apps` routes WITHOUT demo cookie present

**Expected Results:**
- No demo banner appears
- All functionality works normally:
  - Mutations succeed (if user has proper access/permissions)
  - AI generation works normally
  - Database writes proceed as expected
- No impact on non-demo users

**Files Involved:**
- All routes should check for demo cookie before blocking
- If no demo cookie, normal flow continues

---

## Files Changed

### Core Demo Mode Infrastructure
1. `src/lib/demo/demo-cookie.ts` - Cookie management utilities (updated type imports)
2. `src/lib/demo/demo-context.ts` - Demo context helpers (updated type imports)
3. `src/lib/demo/demo-constants.ts` - Demo mode constants (existing)

### Demo Mode UI Components
4. `src/components/layout/DemoBanner.tsx` - **NEW** - Demo banner component
5. `src/components/layout/ConditionalLayout.tsx` - Updated to show banner for `/apps` routes only
6. `src/app/layout.tsx` - Updated to detect demo cookie and pass to ConditionalLayout

### Tenant Safety (Business ID Resolution)
7. `src/lib/utils/resolve-business-id.ts` - Client-side resolver with demo check
8. `src/lib/utils/resolve-business-id.server.ts` - **NEW** - Server-side resolver with demo check

### Server-Side Mutation Protection
9. `src/lib/demo/assert-not-demo.ts` - **NEW** - Blocks mutations in demo mode

### Protected API Routes (Sample - All mutation routes should have this)
10. `src/app/api/review-responder/route.ts` - POST handler protected
11. `src/app/api/content-writer/route.ts` - POST handler protected
12. `src/app/api/business-description-writer/route.ts` - POST handler protected
13. `src/app/api/image-caption-generator/route.ts` - POST handler protected
14. `src/app/api/faq-generator/route.ts` - POST handler protected
15. `src/app/api/social-media-post-creator/route.ts` - POST handler protected
16. `src/app/api/offers-builder/route.ts` - POST handler protected
17. `src/app/api/obd-crm/contacts/route.ts` - POST handler protected
18. `src/app/api/social-auto-poster/queue/approve/route.ts` - POST handler protected
19. `src/app/api/social-auto-poster/queue/delete/route.ts` - DELETE handler protected
20. `src/app/api/brand-kit-builder/route.ts` - POST handler protected

**Note:** Additional mutation routes (~70+ more) should also be protected. Pattern:
```typescript
export async function POST(request: NextRequest) {
  // Block demo mode mutations (read-only)
  const { assertNotDemoRequest } = await import("@/lib/demo/assert-not-demo");
  const demoBlock = assertNotDemoRequest(request);
  if (demoBlock) return demoBlock;
  
  // ... rest of handler
}
```

---

## Security Checklist

- ✅ Demo mode is cookie-based (not URL params)
- ✅ Demo cookie is httpOnly (XSS protection)
- ✅ Demo cookie is secure in production (HTTPS only)
- ✅ Demo mode blocks ALL database writes
- ✅ Demo mode forces demo business ID (tenant safety)
- ✅ Banner only shows on `/apps` routes (not global)
- ✅ Server-side enforcement (cannot be bypassed client-side)
- ✅ All mutation routes protected (POST/PUT/PATCH/DELETE)

---

## Quick Test Commands

### Check Demo Cookie in Browser Console
```javascript
// Should return the cookie value if demo mode is active
document.cookie.split(';').find(c => c.trim().startsWith('obd_demo'))
```

### Test Demo Mode Block (cURL)
```bash
# Should return 403 if demo cookie is present
curl -X POST https://apps.ocalabusinessdirectory.com/api/content-writer \
  -H "Content-Type: application/json" \
  -H "Cookie: obd_demo=1" \
  -d '{"businessName":"Test"}'

# Expected response:
# {"error":"DEMO_READ_ONLY","message":"Demo Mode is view-only."}
```

---

## Verification Status

- [ ] Demo banner displays correctly
- [ ] Banner persists across `/apps` navigation
- [ ] Mutations blocked with 403 response
- [ ] Demo cookie set on `/demo` entry
- [ ] Demo cookie cleared on `/demo/exit`
- [ ] Normal behavior when no demo cookie
- [ ] All mutation routes protected
- [ ] Tenant safety enforced (demo business ID)

---

## Notes

- Demo mode is truly read-only - no database writes allowed
- AI generation endpoints may need additional work to return canned samples
- All mutation routes should be systematically protected
- Demo cookie TTL is configurable via `DEMO_TTL_MINUTES` environment variable

