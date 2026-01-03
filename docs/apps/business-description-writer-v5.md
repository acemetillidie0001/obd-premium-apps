# AI Business Description Writer V5 Documentation

## V5.0.0 Complete ✅

AI Business Description Writer (V5.0.0) is **production-ready and LIVE** as part of the OBD Premium Apps suite. It provides comprehensive business description generation, quality analysis, deterministic improvements, and seamless integration with other OBD tools.

### What It Does

AI Business Description Writer helps businesses create, refine, and reuse high-quality business descriptions across multiple channels:

**Core Features:**
- **Multi-Channel Generation**: Creates descriptions optimized for Directory Listing, Google Business Profile, Website/About Page, and Citations
- **Quality Analysis**: Health check identifies issues without making changes
- **Deterministic Fixes**: Rule-based improvement suggestions with preview
- **Version Management**: Save, load, and manage description versions
- **Integration**: Push to AI Help Desk Knowledge, copy CRM note packs
- **Workflow Polish**: Apply all fixes, undo stack, edited badges, smooth scrolling

### What It Does NOT Do (V5 Guardrails)

- ❌ Automatic edits (all changes require explicit user approval)
- ❌ AI-powered fix suggestions (uses deterministic rules only)
- ❌ Multi-level undo (single-level undo only)
- ❌ Real-time collaboration (single-user workflow)

---

## How to Use

### Basic Workflow

1. **Generate Descriptions**
   - Fill out the form with business details
   - Click "Create Description"
   - Wait for AI generation (typically 5-10 seconds)

2. **Review in Tabs**
   - Use the Use Case Tabs to view descriptions by channel
   - Check character counts for each description
   - Copy individual descriptions as needed

3. **Check SERP Preview**
   - View how your meta description appears in Google search results
   - Verify character count (140-160 characters optimal)

4. **Run Health Check**
   - Review the Description Health Check panel
   - Identify missing location mentions, service keywords, length issues, or risky claims
   - Note: Health check is analysis-only (no automatic changes)

5. **Apply Fix Packs (Optional)**
   - Review fix pack suggestions in the Premium Fix Packs panel
   - Click "Preview" to see before/after changes
   - Click "Apply Fix" to apply individual fixes
   - Or click "Apply All Recommended" to batch apply all fixes
   - Use "Undo" to revert the last change
   - Use "Reset edits" to restore original content

6. **Save Version**
   - Click "Save Version" to save current descriptions
   - Versions are saved to database (with localStorage fallback)
   - Use "View Saved" to load previous versions

7. **Reuse Content**
   - **Push to Help Desk**: Send descriptions to AI Help Desk Knowledge base
   - **Copy CRM Note Pack**: Copy formatted content for CRM systems
   - **Export JSON**: Export version data for backup or sharing

---

## Safety & Trust

### Deterministic Fixes

All fix packs use **rule-based transformations** (no AI calls):
- **Add Location**: Appends location sentence if missing
- **Trim Length**: Truncates at sentence boundaries
- **Service Mentions**: Appends service sentence if missing
- **Safer Claims**: Replaces risky phrases with trustworthy alternatives
- **Meta Optimization**: Adds location and trims length

**No AI calls in fix packs** — all transformations are predictable and previewable.

### No Auto-Edits

- **All changes require explicit user approval**
- Original result is **never mutated**
- Edits stored in separate `editedResult` state
- Reset button always available to restore original

### Feature-Flagged

- All V4/V4.5/V5 features gated behind `flags.bdwV4`
- Legacy UI remains functional when V4 disabled
- Backward compatible with existing workflows

### Tenant-Safe Help Desk Push

- **BusinessId validation**: Help Desk push validates businessId ownership
- **No cross-tenant access**: Each business can only push to their own knowledge base
- **Error handling**: Graceful error messages for unauthorized access

### Database/LocalStorage Fallback

- **DB-first approach**: Attempts database save first
- **Automatic fallback**: Uses localStorage when database unavailable
- **User-friendly messaging**: Clear feedback for fallback scenarios
- **No data loss**: Versions preserved in localStorage during fallback

---

## Troubleshooting

### Help Desk Push Requires BusinessId

**Issue:** "Business ID is required" error when trying to push to Help Desk.

**Solution:**
- Open the app from your OBD dashboard (businessId is automatically included)
- Or add `?businessId=xxx` to the URL
- The app will show a helpful tip if businessId is unavailable

**Location:** Tip appears in Content Reuse Suggestions panel when businessId unavailable.

---

### Database Unavailable Fallback

**Issue:** Versions saved to localStorage instead of database.

**Expected Behavior:**
- App automatically falls back to localStorage when database is unavailable
- You'll see a message: "Version saved locally (cloud unavailable)"
- Versions are still accessible and functional
- When database becomes available, new saves will use database

**No Action Required:** This is expected behavior and ensures reliability.

---

### Export/Import JSON Guidance

**Export:**
1. Click "View Saved" to open Saved Versions panel
2. Click "Export" to download JSON file
3. JSON contains all saved versions with inputs and outputs

**Import:**
1. Click "View Saved" to open Saved Versions panel
2. Click "Import" and select JSON file
3. Versions are imported to localStorage (database import not yet supported)

**Note:** Export/Import uses localStorage format. Database-backed versions are automatically synced.

---

### Fix Packs Not Showing

**Possible Causes:**
1. **V4 not enabled**: Check that `flags.bdwV4` is true
2. **No health issues**: Fix packs only appear when health check identifies issues
3. **No suggestions**: Some descriptions may not need fixes

**Solution:**
- Verify feature flag is enabled
- Check Description Health Check panel for identified issues
- Fix packs appear automatically when issues are detected

---

### Undo Not Working

**Possible Causes:**
1. **No history**: Undo is disabled when edit history is empty
2. **History cleared**: History is cleared on reset or new generation

**Solution:**
- Undo only works after applying at least one fix
- History is intentionally cleared on reset to prevent confusion
- Use "Reset edits" to restore original content if needed

---

## Technical Architecture

### Component Structure

```
src/app/apps/business-description-writer/
  └── page.tsx (Main page with V4/V5 features)

src/components/bdw/
  ├── FixPacks.tsx (Fix packs UI)
  ├── DescriptionHealthCheck.tsx (Health check analysis)
  ├── SavedVersionsPanel.tsx (Version management)
  └── ContentReuseSuggestions.tsx (Reuse options)

src/lib/utils/
  ├── bdw-fix-packs.ts (Fix pack transformations)
  ├── bdw-health-check.ts (Health check logic)
  ├── bdw-saved-versions.ts (localStorage storage)
  ├── bdw-saved-versions-db.ts (Database storage)
  ├── bdw-help-desk-integration.ts (Help Desk integration)
  ├── bdw-crm-note-pack.ts (CRM note pack builder)
  └── resolve-business-id.ts (BusinessId resolver)
```

### State Management

- **`result`**: Original AI-generated result (never mutated)
- **`editedResult`**: Edited version after applying fix packs (null if no edits)
- **`editHistory`**: Stack of previous states for undo functionality
- **`displayResult`**: Computed as `editedResult ?? result` (shows edited if available)

### Feature Flags

- **`flags.bdwV4`**: Controls all V4/V4.5/V5 features
- When disabled, app uses legacy UI (backward compatible)

### Database Schema

- **`BdwSavedVersion`**: Existing model for version storage
- No new migrations required for V5

---

## Migration Notes

### From V3 to V5

**No Migration Required:**
- All V5 features are additive
- Existing functionality remains unchanged
- Legacy UI available when V4 disabled

**Optional Migration:**
- Enable `flags.bdwV4` to access V4/V5 features
- Existing saved versions (if any) remain accessible

---

## Related Documentation

- [Business Description Writer V5 Release Notes](docs/releases/business-description-writer-v5.md)
- [Business Description Writer Changelog](docs/changelogs/business-description-writer.md)
- [OBD UI System — Shared Components](docs/obd-ui-system-shared-components.md)

---

## Support

For issues or questions:
1. Check this documentation first
2. Review the Troubleshooting section
3. Check the Release Notes for known limitations
4. Contact OBD support if issue persists

