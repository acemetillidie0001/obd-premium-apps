# Content Writer → AI Help Desk Handoff System Audit

**Date:** 2025-01-XX  
**Status:** Audit Complete - Ready for Implementation  
**Purpose:** Identify reusable handoff utilities and design payload format for Content Writer → Help Desk integration

---

## Executive Summary

The existing handoff system used by AI FAQ Generator → AI Help Desk is well-architected and fully reusable. All core utilities are shared and can be directly leveraged for Content Writer → Help Desk handoffs. The Knowledge Manager API and UI components are already in place and ready to receive content from Content Writer.

---

## 1. Reusable Handoff Utilities

### Core Utility Files

#### 1.1 `src/lib/utils/parse-handoff.ts`
**Purpose:** Unified handoff payload parsing with SSR safety

**Key Functions:**
- `parseHandoffFromUrl<T>(searchParams, validate): HandoffParseResult<T>`
  - Parses from `?handoff=` (base64url) or `?handoffId=` (localStorage)
  - Returns `{ payload: T; source: "query" | "storage" }` or `{ payload: null; error?: string }`
- `decodeBase64UrlToString(encoded: string): string`
  - Handles Unicode safely via TextEncoder/TextDecoder
- `readAndClearLocalStorageHandoff(handoffId: string): string | null`
  - One-time use: deletes localStorage key after reading
  - SSR-safe (returns null if window undefined)

**Status:** ✅ Fully reusable - no changes needed

---

#### 1.2 `src/lib/utils/handoff-guard.ts`
**Purpose:** Prevents accidental double-imports via hash-based tracking

**Key Functions:**
- `getHandoffHash(payload: unknown): string`
  - DJB2-style hash → base36 string
  - Deterministic: same payload = same hash
- `wasHandoffAlreadyImported(appKey: string, hash: string): boolean`
  - Checks sessionStorage: `obd_handoff_imported:${appKey}`
  - Returns true if hash already imported
- `markHandoffImported(appKey: string, hash: string): void`
  - Stores hash in sessionStorage array (max 25 entries)
  - Per-app tracking (separate keys per application)

**Storage Pattern:**
- Key: `obd_handoff_imported:${appKey}` (e.g., `obd_handoff_imported:ai-help-desk`)
- Value: JSON array of hash strings (max 25, oldest dropped)

**Status:** ✅ Fully reusable - no changes needed

---

#### 1.3 `src/lib/utils/clear-handoff-params.ts`
**Purpose:** Cleans handoff-related query parameters from URLs

**Key Functions:**
- `clearHandoffParamsFromUrl(url: string): string`
  - Removes `handoff` and `handoffId` params
  - Preserves all other query params and hash fragments
- `replaceUrlWithoutReload(cleanUrl: string): void`
  - Uses `window.history.replaceState()` (SSR-safe)

**Status:** ✅ Fully reusable - no changes needed

---

## 2. Handoff Payload Transport Methods

### Method 1: URL Query Parameter (Primary)
**Format:** `?handoff=<base64url-encoded-json>`

**Process:**
1. Sender creates JSON payload
2. Encodes as base64url string
3. Appends to target URL
4. Navigates to target URL
5. Receiver parses and validates

**Limitations:**
- URL length limits (~2000 characters total)
- Base64url encoding increases size by ~33%
- Practical limit: ~1500 characters for encoded payload

**Example:**
```
/apps/ai-help-desk?handoff=eyJzb3VyY2VBcHAiOiJhaS1mYXEtZ2VuZXJhdG9yIiwidHlwZSI6ImZhcS1zZWN0aW9uIn0
```

---

### Method 2: localStorage Fallback (Large Payloads)
**Format:** `?handoffId=<unique-id>`

**Process:**
1. Sender creates JSON payload
2. Generates unique ID: `handoff_${Date.now()}_${random}`
3. Stores in localStorage: `obd_handoff:${handoffId}`
4. Navigates with `?handoffId=${handoffId}`
5. Receiver reads from localStorage and deletes key (one-time use)

**Storage Key Pattern:**
```
obd_handoff:handoff_1234567890_abc123
```

**Cleanup:**
- Automatically deleted after successful read
- Prevents localStorage bloat
- One-time use only

**Example:**
```
/apps/ai-help-desk?handoffId=handoff_1234567890_abc123
```

---

### Automatic Method Selection

Senders automatically choose transport method:
- **URL param** if encoded payload ≤ 1500 characters
- **localStorage** if encoded payload > 1500 characters

**Implementation Location:**  
`src/components/faq/FAQExportCenterPanel.tsx` (lines 75-100)  
Contains `storeHandoffPayload()` function that implements this logic.

---

## 3. Existing Handoff Payload Formats

### 3.1 FAQ Generator → Help Desk

**Payload Type:** `HelpDeskHandoffPayload`  
**Definition:** `src/lib/apps/ai-help-desk/handoff-parser.ts`

```typescript
interface HelpDeskHandoffPayload {
  sourceApp: "ai-faq-generator";
  importedAt: string;              // ISO timestamp
  mode: "qa" | "doc";              // Import as Q&A pairs or single document
  title: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
  businessContext: {
    businessName: string;
    businessType: string;
    topic: string;
  };
}
```

**Validation:** Type guard `isValidHelpDeskHandoff()` ensures:
- `sourceApp === "ai-faq-generator"`
- `mode` is exactly `"qa"` or `"doc"`
- `items` is non-empty array
- Each item has non-empty `question` and `answer` (trimmed)

---

### 3.2 FAQ Generator → Content Writer

**Payload Type:** `ContentWriterHandoffPayload`  
**Definition:** `src/lib/apps/content-writer/handoff-parser.ts`

```typescript
interface ContentWriterHandoffPayload {
  sourceApp: "ai-faq-generator";
  type: "faq-section";
  title: string;
  markdown: string;                // FAQ section in markdown
  html: string;                     // FAQ section in HTML
  divi: string;                     // FAQ section for Divi builder
  context: {
    businessName: string;
    businessType: string;
    topic: string;
    services: string;
  };
}
```

**Validation:** Type guard `isValidContentWriterHandoff()` ensures:
- `sourceApp === "ai-faq-generator"`
- `type === "faq-section"`
- `markdown` is non-empty string

---

## 4. Duplicate Prevention & Tenant Safety

### 4.1 Duplicate Prevention (FAQ Generator Pattern)

**Location:** `src/app/apps/ai-help-desk/page.tsx` (lines 226-251)

**Process:**
1. Parse handoff payload from URL
2. Compute hash: `getHandoffHash(payload)`
3. Check if already imported: `wasHandoffAlreadyImported("ai-help-desk", hash)`
4. If already imported:
   - Set `isHandoffAlreadyImported = true`
   - Show warning in UI
   - Disable import button
5. If not imported:
   - Show import banner/modal
   - Allow user to confirm
   - On confirm: `markHandoffImported("ai-help-desk", hash)`

**Session Storage:**
- Key: `obd_handoff_imported:ai-help-desk`
- Value: JSON array of hash strings (max 25)
- Scope: Per browser session (cleared on tab close)

**Status:** ✅ Fully reusable pattern

---

### 4.2 Tenant Safety

**API Route:** `src/app/api/ai-help-desk/knowledge/upsert/route.ts`

**Validation:**
1. **BusinessId Required:** Request must include `businessId`
2. **Ownership Check (Updates):** If `id` provided, verifies entry belongs to same business:
   ```typescript
   if (existing.businessId !== trimmedBusinessId) {
     return apiErrorResponse("Entry does not belong to this business", "TENANT_SAFETY_BLOCKED", 403);
   }
   ```
3. **Premium Access:** All operations require `requirePremiumAccess()`
4. **Rate Limiting:** All operations check `checkRateLimit(request)`

**Status:** ✅ Tenant safety already enforced in API

---

## 5. Knowledge Manager Location & Implementation

### 5.1 API Route

**File:** `src/app/api/ai-help-desk/knowledge/upsert/route.ts`  
**Method:** `POST`  
**Endpoint:** `/api/ai-help-desk/knowledge/upsert`

**Request Schema:**
```typescript
{
  id?: string;                      // Optional: if provided, updates existing entry
  businessId: string;              // Required
  type: "FAQ" | "SERVICE" | "POLICY" | "NOTE";
  title: string;                   // Max 500 chars
  content: string;                  // Required, min 1 char
  tags?: string[];                 // Optional, defaults to []
  isActive?: boolean;               // Optional, defaults to true
}
```

**Response:**
```typescript
{
  ok: true,
  data: {
    id: string;
    businessId: string;
    type: string;
    title: string;
    content: string;
    tags: string[];
    isActive: boolean;
    createdAt: string;             // ISO timestamp
    updatedAt: string;              // ISO timestamp
  }
}
```

**Status:** ✅ Ready to receive Content Writer entries

---

### 5.2 UI Components

#### Knowledge List (Main View)
**File:** `src/app/apps/ai-help-desk/knowledge/components/KnowledgeList.tsx`

**Features:**
- Lists all knowledge entries for selected business
- Filter by type (FAQ, SERVICE, POLICY, NOTE, ALL)
- Search by title/content
- Toggle active/inactive
- Edit/Delete actions
- Displays tags, creation date, status

**Status:** ✅ Already displays imported entries

---

#### Knowledge Editor
**File:** `src/app/apps/ai-help-desk/knowledge/components/KnowledgeEditor.tsx`

**Features:**
- Create new entries
- Edit existing entries
- Supports all entry types (FAQ, SERVICE, POLICY, NOTE)
- Form validation
- Calls `/api/ai-help-desk/knowledge/upsert`

**Status:** ✅ Ready for manual entry creation

---

#### FAQ Import Modal (Handoff Receiver)
**File:** `src/app/apps/ai-help-desk/knowledge/components/FAQImportModal.tsx`

**Features:**
- Receives `HelpDeskHandoffPayload`
- Shows preview of FAQs to import
- Two import modes:
  - **Q&A Pairs:** Creates separate entry per FAQ
  - **Document:** Creates single document with all FAQs
- Calls `/api/ai-help-desk/knowledge/upsert` for each entry
- Adds metadata tags: `["AI FAQ Generator", "importedAt:${timestamp}", "topic:${topic}", "business:${businessName}"]`

**Status:** ✅ Pattern ready to replicate for Content Writer

---

#### FAQ Import Banner (Handoff Notification)
**File:** `src/app/apps/ai-help-desk/knowledge/components/FAQImportBanner.tsx`

**Features:**
- Shows when handoff payload detected
- Displays FAQ count
- "Review & Import" button opens modal
- "Dismiss" button hides banner
- Shows "already imported" warning if duplicate

**Status:** ✅ Pattern ready to replicate for Content Writer

---

### 5.3 Receiver Implementation Location

**Main Page:** `src/app/apps/ai-help-desk/page.tsx`

**Handoff Detection (lines 226-251):**
```typescript
useEffect(() => {
  if (searchParams && typeof window !== "undefined") {
    try {
      const payload = parseHandoffPayload(searchParams);
      if (payload && payload.sourceApp === "ai-faq-generator") {
        const hash = getHandoffHash(payload);
        setHandoffHash(hash);
        const alreadyImported = wasHandoffAlreadyImported("ai-help-desk", hash);
        setIsHandoffAlreadyImported(alreadyImported);
        setHandoffPayload(payload);
        setShowImportBanner(true);
        setTabMode("knowledge");  // Switch to knowledge tab
      }
    } catch (error) {
      console.error("Failed to parse handoff payload:", error);
    }
  }
}, [searchParams]);
```

**Status:** ✅ Pattern ready to extend for Content Writer payloads

---

## 6. Recommended Handoff Payload for Content Writer → Help Desk

### 6.1 Payload Structure

```typescript
interface ContentWriterToHelpDeskHandoffPayload {
  sourceApp: "ai-content-writer";
  importedAt: string;              // ISO timestamp
  mode: "content" | "faq-only";   // Import full content or FAQs only
  title: string;                   // Content title or "FAQ Section: {topic}"
  content?: {                      // Optional: full content (if mode === "content")
    title: string;
    sections: Array<{
      heading: string;
      body: string;
    }>;
    metaDescription?: string;
    socialBlurb?: string;
  };
  faqs?: Array<{                   // Optional: FAQs (if mode === "faq-only" or content includes FAQs)
    question: string;
    answer: string;
  }>;
  businessContext: {
    businessName: string;
    businessType: string;
    topic: string;
    services?: string;
  };
}
```

### 6.2 Validation Rules

**Type Guard:** `isValidContentWriterToHelpDeskHandoff()`

**Requirements:**
- `sourceApp === "ai-content-writer"`
- `mode` is exactly `"content"` or `"faq-only"`
- If `mode === "content"`: `content` must be present and valid
- If `mode === "faq-only"`: `faqs` must be present, non-empty array
- Each FAQ item must have non-empty `question` and `answer` (trimmed)
- `title` must be non-empty string

---

### 6.3 Import Behavior

#### Mode: "content"
- Creates single knowledge entry of type `"NOTE"` or `"SERVICE"`
- Title: Content title
- Content: Formatted sections (markdown or plain text)
- Tags: `["AI Content Writer", "importedAt:${timestamp}", "topic:${topic}", "business:${businessName}"]`

#### Mode: "faq-only"
- Creates individual FAQ entries (same as FAQ Generator Q&A mode)
- Each FAQ becomes separate entry of type `"FAQ"`
- Tags: `["AI Content Writer", "importedAt:${timestamp}", "topic:${topic}", "business:${businessName}"]`

#### Mode: "content" with FAQs included
- Creates one content entry (type `"NOTE"` or `"SERVICE"`)
- Optionally creates separate FAQ entries if `faqs` array provided
- User can choose: "Import as document" or "Import as document + FAQs"

---

## 7. Implementation Plan

### 7.1 Files to Create/Modify

#### New Files:
1. **`src/lib/apps/ai-help-desk/content-writer-handoff-parser.ts`**
   - Type definition: `ContentWriterToHelpDeskHandoffPayload`
   - Type guard: `isValidContentWriterToHelpDeskHandoff()`
   - Parser: `parseContentWriterHandoffPayload()`

2. **`src/app/apps/ai-help-desk/knowledge/components/ContentWriterImportModal.tsx`**
   - Similar to `FAQImportModal.tsx`
   - Handles content vs FAQ-only modes
   - Shows preview of content/FAQs
   - Calls `/api/ai-help-desk/knowledge/upsert`

3. **`src/app/apps/ai-help-desk/knowledge/components/ContentWriterImportBanner.tsx`**
   - Similar to `FAQImportBanner.tsx`
   - Shows "Content received from AI Content Writer"
   - "Review & Import" button

#### Files to Modify:
1. **`src/app/apps/ai-help-desk/page.tsx`**
   - Add handoff detection for `sourceApp === "ai-content-writer"`
   - Add state: `contentWriterHandoffPayload`, `showContentWriterImportBanner`
   - Extend `useEffect` (lines 226-251) to handle Content Writer payloads

2. **`src/app/apps/content-writer/page.tsx`** (or export component)
   - Add "Send to AI Help Desk" button in export center
   - Implement `storeHandoffPayload()` (reuse from FAQ Generator pattern)
   - Create payload with content/FAQs based on user selection

---

### 7.2 Implementation Steps

1. **Create Handoff Parser**
   - Copy pattern from `src/lib/apps/ai-help-desk/handoff-parser.ts`
   - Define `ContentWriterToHelpDeskHandoffPayload` interface
   - Implement type guard and parser function

2. **Create Import Modal Component**
   - Copy `FAQImportModal.tsx` as template
   - Adapt for content vs FAQ-only modes
   - Handle content formatting (sections → markdown/plain text)

3. **Create Import Banner Component**
   - Copy `FAQImportBanner.tsx` as template
   - Update text for Content Writer context

4. **Update Help Desk Page**
   - Add handoff detection for Content Writer payloads
   - Add state management for Content Writer imports
   - Render import banner when payload detected
   - Switch to knowledge tab automatically

5. **Update Content Writer Export Center**
   - Add "Send to AI Help Desk" button
   - Implement payload creation
   - Reuse `storeHandoffPayload()` pattern from FAQ Generator

6. **Test Integration**
   - Test URL param handoff (small payloads)
   - Test localStorage handoff (large payloads)
   - Test duplicate prevention
   - Test tenant safety (businessId validation)
   - Test both import modes (content vs FAQ-only)

---

## 8. Key Findings Summary

### ✅ Reusable Components
- All three core utilities (`parse-handoff`, `handoff-guard`, `clear-handoff-params`) are fully reusable
- Knowledge Manager API (`/api/ai-help-desk/knowledge/upsert`) is ready
- UI components (KnowledgeList, KnowledgeEditor) are ready
- Receiver pattern in Help Desk page is well-structured and extensible

### ✅ Existing Patterns
- FAQ Generator → Help Desk handoff is production-ready
- Duplicate prevention via hash-based sessionStorage tracking
- Tenant safety enforced in API layer
- Automatic transport method selection (URL vs localStorage)

### 📋 Implementation Requirements
- Create Content Writer handoff parser (new file)
- Create Content Writer import modal (new component)
- Create Content Writer import banner (new component)
- Extend Help Desk page handoff detection (modify existing)
- Add export button in Content Writer (modify existing)

### 🎯 Recommended Payload Format
- `sourceApp: "ai-content-writer"`
- `mode: "content" | "faq-only"`
- Support both full content and FAQ-only imports
- Include business context (name, type, topic, services)
- Add metadata tags for tracking origin

---

## 9. File Path Reference

### Core Utilities
- `src/lib/utils/parse-handoff.ts`
- `src/lib/utils/handoff-guard.ts`
- `src/lib/utils/clear-handoff-params.ts`

### Existing Handoff Parsers
- `src/lib/apps/ai-help-desk/handoff-parser.ts` (FAQ Generator → Help Desk)
- `src/lib/apps/content-writer/handoff-parser.ts` (FAQ Generator → Content Writer)

### Help Desk Components
- `src/app/apps/ai-help-desk/page.tsx` (main page, handoff receiver)
- `src/app/apps/ai-help-desk/knowledge/components/KnowledgeList.tsx`
- `src/app/apps/ai-help-desk/knowledge/components/KnowledgeEditor.tsx`
- `src/app/apps/ai-help-desk/knowledge/components/FAQImportModal.tsx`
- `src/app/apps/ai-help-desk/knowledge/components/FAQImportBanner.tsx`

### Help Desk API
- `src/app/api/ai-help-desk/knowledge/upsert/route.ts`

### FAQ Generator Handoff Sender
- `src/components/faq/FAQExportCenterPanel.tsx` (contains `storeHandoffPayload()`)

### Content Writer Components
- `src/app/apps/content-writer/page.tsx` (will add export button)
- `src/app/apps/content-writer/components/FAQImportBanner.tsx` (receives from FAQ Generator)

---

## 10. Next Steps

1. ✅ **Audit Complete** - All reusable utilities identified
2. ⏳ **Create Handoff Parser** - Define payload format and validation
3. ⏳ **Create Import Components** - Modal and banner for Content Writer
4. ⏳ **Extend Help Desk Page** - Add handoff detection and state management
5. ⏳ **Add Export Button** - Content Writer → Help Desk handoff sender
6. ⏳ **Test Integration** - Full end-to-end testing

---

**End of Audit Report**

