# OBD AI Help Desk (V3) Documentation

## Overview

The OBD AI Help Desk is a standalone, OBD-branded Help Desk application that provides:
1. **Search-first** functionality (business-specific results only)
2. **Chat-second** functionality (AnythingLLM-powered, scoped to the same business)
3. Fully controlled UI/UX inside OBD (colors, layout, components)
4. Safe and tenant-scoped operations (no cross-business leakage)

## V3 Scope

### In Scope

- Business knowledge base search
- AI-powered chat assistance
- Tenant-scoped workspace mapping (businessId → workspaceSlug)
- Search and chat UI with OBD V3 design system
- Server-side API proxy to AnythingLLM (no browser exposure of secrets)
- Sources tracking for assistant responses
- Responsive layout (split view on desktop, tabs on mobile)

### Out of Scope (V3)

- Content ingestion UI
- Website crawling
- CRM/booking integrations
- Memory across businesses
- Cross-business search/chat

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

## Security

### Tenant Isolation

- All requests require `businessId`
- Workspace slug is looked up server-side (never exposed to browser)
- Fallback workspace is user-specific (not global)
- No cross-business queries possible

### API Security

- Premium access required (via `requirePremiumAccess`)
- Rate limiting (via `checkRateLimit`)
- Validation via Zod schemas
- Error responses never leak stack traces or internal details

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

