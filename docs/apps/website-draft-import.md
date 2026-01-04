# Website Draft Import

Route: `/apps/website-draft-import`  
Purpose: Receive `web-draft` handoffs from AI Content Writer for preview + export (no publishing).

## Flow
1. Detects handoff from URL params (fallback to localStorage via shared handoff helpers)
2. Validates payload (`web-draft` Zod schema)
3. Shows Import Ready banner (session-dismissible)
4. Review modal previews title/excerpt/first sections/meta
5. Requires explicit **Accept Draft**
6. After accept:
   - marks handoff imported (replay protection)
   - clears handoff URL params
   - clears handoff localStorage keys
   - enables export actions

## Export Options
- Copy as Markdown
- Copy as HTML
- Copy Gutenberg Blocks
- Copy Divi HTML
- Download `.md`
- Download `.html`
- Download Gutenberg HTML
- Download Divi HTML

## CMS Import Helpers
The CMS Import Helpers section provides step-by-step instructions for pasting exported content into WordPress (Gutenberg) or Divi Builder.

### Features
- **Two instruction cards**: One for WordPress (Gutenberg) and one for Divi Builder
- **Contextual suggestions**: Shows "Which should I use?" guidance based on which export format was last used
- **Copy Instructions buttons**: 
  - Individual buttons per CMS to copy formatted instructions
  - "Copy All Instructions" button to copy both sets in one block
- **Formatted output**: Instructions include title, best-for description, numbered steps, and gotcha notes

### Behavior
- Section is disabled (not hidden) until a draft is accepted
- Instructions are formatted as plain text with clear structure
- Toast notifications confirm successful copy operations

## Guardrails
- Max payload size: 150KB (checked before JSON parsing)
- Refuses re-import if already imported
- Cleanup guaranteed via `try/finally`
- Dev-only logging prints metadata only (no draft content)
