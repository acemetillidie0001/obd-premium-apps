# Local SEO Page Builder v1 - Release Notes

**Release Date:** December 2024  
**Status:** Production Ready (Template-Based v1)

## Overview

The Local SEO Page Builder generates complete local landing page content packs for service-based businesses targeting specific cities. This is a template-based v1 release with no AI enhancement.

## What Shipped

### Core Features
- **SEO Pack Generation**: Meta title, meta description, slug, and H1
- **Full Page Copy**: Structured content with hero, services, benefits, service area, and CTA sections
- **FAQ Section**: Exactly 6 tailored FAQs per service + city combination
- **Schema Bundle**: Optional JSON-LD schema (WebPage + FAQPage) when pageUrl is provided
- **Multiple Output Formats**: PlainText, WordPress, and HTML

### Input Fields

**Required:**
- Business Name
- Business Type
- Primary Service
- City
- State

**Optional:**
- Secondary Services (comma-separated, max 12, 40 chars each)
- Neighborhoods (comma-separated, max 12, 40 chars each)
- Target Audience (Residential, Commercial, Both)
- Unique Selling Points (textarea)
- CTA Preference (e.g., "Call now", "Request a quote")
- Phone
- Website URL
- Page URL (recommended for schema generation)
- Output Format (PlainText, WordPress, HTML)
- Include Schema Bundle (requires valid pageUrl)

### Output Formats

#### PlainText
- Clean headings with separator lines (`===` and `---`)
- Bullet points with `-` prefix
- Structured sections with clear hierarchy
- Readable for copy-paste into any text editor

#### WordPress
- Gutenberg-friendly formatting
- Blank lines between headings and paragraphs
- Simple bullet points with `•` character
- Ready for direct paste into WordPress editor

#### HTML
- Semantic HTML tags (h1, h2, p, ul, li, strong)
- No inline styles
- No script tags
- Safe for direct use in web pages
- Note: User input is not HTML-escaped (template-based content only)

### Schema Rules

**Schema is only generated when:**
1. `includeSchema === true` AND
2. `pageUrl` is provided and valid

**Schema includes:**
- WebPage schema with url, name, description
- FAQPage schema with all 6 FAQs as Question/Answer pairs
- Combined in `@graph` structure
- Returns as pretty-printed JSON string

**Warnings:**
- If schema is requested but pageUrl is missing, a warning is returned
- Schema generation is disabled in UI until valid pageUrl is entered

### SEO Pack Rules

- **H1**: `{Primary Service} in {City}, {State}`
- **Meta Title**: `{Primary Service} in {City}, {State} | {Business Name}` (smart-trimmed to 60 chars)
- **Meta Description**: Deterministic formula with smart trimming to 160 chars
- **Slug**: `{service-slug}-{city-slug}-{state-slug}` (e.g., `pressure-washing-ocala-fl`)

**Smart Trimming:**
- Meta titles trimmed at word boundaries when possible
- Meta descriptions trimmed at sentence or word boundaries
- Warnings returned when trimming occurs

### State Normalization

- US states are normalized to 2-letter abbreviations (e.g., "Florida" → "fl")
- Unknown states use slugified version
- Display name preserved for H1 and meta tags

## QA Checklist

### Authentication
- [ ] Logged-out users cannot access the app
- [ ] API returns 401 with "Authentication required" when not logged in

### Validation
- [ ] Required fields show validation errors
- [ ] Invalid URLs show validation errors
- [ ] Array limits enforced (max 12 items, 40 chars each)
- [ ] Duplicate items are automatically deduplicated

### Output Formats
- [ ] PlainText format renders correctly with separators
- [ ] WordPress format is paste-friendly
- [ ] HTML format uses semantic tags, no inline styles
- [ ] Format switching works correctly

### Schema Generation
- [ ] Schema toggle disabled until valid pageUrl entered
- [ ] Schema only generated when both conditions met
- [ ] Warning shown when schema requested but pageUrl missing
- [ ] Schema JSON is valid and properly formatted

### Exports
- [ ] Export .txt always available after generation
- [ ] Export .html only appears when format is HTML
- [ ] Export .json only enabled when schema exists
- [ ] All exports download correctly

### Brand Profile Integration
- [ ] Toggle "Use saved Brand Profile" works
- [ ] Fields auto-fill only when empty
- [ ] "From Brand Profile" chips appear and clear on edit

### Warnings
- [ ] Trimming warnings appear in banner
- [ ] Schema warnings appear when applicable
- [ ] Warning banner styling matches V3 pattern

## Known Limitations

1. **No AI Enhancement**: This is a template-based v1 release. Content is generated from deterministic templates, not AI-generated.

2. **HTML Escaping**: User input in HTML output is not HTML-escaped. This is acceptable for template-based content from validated form fields, but should be reviewed if allowing user-generated content in future versions.

3. **Fixed FAQ Count**: Exactly 6 FAQs are generated. No customization of FAQ count in v1.

4. **Template-Based Content**: All content follows fixed templates. No variation or personalization beyond form inputs.

5. **No Content Preview**: No live preview of how content will appear on the page.

6. **No Multi-Language**: English only in v1.

## Technical Details

### Files
- `src/app/apps/local-seo-page-builder/page.tsx` - UI component
- `src/app/api/local-seo-page-builder/route.ts` - API endpoint
- `src/app/apps/local-seo-page-builder/types.ts` - TypeScript types

### Dependencies
- Next.js App Router
- Auth.js for authentication
- Zod for validation
- No external AI services (template-based)

### API Response Shape

**Success:**
```json
{
  "ok": true,
  "data": {
    "seoPack": { "metaTitle", "metaDescription", "slug", "h1" },
    "pageCopy": "string (formatted)",
    "faqs": [{ "question", "answer" }],
    "schemaJsonLd": "string (optional)",
    "meta": { "requestId", "createdAtISO" },
    "warnings": ["string"] (optional)
  }
}
```

**Error:**
```json
{
  "ok": false,
  "error": "string",
  "requestId": "string",
  "issues": {} (optional, dev only)
}
```

## Future Enhancements (Not in v1)

- AI-powered content variation
- Multi-language support
- Custom FAQ count
- Content preview
- HTML entity escaping for user input
- Integration with CMS platforms
- Bulk generation for multiple services

