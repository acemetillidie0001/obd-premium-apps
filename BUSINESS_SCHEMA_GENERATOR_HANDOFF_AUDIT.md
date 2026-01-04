# Business Schema Generator Handoff Receiver Audit

**Date**: 2024-12-19  
**Purpose**: Audit Business Schema Generator to locate its handoff receiver and confirm reuse of existing handoff utilities, with focus on ACW → Schema Generator integration.

---

## 1. Entry Page File Path

**File**: `src/app/apps/business-schema-generator/page.tsx`  
**Total Lines**: 1,387  
**Main Component**: `BusinessSchemaGeneratorPageContent` (lines 92-1,378)  
**Export**: `BusinessSchemaGeneratorPage` (lines 1,380-1,386) - wraps content in Suspense

---

## 2. Handoff Payload Support

### ✅ **YES - Full Support for Both Patterns**

The Schema Generator **already supports** both handoff payload patterns:

#### Pattern 1: Direct URL Query Parameter
- **Format**: `?handoff=<base64url-encoded-json>`
- **Parsed by**: `parseSchemaGeneratorHandoff()` function
- **Utility**: Uses shared `parseHandoffFromUrl()` from `@/lib/utils/parse-handoff`

#### Pattern 2: localStorage Fallback
- **Format**: `?handoffId=<id>`
- **Storage Key**: `obd_handoff:<id>` (automatically cleared after read)
- **Parsed by**: Same `parseSchemaGeneratorHandoff()` function
- **Utility**: Uses shared `parseHandoffFromUrl()` which handles localStorage fallback

### Handoff Parsing Implementation

**Location**: `src/app/apps/business-schema-generator/page.tsx`, lines 140-160

```typescript
// Handle handoff on page load
useEffect(() => {
  if (searchParams && typeof window !== "undefined") {
    try {
      const payload = parseSchemaGeneratorHandoff(searchParams);
      if (payload && payload.type === "faqpage-jsonld") {
        // Compute hash for the payload
        const hash = getHandoffHash(payload);
        setHandoffHash(hash);
        
        // Check if this payload was already imported
        const alreadyImported = wasHandoffAlreadyImported("business-schema-generator", hash);
        setIsHandoffAlreadyImported(alreadyImported);
        
        setHandoffPayload(payload);
        setShowImportBanner(true);
      }
    } catch (error) {
      console.error("Failed to parse handoff payload:", error);
    }
  }
}, [searchParams]);
```

### Handoff Parser Utility

**File**: `src/lib/apps/business-schema-generator/handoff-parser.ts`  
**Function**: `parseSchemaGeneratorHandoff(searchParams: URLSearchParams)`  
**Reuses**: Shared `parseHandoffFromUrl<T>()` utility from `@/lib/utils/parse-handoff`

**Current Payload Type** (from FAQ Generator):
```typescript
interface SchemaGeneratorHandoffPayload {
  sourceApp: "ai-faq-generator";
  type: "faqpage-jsonld";
  title: string;
  jsonLd: string;
  context: {
    businessName: string;
    businessType: string;
    topic: string;
  };
}
```

---

## 3. Existing Import Components

### ✅ **FAQImportBanner Component**

**File**: `src/app/apps/business-schema-generator/components/FAQImportBanner.tsx`  
**Pattern**: Similar to Help Desk's `ImportReadyBanner` pattern

**Props**:
```typescript
interface FAQImportBannerProps {
  isDark: boolean;
  isAlreadyImported: boolean;
  onInsert: () => void;
  onDismiss: () => void;
}
```

**Usage Location**: `src/app/apps/business-schema-generator/page.tsx`, lines 583-590

```typescript
{showImportBanner && handoffPayload && (
  <FAQImportBanner
    isDark={isDark}
    isAlreadyImported={isHandoffAlreadyImported}
    onInsert={handleInsertFaqSchema}
    onDismiss={handleDismissFaqImport}
  />
)}
```

**Features**:
- Shows "FAQPage schema received from AI FAQ Generator" message
- Displays "already imported" state if payload was previously imported
- "Insert" button (disabled if already imported)
- "Dismiss" button
- Uses handoff guard utilities to prevent double-imports

---

## 4. Schema Generator Form State Model

**Type Definition File**: `src/app/apps/business-schema-generator/types.ts`  
**Interface**: `SchemaGeneratorRequest`

### Business Basics
- ✅ **businessName** (string, required)
- ✅ **businessType** (string, required) - One of predefined LocalBusiness subtypes
- ✅ **services** (string[], optional) - Array of service strings

### Address Fields
- ✅ **streetAddress** (string, optional)
- ✅ **city** (string, optional, default: "Ocala")
- ✅ **state** (string, optional, default: "Florida")
- ✅ **postalCode** (string, optional)

### Contact & Links
- ✅ **phone** (string, optional)
- ✅ **websiteUrl** (string, optional)
- ✅ **googleMapsUrl** (string, optional)

### Social Media Links
- ✅ **socialLinks** (object, optional)
  - **facebookUrl** (string, optional)
  - **instagramUrl** (string, optional)
  - **xUrl** (string, optional) - X (Twitter) URL
  - **linkedinUrl** (string, optional)

### Business Hours
- ✅ **hours** (object, optional)
  - **monday** through **sunday** (string, optional) - Format: "9:00 AM - 5:00 PM"

### FAQ Schema Fields
- ✅ **includeFaqSchema** (boolean, optional) - Toggle to include FAQPage schema
- ✅ **faqs** (array, optional) - Array of `{ question: string; answer: string }`
- ✅ **faqTemplateMode** ("none" | "basic", optional) - Template generation mode

### Page Schema Fields (WebPage Schema)
- ✅ **includeWebPageSchema** (boolean, optional) - Toggle to include WebPage schema
- ✅ **pageUrl** (string, optional) - Required if includeWebPageSchema is true
- ✅ **pageTitle** (string, optional)
- ✅ **pageDescription** (string, optional)
- ✅ **pageType** ("Homepage" | "ServicePage" | "LocationPage" | "About" | "Contact" | "Other", optional)

### Organization Schema
- ⚠️ **Not a separate toggle** - Organization schema is **automatically generated** from LocalBusiness schema (includes businessName, businessType, address, contact info, social links, hours)

### Notes
- **Logo**: ❌ No logo field exists in the current form state
- **Keywords**: ❌ No keywords field exists (services array serves similar purpose)

---

## 5. Receiver File Path and Line Ranges

### Main Receiver Component

**File**: `src/app/apps/business-schema-generator/page.tsx`

**Key Sections**:

1. **Handoff Parsing** (lines 140-160)
   - `useEffect` hook that parses handoff on page load
   - Uses `parseSchemaGeneratorHandoff()` from handoff-parser.ts
   - Computes hash and checks for duplicate imports
   - Sets handoff state and shows import banner

2. **Import Banner Display** (lines 583-590)
   - Conditionally renders `FAQImportBanner` component
   - Only shows when `showImportBanner` is true and `handoffPayload` exists

3. **Import Handler** (lines 458-501)
   - `handleInsertFaqSchema()` - Inserts imported FAQ JSON-LD
   - Marks handoff as imported using `markHandoffImported()`
   - Clears handoff params from URL
   - Shows success toast

4. **Dismiss Handler** (lines 503-514)
   - `handleDismissFaqImport()` - Dismisses import banner
   - Clears handoff params from URL

5. **Combined JSON-LD Builder** (lines 516-573)
   - `getCombinedJsonLd()` - Builds combined schema including imported FAQ
   - Adds imported FAQ to @graph array
   - Handles both new results and imported FAQ-only scenarios

### Handoff Parser Utility

**File**: `src/lib/apps/business-schema-generator/handoff-parser.ts`

**Key Functions**:
- **`parseSchemaGeneratorHandoff()`** (lines 48-63)
  - Parses handoff from URL query params or localStorage
  - Uses shared `parseHandoffFromUrl<T>()` utility
  - Validates payload using type guard

- **`isValidSchemaGeneratorHandoff()`** (lines 24-39)
  - Type guard function for payload validation
  - Currently validates for `sourceApp === "ai-faq-generator"` and `type === "faqpage-jsonld"`

### Import Banner Component

**File**: `src/app/apps/business-schema-generator/components/FAQImportBanner.tsx`  
**Lines**: 1-76

---

## 6. Recommended Payload Shape for ACW → Schema Generator

### Current State

The Schema Generator currently only accepts handoffs from **AI FAQ Generator** with type `"faqpage-jsonld"`.

### Recommended Payload for Content Writer → Schema Generator

**Note**: This would require extending the handoff parser to accept a new payload type.

#### Option A: Form Prefill Handoff (Recommended for ACW)

```typescript
interface SchemaGeneratorFormPrefillPayload {
  sourceApp: "content-writer";
  type: "form-prefill";
  title: string;
  formData: {
    // Business Basics
    businessName?: string;
    businessType?: string;
    services?: string[];  // Array of service strings
    
    // Address
    streetAddress?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    
    // Contact
    phone?: string;
    websiteUrl?: string;
    googleMapsUrl?: string;
    
    // Social Links
    socialLinks?: {
      facebookUrl?: string;
      instagramUrl?: string;
      xUrl?: string;
      linkedinUrl?: string;
    };
    
    // Hours (if available from Content Writer)
    hours?: {
      monday?: string;
      tuesday?: string;
      wednesday?: string;
      thursday?: string;
      friday?: string;
      saturday?: string;
      sunday?: string;
    };
  };
  context?: {
    businessName?: string;
    businessType?: string;
    topic?: string;
  };
}
```

#### Option B: Additive Schema Handoff (Alternative)

Similar to FAQ Generator pattern, but for WebPage schema or Organization schema enhancement:

```typescript
interface SchemaGeneratorWebPageHandoffPayload {
  sourceApp: "content-writer";
  type: "webpage-schema" | "organization-schema";
  title: string;
  jsonLd: string;  // Pre-generated JSON-LD
  context: {
    businessName?: string;
    businessType?: string;
    topic?: string;
    pageUrl?: string;
  };
}
```

### Exact Props/State Fields to Prefill

When implementing ACW → Schema Generator handoff, prefill these fields:

#### Direct Form State Fields
- `form.businessName` ← `formData.businessName`
- `form.businessType` ← `formData.businessType`
- `form.services` ← `formData.services` (array)
- `form.streetAddress` ← `formData.streetAddress`
- `form.city` ← `formData.city`
- `form.state` ← `formData.state`
- `form.postalCode` ← `formData.postalCode`
- `form.phone` ← `formData.phone`
- `form.websiteUrl` ← `formData.websiteUrl`
- `form.googleMapsUrl` ← `formData.googleMapsUrl`
- `form.socialLinks` ← `formData.socialLinks` (object merge)
- `form.hours` ← `formData.hours` (object merge)

#### Derived/Computed Fields
- `servicesInput` ← `formData.services.join(", ")` (for display input)

#### Fields NOT Available in Content Writer
- ❌ Logo - Content Writer doesn't have logo field
- ❌ Keywords - Content Writer has keywords but Schema Generator uses services array instead

---

## 7. Handoff Utilities Reuse

### ✅ **All Utilities Already Reused**

The Schema Generator **already uses** the shared handoff utilities:

1. **`parseHandoffFromUrl<T>()`**
   - **Location**: `@/lib/utils/parse-handoff`
   - **Used by**: `parseSchemaGeneratorHandoff()` in `handoff-parser.ts`

2. **`getHandoffHash()`**
   - **Location**: `@/lib/utils/handoff-guard`
   - **Used by**: Main page component (line 146)

3. **`wasHandoffAlreadyImported()`**
   - **Location**: `@/lib/utils/handoff-guard`
   - **Used by**: Main page component (line 150)

4. **`markHandoffImported()`**
   - **Location**: `@/lib/utils/handoff-guard`
   - **Used by**: Main page component (line 471)

5. **`clearHandoffParamsFromUrl()` & `replaceUrlWithoutReload()`**
   - **Location**: `@/lib/utils/clear-handoff-params`
   - **Used by**: Main page component (lines 481, 511)

### Sender Pattern (for Reference)

If implementing ACW → Schema Generator, reuse the `storeHandoffPayload()` pattern:

**Example** (from FAQ Generator):
```typescript
const storeHandoffPayload = (payload: unknown, targetRoute: string): void => {
  const jsonString = JSON.stringify(payload);
  const encoded = encodeBase64Url(jsonString);
  const urlParam = `?handoff=${encoded}`;

  // Try URL handoff if encoded length is reasonable (~1500 chars)
  if (encoded.length <= 1500) {
    const targetUrl = `${targetRoute}${urlParam}`;
    window.location.href = targetUrl;
  } else {
    // Fallback to localStorage
    const handoffId = generateHandoffId();
    const storageKey = `obd_handoff:${handoffId}`;
    
    try {
      localStorage.setItem(storageKey, jsonString);
      const targetUrl = `${targetRoute}?handoffId=${handoffId}`;
      window.location.href = targetUrl;
    } catch (error) {
      console.error("Failed to store handoff payload:", error);
      onValidationError("Failed to send handoff. Please try again.");
    }
  }
};
```

**Location**: This pattern is implemented in:
- `src/components/faq/FAQExportCenterPanel.tsx` (lines 75-100)
- `src/components/cw/CWExportCenterPanel.tsx` (lines 172-199)

---

## 8. Summary

### ✅ Findings

1. **Entry Page**: `src/app/apps/business-schema-generator/page.tsx`
2. **Handoff Support**: ✅ Full support for both `?handoff=<base64url>` and `?handoffId=<id>` patterns
3. **Import Component**: ✅ `FAQImportBanner` component exists (similar to Help Desk pattern)
4. **Handoff Utilities**: ✅ All shared utilities are already reused
5. **Form State**: Complete form state model documented with all fields
6. **Current Handoff**: Only accepts `faqpage-jsonld` from AI FAQ Generator

### 🔄 Recommended Next Steps (for ACW Integration)

1. **Extend Handoff Parser**:
   - Update `isValidSchemaGeneratorHandoff()` to accept `sourceApp: "content-writer"` and `type: "form-prefill"`
   - Or create new validation function for Content Writer payloads

2. **Update Handoff Handler**:
   - Extend the `useEffect` handler (lines 140-160) to handle `form-prefill` type
   - Add form prefilling logic when payload type is `form-prefill`

3. **Create/Extend Import Banner** (if needed):
   - Current `FAQImportBanner` is specific to FAQ imports
   - May need a generic `FormPrefillBanner` or extend existing banner

4. **Implement Sender** (in Content Writer):
   - Reuse `storeHandoffPayload()` pattern from `CWExportCenterPanel.tsx`
   - Build payload with form data from Content Writer
   - Navigate to `/apps/business-schema-generator` with handoff payload

---

## 9. Line Range Reference

### Main Receiver File

**File**: `src/app/apps/business-schema-generator/page.tsx`

- **Lines 140-160**: Handoff parsing and initialization
- **Lines 231-243**: `handleFieldChange()` - form field update handler
- **Lines 245-259**: `handleServicesChange()` - services array handler
- **Lines 458-501**: `handleInsertFaqSchema()` - FAQ import handler
- **Lines 503-514**: `handleDismissFaqImport()` - dismiss handler
- **Lines 516-573**: `getCombinedJsonLd()` - combined schema builder
- **Lines 583-590**: Import banner display
- **Lines 92-1,378**: Main component body

### Handoff Parser

**File**: `src/lib/apps/business-schema-generator/handoff-parser.ts`

- **Lines 24-39**: Type guard validation function
- **Lines 48-63**: Main parser function

### Import Banner

**File**: `src/app/apps/business-schema-generator/components/FAQImportBanner.tsx`

- **Lines 1-76**: Complete component implementation

---

**End of Audit Report**

