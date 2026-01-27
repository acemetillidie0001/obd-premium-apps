# Common Questions (Help Center)

## Does OBD auto-publish anything?

No.
- OBD is **review-first**: it generates drafts you can edit.
- Exports are user-initiated copy/download workflows.
- Publishing (where available in a specific tool) requires explicit user action and confirmation.

## Why are exports draft-only?

Because draft-only prevents:
- accidental publishing
- cross-app side effects
- unreviewed content going live

Draft-only also makes workflows reversible: edit/cancel/reset before you export.

## Where do AI answers come from?

Help Center answers come from:
- saved OBD documentation
- saved knowledge in the Help Center’s dedicated global workspace

The Help Center does **not** browse the web.

## What does “Apply” mean?

“Apply” means **importing or filling** draft content into another tool’s inputs or draft state.

Typical rules:
- apply is **user-initiated**
- apply is **additive** (fill-empty / append) when possible
- apply does **not** publish, send, or change external accounts

## What’s the safest workflow?

- Generate a draft
- Review and edit
- Export/copy
- Paste or publish only after you’ve verified it

If a handoff exists:
- use it as a draft transfer
- confirm what will be imported before proceeding

## Where should I start?

Start with the tool closest to your goal:
- local landing pages → Local SEO Page Builder
- Google profile improvements → Google Business Profile tools
- FAQs → AI FAQ Generator
- general suite guidance → Help Center

If you need business-specific support:
- use the in-app AI Help Desk (tenant-scoped, mapped to your workspace)

## How do Teams & Users permissions work?

Teams & Users is the suite’s tenant-scoped access control layer:
- access is based on **membership** to a business
- roles typically include **Owner / Admin / Staff**
- the system is deny-by-default if membership is missing

## What data is stored vs not stored?

General principles:
- Stored: drafts, saved inputs/settings (where applicable), and integration configuration needed to perform explicit user actions.
- Not stored: your third-party passwords (OAuth is used when integrations exist).
- Not done automatically: publishing, scheduling, or cross-app mutation without your action.

Help Center specific:
- It does not use a business tenant context.
- It does not read business-scoped knowledge bases.
- It does not provide uploads or write endpoints.

