# OBD AI Help Desk (V3) Documentation

## Status Banner

- **Status**: LOCKED (maintenance-mode safe)
- **Last verified**: `main @ b2fd2470438ef897538c397fde791199a899088c`
- **One-liner**: Business-scoped Search + Chat powered only by your saved knowledge. No automation.

## Overview

OBD AI Help Desk provides a workspace-mapped, tenant-scoped search + Q&A experience powered by AnythingLLM.

## Trust & Safety (User-facing microcopy)

- **Draft-only / no automation**: The app and the widget both include an explicit trust line: answers are generated only from the business’s saved knowledge, and nothing is published or sent automatically.

## Knowledge status indicator (Empty / Partial / Ready)

The UI shows a deterministic **Knowledge status** chip derived from existing connection-test data:

- **Empty**: \(docsCount = 0\) AND system prompt is empty (or no business/workspace context yet)
- **Ready**: \(docsCount > 0\) AND system prompt is non-empty
- **Partial**: all other combinations (e.g., docs exist but prompt is empty; prompt exists but docs are 0)

This indicator is **read-only** and does not mutate data.

## Next Steps panel (link-only)

- The **Next Steps** panel is **link-only** navigation to other OBD apps (no payload transfer).
- Dismissal is **session-only** using `sessionStorage` with a TTL envelope (so the panel can reappear later without “persistent nagging”).

## What this app IS

- **Workspace-mapped, tenant-scoped knowledge + Q&A**: every request is scoped by `businessId → workspaceSlug` mapping.
- **User-controlled ingestion**: content is added explicitly (documents/uploads in AnythingLLM, in-app website import / curated entries).
- **Deterministic UI**: explicit actions only; no background mutations and no silent overwrites of user-edited drafts.

## What this app is NOT

- Not a live website sync/crawler
- Not an auto-publisher
- Not a background job / scheduler / automation system
- Not cross-tenant knowledge
- Not web-browsing / not live internet answers
- Not pushing updates to Google/Meta/etc.

## V3 Scope

### In Scope

- Business knowledge base search
- AI-powered chat assistance
- Tenant-scoped workspace mapping (businessId → workspaceSlug)
- Search and chat UI with OBD V3 design system
- Server-side API proxy to AnythingLLM (no browser exposure of secrets)
- Sources tracking for assistant responses
- Responsive layout (split view on desktop, tabs on mobile)
- In-app knowledge management (curated entries + website import)
- Guided first-run value discovery (empty knowledge guidance)

### Out of Scope (V3)

- Live website crawling/sync (automatic)
- Any automation/scheduler/background sync
- Cross-business (cross-tenant) search/chat
- “Web browsing” claims or live internet answers

## Architecture

### Components

1. **UI Page**: `src/app/apps/ai-help-desk/page.tsx`
   - Business name input (converted to businessId)
   - Search panel with results list
   - Chat panel with thread-style messages
   - Responsive: split view (desktop) or tabs (mobile)

2. **API Routes**:
   - `src/app/api/ai-help-desk/search/route.ts` - Search endpoint
   - `src/app/api/ai-help-desk/chat/route.ts` - Chat endpoint

3. **AnythingLLM Integration**:
   - `src/lib/integrations/anythingllm/client.ts` - API client
   - `src/lib/integrations/anythingllm/scoping.ts` - Business scoping utilities

4. **Types**: `src/lib/apps/ai-help-desk/types.ts`

5. **Database**: Prisma schema includes `AiWorkspaceMap` model

## Tenant Scoping (Business Safety)

### Workspace Mapping

Each business is mapped to an AnythingLLM workspace to ensure:
- No cross-business data leakage
- Isolated knowledge bases
- Safe multi-tenant operation

### Mapping Model

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

### Scoping Logic

1. **Lookup**: When a request comes in with `businessId`, we look up the `workspaceSlug` from the `AiWorkspaceMap` table.
2. **Production**: In production (`NODE_ENV=production`), missing mappings cause an error. All businesses must have explicit mappings.
3. **Development Fallback**: In development, if no mapping exists:
   - Uses `AI_HELP_DESK_DEV_WORKSPACE_SLUG` if set
   - Otherwise throws a helpful error message guiding the developer to set it or create a mapping
4. **Never Default**: We never query a global workspace by default. All workspaces must be explicitly configured.

### Mapping a Business to a Workspace

For V3, mappings can be created manually via database insert, or using the `getOrCreateWorkspaceMapping` utility:

```typescript
import { getOrCreateWorkspaceMapping } from "@/lib/integrations/anythingllm/scoping";

const workspaceSlug = await getOrCreateWorkspaceMapping(
  businessId,
  optionalWorkspaceSlug // If not provided, will be generated
);
```

## Environment Variables

Required environment variables:

```bash
# AnythingLLM Base URL (required)
ANYTHINGLLM_BASE_URL=https://anythingllm-production-143e.up.railway.app

# AnythingLLM API Key (optional, if your instance requires it)
ANYTHINGLLM_API_KEY=your-api-key-here

# Request timeout in milliseconds (optional, default: 30000)
ANYTHINGLLM_TIMEOUT_MS=30000
```

### Development-Only Variables

For local development and testing without database mappings:

```bash
# Development workspace slug (DEV-ONLY, optional)
# Allows testing without creating mapping rows in the database
# Only works when NODE_ENV is not "production"
AI_HELP_DESK_DEV_WORKSPACE_SLUG=your-test-workspace-slug

# Admin email allowlist (optional, fallback for admin panel visibility)
# Comma-separated list of emails that should have access to the Admin Health Panel
# If not set, only users with role="admin" will see the panel
AI_HELP_DESK_ADMIN_EMAILS=admin@example.com,support@example.com
```

**Important Notes:**
- This variable is **ignored in production** (`NODE_ENV=production`)
- In production, all businesses **must** have a mapping in the `AiWorkspaceMap` table
- If not set in development and no mapping exists, the system will show a clear error message
- This is useful for quick testing during development without needing to run migrations or create database records

## API Endpoints

### Search

**POST** `/api/ai-help-desk/search`

Request body:
```json
{
  "businessId": "string",
  "query": "string",
  "limit": 10  // optional, default: 10, max: 50
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "results": [
      {
        "id": "string",
        "title": "string",
        "snippet": "string",
        "sourceType": "string",  // optional: FAQ, Policy, Service, Guide, etc.
        "score": 0.95  // optional
      }
    ]
  }
}
```

### Chat

**POST** `/api/ai-help-desk/chat`

Request body:
```json
{
  "businessId": "string",
  "message": "string",
  "threadId": "string"  // optional, for conversation continuity
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "threadId": "string",  // optional, use for subsequent messages
    "answer": "string",
    "sources": [  // optional
      {
        "id": "string",
        "title": "string",
        "snippet": "string"  // optional
      }
    ]
  }
}
```

### OBD CRM Integration

The AI Help Desk integrates with OBD CRM to automatically create or update contact records and log relevant activities when a help desk ticket is created. This integration is designed to be **best-effort and non-blocking**, meaning the core chat workflow will always succeed even if the CRM update fails.

**Trigger Event:**
- **When a help desk ticket is created**: The integration triggers on the first message sent via the widget chat endpoint (when `threadId` is missing, indicating a new conversation/ticket).

**CRM Behavior:**
- **Action**: `upsertContactFromExternalSource` is called to create or update the contact.
- **Source**: `"helpdesk"`
- **Tags**: `["Support", "Help Desk"]`
- **Note Format**: `"Help Desk ticket created: {title or short summary} (Ticket: {id})"` where:
  - Title/summary is the first 200 characters of the initial message (privacy-safe, does not store full message threads).
  - Ticket ID is the `threadId` generated by AnythingLLM (included if available).

**Skipping Logic:**
- If the customer's name is missing, OR both email and phone are missing, the CRM upsert is skipped gracefully (no error thrown).

**Error Handling:**
- CRM integration calls are wrapped in `try/catch` blocks. Any failures in CRM operations are logged (only in `development` environments) but do not prevent the chat request from completing successfully.

**Security:**
- All CRM operations are strictly scoped to the `businessId` from the widget request, ensuring no cross-business data writes.

**Optional Contact Fields:**
- The widget chat endpoint accepts optional `customerName`, `customerEmail`, and `customerPhone` fields for future extensibility. If these fields are not provided, the CRM integration will be skipped (gracefully, without errors).

## Usage

### Setting Up a Business Workspace

1. **Create Workspace in AnythingLLM**: 
   - Log into your AnythingLLM instance
   - Create a new workspace
   - Note the workspace slug (usually the workspace name in URL-friendly format)

2. **Create Mapping in Database**:
   ```sql
   INSERT INTO "AiWorkspaceMap" ("businessId", "workspaceSlug", "createdAt", "updatedAt")
   VALUES ('my-business-id', 'my-workspace-slug', NOW(), NOW());
   ```

   Or use the utility function:
   ```typescript
   await getOrCreateWorkspaceMapping('my-business-id', 'my-workspace-slug');
   ```

3. **Add Content to Workspace**:
   - Use the AnythingLLM interface to add documents, FAQs, policies, etc.
   - The workspace should contain all business-specific knowledge

### Using the UI

1. **Enter Business Name**: The UI converts this to a businessId automatically
2. **Search**: Type a query and click "Search" to find relevant content
3. **Chat**: Switch to Chat tab (or use split view on desktop) and ask questions
4. **View Sources**: Each assistant response shows the sources it used

### Testing

1. **Test Search**:
   - Enter a business name
   - Enter a search query
   - Verify results appear and are scoped to that business

2. **Test Chat**:
   - Enter a business name
   - Ask a question in chat
   - Verify response is relevant to the business
   - Check that sources are displayed

3. **Test Scoping**:
   - Use two different business names
   - Verify search/chat results differ between businesses
   - Verify no cross-business data leakage

## AnythingLLM Integration

### Client Implementation

The AnythingLLM client (`src/lib/integrations/anythingllm/client.ts`) is a thin wrapper that:

1. Handles authentication (API key if required)
2. Supports multiple endpoint patterns (for different AnythingLLM versions)
3. Normalizes responses from various possible shapes
4. Handles timeouts and errors gracefully

### Supported Endpoints

The client tries multiple endpoint patterns:
- `/api/v1/workspace/{slug}/search` (newer versions)
- `/api/workspace/{slug}/search` (older versions)
- `/workspace/{slug}/search` (legacy)

Same for chat endpoints.

### Response Normalization

The client normalizes responses from various AnythingLLM response shapes to a consistent format:

**Search Results**:
- Maps `id`, `title`, `snippet` from various possible field names
- Handles `sourceType` and `score` if available
- Provides fallbacks for missing fields

**Chat Responses**:
- Extracts `answer` from `answer`, `response`, or `text` fields
- Extracts `threadId` if present
- Normalizes `sources` array structure

## UI Features

### Search-First UX

- On page load: Empty state prompts user to search or ask a question
- Search input with placeholder: "Search your business help desk…"
- Results list with:
  - Title
  - Snippet (truncated)
  - Source type label (if available)
- Clicking a result shows full preview
- "Use this in chat" button to move content to chat

### Chat UX

- Thread-style conversation display
- User messages (right-aligned, teal background)
- Assistant messages (left-aligned, slate background)
- Sources displayed beneath each assistant message
- "New Conversation" button to start fresh
- Auto-scroll to latest message
- Loading indicators during requests

### Responsive Design

- **Desktop (lg+)**: Split view (Search left, Chat right)
- **Mobile**: Tab-based toggle between Search and Chat

### Error Handling

- Inline validation errors (business required, query required)
- API error messages displayed in error panels
- Graceful handling of no results / no sources

## Tier 5B — Guided Value Discovery

### First-run guidance panel (empty knowledge)

- Shows a **dismissible** panel when the connected workspace is “empty”:
  - **0 documents**, and/or
  - **system prompt is empty**
- Dismissal is stored in `sessionStorage`, **scoped per business + workspace** (`businessId` + `workspaceSlug`), so it does not bleed across tenants/workspaces (and it resets between browser sessions).

### “Test Connection” success copy (empty knowledge)

- The Setup “Test Connection” UI uses improved success copy when the workspace is reachable but has no documents and/or an empty system prompt (guides users to upload/import content first).

## Tier 5C — Ecosystem Awareness

### AI FAQ Generator → Help Desk handoff

- **Transport**: `sessionStorage` (one-time) envelope under key `obd:ai-help-desk:handoff:faq-generator`
- **TTL**: short-lived handoff (expires; receiver ignores stale payloads)
- **Tenant guard**: payload includes a `businessId` hint; receiver refuses mismatched tenants when a business context is available.
- **Receiver UI**: Help Desk shows an apply/dismiss banner; user explicitly chooses to import.
- **Deterministic import**:
  - Additive import only (no destructive replace)
  - Minimal de-dupe + “already imported” guard to prevent repeated imports
  - Imported items persist as normal knowledge entries and are not wiped by future regenerations

### Brand Kit → Help Desk system prompt draft (“Use Brand Kit voice”)

- **Source**: reads the tenant’s Brand Kit snapshot from Brand Profile `kitJson`
- **Generation**: generates a single “brand voice” system prompt string (draft)
- **Draft-only + editable**: user can edit freely; draft is stored locally and not auto-overwritten
- **Explicit apply**: user clicks Apply to write the prompt to AnythingLLM workspace `openAiPrompt`
- **No silent re-sync**: regeneration is explicit; user edits always win unless they click regenerate

## Integrations / Data Flow (high-level)

- **AnythingLLM connection & workspace mapping**
  - Mapping: `AiWorkspaceMap` (`businessId → workspaceSlug`)
  - Scoping logic: server-side lookup + tenant safety guardrails (blocks global/default workspace slugs)
- **Knowledge items (storage approach)**
  - Curated/in-app knowledge entries are stored tenant-scoped as `AiHelpDeskEntry` rows (Prisma).
  - Search/chat queries are executed against the mapped AnythingLLM workspace.
- **Handoff safety**
  - Short TTL + tenant guard
  - Apply-only receiver UI (no auto-import)
  - Additive import + dedupe/“already imported” guardrails

## Security

### Tenant Isolation

- All requests require `businessId`
- Workspace slug is looked up server-side (never exposed to browser)
- Fallback workspace is user-specific (not global)
- No cross-business queries possible
- Widget keys are business-specific

### API Security

- Premium access required (via `requirePremiumAccess`) for admin routes
- Rate limiting applied to widget endpoints
- Input validation via Zod schemas
- Error messages don't expose sensitive information
- SSRF protection for URL inputs (DNS rebinding, IP range blocking)

### SSRF Protection

**Applied To:** Website Import URL validation

**Protections:**
- DNS rebinding protection (resolves hostnames, validates all IPs)
- IP range blocking (private, loopback, link-local)
- Metadata endpoint blocking (`metadata.google.internal`, `metadata`)
- Edge case handling (`0.0.0.0`, `::`, IPv6 ULA/link-local)
- Rate limiting (via `checkRateLimit`)
- Validation via Zod schemas
- Error responses never leak stack traces or internal details

## Knowledge Manager

### Overview

The Knowledge Manager allows businesses to create, edit, and manage their help desk knowledge directly within OBD.

### Entry Types

- **FAQ:** Frequently asked questions
- **Service:** Service descriptions
- **Policy:** Business policies
- **Note:** General notes

### Features

- **CRUD Operations:** Create, read, update, delete entries
- **Tags:** Add tags to entries for organization
- **Active/Inactive Toggle:** Control visibility
- **Filtering:** Filter by type, search by title/content
- **Empty States:** Helpful messaging when no entries exist

### API Endpoints

**GET** `/api/ai-help-desk/knowledge/list?businessId={id}&type={type}&search={query}&includeInactive={bool}`
- Lists knowledge entries with filtering
- Requires premium access

**POST** `/api/ai-help-desk/knowledge/upsert`
- Creates or updates an entry
- Requires premium access
- Body: `{ businessId, id?, title, content, type, tags?, active? }`

**POST** `/api/ai-help-desk/knowledge/delete`
- Deletes an entry
- Requires premium access
- Validates ownership before deletion

## Insights Dashboard

### Overview

The Insights Dashboard provides analytics on questions asked and identifies knowledge gaps.

### Features

- **Copy-only subtitle:** The UI label “Customer Questions (Insights)” is purely a display label and does not change behavior.
- **Summary reads from existing data:** The summary endpoint reads from `AiHelpDeskQuestionLog` (if present/populated) to compute totals, top questions, and “knowledge gaps”.
- **Top Questions:** Identifies frequently asked questions (top 20)
- **Knowledge Gaps:** Highlights questions with no sources or low quality
- **Period Filtering:** 7/30/60/90 day periods

### API Endpoints

**GET** `/api/ai-help-desk/insights/summary?businessId={id}&period={days}`
- Returns analytics summary
- Requires premium access
- Response: `{ totalQuestions, topQuestions[], knowledgeGaps[] }`

## Website Import

### Overview

The Website Import feature allows businesses to import content from their websites into the knowledge base.

### Features

- **URL Input:** Enter website URL for crawling
- **Safety Limits:** Max 10 pages, same-domain only
- **Preferred Paths:** Prioritizes `/about`, `/services`, `/faq`, `/contact`, `/policies`
- **Content Preview:** Shows extracted title and text snippets
- **Manual Selection:** Choose which pages/sections to import
- **Heuristic Categorization:** Suggests FAQ, SERVICE, POLICY, or NOTE types
- **UX Enhancements:** Drag-and-drop URLs, recent URLs, autofill

### API Endpoints

**POST** `/api/ai-help-desk/import/preview`
- Crawls URL and extracts content
- Requires premium access
- Body: `{ businessId, url }`
- Response: `{ pages: [{ title, snippet, suggestedType, url }] }`

**POST** `/api/ai-help-desk/import/commit`
- Saves selected content as knowledge entries
- Requires premium access
- Body: `{ businessId, selections: [{ url, title, content, type }] }`

### Safety

- **SSRF Protection:** URL validation with DNS rebinding protection
- **Same-Domain Restriction:** Only crawls pages from same domain
- **Page Limit:** Maximum 10 pages per import
- **Timeout Protection:** 10 seconds per page

## V4 Ideas (Future Enhancements)

### Content Ingestion UI
- In-app document upload
- FAQ editor
- Content sync from website
- Bulk import from CSV/JSON

### Website Crawling
- Automatic website content discovery
- Scheduled re-crawls
- Content freshness indicators

### CRM/Booking Integrations
- Pull business info from CRM
- Sync booking policies
- Integrate with OBD business profiles

### Enhanced Features
- Conversation history persistence
- Saved searches
- Analytics dashboard
- Multi-language support
- Voice input/output

## Development Testing (Without Database Mappings)

For local development, you can test the AI Help Desk without creating database mappings by setting the `AI_HELP_DESK_DEV_WORKSPACE_SLUG` environment variable:

```bash
# .env.local
AI_HELP_DESK_DEV_WORKSPACE_SLUG=my-test-workspace
```

**How it works:**
- When a business ID doesn't have a mapping in the database, the system will use this dev workspace slug
- Only works when `NODE_ENV` is not `"production"`
- In production, this variable is ignored and mappings are required

**Important:**
- This is **development-only** functionality
- Production deployments **must** use proper database mappings
- The workspace slug must exist in your AnythingLLM instance

## Troubleshooting

### No Search Results

1. Verify workspace mapping exists in database (or set `AI_HELP_DESK_DEV_WORKSPACE_SLUG` in dev)
2. Check that workspace has content in AnythingLLM
3. Verify `ANYTHINGLLM_BASE_URL` is correct
4. Check browser console for API errors

### Chat Not Working

1. Verify workspace mapping exists (or set `AI_HELP_DESK_DEV_WORKSPACE_SLUG` in dev)
2. Check AnythingLLM instance is accessible
3. Verify API key if required
4. Check network tab for failed requests

### "Workspace mapping is required" Error (Production)

- In production, all businesses must have a mapping in the `AiWorkspaceMap` table
- Use the setup wizard (`/apps/ai-help-desk/setup`) to create mappings
- The `AI_HELP_DESK_DEV_WORKSPACE_SLUG` env var is ignored in production

### "Development fallback workspace is not configured" Error (Development)

- Set `AI_HELP_DESK_DEV_WORKSPACE_SLUG` in your `.env.local` file
- Or create a proper mapping in the database using the setup wizard

### Cross-Business Leakage

1. Verify workspace mapping is unique per business
2. Check that `businessId` is correctly passed in requests
3. Verify scoping logic in `scoping.ts` is working
4. Check AnythingLLM workspace isolation
5. In production, never rely on dev fallback (it's disabled)

## Support

For issues or questions:
1. Check this documentation
2. Review API error messages
3. Check server logs for AnythingLLM errors
4. Verify environment variables are set correctly

