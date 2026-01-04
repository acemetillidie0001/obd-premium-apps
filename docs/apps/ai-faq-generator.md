# AI FAQ Generator - Tier 4 + Tier 5A + Tier 5C Implementation

**Status:** ✅ Production Ready (STABLE / LIVE)

**Last Updated:** 2025-01-XX

## Overview

The AI FAQ Generator helps businesses create professional, SEO-conscious FAQ sets for their websites, knowledge bases, and structured data. The app has been upgraded to Tier 4 (canonical patterns and hardening), Tier 5A (UX consistency), and Tier 5C (ecosystem integrations) standards.

## Purpose & Workflows

### Primary Use Cases

1. **Website FAQ Pages**: Generate Q&A pairs for website FAQ sections
2. **Knowledge Base Content**: Create structured Q&A content for help desks
3. **Schema Markup**: Generate JSON-LD FAQPage schema for SEO
4. **Content Integration**: Import FAQs into blog posts and service pages

### Typical Workflow

1. **Input Business Details**: Fill out form with business name, type, topic, and optional details
2. **Configure Style**: Set personality style, brand voice, tone, emoji preferences
3. **Generate FAQs**: Click "Generate FAQs" to create 3-12 FAQ pairs
4. **Edit & Refine**: Use inline editing to customize questions and answers
5. **Export or Integrate**: Export in multiple formats or send to other OBD apps

## Tier 4 Implementation: Canonical State Management

### State Hierarchy

The app maintains three distinct FAQ state layers:

1. **`parsedFAQs`**: Generated FAQs from AI response (read-only)
   - Parsed from AI response text using `parseAiResponse()` function
   - Format: `FAQItem[] with { number, question, answer, characterCount }`
   - Never mutated directly

2. **`editedFAQs`**: User-edited FAQs (mutable)
   - Created when user edits, adds, or deletes FAQs
   - Takes precedence over `parsedFAQs` in canonical selector
   - Automatically cleared when new AI response arrives

3. **`activeFaqs` / `getActiveFaqs()`**: Canonical selector (computed)
   - **Function:** `getActiveFaqs(): FAQItem[]`
   - **Logic:** `return editedFAQs ?? parsedFAQs`
   - **Usage:** All downstream operations MUST use this selector
   - **Purpose:** Single source of truth for current FAQ state

### Canonical Selector Rules

**Always use `getActiveFaqs()` for:**
- Display in UI
- Export operations
- Validation checks
- Cross-app handoffs
- Copy operations

**Never use `parsedFAQs` or `editedFAQs` directly** unless:
- Resetting to original (`parsedFAQs`)
- Detecting edit state (comparing `editedFAQs` vs `parsedFAQs`)

### State Reset Behavior

- **New AI Response**: Automatically clears `editedFAQs` and `shuffledFAQs`
- **Shuffle Operation**: Creates `shuffledFAQs` from `activeFaqs`
- **Edit Operations**: Updates `editedFAQs`, clears `shuffledFAQs`

## Inline Editing System

### Edit Workflow

1. **Start Editing**: Click "Edit" button on any FAQ
   - Sets `editingIndex` to FAQ number
   - Populates `editQuestion` and `editAnswer` with current values
   - FAQ switches to edit mode (input fields replace display)

2. **Save Changes**: Click "Save" button
   - Validates question and answer are non-empty
   - Updates `editedFAQs` array with new values
   - Clears `editingIndex` to exit edit mode
   - Shows toast: "FAQ updated"

3. **Cancel Editing**: Click "Cancel" button
   - Clears `editingIndex` without saving
   - Restores original values from `activeFaqs`
   - No state changes

### Add New FAQ

1. Click "Add New FAQ" button
2. Creates new FAQ with:
   - `number`: `activeFaqs.length + 1`
   - `question`: "" (empty)
   - `answer`: "" (empty)
   - `characterCount`: 0
3. Automatically enters edit mode for new FAQ
4. Adds to `editedFAQs` array
5. Clears `shuffledFAQs` (shuffle invalidated by new FAQ)

### Delete FAQ

1. Click "Delete" button on any FAQ
2. **Last-Item Protection**: Prevents deleting if only one FAQ remains
   - Shows validation error: "Cannot delete the last FAQ"
   - Action is blocked
3. **Renumbering**: After successful delete
   - Removes FAQ from `activeFaqs`
   - Renumbers all remaining FAQs sequentially (1, 2, 3...)
   - Updates `editedFAQs` with renumbered array
4. **Edit Mode Cleanup**: If deleted FAQ was being edited
   - Automatically calls `handleEditCancel()`
   - Clears `editingIndex`
5. Shows toast: "FAQ deleted"

### Shuffle Clearing Rules

The `shuffledFAQs` state is automatically cleared when:
- User edits any FAQ
- User adds a new FAQ
- User deletes a FAQ
- New AI response arrives

**Rationale:** Shuffle is a display-only transformation. Any structural changes (edit/add/delete) invalidate the shuffle order.

## Export Center

### Export Formats

The Export Center provides five export formats:

1. **Plain Text**: Simple Q&A format
   ```
   Q: Question text
   A: Answer text
   ```

2. **Markdown**: Formatted for documentation
   ```markdown
   ## Question text
   Answer text
   ```

3. **HTML**: Ready-to-paste HTML with styling
   ```html
   <div class="faq-item">
     <h3>Question text</h3>
     <p>Answer text</p>
   </div>
   ```

4. **JSON-LD**: Structured data for schema markup
   ```json
   {
     "@type": "FAQPage",
     "mainEntity": [{
       "@type": "Question",
       "name": "Question text",
       "acceptedAnswer": {
         "@type": "Answer",
         "text": "Answer text"
       }
     }]
   }
   ```

5. **Divi Builder**: WordPress Divi module format
   ```html
   [et_pb_faq_item title="Question text"]
   Answer text
   [/et_pb_faq_item]
   ```

### Export Validation

**Function:** `validateFAQsForExport(faqs: FAQItem[]): string | null`

**Validation Rules:**
1. **Empty Array Check**: Returns error if `faqs.length === 0`
   - Error: "No FAQs available. Generate FAQs first."

2. **Empty Content Check**: Returns error if any FAQ has empty question or answer
   - Error: "FAQ{s} {numbers} {has/have} empty question or answer. Please edit or delete these items before exporting."
   - Lists specific FAQ numbers with issues

3. **Success**: Returns `null` if all FAQs are valid

**Usage:**
- Called before all export operations
- Called before cross-app handoffs
- Called before copy operations
- Provides specific error messages with FAQ numbers

## Tier 5A UX Consistency

### Accordion Input Sections

**Sections:**
- **Business Basics** (default: expanded)
  - Business Name, Business Type
  - Summary: "Business Name • Business Type" or "Not filled"
- **Topic Details** (default: expanded)
  - Topic, Services/Details
  - Summary: "Topic • Details provided" or "Not filled"
- **Tone & Personality** (default: collapsed)
  - Tone, Personality Style, Brand Voice
  - Summary: "Tone • Personality Style • Brand Voice" or "Not filled"
- **FAQ Settings** (default: collapsed)
  - FAQ Count, Answer Length, Emoji Style, Theme
  - Summary: "5 FAQs • Medium • Minimal" or "Not filled"

**Features:**
- Collapsible with expand/collapse buttons
- Summary lines show key values when collapsed
- Clear visual indicators for expanded/collapsed state

### Sticky Action Bar

**Form-Level Sticky Bar:**
- Location: Bottom of form (sticky positioning)
- Primary Action: "Generate FAQs" button
- Disabled when: Topic is empty or loading
- Always visible when form is in viewport

**Scroll-Based Sticky Bar:**
- Appears when form sticky bar scrolls out of view
- Shows FAQ state chip: "Generated" or "Edited"
- Actions:
  - Copy Full (copies all FAQs as plain text)
  - Export (opens Export Center)
  - Download MD (downloads markdown file)
- Reset button: Only visible when FAQs are edited

### Standardized Button Classes

**Button Variants:**
- **Primary**: `SUBMIT_BUTTON_CLASSES` - "Generate FAQs" button
- **Secondary**: `getSecondaryButtonClasses(isDark)` - Export, Copy actions
- **Subtle**: `getSubtleButtonMediumClasses(isDark)` - Edit, Delete, Cancel actions

**Disabled States:**
- All buttons show disabled styling when actions are unavailable
- Consistent messaging: "Generate FAQs to enable this." or "Fix empty questions or answers to enable"

### Empty/Loading/Error States

**Empty State:**
- Message: "Generate FAQs to get started"
- Shown when: No FAQs have been generated yet
- Location: Results panel

**Loading State:**
- Skeleton loaders during FAQ generation
- Disabled form inputs during generation
- Loading indicator on "Generate FAQs" button

**Error State:**
- Clear error messages with retry options
- Validation errors shown in error panel
- Toast notifications for action feedback

## Tier 5C: Next Steps Ecosystem Panel

### Panel Behavior

**Location:** Export Center (always visible, not conditionally hidden)

**Visibility Rules:**
- Always rendered (disabled-not-hidden pattern)
- Disabled when FAQs are invalid or empty
- Enabled when FAQs pass validation

**Disabled State Messaging:**
- If no FAQs: "Generate FAQs first"
- If invalid FAQs: "Fix empty questions or answers to enable"

### Integration Options

1. **AI Help Desk**
   - Action: Opens import modal with FAQ preview
   - Format Selection: Q&A pairs or document format
   - Handler: `onOpenHelpDeskModal()`
   - Uses shared handoff utilities

2. **Business Schema Generator**
   - Action: Sends FAQPage schema to @graph
   - Operation: Additive (does not overwrite existing schema)
   - Handler: `onSendToSchemaGenerator()`
   - Payload: JSON-LD structured data

3. **AI Content Writer**
   - Action: Imports FAQs as new draft or appends to existing
   - Handler: `onSendToContentWriter()`
   - Payload: Markdown, HTML, and Divi formats
   - Uses canonical state management

### Safety Rules

- All integrations validate FAQs before handoff
- All handlers use shared handoff utilities
- Duplicate-import protection via `handoff-guard`
- URL cleanup after successful handoff
- Tenant-safe with businessId validation

## Technical Architecture

### Component Structure

```
src/app/apps/faq-generator/
├── page.tsx                    # Main page component
└── faq-export-formatters.ts   # Export format functions

src/components/faq/
├── FAQExportCenterPanel.tsx   # Export Center with formats
├── FAQNextStepsPanel.tsx      # Tier 5C ecosystem panel
└── FAQHelpDeskImportModal.tsx # Help Desk import modal
```

### Key Functions

**State Management:**
- `getActiveFaqs()`: Canonical selector
- `parseAiResponse()`: Parses AI response to FAQItem[]
- `validateFAQsForExport()`: Export validation

**Export Formatters:**
- `formatFAQsPlainText()`
- `formatFAQsMarkdown()`
- `formatFAQsHtml()`
- `formatFAQsJsonLd()`
- `formatFAQsDivi()`

**Handoff Handlers:**
- `handleSendToHelpDesk()`
- `handleSendToSchemaGenerator()`
- `handleSendToContentWriter()`

## Safety & Compatibility

### No Breaking Changes
- All features are additive and backward compatible
- Existing API endpoints unchanged
- No database schema changes

### Client-Side Only
- All editing and export operations are client-side
- No server-side state management
- localStorage used only for analytics (if applicable)

### Tenant Safety
- All operations respect business isolation
- No cross-tenant data access
- BusinessId validation in cross-app integrations

