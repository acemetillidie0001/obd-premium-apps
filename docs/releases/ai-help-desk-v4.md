# AI Help Desk V4 - Release Notes

**Release Date:** December 25, 2024  
**Version:** V4  
**Status:** Production Ready

---

## Overview

AI Help Desk V4 introduces comprehensive knowledge management, insights analytics, website import capabilities, and a public-facing chat widget. This release transforms the AI Help Desk from a search/chat tool into a complete knowledge management system that businesses can use to build, maintain, and share their help desk knowledge.

---

## New Features

### 1. Knowledge Manager

**Complete CRUD for Help Desk Knowledge**

Businesses can now manage their help desk knowledge directly within OBD:

- **Entry Types:** FAQ, Service, Policy, Note
- **Full CRUD Operations:** Create, read, update, delete entries
- **Tags System:** Add tags to entries for better organization
- **Active/Inactive Toggle:** Control which entries are visible in the help desk
- **Filtering:** Filter by type (FAQ, Service, Policy, Note, or All)
- **Search:** Search entries by title or content
- **Empty States:** Helpful messaging when no entries exist

**UI Components:**
- `KnowledgeList` - Displays entries with filtering and search
- `KnowledgeEditor` - Modal editor for creating/editing entries

**API Routes:**
- `GET /api/ai-help-desk/knowledge/list` - List entries with filtering
- `POST /api/ai-help-desk/knowledge/upsert` - Create or update entry
- `POST /api/ai-help-desk/knowledge/delete` - Delete entry

**Database:**
- `AiHelpDeskEntry` model with full CRUD support

---

### 2. Insights Dashboard

**Question Analytics and Knowledge Gap Identification**

Track questions asked and identify knowledge gaps:

- **Question Logging:** All chat questions are automatically logged
- **Top Questions:** See most frequently asked questions with counts
- **Knowledge Gaps:** Identify questions that couldn't be answered (no sources)
- **Response Quality:** Track GOOD (2+ sources), WEAK (1 source), NONE (0 sources)
- **Period Filtering:** View insights for last 7, 30, 60, or 90 days
- **Turn into FAQ:** One-click action to create FAQ from unanswered questions

**UI Components:**
- `InsightsPanel` - Displays stats, top questions, and knowledge gaps

**API Routes:**
- `GET /api/ai-help-desk/insights/summary` - Get insights summary

**Database:**
- `AiHelpDeskQuestionLog` model for question tracking

---

### 3. Website Import

**Safely Import Content from Your Website**

Import website content into your knowledge base:

- **Smart Crawling:** Crawls up to 10 pages from same domain
- **Preferred Pages:** Prioritizes /about, /services, /faq, /contact, /policies
- **Content Extraction:** Strips scripts/styles, extracts readable text
- **Type Suggestion:** Automatically suggests FAQ/SERVICE/POLICY/NOTE
- **Preview Before Import:** Review extracted content before importing
- **Batch Import:** Import multiple pages at once
- **Safety Features:** Same-domain only, timeout protection, max page limit

**UI Components:**
- `WebsiteImport` - Import panel with preview and selection

**API Routes:**
- `POST /api/ai-help-desk/import/preview` - Preview website content
- `POST /api/ai-help-desk/import/commit` - Import selected pages

**Dependencies:**
- `cheerio` - HTML parsing and content extraction

---

### 4. Website Chat Widget

**Embeddable AI Chat Widget for Your Website**

Provide AI-powered customer support directly on your website:

- **Embeddable Script:** Simple copy-paste embed code
- **Customizable Appearance:** Brand color, greeting message, position, assistant avatar
- **Assistant Avatar (Optional):** Set a profile image for the chat assistant (appears in bubble and chat UI)
- **Secure Authentication:** Widget key system prevents unauthorized access
- **Public API:** Widget endpoints don't require user authentication
- **Rate Limiting:** 50 requests per 15 minutes per businessId:IP
- **Key Rotation:** Rotate widget keys for security
- **Iframe Isolation:** Widget runs in secure iframe

**UI Components:**
- `WidgetSettings` - Admin panel for widget configuration
- Widget chat UI (customer-facing)

**API Routes:**
- `GET /widget/ai-help-desk.js` - Widget script endpoint
- `GET /widget/ai-help-desk` - Widget chat UI
- `POST /api/ai-help-desk/widget/chat` - Public chat endpoint
- `GET /api/ai-help-desk/widget/settings` - Get widget settings
- `POST /api/ai-help-desk/widget/settings` - Update widget settings
- `POST /api/ai-help-desk/widget/rotate-key` - Rotate widget key

**Database:**
- `AiHelpDeskWidgetKey` - Widget authentication keys
- `AiHelpDeskWidgetSettings` - Widget appearance settings

---

## Enhanced Features

### Help Desk (Search + Chat)

- **Question Logging:** All chat questions are now logged for insights
- **Response Quality Tracking:** Tracks whether responses had sources
- **Matched Entry IDs:** Tracks which knowledge entries were used

---

## Database Changes

### New Models

1. **AiHelpDeskEntry**
   ```prisma
   model AiHelpDeskEntry {
     id        String                @id @default(cuid())
     businessId String
     type      AiHelpDeskEntryType
     title     String
     content   String                @db.Text
     tags      String[]              @default([])
     isActive  Boolean               @default(true)
     createdAt DateTime              @default(now())
     updatedAt DateTime              @updatedAt
   }
   ```

2. **AiHelpDeskQuestionLog**
   ```prisma
   model AiHelpDeskQuestionLog {
     id              String                      @id @default(cuid())
     businessId      String
     question        String                      @db.Text
     hasSources      Boolean                     @default(false)
     sourcesCount    Int                         @default(0)
     responseQuality AiHelpDeskResponseQuality?
     matchedEntryIds String[]                    @default([])
     createdAt       DateTime                    @default(now())
   }
   ```

3. **AiHelpDeskWidgetKey**
   ```prisma
   model AiHelpDeskWidgetKey {
     id        String   @id @default(cuid())
     businessId String  @unique
     publicKey String
     createdAt DateTime @default(now())
     rotatedAt DateTime?
   }
   ```

4. **AiHelpDeskWidgetSettings**
   ```prisma
   model AiHelpDeskWidgetSettings {
     id                String   @id @default(cuid())
     businessId        String   @unique
     enabled            Boolean  @default(false)
     brandColor         String?  @default("#29c4a9")
     greeting           String?  @default("Hi! How can I help you today?")
     position           String?  @default("bottom-right")
     assistantAvatarUrl String?  // Optional avatar URL for chat assistant
     createdAt          DateTime @default(now())
     updatedAt          DateTime @updatedAt
   }
   ```

5. **AiHelpDeskSyncState** (Optional, for future AnythingLLM sync)
   ```prisma
   model AiHelpDeskSyncState {
     id              String   @id @default(cuid())
     businessId      String   @unique
     lastSyncedAt    DateTime?
     lastSyncStatus  String?
     lastSyncError   String?   @db.Text
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }
   ```

### New Enums

```prisma
enum AiHelpDeskEntryType {
  FAQ
  SERVICE
  POLICY
  NOTE
}

enum AiHelpDeskResponseQuality {
  GOOD
  WEAK
  NONE
}
```

---

## Environment Variables

### Required

```bash
# AnythingLLM Configuration
ANYTHINGLLM_BASE_URL=https://your-anythingllm-instance.com
ANYTHINGLLM_API_KEY=your-api-key-here  # Optional if instance doesn't require it
ANYTHINGLLM_TIMEOUT_MS=30000  # Optional, default: 30000

# Widget Configuration (Required for widget functionality)
NEXT_PUBLIC_BASE_URL=https://your-obd-instance.com  # Required for widget script generation
```

### Optional

```bash
# Admin Configuration
AI_HELP_DESK_ADMIN_EMAILS=admin@example.com,support@example.com  # Optional, for admin health panel
```

### Development Only (NOT USED IN PRODUCTION)

```bash
# Development Fallback (IGNORED IN PRODUCTION)
AI_HELP_DESK_DEV_WORKSPACE_SLUG=your-test-workspace  # Only works when NODE_ENV != "production"
```

**⚠️ IMPORTANT:** `AI_HELP_DESK_DEV_WORKSPACE_SLUG` is completely ignored in production. All businesses must have explicit mappings in the `AiWorkspaceMap` table.

---

## API Endpoints

### Knowledge Management

**List Entries**
```
GET /api/ai-help-desk/knowledge/list?businessId=...&type=FAQ&search=...&includeInactive=false
```

**Upsert Entry**
```
POST /api/ai-help-desk/knowledge/upsert
{
  "id": "...",  // optional, for updates
  "businessId": "...",
  "type": "FAQ",
  "title": "...",
  "content": "...",
  "tags": ["tag1", "tag2"],
  "isActive": true
}
```

**Delete Entry**
```
POST /api/ai-help-desk/knowledge/delete
{
  "id": "...",
  "businessId": "..."
}
```

### Insights

**Get Summary**
```
GET /api/ai-help-desk/insights/summary?businessId=...&days=30&limit=20
```

### Website Import

**Preview**
```
POST /api/ai-help-desk/import/preview
{
  "businessId": "...",
  "url": "https://example.com"
}
```

**Commit**
```
POST /api/ai-help-desk/import/commit
{
  "businessId": "...",
  "items": [
    {
      "type": "FAQ",
      "title": "...",
      "content": "...",
      "tags": []
    }
  ]
}
```

### Widget

**Widget Script**
```
GET /widget/ai-help-desk.js?businessId=...&key=...
```

**Widget Chat UI**
```
GET /widget/ai-help-desk?businessId=...&key=...
```

**Widget Chat API**
```
POST /api/ai-help-desk/widget/chat
{
  "businessId": "...",
  "key": "...",
  "message": "...",
  "threadId": "..."  // optional
}
```

**Widget Settings**
```
GET /api/ai-help-desk/widget/settings?businessId=...
POST /api/ai-help-desk/widget/settings
{
  "businessId": "...",
  "enabled": true,
  "brandColor": "#29c4a9",
  "greeting": "Hi! How can I help you today?",
  "position": "bottom-right",
  "assistantAvatarUrl": "https://example.com/avatar.png"
}
```

**Rotate Widget Key**
```
POST /api/ai-help-desk/widget/rotate-key
{
  "businessId": "..."
}
```

---

## Setup Instructions

### 1. Database Migration

Run the Prisma migration to create new tables:

```bash
# Development
npx prisma db push

# Production
npx prisma migrate deploy
```

### 2. Environment Variables

Set required environment variables (see Environment Variables section above).

### 3. Create Business Mappings

For each business, create a mapping in the `AiWorkspaceMap` table:

```sql
INSERT INTO "AiWorkspaceMap" ("businessId", "workspaceSlug", "createdAt", "updatedAt")
VALUES ('my-business-id', 'my-workspace-slug', NOW(), NOW());
```

Or use the setup wizard at `/apps/ai-help-desk/setup`.

### 4. Enable Widget (Optional)

1. Navigate to AI Help Desk → Widget tab
2. Enable widget
3. Configure appearance (color, greeting, position)
4. Copy embed code
5. Paste into your website HTML

---

## Breaking Changes

None. V4 is fully backward compatible with V3.

---

## Migration Guide

### From V3 to V4

1. **Run Database Migration**
   ```bash
   npx prisma db push
   # or
   npx prisma migrate deploy
   ```

2. **No Code Changes Required**
   - All V3 functionality remains unchanged
   - New features are additive

3. **Optional: Set Widget Base URL**
   - Set `NEXT_PUBLIC_BASE_URL` if you plan to use the widget feature

---

## Known Limitations

1. **Widget Key Security:** Current implementation uses simple string comparison. For enhanced security, consider constant-time comparison in future versions.

2. **Assistant Avatar:** Currently supports URL-based avatars only. Image upload functionality may be added in future versions.

3. **Rate Limiting:** Uses in-memory storage. For multi-instance deployments, consider Redis-based rate limiting.

3. **Question Logging:** Async logging may occasionally fail silently. This doesn't affect chat functionality.

4. **Import Crawling:** Limited to 10 pages per import. Large sites may need multiple imports.

5. **Insights Performance:** For businesses with thousands of questions, consider database-level aggregation.

---

## Future Enhancements (V5 Ideas)

1. **AnythingLLM Sync:** Automatically sync knowledge entries to AnythingLLM workspaces
2. **Bulk Operations:** Bulk edit, bulk delete, bulk import
3. **Export:** Export knowledge base as JSON/CSV
4. **Analytics:** More detailed insights and analytics
5. **Widget Customization:** More appearance options (size, theme, etc.)
6. **Multi-language Support:** Support for multiple languages
7. **Voice Input:** Voice input for widget chat

---

## Production Verification

### Production Readiness Check

AI Help Desk V4 includes an automated production readiness verification system that checks:

1. **Environment Variables**: Verifies required and optional environment variables are set
2. **Database Tables**: Confirms all required database tables exist
3. **Plain-English Messages**: Provides clear explanations of what's missing and why it matters

### Using the Production Check

**API Endpoint (Admin Only):**
```
GET /api/ai-help-desk/diagnostics/production-check
```

Returns:
```json
{
  "ok": true,
  "data": {
    "env": {
      "ANYTHINGLLM_BASE_URL": "present" | "missing",
      "ANYTHINGLLM_API_KEY": "present" | "missing" | "not_required",
      "ANYTHINGLLM_TIMEOUT_MS": "present" | "missing",
      "AI_HELP_DESK_ADMIN_EMAILS": "present" | "missing",
      "NEXT_PUBLIC_BASE_URL": "present" | "missing"
    },
    "database": {
      "AiWorkspaceMap": "exists" | "missing",
      "AiHelpDeskEntry": "exists" | "missing",
      "AiHelpDeskSyncState": "exists" | "missing",
      "AiHelpDeskQuestionLog": "exists" | "missing",
      "AiHelpDeskWidgetKey": "exists" | "missing",
      "AiHelpDeskWidgetSettings": "exists" | "missing"
    },
    "summary": {
      "ready": boolean,
      "blockingIssues": string[],
      "warnings": string[]
    }
  }
}
```

**UI Panel (Admin Only):**
- Available on `/apps/ai-help-desk/setup` page
- Automatically loads for admin users
- Shows green check for ready, yellow warnings for optional items, red errors for blocking issues
- Includes plain-English explanations like "This tells OBD where your AI engine lives"

### What "Ready" Means

**Production Ready** means:
- ✅ All required environment variables are set (`ANYTHINGLLM_BASE_URL`)
- ✅ All required database tables exist
- ⚠️ Optional items may be missing (these are warnings, not blockers)

**Not Production Ready** means:
- ❌ Missing required environment variables
- ❌ Missing required database tables
- These must be fixed before deployment

### Blocking Issues vs Warnings

**Blocking Issues:**
- Missing `ANYTHINGLLM_BASE_URL` - Required for AI Help Desk to function
- Missing required database tables - Required for data storage

**Warnings (Optional):**
- Missing `ANYTHINGLLM_API_KEY` - Only needed if your AnythingLLM instance requires authentication
- Missing `AI_HELP_DESK_ADMIN_EMAILS` - Only needed for admin panel access
- Missing `NEXT_PUBLIC_BASE_URL` - Only needed for widget feature
- Missing `ANYTHINGLLM_TIMEOUT_MS` - Has a default value (30000ms)
- Missing `AiHelpDeskSyncState` - Only needed for future sync features

## Support

For issues or questions:
1. Check the audit report: `docs/audits/ai-help-desk-v4-production-audit.md`
2. Use the production readiness check endpoint or UI panel
3. Review API error messages
4. Check server logs for errors
5. Verify environment variables are set correctly

---

**Release Date:** December 25, 2024  
**Version:** V4  
**Status:** Production Ready ✅

