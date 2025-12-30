# AI Help Desk V3 - Release Notes

**Release Date:** January 3, 2026  
**Version:** V3  
**Status:** ✅ Production Ready

---

## Overview

The AI Help Desk V3 is a standalone, OBD-branded Help Desk application that provides search-first, chat-second functionality for business knowledge bases. It integrates with AnythingLLM to deliver AI-powered answers scoped to individual businesses, ensuring tenant safety and data isolation.

---

## Key Features

### Search-First UX
- **Business-Specific Search:** Search your help desk knowledge base with instant results
- **Result Preview:** Click any result to see a full preview with "Use this in chat" action
- **Source Highlighting:** Matching query terms are highlighted in results and sources

### AI-Powered Chat
- **Contextual Answers:** Ask questions and get AI-powered responses based on your business knowledge base
- **Source Attribution:** Each answer includes sources used, with snippet previews
- **Conversation Threads:** Maintain context across multiple messages (thread-based)
- **Suggested Questions:** Pre-filled questions to help users get started

### Setup Wizard
- **Guided Configuration:** Step-by-step setup flow for non-technical users
- **Environment Check:** Automatically detects missing environment variables
- **Database Verification:** Confirms `AiWorkspaceMap` table exists with clear migration instructions
- **Workspace URL Helper:** Paste an AnythingLLM workspace URL to auto-extract the slug
- **Connection Testing:** Validate search and chat work before going live

### Tenant Safety
- **Business Isolation:** Each business is mapped to a unique AnythingLLM workspace
- **Strict Production Mode:** In production, mappings are required (no fallbacks)
- **Blocked Workspaces:** Prevents use of global/default workspace slugs (`default`, `global`, `main`, `public`)
- **Development Fallback:** Optional dev workspace for testing (development only)

### Connection Status
- **Real-Time Indicator:** Visual badge shows connection health (green/yellow/red)
- **Cached Tests:** Connection tests are cached for 5 minutes to avoid spam
- **Helpful Diagnostics:** Clear error messages with actionable next steps

### Admin Tools
- **Health Panel:** Admin-only panel showing workspace status, last successful operations, and source counts
- **Quick Links:** Direct links to AnythingLLM workspace and Setup Wizard
- **Collapsible UI:** Panel is collapsible by default to avoid clutter

### Responsive Design
- **Desktop:** Split view with Search on left, Chat on right
- **Mobile:** Tab-based toggle between Search and Chat views
- **Adaptive Layout:** UI adapts smoothly to different screen sizes

---

## Technical Implementation

### Architecture
- **Frontend:** Next.js App Router with React Server Components
- **API Routes:** Server-side proxy to AnythingLLM (no browser exposure of secrets)
- **Database:** Prisma ORM with `AiWorkspaceMap` model for business-to-workspace mappings
- **Error Handling:** Standardized API responses with consistent error codes
- **Caching:** Endpoint resolution caching and connection test caching

### Security
- **Premium Access:** All routes require premium access (via `requirePremiumAccess`)
- **Rate Limiting:** API routes are rate-limited to prevent abuse
- **Input Validation:** Zod schemas validate all inputs
- **Error Sanitization:** No stack traces or secrets leak to clients
- **Tenant Isolation:** Strict workspace mapping ensures no cross-business data leakage

### AnythingLLM Integration
- **Endpoint Probing:** Automatically detects correct endpoint patterns for different AnythingLLM versions
- **Response Normalization:** Handles various response shapes from AnythingLLM
- **Timeout Handling:** Respects `ANYTHINGLLM_TIMEOUT_MS` with graceful fallbacks
- **Retry Logic:** Retries network failures once (not 4xx errors)
- **Diagnostics:** Clear error messages with `triedEndpoints` and `baseUrl` for debugging

---

## Environment Variables

### Required
- `ANYTHINGLLM_BASE_URL` - Base URL of your AnythingLLM instance (e.g., `https://anythingllm.example.com`)

### Optional
- `ANYTHINGLLM_API_KEY` - API key if your AnythingLLM instance requires authentication
- `ANYTHINGLLM_TIMEOUT_MS` - Request timeout in milliseconds (default: 30000)
- `AI_HELP_DESK_DEV_WORKSPACE_SLUG` - Development-only workspace slug for testing without database mappings
- `AI_HELP_DESK_ADMIN_EMAILS` - Comma-separated list of emails for admin panel access (fallback if role-based auth not available)

---

## Database Migration

Create the `AiWorkspaceMap` table:

```bash
npx prisma migrate dev --name add-ai-workspace-map
```

Or manually add to `prisma/schema.prisma`:

```prisma
model AiWorkspaceMap {
  id            String   @id @default(cuid())
  businessId    String   @unique
  workspaceSlug String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([businessId])
  @@index([workspaceSlug])
}
```

---

## Setup Instructions

1. **Configure Environment Variables:**
   - Set `ANYTHINGLLM_BASE_URL` in your `.env.local` (local) or production environment
   - Optionally set `ANYTHINGLLM_API_KEY` if required

2. **Run Database Migration:**
   - Run the Prisma migration to create the `AiWorkspaceMap` table

3. **Create Workspace Mapping:**
   - Navigate to `/apps/ai-help-desk/setup`
   - Enter a business ID and workspace slug (or paste the AnythingLLM workspace URL)
   - Click "Save Mapping"
   - Click "Test Connection" to verify it works

4. **Start Using:**
   - Navigate to `/apps/ai-help-desk`
   - Enter a business name
   - Start searching or chatting!

---

## Files Added/Modified

### New Files
- `src/app/apps/ai-help-desk/page.tsx` - Main UI page
- `src/app/apps/ai-help-desk/setup/page.tsx` - Setup wizard page
- `src/app/api/ai-help-desk/search/route.ts` - Search API endpoint
- `src/app/api/ai-help-desk/chat/route.ts` - Chat API endpoint
- `src/app/api/ai-help-desk/setup/status/route.ts` - Setup status endpoint
- `src/app/api/ai-help-desk/setup/mapping/route.ts` - Mapping management endpoint
- `src/app/api/ai-help-desk/setup/test/route.ts` - Connection test endpoint
- `src/app/api/ai-help-desk/setup/admin/route.ts` - Admin check endpoint
- `src/lib/integrations/anythingllm/client.ts` - AnythingLLM API client
- `src/lib/integrations/anythingllm/scoping.ts` - Business scoping utilities
- `src/lib/apps/ai-help-desk/types.ts` - TypeScript type definitions
- `docs/apps/ai-help-desk-v3.md` - Application documentation

### Modified Files
- `prisma/schema.prisma` - Added `AiWorkspaceMap` model
- `src/lib/api/errorHandler.ts` - Added error codes: `BUSINESS_REQUIRED`, `MAPPING_REQUIRED`, `TENANT_SAFETY_BLOCKED`, `UPSTREAM_NOT_FOUND`
- `src/lib/obd-framework/apps.config.ts` - Added AI Help Desk app entry (removed legacy "OBD AI Chatbot")
- `src/lib/obd-framework/app-previews.ts` - Removed legacy "obd-chatbot" preview text

---

## Breaking Changes

None. This is a new application with no existing functionality to break.

---

## Known Limitations

1. **Content Ingestion:** V3 does not include UI for adding content to workspaces (use AnythingLLM directly)
2. **Conversation History:** Chat threads are not persisted across page refreshes
3. **Multi-Business:** App assumes one business per session (no switching)
4. **Search Type:** Search is submit-based, not real-time (no debouncing)

---

## Future Enhancements (V4 Ideas)

- Content ingestion UI (document upload, FAQ editor)
- Website crawling and content sync
- CRM/booking integrations
- Conversation history persistence
- Saved searches
- Analytics dashboard
- Multi-language support
- Voice input/output

---

## Support

For issues or questions:
1. Check the documentation: `docs/apps/ai-help-desk-v3.md`
2. Review API error messages (they include helpful diagnostics)
3. Check server logs for AnythingLLM errors
4. Verify environment variables are set correctly
5. Use the Setup Wizard to verify configuration

---

## Audit Status

✅ **Production Ready** - All critical functionality verified, security measures in place, tenant safety enforced. See `docs/audits/ai-help-desk-v3-production-audit.md` for full audit report.

