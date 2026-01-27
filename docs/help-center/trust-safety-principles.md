# Trust & Safety Principles (Help Center + OBD Suite)

## Core promise (plain language)

OBD Premium tools are built for **review-first** workflows:
- You generate drafts
- You edit
- You export or copy
- You decide what happens next

The Help Center follows the same approach: it is **global** and **read-only**.

## Non-negotiables

- **No automation**
  - No background jobs that act on your behalf.
  - No silent changes and no “do it for me” behavior.
- **Draft-only by default**
  - Outputs are drafts meant to be reviewed and edited.
  - Export/copy is user-initiated.
- **No auto-publish**
  - Nothing is published automatically (to your site, Google, Meta, or anywhere else).
- **No cross-app mutation**
  - One app does not silently change another app’s saved data.
  - Cross-app handoffs are **user-initiated** and **apply-only** (review-first).
- **No web browsing**
  - The Help Center does not browse the open web.
  - Answers are based on **saved OBD documentation and saved knowledge** only.

## Tenant safety inside apps (how the suite prevents cross-business access)

Many OBD apps are **tenant-scoped** (business-scoped):
- Access is derived from **membership** (deny-by-default).
- Server-side routes scope reads/writes to a single tenant key (`Business.id`).
- “Selector” parameters (like `businessId`) are treated as hints and must match an active membership; otherwise access is denied.

AI Help Desk (in-app) is tenant-scoped by design:
- Requests are scoped by **business → workspace mapping**.
- Workspace identifiers are resolved server-side; the browser does not choose a workspace.

## Help Center boundary (global + read-only)

The Help Center is intentionally different from in-app AI Help Desk:
- **Global**: uses a dedicated global workspace for shared, public-safe guidance.
- **Read-only**: no uploads, no account actions, no publishing, no settings.
- **No tenant data access**: it does not read business-scoped knowledge bases or any private business content.

## Reusable trust language (safe to quote in answers)

Use the following text as a consistent trust line in Help Center answers:

> OBD tools are review-first. Outputs are drafts you can edit and export. Nothing is automated or changed on your behalf, and nothing is published automatically. The Help Center is read-only and uses saved OBD documentation and saved knowledge only—it does not browse the web or access your business data.

