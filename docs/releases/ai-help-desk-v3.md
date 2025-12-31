# AI Help Desk V3 - Release Notes

**Release Date:** January 2025  
**Version:** V3  
**Status:** Production Ready

---

## Overview

AI Help Desk V3 is a complete knowledge management and customer support solution for OBD businesses. This release includes comprehensive features: Knowledge Manager (CRUD for FAQs, Services, Policies, Notes), Insights Dashboard (question analytics and knowledge gaps), Website Import (automated content extraction), and a fully-featured Website Chat Widget with embed support, domain allowlist warnings, and non-blocking analytics. All features are production-ready with strict security, tenant isolation, and a non-blocking design philosophy.

---

## Core Features

### 1. Knowledge Manager

**Complete CRUD for Help Desk Knowledge**

Businesses can manage their help desk knowledge directly within OBD:

- **Entry Types:** FAQ, Service, Policy, Note
- **Full CRUD Operations:** Create, read, update, delete entries
- **Tags System:** Add tags to entries for better organization
- **Active/Inactive Toggle:** Control which entries are visible in the help desk
- **Filtering:** Filter by type (FAQ, Service, Policy, Note, or All)
- **Search:** Search entries by title or content
- **Empty States:** Helpful messaging when no entries exist

**API Routes:**
- `GET /api/ai-help-desk/knowledge/list` - List entries with filtering
- `POST /api/ai-help-desk/knowledge/upsert` - Create or update entry
- `POST /api/ai-help-desk/knowledge/delete` - Delete entry

---

### 2. Insights Dashboard

**Question Analytics and Knowledge Gap Identification**

Track questions asked and identify knowledge gaps:

- **Question Logging:** `AiHelpDeskQuestionLog` model tracks all user questions
- **Source Tracking:** Logs whether answers had sources and how many
- **Response Quality:** Records AI response quality (GOOD, WEAK, NONE)
- **Top Questions:** Identifies frequently asked questions (top 20)
- **Knowledge Gaps:** Highlights questions with no sources or low quality
- **"Create FAQ" Action:** Convert a logged question directly into a new FAQ entry
- **Period Filtering:** 7/30/60/90 day periods

**API Routes:**
- `GET /api/ai-help-desk/insights/summary` - Provides analytics summary
- `POST /api/ai-help-desk/chat` - Updated to log questions and metadata

---

### 3. Website Import

**Automated Knowledge Extraction from Websites**

Import content from business websites to quickly populate the knowledge base:

- **URL Input:** Enter a website URL for crawling
- **Limited Crawling:** Max 10 pages, same-domain only, prioritizes common pages (about, services, FAQ)
- **Content Preview:** Shows extracted title and text snippets
- **Manual Selection:** Choose which pages/sections to import
- **Heuristic Categorization:** Automatically suggests entry types (FAQ, Service, Policy, Note)
- **Autofill URL:** Prefills from business profile if available
- **Recently Used URLs:** Stores last 5 URLs in `localStorage` for quick access
- **Drag-and-Drop:** Supports dragging URLs into the input field
- **UX Polish:** Improved validation, icons, layout, and helper texts

**API Routes:**
- `POST /api/ai-help-desk/import/preview` - Crawls URL and extracts content
- `POST /api/ai-help-desk/import/commit` - Saves selected content as knowledge entries

---

### 4. Website Chat Widget

**Embeddable AI Assistant for Business Websites**

A public-facing chat widget that can be embedded on any website:

#### Embedding Options
- **Iframe Embed (Recommended):** Safest option, works in any HTML page
- **Script Embed:** JavaScript injection option for automatic widget loading
- **Copy Functionality:** One-click copy to clipboard with fallback selection

#### Widget Configuration
- **Enable/Disable Toggle:** Control widget availability
- **Brand Color Picker:** Customize widget color
- **Greeting Message:** Customizable welcome message
- **Position Selection:** Bottom-right or bottom-left
- **Assistant Avatar:** Optional profile image with initials fallback
- **Theme Presets:** Minimal, Bold, Clean styling options
- **Brand Color Auto-Sync:** Toggle to match OBD brand color (localStorage-based)

#### Domain Allowlist (Warn-Only)
- **Domain Management:** Add/remove allowed domains for embedding
- **Warning System:** Shows warning if domain not in allowlist (never blocks widget)
- **Safe Default:** Empty allowlist means widget works everywhere

#### Analytics (Non-Blocking)
- **Event Tracking:** Logs `widget_open` and `message_sent` events
- **Non-Blocking Design:** Analytics failures never affect widget functionality
- **Event Storage:** `AiHelpDeskWidgetEvent` table stores events with metadata

#### Security
- **Widget Keys:** `AiHelpDeskWidgetKey` for authentication
- **Key Rotation:** Rotate keys if compromised
- **Rate Limiting:** In-memory rate limiting for widget endpoints
- **No Secrets Exposed:** Widget never exposes AnythingLLM credentials

**API Routes:**
- `GET /api/ai-help-desk/widget/settings` - Fetch widget settings
- `POST /api/ai-help-desk/widget/settings` - Update widget settings
- `POST /api/ai-help-desk/widget/rotate-key` - Generate new public key
- `POST /api/ai-help-desk/widget/chat` - Widget-specific chat API
- `POST /api/ai-help-desk/widget/validate-domain` - Domain validation (public, warn-only)
- `POST /api/ai-help-desk/widget/events` - Analytics events (public, non-blocking)

---

## New Features & Enhancements

### 1. Widget Live Preview

**Real-time Preview of Widget Appearance**

Users can now see exactly how their widget will look before saving:

- **Live Preview Panel:** Shows widget bubble and mini widget window
- **Dynamic Updates:** Preview updates instantly as form values change (color, avatar, greeting, position)
- **Responsive:** Desktop shows preview always; mobile has "Show/Hide Preview" toggle
- **Interactive:** Click bubble to open/close mini widget window
- **Example Messages:** Shows greeting and example user/assistant messages

**Implementation:**
- Uses current form state (no save required)
- Positioned correctly based on position setting
- Avatar/initials display matches actual widget behavior

---

### 2. Widget Theme Presets

**Three Styling Options: Minimal, Bold, Clean**

Users can choose a visual style for their widget:

- **Minimal:** Subtle borders, soft shadows, calm spacing
- **Bold:** Strong contrast, larger bubble, prominent accents
- **Clean:** Balanced modern default with clear spacing

**Features:**
- Applied to both preview and actual widget
- Preference stored in localStorage (per business)
- Default styling when no preset selected
- Helper text: "Presets only change styling — your knowledge + answers stay the same."

---

### 3. Brand Color Auto-Sync

**Automatic Brand Color Matching**

Keep widget color in sync with OBD brand color:

- **Toggle:** "Auto-sync brand color" checkbox
- **Override Detection:** Automatically detects when user manually changes color
- **Revert Option:** "Revert to synced" button when overridden
- **Graceful Fallback:** Shows helpful message if no brand color found yet
- **Persistence:** Toggle state stored in localStorage

**Implementation:**
- Default OFF (no change for existing users)
- Syncs on load and when OBD brand color changes
- Respects user overrides

---

### 4. Assistant Avatar Enhancements

**Complete Avatar Management System**

Enhanced avatar features for widget personalization:

- **Image Upload:** URL input with live preview
- **Tooltip:** Helpful image size recommendations (250×250, transparent PNG)
- **Quick-Fill:** "Use OBD Icon" button for instant setup
- **Initials Fallback:** Shows business initials when avatar missing/fails
- **Applied Everywhere:** Avatar appears in bubble, header, and messages

**Accessibility:**
- Proper `aria-label` attributes
- Alt text for images
- Keyboard accessible

---

### 5. Website Import Polish

**Enhanced URL Import Experience**

Improved website import workflow:

- **Drag-and-Drop:** Drop URLs directly into input field
- **Recent URLs:** Last 5 successfully used URLs stored and displayed as chips
- **Autofill:** Automatically fills from business profile website URL (when available)
- **Visual Feedback:** Drag-over highlight, error messages, helper text
- **URL Validation:** Real-time validation with clear error messages

**UX Improvements:**
- Globe icon inside input
- Better placeholder text
- Truncated URL display with hover tooltips
- Clear recent URLs action

---

### 6. UX Copy Updates

**Friendlier, More Trustworthy Messaging**

Updated copy throughout the app:

- **Business Connection Warning:** Changed from technical "No business connection found for this business ID" to friendly "This business isn't connected yet"
- **CTA Button:** Changed from "Create Business Connection in Setup" to "Connect This Business"
- **Trust Message:** Added "This is a one-time setup. Your data stays isolated and private."

---

## Security & Stability

### SSRF Protection

- **DNS Rebinding Protection:** Resolves hostnames and validates all returned IPs
- **IP Range Blocking:** Blocks private, loopback, link-local addresses (IPv4 and IPv6)
- **Metadata Endpoints:** Blocks `metadata.google.internal`, `metadata`
- **Edge Cases:** Blocks `0.0.0.0`, `::`, IPv6 ULA and link-local ranges
- **Applied To:** Website Import URL validation

### Non-Blocking Design Philosophy

- **Widget Always Loads:** Widget functions even if database/API unavailable
- **Analytics Best-Effort:** Analytics failures never block functionality
- **Domain Validation Warn-Only:** Domain checks are informational, never block widget
- **Graceful Degradation:** All optional features have fallbacks

### Tenant Safety

- **Strict Isolation:** All operations require `businessId` and validate tenant mapping
- **Workspace Scoping:** `AiWorkspaceMap` enforces business → workspace relationship
- **Knowledge Ownership:** Validates entry belongs to business before update/delete
- **Widget Scoping:** Widget keys are business-specific

## Technical Improvements

### Performance

- Live preview uses local state (no unnecessary re-renders)
- localStorage operations properly scoped and error-handled
- Event listeners properly cleaned up
- Dynamic routes used where prerender would be unsafe

### Accessibility

- All interactive elements keyboard accessible
- Proper ARIA labels and roles
- Focus states visible in dark mode
- Screen reader friendly

### Safety

- No breaking changes
- All new features backwards compatible
- localStorage keys scoped by businessId
- No sensitive data in widget embed
- Standardized API responses throughout

---

## Database Schema

### New Models

- **AiHelpDeskWidgetEvent:** Stores analytics events (`widget_open`, `message_sent`)
- **AiHelpDeskWidgetSettings.allowedDomains:** String array for domain allowlist (defaults to empty array)

### Backwards Compatibility

- ✅ All new fields are optional or have safe defaults
- ✅ Existing widget settings continue to work
- ✅ Empty `allowedDomains` array means widget works everywhere
- ✅ No destructive schema changes

## Non-Breaking Changes

All enhancements are **additive only**:

- ✅ Database schema changes are backwards compatible
- ✅ API contract changes are additive (new optional fields)
- ✅ No breaking UI changes
- ✅ Existing settings continue to work
- ✅ Default behaviors unchanged

---

## Files Modified

### Components

- `src/app/apps/ai-help-desk/widget/components/WidgetSettings.tsx` - Added live preview, presets, auto-sync, avatar enhancements, domain allowlist, embed code
- `src/app/apps/ai-help-desk/knowledge/components/WebsiteImport.tsx` - Added drag/drop, recent URLs, autofill
- `src/app/apps/ai-help-desk/page.tsx` - Updated UX copy for business connection warning
- `src/app/widget/ai-help-desk/page.tsx` - Added theme preset support, initials fallback, domain validation, analytics events

### API Routes

- `src/app/api/ai-help-desk/widget/settings/route.ts` - Added `allowedDomains` support
- `src/app/api/ai-help-desk/widget/validate-domain/route.ts` - New endpoint for domain validation (warn-only)
- `src/app/api/ai-help-desk/widget/events/route.ts` - New endpoint for analytics events (non-blocking)
- `src/app/api/ai-help-desk/business-profile/route.ts` - Fixed error handling

---

## Production Verification

### Environment Variables

- `ANYTHINGLLM_BASE_URL` (required)
- `ANYTHINGLLM_API_KEY` (optional, warn-only)
- `NEXT_PUBLIC_BASE_URL` (optional, needed for widget)
- `AI_HELP_DESK_ADMIN_EMAILS` (optional, for admin features)

### Database Tables

- `AiWorkspaceMap` - Business to workspace mapping
- `AiHelpDeskEntry` - Knowledge entries
- `AiHelpDeskSyncState` - Sync status tracking
- `AiHelpDeskQuestionLog` - Question analytics
- `AiHelpDeskWidgetKey` - Widget authentication keys
- `AiHelpDeskWidgetSettings` - Widget configuration
- `AiHelpDeskWidgetEvent` - Analytics events

### Diagnostics

- Production readiness check: `/api/ai-help-desk/diagnostics/production-check` (admin-only)

## Next Steps (Optional)

### Future Enhancements

1. **Persist Theme Preset in Database:** Could add `themePreset` field to widget settings model
2. **Brand Color API Integration:** Connect auto-sync to actual OBD brand profile data
3. **Advanced Analytics Dashboard:** Visual insights for widget usage
4. **Domain Blocking Mode:** Optional strict mode for domain allowlist
5. **Multi-Language Support:** Widget greeting and UI in multiple languages

---

## Migration Notes

**Prisma Migration Required:** Run `npx prisma db push` or create migration for:
- `AiHelpDeskWidgetSettings.allowedDomains` (String[], defaults to [])
- `AiHelpDeskWidgetEvent` table (new)

**Backwards Compatibility:** All changes are backwards compatible. Existing widget settings continue to work as before. Empty `allowedDomains` array means widget works everywhere (with optional warning).

---

## Support

For issues or questions, please refer to:
- Production Audit: `docs/audits/ai-help-desk-v3-final-production-audit.md`
- Technical Documentation: `docs/apps/ai-help-desk-v3.md`

---

**Status:** ✅ Production Ready
