# Tier 5A: Canonical UX Patterns for OBD Premium Apps

**Version:** 1.0  
**Status:** Standards Definition  
**Effective Date:** 2024

---

## Overview

This document defines the canonical UX patterns for all OBD Premium Apps. These standards ensure consistency, accessibility, and a cohesive user experience across the platform.

**Principles:**
- **Consistency:** Same patterns used across all apps
- **Accessibility:** WCAG 2.1 AA compliant
- **Clarity:** Clear, friendly, actionable messaging
- **Performance:** Optimized loading states and feedback

---

## 1. Empty States

### 1.1 Main Results Area Empty State

**Component:** `OBDResultsPanel` with `emptyTitle` and `emptyDescription` props

**Standard Pattern:**
```tsx
<OBDResultsPanel
  title="Generated Content"
  isDark={isDark}
  emptyTitle="No [content type] yet"
  emptyDescription="Fill out the form above and click &quot;[Action Button]&quot; to generate your [content type]."
  className="mt-8"
>
  {result && (
    // Results content
  )}
</OBDResultsPanel>
```

**Specifications:**

**Icon:**
- **Default:** Document icon (📄) via `OBDStatusBlock` variant="empty"
- **Custom:** Can override via `emptyState` prop with custom ReactNode
- **Size:** 48px × 48px (w-12 h-12)
- **Background:** `bg-slate-100` (light) / `bg-slate-800` (dark)

**Headline:**
- **Format:** "No [content type] yet"
- **Examples:**
  - "No content yet"
  - "No posts yet"
  - "No FAQs yet"
  - "No captions yet"
- **Style:** `text-base font-semibold` via `OBDStatusBlock`
- **Color:** Theme-aware heading text

**Helper Text:**
- **Format:** "Fill out the form above and click &quot;[Action]&quot; to generate your [content type]."
- **Requirements:**
  - Must include specific action button text (e.g., "Start Writing", "Generate Posts")
  - Must reference the form location
  - Must be actionable and clear
- **Style:** `text-sm` via `OBDStatusBlock` muted text
- **Max Length:** 120 characters recommended

**Primary CTA:**
- **When to show:** Only if there's a clear next action (e.g., "Start Writing" button in sticky action bar)
- **Location:** Not in empty state itself, but in form's sticky action bar
- **Exception:** If empty state is standalone (no form), include CTA button in `actions` prop

**Implementation:**
- Uses `OBDStatusBlock` component internally
- Centered layout with icon, title, description
- Supports custom `emptyState` prop for complex scenarios

**Files:**
- Component: `src/components/obd/OBDResultsPanel.tsx`
- Status Block: `src/components/obd/OBDStatusBlock.tsx`

---

### 1.2 Inline/Subsection Empty State

**Component:** `OBDStatusBlock` variant="empty"

**Standard Pattern:**
```tsx
<OBDStatusBlock
  variant="empty"
  title="No [items] available"
  description="[Context-specific message]"
  isDark={isDark}
/>
```

**Use Cases:**
- Filtered results with no matches
- Collapsed tab content preview
- Optional sections with no data

**Specifications:**

**Icon:**
- **Default:** Document icon (📄)
- **Custom:** Can override via `icon` prop
- **Size:** 48px × 48px

**Headline:**
- **Format:** "No [items] available"
- **Examples:**
  - "No tagline options available"
  - "No keywords match your filters"
  - "No FAQs in this section"

**Helper Text:**
- **Format:** Context-specific, actionable message
- **Examples:**
  - "Try clearing filters or broadening your search."
  - "This section will appear after generation."
- **Optional:** Can be omitted for brevity

**Primary CTA:**
- **When to show:** Only if there's a clear action (e.g., "Clear filters" button)
- **Implementation:** Use `actions` prop
```tsx
<OBDStatusBlock
  variant="empty"
  title="No keywords match your filters"
  description="Try clearing filters or broadening your search."
  isDark={isDark}
  actions={
    <button onClick={handleClearFilters} className={SECONDARY_BUTTON_CLASSES}>
      Clear filters
    </button>
  }
/>
```

**Files:**
- Component: `src/components/obd/OBDStatusBlock.tsx`

---

### 1.3 First-Run Empty State

**Component:** `OBDStatusBlock` variant="empty" (with custom messaging)

**Standard Pattern:**
```tsx
<OBDStatusBlock
  variant="empty"
  title="Welcome to [App Name]"
  description="Get started by filling out the form below. We'll generate [content type] tailored to your Ocala business."
  isDark={isDark}
  icon={
    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
      isDark ? "bg-[#29c4a9]/20" : "bg-[#29c4a9]/10"
    }`}>
      <span className="text-3xl">✨</span>
    </div>
  }
/>
```

**Use Cases:**
- First-time user experience
- Onboarding flows
- Feature introduction

**Specifications:**

**Icon:**
- **Default:** Sparkle/star icon (✨) or app-specific icon
- **Size:** 64px × 64px (w-16 h-16) for emphasis
- **Background:** Brand color with opacity

**Headline:**
- **Format:** "Welcome to [App Name]" or "Get Started"
- **Tone:** Friendly, welcoming

**Helper Text:**
- **Format:** Brief explanation of value proposition
- **Include:** What the app does, what user needs to do
- **Max Length:** 100 characters

**Primary CTA:**
- **Location:** Form's sticky action bar (not in empty state)
- **Exception:** Standalone welcome screens can include CTA

---

### 1.4 Empty State Standards Summary

| Type | Component | Icon | Headline Format | CTA Location |
|------|-----------|------|-----------------|--------------|
| Main Results | `OBDResultsPanel` | 📄 (default) | "No [type] yet" | Sticky action bar |
| Inline/Subsection | `OBDStatusBlock` | 📄 (default) | "No [items] available" | `actions` prop (optional) |
| First-Run | `OBDStatusBlock` | ✨ (custom) | "Welcome to [App]" | Sticky action bar |

**Required Props:**
- `variant="empty"`
- `title` (required)
- `description` (recommended for main results, optional for inline)
- `isDark` (required)
- `actions` (optional, for CTAs)

---

## 2. Loading States

### 2.1 Results Area Loading State

**Component:** `OBDResultsPanel` with `loading` and `loadingText` props

**Standard Pattern:**
```tsx
<OBDResultsPanel
  title="Generated Content"
  isDark={isDark}
  loading={loading}
  loadingText="Generating..."
  className="mt-8"
>
  {result && (
    // Results content
  )}
</OBDResultsPanel>
```

**Specifications:**

**Spinner vs Skeleton:**
- **Use Spinner:** For initial generation (API calls, AI processing)
- **Use Skeleton:** For data fetching (lists, tables, existing content)
- **Current Implementation:** Spinner via `OBDStatusBlock` variant="loading"

**Spinner Specifications:**
- **Component:** `OBDStatusBlock` variant="loading"
- **Size:** 24px × 24px (h-6 w-6)
- **Color:** `#29c4a9` (brand teal)
- **Animation:** `animate-spin`
- **Container:** 48px × 48px circle with theme-aware background

**Loading Text:**
- **Standard:** "Generating..."
- **Variations (when needed):**
  - "Generating content..."
  - "Analyzing local searches..."
  - "Creating your [content type]..."
- **Format:** Present participle verb + ellipsis
- **Max Length:** 40 characters
- **Style:** `text-base font-semibold` via `OBDStatusBlock`

**Minimum Visible Delay:**
- **Rule:** Show loading state for minimum 300ms
- **Rationale:** Prevents flash of content on fast responses
- **Implementation:**
```tsx
const [showLoading, setShowLoading] = useState(false);

useEffect(() => {
  if (loading) {
    const timer = setTimeout(() => setShowLoading(true), 0);
    return () => clearTimeout(timer);
  } else {
    const timer = setTimeout(() => setShowLoading(false), 300);
    return () => clearTimeout(timer);
  }
}, [loading]);
```

**Files:**
- Component: `src/components/obd/OBDResultsPanel.tsx`
- Status Block: `src/components/obd/OBDStatusBlock.tsx`

---

### 2.2 Button Loading State

**Component:** Inline spinner in submit button

**Standard Pattern:**
```tsx
<button
  type="submit"
  disabled={loading}
  className={SUBMIT_BUTTON_CLASSES}
>
  {loading ? (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Generating...
    </span>
  ) : (
    "[Action Text]"
  )}
</button>
```

**Specifications:**

**Spinner:**
- **Size:** 16px × 16px (h-4 w-4)
- **Color:** Inherits button text color (white for primary)
- **Animation:** `animate-spin`
- **Gap:** 8px between spinner and text (`gap-2`)

**Loading Text:**
- **Standard:** "Generating..."
- **Button-Specific:** Can use action-specific text
  - "Generating..."
  - "Creating..."
  - "Analyzing..."
- **Format:** Present participle + ellipsis
- **Max Length:** 25 characters

**Disabled State:**
- **Styling:** `disabled:opacity-50 disabled:cursor-not-allowed`
- **Behavior:** Button remains visible but non-interactive
- **Accessibility:** `disabled` attribute required

**Files:**
- Helper: `src/lib/obd-framework/layout-helpers.ts` (SUBMIT_BUTTON_CLASSES)

---

### 2.3 Skeleton Loading State

**Component:** **PROPOSED** - `OBDSkeleton` (new component)

**Use Cases:**
- Loading existing data (not generating new)
- Table rows
- List items
- Card content

**Proposed Pattern:**
```tsx
<OBDSkeleton
  variant="card" // "card" | "text" | "table-row" | "list-item"
  count={3} // For multiple items
  isDark={isDark}
/>
```

**Specifications:**

**Variants:**
- **card:** Full card skeleton with title, text lines, button placeholder
- **text:** Text line skeletons (1-5 lines)
- **table-row:** Table row with multiple cells
- **list-item:** List item with avatar, text, action

**Styling:**
- **Background:** `bg-slate-200` (light) / `bg-slate-700` (dark)
- **Animation:** `animate-pulse`
- **Border Radius:** Match target component
- **Height:** Match target content height

**Implementation Status:** ⚠️ **NOT YET IMPLEMENTED**

**Proposed File:** `src/components/obd/OBDSkeleton.tsx`

---

### 2.4 Progress Indicator

**Component:** **PROPOSED** - `OBDProgressIndicator` (new component)

**Use Cases:**
- Multi-step processes
- Long-running operations with known progress
- File uploads

**Proposed Pattern:**
```tsx
<OBDProgressIndicator
  currentStep={2}
  totalSteps={4}
  stepLabels={["Analyzing", "Generating", "Formatting", "Finalizing"]}
  isDark={isDark}
/>
```

**Specifications:**

**Visual:**
- **Progress Bar:** Horizontal bar with percentage
- **Step Indicators:** Numbered or labeled steps
- **Current Step:** Highlighted with brand color
- **Completed Steps:** Muted color

**Styling:**
- **Bar Height:** 8px
- **Bar Color:** `#29c4a9` (brand teal)
- **Background:** `bg-slate-200` (light) / `bg-slate-700` (dark)
- **Border Radius:** `rounded-full`

**Implementation Status:** ⚠️ **NOT YET IMPLEMENTED**

**Proposed File:** `src/components/obd/OBDProgressIndicator.tsx`

**Current Workaround:**
- Local Hiring Assistant uses custom progress indicator
- Should migrate to shared component when available

---

### 2.5 Loading State Standards Summary

| Context | Component | Type | Minimum Delay |
|---------|-----------|------|---------------|
| Results Area | `OBDResultsPanel` | Spinner | 300ms |
| Submit Button | Inline spinner | Spinner | 0ms (immediate) |
| Data Fetching | **OBDSkeleton** (proposed) | Skeleton | 300ms |
| Multi-Step | **OBDProgressIndicator** (proposed) | Progress | 300ms |

**Loading Text Standards:**
- **Format:** Present participle + ellipsis
- **Standard:** "Generating..."
- **Max Length:** 40 characters (results), 25 characters (buttons)

---

## 3. Error States

### 3.1 API/Submission Errors

**Component:** `getErrorPanelClasses` helper + `OBDPanel`

**Standard Pattern:**
```tsx
{error && !result ? (
  <OBDPanel isDark={isDark} className="mt-8">
    <div className={getErrorPanelClasses(isDark)}>
      <p className="font-medium mb-2">Error:</p>
      <p>{error}</p>
    </div>
  </OBDPanel>
) : (
  <OBDResultsPanel ... />
)}
```

**Specifications:**

**Friendly Language:**
- **Rule:** Never show raw error messages or stack traces
- **Format:** User-friendly, actionable messages
- **Examples:**
  - ❌ "Error: Failed to fetch"
  - ✅ "We couldn't generate your content. Please check your connection and try again."
  - ❌ "500 Internal Server Error"
  - ✅ "Something went wrong on our end. Please try again in a moment."

**Error Message Format:**
- **Structure:** Problem statement + suggested action
- **Tone:** Helpful, not technical
- **Length:** 50-120 characters
- **No Technical Details:** No stack traces, error codes, or API details

**Styling:**
- **Container:** `rounded-xl border p-3`
- **Background:** `bg-red-50 border-red-200` (light) / `bg-red-900/20 border-red-700` (dark)
- **Text Color:** `text-red-600` (light) / `text-red-400` (dark)
- **Icon:** Optional warning icon (⚠️)

**Retry Affordances:**
- **Primary Action:** "Try Again" button (secondary button style)
- **Location:** Inside error panel or in results panel actions
- **Implementation:**
```tsx
{error && !result && (
  <OBDPanel isDark={isDark} className="mt-8">
    <div className={getErrorPanelClasses(isDark)}>
      <p className="font-medium mb-2">Error:</p>
      <p className="mb-4">{error}</p>
      <button
        onClick={handleRetry}
        className={SECONDARY_BUTTON_CLASSES}
      >
        Try Again
      </button>
    </div>
  </OBDPanel>
)}
```

**Files:**
- Helper: `src/lib/obd-framework/layout-helpers.ts` (getErrorPanelClasses)
- Component: `src/components/obd/OBDPanel.tsx`

---

### 3.2 Form Validation Errors

**Component:** Inline error text below field

**Standard Pattern:**
```tsx
<div>
  <label htmlFor="field" className={`block text-sm font-medium mb-2 ${themeClasses.labelText}`}>
    Field Name <span className="text-red-500">*</span>
  </label>
  <input
    id="field"
    className={`${getInputClasses(isDark)} ${
      fieldError ? "border-red-500" : ""
    }`}
    aria-invalid={!!fieldError}
    aria-describedby={fieldError ? "field-error" : undefined}
  />
  {fieldError && (
    <p
      id="field-error"
      className={`mt-1 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}
      role="alert"
    >
      {fieldError}
    </p>
  )}
</div>
```

**Specifications:**

**Friendly Language:**
- **Format:** Clear, specific, actionable
- **Examples:**
  - ❌ "Invalid"
  - ✅ "Please enter your business name"
  - ❌ "Required field"
  - ✅ "Topic is required to generate content"
- **Tone:** Helpful, not accusatory
- **Length:** 20-60 characters

**Styling:**
- **Text Size:** `text-xs`
- **Text Color:** `text-red-600` (light) / `text-red-400` (dark)
- **Margin:** `mt-1` (4px top margin)
- **Field Border:** `border-red-500` when error present

**Accessibility:**
- **Required:** `aria-invalid={true}` on input
- **Required:** `aria-describedby` linking to error message
- **Required:** `role="alert"` on error message
- **Required:** `id` on error message matching `aria-describedby`

**Clear on Input:**
- **Rule:** Clear error when user starts typing
- **Implementation:** Clear error state in `onChange` handler

**Files:**
- Helper: `src/lib/obd-framework/theme.ts` (getInputClasses)

---

### 3.3 Inline Form Errors

**Component:** `getErrorPanelClasses` helper (inline in form)

**Standard Pattern:**
```tsx
{error && !loading && (
  <div className={getErrorPanelClasses(isDark)}>
    <p className="text-sm">{error}</p>
  </div>
)}
```

**Use Cases:**
- Submission errors shown in form
- Pre-submission validation errors
- API errors before results are generated

**Specifications:**

**Styling:**
- Same as API errors (red background, border, text)
- **Padding:** `p-3`
- **No "Error:" Label:** Omit label for inline errors (cleaner)

**Retry Affordances:**
- **Not Required:** User can fix form and resubmit
- **Optional:** "Try Again" button if error is retryable

**Files:**
- Helper: `src/lib/obd-framework/layout-helpers.ts` (getErrorPanelClasses)

---

### 3.4 Error State Standards Summary

| Type | Component | Friendly Language | Retry Affordance |
|------|-----------|-------------------|------------------|
| API/Submission | `OBDPanel` + `getErrorPanelClasses` | Required | "Try Again" button |
| Form Validation | Inline text | Required | Clear on input |
| Inline Form | `getErrorPanelClasses` | Required | Optional |

**Error Message Rules:**
- ✅ User-friendly language
- ✅ Actionable suggestions
- ✅ No stack traces
- ✅ No raw error codes
- ✅ 50-120 characters (API), 20-60 characters (validation)

---

## 4. Buttons

### 4.1 Primary Button

**Component:** `SUBMIT_BUTTON_CLASSES` constant

**Standard Pattern:**
```tsx
<button
  type="submit"
  disabled={loading || !isValid}
  className={SUBMIT_BUTTON_CLASSES}
>
  {loading ? (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin h-4 w-4" ...>
        {/* Spinner SVG */}
      </svg>
      Generating...
    </span>
  ) : (
    "[Action Text]"
  )}
</button>
```

**Specifications:**

**Styling:**
- **Width:** `w-full` (full width)
- **Padding:** `px-6 py-3` (24px horizontal, 12px vertical)
- **Background:** `bg-[#29c4a9]` (brand teal)
- **Text Color:** `text-white`
- **Font:** `font-medium`
- **Border Radius:** `rounded-full` (pill shape)
- **Hover:** `hover:bg-[#22ad93]` (darker teal)
- **Shadow:** `shadow-sm`
- **Transition:** `transition-colors`

**Disabled State:**
- **Opacity:** `disabled:opacity-50`
- **Cursor:** `disabled:cursor-not-allowed`
- **Required:** `disabled` attribute

**Usage Rules:**
- **When to Use:** Primary action (Generate, Create, Save, Submit)
- **Location:** Sticky action bar (`OBDStickyActionBar`)
- **One Per Form:** Only one primary button per form/section
- **Loading State:** Show spinner + "Generating..." when loading

**Files:**
- Constant: `src/lib/obd-framework/layout-helpers.ts` (SUBMIT_BUTTON_CLASSES)
- Container: `src/components/obd/OBDStickyActionBar.tsx`

---

### 4.2 Secondary Button

**Component:** **PROPOSED** - `SECONDARY_BUTTON_CLASSES` constant

**Proposed Pattern:**
```tsx
const SECONDARY_BUTTON_CLASSES = `px-4 py-2 font-medium rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
  isDark
    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
}`;
```

**Specifications:**

**Styling:**
- **Padding:** `px-4 py-2` (16px horizontal, 8px vertical)
- **Font:** `font-medium`
- **Text Size:** `text-sm`
- **Border Radius:** `rounded-xl` (12px)
- **Background:** `bg-gray-100` (light) / `bg-slate-800` (dark)
- **Text Color:** `text-gray-700` (light) / `text-slate-200` (dark)
- **Hover:** `hover:bg-gray-200` (light) / `hover:bg-slate-700` (dark)
- **Transition:** `transition-colors`

**Disabled State:**
- **Opacity:** `disabled:opacity-50`
- **Cursor:** `disabled:cursor-not-allowed`

**Usage Rules:**
- **When to Use:**
  - Regenerate actions
  - Export actions
  - Cancel actions
  - Secondary form actions
- **Location:** Results panel actions, form secondary actions
- **Multiple Allowed:** Can have multiple secondary buttons

**Implementation Status:** ⚠️ **NOT YET IMPLEMENTED**

**Proposed File:** `src/lib/obd-framework/layout-helpers.ts`

**Current Workaround:**
- Apps use inline className strings
- Should migrate to constant when available

---

### 4.3 Subtle/Text Button

**Component:** **PROPOSED** - `TEXT_BUTTON_SMALL_CLASSES` and `TEXT_BUTTON_MEDIUM_CLASSES` constants

**Proposed Patterns:**

**Small (for copy buttons, inline actions):**
```tsx
const TEXT_BUTTON_SMALL_CLASSES = `px-2 py-1 text-xs font-medium rounded transition-colors ${
  isDark
    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
}`;
```

**Medium (for card actions, tab-like buttons):**
```tsx
const TEXT_BUTTON_MEDIUM_CLASSES = `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
  isDark
    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
}`;
```

**Specifications:**

**Small Button:**
- **Padding:** `px-2 py-1` (8px horizontal, 4px vertical)
- **Text Size:** `text-xs`
- **Border Radius:** `rounded` (4px)
- **Use Cases:** Copy buttons, inline actions, table row actions

**Medium Button:**
- **Padding:** `px-3 py-1.5` (12px horizontal, 6px vertical)
- **Text Size:** `text-xs`
- **Border Radius:** `rounded-lg` (8px)
- **Use Cases:** Card actions, section actions, tab-like buttons

**Styling (Both):**
- **Background:** `bg-slate-100` (light) / `bg-slate-700` (dark)
- **Text Color:** `text-slate-700` (light) / `text-slate-200` (dark)
- **Hover:** `hover:bg-slate-200` (light) / `hover:bg-slate-600` (dark)
- **Transition:** `transition-colors`

**Usage Rules:**
- **When to Use:**
  - Copy to clipboard
  - Expand/collapse
  - Secondary card actions
  - Inline editing
- **Not For:** Primary actions, form submissions
- **Multiple Allowed:** Can have multiple subtle buttons

**Implementation Status:** ⚠️ **NOT YET IMPLEMENTED**

**Proposed File:** `src/lib/obd-framework/layout-helpers.ts`

---

### 4.4 Tab Buttons

**Component:** Inline styling (standardized pattern)

**Standard Pattern:**
```tsx
<button
  onClick={() => setActiveTab(tab.id)}
  role="tab"
  aria-selected={activeTab === tab.id}
  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
    activeTab === tab.id
      ? "bg-[#29c4a9] text-white"
      : isDark
      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
  }`}
>
  {tab.label}
</button>
```

**Specifications:**

**Active State:**
- **Background:** `bg-[#29c4a9]` (brand teal)
- **Text Color:** `text-white`
- **No Border:** Border removed when active

**Inactive State:**
- **Background:** `bg-white` (light) / `bg-slate-700` (dark)
- **Text Color:** `text-slate-700` (light) / `text-slate-300` (dark)
- **Border:** `border border-slate-200` (light only)
- **Hover:** `hover:bg-slate-100` (light) / `hover:bg-slate-600` (dark)

**Styling:**
- **Padding:** `px-4 py-2`
- **Text Size:** `text-sm`
- **Font:** `font-medium`
- **Border Radius:** `rounded-lg` (8px)
- **Transition:** `transition-colors`

**Accessibility:**
- **Required:** `role="tab"`
- **Required:** `aria-selected={activeTab === tab.id}`
- **Required:** Tab container has `role="tablist"`

**Proposed Constant:**
```tsx
const TAB_BUTTON_CLASSES = (isActive: boolean, isDark: boolean) =>
  `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
    isActive
      ? "bg-[#29c4a9] text-white"
      : isDark
      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
      : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
  }`;
```

**Implementation Status:** ⚠️ **NOT YET IMPLEMENTED**

**Proposed File:** `src/lib/obd-framework/layout-helpers.ts`

---

### 4.5 Button Standards Summary

| Type | Constant | Padding | Use Case | Disabled Style |
|------|----------|---------|----------|----------------|
| Primary | `SUBMIT_BUTTON_CLASSES` | `px-6 py-3` | Main action | `opacity-50 cursor-not-allowed` |
| Secondary | `SECONDARY_BUTTON_CLASSES` (proposed) | `px-4 py-2` | Regenerate, Export | `opacity-50 cursor-not-allowed` |
| Subtle Small | `TEXT_BUTTON_SMALL_CLASSES` (proposed) | `px-2 py-1` | Copy, Inline | Inherit from base |
| Subtle Medium | `TEXT_BUTTON_MEDIUM_CLASSES` (proposed) | `px-3 py-1.5` | Card actions | Inherit from base |
| Tab | `TAB_BUTTON_CLASSES` (proposed) | `px-4 py-2` | Tab navigation | N/A (always enabled) |

**Disabled State Rules:**
- **All Buttons:** `disabled:opacity-50 disabled:cursor-not-allowed`
- **Required:** `disabled` attribute on element
- **Visual Feedback:** Reduced opacity + not-allowed cursor
- **Accessibility:** Screen readers announce disabled state

**Usage Guidelines:**
- **One Primary:** Only one primary button per form/section
- **Multiple Secondary:** Can have multiple secondary buttons
- **Subtle for Actions:** Use subtle buttons for non-primary actions
- **Loading States:** Show spinner in primary buttons when loading

---

## 5. Panels & Spacing

### 5.1 Panel Padding

**Component:** `OBDPanel`

**Standard Pattern:**
```tsx
<OBDPanel isDark={isDark} className="mt-7">
  {/* Content */}
</OBDPanel>
```

**Specifications:**

**Default Padding:**
- **Internal:** Check `OBDPanel` component for default padding
- **External:** `mt-7` (28px top margin) for first panel on page
- **Between Panels:** `mt-8` (32px) for subsequent panels

**Panel Variants:**
- **default:** Standard panel with padding
- **toolbar:** Reduced padding for filter bars (check `OBDFilterBar`)

**Files:**
- Component: `src/components/obd/OBDPanel.tsx`

---

### 5.2 Section Spacing

**Standard Pattern:**
```tsx
<div className={`space-y-6 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
  <div>
    <h3 className={`text-sm font-semibold mb-3 ${themeClasses.headingText}`}>
      Section Title
    </h3>
    <div className="space-y-4">
      {/* Fields */}
    </div>
  </div>
  <div className={getDividerClass(isDark)}></div>
  <div>
    {/* Next section */}
  </div>
</div>
```

**Specifications:**

**Form Container:**
- **Spacing:** `space-y-6` (24px between sections)
- **Bottom Offset:** `pb-24` or use `OBD_STICKY_ACTION_BAR_OFFSET_CLASS` for sticky action bar
- **Purpose:** Prevents content from being hidden behind sticky footer

**Section Structure:**
- **Section Container:** `space-y-6` (24px between sections)
- **Section Header:** `mb-3` (12px margin below header)
- **Field Container:** `space-y-4` (16px between fields)
- **Field Label:** `mb-2` (8px margin below label)

**Divider Usage:**
- **Between Sections:** Use `getDividerClass(isDark)` between major sections
- **Styling:** `border-t` with theme-aware color
- **Spacing:** Included in `space-y-6` container

**Result Container:**
- **Spacing:** `space-y-6` (24px between result cards/sections)
- **Grid Spacing:** `gap-4` (16px) for grid layouts

**Files:**
- Helper: `src/lib/obd-framework/layout-helpers.ts` (getDividerClass)
- Constant: `src/components/obd/OBDStickyActionBar.tsx` (OBD_STICKY_ACTION_BAR_OFFSET_CLASS)

---

### 5.3 Spacing Scale

**Standard Spacing Values:**

| Use Case | Class | Value | Example |
|----------|-------|-------|---------|
| Section spacing | `space-y-6` | 24px | Between form sections |
| Field spacing | `space-y-4` | 16px | Between form fields |
| Card spacing | `space-y-6` | 24px | Between result cards |
| Grid gap | `gap-4` | 16px | Grid layouts |
| Label margin | `mb-2` | 8px | Below field labels |
| Section header | `mb-3` | 12px | Below section headers |
| Panel top margin | `mt-7` | 28px | First panel on page |
| Panel spacing | `mt-8` | 32px | Between panels |
| Sticky bar offset | `pb-24` | 96px | Form bottom padding |

**Rules:**
- **Consistent Scale:** Use Tailwind spacing scale (multiples of 4px)
- **Visual Hierarchy:** Larger spacing for major sections, smaller for related items
- **Responsive:** Spacing can be adjusted for mobile (e.g., `space-y-4 md:space-y-6`)

---

### 5.4 Divider Usage

**Component:** `getDividerClass` helper

**Standard Pattern:**
```tsx
<div className={getDividerClass(isDark)}></div>
```

**Specifications:**

**Styling:**
- **Type:** `border-t` (top border)
- **Color:** `border-slate-200` (light) / `border-slate-700` (dark)
- **Width:** Full width of container
- **Height:** 1px (border width)

**Usage Rules:**
- **Between Major Sections:** Use between form sections
- **Not Between Fields:** Don't use between individual fields
- **Spacing:** Included in `space-y-6` container (no extra margin needed)
- **Visual Separation:** Helps break up long forms

**When Not to Use:**
- Between related fields (use `space-y-4` instead)
- Within a single section
- Between result cards (use `space-y-6` instead)

**Files:**
- Helper: `src/lib/obd-framework/layout-helpers.ts` (getDividerClass)

---

### 5.5 Panel & Spacing Standards Summary

| Element | Spacing | Class | Notes |
|---------|---------|-------|-------|
| Form container | 24px | `space-y-6` | Between sections |
| Field container | 16px | `space-y-4` | Between fields |
| Result container | 24px | `space-y-6` | Between cards |
| Grid gap | 16px | `gap-4` | Grid layouts |
| Section header | 12px | `mb-3` | Below header |
| Field label | 8px | `mb-2` | Below label |
| Panel top | 28px | `mt-7` | First panel |
| Panel spacing | 32px | `mt-8` | Between panels |
| Sticky offset | 96px | `pb-24` | Form bottom |

**Divider Rules:**
- Use between major sections only
- Use `getDividerClass(isDark)` helper
- No extra margin needed (included in spacing)

---

## Component Status

### Existing Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| `OBDResultsPanel` | `src/components/obd/OBDResultsPanel.tsx` | ✅ Complete | Handles empty/loading states |
| `OBDStatusBlock` | `src/components/obd/OBDStatusBlock.tsx` | ✅ Complete | Empty/loading/error/success variants |
| `OBDPanel` | `src/components/obd/OBDPanel.tsx` | ✅ Complete | Standard panel container |
| `OBDStickyActionBar` | `src/components/obd/OBDStickyActionBar.tsx` | ✅ Complete | Sticky footer for forms |
| `getErrorPanelClasses` | `src/lib/obd-framework/layout-helpers.ts` | ✅ Complete | Error styling helper |
| `getDividerClass` | `src/lib/obd-framework/layout-helpers.ts` | ✅ Complete | Divider styling helper |
| `SUBMIT_BUTTON_CLASSES` | `src/lib/obd-framework/layout-helpers.ts` | ✅ Complete | Primary button constant |

### Proposed Components

| Component | File | Priority | Use Case |
|-----------|------|----------|----------|
| `OBDSkeleton` | `src/components/obd/OBDSkeleton.tsx` | Medium | Loading existing data |
| `OBDProgressIndicator` | `src/components/obd/OBDProgressIndicator.tsx` | Low | Multi-step processes |
| `OBDButton` | `src/components/obd/OBDButton.tsx` | High | Standardized button component |

### Proposed Constants

| Constant | File | Priority | Use Case |
|----------|------|----------|----------|
| `SECONDARY_BUTTON_CLASSES` | `src/lib/obd-framework/layout-helpers.ts` | High | Regenerate, Export buttons |
| `TEXT_BUTTON_SMALL_CLASSES` | `src/lib/obd-framework/layout-helpers.ts` | High | Copy, inline actions |
| `TEXT_BUTTON_MEDIUM_CLASSES` | `src/lib/obd-framework/layout-helpers.ts` | High | Card actions |
| `TAB_BUTTON_CLASSES` | `src/lib/obd-framework/layout-helpers.ts` | Medium | Tab navigation |

---

## Implementation Checklist

### Phase 1: Constants (High Priority)
- [ ] Add `SECONDARY_BUTTON_CLASSES` to `layout-helpers.ts`
- [ ] Add `TEXT_BUTTON_SMALL_CLASSES` to `layout-helpers.ts`
- [ ] Add `TEXT_BUTTON_MEDIUM_CLASSES` to `layout-helpers.ts`
- [ ] Add `TAB_BUTTON_CLASSES` function to `layout-helpers.ts`

### Phase 2: Components (Medium Priority)
- [ ] Create `OBDSkeleton` component
- [ ] Create `OBDButton` component (wrapper for all button types)
- [ ] Create `OBDProgressIndicator` component

### Phase 3: Migration (Ongoing)
- [ ] Migrate all apps to use new button constants
- [ ] Standardize empty states to use `OBDResultsPanel`
- [ ] Standardize error states to use `getErrorPanelClasses`
- [ ] Update loading states to use `OBDResultsPanel` loading prop
- [ ] Standardize spacing using defined scale

---

## Quick Reference

### Empty State
```tsx
<OBDResultsPanel
  emptyTitle="No [type] yet"
  emptyDescription="Fill out the form above and click &quot;[Action]&quot; to generate your [type]."
/>
```

### Loading State
```tsx
<OBDResultsPanel
  loading={loading}
  loadingText="Generating..."
/>
```

### Error State
```tsx
<div className={getErrorPanelClasses(isDark)}>
  <p className="font-medium mb-2">Error:</p>
  <p>{friendlyErrorMessage}</p>
</div>
```

### Primary Button
```tsx
<button className={SUBMIT_BUTTON_CLASSES}>Action</button>
```

### Secondary Button (Proposed)
```tsx
<button className={SECONDARY_BUTTON_CLASSES}>Action</button>
```

### Spacing
```tsx
<div className="space-y-6"> {/* Sections */}
  <div className="space-y-4"> {/* Fields */}
```

---

**End of Tier 5A Canonical UX Patterns**

