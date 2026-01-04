# Tier 4 Complete Verification Checklist

## Tier 4A: BDW Reuse Kit Integration

### Business Description Writer (BDW)
- [ ] Brand Profile panel appears at top of form
- [ ] Brand Profile auto-fills form fields when applied
- [ ] Fix Packs tab shows suggestions based on health check
- [ ] Fix Pack preview modal shows before/after comparison
- [ ] Fix Pack apply updates content in tabs
- [ ] Fix Pack undo restores previous state
- [ ] Fix Pack reset returns to original content
- [ ] Quality Controls tab runs analysis (hype words, repetitions, readability)
- [ ] Quality Controls can preview and apply fixes
- [ ] Export Center tab shows all export options
- [ ] Export Center copy buttons work (plain, markdown, HTML)
- [ ] Export Center download buttons work (.txt, .md)
- [ ] Copy Bundles component shows platform-specific bundles
- [ ] Copy Bundles buttons copy correct content

### Content Writer (CW)
- [ ] Brand Profile panel appears at top of form
- [ ] Brand Profile auto-fills form fields when applied
- [ ] Fix Packs tab shows suggestions based on quality analysis
- [ ] Fix Pack preview modal shows proposed changes
- [ ] Fix Pack apply updates content sections
- [ ] Fix Pack undo restores previous state
- [ ] Fix Pack reset returns to original content
- [ ] Quality Controls tab runs analysis
- [ ] Quality Controls can preview and apply fixes
- [ ] Export Center tab shows export options
- [ ] Export Center copy buttons work (plain, markdown, HTML)
- [ ] Export Center download buttons work (.txt, .md)
- [ ] Copy Bundles component shows SEO/Content/Full bundles
- [ ] Copy Bundles buttons copy correct content

### Social Media Post Creator (SMPC)
- [ ] Brand Profile panel appears at top of form
- [ ] Brand Profile influences tone hints (UI-only)
- [ ] Fix Packs tab shows suggestions for posts
- [ ] Fix Pack preview modal shows post changes
- [ ] Fix Pack apply updates post text
- [ ] Fix Pack undo restores previous posts
- [ ] Fix Pack reset returns to original posts
- [ ] Quality Controls tab runs analysis on posts
- [ ] Quality Controls can preview and apply fixes
- [ ] Export Center tab shows platform-aware exports
- [ ] Export Center copy buttons work (all posts, by platform)
- [ ] Export Center download buttons work (.txt)
- [ ] Copy Bundles component shows platform bundles (Facebook, Instagram, X, LinkedIn, GBP)
- [ ] Copy Bundles buttons copy correct platform content

### Local SEO Page Builder (LSEO)
- [ ] Brand Profile panel appears (in BDW Tools)
- [ ] Brand Profile auto-fills form fields when applied
- [ ] Fix Packs tab shows suggestions for page copy
- [ ] Fix Pack preview shows proposed changes
- [ ] Fix Pack apply updates page copy
- [ ] Fix Pack undo restores previous copy
- [ ] Quality Controls tab runs analysis
- [ ] Quality Controls can preview and apply fixes
- [ ] Export Center tab shows export options
- [ ] Export Center copy buttons work (plain, markdown, HTML)
- [ ] Export Center download buttons work (.txt, .md, .html)
- [ ] Export buttons in results panel work (.txt, .html, .json)

## Tier 4B: Destination Export Helpers (if implemented)
- [ ] BDW export helpers format content correctly
- [ ] Export helpers handle all destination types
- [ ] Export helpers preserve formatting

## Tier 4C: WorkflowGuidance Component

### All Apps
- [ ] WorkflowGuidance component appears after Brand Profile panel
- [ ] Step indicator shows "1. Business details" when form is empty
- [ ] Step indicator updates to "2. Generate" when form is filled
- [ ] Step indicator updates to "3. Fix & Export" when content is generated
- [ ] Completed steps show checkmark (✓)
- [ ] Active step is highlighted in blue
- [ ] Contextual hint text updates based on current step
- [ ] Dismiss button (✕) hides the component
- [ ] Dismissed state persists in localStorage after page refresh
- [ ] Component reappears after clearing localStorage

### Per-App Storage Keys
- [ ] BDW: `bdw-workflow-guidance-dismissed`
- [ ] Content Writer: `cw-workflow-guidance-dismissed`
- [ ] Social Media Post Creator: `smpc-workflow-guidance-dismissed`
- [ ] Local SEO Page Builder: `lseo-workflow-guidance-dismissed`

## Tier 4D: Local Analytics + AnalyticsDetails

### Analytics Utility (`src/lib/bdw/local-analytics.ts`)
- [ ] `getLocalAnalytics()` reads from localStorage correctly
- [ ] `setLocalAnalytics()` writes to localStorage correctly
- [ ] `recordGeneration()` stores timestamp
- [ ] `recordFixPackApplied()` stores fix pack ID
- [ ] `recordExport()` stores export type (normalized)
- [ ] `normalizeExportType()` maps legacy values correctly
- [ ] `formatLastUsed()` formats timestamps correctly ("2h ago", "3d ago", etc.)

### AnalyticsDetails Component
- [ ] Component appears in BDW Tools panel header (right side)
- [ ] Component only shows when analytics data exists
- [ ] "Details" button opens dropdown
- [ ] Dropdown shows "Last Used" section
- [ ] Dropdown shows "Generated: X ago" when available
- [ ] Dropdown shows "Fix Pack: [id]" when available
- [ ] Dropdown shows "Export: [type]" when available
- [ ] Dropdown closes when clicking outside
- [ ] Component is silent by default (no UI spam)

### Business Description Writer (BDW)
- [ ] Storage key: `bdw-analytics`
- [ ] Generation recorded after successful content generation
- [ ] Fix pack ID recorded when fix pack is applied
- [ ] Export type recorded when copy/download is used
- [ ] AnalyticsDetails shows in Content Packs Tabs header
- [ ] AnalyticsDetails displays correct Last Used info

### Content Writer (CW)
- [ ] Storage key: `cw-analytics`
- [ ] Generation recorded after successful content generation
- [ ] Fix pack ID recorded when fix pack is applied
- [ ] Export type recorded for all export actions
- [ ] AnalyticsDetails shows in BDW Tools Tabs header
- [ ] AnalyticsDetails displays correct Last Used info

### Social Media Post Creator (SMPC)
- [ ] Storage key: `smpc-analytics`
- [ ] Generation recorded after successful post generation
- [ ] Fix pack ID recorded when fix pack is applied
- [ ] Export type recorded for platform exports and bundles
- [ ] AnalyticsDetails shows in BDW Tools Tabs header
- [ ] AnalyticsDetails displays correct Last Used info

### Local SEO Page Builder (LSEO)
- [ ] Storage key: `lseo-analytics`
- [ ] Generation recorded after successful page generation
- [ ] Export type recorded for all export actions (.txt, .html, .json)
- [ ] AnalyticsDetails shows in BDW Tools panel header
- [ ] AnalyticsDetails displays correct Last Used info

### Export Type Standardization
- [ ] All apps use standardized export types:
  - [ ] Copy: `copy:plain`, `copy:markdown`, `copy:html`, `copy:meta`
  - [ ] Download: `download:txt`, `download:md`, `download:html`, `download:json`
  - [ ] Bundles: `bundle:seo`, `bundle:content`, `bundle:full`, `bundle:facebook`, etc.
  - [ ] Platform: `platform:facebook`, `platform:instagram`, `platform:x`, etc.
  - [ ] Blocks: `block:gbp`, `block:website`, `block:social-bio`, etc.
- [ ] Legacy values are normalized automatically
- [ ] AnalyticsDetails displays normalized export types

## Cross-App Verification

### Mobile Responsiveness
- [ ] All BDW Tools tabs stack properly on mobile
- [ ] WorkflowGuidance steps wrap on small screens
- [ ] AnalyticsDetails dropdown positions correctly on mobile
- [ ] Export buttons wrap properly on mobile

### State Management
- [ ] Edited content state works correctly (editedPosts/editedContent)
- [ ] Edit history supports undo functionality
- [ ] Reset functionality restores original content
- [ ] No state conflicts between apps

### localStorage
- [ ] Each app uses unique storage keys (no conflicts)
- [ ] Analytics data persists across page refreshes
- [ ] WorkflowGuidance dismissal persists across refreshes
- [ ] No localStorage errors in console

## Final Checks
- [ ] No console errors when using any feature
- [ ] No TypeScript/linter errors
- [ ] All components render without errors
- [ ] All buttons and interactions work as expected
- [ ] Analytics tracking is silent (no user-facing errors)
- [ ] Backward compatibility maintained for legacy export types

