# OBD UI System – Shared Components

This document describes the standardized UI components available for OBD Premium Apps. These components ensure consistency across the suite while maintaining flexibility for app-specific needs.

**Location:** `src/components/obd/`

**Safety Note:** All components are additive and backward compatible. They do not modify business logic, API calls, handlers, validation, or state management.

---

## Toolbar Patterns

Two toolbar patterns are available depending on the layout needs:

### 1. CRM-Style Left/Right Layout

For toolbars with distinct left (filters/search) and right (actions) groups:

```tsx
import OBDStickyToolbar from "@/components/obd/OBDStickyToolbar";
import OBDToolbarRow from "@/components/obd/OBDToolbarRow";
import OBDPanel from "@/components/obd/OBDPanel";

<OBDStickyToolbar isDark={isDark} topOffset="0" className="mt-6">
  <OBDPanel isDark={isDark} variant="toolbar" className="border-0 shadow-none rounded-none">
    <OBDToolbarRow
      left={
        <>
          {/* Search, filters, toggles */}
        </>
      }
      right={
        <>
          {/* Action buttons */}
        </>
      }
    />
  </OBDPanel>
</OBDStickyToolbar>
```

**Components:**
- `OBDStickyToolbar`: Sticky wrapper with backdrop blur and border
- `OBDToolbarRow`: Flex layout helper separating left/right content
- `OBDPanel variant="toolbar"`: Tighter padding for toolbar contexts

**Responsive Behavior:**
- Mobile: Left and right groups stack vertically
- Desktop (lg+): Single row with `justify-between`

### 2. Inline Filter Bar

For wrap-friendly filter rows (search + dropdowns + pills + toggles):

```tsx
import OBDFilterBar from "@/components/obd/OBDFilterBar";

<OBDFilterBar sticky={true} isDark={isDark} usePanel={false} className="mb-4">
  {/* Filters, search, controls */}
</OBDFilterBar>
```

**Props:**
- `sticky?: boolean` - Enable sticky positioning (default: `false`)
- `isDark?: boolean` - Theme mode
- `usePanel?: boolean` - Use `OBDPanel` wrapper (default: `true`)
- `topOffset?: string | number` - Sticky top offset
- `className?: string` - Additional classes

**Responsive Behavior:**
- Mobile: Stacks vertically
- Desktop (md+): Single row, wraps when needed
- Large (lg+): Single row, no wrapping

---

## Sticky Action Bar (Form Apps)

For form-based applications that need a sticky bottom action bar:

```tsx
import OBDStickyActionBar, { OBD_STICKY_ACTION_BAR_OFFSET_CLASS } from "@/components/obd/OBDStickyActionBar";

// In your form
<form>
  <div className={`space-y-6 ${OBD_STICKY_ACTION_BAR_OFFSET_CLASS}`}>
    {/* Form fields */}
  </div>
  
  <OBDStickyActionBar isDark={isDark} left={optionalLeftContent}>
    <button type="submit">Generate</button>
    <button>Export</button>
  </OBDStickyActionBar>
</form>
```

**Props:**
- `isDark?: boolean` - Theme mode
- `left?: ReactNode` - Optional left-aligned content
- `topBorder?: boolean` - Show top border (default: `true`)
- `safeArea?: boolean` - Mobile safe area padding (default: `true`)
- `className?: string` - Additional classes

**Important:**
- Add `OBD_STICKY_ACTION_BAR_OFFSET_CLASS` (or `pb-24`) to main content wrapper to prevent content overlap
- Keep buttons inside `<form>` to preserve keyboard submit behavior

**Mobile Support:**
- Buttons wrap on mobile
- Safe area padding for iOS devices
- Sticky positioning works within scroll container

---

## Results Panel + Actions

For displaying generated output/results with consistent layout:

```tsx
import OBDResultsPanel from "@/components/obd/OBDResultsPanel";
import OBDResultsActions from "@/components/obd/OBDResultsActions";

<OBDResultsPanel
  title="Generated Content"
  subtitle="Optional subtitle"
  isDark={isDark}
  loading={loading}
  loadingText="Generating content..."
  emptyTitle="No results yet"
  emptyDescription="Fill out the form to generate content."
  actions={
    <OBDResultsActions
      isDark={isDark}
      onCopy={handleCopy}
      onDownloadTxt={handleDownload}
      onClear={handleClear}
      extra={<button>Regenerate</button>}
      copied={copied}
      disabled={loading}
    />
  }
  className="mt-8"
>
  {/* Results content */}
</OBDResultsPanel>
```

### OBDResultsPanel Props

- `title: string` - Panel title
- `subtitle?: string` - Optional subtitle
- `isDark?: boolean` - Theme mode
- `actions?: ReactNode` - Right-side action buttons (typically `OBDResultsActions`)
- `loading?: boolean` - Show loading state
- `loadingText?: string` - Loading message (uses `OBDStatusBlock` if provided)
- `emptyTitle?: string` - Empty state title (uses `OBDStatusBlock` if provided)
- `emptyDescription?: string` - Empty state description
- `emptyState?: ReactNode` - Custom empty state (fallback if `emptyTitle` not provided)
- `className?: string` - Additional classes

### OBDResultsActions Props

- `isDark?: boolean` - Theme mode
- `onCopy?: () => void` - Copy button handler
- `onDownloadTxt?: () => void` - Download .txt button handler
- `onClear?: () => void` - Clear button handler
- `extra?: ReactNode` - Additional action buttons
- `disabled?: boolean` - Disable all buttons
- `copied?: boolean` - Copy button visual feedback state

**Responsive Behavior:**
- Actions wrap on mobile
- Single row on large screens (lg+)

---

## Status Blocks (Empty / Loading / Error)

For consistent empty, loading, error, and success states:

```tsx
import OBDStatusBlock from "@/components/obd/OBDStatusBlock";

// Empty state
<OBDStatusBlock
  variant="empty"
  title="No results yet"
  description="Fill out the form to generate content."
  isDark={isDark}
/>

// Loading state
<OBDStatusBlock
  variant="loading"
  title="Generating content..."
  isDark={isDark}
/>

// Error state
<OBDStatusBlock
  variant="error"
  title="Error"
  description="Something went wrong."
  isDark={isDark}
  actions={<button>Try Again</button>}
/>

// Success state
<OBDStatusBlock
  variant="success"
  title="Success!"
  description="Operation completed successfully."
  isDark={isDark}
/>
```

**Props:**
- `variant: "empty" | "loading" | "error" | "success"` - Status type
- `title: string` - Status title
- `description?: string` - Optional description
- `icon?: ReactNode` - Custom icon (default icons per variant)
- `actions?: ReactNode` - Optional action buttons
- `isDark?: boolean` - Theme mode
- `className?: string` - Additional classes

**Integration with OBDResultsPanel:**

`OBDResultsPanel` automatically uses `OBDStatusBlock` when:
- `loading={true}` and `loadingText` is provided → `variant="loading"`
- No children and `emptyTitle` is provided → `variant="empty"`

This provides seamless status messaging without manual `OBDStatusBlock` usage in most cases.

---

## Best Practices

1. **Theme Consistency**: Always pass `isDark` prop to match app theme
2. **Responsive Design**: Components handle responsive behavior automatically; avoid custom overrides
3. **Content Padding**: Use `OBD_STICKY_ACTION_BAR_OFFSET_CLASS` for sticky action bars
4. **Error Handling**: Keep app-specific error UI outside `OBDResultsPanel`; use `OBDStatusBlock variant="error"` for consistent styling
5. **Loading States**: Prefer `loadingText` prop over custom loading UI in `OBDResultsPanel`
6. **Empty States**: Prefer `emptyTitle` + `emptyDescription` over custom `emptyState` for consistency

---

## Component Files

- `src/components/obd/OBDStickyToolbar.tsx`
- `src/components/obd/OBDToolbarRow.tsx`
- `src/components/obd/OBDFilterBar.tsx`
- `src/components/obd/OBDStickyActionBar.tsx`
- `src/components/obd/OBDResultsPanel.tsx`
- `src/components/obd/OBDResultsActions.tsx`
- `src/components/obd/OBDStatusBlock.tsx`
- `src/components/obd/OBDPanel.tsx` (enhanced with `variant="toolbar"`)

---

## Migration Notes

When migrating apps to use shared components:

1. **No Business Logic Changes**: Only wrap existing UI elements; do not modify handlers, API calls, validation, or state
2. **Preserve Functionality**: Maintain existing behavior (form submission, keyboard shortcuts, etc.)
3. **Test Responsively**: Verify mobile and desktop layouts
4. **Theme Consistency**: Ensure `isDark` prop matches app theme state

---

For design system guidelines (colors, spacing, typography), see [Design System](design-system.md).

