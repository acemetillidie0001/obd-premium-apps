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
- Download `.md`
- Download `.html`

## Guardrails
- Max payload size: 150KB (checked before JSON parsing)
- Refuses re-import if already imported
- Cleanup guaranteed via `try/finally`
- Dev-only logging prints metadata only (no draft content)
