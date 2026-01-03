# AI Business Description Writer - Changelog

All notable changes to the AI Business Description Writer app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## V5.0.0 — Premium Fix Packs & Enhanced Workflow (2025-01-XX)

### Added

- **Description Health Check**: Analysis-only quality assessment panel
  - Checks for location mentions (city/state) in descriptions
  - Identifies missing service keyword mentions
  - Validates length against recommended limits (Directory: 180 chars, Citations: 140 chars, Meta: 160 chars)
  - Flags risky claims (guarantee, best, #1, cure, miracle, always, never, 100%)
  - Provides actionable recommendations without making changes
  - Location: `src/components/bdw/DescriptionHealthCheck.tsx`

- **Premium Fix Packs**: Deterministic improvement system with preview
  - **Fix Pack Types**:
    - Add Location: Adds city/state references to descriptions missing location
    - Trim Length: Optimizes descriptions exceeding character limits
    - Service Mentions: Adds key services to descriptions
    - Safer Claims: Replaces risky phrases with trustworthy language
    - Meta Optimization: Improves meta description for SEO and length
  - **Preview System**: Side-by-side diff view showing before/after changes
  - **Apply/Reset**: Manual apply with reset to original functionality
  - **Save Improved**: Save edited version to database/localStorage
  - **Push Improved**: Send improved content to AI Help Desk Knowledge
  - Location: `src/components/bdw/FixPacks.tsx`, `src/lib/utils/bdw-fix-packs.ts`

- **V5-4 Polish Features**:
  - **Apply All Recommended**: Batch apply all fix packs with confirmation dialog
    - Shows preview of all packs to be applied
    - Applies fixes in priority order
    - Single onApply call to avoid state churn
  - **Undo Stack**: History-based undo functionality
    - Tracks edit history before each fix application
    - Undo button in Fix Packs top actions
    - Clears history on reset or new generation
  - **Edited Badges**: Visual indicators on Use Case Tabs
    - Shows "Edited" pill badge on tab labels when content is edited
    - Gated behind `flags.bdwV4`
  - **Smooth Scroll**: Auto-scroll to preview container when expanding fix pack
    - Uses `scrollIntoView` with smooth behavior
    - Improves UX when previewing multiple packs

### Changed

- **Use Case Tabs**: Added `isEdited` prop to show edited state badges
  - Badge appears on all tabs when `editedResult` exists
  - Styled to match active/inactive tab states

### Technical Details

- **Fix Pack System**: Rule-based transformations (no AI calls)
  - All fixes are deterministic and previewable
  - No automatic changes — user must explicitly apply
  - Original result preserved — edits stored in `editedResult` state
- **History Management**: Edit history stack in page component
  - Pushes state to history before applying fixes
  - Supports single-level undo
  - Clears on reset or new generation

## V4.5 — Database-Backed Saved Versions (2025-01-XX)

### Added

- **Database-Backed Saved Versions**: Cloud storage with local fallback
  - DB-first approach: attempts database save first
  - Automatic localStorage fallback when database unavailable
  - Seamless migration from localStorage to database
  - Uses existing `BdwSavedVersion` database model
  - Location: `src/lib/utils/bdw-saved-versions-db.ts`

- **CRM Note Pack**: Copy-formatted content for CRM systems
  - Structured format for easy pasting into CRM notes
  - Deep link support (copy-only, no writes)
  - Includes business name, location, and key descriptions
  - Location: `src/lib/utils/bdw-crm-note-pack.ts`

### Changed

- **Saved Versions Panel**: Enhanced with database integration
  - Automatically uses database when businessId available
  - Falls back to localStorage when database unavailable
  - User-friendly messaging for fallback scenarios

## V4.0 — Enhanced Workflow & Integration (2025-01-XX)

### Added

- **Use Case Tabs**: Tabbed interface for viewing descriptions by use case
  - **Tabs**: Directory Listing, Google Business Profile, Website/About Page, Citations/Short Bio
  - Character count display per tab
  - Copy-to-clipboard functionality for each tab
  - Active tab highlighting with theme-aware styling
  - Location: `src/app/apps/business-description-writer/page.tsx` (UseCaseTabs component)

- **SERP Preview**: Visual preview of meta description in search results format
  - Shows title, URL, and description as they appear in Google
  - Real-time character count feedback
  - Theme-aware styling (light/dark mode)
  - Location: `src/components/seo/SerpPreview.tsx`

- **Saved Versions Panel**: Save and manage description versions
  - **localStorage Storage**: Client-side version storage (V4)
  - **Export/Import**: JSON export/import functionality
  - **Load Inputs**: Load saved form inputs to regenerate descriptions
  - **Version Management**: View, load, and manage saved versions
  - Modal panel with search and filtering
  - Location: `src/components/bdw/SavedVersionsPanel.tsx`, `src/lib/utils/bdw-saved-versions.ts`

- **Content Reuse Suggestions**: Panel with actionable reuse options
  - **Push to AI Help Desk Knowledge**: One-click upsert to knowledge base
    - Requires businessId (from dashboard or URL param)
    - Uses `/api/ai-help-desk/knowledge/upsert` endpoint
    - Tenant-safe with businessId validation
  - **Copy CRM Note Pack**: Copy-formatted content for CRM systems
  - **Tip Messaging**: Helpful guidance when businessId unavailable
  - Location: `src/components/bdw/ContentReuseSuggestions.tsx`

- **BusinessId Resolver Utility**: Resolve businessId from multiple sources
  - URL parameter: `?businessId=xxx`
  - Future: session-based resolution
  - Future: context-based resolution
  - Location: `src/lib/utils/resolve-business-id.ts`

- **Help Desk Integration**: Direct push to AI Help Desk Knowledge base
  - Integration with AI Help Desk upsert endpoint
  - BusinessId validation and error handling
  - Success/error state management
  - Location: `src/lib/utils/bdw-help-desk-integration.ts`

### Changed

- **Results Display**: Migrated to Use Case Tabs (V4) or legacy cards (non-V4)
  - V4 enabled: Tabbed interface with copy functionality
  - V4 disabled: Legacy result cards (backward compatible)

### Technical Details

- **Feature Flag**: All V4 features gated behind `flags.bdwV4`
- **Backward Compatible**: Legacy UI remains functional when V4 disabled
- **No API Changes**: Existing API endpoints unchanged
- **No DB Changes**: V4 uses localStorage only (database added in V4.5)

