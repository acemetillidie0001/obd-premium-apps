# Business Schema Generator

## What this app IS

- A schema builder that generates **JSON-LD** for a business (LocalBusiness) and optional related schemas (FAQPage, WebPage).
- A form-driven, deterministic output generator designed for **review and export**.
- An app that can prefill fields from an existing Brand Profile (when available), without overwriting user edits.

## What this app is NOT

- Not an auto-publisher (it does not inject schema into your website).
- Not a crawler or site scanner.
- Not a background job system or automation engine.

## What you typically get (outputs)

- LocalBusiness JSON-LD (always included in the bundle)
- Optional FAQPage JSON-LD (when FAQ is enabled and valid FAQs exist)
- Optional WebPage JSON-LD (when enabled and required fields are provided)
- A “Full Schema Bundle (Recommended)” JSON object with `@context` and `@graph`

## Draft & export behavior

- Output is a **draft** intended for manual review before use.
- Export is user-initiated:
  - copy to clipboard
  - download `.json`
  - download `.txt`
- Empty/invalid optional sections are omitted (with warnings) rather than forcing broken schema.

## Integrations & boundaries

- Does not publish to your site or CMS.
- May accept **apply-only** content from other tools (where a handoff exists), but does not auto-import or auto-save without user action.
- Authentication is enforced in the app/API (tenant-scoped access control applies).

## Common questions

- **Will this add schema to my website automatically?** No—export/copy only.
- **What is the “Full Schema Bundle”?** A combined `@graph` bundle for safer copy/paste reuse.
- **What happens if FAQs are empty?** FAQ schema is omitted and a warning is shown.
- **Do I need a page URL for WebPage schema?** Yes, when WebPage is enabled.
- **Can Brand Profile prefill overwrite my edits?** It should fill empty fields and stop when you edit.
- **Is this deterministic?** Yes—outputs are derived from form inputs and rules.

