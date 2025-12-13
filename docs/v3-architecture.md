# OBD V3 App Framework - Architecture Documentation

## Overview

The OBD V3 App Framework provides a standardized, reusable architecture for all OBD Premium Apps. This framework ensures consistent layout, interfaces, API contracts, themes, styling, and documentation across all 6 apps.

## Component Architecture

### Core Components (`/src/components/obd/`)

#### `OBDPageContainer.tsx`
The main page wrapper that provides:
- 2-column layout (sidebar + main content)
- Breadcrumb navigation
- Page title and tagline
- Theme toggle integration
- Consistent spacing and container widths

**Usage:**
```tsx
<OBDPageContainer
  isDark={isDark}
  onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
  title="App Title"
  tagline="App description"
>
  {/* Page content */}
</OBDPageContainer>
```

#### `OBDAppSidebar.tsx`
Reusable left sidebar component that:
- Lists all 6 premium apps
- Highlights the active app with `text-[#29c4a9] font-semibold border-l-4 border-[#29c4a9]`
- Maintains consistent styling across all pages
- Uses Next.js routing for navigation

#### `ThemeToggle.tsx`
Centered light/dark mode toggle component:
- Displays current theme state
- Provides visual indicator (colored dot)
- Consistent styling across all apps

#### `OBDPanel.tsx`
Wraps form panels and output panels with:
- Consistent border, padding, and shadow
- Theme-aware styling
- Rounded corners (`rounded-3xl`)
- Hover effects (light mode only)

**Usage:**
```tsx
<OBDPanel isDark={isDark} className="mt-7">
  {/* Form or content */}
</OBDPanel>
```

#### `OBDHeading.tsx`
Provides standardized heading components:
- H1 variant: `text-2xl md:text-3xl font-bold obd-heading`
- H2 variant: `text-lg font-semibold obd-heading`
- Theme-aware text colors

**Usage:**
```tsx
<OBDHeading level={1} isDark={isDark}>
  Page Title
</OBDHeading>
```

## Shared Layout Philosophy

### Container Structure
- **Max width**: `max-w-6xl` (consistent with Review Responder gold standard)
- **Padding**: `px-4 py-10`
- **Layout**: Flexbox with `flex-col lg:flex-row gap-8`
- **Sidebar width**: `lg:w-72` with sticky positioning (`lg:sticky lg:top-28`)

### Panel System
All form and output panels use:
- `rounded-3xl` border radius
- `px-6 py-6 md:px-8 md:py-7` padding
- Theme-aware backgrounds and borders
- Shadow effects (enhanced on hover in light mode)

### Spacing Standards
- Form sections: `space-y-6` or `space-y-4`
- Section dividers: `border-t` with theme-aware colors
- Panel margins: `mt-7` for forms, `mt-8` for results

## Theme System

### Theme Utilities (`/src/lib/obd-framework/theme.ts`)

The theme system provides:
- `getThemeClasses(isDark: boolean)`: Returns all theme-aware CSS classes
- `getPanelClasses(isDark: boolean)`: Returns panel styling classes
- `getInputClasses(isDark: boolean, additionalClasses?)`: Returns input field classes

### Theme Classes
- **Page background**: `bg-slate-950` (dark) / `bg-slate-50` (light)
- **Panel background**: `bg-slate-900/80` (dark) / `bg-white` (light)
- **Input background**: `bg-slate-800` (dark) / `bg-white` (light)
- **Text colors**: Theme-aware for headings, labels, muted text, etc.

### Color Palette
- **Primary accent**: `#29c4a9` (OBD teal)
- **Hover state**: `#22ad93`
- **Focus ring**: `focus:ring-2 focus:ring-[#29c4a9]`

## Sidebar + Panel System

### Sidebar Active State
Active app is highlighted with:
```tsx
className="text-[#29c4a9] font-semibold border-l-4 border-[#29c4a9] pl-4 bg-transparent"
```

### Panel Consistency
- Form panels and output panels use identical styling
- Consistent shadow depths and hover effects
- Same border radius and padding across all apps

## Layout Helpers (`/src/lib/obd-framework/layout-helpers.ts`)

Utility functions for:
- Container widths: `CONTAINER_WIDTH = "mx-auto max-w-6xl px-4 py-10"`
- Sidebar width: `SIDEBAR_WIDTH = "lg:w-72 lg:sticky lg:top-28 self-start mb-8 lg:mb-0"`
- Page backgrounds: `getPageBackground(isDark)`
- Dividers: `getDividerClass(isDark)`
- Breadcrumbs: `getBreadcrumbClasses(isDark)`
- Error panels: `getErrorPanelClasses(isDark)`
- Submit buttons: `SUBMIT_BUTTON_CLASSES`

## Form Types (`/src/lib/obd-framework/form-types.ts`)

Shared TypeScript interfaces:
- `BaseBusinessInfo`: Business name, type, services, city, state
- `BaseBrandVoice`: Brand voice and personality style
- `BaseContentOptions`: Language and length options
- `BaseFormPayload`: Extendable base for all app form payloads

## Response Types (`/src/lib/obd-framework/response-types.ts`)

Shared response interfaces:
- `BaseErrorResponse`: Error response structure
- `BaseSuccessResponse`: Success response wrapper
- `ConditionalOutputItem`: For FAQ items, Q&A boxes, etc.
- `BaseAppResponse`: Extendable base for all app responses

## How to Create a New App Using the Framework

### Step 1: Create the Page Component
```tsx
"use client";

import { useState } from "react";
import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses, getInputClasses } from "@/lib/obd-framework/theme";
import { SUBMIT_BUTTON_CLASSES, getErrorPanelClasses } from "@/lib/obd-framework/layout-helpers";

export default function NewAppPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  // Your form state and logic here

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Your App Title"
      tagline="Your app description"
    >
      <OBDPanel isDark={isDark} className="mt-7">
        {/* Your form */}
      </OBDPanel>

      <OBDPanel isDark={isDark} className="mt-8">
        {/* Your results */}
      </OBDPanel>
    </OBDPageContainer>
  );
}
```

### Step 2: Use Framework Utilities
- Use `getThemeClasses(isDark)` for all theme-aware classes
- Use `getInputClasses(isDark)` for form inputs
- Use `OBDPanel` for all panels
- Use `OBDHeading` for headings
- Use `SUBMIT_BUTTON_CLASSES` for submit buttons

### Step 3: Add to Sidebar
Add your app to the `apps` array in `/src/components/obd/OBDAppSidebar.tsx`:
```tsx
{
  title: "Your App Title",
  href: "/apps/your-app",
}
```

### Step 4: Follow API Contract Standard
See `/docs/app-contract-standard.md` for request/response structure requirements.

## Best Practices

1. **Always use framework components** instead of custom layout markup
2. **Use theme utilities** instead of hardcoded theme classes
3. **Maintain consistent spacing** using framework standards
4. **Preserve all form logic** when refactoring
5. **Keep API calls unchanged** - only refactor UI
6. **Test theme switching** on all pages
7. **Verify sidebar active state** highlights correctly

## Migration Notes

When migrating existing apps:
- Replace `<main>` wrapper with `<OBDPageContainer>`
- Replace sidebar markup with framework sidebar (already included in container)
- Replace form/result panels with `<OBDPanel>`
- Replace headings with `<OBDHeading>`
- Replace theme toggle markup with framework toggle (already included in container)
- Replace hardcoded theme classes with `getThemeClasses()` utilities
- Replace input classes with `getInputClasses()`
- Preserve all form state, validation, and API logic

