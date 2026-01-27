# Local SEO Page Builder

## What this app IS

- A **template-based** tool that generates a **draft-only** local landing page content pack for a chosen service + city.
- A deterministic generator (template rules), designed for **review, editing, and export**.
- A place to produce a structured page pack (SEO fields, sections, FAQs, optional schema).

## What this app is NOT

- Not an auto-publisher (it does not update your website).
- Not a background automation or scheduling system.
- Not cross-app sync (it does not silently change other apps).

## What you typically get (outputs)

- SEO Pack: meta title, meta description, slug, H1
- Page copy (combined) + structured page sections
- FAQs (deterministic, template-based)
- Optional Schema JSON-LD (WebPage + FAQPage, when enabled/available)

## Draft & export behavior

- **Draft model**: generated baseline + optional edits; “edited wins” determinism.
- **Export** is manual:
  - copy formats (plain/markdown/html)
  - downloads (.txt/.md/.html and schema .json when available)
- Regenerate is designed to **protect edits** (review-first).

## Integrations & boundaries

- “Next Steps” handoffs are **user-initiated** and **draft-only**.
- Handoffs are stored in **sessionStorage** with a short TTL and require explicit confirmation.
- Receivers must explicitly import/apply; no cross-app mutation occurs automatically.

## Common questions

- **Does it write to my website?** No—export/copy only.
- **Is it AI-generated?** No—template-based and deterministic.
- **Can I edit the output?** Yes—edits override the generated baseline.
- **What does “handoff” do?** It sends a draft payload to another app for review-first import.
- **Will a handoff overwrite my other app?** It should be additive/apply-only; receivers require explicit confirmation.
- **Why keep outputs draft-only?** Prevents accidental publishing and cross-app side effects.

