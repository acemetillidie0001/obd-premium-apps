# Cross-App Handoff System Architecture

**Status:** ✅ Production Ready (STABLE / LIVE)

**Last Updated:** 2025-01-XX

## Overview

The OBD handoff system enables seamless data transfer between Premium Apps without tight coupling. Apps can send structured payloads to other apps via URL parameters or localStorage, with automatic duplicate prevention and URL cleanup.

## Core Principles

1. **Stateless**: Handoffs are one-way data transfers, not persistent connections
2. **Additive**: Receivers never overwrite existing data, only add to it
3. **Tenant-Safe**: All operations respect business isolation boundaries
4. **Reversible**: Users can cancel or undo handoff operations
5. **No Coupling**: Apps remain independent; handoffs are optional enhancements

## Handoff Payload Transport

### Method 1: URL Query Parameter (Primary)

**Format:** `?handoff=<base64url-encoded-json>`

**Process:**
1. Sender creates JSON payload
2. Encodes payload as base64url string
3. Appends to target URL as query parameter
4. Navigates to target URL
5. Receiver parses and validates payload

**Limitations:**
- URL length limits (~2000 characters total)
- Base64url encoding increases size by ~33%
- Practical limit: ~1500 characters for encoded payload

**Example:**
```
/apps/content-writer?handoff=eyJzb3VyY2VBcHAiOiJhaS1mYXEtZ2VuZXJhdG9yIiwidHlwZSI6ImZhcS1zZWN0aW9uIn0
```

### Method 2: localStorage Fallback (Large Payloads)

**Format:** `?handoffId=<unique-id>`

**Process:**
1. Sender creates JSON payload
2. Generates unique handoff ID: `handoff_${Date.now()}_${random}`
3. Stores payload in localStorage: `obd_handoff:${handoffId}`
4. Appends handoffId to target URL
5. Navigates to target URL
6. Receiver reads from localStorage and deletes key (one-time use)

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
/apps/content-writer?handoffId=handoff_1234567890_abc123
```

### Automatic Method Selection

Senders automatically choose the transport method:
- **URL param** if encoded payload ≤ 1500 characters
- **localStorage** if encoded payload > 1500 characters

## Shared Utilities

### 1. parse-handoff.ts

**Location:** `src/lib/utils/parse-handoff.ts`

**Purpose:** Unified handoff payload parsing with SSR safety

**Key Functions:**

#### `parseHandoffFromUrl<T>(searchParams, validate): HandoffParseResult<T>`

Parses handoff payload from URL query parameters or localStorage.

**Parameters:**
- `searchParams`: URLSearchParams from current page
- `validate`: Type guard function to validate parsed payload

**Returns:**
```typescript
type HandoffParseResult<T> =
  | { payload: T; source: "query" | "storage"; raw?: string }
  | { payload: null; error?: string };
```

**Process:**
1. Checks for `?handoff=` parameter first
2. Falls back to `?handoffId=` if no direct payload
3. Decodes base64url or reads from localStorage
4. Validates payload with type guard
5. Returns parsed payload or error

**SSR Safety:**
- Returns `null` if `window` is undefined (server-side)
- Graceful degradation on server

#### `decodeBase64UrlToString(encoded: string): string`

Decodes base64url string to UTF-8 with proper Unicode handling.

**Process:**
1. Converts base64url to standard base64
2. Adds padding if needed
3. Decodes to binary string
4. Converts binary to UTF-8 bytes
5. Returns decoded string

**Unicode Safety:**
- Handles multi-byte characters correctly
- Uses TextEncoder/TextDecoder for proper UTF-8 handling

#### `readAndClearLocalStorageHandoff(handoffId: string): string | null`

Reads handoff payload from localStorage and deletes it after reading.

**One-Time Use:**
- Automatically deletes storage key after successful read
- Prevents duplicate imports
- SSR-safe (returns null if window undefined)

### 2. handoff-guard.ts

**Location:** `src/lib/utils/handoff-guard.ts`

**Purpose:** Prevents accidental double-imports of handoff payloads

**Key Functions:**

#### `getHandoffHash(payload: unknown): string`

Generates stable hash for handoff payload identification.

**Algorithm:**
- DJB2-style hash function
- Returns base36 string (0-9, a-z)
- Deterministic: same payload = same hash

**Usage:**
```typescript
const hash = getHandoffHash(payload);
// Example: "a1b2c3d4"
```

#### `wasHandoffAlreadyImported(appKey: string, hash: string): boolean`

Checks if payload hash was already imported for given app.

**Storage:**
- Uses sessionStorage: `obd_handoff_imported:${appKey}`
- Maintains array of imported hashes (max 25)
- Per-app tracking (separate keys per application)

**Returns:**
- `true`: Hash already imported (prevent duplicate)
- `false`: Hash not imported (allow import)

#### `markHandoffImported(appKey: string, hash: string): void`

Marks payload hash as imported for given app.

**Process:**
1. Reads existing hash array from sessionStorage
2. Removes hash if already exists (avoid duplicates)
3. Appends new hash to end
4. Caps at 25 entries (drops oldest)
5. Writes back to sessionStorage

**Cleanup:**
- Automatic: maintains max 25 entries
- Oldest entries dropped when limit reached
- Per-app: separate arrays per application

### 3. clear-handoff-params.ts

**Location:** `src/lib/utils/clear-handoff-params.ts`

**Purpose:** Cleans handoff-related query parameters from URLs

**Key Functions:**

#### `clearHandoffParamsFromUrl(url: string): string`

Removes `handoff` and `handoffId` query parameters while preserving:
- All other query parameters
- Hash fragments (#...)
- URL path and protocol

**Examples:**
```typescript
// Input: "/apps/content-writer?handoff=abc&from=crm"
// Output: "/apps/content-writer?from=crm"

// Input: "https://example.com/app?handoff=abc&other=123&handoffId=xyz#section"
// Output: "https://example.com/app?other=123#section"
```

**Fallback:**
- If URL parsing fails, uses regex-based cleanup
- Handles edge cases gracefully

#### `replaceUrlWithoutReload(cleanUrl: string): void`

Replaces current URL without reloading the page.

**Implementation:**
- Uses `window.history.replaceState()`
- SSR-safe: no-op if window undefined
- Preserves browser history

**Usage:**
```typescript
const cleanUrl = clearHandoffParamsFromUrl(window.location.href);
replaceUrlWithoutReload(cleanUrl);
```

## Receiver UX Pattern

### Standard Flow

1. **Banner Notification**
   - Shows when arriving from handoff source
   - Displays source app name and payload type
   - Dismissible (session-based)

2. **Payload Review**
   - Parse payload using `parse-handoff`
   - Check duplicate guard using `handoff-guard`
   - Validate payload structure

3. **User Confirmation**
   - Show preview of imported data
   - Allow user to accept or cancel
   - Modal or inline confirmation UI

4. **Import Execution**
   - Mark as imported via `handoff-guard`
   - Clean URL parameters via `clear-handoff-params`
   - Apply payload to app state

5. **Cleanup**
   - Remove handoff params from URL
   - Clear banner if dismissed
   - Show success feedback

### Example Implementation

```typescript
// 1. Parse handoff
const result = parseHandoffFromUrl(searchParams, validatePayload);
if (!result.payload) {
  // No handoff or invalid payload
  return;
}

// 2. Check duplicate guard
const hash = getHandoffHash(result.payload);
if (wasHandoffAlreadyImported("content-writer", hash)) {
  // Already imported, show message
  return;
}

// 3. Show banner/modal
setShowImportBanner(true);
setHandoffPayload(result.payload);

// 4. User confirms import
const handleImport = () => {
  markHandoffImported("content-writer", hash);
  applyPayload(result.payload);
  clearHandoffParamsFromUrl(window.location.href);
  replaceUrlWithoutReload(cleanUrl);
};
```

## Tenant Safety Principles

### BusinessId Scoping

**Rule:** All handoff operations must respect business isolation.

**Implementation:**
- Receivers validate businessId ownership
- Senders include businessId in payload context
- API endpoints verify businessId matches authenticated user

**Example:**
```typescript
const payload = {
  sourceApp: "ai-faq-generator",
  type: "faq-section",
  context: {
    businessId: currentUser.businessId, // Required
    businessName: "...",
  },
  // ... payload data
};
```

### No Overwrites

**Rule:** Handoffs are always additive, never destructive.

**Implementation:**
- Receivers append data, never replace
- Existing data remains unchanged
- Users can manually remove imported data if needed

**Example:**
```typescript
// Schema Generator: Additive FAQPage schema
const existingSchema = getCurrentSchema();
const newSchema = mergeSchemas(existingSchema, handoffPayload.jsonLd);
// Never: replaceSchema(handoffPayload.jsonLd)
```

### Additive-Only Operations

**Rule:** Handoffs add new data, never modify existing.

**Implementation:**
- Content Writer: Appends FAQs to existing FAQ section
- Schema Generator: Adds FAQPage to existing @graph
- Help Desk: Adds Q&A pairs to knowledge base

**Exception:** User-initiated actions (not handoff) can modify data.

## Integration Examples

### FAQ Generator → Help Desk

**Payload:**
```typescript
{
  sourceApp: "ai-faq-generator",
  type: "faq-import",
  format: "qa-pairs" | "document",
  faqs: FAQItem[],
  context: {
    businessId: string,
    businessName: string,
    topic: string,
  },
}
```

**Receiver Flow:**
1. Parse handoff payload
2. Check duplicate guard
3. Show import modal with format selection
4. User confirms import
5. Upsert FAQs to knowledge base
6. Clean URL and show success

### FAQ Generator → Schema Generator

**Payload:**
```typescript
{
  sourceApp: "ai-faq-generator",
  type: "faqpage-jsonld",
  title: string,
  jsonLd: string, // JSON-LD schema markup
  context: {
    businessId: string,
    businessName: string,
    topic: string,
  },
}
```

**Receiver Flow:**
1. Parse handoff payload
2. Check duplicate guard
3. Add FAQPage to existing @graph (additive)
4. Clean URL and show success

### FAQ Generator → Content Writer

**Payload:**
```typescript
{
  sourceApp: "ai-faq-generator",
  type: "faq-section",
  title: string,
  markdown: string,
  html: string,
  divi: string,
  context: {
    businessId: string,
    businessName: string,
    topic: string,
    services: string,
  },
}
```

**Receiver Flow:**
1. Parse handoff payload
2. Check duplicate guard
3. Show banner with import options (new draft or append)
4. User selects option
4. Apply FAQs to content (canonical state)
5. Clean URL and show success

## Error Handling

### Parse Errors

**Scenarios:**
- Invalid base64url encoding
- JSON parse failure
- Missing handoff parameter

**Response:**
- Return error in `HandoffParseResult`
- Show user-friendly error message
- Continue normal app flow (no handoff)

### Validation Errors

**Scenarios:**
- Payload structure mismatch
- Missing required fields
- Invalid data types

**Response:**
- Type guard returns false
- Show validation error
- Prevent import

### Duplicate Import

**Scenarios:**
- Same payload imported twice
- User reloads page with handoff params

**Response:**
- `wasHandoffAlreadyImported()` returns true
- Show message: "This content has already been imported"
- Prevent duplicate import
- Still clean URL parameters

## Best Practices

### For Senders

1. **Always validate before sending**
   - Check data is complete and valid
   - Use export validation functions

2. **Include context**
   - Add businessId, businessName, topic
   - Helps receivers understand payload

3. **Choose transport method wisely**
   - Use URL param for small payloads
   - Use localStorage for large payloads

4. **Handle errors gracefully**
   - Show user-friendly error messages
   - Don't break app flow on handoff failure

### For Receivers

1. **Always use shared utilities**
   - `parse-handoff` for parsing
   - `handoff-guard` for duplicate prevention
   - `clear-handoff-params` for cleanup

2. **Validate payload structure**
   - Use type guards
   - Check required fields
   - Handle missing data gracefully

3. **Respect tenant boundaries**
   - Validate businessId ownership
   - Never allow cross-tenant access

4. **Provide user feedback**
   - Show banner/modal for review
   - Allow user to cancel
   - Show success/error messages

5. **Clean up after import**
   - Remove handoff params from URL
   - Mark payload as imported
   - Clear any temporary state

## Testing Guide

### How to Test Handoff Integrations

#### 1. FAQ Generator → Help Desk Import

**Setup:**
1. Navigate to AI FAQ Generator
2. Generate FAQs (at least 3-5 FAQs)
3. Optionally edit some FAQs to test with edited content

**Test Q&A Pairs Format:**
1. In Export Center, click "Add" in Next Steps panel (AI Help Desk)
2. Verify import modal opens
3. Select "Q&A Pairs" format
4. Review FAQ preview
5. Click "Import" to confirm
6. Verify:
   - FAQs appear in Help Desk Knowledge base
   - Each FAQ is a separate Q&A pair
   - URL parameters are cleaned (no `?handoff=` or `?handoffId=`)
   - Success message is shown

**Test Document Format:**
1. Repeat setup above
2. In import modal, select "Document" format
3. Click "Import" to confirm
4. Verify:
   - FAQs appear as single document in Help Desk
   - Document contains all FAQs formatted as text
   - URL parameters are cleaned

**Test Duplicate Prevention:**
1. Complete import above
2. Navigate back to FAQ Generator
3. Click "Add" in Next Steps panel again
4. Verify:
   - Import modal shows "This content has already been imported" message
   - Import button is disabled or shows warning
   - No duplicate FAQs are created in Help Desk

#### 2. FAQ Generator → Schema Generator Insert

**Setup:**
1. Navigate to AI FAQ Generator
2. Generate FAQs
3. Ensure FAQs are valid (no empty questions/answers)

**Test FAQPage Schema Insert:**
1. In Export Center, click "Send" in Next Steps panel (Schema Generator)
2. Verify navigation to Business Schema Generator
3. Verify:
   - FAQPage schema is added to @graph (additive, not overwriting)
   - Existing schema remains intact
   - FAQPage contains all FAQs from generator
   - URL parameters are cleaned
   - Success indicator is shown

**Test Validation:**
1. Create FAQs with empty question or answer
2. Try to send to Schema Generator
3. Verify:
   - Validation error is shown: "FAQ{s} {numbers} {has/have} empty question or answer"
   - Navigation is blocked
   - User must fix FAQs before sending

**Test Duplicate Prevention:**
1. Complete schema insert above
2. Navigate back to FAQ Generator
3. Click "Send" to Schema Generator again
4. Verify:
   - Duplicate prevention message is shown
   - No duplicate FAQPage is added to schema
   - URL parameters are still cleaned

#### 3. FAQ Generator → Content Writer New/Append

**Setup:**
1. Navigate to AI FAQ Generator
2. Generate FAQs
3. Optionally edit FAQs to test with edited content

**Test New Draft:**
1. In Export Center, click "Send" in Next Steps panel (Content Writer)
2. Verify navigation to AI Content Writer
3. Verify banner appears: "FAQs imported from AI FAQ Generator"
4. Click "Create New Draft" option
5. Verify:
   - New content draft is created
   - FAQs are added to FAQ section
   - Form is pre-filled with context (business name, topic, etc.)
   - URL parameters are cleaned
   - Success message is shown

**Test Append to Existing:**
1. Navigate to AI Content Writer
2. Generate some content (with or without FAQs)
3. Navigate back to FAQ Generator
4. Generate FAQs
5. Click "Send" to Content Writer
6. Verify banner appears
7. Click "Append to Existing" option
8. Verify:
   - FAQs are appended to existing FAQ section
   - Existing content remains unchanged
   - FAQs are added at the end of FAQ list
   - URL parameters are cleaned

**Test Canonical State:**
1. In FAQ Generator, edit some FAQs
2. Send to Content Writer
3. Verify:
   - Edited FAQs are sent (not original generated FAQs)
   - `getActiveFaqs()` selector is used correctly

**Test Duplicate Prevention:**
1. Complete import above
2. Navigate back to FAQ Generator
3. Click "Send" to Content Writer again
4. Verify:
   - Duplicate prevention message is shown
   - No duplicate FAQs are added
   - URL parameters are still cleaned

#### 4. Duplicate-Import Protection

**Test Session-Based Tracking:**
1. Import FAQs to any receiver app
2. Reload the receiver app page
3. Verify:
   - Same handoff params in URL are detected as duplicate
   - Import is prevented
   - Message: "This content has already been imported"

**Test Cross-Tab Protection:**
1. Open receiver app in two browser tabs
2. Import FAQs in first tab
3. Try to import same FAQs in second tab
4. Verify:
   - Second tab detects duplicate (sessionStorage is shared)
   - Import is prevented

**Test Hash-Based Detection:**
1. Generate FAQs and import to receiver
2. Edit FAQs in generator (change one answer)
3. Try to import again
4. Verify:
   - New hash is generated (different content)
   - Import is allowed (not detected as duplicate)
   - New FAQs are imported

**Test Max Entries Cleanup:**
1. Import 30+ different FAQ sets to same receiver
2. Verify:
   - Oldest entries are automatically dropped
   - Max 25 entries maintained in sessionStorage
   - Recent imports still work correctly

#### 5. URL Cleanup Behavior

**Test Query Parameter Removal:**
1. Complete any handoff import
2. Check browser URL bar
3. Verify:
   - `?handoff=` or `?handoffId=` parameters are removed
   - Other query parameters are preserved (e.g., `?from=faq-generator`)
   - Hash fragments are preserved (e.g., `#section`)

**Test History Replacement:**
1. Complete handoff import
2. Click browser back button
3. Verify:
   - URL is cleaned (no handoff params in history)
   - Page doesn't reload
   - Normal navigation works

**Test Multiple Parameters:**
1. Navigate with: `?handoff=abc&from=faq&tab=export#section`
2. Complete import
3. Verify:
   - URL becomes: `?from=faq&tab=export#section`
   - Handoff params removed, others preserved

**Test Relative URLs:**
1. Test with relative URLs: `/apps/content-writer?handoff=abc`
2. Verify:
   - Cleanup works correctly
   - Path is preserved
   - Query params cleaned

**Test Absolute URLs:**
1. Test with absolute URLs: `https://example.com/apps/content-writer?handoff=abc`
2. Verify:
   - Cleanup works correctly
   - Protocol and domain preserved
   - Query params cleaned

### Testing Checklist

**Before Release:**
- [ ] All three handoff integrations tested (Help Desk, Schema Generator, Content Writer)
- [ ] Duplicate prevention works for all receivers
- [ ] URL cleanup works in all scenarios
- [ ] Validation errors prevent invalid imports
- [ ] Tenant isolation verified (no cross-tenant access)
- [ ] Canonical state management verified (edited FAQs sent, not original)
- [ ] Error handling tested (invalid payloads, parse errors)
- [ ] SessionStorage cleanup verified (max 25 entries)
- [ ] localStorage cleanup verified (one-time use)

### Common Issues & Solutions

**Issue: Duplicate imports not prevented**
- **Solution:** Check `handoff-guard` is called before import, verify hash generation is consistent

**Issue: URL params not cleaned**
- **Solution:** Verify `clear-handoff-params` and `replaceUrlWithoutReload` are called after import

**Issue: Invalid payloads imported**
- **Solution:** Verify validation functions are called before import, check type guards

**Issue: Cross-tenant access**
- **Solution:** Verify businessId validation in receiver, check API endpoints enforce tenant isolation

## Testing Considerations

### Unit Tests

- Test parse-handoff with various payload sizes
- Test handoff-guard duplicate detection
- Test clear-handoff-params URL cleanup
- Test Unicode handling in base64url encoding

### Integration Tests

- Test full handoff flow (sender → receiver)
- Test duplicate prevention
- Test URL cleanup
- Test error handling

### Manual Testing

- Test with small payloads (URL param)
- Test with large payloads (localStorage)
- Test duplicate import prevention
- Test URL cleanup behavior
- Test tenant isolation

